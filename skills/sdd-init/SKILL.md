---
name: sdd-init
description: "Initialize SDD (Specification-Driven Development) workflow in a project. Use when setting up SDD for the first time, when the user says 'start SDD', 'init project', 'initialize specs', or asks to add specification-driven development to an existing codebase. Generates CLAUDE.md, constitution.md, state.json, and project structure."
argument-hint: "[project-name]"
user-invokable: true
---

# /sdd:init — Initialize SDD workflow for this project

You are setting up Specification-Driven Development for a project. Follow these steps exactly, in order. Do NOT skip steps. Do NOT read source code — only directory listing and package manifest.

## Step 1: Detect project stack

Run `ls` on the project root. Look for:
- `package.json` → Node/TypeScript/JavaScript (read it for framework, deps, scripts)
- `requirements.txt` / `pyproject.toml` / `setup.py` → Python
- `Cargo.toml` → Rust
- `go.mod` → Go
- `pom.xml` / `build.gradle` → Java/Kotlin
- `Gemfile` → Ruby

Read the manifest file to extract: project name, language, framework, key dependencies, test command, build command.

## Step 2: Check for existing files

Check if any of these already exist: `CLAUDE.md`, `constitution.md`, `.sdd/`, `specs/`.

If any exist, list them and ask the user: "These SDD-related files already exist: [list]. Should I overwrite them, merge with them, or abort?" Wait for answer before continuing.

## Step 3: Create folder structure

Create these directories if they don't exist:
- `specs/`
- `docs/` (if not existing)
- `docs/adr/` (if not existing)
- `.sdd/`

## Step 4: Generate CLAUDE.md

Generate `CLAUDE.md` in the project root. Must be **under 60 lines** and **under 2,500 tokens**. Use this structure, filling in detected values:

```markdown
# {Project Name}

{One-line description of what the project does, inferred from manifest and directory structure.}

## Tech Stack

| Layer | Technology |
|-------|-----------|
{Table rows for each detected technology: language, framework, DB, testing, deployment, etc.}

## SDD Workflow

This project uses Specification-Driven Development. All features follow this lifecycle:

0. `/sdd:prd` — (Optional) Generate a Product Requirements Document
1. `/sdd:specify` — Write a spec from a feature description
2. `/sdd:clarify` — Identify and resolve gaps in the spec
3. `/sdd:plan` — Design the technical approach + generate ADR
4. `/sdd:tasks` — Decompose plan into atomic, testable tasks
5. `/sdd:implement TASK-NNN` — Implement one task at a time
6. `/sdd:validate` — Verify implementation matches spec

State is tracked in `.sdd/state.json`. Run `/sdd:status` for a quick overview.

For project principles and non-negotiables, see `constitution.md`. **In case of conflict between this file and constitution.md, constitution.md takes precedence.**

## Key Commands

- `/sdd:status` — Show current feature state and progress
- `/sdd:constitution` — View or edit project principles
- `/sdd:init` — Re-initialize (use with caution)

## Rules

1. Never implement without a spec. If there's no spec, run `/sdd:specify` first.
2. Never skip clarification. Ambiguity in specs becomes bugs in code.
3. One task at a time. Do not batch-implement multiple tasks.
4. Report blockers, don't work around them. If a task needs something not in its scope, stop and report.
```

Adapt the description and tech stack to what you detected. Do NOT add sections beyond what's shown.

## Step 5: Generate constitution.md

This is interactive. Guide the user through questions by category. For each category, ask 1-2 focused questions and convert answers into **verifiable principles** (not vague guidelines).

**Architecture:**
- "What architectural pattern does this project follow? (e.g., monolith, microservices, modular monolith, serverless)"
- "Are there folder structure rules? (e.g., features in src/features/, tests next to source)"

**Testing:**
- "What's your testing approach? (e.g., unit + integration, E2E only, no tests yet)"
- "Any minimum coverage target? Test framework preference?"

**Security:**
- "How is authentication handled? Any security patterns required?"
- "Input validation approach? (e.g., zod schemas, manual, framework-provided)"

**Dependencies:**
- List the currently installed dependencies from the manifest.
- "Are all of these approved? Any that should be removed? What's the process for adding new ones?"

**Code Standards:**
- "Naming conventions? (e.g., camelCase functions, PascalCase components, snake_case files)"
- "Any formatting/linting tools already configured?"

After each answer, write the principle in verifiable form. Examples:
- GOOD: "All React components use PascalCase. Files use kebab-case."
- BAD: "Follow good naming practices."
- GOOD: "Allowed test frameworks: vitest, @testing-library/react. No jest."
- BAD: "Use appropriate testing tools."

Generate `constitution.md` with this structure:

```markdown
# Constitution

Project principles and non-negotiables. This document takes precedence over CLAUDE.md in case of conflict.

## Architecture
{Verifiable principles from user answers}

## Testing
{Verifiable principles from user answers}

## Security
{Verifiable principles from user answers}

## Allowed Dependencies
{List of approved dependencies + process for adding new ones}

## Code Standards
{Verifiable principles from user answers}

## Process
- All features go through the SDD lifecycle (specify → clarify → plan → tasks → implement → validate).
- No implementation without a reviewed spec.
- No scope creep during implementation — report blockers instead.
```

## Step 6: Create .sdd/state.json

Create `.sdd/state.json` with this exact schema (fill project name and timestamp):

```json
{
  "version": "1.0.0",
  "project": "{detected project name}",
  "initialized_at": "{ISO 8601 timestamp}",
  "active_feature": null,
  "last_session_notes": null,
  "last_session_end": null,
  "prd": {
    "status": "none",
    "path": "specs/prd.md"
  },
  "features": {},
  "allowed_transitions": {
    "drafting": ["specified"],
    "specified": ["clarified", "drafting"],
    "clarified": ["planned", "drafting"],
    "planned": ["tasked", "drafting"],
    "tasked": ["implementing", "drafting"],
    "implementing": ["validating", "tasked", "drafting"],
    "validating": ["completed", "implementing", "drafting"],
    "completed": ["drafting"]
  }
}
```

## Step 7: Create .sdd/hooks.json

Create `.sdd/hooks.json`:

```json
{
  "SessionStart": {
    "enabled": false,
    "action": "sdd-status",
    "description": "Show SDD status at the beginning of each session"
  },
  "PreCompact": {
    "enabled": false,
    "action": "save-state",
    "description": "Save session notes to state.json before context compaction"
  },
  "PostImplement": {
    "enabled": false,
    "action": "sdd-validate",
    "description": "Run validation automatically after all tasks are completed"
  }
}
```

## Step 8: Evaluate AGENTS.md

Look at the project directory structure. If the project has **multiple clear entry points** (e.g., frontend + backend, multiple services, CLI + library) or **clear module boundaries**, suggest:

"This project appears to have [describe boundaries]. Would you like me to create an AGENTS.md file to define specialized agents for different areas?"

If the user declines or the project is a single-module project, skip this step.

## Step 9: Present summary

Show everything that was created:

```
SDD initialized for {project name}

Created:
  CLAUDE.md          — Project overview + SDD workflow reference
  constitution.md    — Project principles (architecture, testing, security, deps, standards)
  .sdd/state.json    — Feature state tracking
  .sdd/hooks.json    — Hook configuration (all disabled)
  specs/             — Feature specifications directory
  docs/adr/          — Architecture Decision Records directory

Next steps:
  - If this is a new product, start with /sdd:prd to define the product vision and scope
  - If you already have a clear product definition, go directly to /sdd:specify {feature description}
```

## Restrictions

- Do NOT auto-advance to `/sdd:prd` or `/sdd:specify` after init. Present the summary and stop.
- Do NOT read source code files. Only read directory listing and package manifest.
- Do NOT make assumptions about project architecture beyond what the manifest and directory structure reveal.
- If the user's answers to constitution questions are vague, ask for clarification. Do not generate vague principles.

$ARGUMENTS
