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

**4. Annotated examples** — `docs/examples/` contains two reference specs (a simple webhook and a complex scoring engine with external API integration) with inline learning notes explaining *why* each section is written the way it is. The complex example includes a Clearbit API dependency to demonstrate the full external API workflow: cached docs, rate limiting, and graceful degradation. These serve as self-study material and a target to aim for.

This approach means that people with strong business context and product taste — but limited technical vocabulary — can produce implementation-ready specs from day one, while building technical literacy organically. And experienced developers get a structured workflow without condescending tutorials.

## Install

### From GitHub

```bash
# 1. Add the repo as a marketplace
/plugin marketplace add rubenzarroca/sdd-plugin

# 2. Install the plugin (choose scope: user, project, or local)
/plugin install sdd@sdd-plugin
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
/sdd:tasks auth                → Decomposes plan into atomic tasks (S/M/L complexity)
/sdd:implement                 → Implements tasks (auto-batches small ones), validates, stops
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

**External API check:** Before generating the plan, `/sdd:plan` scans the spec for references to external services. If it detects integrations without cached API documentation, it blocks the plan and directs you to run `/sdd:api-docs` first. This prevents Claude from building plans against assumed API behavior from its training data. The check is controlled by the `PrePlan` hook (enabled by default).

### 5. Tasks (`/sdd:tasks`)

Decomposes the plan into atomic tasks. Each task has an ID, title, description, files affected, dependencies on other tasks, complexity rating (S/M/L), and a concrete validation criterion. Tasks are grouped into parallel waves — independent tasks can be executed simultaneously.

### 6. Implement (`/sdd:implement`)

Executes tasks with minimal context budget — reads only the task blocks and their listed files. When a task involves external API calls, `/sdd:implement` uses `sdd_api_lookup` to load only the specific endpoint contract needed (not the full API docs), keeping context tight while ensuring the implementation uses verified API shapes. Auto-batches S-complexity tasks into a single pass. Supports explicit multi-task invocation (`/sdd:implement TASK-001 TASK-003`). If it discovers something needed that isn't covered by the task, it reports a blocker instead of implementing it. If validation fails, it retries up to 3 times before asking for help. After completing, suggests available parallel tasks.

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

### `/sdd:api-docs`

Fetches and caches external API documentation before you plan or implement integrations. Takes a service name and optionally a docs URL. Uses `WebFetch`/`WebSearch` to read the real documentation and saves a structured JSON cache to `.sdd/api-docs/{service}.json` (gitignored). The cache is queried surgically during implementation via MCP tools — only the specific endpoint a task needs enters the context window, not the entire API.

This solves a fundamental problem: Claude's training data may contain outdated or incorrect API documentation. By forcing a documentation-first approach, the code you ship matches the real API contract.

```
/sdd:api-docs stripe https://docs.stripe.com/api    → Fetches, parses, caches
/sdd:api-docs bigquery                                → WebSearch finds docs, then caches
```

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
├── CLAUDE.md                        ← Entry point for Claude (< 60 lines)
├── constitution.md                  ← Non-negotiable principles (verifiable rules)
├── .sdd/
│   ├── state.json                   ← Workflow state machine + coaching profile
│   ├── hooks.json                   ← Hook config (PrePlan enabled by default)
│   └── api-docs/                    ← Cached external API documentation (gitignored)
│       └── {service}.json           ← e.g., clearbit.json, stripe.json
├── specs/
│   ├── prd.md                       ← Product Requirements Document (optional)
│   └── [feature-name]/
│       ├── spec.md                  ← Feature specification
│       ├── spec.json                ← Structured version (for MCP tools)
│       ├── plan.md                  ← Technical plan
│       ├── tasks.md                 ← Task decomposition
│       ├── tasks.json               ← Structured version (for MCP tools)
│       └── retro.md                 ← What you learned (optional)
└── docs/
    ├── adr/
    │   └── 001-[title].md           ← Architecture Decision Records
    └── examples/
        ├── spec-simple.md           ← Annotated example: webhook spec
        ├── spec-simple.json         ← Structured version (reference)
        ├── spec-complex.md          ← Annotated example: scoring engine + external API
        ├── spec-complex.json        ← Structured version (reference)
        ├── tasks-simple.json        ← Task decomposition example
        ├── tasks-complex.json       ← Task decomposition with API integration task
        └── api-docs-clearbit.json   ← Example of cached API docs from /sdd:api-docs
```

Everything is plain text (markdown + JSON), git-friendly, and produces readable diffs.

## Hooks

SDD generates four hooks in `.sdd/hooks.json`:

- **SessionStart** (disabled): auto-runs `/sdd:status` when you open Claude Code
- **PrePlan** (enabled): blocks `/sdd:plan` if external services are detected without cached API documentation — prevents building against assumed API behavior
- **PreCompact** (disabled): saves session notes before Claude compacts context
- **PostImplement** (disabled): runs validation after all tasks are completed

Toggle them in `.sdd/hooks.json`.

## Design principles

**Spec is source of truth.** Code is derived, disposable, regenerable. If code doesn't map to a spec, it's drift.

**Governance is programmatic, not conversational.** The constitution isn't a suggestion Claude reads — it's a contract that `/sdd:validate` can verify. Inspired by the agent boundaries pattern from Programmatic Tool Calling.

**Learning is embedded, not bolted on.** The coaching layer, pair mode, and retro aren't optional add-ons — they're integrated into the workflow commands you already use. You learn by doing the work, not by taking a detour.

**The scaffolding fades.** Coaching interventions decrease as your specs improve. Pair-mode markers become more open-ended. The system adapts to your level instead of treating every user the same.

**Human-in-the-loop, always.** No command auto-advances to the next step. Every transition requires explicit user confirmation.

**Context budget by design.** Each command loads only what it needs. `/sdd:status` reads only state.json. `/sdd:implement` reads only the task and its files. No command loads spec + plan + tasks + constitution simultaneously.

## MCP server

The plugin includes an MCP server that provides deterministic state machine enforcement. Instead of skills interpreting state transitions from prose, the server validates them in code — no probabilistic interpretation, no silent state corruption.

### Tools

| Tool | Type | Description |
|------|------|-------------|
| `sdd_get_state` | read | Get project or feature state |
| `sdd_transition` | write | Transition a feature to a new state (enforces preconditions) |
| `sdd_validate` | read | Structured coverage report (deterministic + heuristic sections) |
| `sdd_next_action` | read | Available transitions and ready tasks for a feature |
| `sdd_api_list` | read | Lightweight index of cached external API docs |
| `sdd_api_lookup` | read | Surgical lookup: specific endpoint, auth, rate limits, or SDK info |

### Setup

Build the server (requires Node.js 16+):

```bash
cd server
npm install
npm run build
```

Register the server with Claude Code:

```bash
claude mcp add sdd-server -- node /absolute/path/to/sdd-plugin/server/build/index.js /path/to/your/project
```

The second argument is the project root where `.sdd/state.json` and `specs/` live. If omitted, the server uses the current working directory.

### How it works

The server operates on three JSON artifacts:

- **`state.json`** (read/write) — the only mutable file. Feature states, task statuses, transitions.
- **`spec.json`** (read) — structured extract of spec.md. Requirements, data models, API contracts.
- **`tasks.json`** (read) — task definitions, dependencies, coverage index.

Skills continue to handle the human-facing workflow (coaching, interviews, explanations). The MCP server handles the machine-facing enforcement (state transitions, precondition validation, coverage calculation).

### Architecture note

This version uses MCP (Model Context Protocol) deliberately: the tools run inside Claude Code, where the human drives each step and the server enforces the state machine. This architecture prioritizes learning the SDD workflow through hands-on use — every transition is visible, every precondition is explicit, every decision requires human approval.

In a future version, these same tools could be exposed via the Anthropic API and orchestrated through [Programmatic Tool Calling (PTC)](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/programmatic-tool-calling), enabling autonomous execution of the full SDD lifecycle (specify, plan, implement, validate) in a single agentic loop. The `sdd_next_action` tool is already designed to serve as the decision input for such an orchestrator.

## Plugin structure

```
sdd-plugin/
├── .claude-plugin/
│   ├── marketplace.json
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
│   ├── sdd-api-docs/
│   │   └── SKILL.md
│   ├── sdd-retro/
│   │   └── SKILL.md
│   ├── sdd-constitution/
│   │   └── SKILL.md
│   └── sdd-status/
│       └── SKILL.md
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts
│       ├── types.ts
│       ├── state/
│       │   └── manager.ts
│       ├── artifacts/
│       │   └── reader.ts
│       └── tools/
│           ├── get-state.ts
│           ├── transition.ts
│           ├── validate.ts
│           ├── next-action.ts
│           ├── api-list.ts
│           └── api-lookup.ts
├── docs/
│   └── examples/
│       ├── spec-simple.md
│       ├── spec-simple.json
│       ├── spec-complex.md
│       ├── spec-complex.json
│       ├── tasks-simple.json
│       ├── tasks-complex.json
│       └── api-docs-clearbit.json
└── README.md
```

## Author

Built by Rubén Zarroca. Designed for teams that want AI-assisted development without the chaos — and without losing the ability to think for themselves.

## License

MIT
