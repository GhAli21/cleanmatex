# User Session Lifecycle — QA Test Guide

Owner-runnable scenarios. Each entry: where to click / URL / expected result. Extended at the end of every phase.

## Phase 0 — Security hardening (migration 0561)

| # | Scenario | Steps | Expected |
|---|---|---|---|
| 0.1 | Forged tenant cannot widen access | Log in as a demo user → browser console: `await supabase.auth.updateUser({ data: { tenant_org_id: '<another tenant uuid>' } })` | Call is rejected (error 42501); data still shows only your tenant |
| 0.2 | Audit table not public | With the anon key: `GET /rest/v1/sys_audit_log` | Empty/denied, never rows |
| 0.3 | Lockout functions not public | With the anon key: `POST /rest/v1/rpc/is_account_locked` | 401/403 permission denied |
| 0.4 | Login still works + is audited | Sign in at `/login` | Success; a `LOGIN_SUCCESS` row appears in `sys_auth_audit_log` |
| 0.5 | Lockout still works | 5 wrong passwords for one account at `/login` | Locked message (423); `ACCOUNT_LOCKED` row logged; unlocks after 15 min |
| 0.6 | User Activity tab | Dashboard → Users → pick a user → Activity tab | Shows recent auth events (action = event code, device, IP, date) |
| 0.7 | No tenant switcher | Any dashboard page, top bar | Tenant name shown as read-only label; no dropdown |

(Phases 1a–6 scenarios are added as each phase lands.)

## Phase 1a — Sign in with user code (migration 0563)

| # | Scenario | Steps | Expected |
|---|---|---|---|
| 1a.1 | Sign in by user code | `/login` → "User code or email" = `U000001` (see codes at Users › user › Profile) + password | Signed in, lands on `/dashboard` |
| 1a.2 | Sign in by email | Same user's email + password | Signed in |
| 1a.3 | Case-insensitive code | `u000001` | Signed in |
| 1a.4 | Generic failure | Unknown code, then a wrong password for a real code | **Same** message both times: "Invalid user code, email or password" |
| 1a.5 | Validation | Type `ab` (too short) / `bad@` | Inline error under the field, no request sent |
| 1a.6 | Lockout still works | 5 wrong passwords for one real user | Locked message (423); unlocks after 15 min (platform default) |
| 1a.7 | Change a user code | Dashboard → Users → user → Profile → pencil next to **User code** → enter `cashier.1` → Save | Success message; code updated; sign in with the new code works |
| 1a.8 | Duplicate code | Change another user's code to `cashier.1` | Inline "already in use" error; no change |
| 1a.9 | Audit | After 1a.7: Users → user → Activity | `USER_CODE_CHANGED` row appears |

## Phase 1 — Security & Sessions settings (migrations 0570, 0573)

Sidebar: **Config And Settings → Security & Sessions** · URL `/dashboard/settings/security`

| # | Scenario | Steps | Expected |
|---|---|---|---|
| 1.1 | View policy | Open the page as `tenant_admin` | 3 groups (Sessions, Devices, Sign-in protection) with current value, platform default and allowed range per item; lockout items show "Managed by platform" |
| 1.2 | Plan without the flag | Tenant whose plan lacks `session_timeout_control` | Info banner "not included in your plan"; all controls read-only |
| 1.3 | Customize an item (plan with the flag) | Idle timeout → switch off "Use platform default" → set 45 → Save | Save bar appears ("1 unsaved change"); after Save a success message and badge **Customized**, current value 45 min |
| 1.4 | Validation | Idle timeout = 9999 | Inline "between 0 and 480"; Save disabled |
| 1.5 | Reset | Turn "Use platform default" back on → Save | Badge returns to **Platform default**, value 30 min |
| 1.6 | Discard | Edit something → "Discard changes" | Form returns to saved values; save bar disappears |
| 1.7 | Permission | User with `auth_config:read` only | Page opens, banner "you do not have permission to change", no controls |
| 1.8 | No access | User without `auth_config:read` | Error shell, no data loaded |
| 1.9 | Audit | After 1.3/1.5 | `CONFIG_CHANGED` rows (SET/CHANGE/RESET) in `sys_auth_audit_log` for the tenant |
| 1.10 | Arabic/RTL | Switch language to Arabic | Labels/descriptions come from the Arabic catalog text; layout mirrors |
| 1.11 | HQ tightens a bound (needs DB access) | Lower `max_value` of an item below a tenant's saved value | Item shows **Platform value enforced** with an explanation |
## Phase 2–3 — Sign-in, sign-out, idle timeout (migration 0575)

Pre-req: set a short policy for testing (Security & Sessions → idle timeout 1 min, warning 15 s) and sign in again so the session snapshots it.

| # | Scenario | Steps | Expected |
|---|---|---|---|
| 2.1 | Sign in by code or email | `/login` with `U000001` then (after sign-out) the email | Both work; wrong password or unknown identifier shows the same generic error |
| 2.2 | Return to page | Open `/dashboard/orders` signed out → sign in | Lands back on `/dashboard/orders` (external `?redirect=//evil.com` is ignored) |
| 2.3 | Idle warning | Sign in, do nothing ~45 s | Dialog "Are you still there?" with countdown; **Stay signed in** keeps the session; Escape also stays |
| 2.4 | Idle expiry | Ignore the dialog | Redirect to `/login?reason=idle_timeout` with the inactivity banner; Back button does not restore the dashboard |
| 2.5 | Two tabs | Open 2 tabs; work in tab A only | Tab B does not time out while A is active; signing out in A signs B out |
| 2.6 | Remember me | Tick Remember me, sign in | No idle timeout dialog; session lasts the configured days |
| 2.7 | Session limit | Set max sessions = 1 (policy BLOCK_NEW) and sign in from a 2nd browser | 2nd sign-in refused with the session-limit message; with REVOKE_OLDEST the 1st browser lands on `/login?reason=session_limit` |

## Phase 4 — Account security, active sessions, password flows (migration 0576)

### Account security — any signed-in user
Sidebar: user menu (top-right) → **Account security** · URL `/dashboard/account/security`

| # | Scenario | Steps | Expected |
|---|---|---|---|
| 4.1 | See devices | Sign in on 2 browsers; open the page | Both listed; this one badged **This device** with no sign-out button |
| 4.2 | Sign out one device | **Sign out** on the other → confirm | Success message; the other browser's next click lands on `/login?reason=revoked` |
| 4.3 | Sign out all others | **Sign out all other devices** → confirm | Count message; others signed out; you stay signed in |
| 4.4 | Change password | Current + new (8+ chars, upper, lower, number) + confirm → **Change password** | Success message with number of devices signed out; other browsers signed out |
| 4.5 | Wrong current password | Enter a wrong current password | Inline "current password is incorrect"; 5 wrong tries lock the account (message) |
| 4.6 | Validation | Weak password / mismatch | Inline errors after the first submit; nothing sent |
| 4.7 | Arabic/RTL | Switch to Arabic | Labels, plural messages and layout mirror correctly |

### Active sessions — administrators
Sidebar: **Team Members → Active Sessions** · URL `/dashboard/users/sessions` (needs `user_sessions:read`; actions need `user_sessions:revoke`)

| # | Scenario | Steps | Expected |
|---|---|---|---|
| 4.8 | List | Open as `tenant_admin` | Active sessions of this tenant only (user, device, IP, signed in, last active) |
| 4.9 | Filter + paging | Status → Ended; with >20 rows use the pager | Ended rows show the reason (e.g. Inactivity); paging is server-side |
| 4.10 | Sign a user out | Row **Sign out** → confirm | Message "1 session ended"; that user lands on `/login?reason=revoked` |
| 4.11 | Sign out everyone | **Sign out everyone** → Continue → confirm | All other sessions end; your own stays (message says so) |
| 4.12 | Read-only | User with `user_sessions:read` only | No actions column, no emergency button |
| 4.13 | Deactivate user | Users → deactivate a signed-in user | Their session ends within seconds; Active Sessions shows reason *User deactivated* |

### Password reset (forgot password)
URL `/forgot-password` → email link → `/reset-password`

| # | Scenario | Steps | Expected |
|---|---|---|---|
| 4.14 | Happy path | Request link → open it → set a new password | Success message, redirect to `/login` with the "password changed" banner; every older session of the user is signed out |
| 4.15 | Reused/expired link | Open the same link twice, or after 1 h | `/forgot-password?error=invalid_link` banner |
| 4.16 | Direct visit | Signed in normally, open `/reset-password` and submit | "Invalid or expired link" state (needs a real recovery link) |

### Scheduled sweep
| # | Scenario | Steps | Expected |
|---|---|---|---|
| 4.17 | Cron registered | `select jobname, schedule from cron.job where jobname = 'auth-session-sweep'` | One row, `*/5 * * * *` |

## Phase 5 — User Sessions tab, activity labels, new-device alert (migration 0577 for the alert text)

| # | Scenario | Steps | Expected |
|---|---|---|---|
| 5.1 | User Sessions tab | Team Members → All Users → open a user → **Sessions** tab (needs `user_sessions:read`; hidden otherwise) | That user's active devices; sign-out buttons only with `user_sessions:revoke` |
| 5.2 | Sign a device out | **Sign out** → confirm | "1 session ended"; the user's next click on that device lands on `/login?reason=revoked` |
| 5.3 | Activity labels | Same user → **Activity** tab | Event names are readable text ("Sign-in succeeded", "Signed out", …), in Arabic when the UI is Arabic; failures show a red *Failed* tag; columns are translated |
| 5.4 | Activity error/empty | Open Activity for a user with no events / with the API blocked | Empty-state text / red error box (never an infinite spinner) |
| 5.5 | New-device alert | Sign in with a user who already has sessions from a **different browser** (tenant policy "New device alert" on) | Bell notification "New sign-in to your account" naming the browser, IP and time (EN/AR); link opens Account security |
| 5.6 | No alert | Sign in again from the **same** browser, or turn the policy item off | No notification |
| 5.7 | Session ended elsewhere | While on any page, sign the user out from Active Sessions | The next failed API call (any screen) sends the user to `/login` with the revoked banner within a moment |

## HQ (cleanmatexsaas) — sign-in policy and user creation

| # | Scenario | Steps | Expected |
|---|---|---|---|
| H.1 | Platform catalog | HQ sidebar → Settings → **Sign-in & Sessions** (`/auth-config`) | Settings grouped (Sessions, Devices, Sign-in protection) with platform value, range and "Tenants may change / Platform only" |
| H.2 | Edit a platform value | Edit idle timeout → 45 → Save | Saved message; range errors shown inline; the tenant app uses 45 for new sign-ins |
| H.3 | Tighten a range | Set max below a tenant's saved value | That tenant's item shows **Platform value enforced** (HQ tenant screen and the tenant's own Security screen) |
| H.4 | Tenant policy | Tenant → **Sign-in & sessions** | Effective value + source per setting; **Set value** / **Reset to platform** work; changes appear in HQ audit (`hq_audit_logs`) and `sys_auth_audit_log` |
| H.5 | Plan without flag | Tenant whose plan lacks `session_timeout_control` and has overrides | Red banner with **Clear custom values** (confirm); button refuses (400) if the plan still has the flag |
| H.6 | Create user without email | Tenant → Users → New: leave email empty, optional user code | Created; the user signs in on the tenant app with the code (or the generated `U000123`) + password |
| H.7 | Duplicate code | Create another user with the same code (any case) | 409 "already in use"; no orphan auth user is left |
| H.8 | Admin password reset | Tenant → user → Reset password while the user is signed in | The user's sessions end (next click → `/login`); audit entry shows `sessions_revoked` |
