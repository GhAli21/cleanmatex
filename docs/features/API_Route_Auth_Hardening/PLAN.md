# API Route Auth Hardening (BF-23) — PLAN

**Status:** DRAFT, waiting for owner approval (2026-10-30). Nothing is implemented yet.
**Origin:** BF-23 in [Reusable_Order_Fin_View/PLAN.md](../Order_Fin/Reusable_Order_Fin_View/PLAN.md) §4, found 2026-10-23 at `api/v1/orders/[id]/state`.
**Related:** [User_Session_Lifecycle](../User_Session_Lifecycle/), [Tenant_Guard_Restoration](../Tenant_Guard_Restoration/), BF-20 (server actions, fixed; guard test `web-admin/__tests__/security/server-action-tenant-guard.test.ts`).

---

## 1. What BF-23 really is (re-verified 2026-10-30)

The original BF-23 text says these routes "take the first tenant instead of the session tenant, so a user in several organizations can act in the wrong one". **That premise is wrong today.** Evidence from the remote DB:

| Fact | Evidence |
|---|---|
| One auth account can belong to **one** tenant only | `org_users_mst` has `UNIQUE (user_id)` (`uq_org_users_mst_user_id`). Remote data: 6 users, max 1 membership each. |
| RLS resolves the tenant the same way | `current_tenant_id()` = `SELECT tenant_org_id FROM org_users_mst WHERE user_id = auth.uid() AND is_active LIMIT 1`. |
| `get_user_tenants()` returns that same single row | SECURITY DEFINER, filters active user + active tenant, `ORDER BY last_login_at DESC`. |

So `tenants[0]` always equals the session tenant. **There is no wrong-tenant bug and no cross-tenant leak.** The routes are still insecure, for two other reasons that the `tenants[0]` pattern hides:

### Gap A — the server-side session lifecycle is skipped (HIGH)

`proxy.ts:156-158` lets every `/api/*` request through ("API routes handle their own authentication"). Routes that use `requirePermission` run `guardSession` → `fn_auth_session_validate` (membership, absolute expiry, idle timeout, revoked session, forced password change). The 30 routes below only call `auth.getUser()` + `get_user_tenants()`, so they **accept sessions the platform has already ended**:

- an administrator revoked the session (`revokeTenantSessions`), e.g. a lost or stolen device;
- the idle timeout or the absolute expiry passed;
- an administrator set a temporary password (`mustChangePassword`) — these routes work before it is changed.

This is made worse by **Gap C** (below): ending a session never revokes the Supabase session, so the cookie keeps refreshing.

### Gap B — no permission check (HIGH)

None of the 30 routes calls a permission check. RLS only isolates by tenant (`tenant_org_id = current_tenant_id()`); it does not check roles, except `org_auth_user_workflow_roles` (needs `is_admin()`) and `sys_components_cd` (needs role `super_admin`). So **any active member of the organization** — `viewer`, `driver`, `cashier` — can, inside their own tenant:

- create, edit, delete and import products, categories, price lists and price-list items;
- change the workflow configuration (`PATCH /api/v1/workflows/config`);
- split orders, advance item steps, mark items complete, raise and resolve issues.

The access contracts even claim a permission the route never enforces (for example `catalog-access.ts` lists `GET /api/v1/products` with `products:read`), so the permissions inspector shows a gate that does not exist.

### Gap C — ending a session does not revoke the Supabase session (HIGH, related, separate fix)

`fn_auth_session_end` and `fn_auth_sessions_revoke` only update the app's own session table; they do not touch `auth.sessions` / `auth.refresh_tokens`. Every sign-out uses `signOut({ scope: 'local' })`, which only clears that browser's cookies. Result: whoever holds the cookies of a revoked session can keep refreshing Supabase tokens and call (1) the 30 routes in this plan and (2) the **Supabase Data API directly** (PostgREST with the public anon key), where RLS checks membership but not the app session. Closing Gap A alone does not close (2).

### Gap D — global navigation is writable from the tenant app (MEDIUM-HIGH, separate fix)

`/api/navigation/components` (GET/POST) and `/api/navigation/components/[id]` (GET/PUT/DELETE) write `sys_components_cd`, a **global** table that every tenant's sidebar reads. RLS allows it for any tenant user whose org role is `super_admin` (a tenant role: one exists in remote data). A laundry owner can change the menu of every organization. It also contradicts CRITICAL RULE #10: navigation changes are dual-write (code + migration), owned by the repo/HQ, not edited at runtime.

### Latent risk — multi-organization accounts

If `UNIQUE (user_id)` is ever dropped, tenant resolution breaks in many places at once: `tenants[0]` in 30 routes and 3 services, the `?? tenants[0]` fallback in `server-auth.ts:59`, and `current_tenant_id() ... LIMIT 1` with no `ORDER BY`. This package removes the route and service copies so the session (`validation.tenantOrgId`) is the only source in app code. Changing `current_tenant_id()` is out of scope until multi-org accounts are a product decision.

---

## 2. Inventory — the 32 matched files

`grep -rl get_user_tenants app/api --include=route.ts` matches 32 files: **30 to fix**, 2 excluded.

**Excluded:**
- `app/api/auth/login/route.ts` — legitimate: picks the active membership at sign-in, before a session exists.
- `app/api/v1/customers/route.ts` — false positive: the name appears only in a comment; the route already uses `requirePermission`.

**To fix** (permission = existing DB code, checked in `sys_auth_permissions`; "session-only" = `validateJWTWithTenant`, no permission, for reference data every staff role needs):

| # | Route (`web-admin/app/api/...`) | Method | Gate after the fix | Roles that hold it today (default) |
|---|---|---|---|---|
| 1 | `v1/orders/[id]/state` | GET | `orders:read` | all staff roles |
| 2 | `v1/orders/[id]/history` | GET | `orders:history` | all staff roles except store_keeper |
| 3 | `v1/orders/[id]/transitions` | GET | `orders:read` | all staff roles |
| 4 | `v1/orders/[id]/discounts` | GET | `orders:read` | all staff roles |
| 5 | `v1/orders/[id]/issues` | GET | `orders:read` | all staff roles |
| 6 | `v1/orders/[id]/issue-summary` | GET | `orders:read` | all staff roles |
| 7 | `v1/orders/issues` | GET | `orders:read` | all staff roles |
| 8 | `v1/orders/[id]/issue` | POST | `orders:transition` (D1) | floor roles incl. laundry_worker, presser, qa_inspector |
| 9 | `v1/orders/[id]/issue/[issueId]` | PATCH | `orders:update` (D1) | cashier, operator, receptionist, supervisor, managers, admins |
| 10 | `v1/orders/[id]/items/[itemId]/step` | POST | `orders:transition` | floor roles |
| 11 | `v1/orders/[id]/items/[itemId]/complete` | POST | `orders:transition` | floor roles |
| 12 | `v1/orders/[id]/rack-bags` | GET | `orders:read` | all staff roles |
| 13 | `v1/orders/[id]/split` | POST | `orders:split` | branch_manager, operator, tenant_admin, super_admin |
| 14 | `v1/orders/estimate-ready-by` | POST | any of `orders:create`, `orders:edit` | order-taking roles |
| 15 | `v1/products` | GET / POST | `products:read` / `products:create` | read: order-taking roles + viewer; create: admins |
| 16 | `v1/products/[id]` | GET / PATCH / DELETE | `products:read` / `products:update` / `products:delete` | |
| 17 | `v1/products/export` | GET | `products:export` | tenant_admin, super_admin |
| 18 | `v1/products/import` | POST | `products:create` + `products:update` if the import upserts (confirm in code) | admins |
| 19 | `v1/categories` | GET / POST | session-only / `products:categories` | |
| 20 | `v1/price-lists` | GET / POST | `pricing:read` / `pricing:create` | |
| 21 | `v1/price-lists/[id]` | GET / PATCH / DELETE | `pricing:read` / `pricing:update` / `pricing:delete` | |
| 22 | `v1/price-lists/[id]/items` | POST | `pricing:update` | admins |
| 23 | `v1/price-lists/[id]/items/[itemId]` | PUT / DELETE | `pricing:update` | admins |
| 24 | `v1/processing-steps/[category]` | GET | session-only | |
| 25 | `v1/plan-flags` | GET | session-only | |
| 26 | `v1/workflows/config` | GET / PATCH | session-only / `settings:workflow` | PATCH: admins |
| 27 | `workflow-roles` | GET / POST | `roles:update` | admins |
| 28 | `workflow-roles/users` | GET | `roles:update` | admins |
| 29 | `navigation/components` | GET / POST | **retire** (D2) | |
| 30 | `navigation/components/[id]` | GET / PUT / DELETE | **retire** (D2) | |

Why session-only for #19 GET, #24, #25, #26 GET: they are reference data read by the processing and order screens. `settings:read` is not held by cashier, operator or the floor roles, so gating them on it would lock those screens. They still get full session validation (Gap A).

**Same pattern outside routes** (fixed in the same package, because routes call them):

| File | Line | Fix |
|---|---|---|
| `lib/services/tenants.service.ts` | 334 | take the session tenant (`getAuthContext()` from `lib/auth/server-auth.ts`) or a `tenantId` argument |
| `lib/services/subscriptions.service.ts` | 79 (`getAuthenticatedTenantId`), 250 | same |
| `lib/services/customers.service.ts` | 162 (also reads `user_metadata.tenant_org_id`) | same; drop the `user_metadata` read |
| `lib/auth/server-auth.ts` | 59 (`?? tenants[0]`) | fail closed when the session tenant is not in the list, no fallback |
| `proxy.ts` | 223-253 (admin routes: role "in ANY tenant", `X-Tenant-ID` from the first admin tenant) | low today (one membership); use the session tenant's role. Check `X-Tenant-ID` has no reader, then remove it |

Not changed: `lib/auth/auth-context.tsx` and `lib/services/auth-data.service.ts` (client tenant list for the UI, no authorization decision), `app/api/auth/login/route.ts`.

---

## 3. Decisions

| # | Question | Recommendation |
|---|---|---|
| D1 | Issues: who may raise and who may resolve? | Raise = `orders:transition` (QA inspectors and pressers find the problems on the floor and lack `orders:update`). Resolve = `orders:update`. No new permission code needed. |
| D2 | Navigation write endpoints (#29, #30) | **Retire** the 2 routes and `lib/services/navigation-management.service.ts` and its screen, and drop the 3 tenant `super_admin` write policies on `sys_components_cd` in a new migration. Navigation stays migration-owned (CRITICAL RULE #10); a runtime editor, if wanted, belongs in HQ. Step 0 confirms the screen and its callers first. |
| D3 | Gap C (Supabase session not revoked) | Separate small package right after this one: `fn_auth_session_end` / `fn_auth_sessions_revoke` also delete the matching `auth.sessions` row (the app session id is the Supabase session id — confirm in Step 0), which kills the refresh token; then lower the Supabase JWT lifetime (for example 15 minutes) so the remaining access token dies quickly. Do **not** add a per-row session check to RLS (cost on every query); revocation plus a short JWT is the standard Supabase pattern. |
| D4 | Enforcement style | Use the existing `requirePermission` / `requireAnyPermission` / `validateJWTWithTenant` from `lib/middleware/`. No new helper, no wrapper. |

---

## 4. Steps

**Step 0 — confirm (read-only, no code).**
- For every route in §2: list the screens that call it (contracts already list most) and confirm the chosen permission is held by every role that uses that screen. The role-permission data is in `sys_auth_role_default_permissions` (remote DB).
- D2: find the navigation management screen and confirm nothing else calls the endpoints.
- D3: confirm `org_auth_sessions*.auth_session_id` = `auth.sessions.id`.
- `products/import`: insert only, or upsert?

**Step 1 — orders routes (#1–#14).** Replace the `getUser` + `get_user_tenants` block with the gate from §2; keep the explicit `tenant_org_id` filter in every query (CRITICAL RULE #4), now from `auth.tenantId`. One commit per route group, route tests: 401 without a session, 401/`SESSION_ENDED` for an ended session, 403 without the permission, 200 with it.

**Step 2 — catalog and pricing (#15–#23).** Same.

**Step 3 — settings, workflow, roles (#24–#28).** Same.

**Step 4 — services and `server-auth.ts`** (table in §2).

**Step 5 — navigation retire (#29–#30, D2).** Delete routes, service and screen; navigation dual-write for the removed screen (`config/navigation.ts` + `sys_components_cd` migration, `/navigation` skill); a migration that drops the `sys_components_cd` write policies for `authenticated`. Stop and wait for the owner to apply each migration.

**Step 6 — access contracts.** Update every `*-access.ts` entry for these 30 routes: `enforcement: 'auth_only'` → `requirement: { permissions: [...] }` (or keep `auth_only` for the session-only reads); remove the "Auth-only route inferred from code" notes. Run the golden path: `derive:ui-access-contract --apply` → `wire:ui-access-contract --fix` → `check:ui-access-contract --wire` → `sync:ui-access-contract`, then `/rebuild-platform-info-inventories` with `surface=api`.

**Step 7 — repo rule test** (like BF-20's), `__tests__/security/api-route-auth-guard.test.ts`:
- fails if a file under `app/api/**` or `lib/services/**` calls `rpc('get_user_tenants')`, except an allowlist (`auth/login`, `auth-data.service.ts`, `server-auth.ts` role lookup);
- fails if a `route.ts` exports a handler without `requirePermission` / `requireAnyPermission` / `requireAllPermissions` / `withPermission` / `validateJWTWithTenant`, unless it is a public route (`lib/security/public-routes`) or in a committed baseline. The baseline may only shrink, so new unguarded routes fail CI while older ones are cleaned up later.

**Step 8 — verify and document.** `npx eslint . --quiet`, `tsc`, targeted Jest, `npm run build`; one manual check per role group (viewer cannot create a product; laundry_worker can still advance a step; a revoked session gets 401 on `/api/v1/orders/[id]/state`). Update STATUS.md, QA scenarios, and close BF-23 in the Reusable View PLAN/STATUS.

---

## 5. Impact

| Area | Effect |
|---|---|
| Security | Closes Gap A and Gap B on 30 routes; Gap D with Step 5. Gap C needs D3. |
| Behavior | Users without the permission now get 403 where they used to succeed. Step 0's role check is what keeps the order and processing screens working. |
| Performance | Per request: today `getUser` + `get_user_tenants`; after: `getUser` + `fn_auth_session_validate` + one permission check (`hasPermissionServer`). About one extra RPC, the same cost every other guarded route already pays. `requirePermission` has an 8 s timeout and fails closed with 504. |
| Migrations | Only for D2 (drop policies, navigation row) and D3 (session revoke function). No new permission codes: every code above already exists. |
| Rollback | Per-route commits; reverting a route restores the old behavior. Pre-launch (no real tenants), so no rollout flag is needed. |
| Maintenance | One tenant source in app code (the validated session); contracts match what routes enforce; the rule test stops new copies. |
