# Setup Health

Shows an organization what is missing or wrong in its setup, why it matters, and where to fix it. The same checks run in the tenant app (`cleanmatex`) and in HQ (the SaaS Backoffice, `cleanmatexsaas`), because they live in the database.

| Doc | For |
|---|---|
| [PLAN.md](PLAN.md) | Approved plan and step checklist (§6) |
| [STATUS.md](STATUS.md) | Current state of each step, design decisions |
| [developer_guide.md](developer_guide.md) | How it works, how to add a check |
| [user_guide.md](user_guide.md) | For admins and HQ staff, English + Arabic |
| [QA_TEST_GUIDE.md](QA_TEST_GUIDE.md) | Owner test scenarios (tenant T1–T9, HQ H1–H7) |
| [followups_by_user.md](followups_by_user.md) | Items waiting for the owner |

## At a glance

| Item | Value |
|---|---|
| Tenant screen | Config And Settings › **Setup Health** — `/dashboard/setup-health` (nav key `settings_setup_health`) |
| Tenant widgets | Red banner on every dashboard page for failing banner blockers; "Setup health" tile on the dashboard home |
| HQ screen | Tenant Organizations › organization › **Setup Health** — `/tenants/{id}/setup-health` |
| Permissions | Tenant `setup_health:view` (super_admin, tenant_admin, admin). HQ `tenant_setup_health:view` (TECH_ADMIN, SUPPORT, BUSINESS_ADMIN, ANALYST) |
| APIs | Tenant `GET /api/v1/setup-health`, `GET /api/v1/setup-health/summary`. HQ `GET /tenants/:tenantId/setup-health` |
| Migrations | `0709_setup_health_registry.sql`, `0710_setup_health_perms_nav.sql`, `0716_setup_health_cal_holidays.sql` |
| Feature flags / settings / plan limits / env vars | None new. A check can be hidden by an existing flag (`feature_flag_key`) |

## Checks today

| Code | Area | Severity | Shown in |
|---|---|---|---|
| `CAL_NO_BUSINESS_HOURS` | Business calendar | Warning | Tenant + HQ |
| `CAL_HOLIDAYS_ESTIMATED` | Business calendar | Info | HQ only |
| `SPEED_NO_RULES` | Service speeds | Info | Tenant + HQ |
| `ERP_LITE_NOT_READY` | Accounting | Warning | Tenant + HQ, only when `erp_lite_readiness_enabled` is on |

Tax checks (`TAX_*`) are added by Tax Engine M8 on the same registry.
