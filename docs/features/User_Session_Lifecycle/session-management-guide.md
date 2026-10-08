# Session Management Guide

**Last updated:** 2026-10-08
**Audience:** Developers changing auth or session behaviour
**Feature docs (same folder):** [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) · [STATUS.md](STATUS.md) · [QA_TEST_GUIDE.md](QA_TEST_GUIDE.md) · [ADR](ADR-session-registry-and-tenant-claim.md)

This guide describes the full session lifecycle of web-admin: sign-in, the server-side session registry, idle and absolute timeouts, revocation, route protection, CSRF and "Remember me".

---

## The model in one paragraph

Supabase Auth owns credentials and tokens. On top of it the platform keeps a **session registry** (`sys_auth_user_sessions_mst`): one row per Supabase session (`auth.sessions.id`, the `session_id` claim of the JWT), bound to **one tenant** and carrying a **policy snapshot** taken at sign-in (idle timeout, absolute lifetime, remember-me). The **server is authoritative**: every protected request is validated against the registry; the browser only shows warnings. Ending a session = marking the registry row ended **and** deleting the `auth.sessions` row, so the refresh token dies with it.

Identity rules: one auth account per tenant membership (`UNIQUE(user_id)` on `org_users_mst`), **no tenant switching** (sign out, then sign in with the other tenant's account). Users sign in with a globally unique **user code or email** plus password.

---

## Session lifecycle

1. **Login** — `POST /api/auth/login` (`identifier` = user code or email, `password`, optional `remember_me`, `X-CSRF-Token`).
   - CSRF and rate-limit checks; the identifier is resolved by `fn_auth_resolve_login_identifier`; **every failure is the same `INVALID_CREDENTIALS`** (no account enumeration). Lockout RPCs run with the service role.
   - `signInWithPassword`, then the registry row is created by `startSession()` → `fn_auth_session_register`: tenant from the single membership, policy snapshot, concurrent-session limit (`REVOKE_OLDEST` ends the oldest session; `BLOCK_NEW` deletes the new Supabase session and the API answers `409 SESSION_LIMIT_REACHED`), device detection (`cmx-did` cookie, only its hash is stored).
   - A first-seen device with the tenant policy `AUTH_NEW_DEVICE_ALERT` on raises the notification `security.login.detected` to the user (`notifyNewDeviceSignIn`).
   - Cookies are set; the client receives the session, calls `supabase.auth.setSession()` and honours a safe `?redirect=` (`lib/security/safe-redirect.ts`: internal paths only).

2. **Activity and idle timeout**
   - Idle = **real user input only** (pointer-down, key, wheel, touch, navigation). Background polling never extends a session.
   - The client sends a heartbeat (`POST /api/auth/session/activity`, max once a minute, only after input) → `fn_auth_session_validate(p_touch := true)`. Other tabs share activity and sign-out over `BroadcastChannel('cmx-auth-session')`.
   - `idle_warning_sec` before the idle deadline the **idle warning dialog** appears (Escape = stay signed in). Only the explicit button extends during the warning.
   - Remember-me sessions have no idle timeout; every session has an **absolute** lifetime that activity cannot extend (a one-time heads-up is shown shortly before it ends).
   - Expiry is **server-confirmed** before the client signs out (another tab may have extended the session). A network failure is never treated as "session ended".

3. **Validation on every request** — `lib/auth/session-guard.ts` (`guardSession`) is used by `proxy.ts`, `validateJWTWithTenant` (all `requirePermission` routes), both `getAuthContext`s and `getTenantIdFromSession`. It identifies the caller from the JWT only, fails **closed** (503 when the registry cannot be reached), caches an ACTIVE answer for 5 s per process, and lazily registers sessions that predate the registry (e.g. recovery links). Ended sessions get `401 { code: 'SESSION_ENDED' }`; the client's global fetch guard (`installSessionEndedGuard`) turns the first such answer into a server-confirmed sign-out.

4. **Logout** — `signOut(reason)` is the single path: `POST /api/auth/logout` ends the registry row with the mapped reason and signs out **locally** (`scope: 'local'`), then the client clears react-query, permission/feature-flag/navigation caches and notifies other tabs.

5. **Revocation** (all end the registry row and delete the Supabase session)

   | Trigger | Reason code | Where |
   |---|---|---|
   | User signs out | `USER_LOGOUT` | `/api/auth/logout` |
   | Idle / absolute timeout | `IDLE_TIMEOUT` / `ABSOLUTE_TIMEOUT` | `fn_auth_session_validate`, scheduled sweep |
   | User signs out a device / all others | `USER_REVOKED` | Account security page |
   | Admin signs a user out | `ADMIN_REVOKED` | Team Members → Active Sessions, user detail → Sessions |
   | Password change (others) / reset (all) | `PASSWORD_CHANGED` | `/api/auth/password/*`; HQ admin reset |
   | User deactivated / membership removed | `USER_DEACTIVATED` / `MEMBERSHIP_REMOVED` | DB trigger on `org_users_mst` (covers every writer, incl. HQ) |
   | Concurrent-session limit | `SESSION_LIMIT` | `fn_auth_session_register` |

   Direct browser → PostgREST calls stay valid until the access token expires, so keep `jwt_expiry` short (600 s; see Operations).

6. **Scheduled sweep** — pg_cron job `auth-session-sweep` (every 5 minutes) runs `fn_auth_sessions_sweep(180)`: ends sessions past their deadlines or whose Supabase session vanished and purges ended rows older than 180 days.

---

## Policy configuration

Two tables, not the settings system: `sys_auth_admin_config_cf` (platform catalog, HQ-owned) and `org_auth_admin_config_cf` (tenant overrides, accepted only where `is_allow_tenant_change` and within the catalog bounds; enforced by DB triggers). `fn_auth_config_effective(tenant)` resolves value + source (`PLATFORM`, `TENANT`, `PLATFORM_ENFORCED`). The result is **snapshotted onto the session at sign-in**, so changes apply to new sign-ins only.

| Code | Default | Tenant may change |
|---|---|---|
| `AUTH_IDLE_TIMEOUT_MIN` | 30 (0 = off) | yes |
| `AUTH_IDLE_WARNING_SEC` | 60 | yes |
| `AUTH_SESSION_MAX_HOURS` | 12 | yes |
| `AUTH_REMEMBER_ME_DAYS` | 7 (0 = disabled) | yes |
| `AUTH_MAX_SESSIONS_PER_USER` | 0 (unlimited) | yes |
| `AUTH_SESSION_LIMIT_POLICY` | `REVOKE_OLDEST` / `BLOCK_NEW` | yes |
| `AUTH_NEW_DEVICE_ALERT` | true | yes |
| `AUTH_LOCKOUT_MAX_ATTEMPTS`, `AUTH_LOCKOUT_MINUTES`, `AUTH_LOCKOUT_WINDOW_MIN` | 5 / 15 / 60 | no (pre-tenant, email-keyed) |

Tenant editing (Settings → Security & Sessions) is additionally gated by the plan flag `session_timeout_control` and the permission `auth_config:update`. HQ (cleanmatexsaas, `/auth-config` and `/tenants/[id]/auth-config`) manages the catalog and any tenant's overrides.

---

## Audit

Everything is written to the dedicated, append-only `sys_auth_audit_log` (event catalog `sys_auth_event_cd`): `LOGIN_SUCCESS`, `LOGIN_FAILURE`, `ACCOUNT_LOCKED`, `LOGOUT`, `SESSION_IDLE_TIMEOUT`, `SESSION_ABSOLUTE_TIMEOUT`, `SESSION_REVOKED`, `SESSION_LIMIT_HIT`, `NEW_DEVICE`, `PASSWORD_CHANGED`, `CONFIG_CHANGED`, `USER_CODE_CHANGED`. Users see their own rows; tenant admins see tenant rows (Users → user → Activity, permission `audit:read`). `sys_audit_log` is service-role only.

---

## Route protection

- **Proxy** (`web-admin/proxy.ts`):
  - Refreshes the session, validates it against the registry (`guardSession`) and, for an ended session, clears the auth cookies and redirects to `/login?reason=<reason>&redirect=<path>`.
  - Public: `/`, `/login`, `/register`, `/forgot-password`, `/verify-email`, `/logout`, `/auth/*`, `/public`. **`/reset-password` is not public**: it needs the recovery session created by `/auth/callback`.
  - API routes are not redirected; they enforce auth in handlers (`401 SESSION_ENDED` / `503` fail-closed).
  - Next.js 16 uses `proxy.ts` (not `middleware.ts`).
- **Dashboard layout** (`web-admin/app/dashboard/layout.tsx`): client guard + `SessionLifecycleProvider` (heartbeat, warning dialog, cross-tab sync).

---

## Password flows

- **Change** (`POST /api/auth/password/change`, Account security page): requires the current password (a wrong one counts toward lockout), enforces the password policy, ends the user's **other** sessions.
- **Forgot / reset**: `/api/auth/reset-password` emails a link to `/auth/callback?next=/reset-password`; the callback exchanges the code, sets the short-lived httpOnly `cmx-recovery` cookie and redirects. `POST /api/auth/password/reset` refuses without that cookie, sets the password and ends **every** session (including the recovery one); the page hard-navigates to `/login?reason=password_changed`.
- Users without a real email (synthetic `<user_code>@users.invalid` login) cannot receive reset mail: an HQ administrator resets their password.

---

## CSRF

- **When the token is set** — For every page request, `proxy.ts` sets a CSRF cookie when missing (so login/register get a token before auth).
- **Where it is required** — `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/auth/reset-password` require the `X-CSRF-Token` header and validate it against the cookie. Invalid or missing token → `403` with a message to refresh the page.
- **Client** — Auth context calls `getCSRFToken()` (GET `/api/auth/csrf-token`) before login/register/reset-password and sends the token in `X-CSRF-Token`.

---

## Remember me

- **Meaning** — Checkbox on the login page: **checked** = persistent auth cookies sized to the session's lifetime (the tenant's `AUTH_REMEMBER_ME_DAYS`, no idle timeout); **unchecked** = session-only cookies (signed out when the browser closes) with the idle/absolute policy. Default is unchecked. When the policy sets remember-me days to 0 the option is unavailable.
- **Where it is applied** — Login API reads `remember_me` (default `false`) and uses `createServerSupabaseClientForLogin(rememberMe)`; it sets the `sb-remember-me` cookie (`"1"`/`"0"`) so proxy, server client and browser client keep session vs persistent cookies across token refreshes. Logout clears `sb-remember-me`.

---

## Logout reasons and login banners

`signOut(reason)`: `user` | `session_expired` | `security` | `timeout` | `unknown`. The login page shows a banner for `?reason=` = `idle_timeout`, `session_expired`, `revoked`, `password_changed`, `session_limit`, `deactivated` (`loginReasonForEndReason` maps registry end reasons to these).

---

## Permissions & workflow roles loading

Permissions (`get_user_permissions`) and workflow roles (`get_user_workflow_roles`) are loaded once per tenant session. The loading is orchestrated by `refreshPermissions()` in `auth-context.tsx`.

### Load sequence

1. **Login** — `signIn()` calls `fetchAuthData()` which batches all three RPCs (`get_user_tenants`, `get_user_permissions`, `get_user_workflow_roles`) in one `Promise.all`. After state is set, `permissionsLoadedForTenantRef.current` is set to the tenant ID so the `useEffect` below is skipped.
2. **Page reload / session restore** — Auth initialises (`initializeAuth`), sets `user` and `currentTenant`. The permissions `useEffect` fires, sees `permissionsLoadedForTenantRef.current === null`, and calls `refreshPermissions()`.
3. **Logout / session expiry** — All permission state and `permissionsLoadedForTenantRef.current` are cleared to `null`. (There is no tenant switch any more: a different tenant means a different account.)

### Guards in `refreshPermissions()`

| Guard | Ref | Purpose |
|---|---|---|
| In-flight lock | `isFetchingPermissionsRef` | Prevents concurrent calls; returns immediately if already running |
| Already-loaded check | `permissionsLoadedForTenantRef` | Skips fetch if permissions were already loaded for the current tenant |

### `useEffect` dependency rule

The permissions `useEffect` depends only on `[user, currentTenant, isLoading]`. The `permissions` and `workflowRoles` state values are **intentionally excluded** from deps — including them would create a self-reinforcing loop (fetch sets state → length changes → effect re-fires → fetch again). See Issue 13 in `common-issues.md` for full diagnosis.

### Caching

- **Permissions** are cached in `permission-cache-client.ts` keyed by `tenant_id`. On cache hit, only `get_user_workflow_roles` is re-fetched.
- **Workflow roles** are never cached — always fetched fresh.

---

## Operations

- **Access-token lifetime:** `jwt_expiry = 600` (local: `supabase/config.toml`; hosted: Supabase Dashboard → Authentication → Sessions → "JWT expiry", or Project Settings → API → JWT expiry). It bounds how long a revoked session still works for direct PostgREST calls.
- **`secure_password_change = true`** (local: `config.toml` `[auth.email]`; hosted: Dashboard → Authentication → Providers → Email → "Secure password change"). It forces a recent sign-in for a user-initiated password update through GoTrue. The app's own change/reset flows run on the server and are unaffected.
- **Cron:** confirm `select jobname, schedule from cron.job where jobname = 'auth-session-sweep'` returns `*/5 * * * *`.
- **New-device alerts** use the Notification Hub template `security.login.detected.default` v2 (migration 0577); outbox delivery follows the Notification Hub setup.

---

## Key files

| Area | File(s) |
|---|---|
| Proxy / route | `web-admin/proxy.ts` |
| Session guard | `web-admin/lib/auth/session-guard.ts`, `lib/middleware/jwt-tenant-validator.ts` |
| Dashboard guard | `web-admin/app/dashboard/layout.tsx` |
| Auth context | `web-admin/lib/auth/auth-context.tsx` |
| Login / logout API | `web-admin/app/api/auth/login/route.ts`, `logout/route.ts` |
| Session use-cases / repository | `web-admin/lib/services/auth/session/**` |
| Config use-cases | `web-admin/lib/services/auth/config/**` |
| Client feature | `web-admin/src/features/auth-session/**` |
| Session APIs | `app/api/auth/session/activity`, `app/api/auth/sessions/me/**`, `app/api/users/sessions/**`, `app/api/auth/password/**`, `app/auth/callback` |
| Screens | `/dashboard/account/security`, `/dashboard/users/sessions`, `/dashboard/settings/security` |
| CSRF | `web-admin/lib/security/csrf.ts`, `web-admin/lib/utils/csrf-token.ts` |
| Remember me | `web-admin/lib/supabase/server.ts` (`createServerSupabaseClientForLogin`), login page + auth context |
| DB | migrations 0561, 0563, 0568, 0570, 0573, 0575, 0576, 0577 |
