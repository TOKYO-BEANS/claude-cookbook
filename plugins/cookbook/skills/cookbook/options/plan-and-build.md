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
  for a piece in its own checkout, heavier for one in the same).
- **One side piece: the Cookbook dispatch profiles.** A fixed model, effort and tool list per
  kind of piece. Weighed: an untyped subagent (inherits every tool and the session's model); a
  T3 delegate (a whole thread for a small piece).
- **A second opinion: Codex.** Another vendor's model, already in T3 Code on a paid account, and
  it reads the same rules. Weighed: a second Claude model (shares Claude's blind spots); a
  hosted reviewer (see "check"); tstack's `sol-loop` and `council` (see "ship").
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
- **Photos: no tool.** Adobe Firefly (sharpening) and Adobe for creativity (masks) left on
  17 November 2026 with the Adobe trial. PhotoCraft 0.23.1 (local, Apache/MIT) was tested
  that day on 10 public-domain photos: Select Subject was right on 1 of 5 people, a box drawn
  around the person on 3 of 5; no object by name, no face-aware skin mask, no auto
  straighten. Its segmentation has no learned model. Next: LightCraft with Meta's SAM 3
  (gated weights, SAM License). Weighed for sharpening: Nero AI Unblur, Upscayl, Topaz Photo
  AI (paid). ArtCraft Studio is generative only: never on photos of real people.
- **Skills: Superpowers `writing-skills`.** It tests a skill the way code is tested. Weighed:
  the bundled `skill-creator` (the fallback: it ships with the app).
- **Model per turn: the model budget.** Weighed: a T3 Code router, both apps' fallbacks,
  CLIProxyAPI ([model-budget-setup](../recipes/model-budget-setup.md)).
