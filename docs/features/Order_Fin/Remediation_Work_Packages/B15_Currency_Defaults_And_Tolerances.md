# B15 — Currency Defaults and Tolerances

## Metadata
Backlog ID: B15 · Severity: MEDIUM · Classification: CONTROL_GAP · Status: **IMPLEMENTED 2026-07-18** (see Completion evidence) — awaiting owner commit → Preview QA
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

**Migration:** none (code-level only, as planned).

**Implementation (2026-07-18):**
- NEW `lib/constants/financial-tolerances.ts` — the two documented tolerance classes: `MONEY_COMPARISON_TOLERANCE = 0.001` (ledger equality) and `CASH_VARIANCE_TOLERANCE = 0.01` (physical cash counting). Re-exports now point at them: `ORDER_FINANCIAL_COMPARISON_TOLERANCE` (B02 module), `SETTLEMENT_MONEY_EPSILON`, `RECONCILIATION_TOLERANCE`, `RECON_REPORT_EPSILON`; the `0.01` literal in `cash-drawer.service.ts` close path replaced with the constant.
- NEW `lib/money/currency-resolution.ts` — `requireCurrencyCode` / `optionalCurrencyCode` / `assertCurrencyMatch` + typed `CurrencyResolutionError` with codes `MISSING_CURRENCY_CODE`, `CURRENCY_MISMATCH`, `MISSING_TENANT_CURRENCY`.
- All 9 audited `'OMR'` fallbacks removed (§15 list): stored-value topUp/issueAdvance (row currency governs; explicit currency required on create; conflict → CURRENCY_MISMATCH), order-refund credit-note leg, order-cancel store-credit leg, order-settlement later-collection (+currency threaded into `computeCollectionOverpaymentMetrics` via new option), order-credit-application, customer-open-balance-query (caller currency or tenant-settings resolution), customer-receipt-allocation-preview (preview row's persisted `currency_code` now selected+mapped and used at confirm), collection-overpayment synthesized legs (blank, math-unused).
- `ORDER_DEFAULTS.CURRENCY ('USD')` **removed**; `getTenantCurrency`/`getCurrencyConfig` now throw `MISSING_TENANT_CURRENCY` when unconfigured; ar-invoice write paths use `requireCurrencyCode`, read-DTO mappers degrade to `''`; wallet/advance API routes + server actions resolve tenant currency before first-row creation; ~20 display consumers degrade to `''`.
- Formatters (`formatMoneyAmount`, `formatMoneyAmountWithCode`, `formatPrice`, `formatCurrency` helpers, tenant-currency context/hooks) render a **plain localized number** when currency is unresolved — never an invented code; gift-card dialogs start blank and sync tenant currency (Zod `min(1)` blocks blank submission).
- Tax fallbacks removed: `lib/db/orders.ts` throws `MISSING_VAT_RATE` instead of assuming 0.05; `use-payment-totals` starts at 0 and stays 0 on load failure (server preview owns tax).
- i18n: `common.errors.money.*` EN/AR for the four new codes.

**Tests:** `__tests__/services/b15-currency-tolerance-guard.test.ts` (18 — source guard over lib/services+lib/payments+lib/db, resolution contract, tolerance wiring, formatter degradation) + 3 non-OMR wallet cases added to `stored-value.service.test.ts`; targeted suites 38/38 green.

**Gates (2026-07-18):** tsc clean (2 known pre-existing owner-file errors only) · eslint 0 · check:i18n ✓ · full jest + build recorded in RESUME at phase close.

**Commit:** — (owner) · **Preview QA (deploy/result/approval):** — pending (non-OMR tenant fixture on staging per Rollout) · **Reviewer:** — · **Verification:** — · **Authoritative report update:** — (after Preview QA)
