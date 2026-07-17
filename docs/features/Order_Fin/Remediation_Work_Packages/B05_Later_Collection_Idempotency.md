# B05 — Later Collection Idempotency

## Metadata
Backlog ID: B5 · Severity: HIGH · Classification: BLOCKS_PRODUCTION · Status: NOT_STARTED
Authoritative report sections: H5, §16, §32, §50-B5
Required decisions: [D010](00_Phase_0_Financial_Semantics/D010_Financial_Idempotency_And_Lineage.md)
Dependencies: [B04](B04_Later_Collection_BVM_Parity.md) (hard — same code path)
Blocks: — · Recommended phase: Seq 4 (immediately after B4)

## Confirmed problem
Collect payment inserts carry no idempotency guard; the route key is optional; a client retry duplicates payment rows and drawer movements (H5).

## Current evidence
| File or symbol | Current behavior | Gap |
|---|---|---|
| order-settlement.service.ts:640 | key defaults to random UUID; guards only pos-link/disposition | payment create unguarded |
| collect-payment/route.ts:20 (+ dup payments route) | `idempotencyKey` optional | must be required |

## Required outcome
Required client key on both collect routes; per-leg deterministic sub-keys (`{key}_leg_{i}` grammar per D010) with skip-on-existing; same-key-different-payload → 409; retries yield zero new financial effects.

## Scope
Route schema tightening; keyed leg creation inside the B4 voucher path; conflict handling; DB backstop unique index assessment.

## Out of scope
Voucher path itself (B4); submit-path keys (already strong).

## Financial effects
| Area | Impact |
|---|---|
| Commercial total | NO |
| Payment facts | YES (dup prevention) |
| Credit applications | NO |
| BVM | YES (keyed lines — B4 pattern) |
| Cash drawer | YES (dup prevention) |
| Gateway or bank | NO |
| Tax documents | NO |
| ERP-Lite GL | NO |
| Snapshot | YES (no dup paid) |
| Reconciliation | YES |
| Customer receipt | NO |
| Audit/outbox | NO |

## Acceptance criteria
Duplicate-retry test creates exactly one payment/drawer/voucher set; missing key → 400; changed payload on same key → 409.

## Required tests
API, idempotency, concurrency, database (unique backstop), regression.

## Dependencies and sequencing
Hard after B4; ships in the same wave.

## Delivery surfaces

Backend services: keyed leg creation inside the B4 voucher path (skip-on-existing per D010)
Database/schema: sparse unique index on collection idempotency keys (backstop) — assess at migration time
API/endpoints: both collect routes — `idempotencyKey` required (400 when missing; 409 on same-key/different-payload)
Frontend page/screen/dialog/action: collect-payment modal — generates a per-attempt key (existing pattern per F-10 note), disables submit while in flight, and maps 409 conflict to a clear retry message
Reusable components/helpers: shared idempotency utilities (lib/utils/idempotency) extended for per-leg sub-keys
Permissions: unchanged
Validation: key format/length; payload-hash comparison
i18n/RTL: EN/AR messages for IDEMPOTENCY_CONFLICT and retry guidance
Accessibility: submit-state announced (aria-busy) during in-flight collection
Audit trail: replay returns original result — no duplicate outbox emissions
Observability: duplicate-attempt counter in logs
Jobs/workers: none
Feature flag: none (contract tightening with B4 flag)
Rollout: ships in the B4 wave; client updated first (sends key), then server requires it
Rollback: relax requirement to optional (server), keep skip-on-existing

## End-to-end operational flow

1. Modal generates the attempt key at open; user submits; double-click or network retry re-sends the same key.
2. Server replays: exactly one payment/voucher/drawer set exists; UI shows the original success.
3. Changed payload on the same key → 409 with an explicit "refresh amounts" message.

## Completion evidence
Migration: — · Implementation files: — · Tests: — · Commit: — · Preview QA (deploy/result/approval): — · Reviewer: — · Verification: — · Authoritative report update: —
