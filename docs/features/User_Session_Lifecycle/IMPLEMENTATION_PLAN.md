# User Session Lifecycle — Implementation Plan

## Context

CleanMateX staff sessions today = raw Supabase Auth: password login → JWT (1h) + rotating refresh token → `signOut()`. There is **no session model of our own**, so we cannot: enforce idle/absolute timeout, list or revoke sessions/devices, revoke sessions on password change / deactivation, limit concurrent sessions, or audit logout. Exploration (verified against the **remote DB**) also surfaced **critical security holes that must ship first**:

| # | Finding (verified) | Impact |
|---|---|---|
| S1 | `current_tenant_id()` trusts `auth.jwt()->user_metadata->tenant_org_id` with **no membership check**; 231/324 RLS policies use it. `user_metadata` is writable by the user (`supabase.auth.updateUser`). | Any user can set any tenant id → cross-tenant RLS read/write |
| S2 | `getTenantIdFromSession()` (`web-admin/lib/db/tenant-context.ts:73`) returns `user.user_metadata.tenant_org_id` unvalidated; ~50 callers use it for **Prisma (bypasses RLS)** | Same cross-tenant leak on the server |
| S3 | `sys_audit_log`: RLS **off**, `SELECT` granted to `anon` + `authenticated` | Every tenant's login emails/IPs publicly readable with the anon key |
| S4 | `record_login_attempt`, `is_account_locked`, `unlock_account`, `log_audit_event` executable by `anon` | Lock any account, reset lockouts (`p_success=true`), enumerate emails, forge audit rows |

Other gaps: password-reset link targets a non-existent `/auth/reset-password` route and nothing exchanges the code; deactivation/password reset never revoke sessions; logout is implicitly `global` and only logged to console; login ignores `?redirect=`; logout API runs twice; `'timeout'` logout reason never fires; flag `session_timeout_control` exists but is unused; no session/security policy config; lockout thresholds hardcoded in SQL.

**Outcome:** a server-authoritative session lifecycle — login → registered session (device, tenant, policy snapshot) → validated activity → idle/absolute timeout with warning → logout/revoke (self, admin, password change, deactivation, concurrency) → audited end — plus the two approved optional modules: **concurrent session limit** and **new-device sign-in alert**. (MFA and cmx-api enforcement explicitly deferred.)

## Architecture (decided)

0. **Identity model (decided by user, supersedes earlier multi-tenant/switch design):** one auth account per tenant membership (`UNIQUE (user_id)` on `org_users_mst`); a session is bound to exactly one tenant at sign-in; **no tenant switching** — to use another tenant the user signs out and signs in with that tenant's account. Sign-in identifier = **globally unique `user_code`** *or* email, plus password. (Verified: 5 users / 3 tenants / 0 multi-tenant users today, so the 1:1 constraint is free.)
1. **Session registry** `sys_auth_user_sessions_mst` — one row per `auth.sessions.id` (JWT `session_id` claim); tenant fixed per row (`tenant_org_id`); RLS = own rows only; admin reads go through server API with explicit tenant filter.
2. **Tenant resolution is membership-only:** `current_tenant_id()` = the caller's single active `org_users_mst` row (JWT/user_metadata claim no longer consulted — finalized in the user_code migration). **No Custom Access Token Hook and no hosted-dashboard ops step**; revocation works by deleting `auth.sessions` (refresh dies with it). `user_metadata.tenant_org_id` stays only for legacy readers, guarded by the 0561 trigger, and is retired in code over time.
3. **Single validation RPC** `fn_auth_session_validate(p_touch)` — caller's own session (from `auth.jwt()`): checks status, idle deadline, absolute expiry; ends + deletes `auth.sessions` row when timed out; optionally touches `last_activity_at` (throttled). One round-trip used by proxy + server auth helpers.
4. **Idle = real user activity only** (client heartbeat after pointer/key/touch input or navigation, max 1/60s, BroadcastChannel-shared across tabs). Background polling never extends a session. Server is authoritative; client only warns.
5. **Two-table auth config (not the settings system)**: `sys_auth_admin_config_cf` = global catalog, one row per config item (platform value, type, bounds, `is_allow_tenant_change`, HQ-owned); `org_auth_admin_config_cf` = tenant override rows, accepted **only** for items where `is_allow_tenant_change = true` and within the global bounds. Effective value = tenant override if still allowed + valid, else platform value — resolved by one SQL function and **snapshotted onto the session at login/tenant-switch** → no config lookup per request. Adding a new auth config item later = insert one catalog row (no schema change).
6. **Audit = dedicated `sys_auth_audit_log`** (insert-only) + catalog `sys_auth_event_cd`; typed `auth_user_id`, `org_user_id`, `auth_session_id`, nullable `tenant_org_id`, `event_code`, `outcome`, ip/UA/device, `details jsonb`. RLS: user reads own rows, tenant admin reads tenant rows; writes only via SECURITY DEFINER fns. All session/config/lockout writers (`record_login_attempt`, `fn_auth_session_*`, config updates) log here; daily purge > 180 days. `sys_audit_log` is left for its other uses (hardened in 0561); the Phase-0 Activity route is repointed to the new table in Phase 1. (Supersedes the earlier "reuse sys_audit_log" decision — changed per user.)
7. **Revocation = end registry row + DELETE `auth.sessions`** (postgres has DELETE on auth.sessions/refresh_tokens — verified). Residual lag for direct browser→PostgREST calls ≤ JWT expiry → lower `jwt_expiry` 3600 → 600.
8. **Deactivation/membership removal revoke via DB trigger** on `org_users_mst` → covers both tenant app and HQ platform-api with zero cross-repo code.

## Layering (separation of concerns, domain-agnostic)
Auth-session is a **platform capability**, not laundry-domain code — no order/POS imports in either direction.
```
DB (source of truth)   sys_auth_user_sessions_mst, sys_auth_admin_config_cf, org_auth_admin_config_cf + fn_auth_*
                       (rules that must hold for every caller: validate, end, revoke, limit, config validation/resolution, login-identifier resolution)
Infrastructure         lib/services/auth/session/auth-session.repository.ts   (RPC/SQL only, explicit tenant filters)
Application/use-cases  lib/services/auth/session/use-cases/*.ts              (start-session, validate-session, end-session,
                                                                               revoke-sessions, change-password)
Domain (pure)          lib/services/auth/session/domain/*.ts                 (policy resolution types, reason mapping, device label parser)
Events                 auth.session.started / ended / revoked / limit_hit    (internal emitter → audit + Notification Hub; no direct coupling)
Delivery               app/api/auth/**, app/api/users/[userId]/sessions/**   (thin: auth → Zod → use-case → map result)
Edge                   proxy.ts + lib/auth/session-guard.ts                  (validate, redirect, cookie hygiene)
Client                 src/features/auth-session/{model,hooks,api,ui}        (pure idle state machine, tracker, fetchers, Cmx UI)
```

## UX standards (all new screens)
Loading skeletons, empty states, error states with retry, optimistic disable on destructive buttons, `CmxConfirmDialog` for every revoke, `cmxMessage` for outcomes, relative times with absolute tooltip (tenant timezone), device icons, "This device" badge, keyboard + screen-reader support, mobile/tablet responsive, full EN/AR + RTL. i18n namespace `messages/{en,ar}/auth-session/` (+ reuse `common.*`).

## Phases

> Rules for every phase: load skills before writing (`/database` `/multitenancy` `/backend` `/frontend` `/i18n` `/code-documentation`, plus `/create-update-rbac-permission`, `/update-rbac-role`, `/rebuild-ui-access-contract`, `/navigation` where relevant). Every migration: create file → **STOP, user applies** → `/pull-prisma`. Every `org_*` query carries explicit `tenant_org_id`. UI uses Cmx components + `cmxMessage`; EN/AR + RTL. Each phase ends with STATUS.md update + doc refresh + `/documentation`.

### Step 0 — Docs home
Create `docs/features/User_Session_Lifecycle/` with this plan as `IMPLEMENTATION_PLAN.md`, `STATUS.md`, `QA_TEST_GUIDE.md` (filled per phase), `ADR-session-registry-and-tenant-claim.md`.

### Phase 0 — Critical security hardening (ships alone, first)
**Migration `0561_auth_security_hardening.sql`**
- `current_tenant_id()` → `SET search_path`; return claim tenant (top-level `tenant_org_id`, then legacy `user_metadata` during transition) **only if `EXISTS` active `org_users_mst` membership for `auth.uid()`**, else existing fallback (most recent active membership).
- `sys_audit_log`: `ENABLE ROW LEVEL SECURITY`; `REVOKE ALL FROM anon, authenticated` (service_role only).
- `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated; GRANT … TO service_role` on `record_login_attempt`, `is_account_locked`, `unlock_account`, `auto_unlock_expired_accounts`, `log_audit_event`; revoke `admin_locked_accounts` view from anon/authenticated. (Grep app callers of these first; `switch_tenant_context` calls `log_audit_event` as definer — unaffected.)

**Code**
- `web-admin/lib/db/tenant-context.ts` `getTenantIdFromSession()` → `rpc('current_tenant_id')` (now membership-validated; single source of truth).
- `web-admin/app/api/auth/login/route.ts` → lockout RPCs via `createAdminSupabaseClient()` (`lib/supabase/server.ts`).
- `src/features/users/ui/user-activity-tab.tsx` → stop browser-side `sys_audit_log` read; new `GET /api/users/[userId]/activity` (`audit:read`, explicit `tenant_org_id`, service role).
- `lib/monitoring/tenant-isolation-monitor.ts` → ensure service-role client for its `sys_audit_log` insert.
- Tests (db-integration harness `web-admin/__tests__/db-integration/`): forged user_metadata tenant → `current_tenant_id()` returns own tenant; anon cannot select `sys_audit_log` / execute lockout fns.

### Phase 1a — `user_code`, one account per tenant, sign-in by user code or email
**Migration (next number after 0561) `…_org_users_user_code.sql`**
- `org_users_mst.user_code TEXT NOT NULL`: platform-wide unique, case-insensitive (`CREATE UNIQUE INDEX … ON org_users_mst (lower(user_code))`), CHECK format `^[A-Za-z0-9][A-Za-z0-9._-]{2,29}$` (≤30 chars, no spaces/@ so it can never be confused with an email).
- Auto-generation: sequence `org_user_code_seq` + BEFORE INSERT trigger fills `U` + zero-padded number when no code is supplied (so HQ platform-api user creation keeps working unchanged); backfill the 5 existing rows. Admin may set a custom code (same validation) via the new local route below; changes audited (`CONFIG_CHANGED`-style event `USER_CODE_CHANGED` added to `sys_auth_event_cd`).
- `UNIQUE (user_id)` on `org_users_mst` (one auth account ↔ one tenant membership); the existing `UNIQUE (user_id, tenant_org_id)` stays for composite-FK compatibility. Pre-check query for duplicates in the migration; Prisma `db pull` afterwards.
- `current_tenant_id()` finalized: pure membership lookup (`org_users_mst WHERE user_id = auth.uid() AND is_active`), JWT/user_metadata claims ignored.
- `fn_auth_resolve_login_identifier(p_identifier TEXT)` (service_role only): contains `@` → treat as email; else match `lower(user_code)`; returns `(auth_user_id, email, org_user_id, tenant_org_id, is_active)` or no row. Also a lookup helper so lockout (`is_account_locked`/`record_login_attempt`, keyed by email) keeps working with resolved email.
- Drop `get_user_tenants` multi-tenant assumptions only where needed (function stays; returns the single membership).

**Code**
- Login API accepts `identifier` (+ legacy `email` field accepted for compatibility during rollout) → `fn_auth_resolve_login_identifier` (service role) → `signInWithPassword(resolved email, password)`. **Uniform failure** (`INVALID_CREDENTIALS`) for unknown identifier vs wrong password (no enumeration); unknown identifier still logs `LOGIN_FAILURE` with `login_identifier` and is covered by IP rate limiting; inactive membership → generic deactivated message after correct password only.
- Login page: single field "User code or email", autocomplete `username`, helper text, EN/AR, RTL; reason banners.
- Users admin UI: **User code** column + detail field; local route `PATCH /api/users/[userId]/user-code` (`users:update`, explicit `tenant_org_id`, service role, uniqueness error mapped to inline field message, audit event). Create-user form: optional "User code" (blank = auto) — HQ follow-up to pass it through platform-api.
- Remove tenant switching (done in 0561 + code): `switchTenant`, top-bar switch menu, `switch_tenant_context`.
- Tests: resolver (email vs code, case-insensitivity, inactive, unknown), uniqueness + format CHECK, 1:1 constraint rejects a 2nd membership, login uniform-error behavior, `current_tenant_id()` membership-only.

### Phase 1 — Session registry foundation
**Migration `0562_auth_admin_config.sql`** — global catalog + tenant overrides:

`sys_auth_admin_config_cf` (global, HQ-owned, one row per item)
- `config_code TEXT PK`, `name`/`name2`, `description`/`description2`, `config_group` CHECK (`SESSION|DEVICE|LOCKOUT`), `value_type` CHECK (`INTEGER|BOOLEAN|ENUM`), `unit` CHECK (`SECONDS|MINUTES|HOURS|DAYS|COUNT|NONE`).
- `config_value TEXT NOT NULL` (platform value), `min_value INTEGER`, `max_value INTEGER`, `allowed_values TEXT[]` (ENUM) — bounds apply to platform value **and** tenant overrides.
- `is_allow_tenant_change BOOLEAN NOT NULL DEFAULT false` (false = platform-managed; no separate `is_platform_only` column).
- `display_order`, standard audit cols, `is_active`, `rec_status`. RLS on: authenticated SELECT active rows; writes service role / HQ only.

`org_auth_admin_config_cf` (tenant override)
- `id uuid PK`, `tenant_org_id NOT NULL → org_tenants_mst ON DELETE CASCADE`, `config_code → sys_auth_admin_config_cf(config_code)`, `config_value TEXT NOT NULL`, `rec_notes`, standard audit cols, `is_active`, `rec_status`.
- `UNIQUE (tenant_org_id, config_code)` (tenant-first); "reset to platform default" = soft-deactivate (`is_active=false, rec_status=0`); re-override reactivates the row via upsert.
- RLS: standard tenant isolation (`tenant_org_id = current_tenant_id()`) for SELECT; writes via server API (service role, explicit `tenant_org_id`).

Shared validation
- `fn_auth_cfg_value_valid(p_code, p_value)` — type parse, min/max, allowed values.
- Trigger on `sys_*`: platform value valid. Trigger on `org_*` (BEFORE INSERT/UPDATE): parent active, `is_allow_tenant_change = true`, value valid against parent bounds — otherwise raise.
- `fn_auth_config_effective(p_tenant_org_id)` → `(config_code, effective_value, platform_value, tenant_value, source PLATFORM|TENANT|PLATFORM_ENFORCED, is_allow_tenant_change, min_value, max_value, allowed_values)`. `PLATFORM_ENFORCED` = an override exists but HQ has since disallowed it or tightened bounds → ignored, flagged in UI.

Seed (codes mirrored in `lib/constants/auth-admin-config.ts`)
| Code | Group | Type | Default | Bounds | Tenant may change |
|---|---|---|---|---|---|
| `AUTH_IDLE_TIMEOUT_MIN` | SESSION | INTEGER | 30 (0 = off) | 0–480 | ✅ |
| `AUTH_IDLE_WARNING_SEC` | SESSION | INTEGER | 60 | 15–300 | ✅ |
| `AUTH_SESSION_MAX_HOURS` | SESSION | INTEGER | 12 | 1–72 | ✅ |
| `AUTH_REMEMBER_ME_DAYS` | SESSION | INTEGER | 7 (0 = disabled) | 0–30 | ✅ |
| `AUTH_MAX_SESSIONS_PER_USER` | SESSION | INTEGER | 0 (unlimited) | 0–20 | ✅ |
| `AUTH_SESSION_LIMIT_POLICY` | SESSION | ENUM | `REVOKE_OLDEST` | `REVOKE_OLDEST`,`BLOCK_NEW` | ✅ |
| `AUTH_NEW_DEVICE_ALERT` | DEVICE | BOOLEAN | true | — | ✅ |
| `AUTH_LOCKOUT_MAX_ATTEMPTS` | LOCKOUT | INTEGER | 5 | 3–20 | ❌ platform-only |
| `AUTH_LOCKOUT_MINUTES` | LOCKOUT | INTEGER | 15 | 1–1440 | ❌ platform-only |
| `AUTH_LOCKOUT_WINDOW_MIN` | LOCKOUT | INTEGER | 60 | 5–1440 | ❌ platform-only |

- `record_login_attempt` re-created to read the LOCKOUT items (removes hardcoded constants; lockout is pre-tenant/email-keyed → platform-only by design).
- Config changes apply to **new sign-ins** (snapshot at sign-in); UI states this.
- Flag `session_timeout_control` gates tenant **editing** (API-level; the DB resolver stays flag-agnostic because flags are HQ-API-consumed). On plan downgrade HQ deactivates that tenant's overrides (HQ follow-up).

**Migration `0563_auth_session_registry.sql`**
- `sys_auth_sess_end_rsn_cd` (bilingual code table): `USER_LOGOUT, IDLE_TIMEOUT, ABSOLUTE_TIMEOUT, USER_REVOKED, ADMIN_REVOKED, PASSWORD_CHANGED, USER_DEACTIVATED, MEMBERSHIP_REMOVED, SESSION_LIMIT, SECURITY`.
- `sys_auth_user_sessions_mst`: `id`, `auth_session_id uuid UNIQUE`,
  - **`auth_user_id` → `auth.users(id) ON DELETE CASCADE`** (NOT NULL),
  - **`org_user_id` → `org_users_mst(id) ON DELETE SET NULL`** (membership row for the active tenant; nullable so ended-session history survives membership deletion; DB functions enforce it matches `(auth_user_id, tenant_org_id)` — `org_users_mst` has only `PK(id)` + `UNIQUE(user_id, tenant_org_id)`, verified),
  - `tenant_org_id → org_tenants_mst` (fixed for the session lifetime), `status TEXT CHECK (ACTIVE|ENDED)`, `end_reason_code → cd`, `ended_at`, `ended_by`, `login_method`, `is_remember_me`, `idle_timeout_sec` (0=off), `idle_warning_sec`, `expires_at` (absolute), `last_activity_at`, `last_seen_at`, `login_ip inet`, `last_ip inet`, `user_agent`, `device_label`, `device_id_hash`, standard audit + `rec_status`.
  - Indexes: `(auth_user_id, status)`, `(org_user_id)`, `(tenant_org_id, status, last_activity_at)`, `(status, expires_at)`, `(auth_user_id, device_id_hash)`. RLS: authenticated SELECT `auth_user_id = auth.uid()`; no write policies.
- `sys_auth_event_cd` (bilingual catalog) + `sys_auth_audit_log` (see Architecture #6): events `LOGIN_SUCCESS, LOGIN_FAILURE, ACCOUNT_LOCKED, LOGOUT, SESSION_IDLE_TIMEOUT, SESSION_REVOKED, PASSWORD_CHANGED, NEW_DEVICE, SESSION_LIMIT_HIT, CONFIG_CHANGED`; indexes `(auth_user_id, created_at DESC)`, `(tenant_org_id, created_at DESC)`, `(auth_session_id)`; REVOKE UPDATE/DELETE from all API roles; `fn_auth_log_event(...)` internal writer (service_role / definer only). Replaces every `sys_audit_log` write in this program; `record_login_attempt` re-created to use it.
- Functions (SECURITY DEFINER, fixed search_path, full COMMENT ON):
  - `fn_auth_session_policy(p_tenant)` — thin typed wrapper over `fn_auth_config_effective` → idle/warning/absolute/remember-me/limit/alert values for the snapshot.
  - `fn_auth_session_register(...)` (service_role) — idempotent insert (`ON CONFLICT auth_session_id DO NOTHING`), policy snapshot, audit `login_success` with tenant + session_id; returns `{status, new_device, blocked}` (Phase 5 extends).
  - `fn_auth_session_validate(p_touch boolean)` (authenticated, own session only) → `{state: ACTIVE|ENDED|NOT_REGISTERED, end_reason, tenant_org_id, idle_remaining_sec, absolute_remaining_sec, idle_warning_sec}`; ends on timeout (+ delete `auth.sessions`, audit).
  - `fn_auth_session_end(p_auth_session_id, p_reason, p_actor)` and `fn_auth_sessions_revoke(p_auth_user_id, p_tenant_org_id, p_reason, p_except_session, p_actor)` (service_role) — idempotent, delete `auth.sessions`, audit.

**Ops (user action, documented):** set JWT expiry 600s and enable `secure_password_change` (Supabase dashboard + `supabase/config.toml`). No token hook needed.

**Code**
- `lib/constants/auth-session.ts` (end-reason codes = DB strings, `session_limit_policy` values = DB CHECK strings, channel name, reason↔URL mapping) + `lib/constants/auth-admin-config.ts` (config codes, groups, value types, sources — exact DB strings) + `lib/types/auth-admin-config.ts` (catalog item / tenant override / effective item shapes) + `lib/types/auth-session.ts`.
- `lib/services/auth/session/` per the Layering section: repository (RPC wrappers, explicit tenant filters), use-cases, pure domain helpers (UA → device label, reason ↔ URL code mapping), internal event emitter feeding audit + Notification Hub.
- `lib/services/auth/config/` — `auth-admin-config.repository.ts` (`rpc('fn_auth_config_effective')`; upsert/deactivate `org_auth_admin_config_cf` rows with explicit `tenant_org_id`) + use-cases `get-effective-auth-config`, `update-tenant-auth-config` (batch; per-item Zod schema built from catalog type/bounds/allowed values; rejects items with `is_allow_tenant_change=false`; flag `session_timeout_control` + `auth_config:update`; audit old/new in `sys_audit_log`).
- `lib/auth/session-guard.ts` — `getValidatedSession = cache(...)`: `supabase.auth.getClaims()` (supabase-js 2.75) → `rpc('fn_auth_session_validate', {p_touch:false})`; `NOT_REGISTERED` → lazy register (covers recovery-link / pre-existing sessions).
- Wire guard into: `web-admin/proxy.ts` (protected pages → on ENDED: clear auth cookies, redirect `/login?reason=…&redirect=…`), `getAuthContext` in `lib/auth/server-auth.ts` and `lib/middleware/require-permission.ts` (→ 401 `SESSION_ENDED`), `getTenantIdFromSession` (tenant from validated session).
- Retire user_metadata tenant machinery (session-guard supplies tenant from membership): `lib/auth/jwt-tenant-manager.ts`, `lib/auth/jwt-refresh-handler.ts`, `lib/middleware/jwt-tenant-validator.ts` (grep callers; pre-launch → delete, no shims).

### Phase 2 — Login / logout rewired (session registration, redirect, reasons)
- **Login API**: after `signInWithPassword` read `session_id` from returned token claims → `fn_auth_session_register` (ip, UA, parsed device label, `cmx-did` device cookie hash, remember-me); remove `ensureTenantInUserMetadata`; `sb-remember-me` cookie maxAge = effective `remember_me_days` (checkbox hidden when 0).
- **Login page** `app/(auth)/login/page.tsx` + `signIn()` in `lib/auth/auth-context.tsx`: honor `?redirect=` through new `lib/security/safe-redirect.ts` (internal path only: starts `/`, not `//` or `/\`, no scheme); reason banners: `idle_timeout`, `session_expired`, `revoked`, `password_changed`, `session_limit`.
- **No tenant switch** (retired in 0561 + code removed): top bar shows the tenant name read-only; switching tenants = sign out, sign in with the other tenant's account.
- **Logout (single path)**: `signOut(reason)` → `POST /api/auth/logout` ends registry row with mapped reason + server `signOut({scope:'local'})`; client `signOut({scope:'local'})` (no more implicit global), clear **all** client state (react-query `clear()`, `permissions_cache`, `feature_flags_cache`, `navigation_cache`, sessionStorage), broadcast `LOGOUT`. `app/(auth)/logout/page.tsx` stops calling the API itself (double-call fix).
- **Cross-tab** `BroadcastChannel('cmx-auth-session')`: `ACTIVITY`, `LOGOUT`.
- (tenant-claim finalization moved into the user_code migration below.)

### Phase 3 — Idle & absolute timeout
- `POST /api/auth/session/activity` → `fn_auth_session_validate(true)` → remaining seconds.
- Feature module `web-admin/src/features/auth-session/`:
  - `model/idle-timer.ts` — pure state machine (ACTIVE → WARNING → EXPIRED) driven by server-returned *remaining seconds* (clock-skew safe).
  - `hooks/use-activity-tracker.ts` — pointer/key/touch/wheel + route change; local throttle, server ping ≤1/60s only if activity occurred; BroadcastChannel sync; on `visibilitychange→visible` re-validate (no touch).
  - `ui/session-lifecycle-provider.tsx` mounted in `app/dashboard/layout.tsx`.
  - `ui/session-idle-warning-dialog.tsx` — `CmxDialog`, live countdown (`aria-live`), "Stay signed in" / "Sign out now", RTL.
  - Absolute-expiry heads-up (non-extendable) 5 min before via `cmxMessage.warning` once.
  - Expiry → `signOut('idle_timeout')` → `/login?reason=idle_timeout&redirect=<current>`.

### Phase 4 — Revocation & management surfaces
**APIs** (thin routes → session use-cases; Zod validation; uniform error codes `SESSION_ENDED`, `SESSION_NOT_FOUND`, `CANNOT_REVOKE_CURRENT`, `SESSION_LIMIT_REACHED`)
- Self (authenticated only): `GET /api/auth/sessions/me`, `DELETE /api/auth/sessions/me/[sessionId]` (`USER_REVOKED`, not current), `POST /api/auth/sessions/me/revoke-others`.
- Admin: `GET /api/users/[userId]/sessions` (`user_sessions:read`), `POST /api/users/[userId]/sessions/revoke` `{sessionId?}` (`user_sessions:revoke`, `ADMIN_REVOKED`) — scoped to sessions whose `tenant_org_id = caller tenant` AND target is a member of caller tenant.
- Password: `POST /api/auth/password/change` (current + new; `updateUser`; revoke others `PASSWORD_CHANGED`; audit) and post-reset hook ending **all** sessions incl. recovery session → `/login?reason=password_changed`.

**Migration `0565_user_sessions_permissions_nav.sql`** — `sys_components_cd` rows for `/dashboard/users/sessions` and `/dashboard/settings/security` + permissions `user_sessions:read`, `user_sessions:revoke`, `auth_config:read`, `auth_config:update` (+ role grants via `/update-rbac-role`: tenant_admin, super_admin); constants `lib/constants/permissions/user-sessions-perm.ts`, `lib/constants/permissions/auth-config-perm.ts`.

**Migration `0566_auth_session_revoke_triggers.sql`** — `AFTER UPDATE OF is_active / DELETE` on `org_users_mst` → `fn_auth_sessions_revoke(user, tenant, USER_DEACTIVATED|MEMBERSHIP_REMOVED)` for sessions active in that tenant.

**Password reset fix**: new `app/auth/callback/route.ts` (`exchangeCodeForSession`, safe `next`); `app/api/auth/reset-password/route.ts` redirectTo `/auth/callback?next=/reset-password`; `app/(auth)/reset-password/page.tsx` uses the established recovery session.

**UI**
- New page `/dashboard/account/security` (`app/dashboard/account/security/page.tsx` + `src/features/auth-session/ui/*`): active sessions list (device, IP, signed-in, last active, "This device" badge, sign-out with `CmxConfirmDialog`), "Sign out all other sessions", change-password form, recent own sign-in activity. Entry from top-bar user menu (`src/ui/navigation/cmx-top-bar.tsx`). Access contract via scaffold → derive → wire → check → sync; `/navigation` skill decides whether a `sys_components_cd` row is needed.
- `src/features/users/ui/user-sessions-tab.tsx` on `/dashboard/users/[userId]` (revoke one/all); activity tab shows auth events with i18n labels.
- **Tenant-wide admin screen** `/dashboard/users/sessions` ("Active Sessions"): `CmxDataTable` of all active sessions in the tenant (user, role, device, IP, signed-in, last active, idle remaining), filters (user, device type, inactive > N min), row revoke + bulk revoke + "sign out all users" (emergency, double confirm), server-side pagination. API `GET /api/users/sessions` (`user_sessions:read`), `POST /api/users/sessions/revoke` (`user_sessions:revoke`, bulk ids or `all`). Sidebar entry under Users → **navigation dual-write** (`config/navigation.ts` + `sys_components_cd` migration via `/navigation`).
- **Security policy screen** `/dashboard/settings/security` ("Security & Sessions"): items grouped (Session · Device · Sign-in lockout), rendered generically from the catalog (type → input: number with unit/stepper, switch, select). Each item shows effective value, platform default, allowed range, and source badge (Platform default / Custom / "Managed by platform" when `is_allow_tenant_change=false` / "Override no longer allowed" for `PLATFORM_ENFORCED`). Editable items: "Use platform default" toggle (deactivates override) or custom value; inline validation from catalog bounds; plain-language effect hints; "applies to new sign-ins" note; dirty-state save bar; outcomes via `cmxMessage`. Editable only when flag `session_timeout_control` is on **and** `auth_config:update`; otherwise read-only with upgrade/permission hint. APIs `GET /api/settings/auth-config` (`auth_config:read`; catalog + override + effective per item) and `PUT /api/settings/auth-config` (`auth_config:update`; batch `[{config_code, value | null}]`, `null` = reset). Sidebar entry under Settings → navigation dual-write.

### Phase 5 — Concurrent session limit + new-device alert
- `fn_auth_session_register` (new migration `0567_auth_session_limit_and_device.sql`, CREATE OR REPLACE): count ACTIVE sessions for user in tenant; if limit > 0 and reached: `REVOKE_OLDEST` → end least-recently-active (`SESSION_LIMIT`, audited); `BLOCK_NEW` → return blocked → login API deletes the new auth session, 409 `SESSION_LIMIT_REACHED` with explanatory message.
- Device cookie `cmx-did` (random 128-bit, httpOnly, Secure, SameSite=Lax, ~400 days) set in proxy if missing; hashed into `device_id_hash`. New device = no prior registry row for `(auth_user_id, device_id_hash)`.
- New device + effective `new_device_alert` → emit existing notification event `security.login.detected` (seeded in `0345_ntf_catalog_seed.sql`) via the Notification Hub outbox service (payload: device label, IP, time, tenant, link to account security page). Verify EN/AR templates exist; seed if missing (in the same migration).

### Phase 6 — Housekeeping, tests, docs
- **Migration `0568_auth_session_sweep_cron.sql`** (pg_cron present — verified): every 5 min `fn_auth_sessions_sweep()` ends ACTIVE rows past idle/absolute deadline or whose `auth.sessions` row vanished; daily purge of ENDED rows > 180 days.
- **Tests**: jest — `safe-redirect`, `idle-timer` state machine, activity tracker throttle/broadcast, session-guard reason mapping, all new API routes (401 on ended session, permission gates, cross-tenant revoke denied, tenant filter present). db-integration — hook claim (forged metadata ignored, ENDED → error), validate timeouts/touch throttle, config resolver (override used / rejected when disallowed / `PLATFORM_ENFORCED` after bound tightening, trigger rejects platform-only override), revoke fns delete `auth.sessions`, trigger on deactivation, concurrency policies, Phase-0 grants.
- **Docs**: feature folder STATUS/QA guide (sidebar path + URL + clicks per scenario), ADR, update `docs/dev/session-management-guide.md`, tick `docs/security/AUTH_SYSTEM_EVALUATION.md` checklist, implementation requirements (permissions, `sys_auth_admin_config_cf` / `org_auth_admin_config_cf` config items, flag semantics, i18n keys, API routes, migrations, env/ops steps). `/rebuild-platform-info-inventories` refresh (api, page, permissions).
- **HQ follow-ups (cleanmatexsaas, documented in `docs/dev/rules/integration-contracts.md`)**: platform-api `resetPassword` → call `fn_auth_sessions_revoke(..., 'PASSWORD_CHANGED')`; HQ screen to manage `sys_auth_admin_config_cf` items (platform value, bounds, `is_allow_tenant_change`) and view/edit/reset any tenant's `org_auth_admin_config_cf` overrides (HQ bypasses the `session_timeout_control` gate); on plan downgrade deactivate the tenant's overrides.

## Reused building blocks
`createAdminSupabaseClient` / `createServerSupabaseClientForLogin` (`lib/supabase/server.ts`), `checkLoginRateLimit` (`lib/middleware/rate-limit.ts`), CSRF (`lib/security/csrf`), `isPublicRoutePath` (`lib/security/public-routes.ts`), `onLogoutInvalidate` (`lib/auth/on-logout-invalidate.ts`), `LogoutReason` (`lib/auth/logout-tracker.ts` — extended), `log_audit_event`, `sys_audit_log`, Notification Hub outbox, flag `session_timeout_control`, users feature tabs (`src/features/users/ui/`), `requirePermission`, Cmx `CmxDialog` / `CmxConfirmDialog` / `CmxDataTable`, `cmxMessage`.

## Risks / trade-offs
- 1:1 account-per-tenant means the same real email cannot be reused in two tenants (`auth.users.email` is unique): a person in two tenants needs two accounts/emails (or a synthetic login email + user code). HQ user-creation must generate a synthetic email (`<user_code>@users.invalid`) for users without a real one; password reset for those users is admin-driven.
- Proxy adds one RPC per page navigation (~5–20 ms); API routes already do auth lookups.
- Revocation lag for direct browser→Supabase queries ≤ JWT expiry (600s after ops change).
- Idle timeout mid-POS order: warning dialog + tenant override in `org_auth_admin_config_cf`; branch/role-level override deferred (override table can gain nullable `branch_id`/`role_code` scope columns later; resolver picks most specific).
- Login still returns tokens in JSON body (client `setSession`) — left as-is to avoid destabilizing login; flagged as follow-up.
- Role change does not revoke sessions (permissions refresh path is separate) — flagged.
- Lockout thresholds move to platform-only catalog items (pre-tenant, email-keyed → never tenant-overridable).

## Verification
- Per phase: `npm run build`, `npx eslint . --quiet`, `npx tsc --noEmit` (web-admin), `npm run check:i18n`, targeted jest + db-integration suites; `check:ui-access-contract --wire`, `check:platform-info-inventories`.
- Remote DB read-only probes after each applied migration: grants (`has_function_privilege`/`has_table_privilege` for anon), `current_tenant_id()` behavior, `pg_policies` unchanged count, cron job registered.
- Manual QA (QA_TEST_GUIDE): forged `updateUser({data:{tenant_org_id}})` has no effect; login → session visible on Account › Security; idle 1-min test setting → warning dialog → auto logout → login returns to original page; two tabs share activity & logout; revoke other device → its next page/API call lands on `/login?reason=revoked`; admin revoke from Users › Sessions; deactivate user → sessions end; password change/reset flows; limit=1 with both policies; new browser → `security.login.detected` notification.
