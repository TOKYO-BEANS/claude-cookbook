# 25 November 2026: two design skills tried, neither used; "code execution with MCP" weighed

**Why.** The owner asked to try Google's `gemini-frontend-design` skill
(<https://github.com/google-gemini/demolab/tree/main/skills/gemini-frontend-design>), and whether
we should quickly adopt Anthropic's "code execution with MCP"
(<https://www.anthropic.com/research/code-execution-with-mcp>), which people call "MCP 2.0".

**What changed.** `options/design-skills-compared.md` records the trial: with no skill, Opus 5.5's
pages scored 7.8 out of 10; with Anthropic's `frontend-design` 7.4; with Gemini's skill 6.0 (last
in 9 of 12 blind judgements). `recipes/visual-design.md` now says to build with no design skill and
to capture the whole page at 1440 and 390 px with a sideways-scroll check. `options/keep-healthy.md`
records the MCP article as weighed: its two gains (tool definitions loaded on demand, results kept
out of the conversation) are Claude Code's tool search and context-mode, already in use. The
article is from November 2025. The real "next MCP" is the 2026-07-28 specification (a stateless
core, extensions, Tasks, MCP Apps; Roots, Sampling and Logging deprecated); that is for the
clients and servers to adopt, and `stack-updates` follows their releases.

**Verification.** 18 builds on the plan token (`apiKeySource: none` in every run), 12 judgements;
the skill loaded in every skill-arm run. The Cookbook check and the suite on boat.

**Outstanding.** None.

**Dead ends.** The first captures made the window as tall as the page. That breaks sticky
sections, and the judge failed a Gemini page as empty. Those captures and the one verdict made from them sit in
`shots-tall-window-discarded/` and `judge-tall-window-discarded/`; all pages were captured again by
scrolling a real window.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-25-design-skill-trial/`. The release
check writes
`~/.local/share/release-maintenance/evidence/2026-11-25-cookbook-design-skills-and-mcp-code/release-check.log`.
