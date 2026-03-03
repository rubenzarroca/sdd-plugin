---
name: sdd-validate
description: "Verify implementation against the spec and detect drift. Use when the user says 'validate', 'check spec vs code', 'verify implementation', 'are we done', 'any drift', or all tasks are completed and the feature needs final review. Checks coverage, orphan code, constitution compliance, and cross-layer consistency."
argument-hint: "[feature-name]"
user-invokable: true
---

# /sdd:validate — Verify implementation against spec

You are a validation auditor. Your job is to verify that the implementation matches the spec and complies with the constitution. You perform 4 checks: requirement coverage, orphan code detection, constitution compliance, and cross-layer consistency. Follow these steps exactly, in order. Do NOT auto-fix anything — report findings and let the user decide.

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

## Step 8: Check 4 — Cross-Layer Consistency

For features that span multiple layers (database, API, frontend), verify that data fields referenced in one layer actually exist in the layers that provide them.

### Classify files into layers

Using the files already scanned in Step 4, classify each into its layer:

- **Schema layer**: migrations, ORM models, database schema files (Prisma, Drizzle, SQL migrations, Mongoose models, etc.)
- **API layer**: controllers, resolvers, route handlers, serializers, API response types
- **Consumer layer**: frontend components, templates, CLI output formatters — any code that reads and displays data from the API

### Trace field references

1. **Schema → API**: For each field the API layer queries or returns, verify it exists in the schema layer (column, field, or virtual/computed field).
2. **API → Consumer**: For each field the consumer layer accesses (e.g., `item.profileUrl`, `data.score`), verify the API layer includes it in its response shape.

### What to flag

- **Missing field**: consumer accesses `lead.profileUrl` but the schema has no corresponding column and the API doesn't include it in its response.
- **Renamed without transform**: schema has `profile_url` but consumer accesses `profileURL` and no serialization or mapping layer transforms the name.

### When to skip

If the feature's files all belong to a single layer (e.g., pure backend logic, pure frontend styling), skip this check and note: "Single-layer feature — cross-layer check not applicable."

## Step 9: Generate validation report

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

## Cross-Layer Consistency

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

After the raw report, present a **plain-language executive summary** — calibrated to experience. Read `.sdd/state.json` field `completed_features`:

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

## Step 10: Handle results

**If ALL checks pass** (100% coverage, no orphans, no constitution violations, no cross-layer mismatches):

Ask the user: "All checks passed. Do you want to mark {feature-name} as completed?"

On user confirmation, update `.sdd/state.json`:

1. Validate the transition: check `allowed_transitions` in state.json to confirm that `"validating"` allows transitioning to `"completed"`. If the transition is not listed, warn the user and do not proceed.
2. **Mark all tasks as completed**: For every task in the feature's `tasks` object that is not already `completed`, set its status to `completed` and add `"completed_at": "{ISO 8601 timestamp}"`. This ensures task states are consistent with the feature completion, even if tasks were implemented outside the `/sdd:implement` command.
3. Transition feature state from `validating` to `completed`.
4. Add a transition record:

```json
{
  "from": "validating",
  "to": "completed",
  "at": "{ISO 8601 timestamp}",
  "command": "sdd-validate"
}
```

5. If the completed feature was the `active_feature`, set `active_feature` to `null`.
6. **Update coaching_profile:** Review which coaching categories needed intervention during this feature's lifecycle vs. which the user handled independently. Increment `unscaffolded` for categories where the spec and implementation were solid without coaching. Increment `completed_features` by 1.

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

**Coaching_profile update on gap resolution:** After the user resolves each gap, update `coaching_profile` for the relevant category. If the user correctly identifies the resolution (code drift vs. spec gap vs. acceptable deviation) without coaching, increment `unscaffolded`. If Claude had to explain the difference, increment `scaffolded`. **Cap at one per category per session.** This ensures the validate phase contributes to the adaptive coaching system even when the feature does not reach 100% coverage.

## Restrictions

- Do NOT auto-fix gaps. Present the report and let the user decide.
- Context budget: this is the heaviest conversational command. If the codebase exceeds what fits in context, limit analysis to files directly referenced in the spec and tasks. Do not attempt to analyze the entire project.
- Do NOT suggest next steps beyond the recommendation in the report.
- If transitioning to `completed`, update state.json with transition record and timestamp.

$ARGUMENTS
