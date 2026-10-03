# Implementation requirements — POS Session & Cash Drawer Hardening (as built)

Per `.claude/skills/implementation/prd-rules.md`. This is the as-built catalogue of what the program added
beyond the CLF ledger (see [CLF_FEATURE_REFERENCE.md](./CLF_FEATURE_REFERENCE.md) for the ledger itself).
STATUS rows D62–D66 carry the narrative; this file is the lookup table.

## Migrations (this wave)

| # | Content |
|---|---|
| 0554 / 0557 | Per-screen POS-session policy columns (`pos_session_mode_*`, six surfaces), retired the two global booleans |
| 0555 | `cash_drawer:operate_any` permission |
| 0558 | Branch timezone; session `rollover_applied_at` / `stale_flagged_at` / `auto_close_reason`; event types; `pos_session_rollover` job (pg_cron `*/15`); notification category, events, templates |
| 0559 | `org_pos_shift_z_rpt_tr` (immutable Z-report); variance rejection columns + CHECK + pending index |
| 0560 | Navigation: Cash Variance by Cashier |
| 0562 | `IN_TRANSIT` drawer type + `TRANSIT_*` trx types + holder ensure function + `org_cash_drawer_transit_tr`; `org_currency_denom_cf`; navigation (Variance Approvals, In Transit); Arabic nav label; rollover template fix |

## Permissions

No new permission code after `cash_drawer:operate_any`. Reused: `pos_session:view|view_all|report_z|full_manage_others`,
`cash_drawer:view|transfer|receive_transfer|approve_variance|view_reports|view_all_branches|operate_any`,
`cash_control:view|manage`, `settings:update` (branch timezone).

## Routes (pages)

`/dashboard/internal_fin/pos-sessions/[sessionId]/report` (+ `/print`) · `/dashboard/internal_fin/cash-drawers/variance-approvals` ·
`/dashboard/internal_fin/cash-drawers/in-transit` · `/dashboard/reports/cash-variance` (+ `/print`) ·
Branch Settings → *Business day* card · Cash Control Settings → *Counted denominations* card.

## API routes

`GET /api/v1/pos-sessions/[sessionId]/x-report` · `GET|POST …/z-report` ·
`POST /api/v1/cash-drawers/[drawerId]/session/[sessionId]/reject-variance` · `GET /api/v1/cash-drawers/variance-approvals` ·
`GET /api/v1/cash-drawers/variance-report` · `POST|GET /api/v1/cash-drawers/transit` · `POST …/transit/[transitId]/receive|cancel` ·
`GET|PUT /api/v1/cash-drawers/denominations` · `GET …/denominations/currencies` · `GET …/[drawerId]/count-policy` ·
`GET /api/v1/lookups/timezones` · `PATCH /api/v1/branches/[id]` (`timezone_code`, needs `settings:update`).

## Settings (`org_fin_cash_ctrl_stng_cf`) now enforced

`pos_session_mode_*` · `pos_session_rollover_mode` · `pos_session_stale_hours` · `shift_z_report_required` ·
`shared_session_mode` · `opening_count_mode` · `closing_count_mode` · `blind_close_enabled` · `drawer_assignment_mode`.

## Background jobs

`pos_session_rollover` — `FINANCE_JOB_CODES.POS_SESSION_ROLLOVER`, pg_cron `fin-pos-session-rollover`, every 15 minutes,
visible and manually runnable on the finance-jobs hub; run history in `sys_fin_job_run_log`.

## Notifications (Hub)

`pos_session.stale`, `pos_session.rolled_over` (IN_APP; EN/AR templates; recipients: session owner + supervisors of the branch).

## Error codes (stable, localized in `cashControl.ledgerErrors` / `posSessions.errors`)

`POS_SESSION_ROLLED_OVER` · `TENANT_TIMEZONE_NOT_CONFIGURED` · `DRAWER_SESSION_EXCLUSIVE` · `VARIANCE_ALREADY_REJECTED` ·
`CASH_TRANSIT_NOT_FOUND|NOT_OPEN|REASON_REQUIRED|USE_CANCEL` · `CASH_DENOMINATION_DISABLED` · `CASH_COUNT_MODE_NOT_ALLOWED` ·
`Z_REPORT_NOT_FOUND` · `Z_REPORT_SESSION_NOT_FINISHED`.

## Constants & types

`lib/constants/pos-session.ts` (events, auto-close reason, notification codes, rollover/sharing errors) ·
`lib/constants/pos-shift-report.ts` + `lib/types/pos-shift-report.ts` · `lib/constants/cash-drawer.ts` (transit trx types/status/errors) ·
`lib/constants/cash-control.ts` (`allowedCountMethods`) · `lib/constants/financial-tolerances.ts` (`CASH_VARIANCE_TOLERANCE` deleted).

## Feature flags / plan limits / env vars

None added. The job runs on the existing `FINANCE_OUTBOX_SECRET` dispatcher.
