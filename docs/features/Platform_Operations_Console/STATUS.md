# Platform Operations Console — Status

**Plan:** [PLAN.md](./PLAN.md) · **Operator guide:** [job_manager_guide.md](./job_manager_guide.md)
**Last updated:** 2026-10-14

| Phase | Scope | State |
|---|---|---|
| P0 | `hq_ops:*` permissions, audit conventions | **Done** — `hq_ops:read`, `hq_ops:manage_jobs` seeded by 0610 (applied local + remote, verified on remote 2026-10-14). `hq_ops:run_operations`, `hq_ops:manage_config`, `hq_ops:manage_secrets` come with P2/P4 migrations. |
| P1 | Job Registry + Job Manager | **Built, verified, NOT yet browser-tested.** |
| P2 | Curated operations catalog | **Built, migration 0611 applied (11 operations live on remote), tests verified; not browser-tested.** Guide: [operations_catalog_guide.md](./operations_catalog_guide.md) |
| P3 | Setup Health + guidance panels on NTF screens | **Built, no migration needed, verified; not browser-tested.** 19 platform + 8 per-tenant checks; `SetupGuidancePanel` on Providers, Channels, Runtime Config, Tenant Config. Guide: [setup_health_guide.md](./setup_health_guide.md) |

**All four phases (P0–P4) are built.** Lead's final re-run 2026-10-14: platform-api `src/modules/ops-*` 11 suites / **140 tests** pass; platform-web `ops-*` + notifications 9 suites / **97 tests** pass; platform-web `tsc --noEmit` clean, `npm run build` ✓ (routes `/ops/health`, `/ops/jobs`, `/ops/operations`, `/ops/config`); eslint `--quiet` clean on all four feature dirs; no `any` in new code; platform-api tsc shows no errors in `ops-*`/`app.module`/`notifications-hq` (unrelated pre-existing errors elsewhere).

### What is still open (honest list)
1. **No browser test of any ops screen** against the live API (`/ops/health`, `/ops/jobs`, `/ops/operations`, `/ops/config`). Do this first; the earlier agents never ran the UI either.
2. **DB types are regenerated** (all 6 `sys_ops_*` tables + `fn_ops_*` functions are in both apps' generated types, verified 2026-10-14); the narrow typed bridges (`as unknown as`) in the four ops repositories can now be replaced by the generated types.
3. **Everything is uncommitted** in `cleanmatexsaas` (user commits).
4. **Arabic strings** for the ops screens are model-written and need a native review.
5. **Per-key config conversion:** only `ntf.hq.resend.from_email` reads through the resolver; the remaining keys stay `ENV_OVERRIDES_DB` until converted one by one (`config_registry_guide.md` §7). Tenant-app keys have no resolver (`is_wired=false`).
6. **Setup Health limits:** HQ cannot read the tenant host's env (those checks show UNKNOWN); thresholds (1 h backlog, 7 d failures) are constants; no panel on the Templates screen.
7. **Not yet built:** change-history UI for `sys_ops_config_chg_log`, master-key rotation/re-encryption tool, drift alerting, HQ page-access registry/nav-migration conventions for the new routes (unconfirmed HQ contract).
8. Live demo-tenant state Setup Health will report: no provider accounts, senders, template registrations or routes; 0 opted-in customers; 3 stale outbox rows; `ntf-reconcile-outbox` last run FAILED.
| P4 | Config registry (`is_encrypted`, `source_policy`) + resolver | **Built, migration 0612 applied (50 keys live on remote, 0 values stored, 10 bootstrap), tests verified; not browser-tested.** One key (`ntf.hq.resend.from_email`) converted to the resolver as proof. Guide: [config_registry_guide.md](./config_registry_guide.md) |

## P2 / P4 — independent verification (2026-10-14)

| Check | Result |
|---|---|
| Remote DB: `sys_ops_operation_cf` | 11 operations (7 RUN_IN_UI: 4 READ, 2 WRITE, 1 DESTRUCTIVE; 4 COPY/GUIDE) |
| Remote DB: `sys_ops_config_cf` | 50 keys, 0 stored values, 10 bootstrap (ENV_ONLY), 0 `DB_ONLY`, 0 secret-without-encryption (the agent reported 53 keys; live count is 50) |
| Remote DB: permissions | `hq_ops:read/manage_jobs/run_operations/run_destructive/manage_config/manage_secrets` all present |
| platform-api `ops-operations` | 23/23 pass (re-run by lead) |
| platform-web `ops-operations` | 20/20 pass (re-run by lead) |
| platform-api `ops-config` + `notifications-hq/dispatch` | 9 suites, 79/79 pass (re-run by lead) |
| Agent-reported (not re-run by lead) | platform-web ops-config 16/16; tsc/build/eslint clean; en/ar parity; no `any` |

**Findings worth knowing**
- `org_ntf_outbox_dtl.idempotency_key` is NOT NULL with no default — the original go-live checklist test-insert would have failed; fixed in `15_operator_go_live_checklist.md` (and the catalog op `ntf.pilot_test_message` supplies it).
- `org_tenants_mst` has no `metadata` column; the `dispatch_via_hq` flag lives in `org_ntf_settings_cf.metadata` (per tenant + channel) — op `ntf.set_dispatch_via_hq` updates an existing row only.
- Seeded keys default to `ENV_OVERRIDES_DB` (today's behaviour) so applying 0612 changed nothing at runtime; the column default remains `DB_ONLY` per the user's decision. Keys are converted one at a time (checklist in `config_registry_guide.md` §7).
- Tenant-app keys are seeded `is_wired=false`: the tenant app has no resolver yet, so a value stored for them has no effect — avoid a second source of truth next to `sys_ntf_runtime_cf`.
- Remote `sys_ntf_runtime_cf` holds `outbox_secret_key` in plain text (pre-existing) — candidate for migration into the encrypted registry later.
- Master-key rotation would strand stored envelopes (no re-encryption tool yet); fingerprints are unsalted sha256 (low-entropy secrets guessable offline); `sys_ops_config_chg_log` is written but has no reader UI.

## P1 — what exists

- **Migration** `supabase/migrations/0610_ops_job_registry.sql` (tenant repo; applied by the user to both DBs): `sys_ops_job_cf`, `sys_ops_job_run_dtl`, SECURITY DEFINER `fn_ops_job_list / set_state / run_now / capture_runs` (service_role only), pg_cron job `ops-job-run-capture` (every 5 min), seed of the 17 live jobs with EN/AR descriptions.
- **HQ API** `platform-api/src/modules/ops-jobs` — `GET /ops/jobs`, `GET /ops/jobs/:jobCode/runs`, `PATCH /ops/jobs/:jobCode`, `POST /ops/jobs/:jobCode/run`. Guards `JwtAuthGuard` + `HqPermissionGuard`; reads `hq_ops:read`, writes `hq_ops:manage_jobs`; every mutation audited (before/after state, never a command). No endpoint accepts SQL.
- **HQ screen** `platform-web` route `/ops/jobs` (sidebar group **Operations**): drift badges, drift-only filter, enable/disable with confirmation, schedule edit (client-side cron validation), Run now with an honest `DISPATCHED` explanation, run-history dialog, read-only mode without `hq_ops:manage_jobs`, EN/AR.

## Verification (independent, 2026-10-14)

| Check | Result |
|---|---|
| Remote DB: all 17 `cron.job` rows registered | yes |
| Remote DB: `fn_ops_job_list()` returns drift | yes — see below |
| Remote DB: `hq_ops:read`, `hq_ops:manage_jobs` present and active | yes |
| Remote DB: run log captured | 4,377 SCHEDULE rows, 0 MANUAL rows (nothing was run-now'd during verification) |
| platform-api jest `src/modules/ops-jobs` | 26/26 pass |
| platform-web jest `__tests__/features/ops-jobs` | 36/36 pass |
| platform-web `tsc --noEmit`, `npm run build` | clean / success |
| platform-api `tsc` | no errors in `ops-jobs` or `app.module` (unrelated pre-existing errors in `common/guards/__tests__` and `common/services/__tests__`) |
| eslint (both) | 0 errors; JSDoc warnings only |
| `any` in new code | none |
| platform-web `en.json` / `ar.json` key parity | identical |

### Live drift the screen now exposes

| Job | Flags | Meaning |
|---|---|---|
| `ntf-outbox-processor` | SCHEDULE_DRIFT | runs `*/30`, intended every minute |
| `ntf-campaign-scheduler` | SCHEDULE_DRIFT + STATE_DRIFT | `*/30`, inactive |
| `fin-outbox-processor` | SCHEDULE_DRIFT + STATE_DRIFT | `*/30`, inactive |
| `ntf-outbox-retry`, `ntf-sweep-stale-push-subs`, `fin-gift-card-expiry`, `fin-idempotency-cleanup`, `fin-erp-posting-retry` | STATE_DRIFT | inactive |
| `ntf-reconcile-outbox` | none, but last scheduled run **FAILED** | needs investigation (likely `app.*` settings) |

**These can now be fixed from the screen** (Enable / edit schedule) instead of the SQL in the go-live checklist, once the user can open `/ops/jobs` as an HQ user holding `hq_ops:manage_jobs` (SUPER_ADMIN's `*` grant already covers it).

## Open items / honest limits

1. **Not browser-tested** — no one has opened `/ops/jobs` against the live API yet. Do this first.
2. **Typed bridge still in place** — DB types for the two apps have not been regenerated after 0610; the repository uses a narrow typed bridge. Regenerate types, then remove the bridge.
3. `ntf-reconcile-outbox` last run FAILED — not diagnosed.
4. Intended state of `cleanup-net-http-response` / `cleanup-cron-job-run-details` is assumed (no tracked migration); recorded in the row `notes`.
5. Run-now for `ASYNC_HTTP` jobs reports `DISPATCHED` (hand-off), never "done"; a missing runtime config raises only a WARNING in the trigger function, which the manager cannot observe.
6. No automated drift alerting yet (screen only).
7. Page-level access gating in HQ platform-web relies on the permission check in the screen/API; verify against HQ's own gating conventions if HQ has a central page-access registry.

## RBAC enforcement hardening (2026-10-14)

Review finding: with `HQ_RBAC_ENFORCEMENT_ENABLED=false` (old default) every `hq_ops:*` guard was a no-op. Fixed centrally: new `HqRbacService` (`platform-api/src/common/services/hq-rbac.service.ts`) is the single place that checks permissions and the switch; **enforcement is now ON unless the variable is explicitly `false`** (`.env.example` set to `true`). `HqPermissionGuard`, `OpsConfigService` and `OpsOperationsService` all call it. 153 tests pass (ops + guard + service). Side effect: other HQ controllers that relied on the old bypass are now enforced too — operators need the matching grants (SUPER_ADMIN `*` is unaffected). The web sidebar already hides the four `/ops/*` entries without `hq_ops:read`.

## Jobs & events reference (2026-10-16)

Full catalog of all 18 jobs, the domain-event and notification outboxes, secrets/config map, environments, 17 findings, architecture options and a per-job decision matrix: [Jobs_Details_And_Events_And_All_Related_Details.md](./Jobs_Details_And_Events_And_All_Related_Details.md). Analysis only — no runtime change was made. Open owner decisions are in its §15 and §17.

## Update 2026-10-17 (end of day)
Browser-bot QA fixes that touch this console: Jobs and Operations catalog screens now wait for the operator's permissions before deciding access (no more "no permission" flash); the pause-organization request accepts the demo organization id (`IsUuidIfEnabled`). Open and not changed: job times are shown in UTC (04:00 UTC = 08:00 Muscat); `ntf-campaign-scheduler` description still says "every minute"; T29 failover needs a second real provider. Remaining rows that need staging or a developer are listed in `Notification_And_Communication_Hub/notification-hub-production-implementation-plan.md` section 23.2.
