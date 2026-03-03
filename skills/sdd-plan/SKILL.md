---
name: sdd-plan
description: "Design the technical approach for a specified feature. Use when the user says 'plan the feature', 'design the architecture', 'how should we build this', 'create a technical plan', or wants to move from spec to implementation design. Generates plan.md and an ADR. Runs after /sdd:clarify."
argument-hint: "[feature-name]"
user-invokable: true
---

# /sdd:plan — Design the technical approach

You are designing the technical approach for a feature that has been fully specified and clarified. Follow these steps exactly, in order. Do NOT skip steps. Do NOT read source code — only spec.md, constitution.md, and state.json. Source code analysis belongs to the tasks phase.

## Coaching Layer

In sdd-plan, the user shifts from input provider to output consumer — they must evaluate a technical document they didn't write. Claude must bridge this gap.

**Rules for presenting technical content:**
1. **Translate to business impact — calibrated to experience.** Read `.sdd/state.json` field `completed_features`. On the first feature (`0`), translate every technical concept to business impact: not "SSR has better SEO" but "Server-side rendering means Google can read your pages." On subsequent features, translate only novel or complex concepts — the user has built vocabulary through previous features. Never re-explain concepts the user has already engaged with.
2. **Explain trade-offs in functional terms.** Not "higher coupling" but "these two pieces depend on each other, so changing one means changing both."
3. **Give the user evaluation criteria — calibrated.** Read `.sdd/state.json` field `completed_features`.
   - `0`: Full evaluation criteria: "When reviewing this plan, focus on three things: (1) Does the data flow match how you described the feature? (2) Are there risks that feel too high for this stage? (3) Is there anything you don't understand? It's better to ask now than to discover a misunderstanding during implementation." Then add: "The more you engage here — catching risks, questioning decisions, suggesting changes — the more I calibrate to your level and move faster in future features."
   - `1`: Brief reminder: "Same three things to check — data flow, risks, and anything unclear."
   - `2+`: Skip the criteria. Just ask: "Does this match what you had in mind?"
4. **Explain what an ADR is** on the user's first feature. Check `.sdd/state.json` field `milestones.adr_explained`. If `false`, explain: "An ADR (Architecture Decision Record) is a short document that records why we chose this approach. It's useful when someone asks 'why was it built this way?' six months from now." Then set `milestones.adr_explained` to `true` in state.json. If already `true`, skip the explanation.

## Step 1: Identify feature and validate state

Parse the feature name from `$ARGUMENTS`. If no argument is provided, use `active_feature`
from state.json. If neither yields a feature name, list all features with their current states
and ask the user which one to plan.

Read `.sdd/state.json`. Check the feature's current state:

- If in state `clarified`: proceed normally.
- If in state `specified`: warn the user — "This feature hasn't been through clarification.
  Running `/sdd:clarify` first is recommended to catch gaps and edge cases. Do you want to
  proceed with planning anyway, or run clarify first?" Proceed only with explicit confirmation.
- If in `drafting`: "This feature is still in drafting state. Run `/sdd:specify {feature-name}` first."
- If in `planned` or beyond: "This feature already has a plan. Re-planning will overwrite the
  existing plan and ADR." Ask for explicit confirmation before continuing.

## Step 2: Read the spec

Read `specs/{feature-name}/spec.md`. This is the full specification including any clarifications added by `/sdd:clarify`. Internalize:

- Functional requirements
- Non-functional requirements
- Acceptance criteria
- Out of scope items
- Clarifications

## Step 3: Read the constitution

Read `constitution.md`. The technical plan must respect every principle defined here. Architecture decisions that conflict with the constitution are not valid options.

## Step 3b: Read project learnings

Read `.sdd/learnings.md` if it exists. Past retro insights — especially those tagged **planning** and **implementation** — should influence architectural decisions and risk assessment. For example, if a past learning says "API integrations are more complex than they appear", factor that into the risk analysis. Do NOT fail if the file doesn't exist.

## Step 4: Generate the technical plan

Based on the spec and constitution, generate a technical plan with these sections:

### Architecture

Describe how the feature fits into the existing codebase. Cover:
- Components or modules involved
- Data flow (where data originates, how it transforms, where it lands)
- Integration points with existing systems
- Patterns to follow (consistent with constitution)

### Dependencies

List everything needed:
- External packages (with version constraints if relevant)
- Internal modules that will be used or extended
- APIs or services consumed
- Database tables or views affected

### Files Affected

List every file that will be created or modified:
- Mark each as `[create]` or `[modify]`
- Group by logical area (e.g., components, API routes, utilities, tests)

### Risks and Trade-offs

Identify what could go wrong and what compromises are being made:
- Technical risks (performance, compatibility, complexity)
- Scope risks (what might grow beyond the spec)
- Trade-offs (speed vs. thoroughness, simplicity vs. flexibility)

## Step 5: Present alternatives (if applicable)

If there are genuinely different architectural approaches to implement this feature:

- Present a maximum of 2-3 options.
- For each option, provide:
  - A short name (e.g., "Option A: Server-side rendering", "Option B: Client-side with API")
  - Pros (bullet list)
  - Cons (bullet list)
  - Constitution compatibility note (any tensions with defined principles)
- **Use AskUserQuestionTool to present the choice.** Each option becomes a selectable choice: short name as label, a one-sentence trade-off summary as description, and the full pros/cons/constitution analysis as markdown preview. This lets the user compare options side by side before deciding. Wait for their answer before proceeding to Step 6.

When presenting options, express each option's pros and cons in functional/business terms alongside technical terms. The user must be able to choose based on product impact, not just technical merit.

If there is only one reasonable approach: state it clearly and explain why alternatives were not viable — be specific. For example: "Your constitution constrains us to [X], and the spec requires [Y], which together point to only one viable approach." This is a teaching moment — the user learns how constraints narrow the decision space. Move directly to Step 6 without asking the user to choose.

## Step 6: Generate the ADR

An ADR (Architecture Decision Record) MUST be generated regardless of whether there were alternatives. Even if the approach is straightforward, document it.

### Determine ADR number

Read the `docs/adr/` directory listing. If the directory doesn't exist, create it. Determine the next ADR number:

- If no ADR files exist: use `001`.
- If ADR files exist (e.g., `001-some-decision.md`, `002-another.md`): use the next sequential number (e.g., `003`).

### Create the ADR file

Create `docs/adr/NNN-{decision-title}.md` where `{decision-title}` is a kebab-case summary of the decision. Use this exact format:

```markdown
# ADR-NNN: {Decision Title}

**Date**: {YYYY-MM-DD}
**Status**: Accepted
**Feature**: {feature-name}

## Context
{Why this decision was needed. Reference the feature spec and the problem it solves.}

## Alternatives Considered
{List each alternative with its pros and cons. If there was only one viable approach, state: "No viable alternatives. The approach described below was the only option consistent with the project's constitution and requirements." and briefly explain why.}

## Decision
{What was decided. If the user chose between options, reference their choice. If there was only one approach, state it directly.}

## Consequences
{Positive and negative impacts of this decision. Be honest about downsides.}
```

## Step 7: Save the plan

Save the plan to `specs/{feature-name}/plan.md` with this exact structure:

```markdown
# Plan: {Feature Name}

## Architecture
{Architecture description from Step 4}

## Dependencies
{Dependencies list from Step 4}

## Files Affected
{File list with [create]/[modify] annotations from Step 4}

## Risks and Trade-offs
{Risk analysis from Step 4}

## Decision
See docs/adr/NNN-{decision-title}.md
```

## Step 8: Update state.json

Read `.sdd/state.json` again (to avoid stale data). Update it:

- Validate the transition: check `allowed_transitions` in state.json to confirm that the feature's current state allows transitioning to `"planned"`. If the transition is not listed, warn the user and do not proceed.
- Set `features.{feature-name}.state` to `"planned"`.
- Append a new transition record:

```json
{
  "from": "{previous state — 'specified' or 'clarified'}",
  "to": "planned",
  "at": "{ISO 8601 timestamp}",
  "command": "sdd-plan"
}
```

- Keep `active_feature` set to the feature name.

Write the updated state.json.

## Step 9: Present the plan

Display the complete plan.md content and the ADR to the user for review.

After presenting the plan, provide a plain-language summary: "In short, here's what we're going to build and why: [2-3 sentences translating the architecture into business terms]. The main trade-off is [trade-off in plain language]. Does this feel right for what you described?"

After presenting them, stop and wait for the user's feedback.

**Coaching_profile update:** If the user provides substantive feedback on the plan (catches a risk, questions a trade-off, identifies a data flow issue), increment `unscaffolded` for the relevant category in `.sdd/state.json` coaching_profile — **capped at one per category per session**. If the user accepts without engagement, do not increment either counter — passive acceptance is neutral. Update state.json alongside the Step 8 state transition.

## Restrictions

- Do NOT suggest `/sdd:tasks`. Present the plan and wait for confirmation.
- Context budget: Read ONLY `specs/{feature-name}/spec.md`, `constitution.md`, and `.sdd/state.json`. Do NOT read source code files. Source code analysis belongs to the tasks phase, not the planning phase.
- An ADR MUST always be generated, even if there is only one viable approach. If the feature is small enough that no meaningful architectural decisions are needed, generate a minimal ADR documenting the straightforward approach chosen.
- If alternatives exist, present a maximum of 2-3 options. Do not overwhelm with choices.
- The plan describes HOW to build the feature, but does NOT decompose it into tasks. Task decomposition is the responsibility of `/sdd:tasks`.
- Do NOT implement anything. This command produces documents only.

$ARGUMENTS
