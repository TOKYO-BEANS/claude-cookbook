#!/usr/bin/env bash
# CodeQL in Depot CI (Stack Atlas standard). Managed file: change it only
# through the stack-atlas-onboard skill.
#
# Three stages, one step each, so that the token never meets the repository's
# own code:
#   prepare  (token)    the pinned bundle (sha256 checked), the languages,
#                        the ref and commit to upload to;
#   analyse  (no token) a database per language and its analysis with the
#                        repository's query suite (a Go build runs the
#                        repository's code, here, with no token around);
#   upload   (token)    the SARIF to GitHub code scanning under the categories
#                        default setup used (`/language:<language>`), waiting
#                        until GitHub has processed each one.
# Any stage that does not finish fails the job: a scan that did not reach
# GitHub is never shown as passed.
#
# Needs: CODEQL_VERSION and CODEQL_SHA256 (prepare), GITHUB_TOKEN with
# security-events: write (prepare, upload), .depot/codeql/suite, and the GitHub
# Actions variables Depot CI sets.
set -euo pipefail

STAGE="${1:-}"
API="${GITHUB_API_URL:-https://api.github.com}"
WORK="${RUNNER_TEMP:-/tmp}/codeql-scan"
SRC="${GITHUB_WORKSPACE:-$PWD}"
: "${GITHUB_REPOSITORY:?}"

gh_api() {
  curl -fsS --retry 5 --retry-delay 5 --retry-all-errors \
    -H "Authorization: Bearer $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" "$@"
}

prepare() {
  : "${CODEQL_VERSION:?}" "${CODEQL_SHA256:?}" "${GITHUB_TOKEN:?}"
  rm -rf "$WORK"
  mkdir -p "$WORK/db" "$WORK/sarif"

  # The query suite default setup ran in this repository, recorded at
  # onboarding in .depot/codeql/suite: `default` (the code-scanning suite) or
  # `extended` (security-extended). Anything else stops the scan.
  local suite
  suite="$(tr -d '[:space:]' <"$SRC/.depot/codeql/suite" 2>/dev/null || true)"
  case "$suite" in
    default) echo code-scanning >"$WORK/qls" ;;
    extended) echo security-extended >"$WORK/qls" ;;
    *)
      echo "::error::.depot/codeql/suite must read default or extended, not '${suite}'"
      exit 1
      ;;
  esac
  echo "$suite" >"$WORK/suite"

  # The bundle, pinned by version and sha256.
  local bundle="$WORK/codeql-bundle-linux64.tar.zst"
  curl -fsSL --retry 5 --retry-delay 5 --retry-all-errors -o "$bundle" \
    "https://github.com/github/codeql-action/releases/download/codeql-bundle-v${CODEQL_VERSION}/codeql-bundle-linux64.tar.zst"
  echo "${CODEQL_SHA256}  $bundle" | sha256sum -c -
  tar --zstd -xf "$bundle" -C "$WORK"
  rm -f "$bundle"
  "$WORK/codeql/codeql" version --format=terse >"$WORK/version"

  # The languages: GitHub's language list for the repository, as default
  # setup reads it, plus `actions` when the repository holds GitHub workflow
  # or action files. A language CodeQL cannot analyse on Linux fails the job.
  local langs_json name
  langs_json="$(gh_api "$API/repos/$GITHUB_REPOSITORY/languages")"
  declare -A want=()
  while IFS= read -r name; do
    case "$name" in
      JavaScript|TypeScript|Vue) want[javascript-typescript]=1 ;;
      Python) want[python]=1 ;;
      Go) want[go]=1 ;;
      Java|Kotlin) want[java-kotlin]=1 ;;
      C|C++) want[c-cpp]=1 ;;
      C#) want[csharp]=1 ;;
      Ruby) want[ruby]=1 ;;
      Rust) want[rust]=1 ;;
      Swift)
        echo "::error::Swift needs a macOS runner, which Depot CI does not have"
        exit 1
        ;;
    esac
  done < <(jq -r 'keys[]' <<<"$langs_json")
  if compgen -G "$SRC/.github/workflows/*.y*ml" >/dev/null ||
    [ -n "$(find "$SRC" -path "$SRC/.git" -prune -o \( -name action.yml -o -name action.yaml \) -print -quit)" ]; then
    want[actions]=1
  fi
  if [ "${#want[@]}" -eq 0 ]; then
    echo "::error::no language CodeQL analyses was found in $GITHUB_REPOSITORY"
    exit 1
  fi
  printf '%s\n' "${!want[@]}" | sort >"$WORK/languages"

  # The ref and commit, as default setup recorded them: a pull request's
  # analysis goes to refs/pull/<n>/head on its head commit (the job checks
  # that commit out), anything else to the ref that ran.
  local ref commit
  if [ "${GITHUB_EVENT_NAME:-}" = pull_request ]; then
    commit="$(jq -r '.pull_request.head.sha' "$GITHUB_EVENT_PATH")"
    ref="refs/pull/$(jq -r '.pull_request.number' "$GITHUB_EVENT_PATH")/head"
  else
    ref="${GITHUB_REF:?}"
    commit="$(git -C "$SRC" rev-parse HEAD)"
  fi
  if [ "$(git -C "$SRC" rev-parse HEAD)" != "$commit" ]; then
    echo "::error::checked-out commit $(git -C "$SRC" rev-parse HEAD) is not $commit"
    exit 1
  fi
  echo "$ref" >"$WORK/ref"
  echo "$commit" >"$WORK/commit"
  date -u +%Y-%m-%dT%H:%M:%SZ >"$WORK/started"
  echo "CodeQL $(cat "$WORK/version") ($suite), languages: $(tr '\n' ' ' <"$WORK/languages"), ref $ref, commit $commit"
}

analyse() {
  if [ -n "${GITHUB_TOKEN:-}" ]; then
    echo "::error::the analyse stage runs without GITHUB_TOKEN"
    exit 1
  fi
  local qls lang pack mode
  qls="$(cat "$WORK/qls")"
  while IFS= read -r lang; do
    case "$lang" in
      javascript-typescript) pack=javascript ;;
      java-kotlin) pack=java ;;
      c-cpp) pack=cpp ;;
      *) pack="$lang" ;;
    esac
    case "$lang" in
      go) mode=autobuild ;;
      *) mode=none ;;
    esac
    echo "::group::CodeQL $lang"
    "$WORK/codeql/codeql" database create "$WORK/db/$lang" --language="$lang" \
      --build-mode="$mode" --source-root="$SRC" --threads=0 --overwrite
    "$WORK/codeql/codeql" database analyze "$WORK/db/$lang" \
      "codeql/${pack}-queries:codeql-suites/${pack}-${qls}.qls" \
      --format=sarif-latest --sarif-category="/language:$lang" \
      --sarif-add-baseline-file-info --threads=0 --output="$WORK/sarif/$lang.sarif"
    echo "::endgroup::"
  done <"$WORK/languages"
}

upload() {
  : "${GITHUB_TOKEN:?}"
  local ref commit started summary lang out results payload code id status reply
  ref="$(cat "$WORK/ref")"
  commit="$(cat "$WORK/commit")"
  started="$(cat "$WORK/started")"
  summary="${GITHUB_STEP_SUMMARY:-/dev/null}"
  {
    echo "### CodeQL $(cat "$WORK/version") ($(cat "$WORK/suite"))"
    echo
    echo "Ref \`$ref\`, commit \`$commit\`."
    echo
    echo "| Language | Results | Upload |"
    echo "| --- | --- | --- |"
  } >>"$summary"
  while IFS= read -r lang; do
    out="$WORK/sarif/$lang.sarif"
    if [ ! -s "$out" ]; then
      echo "::error::no SARIF for $lang"
      exit 1
    fi
    results="$(jq '[.runs[].results[]?] | length' "$out")"
    payload="$WORK/sarif/$lang.json"
    gzip -c "$out" | base64 -w0 >"$WORK/sarif/$lang.b64"
    jq -n --arg commit "$commit" --arg ref "$ref" --arg uri "file://$SRC" \
      --arg started "$started" --rawfile sarif "$WORK/sarif/$lang.b64" \
      '{commit_sha: $commit, ref: $ref, sarif: $sarif, checkout_uri: $uri, started_at: $started, tool_name: "CodeQL"}' \
      >"$payload"
    code="$(curl -sS --retry 5 --retry-delay 5 -o "$WORK/sarif/$lang.reply" -w '%{http_code}' -X POST \
      -H "Authorization: Bearer $GITHUB_TOKEN" -H "Accept: application/vnd.github+json" \
      -H "X-GitHub-Api-Version: 2022-11-28" \
      "$API/repos/$GITHUB_REPOSITORY/code-scanning/sarifs" --data-binary "@$payload")"
    if [ "$code" != 202 ]; then
      echo "| $lang | $results | refused ($code) |" >>"$summary"
      echo "::error::GitHub refused the $lang upload (HTTP $code): $(head -c 600 "$WORK/sarif/$lang.reply")"
      exit 1
    fi
    id="$(jq -r '.id' "$WORK/sarif/$lang.reply")"
    status=pending
    for _ in $(seq 1 120); do
      reply="$(gh_api "$API/repos/$GITHUB_REPOSITORY/code-scanning/sarifs/$id")"
      status="$(jq -r '.processing_status' <<<"$reply")"
      [ "$status" = pending ] || break
      sleep 5
    done
    echo "| $lang | $results | $status |" >>"$summary"
    if [ "$status" != complete ]; then
      echo "::error::GitHub did not process the $lang upload ($status): $(jq -c '.errors // empty' <<<"$reply")"
      exit 1
    fi
    echo "$lang: $results results, upload $id processed"
  done <"$WORK/languages"
}

case "$STAGE" in
  prepare) prepare ;;
  analyse) analyse ;;
  upload) upload ;;
  *)
    echo "::error::usage: scan.sh prepare|analyse|upload"
    exit 1
    ;;
esac
