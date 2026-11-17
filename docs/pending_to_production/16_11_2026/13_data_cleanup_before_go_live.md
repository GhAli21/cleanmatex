# 13 — Data Cleanup Before Go-Live

If real customers will use the **same** Supabase project as the demos (file 03, I2), clean these first. If you create a new production project, use this list to make sure none of it is copied across.

| # | Leftover | Where | Action |
|---|---|---|---|
| D1 | Demo organizations: Demo Tenant LLC, BlueWave, Qatar Demo 4, Demo Saudi, and `11111111…` | `org_tenants_mst` | Keep them as HQ test or demo tenants (`is_hq_test_demo = true`), or remove them. Exclude them from billing and analytics. |
| D2 | Extra 2% tax on every order of `11111111…` (`LEGACY_05`) | Tax rules (Advanced mode) | Deactivate it if it was test data. |
| D3 | Two stuck CLOSING POS sessions (drawers ac312993 / 65546cc7) | POS Sessions page | Force-close them. |
| D4 | Two stuck demo outbox rows | Notification outbox | Close them (owner guide Part F). |
| D5 | Six QA quota overrides on the Saudi tenant | HQ › Notifications › Quota › Tenant Overrides | Delete them. |
| D6 | Extra draft version on template `assembly.completed.default` | HQ › Templates | Delete it, or leave it (drafts never send). |
| D7 | User display name "Admin Demo Lanudry" | Users screen | Rename it to "Admin Demo Tenant". |
| D8 | Plain-text secrets in the config registry | HQ › Ops › Config | Encrypt them once `HQ_ENCRYPTION_MASTER_KEY` is set. |
| D9 | QA tenants or profiles: the `WF_V2_FULL_PATH` test profile (PILOT), and the archived S10 canary seed route | Workflow profiles | Keep the pilot-only profiles away from real tenants. |
| D10 | `cmx_p_tmp.chk_isuuid` must stay `false`, or the demo organization id is rejected | DB | Check it once (owner guide A3). |
| D11 | Stray file `supabase/migrations/pglast-*.whl` | Repo | Delete it if it is still there. |
| D12 | Seeded holidays marked `is_estimated` (**112 rows**, live 2026-11-16) | `sys_public_holidays_cf` | Confirm them (file 08, SP1). |
| D13 | Notification outbox: 55 QUEUED, 1 FAILED_TEMPORARY, 45 FAILED_PERMANENT (live 2026-11-16) | `org_ntf_outbox_dtl` | Once the jobs run (file 03, I11a), cancel the old demo QUEUED rows so they are not sent late to demo numbers. |

**Checked live 2026-11-16:** D3 (2 CLOSING sessions: still there), D7 (1 user with "Lanudry": still there), D10 (`chk_isuuid = false`: OK).
