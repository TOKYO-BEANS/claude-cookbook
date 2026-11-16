# Options weighed: plan and build

Chosen by fit for the job on 15 November 2026. Usage counts only show what is dead after a
fair trial; they never pick an owner.

- **Plan, build, debug: Superpowers.** It covers the whole stretch from intent to a verified
  change (brainstorming, written plan, test-first, root-cause debugging, fresh evidence), and
  the `sa-*` workflows are built on it. Weighed: GitHub Spec Kit (a spec reviewed at
  each stage: the owner sets outcomes and approves no specs); Claude Code's plan mode (a plan,
  no test-first or debugging discipline); tstack (starts where the code is finished: see
  "ship").
- **Several agents: the `sa-*` workflows.** One implementer and one reviewer per task, an agent
  budget, evidence over opinions, and the stops written in. Weighed: ad hoc Workflow scripts (no budget); T3 `delegate_task` (right
  for another provider's model, heavier for the same one).
- **One side piece: the Cookbook dispatch profiles.** A fixed model, effort and tool list per
  kind of piece. Weighed: an untyped subagent (inherits every tool and the session's model); a
  T3 delegate (a whole thread for a small piece).
- **A second opinion: a consult.** One question to the other provider through T3
  `delegate_task`; advice, never a check. Weighed: tstack's `sol-loop` and `council` (see
  "ship"); a `cookbook:review` subagent (the same provider: no second opinion).
- **Code structure: Graphify.** Callers, impact and linked tests from an index, and the `sa-*`
  workflows and the standard already call it. Weighed: Sourcegraph (a hosted service for many
  repositories; ours are few); Serena or another language-server MCP (precise per language,
  one more server in every session); ast-grep (syntax search, no call graph); `rg` alone (the
  fallback: text, not structure).
- **Judgement in product code: TypeSafe / Jev.** Typed answers with probabilities and an
  explicit no-match. Weighed: a Claude API call with a typed answer (the fallback when no
  primitive fits; slower and dearer per item); embeddings with a threshold (no reasons, a
  store to keep); fixed rules (measure them first: where a rule scores 0.925 or more, keep it).
- **Visual design: Claude Design.** Options side by side on a canvas with the project's design
  system, in the tool already open. Weighed: Figma with its MCP server (a second tool and
  a hand-off step); v0 and similar generators (they emit their own stack's code); Adobe
  Express (posters and social graphics, not product screens).
- **Photos: Adobe Firefly.** Sharpest on real faces in the side-by-side test, without
  redrawing them. Weighed: Nero AI Unblur (half the sharpness score), Upscayl (no gain),
  Topaz Photo AI (not tested; a paid desktop app).
- **Photo editing: Adobe for creativity.** Its masks (subject, skin, a named object) carried a
  colour fix on 14 photos that one preset could not do. Weighed: Firefly's web app (no masks;
  its "remove object" re-rendered the whole photo small); the connector in every session (109
  tool names each time, the reason it was once switched off); a subagent with the server
  defined inline (Adobe refuses a direct connection).
- **Skills: Superpowers `writing-skills`.** It tests a skill the way code is tested. Weighed:
  the bundled `skill-creator` (the fallback: it ships with the app).
- **Model per turn: the thread's setting.** No router that works inside T3 Code was found: a
  mod sees a T3 Code session as headless and skips it.
