# B22 — Financial Registry Consolidation

## Metadata
Backlog ID: B22 · Severity: MEDIUM · Classification: MAINTENANCE_RISK · Status: IMPLEMENTED (2026-07-24, uncommitted; no migration — pure TS refactor, matches this package's own "Database/schema: none")
Authoritative report sections: §44, §50-B22
Required decisions: [D001](00_Phase_0_Financial_Semantics/D001_Payment_Lifecycle_And_Status_Transitions.md) (status custody)
Dependencies: none · Blocks: — · Recommended phase: Seq 9

## Confirmed problem
`PAYMENT_METHODS` is duplicated across constants/order-types.ts and constants/payment.ts with different importers; `VOUCHER_TYPE` vs `VOUCHER_TYPE_LEGACY` are dual vocabularies; RefundStatus has no exported registry (string literals); reconciliation used literal status strings (§44).

## Current evidence
| File or symbol | Current behavior | Gap |
|---|---|---|
| constants/order-types.ts + constants/payment.ts | two PAYMENT_METHODS consts | drift risk (DB-mirror rule) |
| constants/voucher.ts:27/57 | legacy + canonical voucher types | dual vocabulary |
| order-refund.service.ts | 'PENDING_APPROVAL' literals | no RefundStatus registry |

**Corrections found during implementation (2026-07-24) — 2 of the 3 confirmed problems above are stale:**
1. **PAYMENT_METHODS is NOT duplicated.** `constants/order-types.ts` already cleanly re-exports `PAYMENT_METHODS`/`PAYMENT_KINDS`/etc. verbatim from `constants/payment.ts` (single source, confirmed by reading the file — its own header comment even says "single source of truth"). Whatever drift the audit found has already been fixed by an earlier, unrelated commit. No action needed.
2. **`VOUCHER_TYPE` vs `VOUCHER_TYPE_LEGACY` is NOT an accidental dual vocabulary — it's a deliberate, already-documented migration bridge.** `constants/voucher.ts`'s own header comment explains exactly why both exist (`VOUCHER_TYPE_LEGACY` serves the pre-BVM receipt/billing flow; `VOUCHER_TYPE` serves all new BVM code) and `VOUCHER_TYPE_LEGACY` is already marked `@deprecated`. The comment explicitly says "Do not remove until billing/vouchers is migrated to BVM." Consolidating these two would break the still-live legacy flow — correctly left untouched.
3. **RefundStatus registry — the one real, current gap** — confirmed: `org_order_refunds_dtl.refund_status` was written/read as raw string literals (`'PENDING_APPROVAL'`, `'APPROVED'`, `'PROCESSED'`) across `order-refund.service.ts` (7 sites), 3 reconciliation check modules (`erp-lite-checks.ts`, `ar-checks.ts`, `order-checks.ts`), and the frontend `refunds-list-client.tsx` (badge-color map + 2 comparisons) — with zero shared registry anywhere. This is the actual scope of this package.

## Required outcome
One module per registry (payment methods, refund statuses, voucher types) with re-exports for compatibility; grep-guard tests forbidding literals on money paths; recon imports lifecycle sets (done in B2 — guarded here).

## Scope
Constant consolidation, importer migration, RefundStatus export, deprecation notes on legacy voucher vocabulary.

## Out of scope
New FinancialBusinessTransactionType registry (created when §28 events are implemented — B6/B10 deliverables reference it).

## Financial effects
| Area | Impact |
|---|---|
| Commercial total | NO |
| Payment facts | NO |
| Credit applications | NO |
| BVM | NO |
| Cash drawer | NO |
| Gateway or bank | NO |
| Tax documents | NO |
| ERP-Lite GL | NO |
| Snapshot | NO |
| Reconciliation | NO |
| Customer receipt | NO |
| Audit/outbox | NO |

## Acceptance criteria
Single source per registry; tsc + build green; DB-mirror values byte-identical before/after (CRITICAL RULE 12).

## Required tests
unit (registry equality snapshots), regression (build + typecheck).

## Dependencies and sequencing
Independent; safe refactor wave.

## Delivery surfaces

Backend services: new `REFUND_STATUSES` registry in `lib/constants/order-financial.ts` (mirrors `chk_org_order_refunds_status`, migration 0404, exactly); 7 write/read sites in `order-refund.service.ts` migrated off raw literals; 3 reconciliation check modules migrated (`erp-lite-checks.ts`, `ar-checks.ts` incl. its own doc-comment, `order-checks.ts`). PAYMENT_METHODS/VOUCHER_TYPE items closed as stale findings, not touched (see corrections above).
Database/schema: none — no migration; DB-mirror values verified byte-identical to the live CHECK constraint via a dedicated equality test (CRITICAL RULE 12).
API/endpoints: none.
Frontend page/screen/dialog/action: `src/features/billing/ui/refunds-list-client.tsx` — badge-color map keys + 2 status comparisons migrated to `REFUND_STATUSES`; the map's pre-existing `REJECTED` key was left as a documented dead/defensive entry (not a governed `refund_status` value — never produced by any writer).
Reusable components/helpers: `REFUND_STATUSES` / `RefundStatus` (the registry itself), alongside the existing `REFUND_CONTEXTS`/`REFUND_ERROR_CODES` siblings in the same file.
Permissions: none — zero behavior change, no new gates.
Validation: equality test (`REFUND_STATUSES` vs the DB CHECK constraint's value list) + grep-guard tests (no `refund_status` literal remains in the migrated files).
i18n/RTL: NOT_APPLICABLE — no new user-facing strings, only the internal identifier source changed.
Accessibility: NOT_APPLICABLE.
Audit trail: none — pure constant consolidation.
Observability: none beyond CI (tsc/eslint/jest/build).
Jobs/workers: none.
Feature flag: none.
Rollout: single reviewed commit.
Rollback: revert commit.

## Completion evidence
Migration: none (pure TS refactor, no schema change).
Implementation files: `lib/constants/order-financial.ts` (new `REFUND_STATUSES`/`RefundStatus`), `lib/services/order-refund.service.ts` (7 sites), `lib/services/reconciliation/erp-lite-checks.ts`, `lib/services/reconciliation/ar-checks.ts` (+ doc-comment), `lib/services/reconciliation/order-checks.ts`, `src/features/billing/ui/refunds-list-client.tsx`.
Tests: `__tests__/services/refund-status-registry.test.ts` (new, 4 tests — DB-mirror equality + 3 grep-guards across the migrated files).
**Gates:** tsc clean (same 3 pre-existing unrelated errors, none in any B22 file) · eslint 0 (project-wide) · targeted refund/reconciliation suites 17 suites/202 tests, zero regressions (behavior-neutral by construction) · new registry test 4/4 · full jest **233/233 suites, 2247/2247 tests — zero known failures** · `check:i18n` ✓ (no i18n touched by this package). **`npm run build` currently FAILS — confirmed unrelated to B22 (or B8/B19).** The failure is a client/server import-boundary violation in a file B22 never touched: `app/dashboard/orders/[id]/order-detail-client.tsx` ('use client') transitively imports `lib/config/features.ts` → `lib/config/workflow-engine-v2.ts` → `lib/services/feature-flags.service.ts` → `lib/supabase/server.ts` (which imports `next/headers`'s `cookies()`, a server-only API). `git status` shows `lib/config/features.ts` as one of many uncommitted, in-progress changes outside this session's scope (a separate order-workflow-engine refactor, evidenced by ~15 concurrently-modified/deleted workflow docs and order-transition routes) — not something this session created or should silently "fix" by guessing at someone else's WIP. Flagged to the owner; B22 (and B8/B19) are otherwise fully gated green.
Commit: — (uncommitted) · Preview QA (deploy/result/approval): — · Reviewer: — · Verification: — · Authoritative report update: —
