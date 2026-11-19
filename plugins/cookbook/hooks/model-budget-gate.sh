# Gate of the Cookbook plugin's PostToolUse model-budget note. hooks.json sources this file (`.`) in
# the hook's own `bash -c`, so it starts no process of its own: until Node starts it uses bash
# builtins only. It starts hooks/model-budget-note.mjs at most once per five minutes per
# session, and never for a subagent's tool call (the note ignores those anyway). A long turn still
# hears a changed advice within minutes: the reading it rests on changes at most once per ten
# minutes. Any doubt (no session id found, no state folder yet, an unreadable gate) starts Node, as
# every tool call did before. Argument: the plugin root.
mb_root="$1"
mb_head=""
# The hook input starts with session_id, and a subagent's names agent_id within its first few
# hundred characters, before hook_event_name and the tool's own input; 1,024 is enough to see
# both. Only that part is searched, so a tool input with an agent_id key is not taken for a
# subagent. The rest stays in the pipe for Node.
IFS= read -r -N 1024 mb_head
mb_keys="${mb_head%%\"hook_event_name\":*}"
if [[ $mb_keys != *'"agent_id":'* ]]; then
  mb_re='^\{"session_id":"([A-Za-z0-9_-]{1,80})"'
  mb_gate=""
  mb_next=0
  if [[ $mb_head =~ $mb_re ]]; then
    mb_gate="${USERPROFILE:-$HOME}/.local/share/model-budget/sessions/${BASH_REMATCH[1]}.gate"
    { IFS= read -r mb_next < "$mb_gate"; } 2>/dev/null
    # No leading zero: bash would read 08 as octal and fail.
    [[ $mb_next =~ ^(0|[1-9][0-9]{0,11})$ ]] || mb_next=0
  fi
  printf -v mb_now '%(%s)T' -1
  # A gate further ahead than one window (a clock set back) counts as none.
  if (( mb_now >= mb_next || mb_next > mb_now + 300 )); then
    # The note's own folder: written only once the note has made it, so a first start always runs Node.
    [[ -n $mb_gate ]] && { printf '%s\n' "$((mb_now + 300))" > "$mb_gate"; } 2>/dev/null
    { printf '%s' "$mb_head"; cat; } | node "$mb_root/hooks/model-budget-note.mjs"
  fi
fi
exit 0
