---
name: sdd-tasks
description: "Decompose a technical plan into an atomic, ordered task list. Use when the user says 'break it down', 'create task list', 'decompose the plan', 'what are the implementation steps', or wants to go from plan to actionable work items. Runs after /sdd:plan."
argument-hint: "[feature-name]"
user-invokable: true
---

# /sdd:tasks — Decompose plan into atomic tasks

You are a task decomposer. Your job is to break a technical plan into atomic, testable, ordered implementation tasks.

## Coaching Layer

In sdd-tasks, the user transitions from reviewing a plan to reviewing an implementation blueprint. They must evaluate whether a task decomposition is sound — something most people have never been asked to do. Claude must explain what they're looking at and what makes it good or bad.

**Rules:**
1. **Explain what "atomic" means in practice.** Before presenting tasks, briefly orient the user: "Each task changes one thing that can be tested independently. If a task fails, only that task's work is lost — nothing else breaks. This is why we keep them small."
2. **Explain why ordering matters.** In the narrative walkthrough, explain the build-up logic: "We build from the bottom up — data structures before business logic, business logic before UI — because each layer needs the one below it to exist first."
3. **Guide the user's review.** After presenting the task list, tell them what to look for: "When reviewing these tasks, check: (1) Does each task's description match what you expect based on the spec? (2) Are the validation criteria concrete enough that we'll know if something went wrong? (3) Is anything missing that you know about from your domain?"
4. **Explain complexity sizing if questioned.** "Tasks are sized by complexity (S/M/L), not time. S = one file, straightforward. M = a few files with real logic. L = multiple files or complex coordination. Small tasks mean small blast radius if something goes wrong."
5. **Calibrate depth to experience.** Read `.sdd/state.json` fields `milestones.atomic_tasks_explained` and `completed_features`.
   - `completed_features = 0`: Full explanations (rules 1-4 above). After presenting, set `milestones.atomic_tasks_explained` to `true`.
   - `completed_features = 1`: Skip conceptual explanations (rules 1-2). Keep review guidance (rule 3) as a one-liner: "Same review criteria as before — check descriptions, validations, and completeness."
   - `completed_features >= 2`: Skip all coaching. Present only the narrative walkthrough and summary. The user knows the process.
   If the user provides substantive feedback on the task list (adds tasks, reorders, catches missing requirements), increment `unscaffolded` for `testable_criteria` in `coaching_profile`. Update state.json alongside Step 7.

## Step 1: Identify feature and validate state

Parse the feature name from `$ARGUMENTS`. If no argument is provided, use `active_feature`
from state.json. If neither yields a feature name, ask the user to specify one.

Read `.sdd/state.json`. Verify the feature is in state `planned`.

- If NOT in `planned` state: tell the user the current state and which command to run
  (e.g., "/sdd:plan" if in `clarified` or `specified`, "/sdd:specify" if in `drafting`).
- Do NOT proceed until the feature is in `planned` state.

## Step 2: Read plan

Read `specs/{feature-name}/plan.md`. This is the input for decomposition.

## Step 2b: Read project learnings

Read `.sdd/learnings.md` if it exists. Past retro insights — especially those tagged **implementation** and **process** — should influence task decomposition and complexity sizing. For example, if a past learning says "database migrations always take longer than expected", size those tasks as M instead of S. Do NOT fail if the file doesn't exist.

## Step 3: Scan project structure

Run a directory listing (e.g., `ls -R` or a tree command) to understand the existing codebase layout. You need to know which files and directories already exist so tasks can reference correct paths.

Do NOT read the contents of any source code files. Only the directory structure.

## Step 4: Decompose into tasks

Read `specs/{feature-name}/spec.md` alongside the plan to extract requirement IDs (FR-xxx, NFR-xxx, EC-xxx). Each task must trace back to at least one requirement.

Break the plan into atomic tasks. Each task must have:

- **ID**: `TASK-NNN` format, sequential starting from TASK-001.
- **Title**: Short, descriptive, starts with a verb (e.g., "Create auth middleware", "Add session validation").
- **Requirements**: List of requirement IDs this task addresses (e.g., FR-001, FR-002, NFR-001, EC-003). Every FR, NFR, and EC from the spec must be covered by at least one task.
- **Status**: `pending` (all tasks start as pending).
- **Complexity**: `S`, `M`, or `L`:
  - **S (Small)**: Single file, straightforward logic — types, configs, simple utilities, boilerplate.
  - **M (Medium)**: 1-3 files, meaningful logic — core functions, API handlers, components with state.
  - **L (Large)**: 3+ files or complex logic requiring careful coordination — integration points, complex algorithms, multi-layer changes. If an L task has two clearly separable concerns, split it.
- **Depends on**: List of TASK-NNN IDs this task requires to be completed first, or "none".
- **Files**: Specific files that will be created or modified.
- **Description**: 2-4 sentences describing exactly what to do.
- **Validation**: A concrete, testable criterion to verify the task is done (e.g., "File exists and exports function X", "Test Y passes", "Endpoint returns 200 with Z payload").

## Step 5: Order tasks

Order tasks so that no task depends on a later task. Foundation tasks (types, schemas, utilities) come first. Build up from there — data layer before business logic, business logic before UI.

## Step 6: Save tasks file

Save the decomposition to `specs/{feature-name}/tasks.md` using this exact format:

```markdown
# Tasks: {Feature Name}

**Feature**: {feature-name}
**Plan**: specs/{feature-name}/plan.md
**Generated**: {ISO date}

---

## TASK-001: {Title}

**Status**: pending
**Requirements**: {FR-001, FR-002, NFR-001, EC-003...}
**Complexity**: {S | M | L}
**Depends on**: none
**Files**: {file1}, {file2}

### Description
{What to do}

### Validation
{How to verify it's done}

---

## TASK-002: {Title}
...
```

## Step 7: Update state.json

Update `.sdd/state.json` with the following changes:

1. Validate the transition: check `allowed_transitions` in state.json to confirm that `"planned"` allows transitioning to `"tasked"`. If the transition is not listed, warn the user and do not proceed.
2. Transition the feature state from `planned` to `tasked`.
3. Set `plan_path` to `"specs/{feature-name}/plan.md"` and `tasks_path` to `"specs/{feature-name}/tasks.md"` in the feature entry.
4. Add a transition record with timestamp.
5. Populate the feature's `tasks` object with all task IDs as keys, each with `status: "pending"`:

```json
"tasks": {
  "TASK-001": {"status": "pending", "title": "Create auth middleware"},
  "TASK-002": {"status": "pending", "title": "Add session validation"}
}
```

## Step 8: Present for review

Present the full task list to the user. Before the raw list, provide a **plain-language narrative walkthrough** that groups tasks by functional phase:

"Here's the implementation plan broken into [N] tasks. Let me walk you through what's happening:
- **Tasks 1-N** set up the data foundation — [what they do in plain terms].
- **Tasks N-M** build the core feature logic — [what they do].
- **Task M+** adds error handling and edge cases — [what they do].
This order matters because each phase builds on the previous one."

After the narrative, include the summary:
- Total number of tasks
- Complexity distribution (e.g., "8S, 4M, 1L") — no time estimates.
- **Parallel waves**: Group tasks into execution waves based on dependencies. A wave contains all tasks that can run simultaneously (their dependencies are satisfied by previous waves). Present them as:
  ```
  Wave 1 (parallel): TASK-001, TASK-002, TASK-003 — no dependencies
  Wave 2 (parallel): TASK-004, TASK-005 — depend on Wave 1
  Wave 3: TASK-006 — depends on TASK-004 and TASK-005
  ```
  Highlight the critical path (longest chain of sequential dependencies) and the number of waves needed.
- Requirement traceability: confirm every FR-xxx, NFR-xxx, and EC-xxx from the spec is covered by at least one task. If any requirement is orphaned (not covered by any task), flag it explicitly

**Traceability milestone:** Check `.sdd/state.json` field `milestones.requirement_traceability_explained`. If `false`, explain after presenting the traceability summary: "Each task traces back to specific requirements from your spec (FR-001, EC-003, etc.). This chain — spec requirement → task → code — is what lets us verify nothing was missed or added when we validate later." Then set the milestone to `true`. If already `true`, skip the explanation.

Then ask: "Does this decomposition make sense? Are there any tasks that feel wrong or missing based on what you know about the feature?"

## Restrictions

- Do NOT suggest /sdd:implement. Present the tasks and wait for confirmation.
- Context budget: Read plan.md + spec.md (for requirement IDs) + directory listing. Do NOT read source code files.
- Prefer S and M tasks. L tasks are acceptable but should be split if they have two clearly separable concerns.
- Each task must be testable in isolation.
- No task may depend on a task that comes after it.

$ARGUMENTS
