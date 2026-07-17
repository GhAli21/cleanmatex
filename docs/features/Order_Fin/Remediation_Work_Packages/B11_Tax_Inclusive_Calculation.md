# B11 — Tax-Inclusive Calculation

## Metadata
Backlog ID: B11 · Severity: HIGH · Classification: BLOCKS_FEATURE · Status: NOT_STARTED
Authoritative report sections: H3, §4, §14, §50-B11
Required decisions: none (snapshot semantics already defined; engine change is technical)
Dependencies: none — coordination only: [B12](B12_Order_Amendment_And_Financial_Delta.md) (impl overlap on the item-edit path; B12 retires that path and recommends B11 first — B12 is NOT a predecessor of B11) · Blocks: —
Recommended phase: Seq 10

## Confirmed problem
`calculateOrderTotals` always adds tax (no TAX_INCLUSIVE branch); the snapshot handles inclusive via `taxAddend=0`; the item-edit path assumes inclusive with a 0.05 fallback — three inconsistent behaviors (H3), so inclusive tenants get wrong previews/submits.

## Current evidence
| File or symbol | Current behavior | Gap |
|---|---|---|
| order-calculation.service.ts:309–340 | saleTotal = afterDiscounts + VAT + additional | no mode branch |
| order-financial-write.service.ts:285–336 | taxAddend=0 when inclusive; `extractTaxFromInclusive` helper exists (:273) | engine doesn't use it |
| pricing-mode-resolver.service.ts | resolves tenant/branch mode | not consulted by calc engine |
| lib/db/orders.ts:919 | inclusive reverse-split + 0.05 fallback | legacy divergence (B23/B12) |

## Required outcome
Preview, submit, snapshot, and item flows produce identical totals under both TAX_INCLUSIVE and TAX_EXCLUSIVE: inclusive extracts embedded tax (`price/(1+rate)`), exclusive adds — one resolved mode consulted everywhere.

## Scope
Mode branch in `calculateOrderTotals` (+ tax lines baseAmount semantics), preview API parity, UI display labels (tax included), regression fixtures both modes.

## Out of scope
Retiring the legacy item-edit path (B23 via B12); rounding rules (B17).

## Financial effects
| Area | Impact |
|---|---|
| Commercial total | YES (inclusive tenants) |
| Payment facts | NO |
| Credit applications | NO |
| BVM | NO |
| Cash drawer | NO |
| Gateway or bank | NO |
| Tax documents | POSSIBLE (correct tax split feeds B14) |
| ERP-Lite GL | NO |
| Snapshot | YES (consistency, same formula) |
| Reconciliation | YES (tax checks in B20) |
| Customer receipt | YES (display) |
| Audit/outbox | NO |

## Acceptance criteria
Preview == submit == snapshot totals for inclusive fixture orders; AMOUNT_MISMATCH does not fire on mode alone; exclusive behavior byte-identical to today.

## Required tests
unit (both modes, compound tax), integration (preview/submit/snapshot equality), regression, i18n/UI display.

## Dependencies and sequencing
Independent start; coordinate fixtures with B20 tax check.

## Delivery surfaces

Backend services: calculateOrderTotals TAX_INCLUSIVE branch (uses pricing-mode-resolver + extractTaxFromInclusive); preview routes inherit
Database/schema: none
API/endpoints: preview-payment/preview-financials + submit — same shapes; tax lines carry inclusive-extracted values
Frontend page/screen/dialog/action: order workspace + payment modal totals display "VAT included" labeling for inclusive tenants; receipts show extracted tax line — existing screens, label/formatting changes only
Reusable components/helpers: shared inclusive-extraction helper (already exists at write:273 — reused, not duplicated)
Permissions: none
Validation: AMOUNT_MISMATCH tolerance unchanged; mode resolved server-side (client never chooses)
i18n/RTL: EN/AR "Tax included" strings in orders/payment namespaces
Accessibility: NOT_APPLICABLE beyond text changes
Audit trail: tax pricing mode already recorded in snapshot JSON
Observability: preview==submit==snapshot equality assertions in tests
Jobs/workers: none
Feature flag: mode is tenant/branch config — no separate flag; guarded by fixtures
Rollout: engine branch + fixtures → staging inclusive tenant validation → enable (config-driven)
Rollback: revert engine branch; exclusive tenants unaffected throughout

## End-to-end operational flow

1. Inclusive-mode tenant builds an order → preview shows item prices with "VAT included" and the extracted tax line.
2. Submit computes identical totals; snapshot writes with taxAddend=0; receipt matches preview to the fils.
3. Exclusive tenants see byte-identical current behavior.

## Completion evidence
Migration: — · Implementation files: — · Tests: — · Commit: — · Preview QA (deploy/result/approval): — · Reviewer: — · Verification: — · Authoritative report update: —
