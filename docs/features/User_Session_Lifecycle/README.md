# User Session Lifecycle

Server-authoritative sign-in → registered session → activity → idle/absolute timeout (with warning) → logout / revoke → audit, for web-admin staff. HQ counterpart: `F:\jhapp\cleanmatexsaas\docs\features\Auth_Session_Config\`.

**Status (2026-10-09):** code complete in both repos, all migrations applied (local + remote); owner manual QA and commits pending. Progress: [STATUS.md](STATUS.md). What is left, what was left out on purpose and what belongs to other programs: [REMAINING_WORK.md](REMAINING_WORK.md).

## Documents in this folder

| File | Purpose |
|---|---|
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | Approved plan (scope, architecture, phases) |
| [STATUS.md](STATUS.md) | Phase-by-phase progress, decisions, validation results |
| [REMAINING_WORK.md](REMAINING_WORK.md) | What is left to close the plan, later-phase items, items owned by other programs |
| [session-management-guide.md](session-management-guide.md) | Developer guide: lifecycle, policy, revocation, audit, operations |
| [ADR-session-registry-and-tenant-claim.md](ADR-session-registry-and-tenant-claim.md) | Why the design is what it is |
| [QA_TEST_GUIDE.md](QA_TEST_GUIDE.md) | Owner-runnable scenarios (sidebar path, URL, clicks) |
| [CHANGELOG.md](CHANGELOG.md) | What shipped, by migration / area |

## Screens

| Screen | Route | Access |
|---|---|---|
| Account security (my devices, change password) | `/dashboard/account/security` (user menu) | any signed-in user |
| Active Sessions (tenant-wide) | `/dashboard/users/sessions` (Team Members → Active Sessions) | `user_sessions:read` (+ `user_sessions:revoke` for actions) |
| User detail → Sessions tab, Activity tab | `/dashboard/users/[userId]` | `user_sessions:read`; `audit:read` |
| Security & Sessions policy | `/dashboard/settings/security` (Config And Settings) | `auth_config:read` (+ `auth_config:update` and plan flag `session_timeout_control` to edit) |
| Reset password | `/reset-password` (from the emailed link via `/auth/callback` or `/auth/confirm`) | recovery session only |
| Forced password change | `/change-password` (automatic redirect) | account flagged `pwd_must_change` |
| Reset / unlock another user | user detail header buttons | `users:reset_password` |

## Permissions (migration 0573)

`auth_config:read`, `auth_config:update`, `user_sessions:read`, `user_sessions:revoke` — default roles `super_admin`, `tenant_admin`, `admin`. `users:reset_password` (seeded earlier; `admin` added by 0581) gates set-password / email-link / unlock. Constants: `lib/constants/permissions/{auth-config-perm,user-sessions-perm}.ts`.

## API routes (web-admin)

| Method + path | Auth |
|---|---|
| `POST /api/auth/login`, `POST /api/auth/logout` | public (CSRF) / session |
| `POST /api/auth/session/activity` | session (heartbeat/status) |
| `GET /api/auth/sessions/me`, `DELETE /api/auth/sessions/me/[id]`, `POST /api/auth/sessions/me/revoke-others` | session |
| `POST /api/auth/password/change`, `GET /api/auth/password/policy`, `POST /api/auth/password/link`, `POST /api/auth/password/reset` (recovery cookie) | session |
| `GET /auth/confirm` | emailed recovery token (single use) |
| `POST /api/users/[userId]/password`, `…/password/link`, `…/unlock` | `users:reset_password` |
| `GET /auth/callback` | recovery-code exchange |
| `GET /api/users/sessions`, `POST /api/users/sessions/revoke` | `user_sessions:read` / `:revoke` |
| `GET /api/users/[userId]/activity`, `GET/PATCH /api/users/[userId]/user-code` | `audit:read`; `users:read` / `users:update` |
| `GET/PUT /api/settings/auth-config` | `auth_config:read` / `:update` (+ plan flag) |

## Settings, flags, limits

- Policy items live in `sys_auth_admin_config_cf` / `org_auth_admin_config_cf` (not the settings system): see the table in the [guide](session-management-guide.md#policy-configuration).
- Feature flag: `session_timeout_control` (tenant editing of the policy).
- No plan limits.

## Migrations (this repo)

| # | Content |
|---|---|
| 0561 | security hardening (`current_tenant_id`, `auth.users` metadata guard, `sys_audit_log` lockdown, lockout grants, auth audit tables) |
| 0563 | `user_code`, one account per membership, login-identifier resolver |
| 0568 | auth audit log append-only |
| 0570 | auth config catalog + tenant overrides |
| 0573 | permissions + Security & Sessions nav |
| 0575 | session registry, register/validate/end/revoke/sweep functions, deactivation trigger |
| 0576 | Active Sessions nav + `auth-session-sweep` cron (every 5 min) |
| 0577 | new-device alert template v2 (EN/AR) |
| 0581 | password management: `pwd_must_change`, history table + trigger + reuse check, PASSWORD config group/items, audit events, `must_change_password` in validate, `users:reset_password` → admin, password-changed template v2 |
| 0584 | password-changed template v3 (bilingual actor wording) |
| 0585 | password-history timestamps use wall-clock time |

## i18n

`messages/{en,ar}/authSession.json` (`lifecycle`, `settings`, `password`, `sessions`, `account`, `tenantSessions`, `userSessions`), `auth.json` (`reasons.*`, login identifier keys, `resetPassword.*`; password keys live under `authSession.password` / `authSession.adminReset`), `users.json` (`detail.sessionsTab`, `activity*`, user-code keys), `layout.json` (`topBar.accountSecurity`).

## Code map

`lib/auth/session-guard.ts`, `lib/services/auth/session/**`, `lib/services/auth/config/**`, `src/features/auth-session/**`, `app/api/auth/**`, `app/api/users/sessions/**`, `app/dashboard/{account/security,users/sessions,settings/security}`, `app/(auth)/{login,reset-password,forgot-password}`.

## Tests

- jest: `__tests__/auth/*` (session-guard, helpers, idle-timer, management, password-use-cases, password-policy, admin-password, password-change-gate, new-device-alert, session-ended-guard, ui-model, platform-inventories), `__tests__/api/auth/session-routes.route.test.ts`, `__tests__/features/auth-session/session-screens.test.tsx`, `__tests__/db/tenant-context.test.ts`.
- db-integration (local DB): `auth-identity-hardening`, `auth-admin-config`, `auth-session-registry`, `auth-session-screens`, `auth-password-history`.
- HQ (`cleanmatexsaas`): `platform-api` `tenant-users.service.spec.ts` (20), `auth-config` specs; `platform-web` `reset-password-model.test.ts`, auth-config validator tests.
