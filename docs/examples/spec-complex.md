# Lead Scoring Engine — Specification

**Version:** 1.0
**Date:** 2025-10-20
**Status:** Clarified
**PRD Reference:** specs/prd.md (Module: Lead Intelligence)
**Constitution:** Confirmed compliant

---

## 1. Metadata

| Field | Value |
|-------|-------|
| Feature | lead-scoring |
| Author | Carmen Vega |
| Version | 1.0 |
| Status | Clarified |
| Created | 2025-10-20 |
| Last updated | 2025-10-28 |

## 2. Context

The commercial team currently qualifies leads manually by reviewing CRM data, email engagement, and form submissions. This takes approximately 2 hours per day per sales rep, and the criteria vary between reps — what one rep considers "hot" another might ignore.

This inconsistency means high-value leads sometimes wait hours for contact while low-probability leads get immediate attention. The business impact: an estimated 15% of qualified leads go cold before first contact because they weren't prioritized correctly.

<!-- LEARNING NOTE: Context quantifies the problem with real numbers (2 hours/day, 15% leads going cold). Vague context like "the team needs better lead scoring" doesn't help the implementer understand WHY this matters or HOW to measure success. -->

The scoring engine automates lead qualification using a weighted formula based on demographic fit, behavioral signals, and engagement recency. It replaces manual assessment with a consistent, configurable scoring model that the team can tune without developer intervention.

## 3. Goals & Non-Goals

### Goals
1. Reduce average time from lead creation to first sales contact from 4 hours to under 30 minutes for hot leads (score >= 75).
2. Achieve 80%+ agreement between the scoring engine's "hot" classification and the sales team's manual assessment over the first month.
3. Enable the sales operations team to modify scoring weights and thresholds without code changes or deployments.

### Non-Goals
1. Machine learning or predictive modeling — Why: current volume (500 leads/week) doesn't justify ML complexity. A weighted formula is sufficient and more transparent. Revisit when volume exceeds 5,000/week.
2. Lead nurturing automation — Why: scoring determines priority, not actions. Nurturing workflows are a separate feature with different stakeholders.
3. Real-time scoring on page view events — Why: scoring triggers on form submissions and CRM updates only. Page-level tracking is a different data pipeline.

<!-- LEARNING NOTE: Non-goal #1 shows HOW to write a good non-goal: it explains the boundary, gives the reason, AND defines when to revisit the decision. This prevents the same discussion from recurring every sprint. -->

## 4. User Stories

### Actor: Sales Representative
**Story:** As a sales rep, I see a prioritized lead queue so I contact the highest-potential leads first without manually reviewing every record.
**Acceptance criteria:**
- Given I open the lead dashboard, when new leads have been scored, then they appear sorted by score (highest first) with a visual tier indicator (hot/warm/cold).
- Given a lead's score changes from warm to hot, when I have the dashboard open, then the lead moves to the top of my queue within 60 seconds.

### Actor: Sales Operations Manager
**Story:** As a sales ops manager, I adjust scoring weights and tier thresholds so the model reflects our evolving qualification criteria.
**Acceptance criteria:**
- Given I access the scoring configuration panel, when I change the "budget declared" weight from 20 to 30, then all new leads are scored with the updated weight immediately.
- Given I change the hot threshold from 75 to 80, when existing leads are re-scored, then tier assignments update within 5 minutes.

### Actor: Sales Team Lead
**Story:** As a team lead, I review scoring accuracy weekly to ensure the model is working correctly.
**Acceptance criteria:**
- Given I access the scoring report, when I select a date range, then I see the distribution of leads by tier and the conversion rate per tier.

## 5. Functional Requirements

- **FR-001:** Score calculation uses a weighted formula: `score = Σ(factor_weight × factor_value)` where factors include demographic fit, behavioral signals, and engagement recency.
- **FR-002:** Leads are classified into three tiers based on configurable thresholds: Hot (>= hot_threshold), Warm (>= warm_threshold and < hot_threshold), Cold (< warm_threshold).
- **FR-003:** Scoring weights and thresholds are stored in a configuration table, editable via an admin API without deployment.
- **FR-004:** Scores recalculate when any input factor changes (CRM field update, form submission, email engagement event).
- **FR-005:** Score changes that cross a tier boundary trigger a notification to the assigned sales rep.
- **FR-006:** The scoring report endpoint returns lead distribution by tier and conversion rates for a given date range.
- **FR-007:** All score calculations are logged with input factors, weights used, and final score for auditability.

## 6. Non-Functional Requirements

- **NFR-001:** Score calculation P95 latency < 200ms per lead.
- **NFR-002:** Batch re-scoring (when weights change) must complete within 5 minutes for up to 10,000 active leads.
- **NFR-003:** Score history retained for 12 months for audit and accuracy analysis.
- **NFR-004:** Configuration changes are audit-logged with who changed what and when.
- **NFR-005:** The scoring endpoint must handle 50 concurrent scoring requests without degradation.

<!-- LEARNING NOTE: Compare NFR-001 ("P95 latency < 200ms") with a vague version like "must be fast." The quantified version tells the implementer exactly what to optimize for and gives the test a pass/fail threshold. Every NFR should answer: "How would I write a test that checks this?" -->

## 7. Technical Design

### Stack
- Runtime: Node.js 20 (LTS)
- Database: PostgreSQL 15 via Prisma ORM
- Queue: BullMQ for async re-scoring jobs
- Cache: Redis for hot score lookups

### Architecture
```
[CRM/Form Events] → [Event Handler] → [Scoring Service] → [Score DB]
                                              ↓
                                    [Notification Service] → [Sales Rep]
                                              ↓
                                    [Score Cache (Redis)] → [Dashboard API]
```

### Decisions & Rationale

**Decision:** Weighted formula instead of ML model.
**Context:** Team requested "AI-powered scoring."
**Rationale:** At 500 leads/week, a weighted formula is transparent, tunable by non-engineers, and delivers equivalent accuracy. ML requires training data we don't have yet. The formula approach lets us collect labeled data (rep feedback on scores) for a future ML migration.
**Consequences:** Scoring logic is simpler to maintain; may need migration path to ML if volume grows 10x.

**Decision:** Store scores in PostgreSQL, cache in Redis.
**Context:** Dashboard needs sub-100ms reads; scoring writes can be async.
**Rationale:** PostgreSQL provides durability and query flexibility for reports. Redis provides the read speed the dashboard needs. Prisma is already approved in the constitution.
**Consequences:** Two data stores to maintain consistency between. Cache invalidation on score update is critical.

## 8. Data Models

### Entity: Lead
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | uuid | yes | Primary key |
| email | string | yes | Lead's email address |
| company_size | enum(small, medium, large, enterprise) | no | Demographic factor |
| budget_declared | integer | no | Budget in USD, self-reported |
| source | string | yes | How the lead arrived (organic, paid, referral) |
| assigned_rep_id | uuid | no | Sales rep assigned to this lead |
| created_at | timestamp | yes | When the lead entered the system |

### Entity: LeadScore
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | uuid | yes | Primary key |
| lead_id | uuid | yes | FK to Lead |
| score | integer | yes | Calculated score (0-100) |
| tier | enum(hot, warm, cold) | yes | Derived from score and thresholds |
| factors | jsonb | yes | Snapshot of input factors and weights used |
| calculated_at | timestamp | yes | When this score was computed |

### Entity: ScoringConfig
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | uuid | yes | Primary key |
| factor_name | string | yes | Name of the scoring factor |
| weight | decimal | yes | Weight multiplied by factor value |
| hot_threshold | integer | yes | Score >= this = hot tier |
| warm_threshold | integer | yes | Score >= this = warm tier |
| updated_by | uuid | yes | Who last changed this config |
| updated_at | timestamp | yes | When it was last changed |

### Relationships
- Lead 1:N LeadScore (a lead has a score history)
- ScoringConfig is a global singleton table (one row per factor)

## 9. API Contracts

### `POST /leads/{id}/score`
**Purpose:** Trigger score calculation for a specific lead.

**Request:** No body — lead data is read from the database.

**Response (200):**
```json
{
  "lead_id": "uuid",
  "score": 82,
  "tier": "hot",
  "factors": {
    "company_size": { "value": 3, "weight": 15, "contribution": 45 },
    "budget_declared": { "value": 1, "weight": 20, "contribution": 20 },
    "engagement_recency": { "value": 0.85, "weight": 20, "contribution": 17 }
  },
  "calculated_at": "2025-10-20T14:30:00Z"
}
```

**Error codes:**
| Code | Meaning |
|------|---------|
| 404 | Lead ID not found |
| 422 | Lead has insufficient data for scoring (missing all optional factors) |

### `GET /scoring/config`
**Purpose:** Retrieve current scoring weights and thresholds.

**Response (200):**
```json
{
  "factors": [
    { "name": "company_size", "weight": 15 },
    { "name": "budget_declared", "weight": 20 },
    { "name": "engagement_recency", "weight": 20 }
  ],
  "thresholds": { "hot": 75, "warm": 40 }
}
```

### `PUT /scoring/config`
**Purpose:** Update scoring weights and/or thresholds. Triggers async re-scoring of all active leads.

**Request:**
```json
{
  "factors": [
    { "name": "company_size", "weight": 25 }
  ],
  "thresholds": { "hot": 80 }
}
```

**Response (200):**
```json
{
  "updated": true,
  "rescore_job_id": "uuid — ID of the background re-scoring job",
  "estimated_completion": "2025-10-20T14:35:00Z"
}
```

<!-- LEARNING NOTE: The API contract defines the exact shape of requests and responses — not just "it returns the score." Notice how the scoring response includes the factor breakdown (contribution per factor). This was a design decision: it makes the score transparent and debuggable. Without it, sales reps would see a number they can't explain. -->

**Error codes:**
| Code | Meaning |
|------|---------|
| 400 | Invalid weight (negative or > 100) or invalid threshold |
| 403 | User does not have scoring admin permissions |

### `GET /scoring/report`
**Purpose:** Retrieve lead distribution and conversion rates by tier for a date range.

**Request params:** `?from=2025-10-01&to=2025-10-31`

**Response (200):**
```json
{
  "period": { "from": "2025-10-01", "to": "2025-10-31" },
  "distribution": { "hot": 45, "warm": 180, "cold": 275 },
  "conversion_rates": { "hot": 0.42, "warm": 0.12, "cold": 0.03 }
}
```

## 10. Edge Cases & Error Handling

| ID | Scenario | Expected Behavior |
|----|----------|-------------------|
| EC-001 | Lead has no optional factors filled (no company size, no budget, no engagement) | Return score of 0, tier "cold". Do not fail — a cold score is still a valid score. Log a warning for the sales ops team. |
| EC-002 | Scoring weights are changed while a batch re-score is already in progress | Queue the new re-score job to start after the current one completes. Do not cancel the in-progress job — partial re-scoring with old weights is better than no scores. |
| EC-003 | Two CRM events arrive for the same lead within 1 second | Deduplicate by lead_id with a 2-second debounce window. Only the most recent event triggers scoring. |
| EC-004 | Redis cache is unavailable | Fall back to PostgreSQL direct reads. Dashboard will be slower (200ms → ~500ms) but functional. Log the cache miss for monitoring. |
| EC-005 | Config update sets hot_threshold lower than warm_threshold | Reject with 400 error: "Hot threshold must be greater than warm threshold." |
| EC-006 | Score calculation produces a value outside 0-100 range | Clamp to 0-100. Log an alert — this indicates a weight configuration error. |

<!-- LEARNING NOTE: This spec has 6 edge cases covering different failure modes: missing data (EC-001), race conditions (EC-002, EC-003), infrastructure failure (EC-004), invalid configuration (EC-005), and arithmetic overflow (EC-006). A simpler feature might need only 3, but a scoring engine touches many systems. The rule of thumb: if you can imagine a support ticket about it, it needs an edge case. -->

## 11. Open Questions

- [ ] Should score history be visible to the lead's assigned rep, or only to sales ops? — Owner: Product — By: 2025-10-30
- [ ] What engagement signals should be included in v1? (email opens, link clicks, form submissions, page visits) — Owner: Carmen — By: 2025-10-25
- [ ] Should the re-score job notify the admin when it completes, or is the job ID sufficient for polling? — Owner: Engineering — By: 2025-10-27

## Clarifications

<!-- Added by /sdd:clarify. Do not edit manually. -->

### C-1: Budget declared source
**Type:** ambiguity
**Q:** Where does "budget declared" come from? Is it a CRM field, a form input, or derived?
**A:** It's a field in the lead intake form. Free-text number field, stored as integer in the CRM.
**Pattern tip:** When referencing data in scoring or calculations, always specify the source system and data type — "budget" could mean five different things in five different databases.

### C-2: Notification channel for tier changes
**Type:** assumption
**Q:** FR-005 says "trigger a notification" when a tier boundary is crossed. What channel — email, in-app, push, Slack?
**A:** In-app notification for v1. We'll add Slack integration later as a separate feature.
**Pattern tip:** "Send a notification" is ambiguous — always specify the channel, because each channel has different latency, reliability, and permission requirements.

### C-3: Concurrent config editors
**Type:** edge case
**Q:** What happens if two sales ops managers update scoring config simultaneously?
**A:** Last write wins. We don't need optimistic locking for v1 — there are only 2 people with config access.
**Pattern tip:** For shared configuration, always decide on a concurrency strategy — even if the answer is "last write wins," making it explicit prevents confusion during implementation.
