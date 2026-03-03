# Webhook Notification — Specification

**Version:** 1.0
**Date:** 2025-11-15
**Status:** Clarified
**PRD Reference:** specs/prd.md (Module: Notifications)
**Constitution:** Confirmed compliant

---

## 1. Metadata

| Field | Value |
|-------|-------|
| Feature | webhook-notification |
| Author | Alex Rivera |
| Version | 1.0 |
| Status | Clarified |
| Created | 2025-11-15 |
| Last updated | 2025-11-18 |

## 2. Context

The platform currently sends email notifications when key events occur (new order, payment received, shipment dispatched). Several integration partners have requested programmatic notifications so their systems can react in real time without polling the API.

<!-- LEARNING NOTE: Context explains the PROBLEM (partners polling the API) before the SOLUTION (webhooks). This grounds the feature in a real pain point, not just a technical capability. -->

This feature adds outbound webhook support: when a configured event fires, the system sends an HTTP POST to a user-registered URL with a signed JSON payload.

## 3. Goals & Non-Goals

### Goals
1. Partners receive event notifications within 5 seconds of the event occurring.
2. Webhook delivery achieves 99.5% success rate over a 30-day rolling window.
3. Partners can self-register webhook URLs without contacting support.

### Non-Goals
1. Inbound webhooks (receiving data from partners) — Why: different security model, separate feature.
2. Webhook transformation or filtering — Why: MVP ships all event data; filtering adds complexity without validated demand.

## 4. User Stories

### Actor: Integration Partner
**Story:** As an integration partner, I register a webhook URL so my system automatically processes new orders without polling.
**Acceptance criteria:**
- Given a valid HTTPS URL, when I submit it via the API, then it is saved and a test ping is sent.
- Given a registered webhook, when an order.created event fires, then my URL receives a POST within 5 seconds.

## 5. Functional Requirements

- **FR-001:** System accepts webhook URL registration via `POST /webhooks` with URL and event list.
- **FR-002:** All webhook payloads include an HMAC-SHA256 signature in the `X-Signature-256` header.
- **FR-003:** Failed deliveries retry 3 times with exponential backoff (10s, 60s, 300s).
- **FR-004:** Users can list, update, and delete their registered webhooks via REST endpoints.

<!-- LEARNING NOTE: Each FR has an ID (FR-001) and is specific enough to write a test for. "Support webhooks" is NOT a functional requirement — it's a wish. FR-001 through FR-004 are testable. -->

## 6. Non-Functional Requirements

- **NFR-001:** Webhook delivery latency P95 < 5 seconds from event trigger to first HTTP request sent.
- **NFR-002:** Webhook processing must not block the main event pipeline — use async queue.
- **NFR-003:** Signature verification must use constant-time comparison to prevent timing attacks.

## 7. Technical Design

### Stack
- Queue: BullMQ (already in allowed dependencies)
- HTTP client: native fetch (Node 18+)

### Decisions & Rationale
**Decision:** Use a job queue instead of synchronous HTTP calls.
**Context:** Webhooks must not slow down the event pipeline.
**Rationale:** BullMQ is already approved and handles retries natively.
**Consequences:** Adds queue infrastructure dependency; delivery is eventually consistent, not synchronous.

## 8. Data Models

### Entity: Webhook
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | uuid | yes | Primary key |
| user_id | uuid | yes | Owner of the webhook |
| url | string | yes | HTTPS endpoint to deliver to |
| events | string[] | yes | List of event types to subscribe to |
| secret | string | yes | Shared secret for HMAC signing |
| active | boolean | yes | Whether the webhook is enabled |
| created_at | timestamp | yes | Registration time |

## 9. API Contracts

### `POST /webhooks`
**Purpose:** Register a new webhook.

**Request:**
```json
{
  "url": "string — HTTPS URL to receive events",
  "events": ["string — event types to subscribe to"]
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "url": "string",
  "events": ["string"],
  "secret": "string — display only on creation",
  "active": true
}
```

**Error codes:**
| Code | Meaning |
|------|---------|
| 400 | Invalid URL format or empty events list |
| 409 | URL already registered for this user |

## 10. Edge Cases & Error Handling

| ID | Scenario | Expected Behavior |
|----|----------|-------------------|
| EC-001 | Target URL returns 5xx on all 3 retries | Mark webhook as `failing`, notify user via email, stop retrying until manually re-enabled |
| EC-002 | Target URL responds but takes > 30 seconds | Timeout after 30s, count as failed delivery, trigger retry |
| EC-003 | User deletes webhook while deliveries are queued | Cancel pending jobs for that webhook, do not deliver |

<!-- LEARNING NOTE: Edge cases define what happens when things go WRONG, not when they go right. Each one has an explicit expected behavior — never leave it to the implementer to guess. EC-001 is the most critical: without it, a broken webhook would retry forever. -->

## 11. Open Questions

- [ ] Should we support webhook event filtering by resource ID? — Owner: Alex — By: 2025-11-25
- [ ] Maximum number of webhooks per user? — Owner: Product — By: 2025-11-22

## Clarifications

<!-- Added by /sdd:clarify. Do not edit manually. -->

### C-1: Retry exhaustion behavior
**Type:** edge case
**Q:** What happens after all 3 retries fail?
**A:** Mark the webhook as "failing" and send the user an email. Don't disable it permanently — let them fix the URL and re-enable.
**Pattern tip:** When designing retry mechanisms, always define the terminal state — what happens when retries run out.
