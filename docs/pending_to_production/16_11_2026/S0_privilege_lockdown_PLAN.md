# S0 Privilege Lockdown — Implementation Plan

**Status:** Phase 0 GO on 17 Nov 2026. 0745–0749 are applied on local and remote. The owner smoke test passed. Leaked-password protection and S12 are in [future_check.md](future_check.md).  
**Written:** 17 Nov 2026  
**Scope:** S0a, S0b, S0d (function `search_path` only), S0c, and register row 0.4  
**Repos:** `cleanmatex` owns the migrations and the CI check. `cleanmatexsaas` is in scope for caller inventory and for a code change only if a browser call would break.  
**Related:** [02 — Security](02_security_and_tenant_isolation.md) · [ROADMAP.md](ROADMAP.md) Phase 0 steps 0.1–0.4 · [Go / No-Go Register](Phase_0_to_4_Go_No_Go_Register.md)

This plan does not authorize applying SQL, flipping Supabase Auth switches, or deploying. The Owner applies migrations and runs the smoke test.

## Objective

Close the public-key door on catalog and privileged functions without changing how a signed-in Tenant uses orders, payments, or HQ.

| After this plan | Still true |
|---|---|
| `anon` cannot write or read `sys_*` / `hq_*` tables through the REST API | `service_role` keeps its grants and bypasses row security |
| `anon` cannot execute SECURITY DEFINER functions | A named `authenticated` allowlist remains only where a user JWT already calls a function that checks the caller |
| New tables and functions do not inherit public write or execute grants | `org_*` grants and policies are unchanged in this plan |
| The seven definer views run as the caller and are not granted to the browser roles | Leaked-password protection stays an Owner dashboard action (register 0.5) |

## Measured baseline (remote read-only, 17 Nov 2026)

Counts moved since the 16 Nov note. Re-measure at the start of implementation and attach the new counts to the Progress Log. Do not copy these numbers into a migration as a completeness check.

| Fact | 17 Nov 2026 |
|---|---|
| `anon` and `authenticated` do not bypass row security. `service_role` and `postgres` do. | Confirmed |
| Public tables with row security off | 191: `sys_*` 175, `hq_*` 15, `crm_track_test` 1. No `org_*` table is in this set. |
| Of those, `anon` can INSERT, UPDATE, or DELETE | `sys_*` 162, `hq_*` 15, `crm_track_test` 1 |
| Public SECURITY DEFINER functions | 195. `anon` can execute 98. `authenticated` can execute 109. `PUBLIC` can execute 96. |
| Exposed functions with a mutable `search_path` | 172, of which 67 are SECURITY DEFINER. The 16 Nov advisor figure was 153. |
| Views that still default to definer | `v_effective_tenant_settings`, `vw_fin_coa_explorer`, `vw_fin_effective_gov_for_tenant`, `vw_fin_missing_required_usage`, `vw_fin_open_exceptions`, `vw_fin_tenant_readiness`, `org_order_status_history_legacy` |
| Already `security_invoker` | `vw_doc_seq_consistency`, `vw_hq_unified_audit_trail` — leave them |
| Default privileges in `public` | Both `postgres` and `supabase_admin` grant full table rights and function execute to `anon`, `authenticated`, and `service_role` |
| Browser clients using the anon key | `web-admin/lib/supabase/client.ts` and `cleanmatexsaas/platform-web/lib/supabase/client.ts` |
| Authenticated-only definer functions today | `fix_order_data`, `fn_auth_own_tenants`, `fn_auth_session_choose_tenant`, `fn_auth_session_open_picker`, `fn_auth_session_validate`, `fn_label_printing_resolve`, `fn_ord_next_sub_order_no`, `fn_org_user_code_next`, `fn_shc_guard_tenant`, `fn_tenant_general_value`, `generate_order_number` |

`anon` can also write many `org_*` tables. Those tables already have row security, so they are not this change. A later review can tighten them. This plan does not revoke `org_*` grants.

## Design rules

1. **The database role is the JWT, not the process.** A Next.js server file that calls Supabase with the user session is `authenticated`. Only the service-role client is `service_role`. Inventory classifies the client, not the folder.
2. **Default deny for `anon` on `sys_*`, `hq_*`, and `crm_track_test`.** No select, insert, update, delete, or truncate. No execute on SECURITY DEFINER functions. No grant is added for `anon` unless Phase A proves a pre-login call that cannot be moved server-side, and that function rejects anonymous abuse.
3. **`authenticated` is deny-by-default too.** A grant survives only as a literal name in the migration, copied from the reviewed allowlist. The migration must not discover exceptions at apply time.
4. **A surviving function grant requires an in-function caller check** (`auth.uid()` and the tenant, or an equivalent session check). A grant without that check is a defect, even if the app calls the function today.
5. **Prefer a server route over a wide policy.** If a browser `.from('sys_…')` or `.from('hq_…')` exists, move that read behind the existing API, which uses the service role after its permission check. Do not add `USING (true)` policies.
6. **Row security on with no policy means deny** for `anon` and `authenticated`. Enable it on every row-security-off `sys_*` and `hq_*` table and on `crm_track_test`. Turn on `FORCE ROW LEVEL SECURITY` only after Phase A shows the Prisma and HQ connection roles bypass row security. `postgres` and `service_role` do. A non-bypass application role plus `FORCE` would apply policies to Prisma and break the app.
7. **Do not rewrite function bodies** to schema-qualify every name. Set a locked `search_path` per function. That path is `pg_catalog, public, pg_temp` plus any other schema the body actually references (`auth`, `extensions`, `net`, `storage`, `cron`, `vault`). `pg_temp` stays last. Never leave the path unset.
8. **Views:** `ALTER VIEW … SET (security_invoker = true)`, then revoke `anon` and `authenticated`. Recreate a view only if `ALTER VIEW` cannot set the option. `service_role` keeps select and still bypasses row security, so HQ and server reads continue.
9. **Close the future hole.** `ALTER DEFAULT PRIVILEGES` for both `postgres` and `supabase_admin` in `public`: revoke table write and function execute from `anon`, `authenticated`, and `PUBLIC`. Re-grant execute to `service_role`. Future `org_*` migrations must grant explicitly. The CI check fails if a later migration relies on the old default.
10. **Three forward migrations, applied in order.** A failed view change must not roll back the table revoke. Never edit an applied migration. Highest sequential file on 17 Nov is `0744`; take the next free numbers at write time.
11. **Catalog-only and bounded.** `lock_timeout` 3 seconds, one transaction per migration, no table rewrite, no data backfill. `org_*` policies are not edited, so order and payment queries do not gain new policy cost.
12. **The migration checks itself.** The last statement raises if any targeted table is still writable by `anon`, any SECURITY DEFINER function is still executable by `anon` or `PUBLIC`, or any of the seven views is still a definer view granted to `anon`.
13. **No new screen.** User-facing copy changes only if a call must move behind an existing API and that API's error text is missing. Then use the current i18n keys and `cmxMessage`.

## Allowlist rule

A name is added to `S0_authenticated_allowlist.md` only when all of these are true:

- a user-scoped client in `web-admin`, `cmx-api`, `platform-web`, or `platform-api` calls it;
- the call cannot be switched to the service-role client without breaking a signed-in user flow;
- for a function, the body rejects a caller who does not own the session or the tenant;
- for a table, the policy allows only that caller's rows, and `auth.uid()` is wrapped so it is evaluated once per statement;
- `anon` is absent.

The eleven authenticated-only functions above are candidates, not an approval. `cmx_rebuild_user_permissions`, `create_and_link_auth_user`, `cmx_fix_admin_role_permissions`, `apply_fin_tpl_for_tnt`, `fin_trigger_job`, and `cmx_ord_*_transition` stay revoked from `anon` and `authenticated` unless Phase A finds a user-scoped caller and an in-function check.

## Progress protocol — required after every task

No checkbox is marked complete until its Progress Log row is written in the same change.

- Update the task status in this file.
- Add one Progress Log row: date, evidence, owner, result, next action.
- Update register rows 0.1–0.4 when the task changes their evidence. Leave 0.5 and 0.6 on the Owner.
- Do not mark a register row `Pass` from a drafted file. `Pass` needs the Owner's apply evidence or a green invariant run against the database.

Status values: `Planned` → `In progress` → `Blocked` / `Complete`.

---

## Phase A — Caller inventory and role gate

No migration in this phase.

| Task | Owner | Status | Exit evidence |
|---|---|---|---|
| A.1 Re-run the baseline queries (row security, grants, definer functions, view options, default privileges, role bypass flags). Attach counts to the Progress Log. | Dev | Complete | Counts dated in the Progress Log |
| A.2 Classify every `.rpc(` and every `.from('sys_` / `.from('hq_` in `web-admin`, `cmx-api`, `platform-api`, `platform-web`, and `platform-workers` as user-scoped or service-role. Record file and line. | Dev | Complete | Reviewed caller matrix |
| A.3 Read each user-scoped function candidate and record whether it checks `auth.uid()` or the session. Reject any candidate that does not. | Dev | Complete | Allowlist with a pass/fail check per name |
| A.4 Identify the Prisma role and the HQ Supabase server role. Decide `FORCE ROW LEVEL SECURITY`: on if both bypass, stop if either does not. | Dev | Complete | Role names and the force decision |
| A.5 Write `S0_authenticated_allowlist.md` with the surviving names, the caller, and the check. Empty is a valid result. | Dev | Complete | Reviewed allowlist |
| A.6 Update plan status for A.1–A.5. | Dev | Complete | Progress Log rows |

**Phase exit:** every browser and user-JWT call is named, and the force-RLS decision is recorded. No SQL file exists yet.

## Phase B — Migration A, tables (S0a, register 0.1)

| Task | Owner | Status | Exit evidence |
|---|---|---|---|
| B.1 Draft `{next}_revoke_sys_hq_anon_writes.sql`. Loop `sys_*`, `hq_*`, and `crm_track_test`: revoke all privileges from `anon` and `authenticated`, enable row security, and force it only if A.4 allows. Grant back only the literal allowlist, with a policy that is not `USING (true)`. | Dev | Complete | Reviewed migration |
| B.2 Revoke future table write grants from `anon` and `authenticated` for `postgres` and `supabase_admin`. Keep `service_role`. Comment the grant change and every policy. | Dev | Complete | Default-privilege statements in the migration |
| B.3 End the migration with a `RAISE EXCEPTION` self-check for remaining `anon` write or select on the targeted tables. Set `lock_timeout`. Do not drop `crm_track_test`. | Dev | Complete | Self-check present |
| B.4 If A.2 found a browser read, move that read to the existing server API. Keep tenant filters, permission checks, EN/AR, and `cmxMessage`. No new page. | Dev | Complete | Diff or an explicit "no browser read" note |
| B.5 Update plan status for B.1–B.4 and register row 0.1 to `In progress` with the file path. Do not mark `Pass`. | Dev | Complete | Progress Log row |

**Phase exit:** Migration A is ready for Owner review. It is not applied.

## Phase C — Migration B, functions and search_path (S0b, S0d, register 0.2)

| Task | Owner | Status | Exit evidence |
|---|---|---|---|
| C.1 Draft `{next}_revoke_definer_execute_and_lock_search_path.sql`. Revoke execute on every `public` SECURITY DEFINER function from `PUBLIC`, `anon`, and `authenticated`. Grant execute to `service_role`. Grant `authenticated` only the literal function allowlist. | Dev | Complete | Reviewed migration |
| C.2 For each SECURITY DEFINER function, set `search_path` from the schemas the body references, always ending in `pg_temp`. Do the same for other `public` functions that `anon` or `authenticated` can still execute. Do not rewrite bodies. | Dev | Complete | One `ALTER FUNCTION` per function, path recorded |
| C.3 Revoke future function execute from `PUBLIC`, `anon`, and `authenticated` for both owner roles. Grant future execute to `service_role`. | Dev | Complete | Default-privilege statements |
| C.4 Self-check: raise if `anon` or `PUBLIC` can execute any SECURITY DEFINER function, or if a definer function still has no `search_path`. | Dev | Complete | Self-check present |
| C.5 Update plan status for C.1–C.4 and register row 0.2 to `In progress`. Do not mark `Pass`. | Dev | Complete | Progress Log row |

**Phase exit:** Migration B is ready for Owner review. It is not applied.

## Phase D — Migration C, views (S0c, register 0.3)

| Task | Owner | Status | Exit evidence |
|---|---|---|---|
| D.1 Draft `{next}_security_invoker_catalog_views.sql`. Set `security_invoker` on the seven views. Revoke all privileges on them from `anon` and `authenticated`. Keep `service_role`. | Dev | Complete | Reviewed migration |
| D.2 Confirm no user-scoped client selects those views. If one does, move it server-side in the same change. Do not leave a definer view as the fix. | Dev | Complete | Caller note |
| D.3 Self-check: raise if any of the seven is still a definer view or still granted to `anon`. Comment each view. | Dev | Complete | Self-check and comments present |
| D.4 Update plan status for D.1–D.3 and register row 0.3 to `In progress`. Do not mark `Pass`. | Dev | Complete | Progress Log row |

**Phase exit:** Migration C is ready for Owner review. It is not applied.

## Phase E — Invariant and CI (register 0.4)

| Task | Owner | Status | Exit evidence |
|---|---|---|---|
| E.1 Add `scripts/db/check-s0-privileges.sql`: fail on `anon` write or select against row-security-off `sys_*`/`hq_*`, `anon` or `PUBLIC` execute of a SECURITY DEFINER function, a definer view granted to `anon`, or default privileges that grant `anon` execute or table write. | Dev | Complete | Script reviewed |
| E.2 Add a workflow that runs the script with `PRIVILEGE_CHECK_DATABASE_URL`. It fails closed when the secret is missing on a scheduled or manual run. Do not skip green. PR CI does not replay the full migration history. | Dev | Complete | Workflow file |
| E.3 Add a source test that the three migrations contain the self-checks and that their allowlist matches `S0_authenticated_allowlist.md`. | Dev | Complete | Test command and result |
| E.4 Update plan status for E.1–E.3 and register row 0.4 to `In progress`. | Dev | Complete | Progress Log row |

**Phase exit:** the invariant exists. It has not been run against the live database until the Owner applies the migrations.

## Phase F — Owner apply and proof (register 0.5 and 0.6)

The assistant stops before this phase. Apply order is A, then B, then C.

| Task | Owner | Status | Exit evidence |
|---|---|---|---|
| F.1 Review the migrations and the allowlist. Apply them. Do not edit the files after apply. | Owner | Complete | 0745–0749 applied on local and remote |
| F.2 Run `scripts/db/check-s0-privileges.sql` against the applied database. If the migration notice says `supabase_admin` defaults were skipped, run `scripts/db/s0-supabase-admin-default-privileges.sql` in the SQL editor as `supabase_admin`, then run the check again. Re-run the Supabase security advisor. | Owner + Dev | Complete | Object checks are 0. `supabase_admin` defaults are a notice, tracked in future_check.md. Advisor re-run 17 Nov 2026. |
| F.3 Smoke-test login, a new order, one HQ screen, and the public tracking page, in EN and AR. Fix a break with a new migration, never by editing A–C. | Owner + Dev | Complete | Owner, 17 Nov 2026, after deploy: login, new order, one HQ screen, and public tracking passed |
| F.4 Turn on leaked-password protection in Supabase Auth. Secure password change (S5) is not needed now. | Owner | Moved | Owner, 17 Nov 2026: after the Supabase Pro upgrade. [future_check.md](future_check.md) |
| F.5 Mark register 0.1–0.6 and this plan from the evidence. `Pass` only with F.2 and F.3. | Owner | Complete | 0.1–0.4 and 0.6 are Pass. 0.5 is N/A (approved) until Supabase Pro. Phase 0 is GO. |
| F.6 Update plan status for F.1–F.5. | Dev | Complete | Progress Log row below |

**Phase exit:** GO on 17 Nov 2026. Leaked-password protection and S12 are tracked in [future_check.md](future_check.md).

## Phase G — Docs after proof

| Task | Owner | Status | Exit evidence |
|---|---|---|---|
| G.1 After F.2 passes, note the result in [02_security_and_tenant_isolation.md](02_security_and_tenant_isolation.md) and the roadmap Phase 0 exit line. Do not mark S1–S12. | Dev | Complete | S0a–S0c and the search-path half of S0d are closed on existing objects. S1–S12 were not changed. Phase 0 is not marked GO. |
| G.2 Update plan status for G.1. | Dev | Complete | Progress Log row below |

## Verification

| Check | When |
|---|---|
| Caller matrix has no unclassified `.rpc(` or `sys_*`/`hq_*` `.from(` | Before Migration A is written |
| Each migration's self-check is present and the allowlist file matches the SQL literals | Before handing the files to the Owner |
| Source test and lint for any application file touched | Before handover |
| `check-s0-privileges.sql` and the security advisor | After the Owner applies |
| Login, new order, HQ, public tracking | After the Owner applies |

## Explicit non-goals

- Do not apply migrations or run `supabase db reset`.
- Do not revoke `org_*` grants or edit `org_*` policies.
- Do not schedule jobs, enable the notification sender, or clear the outbox.
- Do not add a payment gateway, legal pages, or a new screen.
- Do not rewrite SECURITY DEFINER bodies.
- Do not drop `crm_track_test`.
- Do not treat a drafted migration as register `Pass`.

## Risks

| Risk | Control |
|---|---|
| A user-scoped server call was missed and a screen fails after apply | Phase A inventory, smoke test, fix only by a new migration |
| `FORCE ROW LEVEL SECURITY` hits a non-bypass Prisma role | A.4 blocks force until the role is known |
| A later migration expects the old default grants | Default-privilege change plus the invariant script |
| `search_path` omits a schema a function uses | Build the path from the body; smoke test covers login and orders |
| Long lock during `REVOKE` | `lock_timeout` 3s, catalog-only, apply off-peak |
| HQ browser client reads a catalog table | A.2 includes `platform-web`; move that read server-side |

## Progress Log

Append newest entries first. Do not remove historical entries.

| Date | Task | Status | Evidence / result | Owner | Next action |
|---|---|---|---|---|---|
| 2026-11-17 | Phase 0 GO | Complete | Owner moved leaked-password protection and S12 to `future_check.md`. Leaked-password protection waits for the Supabase Pro upgrade. The privilege check reports `supabase_admin` defaults and does not fail on them. Register rows 0.1–0.4 and 0.6 are Pass. 0.5 is N/A (approved). | Owner | Turn on leaked-password protection after the Pro upgrade |
| 2026-11-17 | F.3 smoke and docs | Complete | Owner deployed and tested login, a new order, one HQ screen, and public tracking. Remote advisor after `0749` has no public-table or search-path finding. Register 0.1, 0.2, 0.3, and 0.6 are Pass. 0.4 and 0.5 stay open. Phase 0 is not a GO. | Owner + Dev | Owner turns on leaked-password protection. `supabase_admin` defaults stay a residual. |
| 2026-11-17 | F.2 re-measure | Partial | After 0748 and 0749, remote catalog tables are closed, and no extra security-definer function is executable by the signed-in role. Default privileges still have 24 open `supabase_admin` grants. The SQL editor cannot close those. Not a Pass. | Dev | Deploy the tenant app, then smoke-test login, a new order, one HQ screen, and public tracking |
| 2026-11-17 | Apply 0749 | Complete | Owner applied `0749_settings_resolver_session_definer.sql` on local and remote. The two settings resolvers run as the owner. A signed-in session may pass only its own organization. `anon` cannot execute them. | Owner | Reload the new-order page and the customer picker |
| 2026-11-17 | Settings resolver | Drafted | `0749_settings_resolver_session_definer.sql` makes `fn_stng_resolve_all_settings` and `fn_stng_resolve_setting_value` run as the owner. A signed-in session may pass only its own organization. This is the default-guest-customer failure. Not applied. | Dev | Owner applies `0749`, then reloads settings and the guest customer |
| 2026-11-17 | RLS helper grants | Drafted | `0748_grant_rls_helper_execute.sql` grants `current_tenant_id()` and `is_admin()` to `anon` and `authenticated`. Policies call them as the session role. `0746` revoked that, so organization queries raise `permission denied for function current_tenant_id`. Not applied. | Dev | Owner applies `0748`, then reloads the new-order screen |
| 2026-11-17 | Rules for the lockdown | Complete | Public-key grant rules added to the database skill, `CLAUDE.md`, `AGENTS.md`, `supabaserules.mdc`, and the frontend and backend skills. `sys_*` / `hq_*` reads point at `catalogReadClient`. | Dev | New migrations follow the convention |
| 2026-11-17 | Local supabase_admin defaults | Complete | Ran `scripts/db/s0-supabase-admin-default-privileges.sql` inside `supabase_db_cleanmatex` as `supabase_admin`. Direct `psql -U supabase_admin` asks for a password and fails; the container password must be passed in. Local `anon` and `authenticated` default grants for that role are gone. | Dev | Remote SQL editor still cannot become `supabase_admin` |
| 2026-11-17 | Remote apply 0745–0747 | Complete | Remote `schema_migrations` has 0745, 0746, and 0747. `postgres` default privileges no longer grant `anon` or `authenticated`. `supabase_admin` defaults still do. The SQL editor runs as `postgres` and cannot become `supabase_admin`. Not a register Pass. | Owner | Remote dashboard-created objects keep the old default until Supabase provides that role |
| 2026-11-17 | Local apply 0746–0747 | Complete | Local CLI finished both files and reported the database up to date. The `supabase_admin` line is a notice. Remote `schema_migrations` has no 0745, 0746, or 0747. Not a register Pass. | Owner | Run the `supabase_admin` default-privilege script on that database, then `check-s0-privileges.sql`. Apply the same three files to remote only when ready. |
| 2026-11-17 | 0746 apply fix | Complete | First apply rolled back. `aclexplode` rejects a column definition list because it has OUT parameters. The self-check in `0746` and `scripts/db/check-s0-privileges.sql` now uses the function's own columns. Not applied. | Dev | Re-apply 0746, then 0747 |
| 2026-11-17 | E.1–E.4 | Complete | `scripts/db/check-s0-privileges.sql`, `.github/workflows/privilege-lockdown.yml` (scheduled and manual runs exit 1 when `PRIVILEGE_CHECK_DATABASE_URL` is missing), `scripts/db/check-s0-privilege-sources.mjs`, and `web-admin/__tests__/security/s0-privilege-lockdown.source.test.ts`. Not run against the live database. | Dev | Owner applies, then runs the invariant |
| 2026-11-17 | D.1–D.4 | Complete | `supabase/migrations/0747_security_invoker_catalog_views.sql` drafted. No user-scoped client selects the seven views; HQ reads them with the service role. Not applied. | Dev | Owner review |
| 2026-11-17 | C.1–C.5 | Complete | `supabase/migrations/0746_revoke_definer_execute_and_lock_search_path.sql` drafted from `S0_authenticated_allowlist.md`. 13 authenticated grants. Not applied. | Dev | Owner review |
| 2026-11-17 | B.1–B.5 | Complete | `supabase/migrations/0745_revoke_sys_hq_anon_writes.sql` drafted. Table allowlist empty. FORCE ROW LEVEL SECURITY on. Browser `sys_currency_cd` read moved to `readCurrencyMinorUnits`. Other user-JWT `sys_*` reads use `catalogReadClient`. Not applied. | Dev | Owner review |
| 2026-11-17 | A.4–A.6 | Complete | Force row security is on. Prisma and HQ database roles are `postgres` (`rolbypassrls`). Server clients are `service_role` (`rolbypassrls`). `anon` and `authenticated` do not bypass. Allowlist written. | Dev | Draft migrations |
| 2026-11-17 | A.1–A.3 | Complete | Remote re-measure matches the 17 Nov baseline in this plan (191 tables with row security off; anon write 162 `sys_*` + 15 `hq_*` + `crm_track_test`; 195 definers; anon execute 98; authenticated execute 109; PUBLIC execute 96). User-JWT functions without a caller check were rejected and their call sites switched to the service role. | Dev | Write the allowlist |
| 2026-11-17 | Plan created | Complete | Baseline read from the remote database; no SQL written and nothing applied | Dev | Owner approves Phase A |
