# B15 — Currency Defaults and Tolerances

## Metadata
Backlog ID: B15 · Severity: MEDIUM · Classification: CONTROL_GAP · Status: NOT_STARTED
Authoritative report sections: M1, M5, §15, §50-B15
Required decisions: none
Dependencies: none · Blocks: — · Recommended phase: Seq 3

## Confirmed problem
Eight `'OMR'` fallbacks, `'USD'` in ORDER_DEFAULTS, VAT `0.05` (lib/db/orders.ts:917), UI `0.06` (use-payment-totals.ts:176), and split tolerances (0.001 vs 0.01) contradict the no-locale-defaults rule and can write wrong-currency ledger rows on edge paths.

## Current evidence
| File or symbol | Current behavior | Gap |
|---|---|---|
| stored-value.service.ts:46,194 (+6 more, §15 list) | `currencyCode = 'OMR'` defaults | wrong tenant currency possible |
| constants/order-defaults.ts:10 | CURRENCY: 'USD' | locale default forbidden |
| lib/db/orders.ts:917 / use-payment-totals.ts:176 | 0.05 / 0.06 tax fallbacks | wrong tax silently |
| tolerance constants | 0.001 vs 0.01 undocumented split | inconsistent comparisons (M5) |

## Required outcome
No literal currency/VAT defaults on money paths — currency always resolved (tenant/branch/order row) or the operation fails loudly; one documented tolerance constant per comparison class.

## Scope
Replace the eight OMR fallbacks with resolution-or-throw; remove USD default; remove 0.05/0.06 fallbacks (calc engine owns tax); centralize tolerance constants.

## Out of scope
Rounding rules (B17); FX (B26); tax-inclusive branch (B11).

## Financial effects
| Area | Impact |
|---|---|
| Commercial total | POSSIBLE (fallback removal changes error behavior) |
| Payment facts | POSSIBLE (currency correctness) |
| Credit applications | POSSIBLE |
| BVM | NO |
| Cash drawer | NO |
| Gateway or bank | NO |
| Tax documents | NO |
| ERP-Lite GL | NO |
| Snapshot | NO |
| Reconciliation | YES (fewer false tolerance passes) |
| Customer receipt | NO |
| Audit/outbox | NO |

## Acceptance criteria
Grep-guard tests: no `'OMR'`/`'USD'` literals in lib/services money paths; missing currency → explicit error, never silent default.

## Required tests
unit, integration (non-OMR tenant fixture), regression.

## Dependencies and sequencing
Independent; early (Seq 3) to de-risk later packages.

## Delivery surfaces

Backend services: eight OMR-fallback call-sites → resolution-or-throw; ORDER_DEFAULTS.CURRENCY removal; calc/UI tax fallbacks removed; tolerance constants centralized (lib/constants)
Database/schema: none
API/endpoints: none new — affected paths return explicit MISSING_CURRENCY-class errors instead of silently defaulting
Frontend page/screen/dialog/action: NOT_APPLICABLE
Reason: literal-default removal and constant centralization — no user action changes; error surfaces reuse existing error displays
Existing consumer: all money screens (unchanged rendering); use-payment-totals fallback path (0.06 removed — server preview already wins)
Operational visibility: explicit error codes in logs where a fallback would have fired
Failure detection: grep-guard tests ('OMR'/'USD'/0.05/0.06 literals); non-OMR tenant fixture suite
Recovery method: revert commit; defaults are code-level only
Reusable components/helpers: tolerance constants module
Permissions: none
Validation: currency resolution required on every money write path
i18n/RTL: EN/AR strings for the new explicit error codes
Accessibility: NOT_APPLICABLE (no UI)
Audit trail: none new
Observability: fallback-would-have-fired log counter during transition
Jobs/workers: none
Feature flag: none — behavior change is fail-loud on already-broken paths
Rollout: guarded by fixtures; staging with a non-OMR tenant before enable
Rollback: revert commit

## Completion evidence
Migration: — · Implementation files: — · Tests: — · Commit: — · Preview QA (deploy/result/approval): — · Reviewer: — · Verification: — · Authoritative report update: —
