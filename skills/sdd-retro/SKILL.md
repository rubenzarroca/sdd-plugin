---
name: sdd-retro
description: "Post-feature retrospective that summarizes what the user learned during a feature's lifecycle. Use when the user says 'retro', 'retrospective', 'what did I learn', 'debrief', or wants to reflect on a completed feature. Completely optional — never suggested automatically, never blocks any workflow step."
argument-hint: "[feature-name]"
user-invokable: true
---

# /sdd:retro — Post-feature retrospective

You are running a quick, conversational debrief after a feature is completed. This is entirely opt-in — the user chose to be here. Keep it light, useful, and short. No academic tone, no grading. Think of it as a 2-minute coffee chat about what just happened.

## Step 1: Identify feature

Parse the feature name from `$ARGUMENTS`. If no argument is provided, read `.sdd/state.json` and look for features in `completed` state. If there is exactly one completed feature, use it. If there are multiple, list them and ask the user which one to reflect on.

If no features are in `completed` state, say: "No completed features found. Retro works best after finishing a feature — come back after `/sdd:validate` marks one as completed." Then stop.

## Step 2: Read state

Read `.sdd/state.json`. Extract for the selected feature:

1. **Transitions array**: the full sequence of state changes with timestamps and commands.
2. **Coaching profile**: the current `coaching_profile` object (global, not per-feature).
3. **Completed features count**: `completed_features` value.

Do NOT read specs, plans, tasks, or source code. Only state.json.

## Step 3: Analyze the journey

From the transitions, determine:

- **Duration**: time from the first transition (`drafting → specified`) to the last (`validating → completed`).
- **Path taken**: did the feature go straight through, or were there backward transitions (e.g., `implementing → tasked`, `specified → drafting`)? Backward transitions are learning moments, not failures.
- **Number of tasks**: count task entries in the feature's `tasks` object.

From the coaching profile, identify:

- **Categories where `scaffolded` increased during this feature's lifecycle**: these are areas where Claude had to help.
- **Categories where `unscaffolded` increased**: these are areas where the user showed independent competence.
- **Strongest category**: highest `unscaffolded` relative to `scaffolded`.
- **Growth area**: highest `scaffolded` relative to `unscaffolded`.

If this is `completed_features >= 2`, also compare the overall trajectory: "Over N features, your profile has shifted from [early pattern] to [current pattern]."

## Step 4: Present the summary

Write a conversational summary of 3-5 lines. Structure:

1. **What happened** (1 line): the feature's journey in plain terms.
2. **What grew** (1-2 lines): where the user showed strength or improvement.
3. **What's next to grow** (1 line): the area with the most room, framed as opportunity, not criticism.

Example tone (do NOT copy verbatim — adapt to the actual data):

> "This feature took about 3 days from spec to completion, with 8 tasks. You went back from implementing to re-plan once — that's not a setback, that's catching a problem before it became expensive. Your edge case coverage has been solid since the spec phase — no coaching needed there. The area where I helped most was quantifying NFRs — next time, try setting your own thresholds before I suggest them."

**Rules for the summary:**
- No scores, no grades, no percentages.
- No "great job!" or "well done!" — just observations.
- Backward transitions are described neutrally or positively ("caught a problem early"), never as failures.
- If the coaching profile shows no scaffolding was needed in any category, say so plainly: "I didn't need to coach you on anything in this feature. Your specs are getting self-sufficient."

## Step 5: Ask exactly 2 reflective questions

Ask two questions, one at a time. Wait for the answer to the first before asking the second.

**Question 1** — always about surprise or friction:
- "Was there anything during this feature that surprised you — something that worked differently than you expected, or a step that felt harder than it should have been?"

**Question 2** — always about the next feature:
- "If you were starting a similar feature tomorrow, what would you do differently in the spec or planning phase?"

These are genuine questions — listen to the answers. Do NOT coach or correct. The user is reflecting, not being evaluated.

## Step 6: Save retro

Save the retrospective to `specs/{feature-name}/retro.md` using this format:

```markdown
# Retro: {Feature Name}

**Date:** {YYYY-MM-DD}
**Feature:** {feature-name}
**Duration:** {time from first to last transition}
**Tasks:** {N} completed
**Path:** {straight-through | had N backward transitions}

## Summary

{The 3-5 line summary from Step 4}

## Reflections

**What surprised you or felt harder than expected?**
{User's answer to Question 1}

**What would you do differently next time?**
{User's answer to Question 2}
```

Confirm to the user: "Retro saved to `specs/{feature-name}/retro.md`."

## Step 7: Extract learnings to project memory

After saving the retro, synthesize actionable insights and append them to `.sdd/learnings.md`. This file is the project's long-term memory — read by `/sdd:specify`, `/sdd:clarify`, `/sdd:plan`, and `/sdd:tasks` to avoid repeating mistakes across features.

### What to extract

From the retro summary and the user's reflective answers, distill 2-5 concrete, actionable learnings. Each learning must be specific enough that a future skill invocation can act on it. Categorize by the SDD phase it applies to:

- **spec**: insights about spec writing (e.g., "Define error messages in the spec, not during implementation")
- **planning**: insights about technical design (e.g., "API integrations in this project are more complex than they appear — plan for error handling")
- **implementation**: insights about coding patterns (e.g., "The ORM doesn't support X natively — use Y pattern instead")
- **process**: insights about the SDD workflow itself (e.g., "Features touching the database need clarify before plan — too many assumptions otherwise")

### Meta-observation

Add one meta-observation about the project's SDD trajectory — a pattern that spans multiple features, or a shift in how the project is evolving. Examples:
- "Specs are getting tighter — edge case coverage no longer needs coaching."
- "This project's complexity is in integrations, not business logic. Plans should weight API contracts higher."
- "The user catches architectural issues early now — the plan phase moves faster."

If `completed_features <= 1` (first retro), skip the meta-observation — not enough data yet.

### Format

Append to `.sdd/learnings.md` (create the file with a header if it doesn't exist). Use this format:

```markdown
## {feature-name} ({YYYY-MM-DD})

### Learnings
- **[phase]**: {actionable insight}
- **[phase]**: {actionable insight}

### Meta
{Meta-observation, or omit this section if first retro}
```

If the file doesn't exist yet, create it with this header before appending:

```markdown
# Project Learnings

Accumulated insights from feature retrospectives. Read by /sdd:specify, /sdd:clarify, /sdd:plan, and /sdd:tasks to inform future work.

---
```

Do NOT overwrite existing content — always append. The file grows with each retro.

Then stop. Do NOT suggest any next command.

## Restrictions

- Do NOT modify `.sdd/state.json`. Retro is read-only on state. The only file retro writes (besides `retro.md`) is `.sdd/learnings.md`.
- Do NOT read specs, plans, tasks, code, or constitution. Only state.json and `.sdd/learnings.md` (to append).
- Do NOT auto-suggest this command from any other skill. It is purely user-initiated.
- Do NOT ask more than 2 reflective questions. Exactly 2.
- Do NOT grade, score, or rank the user's performance. Observations only.
- Do NOT coach during the retro. If the user's answers reveal a gap, note it internally but do not intervene. This is their reflection space.

$ARGUMENTS
