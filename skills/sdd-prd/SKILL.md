---
name: sdd-prd
description: >
  Generate a Product Requirements Document (PRD) as the foundation for Specification-Driven Development.
  Use when starting a new product, defining a new product vision, or when the user says "create PRD",
  "generate PRD", "product requirements", "define the product", "documento madre", or references
  needing a high-level product definition before writing feature specs. This is the first step
  in the SDD workflow — the PRD feeds context to all downstream /sdd:specify commands.
  Always use this skill before /sdd:specify when no PRD exists yet.
disable-model-invocation: true
---

# SDD PRD — Product Requirements Document Generator

The PRD is the strategic foundation of the SDD workflow. It defines WHAT you're building and WHY, without going into implementation details. Every feature spec (`/sdd:specify`) inherits context from the PRD.

## Philosophy

The PRD is not a technical document. It's a product document. No stack decisions, no data models, no API endpoints. Those belong in the feature specs. The PRD answers three questions: What problem are we solving? For whom? What does success look like?

## Workflow

### Step 1: Discovery Interview

Before writing anything, conduct a focused interview. Ask questions ONE AT A TIME (never batch). Wait for confirmation before moving to the next question.

**Required questions (ask in this order):**

1. "What problem does this product solve? Describe the pain point as it exists today."
2. "Who experiences this problem? Be specific: role, context, frequency."
3. "What does the world look like if this product works perfectly? What changes?"
4. "What are the main functional areas or modules you envision? Don't worry about details, just the big blocks."
5. "Is there anything this product should explicitly NOT do? Boundaries help as much as features."

**Conditional questions (ask only if relevant):**

- If B2B: "Who is the buyer vs. the user? Are they the same person?"
- If platform/marketplace: "Which side of the marketplace do you build for first?"
- If existing product: "What exists today that this replaces or extends?"

Do NOT proceed to Step 2 until the user has answered all required questions and confirmed they're ready.

### Step 2: Generate the PRD

Create the PRD as a Markdown file following this exact structure. Save to `specs/prd.md` (or `specs/PRD.md` if the user prefers).

```markdown
# [Product Name] — Product Requirements Document

**Version:** 1.0
**Date:** [YYYY-MM-DD]
**Author:** [name]
**Status:** Draft | Review | Approved

---

## 1. Context & Problem Statement

[2-3 paragraphs in narrative form. Describe the current situation, the pain point,
and why it matters. Include quantitative impact if available. This section should
make anyone — technical or not — understand why this product needs to exist.]

## 2. Vision & Success Criteria

[1 paragraph describing the desired end state. Then 3-5 measurable success criteria
written as outcomes, not features. Example: "Reduce average first-contact time
from 4 hours to 15 minutes" NOT "Build a notification system".]

## 3. Target Users & Personas

[For each persona: role, context, primary need, and how they interact with the product.
Keep it to 2-4 personas maximum. If buyer ≠ user, make that explicit.]

### Persona 1: [Role Name]
- **Context:** [When and where they encounter the problem]
- **Primary need:** [What they need from this product]
- **Current workaround:** [How they solve it today without this product]

### Persona 2: [Role Name]
[Same structure]

## 4. Product Modules

[High-level map of the main functional areas. Each module gets a short paragraph
explaining what it does and how it relates to other modules. No technical details.
Think of this as the table of contents for future feature specs.]

### Module: [Name]
[What this module does from the user's perspective. 2-3 sentences max.]

### Module: [Name]
[Same structure]

## 5. Scope & Non-Goals

### In Scope
[What this product WILL do in its first version. Be specific enough to prevent
scope creep but not so detailed that it becomes a feature spec.]

### Non-Goals (Explicit)
[What this product will NOT do. Each non-goal should explain WHY it's excluded.
This is one of the most valuable sections — it prevents misaligned expectations.]

## 6. Assumptions & Risks

### Assumptions
[Things you're taking as true that, if wrong, would change the product direction.
Example: "We assume leads provide a valid phone number in 80%+ of cases."]

### Risks
[Things that could go wrong. For each risk, note the impact (high/medium/low)
and whether there's a mitigation strategy.]

## 7. Open Questions

[Things not yet decided that need resolution before certain features can be specified.
Each question should have an owner and a target date for resolution.]

- [ ] [Question] — Owner: [name] — By: [date]
```

### Step 3: Review & Confirm

After generating the PRD, present it to the user and ask:

1. "Does the problem statement capture the real pain accurately?"
2. "Are the success criteria measurable and aligned with what matters to you?"
3. "Are the non-goals correct? Is there anything listed in scope that shouldn't be, or vice versa?"

Do NOT mark the PRD as "Approved" until the user explicitly confirms. Leave status as "Draft" or "Review".

## Integration with SDD Workflow

Once the PRD is approved:
- Update `.sdd/state.json` to register the PRD exists: `"prd": { "status": "approved", "path": "specs/prd.md" }`
- When the user runs `/sdd:specify` for any feature, Claude should read the PRD first to inherit context
- The PRD's modules map directly to potential `/sdd:specify` targets

## Rules

1. **Never include technical decisions** in the PRD. No stack, no architecture, no data models. If the user starts going there, acknowledge it and note it for the future spec, but keep the PRD clean.
2. **One question at a time.** Never batch questions. Wait for the answer before asking the next one.
3. **Narrative over bullets.** The PRD should read like a document a non-technical stakeholder can understand and approve.
4. **Non-goals are mandatory.** A PRD without non-goals is incomplete. Push the user to define boundaries.
5. **Success criteria must be measurable.** If a criterion can't be measured, rewrite it until it can or flag it as an open question.
6. **Respect the user's domain expertise.** Claude provides structure and identifies gaps; the user provides business context and decisions.
