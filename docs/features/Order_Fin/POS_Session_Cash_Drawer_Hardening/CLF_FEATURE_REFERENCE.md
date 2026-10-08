# Cash Ledger Foundation (CLF) — Feature Reference

Decision record: `../ADR/ADR-057-Two-Domain-Cash-Ledger.md` (amends ADR-054 and supersedes ADR-032). Plan: `IMPLEMENTATION_PLAN.md` §4B. Status: `STATUS.md` (D56). Owner scenarios: `QA_TEST_GUIDE.md`.

## 1. Model in brief

- **Two domains, one drawer ledger.** Finance = cash voucher lines in `org_fin_voucher_trx_lines_dtl` (stamped `cash_effect_code`, `cash_ledger_seq`). Custody = drawer transactions `org_cash_drawer_trx_mst` / `_dtl` (`ledger_seq`); each transaction nets to zero per currency.
- **Per-drawer sequence** assigned under the drawer row lock; a session is the window `(open_ledger_seq, close_ledger_seq]`.
- **Central gate** `stampCashLinesTx` (`lib/services/cash-drawer-ledger/`): INTERACTIVE posting needs an open session and is refused while the session is `CLOSING`; DEFERRED posting (verification, reversal after close) lands in the current window.
- **Balances.**
  - `opening_expected = previous closing_basis + net ledger after the previous cut`
  - `session_base = opening_counted ?? opening_expected`
  - `closing_expected = session_base + net ledger in the window`
  - `closing_basis = closing_counted ?? closing_expected`
- **Close is two-step:** `startClose` (count, status `CLOSING`, cut frozen) → `finalizeClose` (disposition). Blind close hides expected until the count is stored. Posted lines, counts, custody lines and closed balance rows are immutable (DB triggers, SQLSTATE CMX02/CMX03).

## 2. Screens

| Screen | Path | Gate |
|---|---|---|
| Cash Drawers hub / drawer page | `/dashboard/internal_fin/cash-drawers`, `/[drawerId]` | `cash_drawer:view` |
| Session page (closure, variance approval, post-close) | `/dashboard/internal_fin/cash-drawers/[drawerId]/session/[sessionId]` | `cash_drawer:view` |
| Cash Deposit Follow-up | `/dashboard/internal_fin/cash-drawers/follow-up` | `cash_drawer:view_reports` |
| POS Sessions hub (force close lives here) | `/dashboard/internal_fin/pos-sessions` | `pos_session:view` |
| Cash Control Settings (drawer close, custody, rounding, denominations, pending-deposit status) | `/dashboard/settings/payments/cash-control-settings` | `cash_control:view` / `manage` |
| POS Settings (POS-session requirement, rollover, stale hours, Z-report required) | `/dashboard/settings/pos-settings` | `cash_control:view` / `manage` |
| Z-report archive | `/dashboard/internal_fin/pos-sessions/z-reports` | `pos_session:report_z` |

Drawer page tabs: Sessions · Ledger · Transactions · Counts · Policy. Shared components: `CmxDenominationCounter`, `CmxScopedSettingField`, `CashPlacementPicker`. Open / Cash In-Out / Close buttons are gated per action (see §3).

## 3. Permissions (`lib/constants/permissions/`, seeded in migrations 0517, 0529)

`cash_drawer:` `view`, `view_all_branches`, `view_reports`, `open_session`, `close_session`, `record_movement`, `transfer`, `receive_transfer`, `deposit`, `count`, `approve_variance`, `post_close_update`; `cash_control:` `view`, `manage`. Approval permissions are the only gate — the same user may approve (no maker ≠ checker). Branch scoping of drawer access is not enforced yet (Wave B3).

## 4. API (`app/api/v1/cash-drawers/…`, all permission-guarded; mutating methods validate CSRF)

- **Collection:** `/` (drawers), `/overview`, `/catalogs`, `/follow-up`, `/rounding-policy`, `/pending-deposit/status`, `/pending-deposit/ensure`, `/trx` (+ `/trx/[trxId]/reverse`).
- **Per drawer `/[drawerId]/…`:** `open-session-v2`, `cash-in-out`, `counts`, `ledger`, `policy`, `sessions`.
- **Per session `/[drawerId]/session/[sessionId]/…`:** `close/count`, `close/finalize`, `close/recount`, `close-preview`, `force-close`, `approve-variance`, `post-close`, `post-close/history`, `closure`, `summary`, and the session itself.
- **Errors:** one mapper (`lib/api/cash-drawer-route-errors.ts`) turns a typed error code into the documented HTTP status (§4B.11); an unmapped failure is logged and answered with the route's fixed fallback text (no internals leaked). The UI resolves every code to EN/AR text through `useCashDrawerErrorMessage` → `cashControl.ledgerErrors`.

## 5. Settings

Tenant defaults in `org_fin_cash_ctrl_stng_cf` (one typed column per setting, audit in `org_fin_cash_ctrl_audit_dtl`); a drawer may override a subset (`/[drawerId]/policy`, resolved drawer → tenant by `cash-drawer-policy` services). Relevant to CLF: count required at open/close, blind close, variance gate mode and thresholds, count modes, disposition rules, POS-session requirement is per finance screen (`pos_session_mode_*`, migration 0554; order entry / later collection / wallet-advance-gift-card sales / cash refunds). Disposition and custody rules are catalog data (`sys_cash_drawer_ses_disp_cd`, `sys_cash_drawer_trx_type_cd`), not code.

## 6. Constants

`lib/constants/cash-drawer.ts` — transaction types, dispositions (`LEFT_IN_DRAWER`, `MOVED_TO_SAFE`, `HANDED_TO_MANAGER`, `PREPARED_FOR_DEPOSIT`, `PARTIAL_REMOVED`, `OTHER`; `LEGACY` is system-only), move modes, drawer types, error codes — values mirror the DB strings exactly.

## 7. i18n

`messages/{en,ar}/cashControl.json` (`ledgerErrors.*`, settings) and `billing.json` (`cashDrawers.*`: wizard, closure, trxDialog, tabs, followUp, placement, pendingDeposit). Arabic term for the drawer cash is **درج النقد** (glossary). `npm run check:i18n` passes.

## 8. Migrations (all applied local + remote through 0551)

| File | Purpose |
|---|---|
| 0515–0518 | cash-control settings table, audit, permissions, navigation |
| 0519 | session-number generator hardening |
| 0523 | drawer / transaction / disposition catalogs |
| 0526 | ledger columns on voucher lines and sessions |
| 0527 | drawer transaction tables and triggers |
| 0528 | drawer policy settings |
| 0529 | CLF permissions |
| 0530 | cash-line roles and GL events |
| 0536 | counts and session balance tables |
| 0541 | follow-up navigation |
| 0546 | cash-change rounding role and GL events |
| 0549 | backfill of history into the ledger |
| 0550 | retire the legacy movement model (tables and columns) |
| 0551 | HQ Delete Orders coverage fix (unrelated to the cash model) |

Written after this pass and not part of CLF: `0552_pos_session_manage_others_permissions.sql` (check its status before relying on it).

## 9. Tests

- DB-integration (local DB only): `npx jest --config jest.db.config.js cash-drawer` — 7 suites / 34 tests: ledger matrix (window chain, disposition rules, concurrency, immutability, locking), tenant isolation on every ledger table with a real `authenticated` role.
- Unit / UI / API: `cash-drawer-route-errors`, `cmx-denomination-counter`, `cash-drawer-close-wizard`, `use-cash-drawer-error-message`.
- Gates last run 2026-10-03: eslint, tsc (known unrelated errors only), i18n, jest 3372 passing, build, access-contract and inventory checks.

## 10. Known limits

Branch scoping (B3); recount and force-close have no entry point on the drawer pages (API only; force close is on the POS Sessions hub); pixel-level RTL and tablet rendering of the close wizard is manual QA only; cash refunds paid in cash are not yet rounded (A6).
