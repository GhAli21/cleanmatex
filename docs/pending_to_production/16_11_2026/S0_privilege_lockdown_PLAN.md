# S0 Privilege Lockdown — Implementation Plan

**Status:** Planned — no migration written and nothing applied  
**Written:** 17 Nov 2026  
**Scope:** S0a, S0b, S0d (function `search_path` only), S0c, and register row 0.4  
**Repos:** `cleanmatex` owns the migrations and the CI check. `cleanmatexsaas` is in scope for caller inventory and for a code change only if a browser call would break.  
**Related:** [02 — Security](02_security_and_tenant_isolation.md) · [ROADMAP.md](ROADMAP.md) Phase 0 steps 0.1–0.4 · [Go / No-Go Register](Phase_0_to_4_Go_No_Go_Register.md)

This plan does not authorize applying SQL, flipping Supabase Auth switches, or deploying. The Owner applies migrations and runs the smoke test.

## Objective

Close the public-key door on catalog and privileged functions without changing how a signed-in laundry uses orders, payments, or HQ.

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
| A.1 Re-run the baseline queries (row security, grants, definer functions, view options, default privileges, role bypass flags). Attach counts to the Progress Log. | Dev | Planned | Counts dated in the Progress Log |
| A.2 Classify every `.rpc(` and every `.from('sys_` / `.from('hq_` in `web-admin`, `cmx-api`, `platform-api`, `platform-web`, and `platform-workers` as user-scoped or service-role. Record file and line. | Dev | Planned | Reviewed caller matrix |
| A.3 Read each user-scoped function candidate and record whether it checks `auth.uid()` or the session. Reject any candidate that does not. | Dev | Planned | Allowlist with a pass/fail check per name |
| A.4 Identify the Prisma role and the HQ Supabase server role. Decide `FORCE ROW LEVEL SECURITY`: on if both bypass, stop if either does not. | Dev | Planned | Role names and the force decision |
| A.5 Write `S0_authenticated_allowlist.md` with the surviving names, the caller, and the check. Empty is a valid result. | Dev | Planned | Reviewed allowlist |
| A.6 Update plan status for A.1–A.5. | Dev | Planned | Progress Log rows |

**Phase exit:** every browser and user-JWT call is named, and the force-RLS decision is recorded. No SQL file exists yet.

## Phase B — Migration A, tables (S0a, register 0.1)

| Task | Owner | Status | Exit evidence |
|---|---|---|---|
| B.1 Draft `{next}_revoke_sys_hq_anon_writes.sql`. Loop `sys_*`, `hq_*`, and `crm_track_test`: revoke all privileges from `anon` and `authenticated`, enable row security, and force it only if A.4 allows. Grant back only the literal allowlist, with a policy that is not `USING (true)`. | Dev | Planned | Reviewed migration |
| B.2 Revoke future table write grants from `anon` and `authenticated` for `postgres` and `supabase_admin`. Keep `service_role`. Comment the grant change and every policy. | Dev | Planned | Default-privilege statements in the migration |
| B.3 End the migration with a `RAISE EXCEPTION` self-check for remaining `anon` write or select on the targeted tables. Set `lock_timeout`. Do not drop `crm_track_test`. | Dev | Planned | Self-check present |
| B.4 If A.2 found a browser read, move that read to the existing server API. Keep tenant filters, permission checks, EN/AR, and `cmxMessage`. No new page. | Dev | Planned | Diff or an explicit "no browser read" note |
| B.5 Update plan status for B.1–B.4 and register row 0.1 to `In progress` with the file path. Do not mark `Pass`. | Dev | Planned | Progress Log row |

**Phase exit:** Migration A is ready for Owner review. It is not applied.

## Phase C — Migration B, functions and search_path (S0b, S0d, register 0.2)

| Task | Owner | Status | Exit evidence |
|---|---|---|---|
| C.1 Draft `{next}_revoke_definer_execute_and_lock_search_path.sql`. Revoke execute on every `public` SECURITY DEFINER function from `PUBLIC`, `anon`, and `authenticated`. Grant execute to `service_role`. Grant `authenticated` only the literal function allowlist. | Dev | Planned | Reviewed migration |
| C.2 For each SECURITY DEFINER function, set `search_path` from the schemas the body references, always ending in `pg_temp`. Do the same for other `public` functions that `anon` or `authenticated` can still execute. Do not rewrite bodies. | Dev | Planned | One `ALTER FUNCTION` per function, path recorded |
| C.3 Revoke future function execute from `PUBLIC`, `anon`, and `authenticated` for both owner roles. Grant future execute to `service_role`. | Dev | Planned | Default-privilege statements |
| C.4 Self-check: raise if `anon` or `PUBLIC` can execute any SECURITY DEFINER function, or if a definer function still has no `search_path`. | Dev | Planned | Self-check present |
| C.5 Update plan status for C.1–C.4 and register row 0.2 to `In progress`. Do not mark `Pass`. | Dev | Planned | Progress Log row |

**Phase exit:** Migration B is ready for Owner review. It is not applied.

## Phase D — Migration C, views (S0c, register 0.3)

| Task | Owner | Status | Exit evidence |
|---|---|---|---|
| D.1 Draft `{next}_security_invoker_catalog_views.sql`. Set `security_invoker` on the seven views. Revoke all privileges on them from `anon` and `authenticated`. Keep `service_role`. | Dev | Planned | Reviewed migration |
| D.2 Confirm no user-scoped client selects those views. If one does, move it server-side in the same change. Do not leave a definer view as the fix. | Dev | Planned | Caller note |
| D.3 Self-check: raise if any of the seven is still a definer view or still granted to `anon`. Comment each view. | Dev | Planned | Self-check and comments present |
| D.4 Update plan status for D.1–D.3 and register row 0.3 to `In progress`. Do not mark `Pass`. | Dev | Planned | Progress Log row |

**Phase exit:** Migration C is ready for Owner review. It is not applied.

## Phase E — Invariant and CI (register 0.4)

| Task | Owner | Status | Exit evidence |
|---|---|---|---|
| E.1 Add `scripts/db/check-s0-privileges.sql`: fail on `anon` write or select against row-security-off `sys_*`/`hq_*`, `anon` or `PUBLIC` execute of a SECURITY DEFINER function, a definer view granted to `anon`, or default privileges that grant `anon` execute or table write. | Dev | Planned | Script reviewed |
| E.2 Add a workflow that runs the script with `PRIVILEGE_CHECK_DATABASE_URL`. It fails closed when the secret is missing on a scheduled or manual run. Do not skip green. PR CI does not replay the full migration history. | Dev | Planned | Workflow file |
| E.3 Add a source test that the three migrations contain the self-checks and that their allowlist matches `S0_authenticated_allowlist.md`. | Dev | Planned | Test command and result |
| E.4 Update plan status for E.1–E.3 and register row 0.4 to `In progress`. | Dev | Planned | Progress Log row |

**Phase exit:** the invariant exists. It has not been run against the live database until the Owner applies the migrations.

## Phase F — Owner apply and proof (register 0.5 and 0.6)

The assistant stops before this phase. Apply order is A, then B, then C.

| Task | Owner | Status | Exit evidence |
|---|---|---|---|
| F.1 Review the three migrations and the allowlist. Apply them. Do not edit the files after apply. | Owner | Planned | Applied migration names |
| F.2 Run `scripts/db/check-s0-privileges.sql` against the applied database. Re-run the Supabase security advisor. | Owner + Dev | Planned | Zero remaining findings for these checks |
| F.3 Smoke-test login, a new order, one HQ screen, and the public tracking page, in EN and AR. Fix a break with a new migration, never by editing A–C. | Owner + Dev | Planned | Four paths recorded |
| F.4 Turn on leaked-password protection in Supabase Auth. Secure password change (S5) is not needed now. | Owner | Planned | Register 0.5 evidence |
| F.5 Mark register 0.1–0.6 and this plan from the evidence. `Pass` only with F.2 and F.3. | Owner | Planned | Register decision |
| F.6 Update plan status for F.1–F.5. | Dev | Planned | Progress Log row |

**Phase exit:** the Phase 0 exit check in the roadmap is true for these items.

## Phase G — Docs after proof

| Task | Owner | Status | Exit evidence |
|---|---|---|---|
| G.1 After F.2 passes, note the result in [02_security_and_tenant_isolation.md](02_security_and_tenant_isolation.md) and the roadmap Phase 0 exit line. Do not mark S1–S12. | Dev | Planned | Doc lines dated |
| G.2 Update plan status for G.1. | Dev | Planned | Final Progress Log row |

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
| 2026-11-17 | Plan created | Complete | Baseline read from the remote database; no SQL written and nothing applied | Dev | Owner approves Phase A |
