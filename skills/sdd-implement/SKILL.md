---
name: sdd-implement
description: "Execute a single task from the SDD task list. Use when the user says 'implement task', 'execute task', 'build task', 'do TASK-001', 'next task', 'start implementing', or wants to work on a specific task. Most tightly scoped command — reads only the task and its listed files."
argument-hint: "[TASK-NNN] [--pair]"
user-invokable: true
---

# /sdd:implement — Execute a single task

You are implementing a single task from the SDD task list. This is the most tightly scoped command in the plugin. You read only the specific task block and the files listed in that task. Follow these steps exactly, in order. Do NOT skip steps. Do NOT read files beyond what is explicitly listed in the task.

## Coaching Layer

During implementation, the user shifts from active participant to observer. They watch code being written but may not understand what is being created or why. Without coaching, this phase becomes a black box. Claude must make the process transparent.

**Rules:**
1. **Announce before you build.** Before starting implementation, briefly tell the user what you're about to do in plain language: "I'm going to create [file] which handles [function in business terms]. This implements [FR-xxx] from your spec — [what that requirement means in their domain]."
2. **Connect back to the spec.** In the post-task report, always reference which requirements were addressed: "This task implemented FR-003 (authentication on all protected routes) and EC-002 (invalid token handling)." The user should never wonder "why did that just happen?"
3. **Explain blockers in user terms.** If a blocker is found, explain it without jargon: "I found something this task needs that isn't part of its instructions. [Plain description]. We have two options: add it to an existing task, or create a new one. What would you prefer?"
4. **Explain the single-feature lock** if triggered: "Only one feature can be implemented at a time to prevent conflicting changes. Feature `{other}` is currently being built. Complete or pause it before starting this one."
5. **Calibrate explanation depth.** Read `.sdd/state.json` field `completed_features`:
   - `0` (first feature): Detailed plain-language explanations of what each file does and why.
   - `1` (second feature): Brief explanations — focus only on what's novel or surprising about this task.
   - `2+`: Minimal — announce what you're building in one line, report results. The user knows the process; don't slow them down with explanations they don't need.
6. **Role-transition coaching.** Check `.sdd/state.json` field `milestones.role_transition_explained`. If `false` and this is the first task for this feature, explain the role shift: "We're starting implementation now. From here, I'll work through each task one at a time and report what I built. Your role shifts to reviewer — check that what I built matches what you described in the spec. If anything looks wrong or confusing, stop me and ask." Then set `milestones.role_transition_explained` to `true`. On subsequent features, skip — the user knows the drill.

## Step 1: Parse task ID and flags

Parse the task ID from `$ARGUMENTS` (e.g., `TASK-003`). Also check if `$ARGUMENTS` contains the `--pair` flag.

If `--pair` is present, enable pair-programming mode (see "Pair-Programming Mode" section below). The flag does not affect Steps 1-4 or Steps 6-8 — it only modifies Step 5.

If no task ID is provided:

1. Read `.sdd/state.json`.
2. Identify the `active_feature`.
3. Look through the feature's `tasks` object and find the first task whose status is `pending` and whose dependencies are all `completed`.
4. If no pending task with satisfied dependencies exists, report: "All tasks are either completed or blocked. No pending task is available to implement." Then stop.
5. Use that task's ID as the target.

If a task ID is provided, use it directly.

## Step 2: Read and validate state

Read `.sdd/state.json`. Perform these validations in order:

1. **Feature state**: Verify the feature (from `active_feature`) is in state `tasked` or `implementing`.
   - If in `tasked` (this is the first implementation): you will transition the feature to `implementing` in Step 7.
   - If in `implementing`: proceed normally.
   - If in any other state: report the current state and stop. Do NOT proceed.

2. **Single feature lock**: Verify no OTHER feature in `state.json` is in `implementing` state. Only one feature can be in `implementing` state at a time. If another feature is already being implemented, report: "Feature `{other-feature}` is currently in `implementing` state. Only one feature can be implemented at a time. Complete or reset that feature before proceeding." Then stop.

3. **Task status**: Verify the specified task's status is `pending`.
   - If the task is `completed`: report that the task has already been completed and stop.
   - If the task doesn't exist in the tasks object: report that the task ID was not found and stop.

## Step 3: Read the task block

Read `specs/{feature-name}/tasks.md`. Locate the specific task block by its ID heading (e.g., `## TASK-003`). Extract from that block:

- **Title**: the task title
- **Description**: what to implement
- **Files**: the list of files to read and/or modify
- **Depends on**: task dependencies
- **Validation**: the concrete check to run after implementation

**Dependency check**: For each dependency listed in the task's "Depends on" field, verify it has status `completed` in `state.json`. If any dependency is not completed, report: "Cannot implement {task-id}. The following dependencies are not yet completed: {list of incomplete dependency IDs with their current status}." Then stop.

Do NOT read the rest of tasks.md beyond the specific task block. Do NOT read the spec or plan files.

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

## Step 7: Update state.json

Read `.sdd/state.json` again (to avoid stale data). Apply these updates:

1. **First task transition**: If the feature was in state `tasked` (this is the first task being implemented), transition it:
   - Validate the transition: check `allowed_transitions` in state.json to confirm that `"tasked"` allows transitioning to `"implementing"`. If the transition is not listed, warn the user and do not proceed.
   - Set the feature's `state` to `implementing`.
   - Set `active_feature` to the feature name.
   - Append a transition record to the feature's `transitions` array:

   ```json
   {
     "from": "tasked",
     "to": "implementing",
     "at": "{ISO 8601 timestamp}",
     "command": "sdd-implement"
   }
   ```

2. **Mark task completed**: Update the task entry in the feature's `tasks` object:

   ```json
   "{TASK-ID}": {
     "status": "completed",
     "title": "{task title}",
     "completed_at": "{ISO 8601 timestamp}"
   }
   ```

3. **Check for feature completion**: After marking the task, check if ALL tasks in the feature's `tasks` object now have status `completed`. If yes:
   - Validate the transition: check `allowed_transitions` in state.json to confirm that `"implementing"` allows transitioning to `"validating"`. If the transition is not listed, warn the user and do not proceed.
   - Transition the feature state to `validating`.
   - Append a transition record:

   ```json
   {
     "from": "implementing",
     "to": "validating",
     "at": "{ISO 8601 timestamp}",
     "command": "sdd-implement"
   }
   ```
   - Report: "All tasks completed. Feature `{feature-name}` is ready for validation. Run `/sdd:validate` to verify against spec."

Write the updated state.json.

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

Then stop. Do NOT suggest or execute the next task.

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

Read `.sdd/state.json` field `completed_features`:

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

- Do NOT suggest or execute the next task. Report the result of THIS task and stop.
- Do NOT implement anything not described in the task, even if it seems obviously needed. Report it as a blocker.
- Context budget: Read ONLY the specific task block from tasks.md + the files listed in the task's Files field. Do NOT read the full tasks.md, the spec, the plan, or unrelated source files.
- Maximum 3 validation retry attempts. After 3 failures, stop and ask for guidance.
- Only one feature can be in `implementing` state at a time. If another feature is already being implemented, stop and report.
- Do NOT modify files not listed in the task's Files field.
- Do NOT advance the feature state beyond `validating`. The `/sdd:validate` command handles the transition to `completed`.

$ARGUMENTS
