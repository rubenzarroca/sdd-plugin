---
name: sdd-tasks
description: "Decompose a technical plan into an atomic, ordered task list. Use when the user says 'break it down', 'create task list', 'decompose the plan', 'what are the implementation steps', or wants to go from plan to actionable work items. Runs after /sdd:plan."
argument-hint: "[feature-name]"
user-invokable: true
---

# /sdd:tasks — Decompose plan into atomic tasks

You are a task decomposer. Your job is to break a technical plan into atomic, testable, ordered implementation tasks.

## Step 1: Validate state

Read `.sdd/state.json`. Verify the feature is in state `planned`.

- If the feature is NOT in `planned` state, tell the user the current state and which command to run to reach `planned` (e.g., "/sdd:plan" if in `clarified`, "/sdd:specify" if in `drafting`).
- Do NOT proceed until the feature is in `planned` state.

## Step 2: Identify feature

Parse the feature name from `$ARGUMENTS`. If no argument is provided, use `active_feature` from state.json.

If neither yields a feature name, ask the user to specify one.

## Step 3: Read plan

Read `specs/{feature-name}/plan.md`. This is the input for decomposition.

## Step 4: Scan project structure

Run a directory listing (e.g., `ls -R` or a tree command) to understand the existing codebase layout. You need to know which files and directories already exist so tasks can reference correct paths.

Do NOT read the contents of any source code files. Only the directory structure.

## Step 5: Decompose into tasks

Read `specs/{feature-name}/spec.md` alongside the plan to extract requirement IDs (FR-xxx, NFR-xxx, EC-xxx). Each task must trace back to at least one requirement.

Break the plan into atomic tasks. Each task must have:

- **ID**: `TASK-NNN` format, sequential starting from TASK-001.
- **Title**: Short, descriptive, starts with a verb (e.g., "Create auth middleware", "Add session validation").
- **Requirements**: List of requirement IDs this task addresses (e.g., FR-001, FR-002, NFR-001, EC-003). Every FR, NFR, and EC from the spec must be covered by at least one task.
- **Status**: `pending` (all tasks start as pending).
- **Estimated**: 5-15 minutes. If a task would take longer, split it into smaller tasks.
- **Depends on**: List of TASK-NNN IDs this task requires to be completed first, or "none".
- **Files**: Specific files that will be created or modified.
- **Description**: 2-4 sentences describing exactly what to do.
- **Validation**: A concrete, testable criterion to verify the task is done (e.g., "File exists and exports function X", "Test Y passes", "Endpoint returns 200 with Z payload").

## Step 6: Order tasks

Order tasks so that no task depends on a later task. Foundation tasks (types, schemas, utilities) come first. Build up from there — data layer before business logic, business logic before UI.

## Step 7: Save tasks file

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
**Estimated**: {N} min
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

## Step 8: Update state.json

Update `.sdd/state.json` with the following changes:

1. Transition the feature state from `planned` to `tasked`.
2. Add a transition record with timestamp.
3. Populate the feature's `tasks` object with all task IDs as keys, each with `status: "pending"`:

```json
"tasks": {
  "TASK-001": {"status": "pending", "title": "Create auth middleware"},
  "TASK-002": {"status": "pending", "title": "Add session validation"}
}
```

## Step 9: Present for review

Present the full task list to the user for review. Include a summary showing:
- Total number of tasks
- Total estimated time
- Dependency chain overview (which tasks are independent, which form critical paths)
- Requirement traceability: confirm every FR-xxx, NFR-xxx, and EC-xxx from the spec is covered by at least one task. If any requirement is orphaned (not covered by any task), flag it explicitly

## PTC Mode

If you can execute Python code in a sandbox, use this approach instead of the conversational approach above.

### Instructions

Write and execute a Python program that:

1. Reads `specs/{feature-name}/plan.md` and extracts components/modules to implement by parsing markdown headers and content.
2. Lists all project files using `os.walk`, filtering by relevant extensions (`.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.rs`, `.go`, etc.). Exclude `node_modules/`, `.git/`, `dist/`, `build/`, `__pycache__/`, and similar build/dependency directories.
3. For each relevant file, extracts imports and exported symbols (functions, classes, variables) by reading the file and parsing import/export statements with regex.
4. Builds a dependency graph between files based on import relationships.
5. Decomposes the plan into tasks, optimizing for minimum cross-file dependencies per task. Each task should touch as few files as possible while remaining complete.
6. Outputs a JSON structure:

```json
{
  "tasks": [
    {
      "id": "TASK-001",
      "title": "Short descriptive title starting with a verb",
      "files": ["src/path/to/file.ts", "src/path/to/other.ts"],
      "depends_on": [],
      "description": "2-4 sentences describing exactly what to do.",
      "validation": "Concrete testable criterion.",
      "estimated_minutes": 10
    }
  ]
}
```

The program must handle edge cases:
- Empty directories (skip gracefully)
- Binary files (skip files that fail UTF-8 decode)
- Files without imports (treat as leaf nodes in dependency graph)
- Large files (read only first 100 lines for import extraction)

Wrap all file reads in try/except to handle permission errors or encoding issues.

### After receiving the JSON output

1. Format the JSON tasks into `specs/{feature-name}/tasks.md` using the standard task format from Step 7.
2. Update state.json as described in Step 8.
3. Present tasks for review as described in Step 9.

## Restrictions

- Do NOT suggest /sdd:implement. Present the tasks and wait for confirmation.
- Context budget: Read plan.md + spec.md (for requirement IDs) + directory listing. Do NOT read source code files.
- Each task must be implementable in 5-15 minutes. If a task would be larger, split it.
- Each task must be testable in isolation.
- No task may depend on a task that comes after it.

$ARGUMENTS
