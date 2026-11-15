# Photos: routes to the Adobe connector that do not work

Tried on 15 November 2026 (Claude Code 2.1.325), before the child session
([setup](photos-adobe-connector-setup.md)) was chosen. Do not try them again unless what
clears them has happened.

- **A subagent with the server defined inline** (`mcpServers` in an agent file under
  `~/.claude/agents/`; a plugin agent ignores that field). The mechanism works: with another
  signed-in server, the subagent got its tools and the main session listed no server, and the
  agent's description cost about 100 tokens a session. Adobe's server does not:
  `https://adobe-creativity.adobe.io/mcp` answers every request from Claude Code with HTTP 403
  and an empty body, with a fresh token from `claude mcp login` as well. Adobe offers the
  connector in Claude chat, Cowork and Claude Desktop only. Clears when Adobe accepts other MCP
  clients. The agent file, the server entry and its sign-in were removed again.
- **`claude mcp login` for a server that only an agent file defines.** The command does not
  see it. The sign-in went through a folder that had the same server name and URL in local
  scope; the subagent then found the token (it is stored by server name and configuration).
- **The plugin's own server** (`plugin:adobe-for-creativity:Adobe`) is the same direct address,
  so it is refused the same way. It stays denied and the plugin disabled.
- **An allow list.** `allowedMcpServers` naming `claude.ai Adobe` blocked that connector too,
  so the child session denies the other connectors by name instead.
- **One project or one subagent only.** No way was found to give a claude.ai connector to one
  project or one subagent. Settings lists merge, so a project cannot lift the user-level deny
  (Claude Code's docs; not tested here), and a subagent can only share a server its parent
  session has (the docs).
