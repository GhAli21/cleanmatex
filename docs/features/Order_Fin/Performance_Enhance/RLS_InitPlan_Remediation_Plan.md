# RLS Policy Evaluation Remediation Plan

**Date:** 2026-10-28 · **Status:** ✅ DONE 2026-10-28. `0649` applied local + remote and verified.

## Verification results (2026-10-28, after apply)

| Check | Result |
|---|---|
| `supabase/checks/rls_unwrapped_auth_helpers.sql` | **0 rows** on local and remote. 354 policies, 319 carry the 0649 comment on both. |
| Visibility fingerprints (remote) | Cashier `851105eb…` ✅, tenant admin `d389f3a9…` ✅, anon `a1ff15cf…` ✅. **Identical to baseline**; table/error counts unchanged. |
| `cmx_effective_permissions` (real policy, as `authenticated`) | 40.6 ms → **2.4 ms** (17×) |
| `fn_stng_resolve_all_settings` under RLS | 5.4 ms → **3.1 ms** |
| `org_ntf_outbox_dtl` plan | Helper runs once as `InitPlan 1`; `Index Cond` kept; 24 buffers (unchanged); 1.2 ms |

Previous status line: Approved · `0649` written · baseline captured · dry run clean (319 change, 0 residual, 0 round-trip mismatch) · review listing: `technical_docs/rls_0649_policy_diff.md` · prevention: rule in `docs/dev/rules/performance-engineering.md` §7 plus `supabase/checks/rls_unwrapped_auth_helpers.sql` · **Follows:** `Settings_Resolver_Remediation_Plan.md` (new finding)

## 1. Problem

Most public RLS policies call auth helpers directly, for example `tenant_org_id = current_tenant_id()`. When the predicate is not an index condition (sequential scans, the inner side of joins, `EXISTS` subqueries, OR branches), Postgres may evaluate the helper **once per row**. `current_tenant_id()` is a SECURITY DEFINER lookup on `org_users_mst`. Supabase's documented fix is `(SELECT helper())`, which runs once per statement as an initPlan.

## 2. Evidence (remote, as `authenticated` with a real user JWT, rolled back)

| Case | Unwrapped | Wrapped | Gain |
|---|---|---|---|
| `cmx_effective_permissions` (real policy expression: service-role OR own row OR admin `EXISTS`), 88 visible rows | 40.6 ms | 1.7 ms | **23×** |
| `org_ntf_outbox_dtl`, 387 rows, simple tenant predicate | 1.05 ms | 0.63 ms | 1.7× |
| Same table, real RLS plan | Predicate became `Index Cond` (evaluated once), so no per-row penalty on this path | n/a | n/a |

Conclusion: the gain is large on per-row paths (permission and admin policies, joins) and small on paths where the tenant filter is an index condition. It grows with data volume. Demo data is small today.

## 3. Scope (remote counts; text match, approximate)

| Helper | Policies |
|---|---|
| `current_tenant_id()` | ~240 |
| `auth.uid()` / `auth.jwt()` / `auth.role()` | ~81 |
| `is_admin()` | 5 |

All helpers are `STABLE`, take no arguments and return a scalar (verified), so wrapping is **semantically identical**: same rows visible, same writes allowed.

**Drift found:** local and remote have the same 354 policies, but 25 differ textually. Remote deparses `org_users_mst.role` as `(role)::text` (column is `varchar`) and local as `role` (column is `text`). The behavior is the same, but a migration that hard-codes remote's text would overwrite local.

## 4. Design

**One migration (`0649`) with a deterministic, self-verifying `DO` block**, not 321 hand-written statements:

1. Snapshot every public policy (name, table, cmd, roles, permissive, qual, with_check) into a temp table.
2. For each policy whose `qual`/`with_check` contains an unwrapped helper, rewrite the expression with an anchored regex: `current_tenant_id()`, `auth.uid()`, `auth.jwt()`, `auth.role()`, `is_admin()` → `(SELECT …)`. A negative lookbehind skips already-wrapped calls, so the migration is idempotent. Apply it with `ALTER POLICY … USING (…) [WITH CHECK (…)]`, which keeps the name, command, roles and permissive flag. Policy ownership and grants are untouched.
3. **In-migration assertions (fail means the whole migration rolls back):** the policy count is unchanged; name, table, cmd, roles and permissive flag are unchanged for every policy; zero unwrapped helper calls remain; every rewritten expression differs from the original only by the wrapping (normalized comparison).
4. Works on both local and remote despite the drift, because it transforms each database's own definitions.
5. Policy catalog comments: keep the 38 existing comments and add a `COMMENT ON POLICY` for every altered policy (repository documentation rule), noting the 0649 wrapping.

Auditability: the migration header lists the transformation rules. A generated before/after listing (from remote) is saved as `technical_docs/rls_0649_policy_diff.md` for review.

### Not in scope (owner decisions, documented)

| Item | Why deferred |
|---|---|
| Drop the 43 redundant `auth.jwt()->>'role' = 'service_role'` policies (service_role already has BYPASSRLS) | Behavior-neutral cleanup, but it is a policy removal. Handle separately. |
| Change `{public}` policies to `TO authenticated` | Changes the anon surface. This is a security review item, not performance. |
| Index on `org_users_mst (user_id) WHERE is_active` for `current_tenant_id()` | Measure after 0649 first. |
| `org_users_mst.role` varchar/text drift | Schema-drift fix, separate migration. |

## 5. Verification

| Step | Check |
|---|---|
| Before apply | Record per-table visible row counts for 2 users from different tenants (`authenticated`, rolled back) on remote: the baseline. Re-run the `cmx_effective_permissions` timing. |
| After apply | Same row counts per table per user (**must be identical**). Timing re-run. Supabase Performance Advisor: `auth_rls_initplan` warnings should drop to ~0. |
| App | Login, dashboard, orders list, new order, settings and permissions screens as admin and as non-admin. Build and lint are not affected (DB-only). |

## 6. Prevention

- Add a rule to the `/database` skill and `docs/dev/rules/performance-engineering.md`: RLS helpers must be wrapped `(SELECT fn())`.
- Add `scripts/check-rls-initplan.sql` (or an npm check) that lists any policy with an unwrapped helper. Run it before release.

## 7. Risks

- `ALTER POLICY` takes a brief `ACCESS EXCLUSIVE` lock per table. With 300+ tables in one transaction, apply it in a low-traffic window. Pre-launch, so the impact is minimal.
- If any assertion fails, nothing is changed (single transaction).
