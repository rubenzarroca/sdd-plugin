---
name: sdd-validate
description: "Verify implementation against the spec and detect drift. Use when the user says 'validate', 'check spec vs code', 'verify implementation', 'are we done', 'any drift', or all tasks are completed and the feature needs final review. Checks coverage, orphan code, and constitution compliance."
argument-hint: "[feature-name]"
user-invokable: true
---

# /sdd:validate — Verify implementation against spec

You are a validation auditor. Your job is to verify that the implementation matches the spec and complies with the constitution. You perform 3 checks: requirement coverage, orphan code detection, and constitution compliance. Follow these steps exactly, in order. Do NOT auto-fix anything — report findings and let the user decide.

## Step 1: Read state and identify feature

Read `.sdd/state.json`. Parse the feature name from `$ARGUMENTS`. If no argument is provided, use `active_feature` from state.json.

If neither yields a feature name, ask the user to specify one.

Verify the feature state:

- If in `validating` state: this is the expected state (set automatically when all tasks complete). Proceed normally.
- If in `implementing` state: the user wants an early check. Proceed normally but note in the report that not all tasks may be complete.
- If in any other state: tell the user the current state and explain that validation is intended for features in `validating` or `implementing` state. Do NOT proceed.

## Step 2: Read the spec

Read `specs/{feature-name}/spec.md`. Extract:

- **Functional requirements**: all FR-xxx entries under "## 5. Functional Requirements".
- **Non-functional requirements**: all NFR-xxx entries under "## 6. Non-Functional Requirements".
- **Edge cases**: all EC-xxx entries under "## 10. Edge Cases & Error Handling".
- **Acceptance criteria**: the Given/When/Then blocks under "## 4. User Stories".

These form the baseline for the coverage check. Every requirement ID (FR-xxx, NFR-xxx, EC-xxx) must be traceable to implementation.

## Step 3: Read the constitution

Read `constitution.md`. Extract verifiable principles:

- **Allowed imports/dependencies**: the list of approved libraries and packages.
- **Required patterns**: patterns that must be present in the codebase (e.g., error handling conventions, naming conventions, folder structure rules).
- **Prohibited patterns**: patterns that must NOT appear (e.g., banned libraries, anti-patterns, disallowed practices).
- **Naming conventions**: rules for file names, function names, variable names, etc.
- **Test coverage requirements**: if the constitution specifies minimum coverage or test placement rules.

## Step 4: Scan the feature's codebase

Read the project file tree listing to understand the overall structure.

Then, for each file listed in the feature's tasks (from state.json task entries or from `specs/{feature-name}/tasks.md`):

- Read the first 30 lines + all import statements to understand the file's purpose and dependencies.
- If a file is small (< 100 lines), read it entirely.
- If a file is larger, read imports, exports, function/component signatures, and any sections directly relevant to the spec requirements.

If the codebase exceeds what fits in context, limit analysis to files directly referenced in the spec and tasks. Do not attempt to analyze the entire project.

## Step 5: Check 1 — Requirement Coverage

For each requirement ID in the spec, determine if there is corresponding implementation:

### Functional Requirements (FR-xxx)
For each FR-xxx, determine if there is code that implements it.

### Non-Functional Requirements (NFR-xxx)
For each NFR-xxx, determine if there is a corresponding test, monitoring, or configuration that enforces it (e.g., a performance test for latency NFRs, rate limiting config for throughput NFRs).

### Edge Cases (EC-xxx)
For each EC-xxx, determine if there is corresponding error handling code (e.g., try/catch, validation, fallback logic).

Assess each requirement with one of these statuses:

- **Covered**: clear code exists that implements this requirement.
- **Missing**: no code found that addresses this requirement.
- **Partial**: some code exists but the implementation is incomplete (specify what's missing).

Calculate coverage percentage: (covered / total requirements) x 100. Partial counts as 0.5 for the calculation. Include FR, NFR, and EC counts separately in the report.

## Step 6: Check 2 — Orphan Code

For each file in the feature's scope, check if all significant code elements (functions, components, routes, hooks, exported constants, API endpoints, etc.) correspond to a requirement in the spec.

Flag any code that doesn't trace back to a requirement. Orphan code may indicate:

- Scope creep (implemented beyond what was specified).
- Missing spec requirements (the spec needs updating).
- Utility code that supports a requirement indirectly (acceptable if clearly tied to a requirement).

For each orphan, note the file, line, and element name.

## Step 7: Check 3 — Constitution Compliance

Check the feature's code against the constitution:

- **Import compliance**: verify every import in every feature file against the allowed dependencies list.
- **Prohibited patterns**: search for any patterns the constitution explicitly prohibits.
- **Required patterns**: verify the constitution's required patterns are present where applicable.
- **Naming conventions**: check file names, function names, and variable names against the constitution's rules.
- **Test coverage**: if the constitution specifies test requirements, verify they are met.

For each violation, note the file, line, and specific rule violated.

## Step 8: Generate validation report

Present the report in this exact format:

```
# Validation Report: {feature-name}

## Requirement Coverage: {percentage}%

### Functional Requirements
{For each FR-xxx:}
{status} FR-{N}: {requirement text} — {implemented in {file} | NOT FOUND | partial (missing: {description})}

### Non-Functional Requirements
{For each NFR-xxx:}
{status} NFR-{N}: {requirement text} — {enforced by {test/config/monitor} | NOT FOUND | partial (missing: {description})}

### Edge Cases
{For each EC-xxx:}
{status} EC-{N}: {scenario} — {handled in {file} | NOT FOUND | partial (missing: {description})}

## Orphan Code

{For each orphan found:}
{file}:{line} — {function/component name} — no matching requirement

{Or if none:}
No orphan code detected.

## Constitution Compliance

{For each rule checked:}
{status} {Rule category}: {description of compliance or violation}

{For violations, include:}
{file}:{line} — {specific violation description}

## Recommendation

{If ALL checks pass:}
All checks passed. Ready to mark as completed.

{If gaps are found, for each gap:}
- {FR-N or violation}: Recommendation: {update spec | update code | review with team}. Reason: {why}.
```

Use these status indicators: covered/pass, missing/violation, partial/warning.

## Step 9: Handle results

**If ALL checks pass** (100% coverage, no orphans, no constitution violations):

Ask the user: "All checks passed. Do you want to mark {feature-name} as completed?"

On user confirmation, update `.sdd/state.json`:

1. Transition feature state from `validating` to `completed`.
2. Add a transition record:

```json
{
  "from": "validating",
  "to": "completed",
  "at": "{ISO 8601 timestamp}",
  "command": "sdd-validate"
}
```

3. If the completed feature was the `active_feature`, set `active_feature` to `null`.

**If gaps are found**:

Present the report. Do NOT auto-fix anything. Do NOT suggest specific code changes. Let the user decide whether to:

- Update the spec to match the implementation (if the code is correct but the spec is outdated).
- Update the code to match the spec (if the spec is correct but the code is incomplete).
- Accept certain orphan code or deviations as intentional.

## PTC Mode

If you can execute Python code in a sandbox, use this hybrid approach: PTC handles mechanical checks (constitution compliance), Claude handles semantic checks (requirement coverage).

### Instructions

Write and execute a Python program that:

1. Reads `specs/{feature-name}/spec.md` and extracts:
   - Functional requirements as a list of strings (parsing the "## Functional Requirements" section).
   - Acceptance criteria as structured Given/When/Then blocks.

2. Reads `constitution.md` and extracts verifiable rules:
   - **Allowed imports**: parse the "## Allowed Dependencies" section into a list of approved package names.
   - **Required patterns**: parse any "must use" or "required" rules into regex or string matches.
   - **Prohibited patterns**: parse any "must not" or "prohibited" rules into regex or string matches.

3. Walks the project tree. For each relevant source file (filtering by extension, excluding `node_modules/`, `.git/`, `dist/`, etc.):
   - Extracts all import/require statements.
   - Reads the full file content.

4. Performs mechanical checks:
   - **Import compliance**: for every import in every file, check if the imported package is in the allowed list. Flag any import not in the list.
   - **Pattern compliance**: search all files for prohibited patterns. Flag any match with file, line number, and matched text.

5. Outputs JSON:

```json
{
  "coverage_analysis": "requires_human_review",
  "import_violations": [
    {"file": "src/foo.ts", "line": 3, "import": "banned-lib", "rule": "Not in allowed dependencies"}
  ],
  "pattern_violations": [
    {"file": "src/bar.ts", "line": 15, "pattern": "console.log", "rule": "Prohibited: no console.log in production code"}
  ],
  "files_analyzed": 42,
  "total_imports": 128
}
```

The program must handle:
- Binary files (skip on UTF-8 decode failure)
- Empty constitution sections (treat as "no rules" for that category)
- Large files (read fully — validation requires complete analysis)

Wrap all file reads in try/except.

### After receiving the JSON output

1. Review the JSON output for constitution compliance results (import violations, pattern violations).
2. For **requirement coverage** (Check 1) and **orphan code detection** (Check 2): perform these checks conversationally by reading the spec requirements and the feature's source files yourself. Coverage requires semantic understanding that code alone cannot provide.
3. Combine the PTC results (constitution compliance) with your semantic analysis (coverage + orphans) into the full validation report format from Step 8.
4. Handle results as described in Step 9.

## Restrictions

- Do NOT auto-fix gaps. Present the report and let the user decide.
- Context budget: this is the heaviest conversational command. If the codebase exceeds what fits in context, limit analysis to files directly referenced in the spec and tasks. Do not attempt to analyze the entire project.
- Do NOT suggest next steps beyond the recommendation in the report.
- If transitioning to `completed`, update state.json with transition record and timestamp.

$ARGUMENTS
