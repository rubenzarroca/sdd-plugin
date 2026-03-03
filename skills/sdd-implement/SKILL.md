---
name: sdd-implement
description: "Execute one or more tasks from the SDD task list. Use when the user says 'implement task', 'execute task', 'build task', 'do TASK-001', 'next task', 'start implementing', or wants to work on specific tasks. Reads only task blocks and their listed files. Auto-batches small tasks when possible."
argument-hint: "[TASK-NNN...] [--pair]"
user-invokable: true
---

# /sdd:implement — Execute tasks

You are implementing tasks from the SDD task list. This is the most tightly scoped command in the plugin. You read only task blocks and the files listed in them. In single-task mode, execute one task. In batch mode, execute multiple small tasks in a single pass. Follow these steps exactly, in order. Do NOT skip steps. Do NOT read files beyond what is explicitly listed in the tasks.

**MCP Server integration**: This command uses the `sdd-server` MCP tools for state queries and feature transitions. If the MCP server is not available, fall back to reading/writing `.sdd/state.json` directly.

## Coaching Layer

During implementation, the user shifts from active participant to observer. They watch code being written but may not understand what is being created or why. Without coaching, this phase becomes a black box. Claude must make the process transparent.

**Rules:**
1. **Announce before you build.** Before starting implementation, briefly tell the user what you're about to do in plain language: "I'm going to create [file] which handles [function in business terms]. This implements [FR-xxx] from your spec — [what that requirement means in their domain]."
2. **Connect back to the spec.** In the post-task report, always reference which requirements were addressed: "This task implemented FR-003 (authentication on all protected routes) and EC-002 (invalid token handling)." The user should never wonder "why did that just happen?"
3. **Explain blockers in user terms.** If a blocker is found, explain it without jargon: "I found something this task needs that isn't part of its instructions. [Plain description]. We have two options: add it to an existing task, or create a new one. What would you prefer?"
4. **Explain the single-feature lock** if triggered: "Only one feature can be implemented at a time to prevent conflicting changes. Feature `{other}` is currently being built. Complete or pause it before starting this one."
5. **Calibrate explanation depth.** Read `completed_features` from `sdd_get_state`:
   - `0` (first feature): Detailed plain-language explanations of what each file does and why.
   - `1` (second feature): Brief explanations — focus only on what's novel or surprising about this task.
   - `2+`: Minimal — announce what you're building in one line, report results. The user knows the process; don't slow them down with explanations they don't need.
6. **Role-transition coaching.** Check `.sdd/state.json` field `milestones.role_transition_explained`. If `false` and this is the first task for this feature, explain the role shift: "We're starting implementation now. From here, I'll work through each task one at a time and report what I built. Your role shifts to reviewer — check that what I built matches what you described in the spec. If anything looks wrong or confusing, stop me and ask." Then set `milestones.role_transition_explained` to `true`. On subsequent features, skip — the user knows the drill.

## Step 1: Parse task ID and find available tasks

Parse the task ID from `$ARGUMENTS` (e.g., `TASK-003`). Also check if `$ARGUMENTS` contains the `--pair` flag.

If `--pair` is present, enable pair-programming mode (see "Pair-Programming Mode" section below). The flag does not affect Steps 1-4 or Steps 6-8 — it only modifies Step 5.

If no task ID is provided:

1. Call the `sdd_next_action` tool with the active feature name to get available tasks.
2. From the response, look at `next_tasks` — filter for tasks with `status: "pending"` and `ready: true`.
3. If no tasks have `ready: true`, report: "All tasks are either completed or blocked. No pending task is available to implement." Then stop.
4. If there are multiple ready tasks and all are S-complexity, batch them all as the target set. Otherwise, use the first available task (by ID order) as a single target.

If one task ID is provided, use it directly. If multiple task IDs are provided (e.g., `TASK-001 TASK-003`), use them as a batch target set — all must be pending with satisfied dependencies.

**Batch execution**: When the target is a batch of tasks, enter batch mode (see "Batch Mode" section below). Batch mode cannot be combined with `--pair`.

## Step 2: Validate state via MCP

Call `sdd_get_state` with the feature name. Perform these validations:

1. **Feature state**: Verify the feature is in state `tasked` or `implementing`.
   - If in `tasked` (this is the first implementation): you will transition the feature to `implementing` via the MCP server in Step 7.
   - If in `implementing`: proceed normally.
   - If in any other state: report the current state and stop. Do NOT proceed.

2. **Task status**: Verify each target task's status is `pending` (from the `tasks` object in the `sdd_get_state` response).
   - If any task is `completed`: report that it has already been completed and stop.
   - If any task doesn't exist: report that the task ID was not found and stop.

Note: The single-feature lock and precondition checks are enforced by `sdd_transition` when you attempt the state change in Step 7. You do not need to check them manually here.

## Step 3: Read the task block

Read `specs/{feature-name}/tasks.md`. Locate the specific task block by its ID heading (e.g., `## TASK-003`). Extract from that block:

- **Title**: the task title
- **Description**: what to implement
- **Files**: the list of files to read and/or modify
- **Depends on**: task dependencies
- **Requirements**: FR/NFR/EC IDs this task covers
- **Validation**: the concrete check to run after implementation

**Dependency check**: For each dependency listed in the task's "Depends on" field, verify it has status `completed` in the `sdd_get_state` response. If any dependency is not completed, report: "Cannot implement {task-id}. The following dependencies are not yet completed: {list of incomplete dependency IDs with their current status}." Then stop.

In single-task mode, do NOT read beyond the specific task block. In batch mode, read all task blocks in the batch but nothing else. Do NOT read the spec or plan files.

## Step 4: Read task files

Read ONLY the files listed in the task's "Files" field.

- If a file exists, read it.
- If a file doesn't exist yet (because this task creates it), note that it needs to be created and proceed.
- Do NOT read any files not listed in the task's Files field, even if they seem related or useful.

## Step 5: Implement

Implement EXACTLY what the task describes. Nothing more, nothing less.

**Critical scope rule**: If during implementation you discover something needed that is not covered by this task, do NOT implement it. Instead, report it as a blocker:

```
BLOCKER: {Description of what is needed}
This is not covered by {current task ID}.
Potentially covered by: {future task ID, if identifiable, or "no existing task"}
Action needed: {suggest adding a new task or modifying the task list}
```

After reporting a blocker, STOP. Do not continue implementing. Do not attempt a workaround. The user will decide how to proceed.

Other implementation rules:
- Do NOT refactor or improve code beyond what the task specifies.
- Do NOT add comments, documentation, or tests unless the task explicitly calls for them.
- Do NOT modify files not listed in the task's Files field.

## Step 6: Validate

Run the validation defined in the task's Validation field. This could be:

- Running a test command
- Checking that a file exists with specific exports
- Verifying a build succeeds
- Any other concrete check specified in the task

### If validation passes

Proceed to Step 7.

### If validation fails — retry (maximum 3 attempts)

You have up to 3 total attempts (including the first). On each retry:

1. Analyze what went wrong. Explain the failure clearly.
2. Modify the implementation to fix the issue.
3. Re-run the validation.

If validation passes on a retry, proceed to Step 7.

### If validation fails after 3 attempts

Stop. Report the problem with full context:

```
VALIDATION FAILED after 3 attempts for {task-id}: {task title}

Attempt 1: {what was tried, what failed, error message}
Attempt 2: {what was changed, what failed, error message}
Attempt 3: {what was changed, what failed, error message}

The implementation may be partially complete. Requesting guidance before proceeding.
```

Do NOT attempt further fixes. Wait for the user to provide guidance.

## Step 7: Update state

This step uses MCP tools for feature transitions and direct state.json writes for task status.

### 7a: Mark task completed in state.json

Read `.sdd/state.json`. Update the task entry in the feature's `tasks` object:

```json
"{TASK-ID}": {
  "status": "completed",
  "title": "{task title}",
  "completed_at": "{ISO 8601 timestamp}"
}
```

Write the updated state.json.

### 7b: Feature transition (first task only)

If the feature was in state `tasked` (this is the first task being implemented), call `sdd_transition`:

```
sdd_transition(feature: "{feature-name}", to: "implementing", command: "sdd-implement")
```

If the transition fails (e.g., feature lock), report the error from the MCP response — it includes a human-readable `hint` field. Then stop.

### 7c: Check for feature completion

After marking the task, check if ALL tasks in the feature's `tasks` object now have status `completed`. If yes, call `sdd_transition`:

```
sdd_transition(feature: "{feature-name}", to: "validating", command: "sdd-implement")
```

If the transition succeeds, report: "All tasks completed. Feature `{feature-name}` is ready for validation. Run `/sdd:validate` to verify against spec."

If the transition fails, report the MCP error and its hint.

### 7d: Sync tasks.md

Update the task's status line in `specs/{feature-name}/tasks.md`. Locate the `## {TASK-ID}` heading and change `**Status**: pending` to `**Status**: completed` within that task block. Do NOT modify any other task block.

## Step 8: Report result

Report the outcome of THIS task using this format:

```
Task {TASK-ID} completed: {task title}

What was built:
- {Plain-language summary of what was done and what it means for the feature}

Requirements addressed:
- {FR-xxx}: {brief plain-language description of what this requirement means}
- {EC-xxx}: {brief plain-language description}

Validation:
- {What was checked and the result}

Feature progress: {N}/{M} tasks completed
```

Then call `sdd_next_action` with the feature name to get the current available tasks. From the response, list tasks with `ready: true`:

```
Ready to implement next:
- {TASK-ID}: {title} (complexity: {S/M/L})
- {TASK-ID}: {title} (complexity: {S/M/L})

These tasks have satisfied dependencies and can be implemented now.
```

If no tasks have `ready: true`, state that all remaining tasks are blocked or completed.

---

## Batch Mode

Batch mode activates when Step 1 selects multiple tasks (either auto-batched S-complexity tasks or user-specified multiple IDs). Batch mode cannot be combined with `--pair`.

### How batch execution works

Execute Steps 3-7 as a loop over each task in the batch, in ID order. For each task:
1. Read its task block (Step 3)
2. Read its files (Step 4)
3. Implement it (Step 5)
4. Validate it (Step 6)
5. Update state: mark task completed in state.json and sync tasks.md (Step 7a, 7d)

Feature transitions (Step 7b, 7c) happen once: 7b before the first task in the batch, 7c after the last task if all are completed.

If any task in the batch hits a blocker or fails validation after 3 attempts, stop the entire batch and report progress so far.

### Coaching in batch mode

Replace per-task announcements with a single batch announcement before starting:
"Executing {N} tasks in batch: {TASK-IDs}. These are all small, independent tasks."

### Batch report (Step 8)

Replace the standard single-task report with:

```
Batch completed: {N} tasks

| Task | Title | Requirements | Validation |
|------|-------|-------------|------------|
| TASK-001 | {title} | FR-001, EC-002 | {what was checked} |
| TASK-002 | {title} | FR-003 | {what was checked} |

What was built:
- {Unified plain-language summary covering the batch as a whole}

Feature progress: {N}/{M} tasks completed
```

Then call `sdd_next_action` to suggest next available tasks as in the standard Step 8.

---

## Pair-Programming Mode (`--pair`)

Pair-programming mode is activated ONLY when `$ARGUMENTS` contains the `--pair` flag. Without this flag, implementation behavior is identical to the standard flow described above — no changes whatsoever.

### What --pair does

Instead of implementing the complete task autonomously, Claude generates the file structure, imports, boilerplate, and configuration — but leaves the core business logic sections for the user to complete. The user writes the "interesting parts"; Claude handles the scaffolding.

### How markers work

Insert markers in the code where the user should write logic. Use the appropriate comment syntax for the file type:

- JavaScript/TypeScript: `// YOUR TURN: {instruction}`
- Python: `# YOUR TURN: {instruction}`
- HTML/JSX: `{/* YOUR TURN: {instruction} */}`
- CSS: `/* YOUR TURN: {instruction} */`
- Other: use the language's single-line comment syntax

### Marker rules

1. **Maximum 3 markers per file.** If the file has more than 3 business-logic sections, choose the 3 most important. Implement the rest yourself.
2. **Zero markers in boilerplate files.** If the file is purely configuration, imports, type definitions, or infrastructure (e.g., database migrations, route definitions, middleware setup), implement it fully with zero markers. Markers go only in files with business logic.
3. **Each marker includes the instruction.** The marker must tell the user what to write. Never leave a bare `// YOUR TURN` without context.

### Calibrate marker difficulty

Read `completed_features` from `sdd_get_state`:

- **`0-1` (first two features):** Markers are simple and include a hint.
  ```typescript
  // YOUR TURN: Calculate the lead score using the weighted formula.
  // Hint: multiply each factor's value by its weight from scoringConfig,
  // then sum the results. Clamp the final score to 0-100.
  ```

- **`2+` (experienced user):** Markers are more open — describe the goal, not the approach.
  ```typescript
  // YOUR TURN: Implement the scoring calculation.
  // Input: lead (Lead), config (ScoringConfig[])
  // Output: { score: number, factors: FactorBreakdown[] }
  ```

### After generating pair-mode files

Report the same Step 8 format, but add a section:

```
Pair mode: {N} markers placed across {M} files.
  - {file1}:{line} — {marker summary}
  - {file2}:{line} — {marker summary}

Complete the YOUR TURN sections and let me know when you're ready for validation.
```

Do NOT run validation (Step 6) in pair mode. The user must complete their sections first. When the user says they're done, THEN run the validation from Step 6.

---

## Restrictions

- Do NOT auto-execute the next task. After reporting, suggest available parallel tasks but wait for the user to invoke them.
- Do NOT implement anything not described in the task, even if it seems obviously needed. Report it as a blocker.
- Context budget: Read ONLY the specific task block from tasks.md + the files listed in the task's Files field. Do NOT read the full tasks.md, the spec, the plan, or unrelated source files.
- Maximum 3 validation retry attempts. After 3 failures, stop and ask for guidance.
- The single-feature lock is enforced by the MCP server's `sdd_transition` tool. If you encounter a lock error, report the MCP error message and stop.
- Do NOT modify files not listed in the task's Files field.
- Do NOT advance the feature state beyond `validating`. The `/sdd:validate` command handles the transition to `completed`.

$ARGUMENTS
