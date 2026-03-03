---
name: sdd-validate
description: "Verify implementation against the spec and detect drift. Use when the user says 'validate', 'check spec vs code', 'verify implementation', 'are we done', 'any drift', or all tasks are completed and the feature needs final review. Checks coverage, orphan code, constitution compliance, and cross-layer consistency."
argument-hint: "[feature-name]"
user-invokable: true
---

# /sdd:validate — Verify implementation against spec

You are a validation auditor. Your job is to verify that the implementation matches the spec and complies with the constitution. You perform two layers of validation: a deterministic baseline from the MCP server, and a code-level audit that verifies the implementation exists and is correct. Follow these steps exactly, in order. Do NOT auto-fix anything — report findings and let the user decide.

**MCP Server integration**: This command uses two MCP tools — `sdd_validate` for deterministic coverage data and `sdd_transition` for state changes. If the MCP server is not available, fall back to reading artifacts directly.

## Step 1: Identify feature and validate state

Parse the feature name from `$ARGUMENTS`. If no argument is provided, call `sdd_get_state` (no feature argument) to get the `active_feature`.

If neither yields a feature name, ask the user to specify one.

Call `sdd_get_state` with the feature name. Check the feature state:

- If in `validating` state: this is the expected state (set automatically when all tasks complete). Proceed normally.
- If in `implementing` state: the user wants an early check. Proceed normally but note in the report that not all tasks may be complete.
- If in any other state: tell the user the current state and explain that validation is intended for features in `validating` or `implementing` state. Do NOT proceed.

## Step 2: Get deterministic baseline from MCP

Call the `sdd_validate` tool with the feature name. This returns:

- **`deterministic.requirement_coverage`**: For each requirement ID (FR/NFR/EC), which tasks cover it and their completion status (`covered`, `partial`, `pending`, `uncovered`).
- **`deterministic.task_progress`**: How many tasks are completed, in progress, pending, and blocked.
- **`deterministic.orphan_requirements`**: Requirements not assigned to any task.
- **`heuristic.constitution_compliance`**: Best-effort structural check of constitution.md.
- **`summary.can_complete`**: Boolean — are there any blockers?

This baseline is **exact** — it comes from structured data (spec.json + tasks.json + state.json). Use it as the foundation for the report.

## Step 3: Read the spec

Read `specs/{feature-name}/spec.md`. Extract:

- **Functional requirements**: all FR-xxx entries under "## 5. Functional Requirements".
- **Non-functional requirements**: all NFR-xxx entries under "## 6. Non-Functional Requirements".
- **Edge cases**: all EC-xxx entries under "## 10. Edge Cases & Error Handling".
- **Acceptance criteria**: the Given/When/Then blocks under "## 4. User Stories".

Cross-reference these with the MCP baseline. If there are requirements in the spec.md that don't appear in the MCP baseline's breakdown, flag them — this indicates spec.json is out of sync.

## Step 4: Read the constitution

Read `constitution.md`. Extract verifiable principles:

- **Allowed imports/dependencies**: the list of approved libraries and packages.
- **Required patterns**: patterns that must be present in the codebase (e.g., error handling conventions, naming conventions, folder structure rules).
- **Prohibited patterns**: patterns that must NOT appear (e.g., banned libraries, anti-patterns, disallowed practices).
- **Naming conventions**: rules for file names, function names, variable names, etc.
- **Test coverage requirements**: if the constitution specifies minimum coverage or test placement rules.

## Step 5: Scan the feature's codebase

Read the project file tree listing to understand the overall structure.

Then, for each file listed in the feature's tasks (from the `sdd_get_state` response task entries or from `specs/{feature-name}/tasks.md`):

- Read the first 30 lines + all import statements to understand the file's purpose and dependencies.
- If a file is small (< 100 lines), read it entirely.
- If a file is larger, read imports, exports, function/component signatures, and any sections directly relevant to the spec requirements.

If the codebase exceeds what fits in context, limit analysis to files directly referenced in the spec and tasks. Do not attempt to analyze the entire project.

## Step 6: Check 1 — Requirement Coverage (Code-Level)

Start with the MCP baseline from Step 2. For each requirement, verify that actual code exists:

### Functional Requirements (FR-xxx)
For each FR-xxx that the MCP baseline marks as `covered` (all tasks completed), verify there is actual code that implements it. A task being marked complete doesn't guarantee correct implementation — it means the developer said it's done.

For each FR-xxx marked as `partial` or `pending`, note which tasks are still incomplete.

For each FR-xxx marked as `uncovered` (orphan requirement), flag it prominently — no task covers this requirement.

### Non-Functional Requirements (NFR-xxx)
For each NFR-xxx, determine if there is a corresponding test, monitoring, or configuration that enforces it.

### Edge Cases (EC-xxx)
For each EC-xxx, determine if there is corresponding error handling code.

Assess each requirement with one of these statuses:

- **Covered**: clear code exists that implements this requirement AND the MCP baseline confirms task coverage.
- **Missing**: no code found AND/OR no task coverage.
- **Partial**: some code exists but the implementation is incomplete (specify what's missing).

Calculate coverage percentage: (covered / total requirements) x 100. Partial counts as 0.5 for the calculation. Include FR, NFR, and EC counts separately in the report.

## Step 7: Check 2 — Orphan Code

For each file in the feature's scope, check if all significant code elements (functions, components, routes, hooks, exported constants, API endpoints, etc.) correspond to a requirement in the spec.

Flag any code that doesn't trace back to a requirement. Orphan code may indicate:

- Scope creep (implemented beyond what was specified).
- Missing spec requirements (the spec needs updating).
- Utility code that supports a requirement indirectly (acceptable if clearly tied to a requirement).

For each orphan, note the file, line, and element name.

## Step 8: Check 3 — Constitution Compliance

Start with the MCP baseline's `heuristic.constitution_compliance` from Step 2 (structural checks). Then do a deeper code-level check:

- **Import compliance**: verify every import in every feature file against the allowed dependencies list.
- **Prohibited patterns**: search for any patterns the constitution explicitly prohibits.
- **Required patterns**: verify the constitution's required patterns are present where applicable.
- **Naming conventions**: check file names, function names, and variable names against the constitution's rules.
- **Test coverage**: if the constitution specifies test requirements, verify they are met.

For each violation, note the file, line, and specific rule violated.

## Step 9: Check 4 — Cross-Layer Consistency

For features that span multiple layers (database, API, frontend), verify that data fields referenced in one layer actually exist in the layers that provide them.

### Classify files into layers

Using the files already scanned in Step 5, classify each into its layer:

- **Schema layer**: migrations, ORM models, database schema files
- **API layer**: controllers, resolvers, route handlers, serializers, API response types
- **Consumer layer**: frontend components, templates, CLI output formatters

### Trace field references

1. **Schema → API**: For each field the API layer queries or returns, verify it exists in the schema layer.
2. **API → Consumer**: For each field the consumer layer accesses, verify the API layer includes it in its response shape.

### What to flag

- **Missing field**: consumer accesses `lead.profileUrl` but the schema has no corresponding column and the API doesn't include it in its response.
- **Renamed without transform**: schema has `profile_url` but consumer accesses `profileURL` and no serialization or mapping layer transforms the name.

### When to skip

If the feature's files all belong to a single layer, skip this check and note: "Single-layer feature — cross-layer check not applicable."

## Step 10: Generate validation report

Present the report in this exact format. Use two clearly marked sections to indicate confidence levels:

```
# Validation Report: {feature-name}

## Deterministic Baseline (from MCP server — exact confidence)

Task progress: {completed}/{total} tasks
Requirement coverage: {implemented}/{total} requirements
Orphan requirements (no task assigned): {list or "none"}
Blocked tasks: {list or "none"}

## Code-Level Audit (from source analysis)

### Requirement Coverage: {percentage}%

#### Functional Requirements
{For each FR-xxx:}
{status} FR-{N}: {requirement text} — {implemented in {file} | NOT FOUND | partial (missing: {description})}

#### Non-Functional Requirements
{For each NFR-xxx:}
{status} NFR-{N}: {requirement text} — {enforced by {test/config/monitor} | NOT FOUND | partial (missing: {description})}

#### Edge Cases
{For each EC-xxx:}
{status} EC-{N}: {scenario} — {handled in {file} | NOT FOUND | partial (missing: {description})}

### Orphan Code

{For each orphan found:}
{file}:{line} — {function/component name} — no matching requirement

{Or if none:}
No orphan code detected.

### Constitution Compliance

{For each rule checked:}
{status} {Rule category}: {description of compliance or violation}

{For violations, include:}
{file}:{line} — {specific violation description}

### Cross-Layer Consistency

{For each mismatch:}
{status} {consumer_file}:{line} accesses `{field}` — not found in {provider_layer} ({provider_file})

{Or if clean:}
No cross-layer mismatches detected.

{Or if single-layer:}
Single-layer feature — check not applicable.

## Recommendation

{If ALL checks pass:}
All checks passed. Ready to mark as completed.

{If gaps are found, for each gap:}
- {FR-N or violation}: Recommendation: {update spec | update code | review with team}. Reason: {why}.
```

Use these status indicators: covered/pass, missing/violation, partial/warning.

After the raw report, present a **plain-language executive summary** — calibrated to experience. Read `completed_features` from the `sdd_get_state` response:

**`completed_features < 2`** — Full three-part summary:
1. **What's done:** "X of Y requirements are fully implemented. The core feature works."
2. **What's missing:** "These N items need attention: [list each missing/partial item in plain language, not just IDs]. For example, FR-004 (the email notification when a lead goes hot) is not implemented yet."
3. **What to do next:** "To finish this feature, we need to [plain language action]. Do you want me to explain any of these items in more detail?"

**`completed_features >= 2`** — Compact: "Coverage: X/Y requirements. [N gaps — list briefly]. How do you want to handle them?"

If the report contains terms the user may not understand, check `.sdd/state.json` field `milestones.orphan_code_explained`. If `false` and orphan code was detected, explain it and then set the milestone to `true`:
- "Orphan code" → "Code that exists but doesn't match any requirement in the spec — it might be extra or the spec might need updating."
- "Constitution violation" → "Code that breaks one of the project rules you defined during setup."
- "Partial coverage" → "The requirement is partly implemented but something is still missing."
- "Cross-layer mismatch" → "The frontend uses a data field that doesn't exist in the database or API — the code compiles but will break at runtime."

If `milestones.orphan_code_explained` is already `true`, use the terms without re-explaining them.

## Step 11: Handle results

**If ALL checks pass** (100% coverage, no orphans, no constitution violations, no cross-layer mismatches):

Ask the user: "All checks passed. Do you want to mark {feature-name} as completed?"

On user confirmation, call `sdd_transition`:

```
sdd_transition(feature: "{feature-name}", to: "completed", command: "sdd-validate")
```

If the transition succeeds: report "Feature `{feature-name}` marked as completed." Then update `.sdd/state.json` directly for coaching_profile (see below).

If the transition fails: report the MCP error message and its hint. The most likely cause is uncompleted tasks — the MCP server enforces that all tasks must be completed before transitioning to `completed`.

After successful completion, update `.sdd/state.json`:
- **Update coaching_profile:** Review which coaching categories needed intervention during this feature's lifecycle vs. which the user handled independently. Increment `unscaffolded` for categories where the spec and implementation were solid without coaching. Increment `scaffolded` for categories that needed help. **Cap at one per category per session.**

**If gaps are found**:

Present the report. Do NOT auto-fix anything. Do NOT suggest specific code changes. Help the user make an informed decision — calibrated to experience:

**`completed_features < 2`** — Explain each option in plain language:
"For each gap, you have three choices:
1. **Update the code** to match the spec — choose this if the spec is correct and the code is missing something.
2. **Update the spec** to match the code — choose this if the code does something useful that wasn't anticipated. This isn't a failure — it means we learned something during implementation.
3. **Accept the deviation** — choose this if the difference is intentional or too minor to fix right now.

If you're unsure about any item, tell me which one and I'll explain the trade-offs."

**`completed_features >= 2`** — Skip the framework explanation. The user knows the options. Just ask: "For each gap: update code, update spec, or accept? Let me know per item."

Address each gap individually if the user needs guidance. Do NOT batch all decisions together.

**Coaching_profile update on gap resolution:** After the user resolves each gap, update `coaching_profile` for the relevant category. If the user correctly identifies the resolution without coaching, increment `unscaffolded`. If Claude had to explain the difference, increment `scaffolded`. **Cap at one per category per session.**

## Restrictions

- Do NOT auto-fix gaps. Present the report and let the user decide.
- Context budget: this is the heaviest conversational command. If the codebase exceeds what fits in context, limit analysis to files directly referenced in the spec and tasks. Do not attempt to analyze the entire project.
- Do NOT suggest next steps beyond the recommendation in the report.
- Feature state transitions use the MCP server's `sdd_transition` tool. Do not write feature state directly to state.json.

$ARGUMENTS
