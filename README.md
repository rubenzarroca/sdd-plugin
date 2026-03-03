# SDD — Spec Driven Development Plugin for Claude Code

Stop vibe coding. Start building with specs.

SDD is a Claude Code plugin that implements a complete Specification-Driven Development workflow. Every feature goes through a structured lifecycle — specify, clarify, plan, tasks, implement, validate — with human approval at every step.

The philosophy is simple: **the spec is the source of truth, the code is a derived artifact**. If code can't be traced back to a requirement, it's drift. If Claude makes an architectural decision you didn't approve, the system catches it.

## Why SDD exists

LLMs generate code by probabilistic token prediction, not by intentional reasoning. Without specifications constraining the decision space, AI-assisted development becomes a multiplier of both speed and technical debt simultaneously.

SDD constrains Claude's behavior through three mechanisms: specs that define what to build, a constitution that defines how to build it, and a state machine that enforces the workflow order. Claude can't skip steps, can't auto-advance, and can't implement anything that isn't in a confirmed spec.

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
/sdd:specify auth "OAuth2"     → Creates the spec, asks clarification questions
/sdd:clarify auth              → Finds gaps and ambiguities in the spec
/sdd:plan auth                 → Generates technical plan + ADR
/sdd:tasks auth                → Decomposes plan into atomic tasks (5-15 min each)
/sdd:implement TASK-001        → Implements ONE task, validates, stops
/sdd:validate auth             → Drift detection: spec vs code, constitution compliance
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

Includes an integrated coaching layer that teaches spec-writing best practices in context (see "Built-in coaching" below).

Saved to `specs/[feature]/spec.md`.

### 3. Clarify (`/sdd:clarify`)

Optional but recommended. Analyzes the spec for three types of gaps: ambiguities (terms with multiple interpretations), unvalidated assumptions (implicit decisions you haven't confirmed), and edge cases (what happens when something fails, is empty, or exceeds a limit). Questions come one at a time, not in a batch.

### 4. Plan (`/sdd:plan`)

Generates the technical plan: architecture, dependencies, files affected, risks and trade-offs. If there are architectural alternatives, presents 2-3 options with pros/cons. When you choose, an Architecture Decision Record is automatically generated in `docs/adr/`.

### 5. Tasks (`/sdd:tasks`)

Decomposes the plan into atomic tasks. Each task has an ID, title, description, files affected, dependencies on other tasks, and a concrete validation criterion. Tasks are designed to be implementable in 5-15 minutes and testable in isolation.

### 6. Implement (`/sdd:implement`)

Executes one task at a time. Claude reads only the specific task and its listed files (minimal context budget). If it discovers something needed that isn't covered by the task, it reports a blocker instead of implementing it. If validation fails, it retries up to 3 times before asking for help. Never advances to the next task automatically.

### 7. Validate (`/sdd:validate`)

Drift detection. Compares the spec against the implementation and checks constitution compliance. Reports three things: which requirements are covered, which are missing, and which code doesn't correspond to any requirement (orphan code). For constitution, verifies imports against the allowed list, checks for prohibited patterns, and validates testing standards.

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
│   ├── state.json            ← Workflow state machine
│   └── hooks.json            ← Hook config (disabled by default)
├── specs/
│   ├── prd.md                ← Product Requirements Document (optional)
│   └── [feature-name]/
│       ├── spec.md           ← Feature specification
│       ├── plan.md           ← Technical plan
│       └── tasks.md          ← Task decomposition
└── docs/
    └── adr/
        └── 001-[title].md    ← Architecture Decision Records
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

**Human-in-the-loop, always.** No command auto-advances to the next step. Every transition requires explicit user confirmation.

**Context budget by design.** Each command loads only what it needs. `/sdd:status` reads only state.json. `/sdd:implement` reads only the task and its files. No command loads spec + plan + tasks + constitution simultaneously.

**The model is a better programmer than orchestrator.** When available, analysis commands (validate, tasks) use Programmatic Tool Calling to write analysis programs instead of reasoning conversationally over large codebases.

## Built-in coaching

SDD doesn't just generate specs — it teaches you to write better ones. The `/sdd:specify` command includes an integrated coaching layer based on constructivist pedagogy.

When you describe a feature, Claude monitors your input for common weaknesses: vague requirements, missing edge cases, untestable criteria, hardcoded values that should be configurable. Instead of silently accepting or rejecting your input, it offers a concrete, better alternative using your actual data.

For example, if you say "the system must be fast," Claude won't lecture you about non-functional requirements. It will say: "With your current volume of 500 leads per week, a P95 response time of 500ms would keep the team flowing. Want me to set that as the threshold?"

The coaching fades as you improve. Once you start writing quantified requirements on your own, Claude stops intervening. There's no level system, no badges — the scaffolding simply becomes unnecessary.

This approach means that people with strong business context and product taste — but limited technical vocabulary — can produce implementation-ready specs from day one, while building technical literacy organically.

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
│   ├── sdd-constitution/
│   │   └── SKILL.md
│   └── sdd-status/
│       └── SKILL.md
└── README.md
```

## Version

0.2.0 — PRD skill, 11-section specify methodology with integrated coaching, requirement ID traceability.

## Author

Built by Rubén Zarroca. Designed for teams that want AI-assisted development without the chaos.

## License

MIT
