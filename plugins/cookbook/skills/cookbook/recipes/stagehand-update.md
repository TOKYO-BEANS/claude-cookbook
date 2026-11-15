# Browser automation in a session (Stagehand): updating

- **To update** (needs the owner's yes; it is never a routine update): scan the new commit's
  `pnpm-lock.yaml` and tree with the three scanners (`cfg/scan.sh` in the vetting folder is the
  pattern); run the same install once in a sandbox, with install scripts on
  (`sandbox-probe.sh` copied into a checkout of that commit, then `boat run --type default
  --no-env --timeout 1800 --push <that checkout> -- bash sandbox-probe.sh --cmd "npm install -g
  pnpm@11.11.0 && <the pnpm install below, without --ignore-scripts>"`; `pinned-vet.sh` is npm
  only), and read its `SANDBOX` lines as [boat.md](boat.md) says. Only the install runs
  there: the build needs 12 GB of memory and the `default` sandbox has 8 GB. Not yet run for
  Stagehand (the probe's `--cmd` form is proven on an npm install only), so the first update
  proves it; fetch that commit in the install folder; `pnpm install --frozen-lockfile
  --ignore-scripts --package-import-method copy --filter "@browserbasehq/stagehand-integrations..."
  --filter "@browserbasehq/stagehand-extension..."`; build the extension first, then
  `--filter "@browserbasehq/stagehand-integrations..." run build`, with
  `NODE_OPTIONS=--max-old-space-size=12288` (the SDK build needs more than Node's default memory)
  and `pnpm` on the path (the SDK's build calls it to pack); list
  `node_modules/.pnpm` for any package an advisory names; then one real call and a check that no
  session is left running.
