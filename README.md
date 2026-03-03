# SDD — Spec Driven Development Plugin for Claude Code

Stop vibe coding. Start building with specs — and learn to write better ones along the way.

SDD is a Claude Code plugin that gives you a structured way to define what you want **before** any code is written. When you ask an AI to build a feature without a plan, it makes hundreds of small decisions on your behalf — and many of them will conflict with each other or with what you actually wanted. SDD prevents that.

But SDD does something else that no other spec framework does: **it teaches you**. Every interaction is designed so that you finish the feature knowing more than when you started — about writing requirements, about making architectural decisions, about thinking in edge cases. The governance keeps your project clean; the pedagogy makes you a better builder.

Every feature goes through a structured lifecycle — specify, clarify, plan, tasks, implement, validate — with human approval at every step. The spec is the source of truth; code is a derived artifact. If code can't be traced back to a requirement, the system catches it.

## Why SDD exists

Without specifications constraining the decision space, AI-assisted development becomes a multiplier of both speed and technical debt simultaneously. LLMs generate code by probabilistic token prediction — they don't reason about your architecture, your team's conventions, or your product goals unless you tell them explicitly.

But there's a deeper problem. When AI writes all the code, the human stops learning. You ship features faster but understand them less. Over time you become a passenger in your own codebase — able to describe what you want, unable to evaluate what you got. SDD is designed to prevent both failure modes: the technical debt from unstructured AI, and the skill atrophy from passive AI use.

SDD constrains Claude's behavior through three mechanisms: specs that define what to build, a constitution that defines how to build it, and a state machine that enforces the workflow order. And it uses three pedagogical mechanisms to keep you learning: coaching during spec writing that adapts to your level, pair-programming mode that puts you in the driver's seat for business logic, and retrospectives that consolidate what you learned. Claude can't skip steps, can't auto-advance, and can't implement anything that isn't in a confirmed spec.

## The learning arc

SDD embeds a complete learning cycle into the development workflow. You don't study first and build later — you learn *by building*, with scaffolding that adapts to your level and fades as you improve.

**1. Coached specification** — During `/sdd:specify`, Claude monitors your input for common weaknesses: vague requirements, missing edge cases, untestable criteria, hardcoded values that should be configurable. Instead of silently fixing your input, it offers a concrete alternative using your actual data. If you say "the system must be fast," Claude won't lecture you about non-functional requirements — it will say: "With your current volume of 500 leads per week, a P95 response time of 500ms would keep the team flowing. Want me to set that as the threshold?" The coaching fades as you improve. No levels, no badges — the scaffolding simply becomes unnecessary.

**2. Guided practice** — During `/sdd:implement --pair`, Claude generates the file structure, imports, and boilerplate, but leaves `// YOUR TURN:` markers where the business logic goes. You write the parts that matter most. The difficulty adapts: simpler hints on your first features, more open-ended challenges as your profile grows. This is where specification knowledge becomes implementation skill.

**3. Reflection** — After completing a feature, `/sdd:retro` presents a short summary of how your coaching profile changed during the feature and asks exactly 2 reflective questions. It's a 2-minute debrief, not an exam. The goal is to consolidate what you learned so it sticks.

**4. Annotated examples** — `docs/examples/` contains two reference specs (a simple webhook and a complex scoring engine) with inline learning notes explaining *why* each section is written the way it is. These serve as self-study material and a target to aim for.

This approach means that people with strong business context and product taste — but limited technical vocabulary — can produce implementation-ready specs from day one, while building technical literacy organically. And experienced developers get a structured workflow without condescending tutorials.

## Install

### From GitHub

```bash
# 1. Add the repo as a marketplace
/plugin marketplace add rubenzarroca/sdd-plugin

# 2. Install the plugin (choose scope: user, project, or local)
/plugin install sdd@rubenzarroca-sdd-plugin
```

Or use the interactive UI: run `/plugin`, go to **Discover**, and select **sdd**.

### Local development

```bash
claude --plugin-dir /path/to/sdd-plugin
```

After installing, open any project and run `/sdd:init` to set up the SDD structure.

## Quick start

```
/sdd:init my-project          → Analyzes your project, generates CLAUDE.md + constitution
/sdd:prd                       → (Optional) Guided interview to create a Product Requirements Document
/sdd:specify auth "OAuth2"     → Creates the spec with coaching — teaches you to write better requirements
/sdd:clarify auth              → Finds gaps and ambiguities in the spec
/sdd:plan auth                 → Generates technical plan + ADR
/sdd:tasks auth                → Decomposes plan into atomic tasks (5-15 min each)
/sdd:implement TASK-001        → Implements ONE task, validates, stops
/sdd:implement TASK-002 --pair → Pair mode: Claude scaffolds, you write the business logic
/sdd:validate auth             → Drift detection: spec vs code, constitution compliance
/sdd:retro auth                → (Optional) Reflect on what you learned during this feature
```

Every step requires your explicit approval before moving to the next. Claude never auto-advances.

## The workflow

### 0. PRD (`/sdd:prd`)

Optional but recommended as the first step after init. Generates a Product Requirements Document through a guided interview. Defines the product vision, target users, modules, scope boundaries, and success criteria. The PRD feeds context to all downstream `/sdd:specify` commands.

Saved to `specs/prd.md`.

### 1. Initialize (`/sdd:init`)

Run once per project. Detects your stack, generates a CLAUDE.md (< 60 lines, progressive disclosure) and walks you through creating a constitution.md with your project's non-negotiable principles. Also creates the state machine (`.sdd/state.json`) and folder structure (`specs/`, `docs/adr/`).

If CLAUDE.md or other files already exist, init asks before touching them. It never overwrites without confirmation.

### 2. Specify (`/sdd:specify`)

Defines what a feature should do using an 11-section methodology. Claude checks for a PRD (to inherit product context), reads your constitution, conducts a focused discovery interview, and generates a comprehensive spec: metadata, context, goals & non-goals, user stories, functional requirements (FR-001...), non-functional requirements (NFR-001...), technical design, data models, API contracts, edge cases (EC-001...), and open questions.

This is where the coaching layer lives. Based on constructivist pedagogy, Claude doesn't just accept your input — it monitors for vague language, missing quantifiers, untestable criteria, and implicit assumptions. When it detects a weakness, it offers a rewritten version using your actual project data, so you see exactly what a stronger requirement looks like. The coaching adapts: frequent interventions early on, progressively fewer as your specs improve.

Saved to `specs/[feature]/spec.md`.

### 3. Clarify (`/sdd:clarify`)

Optional but recommended. Analyzes the spec for three types of gaps: ambiguities (terms with multiple interpretations), unvalidated assumptions (implicit decisions you haven't confirmed), and edge cases (what happens when something fails, is empty, or exceeds a limit). Questions come one at a time, not in a batch.

### 4. Plan (`/sdd:plan`)

Generates the technical plan: architecture, dependencies, files affected, risks and trade-offs. If there are architectural alternatives, presents 2-3 options with pros/cons. When you choose, an Architecture Decision Record is automatically generated in `docs/adr/`.

### 5. Tasks (`/sdd:tasks`)

Decomposes the plan into atomic tasks. Each task has an ID, title, description, files affected, dependencies on other tasks, and a concrete validation criterion. Tasks are designed to be implementable in 5-15 minutes and testable in isolation.

### 6. Implement (`/sdd:implement`)

Executes one task at a time. Claude reads only the specific task and its listed files (minimal context budget). If it discovers something needed that isn't covered by the task, it reports a blocker instead of implementing it. If validation fails, it retries up to 3 times before asking for help. Never advances to the next task automatically.

**Pair-programming mode (`--pair`):** Add the `--pair` flag to any implement command (e.g., `/sdd:implement TASK-003 --pair`). Claude generates the file structure, imports, and boilerplate, but leaves `// YOUR TURN:` markers in the business logic sections for you to complete. The difficulty of markers adapts to your experience — simpler hints on your first features, more open-ended on later ones. Maximum 3 markers per file, zero on config or boilerplate files. Without the flag, implementation works exactly as before.

This is the bridge between knowing what to build (the spec) and knowing how to build it (the code). Over multiple features, the pair mode trains your pattern recognition for translating requirements into implementations.

### 7. Validate (`/sdd:validate`)

Drift detection. Compares the spec against the implementation and checks constitution compliance. Reports three things: which requirements are covered, which are missing, and which code doesn't correspond to any requirement (orphan code). For constitution, verifies imports against the allowed list, checks for prohibited patterns, and validates testing standards.

### 8. Retro (`/sdd:retro`)

The final step in the learning cycle. Run it manually after completing a feature — it's never suggested automatically and never blocks anything. Reads the coaching profile and transition history from state.json, presents a 3-5 line summary of what changed in your profile during the feature, and asks exactly 2 reflective questions. Saves the result to `specs/{feature}/retro.md`.

The retro closes the feedback loop: you specified, you built, now you consolidate. Over time, the retro files become a journal of your growth as a spec writer and system thinker.

## Supporting commands

### `/sdd:constitution`

Creates or edits the project's non-negotiable principles. Organized by category: architecture, testing, security, allowed dependencies, and code standards. Principles are expressed as verifiable rules wherever possible (e.g., "Allowed imports: react, lodash, date-fns" instead of "use few libraries").

The constitution wins over CLAUDE.md in conflicts. It's the highest authority in the project.

### `/sdd:status`

Session recovery. Shows the active feature, current state, task progress, last completed task, session notes, and any pending alerts. Designed to be the first thing you run when opening a new session. Reads only `state.json` — the lightest command in the plugin.

## State machine

Every feature moves through a strict lifecycle:

```
[prd] → drafting → specified → clarified → planned → tasked → implementing → validating → completed
```

The PRD phase is optional — projects without a PRD start directly at `drafting`.

Transitions are enforced. You can't implement without a confirmed plan. You can't validate without completing all tasks. If you need to go back:

- `implementing → tasked` (re-plan tasks without losing spec or plan)
- Any state `→ drafting` (full reset, start the spec from scratch)

## For existing projects

SDD is designed for incremental adoption:

1. **Run `/sdd:init`** on your existing project. It analyzes what's there and adapts. No retroactive spec writing needed.
2. **Use SDD for new features only.** Existing code stays outside of SDD scope.
3. **Optionally**, use `/sdd:validate` on legacy code by creating a retroactive spec that documents what the code *should* do, then checking for divergences.

## Project structure

After init, your project will have:

```
your-project/
├── CLAUDE.md                 ← Entry point for Claude (< 60 lines)
├── constitution.md           ← Non-negotiable principles (verifiable rules)
├── .sdd/
│   ├── state.json            ← Workflow state machine + coaching profile
│   └── hooks.json            ← Hook config (disabled by default)
├── specs/
│   ├── prd.md                ← Product Requirements Document (optional)
│   └── [feature-name]/
│       ├── spec.md           ← Feature specification
│       ├── plan.md           ← Technical plan
│       ├── tasks.md          ← Task decomposition
│       └── retro.md          ← What you learned (optional)
└── docs/
    ├── adr/
    │   └── 001-[title].md    ← Architecture Decision Records
    └── examples/
        ├── spec-simple.md    ← Annotated example: simple webhook spec
        └── spec-complex.md   ← Annotated example: scoring engine spec
```

Everything is plain text (markdown + JSON), git-friendly, and produces readable diffs.

## Hooks (optional)

SDD generates three hooks, all disabled by default:

- **SessionStart**: auto-runs `/sdd:status` when you open Claude Code
- **PreCompact**: saves session notes before Claude compacts context
- **PostImplement**: runs validation after all tasks are completed

Enable them in `.sdd/hooks.json` when you're ready.

## Design principles

**Spec is source of truth.** Code is derived, disposable, regenerable. If code doesn't map to a spec, it's drift.

**Governance is programmatic, not conversational.** The constitution isn't a suggestion Claude reads — it's a contract that `/sdd:validate` can verify. Inspired by the agent boundaries pattern from Programmatic Tool Calling.

**Learning is embedded, not bolted on.** The coaching layer, pair mode, and retro aren't optional add-ons — they're integrated into the workflow commands you already use. You learn by doing the work, not by taking a detour.

**The scaffolding fades.** Coaching interventions decrease as your specs improve. Pair-mode markers become more open-ended. The system adapts to your level instead of treating every user the same.

**Human-in-the-loop, always.** No command auto-advances to the next step. Every transition requires explicit user confirmation.

**Context budget by design.** Each command loads only what it needs. `/sdd:status` reads only state.json. `/sdd:implement` reads only the task and its files. No command loads spec + plan + tasks + constitution simultaneously.

## Plugin structure

```
sdd-plugin/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   ├── sdd-init/
│   │   └── SKILL.md
│   ├── sdd-prd/
│   │   └── SKILL.md
│   ├── sdd-specify/
│   │   └── SKILL.md
│   ├── sdd-clarify/
│   │   └── SKILL.md
│   ├── sdd-plan/
│   │   └── SKILL.md
│   ├── sdd-tasks/
│   │   └── SKILL.md
│   ├── sdd-implement/
│   │   └── SKILL.md
│   ├── sdd-validate/
│   │   └── SKILL.md
│   ├── sdd-retro/
│   │   └── SKILL.md
│   ├── sdd-constitution/
│   │   └── SKILL.md
│   └── sdd-status/
│       └── SKILL.md
├── docs/
│   └── examples/
│       ├── spec-simple.md
│       └── spec-complex.md
└── README.md
```

## Version

0.4.0 — Interactive decisions via AskUserQuestionTool in plan, clarify, constitution, and specify.

## Author

Built by Rubén Zarroca. Designed for teams that want AI-assisted development without the chaos — and without losing the ability to think for themselves.

## License

MIT
