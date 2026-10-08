# ADR — Server-authoritative session registry and membership-based tenant resolution

**Status:** Accepted (implemented, 2026-10)
**Scope:** web-admin sign-in, sessions, tenant resolution, auth audit, session policy
**Related:** [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md), [STATUS.md](STATUS.md), `docs/features/User_Session_Lifecycle/session-management-guide.md`

## Context

Staff sessions were raw Supabase Auth: password login → 1 h JWT + rotating refresh token → `signOut()`. There was no session model of our own, so the platform could not enforce idle or absolute timeouts, list or revoke devices, end sessions on password change or deactivation, limit concurrent sessions, or audit sign-out. Verification against the live database also found critical holes:

| # | Finding | Impact |
|---|---|---|
| S1 | `current_tenant_id()` trusted `auth.jwt()->user_metadata->tenant_org_id` without a membership check, and `user_metadata` is user-writable (231 of 324 RLS policies used it) | Any user could name any tenant and read/write across tenants |
| S2 | `getTenantIdFromSession()` returned the same unvalidated claim for ~50 Prisma callers (which bypass RLS) | Same leak on the server |
| S3 | `sys_audit_log` had RLS off and `SELECT` for `anon`/`authenticated` | Every tenant's login emails and IPs readable with the anon key |
| S4 | Lockout/audit functions executable by `anon` | Lock any account, reset lockouts, enumerate emails, forge audit rows |

## Decisions

1. **One auth account per tenant membership; no tenant switching.** `UNIQUE(user_id)` on `org_users_mst`. A session is bound to one tenant at sign-in. A person in two tenants uses two accounts (sign out → sign in). Sign-in identifier is a globally unique, case-insensitive **user code** or an email, plus password; every failure is a uniform `INVALID_CREDENTIALS`.
2. **Tenant resolution is membership-only.** `current_tenant_id()` is the caller's single active `org_users_mst` row; JWT and `user_metadata` claims are never consulted. A trigger on `auth.users` blocks forged `user_metadata.tenant_org_id`. This fixes the root cause once instead of patching ~25 readers; the remaining `user_metadata` readers are legacy and guarded.
3. **Session registry** `sys_auth_user_sessions_mst`: one row per `auth.sessions.id` (the JWT `session_id` claim) with `auth_user_id`, `org_user_id`, fixed `tenant_org_id`, device info and a **policy snapshot** (idle timeout, warning, absolute expiry, remember-me). RLS: own rows only; admin reads go through server APIs with explicit tenant filters.
4. **Server is authoritative.** One validation RPC (`fn_auth_session_validate`) identifies the caller from the JWT only, checks status/idle/absolute, ends and deletes the Supabase session on timeout, and touches `last_activity_at` only on a real-input heartbeat. The guard fails **closed**. The client only warns and asks the server before signing out.
5. **Idle means real input.** Pointer-down, key, wheel, touch and navigation, throttled to one heartbeat a minute and shared across tabs; background polling never extends a session. Remember-me sessions have no idle timeout; the absolute lifetime is never extendable.
6. **Revocation = end the registry row + delete the `auth.sessions` row** (the refresh token dies with it). Residual lag for direct PostgREST calls is bounded by `jwt_expiry` (600 s). Deactivation and membership removal revoke through a DB trigger, so every writer (tenant app, HQ platform-api, SQL) is covered with no cross-repo code.
7. **Policy config in two tables, not the settings system.** `sys_auth_admin_config_cf` (platform catalog; bounds; `is_allow_tenant_change`) and `org_auth_admin_config_cf` (tenant overrides, accepted only where allowed and within bounds, enforced by triggers). One SQL function resolves value + source (`PLATFORM`/`TENANT`/`PLATFORM_ENFORCED`); the result is snapshotted at sign-in. Editing by tenants is additionally gated by plan flag `session_timeout_control` and `auth_config:update`.
8. **Dedicated append-only audit** `sys_auth_audit_log` + `sys_auth_event_cd`; writes only through definer functions; `service_role` can insert but not update/delete. `sys_audit_log` is locked to the service role and left for its other uses.
9. **Password flows end sessions.** Self-service change has three server-decided paths: with the current password (a wrong one counts toward lockout) when policy `AUTH_PWD_REQUIRE_CURRENT` is on; with only new + re-typed password when it is off, limited to a sign-in no older than `AUTH_PWD_FRESH_SIGNIN_MIN` (otherwise `REAUTH_REQUIRED`); and a forced change after an administrator-set temporary password. Every successful change ends the user's other sessions. Reset by emailed link is only possible with the httpOnly recovery cookie set by `/auth/callback` or `/auth/confirm` and ends **all** sessions, including the recovery one. Every new password must pass the tenant's effective policy (strength, history via `fn_auth_pwd_reuse_check`, breached-password check); history is captured by a trigger on `auth.users`, so the tenant app and HQ share one rule. Administrators (tenant app `users:reset_password`, and HQ) can set a temporary password, email a one-time link, or unlock an account; a password itself is never emailed.
10. **Optional modules in scope:** concurrent-session limit (`REVOKE_OLDEST` / `BLOCK_NEW`) and new-device alert (Notification Hub event `security.login.detected`). **Deferred:** MFA, cmx-api enforcement (see [REMAINING_WORK.md](REMAINING_WORK.md)).

## Consequences

- One extra RPC per protected request (~5–20 ms; a 5 s per-process cache absorbs bursts). If the registry is unreachable, protected requests fail with 503 rather than open.
- The same real email cannot belong to two tenants (`auth.users.email` is unique): users without a real email get a synthetic `<user_code>@users.invalid` login and rely on administrator password resets.
- Role changes do not revoke sessions (permissions refresh through a separate path) — out of scope, noted as a follow-up.
- Routes that read `user.user_metadata.role` for authorization trust a user-editable field; this is outside this program and needs its own fix.
- Lowering `jwt_expiry` increases token refresh traffic modestly.

## Alternatives considered

- **Custom Access Token Hook injecting the tenant claim** — rejected: needs a hosted-dashboard ops step and still requires the membership check; membership-only resolution is simpler and has no claim to forge.
- **Reusing `sys_audit_log`** — rejected: wrong shape and exposure profile; a typed, immutable, tenant-aware table is safer.
- **Storing policy in the settings system** — rejected by the owner: auth policy needs per-item "tenant may change" gating and bounds enforced in the database.
- **Client-driven timeouts** — rejected: not enforceable; a closed tab or stolen token would never time out.
