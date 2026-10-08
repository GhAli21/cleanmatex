# Implementation requirements — POS Session & Cash Drawer Hardening (as built)

Per `.claude/skills/implementation/prd-rules.md`. This is the as-built catalogue of what the program added
beyond the CLF ledger (see [CLF_FEATURE_REFERENCE.md](./CLF_FEATURE_REFERENCE.md) for the ledger itself).
STATUS rows D62–D70 carry the narrative; this file is the lookup table. Last refreshed 2026-10-09.

## Migrations (this wave)

| # | Content |
|---|---|
| 0554 / 0557 | Per-screen POS-session policy columns (`pos_session_mode_*`, six surfaces), retired the two global booleans |
| 0555 | `cash_drawer:operate_any` permission |
| 0558 | Branch timezone; session `rollover_applied_at` / `stale_flagged_at` / `auto_close_reason`; event types; `pos_session_rollover` job (pg_cron `*/15`); notification category, events, templates |
| 0559 | `org_pos_shift_z_rpt_tr` (immutable Z-report); variance rejection columns + CHECK + pending index |
| 0560 | Navigation: Cash Variance by Cashier |
| 0562 | `IN_TRANSIT` drawer type + `TRANSIT_*` trx types + holder ensure function + `org_cash_drawer_transit_tr`; `org_currency_denom_cf`; navigation (Variance Approvals, In Transit); Arabic nav label; rollover template fix |
| 0578 | RBAC least privilege (D69): replaces the over-granted `pos_session:view|view_all|open|pause_resume|close|force_close` defaults of old 0396 (which went to all 19 roles) with a role matrix; rebuilds `cmx_effective_permissions` for affected users; self-verifies. Data only |
| 0587 | Navigation (D70): `settings_pos` "POS Settings" under Settings, display order 61, `cash_control:view` |

## Permissions

No new permission code after `cash_drawer:operate_any`. The POS Settings page and the Z-report archive reuse existing codes (`cash_control:view|manage`, `pos_session:report_z`). Migration 0578 changed **who holds** six `pos_session:*` codes by default:

| Code | Default roles (after 0578) |
|---|---|
| `pos_session:view` | accountant, admin, branch_manager, cashier, finance_manager, operator, super_admin, supervisor, tenant_admin |
| `pos_session:view_all` | accountant, admin, branch_manager, finance_manager, super_admin, supervisor, tenant_admin |
| `pos_session:open`, `:pause_resume`, `:close` | admin, branch_manager, cashier, finance_manager, operator, super_admin, tenant_admin |
| `pos_session:force_close` | admin, branch_manager, finance_manager, super_admin, supervisor, tenant_admin |

Per-user overrides are preserved. Reused: `pos_session:view|view_all|report_z|full_manage_others`,
`cash_drawer:view|transfer|receive_transfer|approve_variance|view_reports|view_all_branches|operate_any`,
`cash_control:view|manage`, `settings:update` (branch timezone).

## Routes (pages)

`/dashboard/settings/pos-settings` (tabs `?tab=requirement|lifecycle`; `src/features/pos-settings/`) · `/dashboard/internal_fin/pos-sessions/z-reports` (Z-report archive; reached by a button on POS Sessions, no sidebar entry) · `/dashboard/internal_fin/pos-sessions/[sessionId]/report` (+ `/print`, server-gated) · `/dashboard/internal_fin/cash-drawers/variance-approvals` ·
`/dashboard/internal_fin/cash-drawers/in-transit` · `/dashboard/reports/cash-variance` (+ `/print`) ·
Branch Settings → *Business day* card · Cash Control Settings → *Counted denominations* card. Cash Control Settings (`/dashboard/settings/payments/cash-control-settings`) keeps drawer close, custody, cash-change rounding and the pending-deposit status; the POS-session fields moved to POS Settings (D70).

## API routes

`GET /api/v1/pos-sessions/z-reports` (Z archive; `pos_session:report_z`; own-only unless `view_all`) · `GET /api/v1/pos-sessions/catalogs` and `GET /api/v1/cash-drawers/catalogs` (bilingual names of statuses, events, drawer types, movement types, dispositions, post-close statuses; `pos-sessions/catalogs` needs any of `pos_session:view` / `cash_drawer:view`, `cash-drawers/catalogs` needs `cash_drawer:view`) · `GET|PUT /api/v1/settings/payments/cash-control` (shared by both settings pages; PUT takes a patch of only the changed fields) · `GET /api/v1/pos-sessions/[sessionId]/x-report` · `GET|POST …/z-report` ·
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

`pos_session.stale`, `pos_session.rolled_over` (IN_APP; EN/AR templates; recipients: session owner + holders of `pos_session:force_close` in the branch — a narrow audience only since 0578).

## Error codes (stable, localized in `cashControl.ledgerErrors` / `posSessions.errors`)

`POS_SESSION_ROLLED_OVER` · `TENANT_TIMEZONE_NOT_CONFIGURED` · `DRAWER_SESSION_EXCLUSIVE` · `VARIANCE_ALREADY_REJECTED` ·
`CASH_TRANSIT_NOT_FOUND|NOT_OPEN|REASON_REQUIRED|USE_CANCEL` · `CASH_DENOMINATION_DISABLED` · `CASH_COUNT_MODE_NOT_ALLOWED` ·
`Z_REPORT_NOT_FOUND` · `Z_REPORT_SESSION_NOT_FINISHED`.

## Constants & types

`lib/constants/pos-session.ts` (events, auto-close reason, notification codes, rollover/sharing errors) ·
`lib/constants/pos-shift-report.ts` + `lib/types/pos-shift-report.ts` · `lib/constants/cash-drawer.ts` (transit trx types/status/errors) ·
`lib/constants/cash-control.ts` (`allowedCountMethods`) · `lib/constants/financial-tolerances.ts` (`CASH_VARIANCE_TOLERANCE` deleted).

## Labels from the system-code catalogs (D69)

The UI never prints a raw status/event/type code. `lib/utils/catalog-label.ts` (`resolveCatalogLabel`: Arabic prefers `name2`, falls back to `name`, then the code) is used by `lib/hooks/use-session-lifecycle-labels.ts` (POS-session status, POS-session event, drawer-session status) and `src/features/cash-drawers/hooks/use-cash-drawer-catalog-labels.ts` (drawer type, movement type, disposition, post-close status). Catalog responses include inactive rows so historical records keep their name; cached 10 minutes. The tables are edited in the HQ console (`/system-codes/cash-pos`, repo `cleanmatexsaas`, docs `docs/features/Cash_Pos_Catalogs/progress_status.md`): HQ owns names, descriptions and order; codes, `is_active` and behaviour flags change only by tenant-repo migration plus constant (CLAUDE.md rule 12).

## i18n namespaces

`posSettings` (POS Settings page), `cashControl` (field labels and enums used by both settings pages and the drawer Policy tab), `posSessions` (incl. `zArchive`), `posShiftReport` (incl. `archive.*`), `billing.cashDrawers.*`.

## Feature flags / plan limits / env vars

None added. The job runs on the existing `FINANCE_OUTBOX_SECRET` dispatcher.
