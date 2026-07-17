# B28 — Financial Regression Test Coverage

## Metadata
Backlog ID: B28 · Severity: HIGH · Classification: CONTROL_GAP · Status: NOT_STARTED
Authoritative report sections: §49 (Tests column), §50-B28
Required decisions: none
Dependencies: B1–B5 (test — grows per wave; every wave contributes its slice) · Blocks: —
Recommended phase: continuous

## Confirmed problem
§49 shows `none`/`partial` test coverage on every NOT_READY scenario: refund-outstanding, collect retry, amendments after payment, cancellation variants, D9 PENDING flows, concurrent payment/refund — the flows most likely to corrupt money are the least tested.

## Current evidence
| File or symbol | Current behavior | Gap |
|---|---|---|
| __tests__ (jest ~1600) | strong on calc/classify/submit | scenario matrix holes per §49 |
| §49 rows marked none | increase/decrease after payment, collect dup retry, chargeback, closed-period | zero coverage |

## Required outcome
A scenario-matrix regression suite mirroring §49 rows: each implemented row gets formula assertion, fact-row assertion, BVM parity, snapshot==recon equality (post-B2), duplicate-retry and concurrency variants; suite gates every remediation wave's VERIFIED status.

## Scope
Suite skeleton + fixtures library (tenants, currencies, tax modes, methods); per-wave additions owned by each Bxx but landed under this umbrella's structure; CI wiring.

## Out of scope
Implementing the flows (respective packages); manual QA scripts.

## Financial effects
| Area | Impact |
|---|---|
| All areas | NO (test-only) — protects every YES elsewhere |

## Acceptance criteria
Every §49 scenario implemented-to-date has a green matrix entry; a wave cannot be VERIFIED with a red or missing slice; suite runs in CI.

## Required tests
This package IS the tests: unit, integration, database, API, idempotency, concurrency, reconciliation, accounting (as flows land), regression.

## Dependencies and sequencing
Skeleton early; slices per wave (B1 slice first).

## Delivery surfaces

Backend services: NOT_APPLICABLE (test-only package)
Database/schema: test fixtures/seeds only (never production migrations)
API/endpoints: exercised, not created
Frontend page/screen/dialog/action: NOT_APPLICABLE
Reason: regression-suite umbrella — it verifies other packages' surfaces (including their UI flows via UI tests) without shipping any
Existing consumer: CI pipeline; every Bxx VERIFIED gate
Operational visibility: CI results per wave slice; §49 matrix coverage report
Failure detection: red slice blocks the owning package's VERIFIED status
Recovery method: NOT_APPLICABLE (tests)
Reusable components/helpers: fixtures library (tenants, currencies, tax modes, methods)
Permissions: NOT_APPLICABLE
Validation: scenario↔§49 row traceability
i18n/RTL: NOT_APPLICABLE
Accessibility: NOT_APPLICABLE (UI a11y assertions live in each package's UI tests)
Audit trail: NOT_APPLICABLE
Observability: coverage trend per §49 row
Jobs/workers: CI scheduling only
Feature flag: none
Rollout: skeleton + B1 slice first; grows per wave
Rollback: NOT_APPLICABLE

## Completion evidence
Migration: — · Implementation files: — · Tests: — · Commit: — · Preview QA (deploy/result/approval): — · Reviewer: — · Verification: — · Authoritative report update: —
