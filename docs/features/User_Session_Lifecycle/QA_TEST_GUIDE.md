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

(Phases 1a–6, the password scenarios in §6 and the HQ scenarios follow below. All of them are still to be run by the owner — see [REMAINING_WORK.md](REMAINING_WORK.md).)

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

## Phase 6 — Password management (migrations 0581, 0584, 0585)

Prerequisites: mail configured (tenant `RESEND_API_KEY`, `NEXT_PUBLIC_SITE_URL`) for the link scenarios; two test users with real emails and one without.

### Self-service — Account security (`/dashboard/account/security`, user menu → Account security)
| # | Scenario | Steps | Expected |
|---|---|---|---|
| 6.1 | Three-field change (default) | Current + new + re-type → **Change password** | Dialog "Password changed" with how many other devices were signed out and **Later / Sign out now**; the other browser is signed out on its next click |
| 6.2 | Later vs now | Choose **Later** / repeat and choose **Sign out now** | Later: stays signed in; Now: lands on `/login` |
| 6.3 | Reuse | Change to a password used in the last 5 changes | "You used this password recently…" |
| 6.4 | Breached | Try `Password1` (or any known-breached password) | "appears in known data breaches" (when internet is available) |
| 6.5 | Two-field form | Settings → Security & Sessions → **Passwords** → turn off *Require current password* (needs `auth_config:update` + plan flag) → reload Account security | Form shows only *New password* and *Confirm*; change works right after signing in |
| 6.6 | Old sign-in | With 6.5 active and a sign-in older than the freshness window (set it to 1 min) | Amber notice: sign in again or use the emailed link |
| 6.7 | Email link | **Email me a link** | Toast with the masked address; email arrives (EN + AR text); link opens `/reset-password`; after saving, all sessions end and `/login` shows the password-changed banner; reusing the link shows the invalid-link page |
| 6.8 | No real email | Sign in as a user without email | The email-link section is absent |

### Administrator — user detail (`/dashboard/users/[userId]`, needs `users:reset_password`)
| # | Scenario | Steps | Expected |
|---|---|---|---|
| 6.9 | Set a temporary password | **Reset password** → *Choose the password* → **Generate password** → Set | Success view shows the password once with **Copy**; the user's sessions end; the user gets a "password changed" notification (bell/email) — no password in it |
| 6.10 | Forced change | Sign in as that user with the temporary password | Redirected to `/change-password` (nothing else reachable, API calls answer 403); after saving → dashboard; other sessions ended |
| 6.11 | No force | Same, with *Require change* unticked | User keeps using the password |
| 6.12 | Email a link | *Email a link* (user with email); optionally tick *Also sign out now* | Email arrives; user chooses own password through it; option is disabled with an explanation for users without email |
| 6.13 | Own account | Open your own user | No Reset/Unlock buttons (use Account security) |
| 6.14 | Unlock | Lock a user (5 wrong sign-ins) → **Unlock account** | "The account was unlocked"; the user can sign in; audit shows `ACCOUNT_UNLOCKED` |
| 6.15 | Audit | User detail → Activity | `Password reset by administrator` / `Password reset link emailed` / `Account unlocked` rows |
| 6.16 | Permission | Sign in as a role without `users:reset_password` | Buttons hidden; direct API calls answer 403 |

### HQ (cleanmatexsaas) — Tenants → Users → user
| # | Scenario | Steps | Expected |
|---|---|---|---|
| 6.17 | Set password + notice | **Reset Password** → *Choose the password*, tick *Email the user a notice* | Success view with the password and Copy; notice email (no password) when the user has a real email; user's sessions end; forced change at next sign-in |
| 6.18 | Email a link | *Email a link* | Link email arrives; works as 6.12; without `TENANT_APP_URL`/`HQ_RESEND_API_KEY` the dialog says email is not configured |
| 6.19 | Policy parity | Use a recently used / breached password | Rejected with the same messages as the tenant app |
| 6.20 | Unlock | **Unlock Account** | Success toast; audit in `hq_audit_logs` and `sys_auth_audit_log` |
| 6.21 | Catalog | HQ → Sign-in & Sessions | New **Passwords** group (4 items); *Block breached passwords* is platform-only |

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

---

## Financial_Expert_Tester Results — Preview/HQ manual QA, 2026-10-09 (Asia/Muscat)

Retest r2 2026-10-09 (Asia/Muscat). Demo operator password was changed during QA; see GrokBot_HQ_Test/CREDENTIALS_AND_ENVIRONMENTS.md.

> Appended by Financial_Expert_Tester (the tables above have no Result column, so results are kept here). Environment: Preview https://cmx.cleanmatex.com (Demo Laundry OMR, Saudi Riyadh SAR) + HQ https://hqsaas.cleanmatex.com. Demo operator password was changed during QA (see note below); all policy overrides restored. Summary (after retest r2 2026-10-09): 50 PASS / 4 FAIL / 17 PARTIAL / 16 BLOCKED / 0 N/A (87 scenarios); round 1 was 35 / 5 / 13 / 34 / 0 (87). Key blockers now: HQ user creation still fails (H.6, FET-USL-S1) so no disposable users; admin single-session sign-out is a no-op (4.10/5.2, FET-USL-S2); session_timeout_control flag off on all plans; lockout message shows 255 minutes (FET-USL-S32).

| # | Result | Evidence |
|---|---|---|
| 0.1 | **PASS** | 01:59: Demo operator (U000001) token PUT /auth/v1/user {data.tenant_org_id: Saudi c9ac29d1…} → 500 unexpected_failure "Error updating user" (GoTrue wraps 42501 from trg_auth_guard_user_tenant_meta); auth.users meta tenant still 1111…; REST org_users_mst with same token → only own row (U000001, tenant 1111…). Note: error surfaces as 500, not a clean 42501/403 (FET-USL-S12). |
| 0.2 | **PASS** | Anon key GET /rest/v1/sys_audit_log, sys_auth_audit_log, sys_auth_user_sessions_mst → 401 42501 "permission denied for table …"; org_users_mst → 200 []. Never rows. |
| 0.3 | **PASS** | Anon RPC is_account_locked / record_login_attempt / fn_auth_resolve_login_identifier → 401 42501 "permission denied for function …". |
| 0.4 | **PASS** | /api/auth login 200; LOGIN_SUCCESS rows in sys_auth_audit_log (e.g. 01:58:22 admin@demo-laundry.example; 01:52:08 via Activity API). |
| 0.5 | **PARTIAL** (r1: BLOCKED) | Needs a disposable user; HQ user creation fails (H.6) and shared demo accounts were deliberately not locked. Retest 2026-10-09 (r2): PARTIAL — UI: 5 wrong passwords show the generic invalid message; account locked on the 5th recorded failure (09:06:10, ACCOUNT_LOCKED audit row, failed_attempts 5); message says "locked for 255 minutes" instead of 15 (FET-USL-S32). Unlock by admin works. Shared operator U000001 used because HQ still cannot create users (H.6). |
| 0.6 | **PASS** | API: GET /api/users/370466e6…/activity 200, 20 rows {action, action_label EN + action_label2 AR, device, ip, created_at}; cross-tenant id → 404 "User not found"; route needs auth user id (org row id → 404). UI (02:10, direct URL /dashboard/users/7dbe9b05… because All Users list redirects, see 5.1/FET-USL-S4): Activity tab shows event, device, IP, date. Load ~5 s. |
| 0.7 | **PASS** | UI 01:48: top bar "Demo Laundry LLC" plain label; sidebar CURRENT TENANT read-only, no dropdown. |
| 1a.1 | **PASS** | POST login identifier U000003 (Demo admin) + password → 200, session created. |
| 1a.2 | **PASS** | admin@demo-laundry.example + password → 200. |
| 1a.3 | **PASS** | u000003 → 200; "  ADMIN@Demo-Laundry.example " (mixed case, spaces) → 200. |
| 1a.4 | **PASS** | UI 02:12: ZZ999999 / wrong123 → "Invalid user code, email or password. Please try again." (fields cleared; extra sentence vs guide text, acceptable). API: unknown code / wrong pwd for U000004 / unknown email → identical 401 INVALID_CREDENTIALS. |
| 1a.5 | **PASS** | UI: empty submit → inline "Enter your user code or email." + "Enter your password.", both fields marked invalid, no request. API: '' → 400 "Sign-in identifier and password are required"; 'ab'/'bad@' reach server → generic 401 (see FET-USL-S11). |
| 1a.6 | **PARTIAL** (r1: BLOCKED) | No disposable test user (H.6 FAIL); shared accounts not locked by rule. Retest 2026-10-09 (r2): PARTIAL — same run as 0.5: lock works at the 5th failure, auto-unlock time not waited out; displayed minutes wrong (255, FET-USL-S32). |
| 1a.7 | **PASS** (r1: BLOCKED) | Success path needs a test user (H.6). Negatives OK: PATCH /api/users/{id}/user-code 'ab' → 400 INVALID_USER_CODE; cross-tenant PATCH → 404 "User not found"; operator → 403 users:update. UI: Profile shows User code U000001 / U000003 with pencil icon (icon has no accessible name, FET-USL-S19). Retest 2026-10-09 (r2): PASS — UI: admin changed U000001 to cashier.1 → "User code updated."; reverted to U000001 afterwards. |
| 1a.8 | **PASS** | API: PATCH viewer (U000004) user code → 'u000003' → 409 USER_CODE_TAKEN "User code already in use"; no change (unique lower(user_code)). Inline UI message not exercised. |
| 1a.9 | **PASS** (r1: BLOCKED) | No successful code change possible (1a.7); trigger trg_org_users_user_code_audit exists; 0 USER_CODE_CHANGED rows ever. Retest 2026-10-09 (r2): PASS — sign-in with cashier.1 worked; Activity row "User code changed" 08:50 (audit USER_CODE_CHANGED 08:50:24 and 09:03:09 on revert). |
| 1.1 | **PASS** | UI 01:48 (Demo admin): groups Sessions / Devices / Sign-in protection with current value, platform default, allowed range; lockout items "Managed by platform". API: GET /api/settings/auth-config 200, 14 items (SESSION/DEVICE/LOCKOUT/PASSWORD), lockout isAllowTenantChange=false, canEdit=false. Screen hides the 4 PASSWORD items (see 6.21). |
| 1.2 | **PASS** | UI: banner "Customizing security settings is not included in your current plan…", no inputs. API: PUT → 403 FEATURE_NOT_ENABLED. Note: session_timeout_control is_enabled=f on all 5 plans, ENTERPRISE included (FET-USL-S5). |
| 1.3 | **BLOCKED** | PUT idle 45 → 403 FEATURE_NOT_ENABLED "Security settings customization is not enabled for this plan"; no plan has the flag. |
| 1.4 | **BLOCKED** | PUT 9999 → 403 FEATURE_NOT_ENABLED (plan check runs before range validation); inline range error not reachable. |
| 1.5 | **BLOCKED** | PUT reset → 403 FEATURE_NOT_ENABLED. |
| 1.6 | **BLOCKED** | Page is read-only for every tenant (flag off on all plans), so no save bar or Discard to test. |
| 1.7 | **PARTIAL** | No user with auth_config:read only exists on Preview; operator PUT → 403 "Permission denied: auth_config:update". Read-only banner not viewable. |
| 1.8 | **PASS** | API: operator GET /api/settings/auth-config → 403 "Permission denied: auth_config:read". UI error shell not separately captured. |
| 1.9 | **PASS** | Via HQ overrides: CONFIG_CHANGED SET/CHANGE/RESET rows for Demo tenant 02:02:42–02:02:47. Defect: RESET rows new_value = old tenant value and actor_auth_user_id null (FET-USL-S8). |
| 1.10 | **PARTIAL** | UI 01:48 Arabic: RTL mirrors, item labels/descriptions Arabic; untranslated: page header title "Security & Sessions", most sidebar items, enum values REVOKE_OLDEST / BLOCK_NEW shown raw. |
| 1.11 | **PASS** | Covered by H.3: Demo override 120 + HQ max 60 → tenant app item source PLATFORM_ENFORCED (effective 30); reverted. |
| 2.1 | **PASS** | API: code U000003 and email both 200; wrong password / unknown identifier → identical 401 INVALID_CREDENTIALS. |
| 2.2 | **PASS** | Signed-out GET /dashboard/orders → 307 /login?redirect=%2Fdashboard%2Forders; getSafeRedirectPath rejects //, /\, %2f, %5c and auth paths. UI 02:10: /login?redirect=//evil.com while signed in → https://cmx.cleanmatex.com/dashboard?redirect=%2F%2Fevil.com (stays on domain). |
| 2.3 | **PASS** | Saudi overrides idle 1 min / warning 15 s (02:11). Signed in U000002 (Remember me off) 02:12:46; dialog "Are you still there?" / "You have been inactive for a while. For your security you will be signed out automatically unless you choose to stay signed in." + 15 s countdown, buttons Sign out now / Stay signed in / X. Stay (02:14:50) closed it and stayed on /dashboard. Note: first dialog at ~35 s after sign-in (expected ~45 s) — FET-USL-S30. |
| 2.4 | **FAIL** | Idle with no input: warning 02:17:45, session ended ~02:18:02. Visible tab → /login?reason=session_expired&redirect=%2Fdashboard, banner "Your session has expired. Please sign in again." (expected reason=idle_timeout + idle banner). Second tab → /login?redirect=%2Fdashboard with no reason/banner. API side does record IDLE_TIMEOUT end reason (4.9). FET-USL-S28. |
| 2.5 | **PARTIAL** | Two tabs on /dashboard: warning shown in both at 02:16:57. Stay in visible tab closed it instantly; other tab still open 3 s later (countdown 12), closed by +12 s — syncs but delayed (FET-USL-S29). On final timeout the second tab landed on /login with no reason banner (FET-USL-S28). |
| 2.6 | **PASS** | API 02:05: remember_me login → cookie sb-remember-me=1, session isRememberMe=true, expiresAt +7 d (2026-10-16 02:05). Note: sb auth-token cookie expires 2026-10-10 02:05 (~24 h), shorter than the 7-day session (FET-USL-S9). Dialog suppression not UI-verified. |
| 2.7 | **PARTIAL** | HQ override max=1 on Demo: BLOCK_NEW → 409 SESSION_LIMIT_REACHED "Maximum number of active sessions reached…" (SESSION_LIMIT_HIT DENIED {active:3,max:1}); REVOKE_OLDEST → 200, 3 old sessions ended SESSION_LIMIT; but old client → 307 /login?redirect=… with NO reason=session_limit. Overrides cleared (H.5) → all PLATFORM. |
| 4.1 | **PASS** | API: /api/auth/sessions/me lists devices with isCurrent, device, IP, created/lastActivity; revoke current → 409 CANNOT_REVOKE_CURRENT. UI 01:48: devices list with This device badge, Sign out on others, Sign out all other devices. ("Email me a link" missing, logged under 6.7.) |
| 4.2 | **PARTIAL** | DELETE other own session 200 {success:true}; current → 409; unknown → 404 SESSION_NOT_FOUND. Revoked client: API 401 {"error":"Unauthorized"} (no SESSION_ENDED code), page 307 /login?redirect=%2Fdashboard%2Forders without reason=revoked, so no revoked banner. Retest 2026-10-09 (r2): PARTIAL — own-account revoke path PASS (DELETE /api/auth/sessions/me/[id] 200; current → 409). Admin path FAIL: Sign out on the operator session did not kick the device (still on /dashboard after ~2 min) — blocked by 5.2/FET-USL-S2. Revoked-client banner still missing (FET-USL-S6/S37). |
| 4.3 | **PASS** | Operator 3 sessions: revoke-others → 200 {revoked:2}; both other clients 401; caller 200. |
| 4.4 | **PASS** (r1: BLOCKED) | Success path needs a disposable user (H.6); shared passwords not changed. Retest 2026-10-09 (r2): PASS — covered by 6.1: Account security change worked (Operator123 → QaOp#2026a → … → QaOp#2026c) with the "Password changed" dialog. |
| 4.5 | **PARTIAL** | Wrong current → 403 WRONG_PASSWORD "Current password is incorrect"; 5-try lockout part BLOCKED (no test user). Retest 2026-10-09 (r2): PARTIAL — UI: wrong current password → "The current password is incorrect.", stays signed in (shot bf33c46b). The 5-try lockout via the change form was not run; lockout verified through sign-in instead (0.5). |
| 4.6 | **PASS** | API: 'abc' → 422 WEAK_PASSWORD (length/upper/number messages); 'alllowercase1' → 422 "must contain at least one uppercase letter"; missing current → 400. Inline UI errors not exercised. Retest 2026-10-09 (r2): PASS (UI) — "abc" → "Choose a stronger password: at least 8 characters with an uppercase letter, a lowercase letter and a number."; mismatch → "The two passwords do not match."; nothing sent. |
| 4.7 | **PARTIAL** | UI 02:10 Arabic: fully translated + RTL, but the right sidebar overlaps the main content (page title and card right edges hidden) at ~920 px; reproduced 2x; EN fine. |
| 4.8 | **PASS** | UI: columns USER/DEVICE/IP/SIGNED IN/LAST ACTIVE/STATUS/ACTIONS/AUDIT, Show filter Active/Ended/All, Sign out per row, Sign out everyone. API: 200, tenant-only rows (user code U000003, name, email); Saudi userId filter → 0. Notes: Audit dialog shows only "Created at"; rows don't link to user detail (FET-USL-S18/S20). |
| 4.9 | **PASS** | API: status=ENDED shows reasons USER_REVOKED / USER_LOGOUT / IDLE_TIMEOUT; offset pages disjoint (server-side); limit=101 → 400 "Invalid query". UI filter present; pager not visible (only 2 rows). |
| 4.10 | **FAIL** | POST /api/users/sessions/revoke {sessionIds:[active operator session 2f564c67…]} → 200 {revoked:0, notFound:0, skippedCurrent:false}; session stays ACTIVE; random / cross-tenant ids also → notFound 0. Route sends sessionIds, service reads sessionRowIds (FET-USL-S2). Retest 2026-10-09 (r2): FAIL — still broken after the 2026-10-09 deploy. Admin Sign out on the operator Sessions tab (09:24) → dialog "Sign this device out?" → confirm: no toast, row remains ACTIVE (DB row 1b0c71aa ACTIVE, last_activity 09:25:02), no SESSION_REVOKED audit row. Root cause: app/api/users/sessions/revoke/route.ts:50 passes sessionIds, but session-management.ts:215,230 reads sessionRowIds (undefined → empty loop → {revoked:0}). See FET-USL-S2, api-evidence/revoke-diagnosis.txt. |
| 4.11 | **PASS** | Saudi admin 02:05: {all:true} → 200 {revoked:1, skippedCurrent:true}; other session 76a73ab8 ended ADMIN_REVOKED; own e746c909 kept. |
| 4.12 | **PARTIAL** | No read-only user_sessions role on Preview; operator → 403 user_sessions:read / user_sessions:revoke. |
| 4.13 | **BLOCKED** | No disposable signed-in user to deactivate (H.6). |
| 4.14 | **BLOCKED** | No readable test inbox for the recovery link. |
| 4.15 | **BLOCKED** | Depends on 4.14 link. |
| 4.16 | **PASS** | API: POST /api/auth/password/reset without recovery session → 403 RECOVERY_REQUIRED "Recovery link required". |
| 4.17 | **PASS** | cron.job auth-session-sweep, schedule */5 * * * *, active. |
| 5.1 | **PASS** | UI 02:10 (direct URL, All Users list redirects to ?error=insufficient_permissions): own admin Sessions tab lists Chrome on Linux (This device) + Edge on Windows with Sign out / Sign out all devices; operator: "This user has no active sessions." API: /api/users/sessions?userId= returns only that user. Retest 2026-10-09 (r2): PASS — All Users via sidebar (Team Members > All Users) loads: Total 4, Active 4, Admins 1; operator Sessions tab lists the 4 Chrome on Linux rows. Direct URL /dashboard/users still redirects to /dashboard?error=insufficient_permissions for super_admin (reproduced twice, FET-USL-S34). |
| 5.2 | **FAIL** | Same endpoint as 4.10: single-session admin revoke returns {revoked:0} and the session stays ACTIVE. Retest 2026-10-09 (r2): FAIL — retried twice (09:24, ~09:55): confirm, spinner, dialog closes, no toast, list unchanged after reload, operator not kicked. Same root cause as 4.10 (FET-USL-S2). |
| 5.3 | **PASS** | UI: operator Activity shows Sign-in succeeded / Sign-in failed + Failed / Password changed + Blocked / Session limit reached + Blocked / Signed out / Session revoked; columns EVENT/DEVICE/IP ADDRESS/DATE; Arabic: names + headers Arabic, RTL OK. ~5 s load. |
| 5.4 | **BLOCKED** | No user with zero events (fresh user creation broken, H.6); API-blocked error state not exercised. |
| 5.5 | **PARTIAL** | First login from new device: NEW_DEVICE audit + inbox security.login.detected (+ EMAIL/PUSH outbox SENT) created, but inbox title "New notification: security.login.detected", generic body, title2 (AR) empty, template_code empty. |
| 5.6 | **PASS** | Re-login 01:59:09 with same cmx-did → no NEW_DEVICE row, no notification. |
| 5.7 | **PARTIAL** | Next API call after revoke → 401 but body {"error":"Unauthorized"} without code SESSION_ENDED; page → /login?redirect=… without reason=revoked banner. |
| 6.1 | **PASS** (r1: BLOCKED) | Phase 6 not deployed on Preview: /api/auth/password/policy → 404; Account security shows the old 3-field form without the "Password changed / Later / Sign out now" flow. Retest 2026-10-09 (r2): PASS — UI: QaOp#2026a→b "Password changed / Your password was changed. 1 other device was signed out. / Do you want to sign out of this device now, or later?" Later | Sign out now (count omitted when 0 other devices). First run PARTIAL for that reason only. |
| 6.2 | **PASS** (r1: BLOCKED) | Depends on 6.1 (not deployed). Retest 2026-10-09 (r2): PASS — Later keeps the session; the other device lands on /login?redirect=%2Fdashboard with NO reason banner (FET-USL-S6/S37). Sign out now → /login?redirect=%2Fdashboard%2Faccount%2Fsecurity without a password_changed banner (FET-USL-S31). |
| 6.3 | **PASS** (r1: BLOCKED) | Not deployed; history check unreachable (also no test user). Retest 2026-10-09 (r2): PASS — reuse: QaOp#2026c → QaOp#2026a rejected with the rule row "Not a password you already used on this account" and "You used this password recently on this account. Choose one you have not used here before."; same-as-current → "The new password must be different from the current one." |
| 6.4 | **PASS** (r1: BLOCKED) | Not deployed; breach check unreachable (also no test user). Retest 2026-10-09 (r2): PASS — Password1 → "This password appears in known data breaches. Choose a different one." |
| 6.5 | **BLOCKED** | Security & Sessions has no Passwords group (UI); plan flag off on all plans. |
| 6.6 | **BLOCKED** | Depends on 6.5. |
| 6.7 | **PARTIAL** (r1: BLOCKED) | UI: Account security has no "Email me a link" option; POST /api/auth/password/link → Next.js not-found HTML page (HTTP 200 on POST, not JSON). Retest 2026-10-09 (r2): PARTIAL (presence only) — Account security now shows "Prefer an emailed link?" / "We will send a one-time link to o***@demo-laundry.example…" with an Email me a link button; not clicked (no readable inbox), so the email and /reset-password steps stay untested. |
| 6.8 | **BLOCKED** | Feature not deployed; also no user without email can be created (H.6). |
| 6.9 | **PASS** (r1: BLOCKED) | UI: no Reset password button on other users (operator 7dbe9b05); POST /api/users/7dbe9b05…/password → Next.js not-found HTML. Retest 2026-10-09 (r2): PASS — admin Reset password → "Password set. 1 session was signed out. The user must choose a new password at next sign-in."; generated password shown once. |
| 6.10 | **PASS** (r1: BLOCKED) | GET /change-password → 404. Retest 2026-10-09 (r2): PASS — operator sign-in with the temporary password → /change-password (new + confirm only); /dashboard bounces back until saved; after saving → /dashboard. |
| 6.11 | **PASS** (r1: BLOCKED) | Depends on 6.9. Retest 2026-10-09 (r2): PASS — require-change unticked: "Password set. 1 session was signed out. The user can keep using this password." → operator goes straight to the dashboard. |
| 6.12 | **BLOCKED** | POST /api/users/{id}/password/link → Next.js not-found HTML; no Email a link option in UI. |
| 6.13 | **PASS** (r1: PARTIAL) | UI 02:10: own admin user detail has no Reset/Unlock (correct), but operator user detail also has none, so the check isn't meaningful until Phase 6 is deployed. Retest 2026-10-09 (r2): PASS — own user detail shows no Reset password / Unlock account; on the operator page both buttons are present. |
| 6.14 | **PARTIAL** (r1: BLOCKED) | POST /api/users/{id}/unlock → Next.js not-found HTML; no Unlock button; no test user to lock. Retest 2026-10-09 (r2): PARTIAL — lock reproduced via 5 wrong sign-ins (see 0.5); Unlock account → "The account was unlocked" and the operator signed in again; audit ACCOUNT_UNLOCKED ADMIN_UNLOCK was_locked:true (09:06:37). A second click on the not-locked account said "The account was not locked." but still wrote another audit row (FET-USL-S33). Wrong lock minutes: FET-USL-S32. |
| 6.15 | **PASS** (r1: BLOCKED) | Depends on 6.9/6.12/6.14. Retest 2026-10-09 (r2): PASS — operator Activity: Password reset by administrator 09:04, Session revoked 09:04, Password changed 09:04, 5× Sign-in failed 09:05–09:06, Account locked 09:06, Account unlocked ×2 09:06 (duplicate = FET-USL-S33). Minor: Effective Permissions block sits above Recent activity (FET-USL-S38). |
| 6.16 | **PASS** (r1: BLOCKED) | Buttons absent for everyone; endpoints not deployed. Retest 2026-10-09 (r2): PASS — admin sees Reset password + Unlock account; operator has no Team Members menu and /dashboard/users(/id) redirects to /dashboard?error=insufficient_permissions. Direct API 403 not re-run. |
| 6.17 | **PASS** (r1: BLOCKED) | HQ /en/tenants/1111…/users row menu: View details / Edit / Deactivate / Delete only, no Reset Password (HQ Phase 6 UI not deployed); no test user (H.6). Retest 2026-10-09 (r2): PASS — HQ user page has Edit / Deactivate / Reset Password / Unlock Account / Delete; Reset dialog "Choose the password" / "Email a link"; result "Password set. 1 session was signed out. The user can keep using this password." with Copy; operator signed in with the new password. Notice-email option not exercised. |
| 6.18 | **BLOCKED** | No Email a link action in HQ row menu. |
| 6.19 | **BLOCKED** | Depends on 6.17. |
| 6.20 | **PARTIAL** (r1: BLOCKED) | No Unlock Account action in HQ row menu; no locked test user. Retest 2026-10-09 (r2): PARTIAL — HQ Unlock Account button present; not exercised (no locked user at that time; tenant unlock verified in 6.14). |
| 6.21 | **PASS** (r1: FAIL) | Deploy gap. DB/API: HQ catalog API returns PASSWORD group with 4 items (AUTH_PWD_REQUIRE_CURRENT, AUTH_PWD_FRESH_SIGNIN_MIN, AUTH_PWD_HISTORY_COUNT, AUTH_PWD_BREACH_CHECK = platform-only), so migrations are applied. UI: no Passwords group on HQ /en/auth-config, HQ tenant Sign-in & sessions tab, or tenant /dashboard/settings/security. Retest 2026-10-09 (r2): PASS — tenant /dashboard/settings/security shows the Passwords group (Require current password On; Fresh sign-in 15 min, range 1–120; History 5, range 0–24; Block breached passwords On, "Managed by platform"). HQ /en/auth-config shows the Passwords group: AUTH_PWD_REQUIRE_CURRENT (tenants may change), FRESH_SIGNIN_MIN 15, HISTORY_COUNT 5 (tenants may change), BREACH_CHECK On (platform only). |
| H.1 | **PARTIAL** | UI 01:55: https://hqsaas.cleanmatex.com/en/auth-config "Sign-in & session policy": Sessions 6 / Devices 1 / Sign-in protection 3 (Platform only) = 10 items; columns SETTING/PLATFORM VALUE/ALLOWED RANGE/TENANTS + Edit. API 200 matches. But there's no sidebar entry (reachable by URL only), so the guide's navigation step fails. |
| H.2 | **PASS** | Idle 9999 → 400 (raw DB text leaked: "violates check constraint chk_auth_cfg_value_valid", FET-USL-S7); 45 → 200, tenant app platformValue 45, new session idle_timeout_sec 2700; reverted to 30. |
| H.3 | **PASS** | Demo override 120 + max 60 → PLATFORM_ENFORCED in HQ effective and tenant app (effective 30); reverted max 480, override deleted. |
| H.4 | **PASS** | UI: tenant Sign-in & sessions tab shows source (Platform default / Managed by platform), Refresh + Set value. API: set/change/reset 200; max sessions 99 → 400 "value 99 is not valid…" (02:02:41); hq_audit_logs auth_config.override.set + CONFIG_CHANGED. |
| H.5 | **PARTIAL** | API: clear-without-plan → 200 {cleared:2} + hq_audit. UI: banner "This tenant's plan does not include session policy customization…" shown for Demo Laundry on ENTERPRISE (and Saudi); no Clear custom values button when there are no overrides. 400 variant untestable because no plan has the flag. |
| H.6 | **FAIL** | 01:55: HQ POST /tenants/{id}/users with/without email and with/without code → 400 "Failed to create auth user: Database error creating new user" (traceIds 75fcef7a…, 3c2e4f68…). Retest 2026-10-09 (r2): FAIL — still failing after the 2026-10-09 deploy (API 03:58, UI): HQ Add user qa.fet1 (no email, Operator) → "Failed to create auth user: Database error creating new user" (traceId 8b496b52…); users list unchanged (3). Cause: DB trigger function ensure_jwt_tenant_context_on_auth_user still has no SET search_path (proconfig empty) and reads org_users_mst unqualified, while supabase_auth_admin runs with search_path=auth. Latest migration is 0587; nothing touched it (FET-USL-S1). |
| H.7 | **BLOCKED** | Create fails before the uniqueness check (duplicate QA.FET1 also 400 same error). |
| H.8 | **BLOCKED** | No user can be created; HQ row menu has no Reset password. |

### Tester suggestions — Financial_Expert_Tester (FET-USL)

1. **Financial_Expert_Tester / FET-USL-S1 (P0)** — HQ user creation is broken (H.6): every POST /tenants/{id}/users returns 400 "Failed to create auth user: Database error creating new user", with or without email or code. This blocks 0.5, 1a.6, 1a.7, 1a.9, 4.4, 4.13, 6.x and H.7/H.8. Fix hint: look up the Postgres/GoTrue log for traceId 75fcef7a…; a likely cause is a trigger on auth.users (e.g. the 0561 tenant-metadata guard or the user-code trigger) rejecting service-role inserts. Also return a meaningful message instead of the generic GoTrue text. **r2 2026-10-09: STILL FAILING after the deploy** (API 03:58 + UI, traceId 8b496b52…). Root cause confirmed read-only: trigger trg_ensure_jwt_tenant_context calls ensure_jwt_tenant_context_on_auth_user(), which has no SET search_path and reads org_users_mst unqualified; supabase_auth_admin runs with search_path=auth, so the insert fails. Latest migration is 0587, none touches it. One-line fix: recreate the function with SET search_path = public, auth, pg_temp (or write public.org_users_mst) and apply to the remote DB.
2. **Financial_Expert_Tester / FET-USL-S2 (P0)** — Admin single-session sign-out does nothing (4.10/5.2). POST /api/users/sessions/revoke {sessionIds:[…]} returns 200 {revoked:0, notFound:0} and the session stays ACTIVE. The route sends `sessionIds` but the service reads `sessionRowIds`. Fix hint: align the field name; count unknown or cross-tenant ids as notFound; add a regression test that asserts status=ENDED after the call. **r2 2026-10-09: STILL FAILING (P0)** — repro by UI 09:24 and ~09:55; DB row stays ACTIVE and no SESSION_REVOKED audit row. Exact root cause: app/api/users/sessions/revoke/route.ts:50 passes `{ sessionIds }` but lib/services/auth/session/use-cases/session-management.ts:215,230 reads `params.sessionRowIds`, so the loop is empty and the API answers 200 {revoked:0}. The same bug breaks the user Sessions tab (user-sessions-tab.tsx:57-59, including its sign-out-all) and Active Sessions row Sign out (tenant-sessions-screen.tsx:61); only {all:true} and the own-account DELETE work. One-line fix: in revoke/route.ts:50 pass `{ sessionRowIds: parsed.data.sessionIds }` (or rename the service param) and add a route test asserting revoked:1. Evidence: api-evidence/revoke-diagnosis.txt.
3. **Financial_Expert_Tester / FET-USL-S3 (P1)** — Phase 6 password management isn't deployed on Preview or HQ even though migrations 0581/0584/0585 are applied. /api/auth/password/policy is 404, /change-password is 404, the POST password/link/unlock routes return the Next.js not-found HTML page, and there are no Reset/Email/Unlock buttons or Passwords group. Fix hint: deploy the web-admin and HQ builds together with the migrations. Make unknown /api/* routes return a JSON 404 instead of the HTML page with HTTP 200.
4. **Financial_Expert_Tester / FET-USL-S4 (P1)** — All Users (/dashboard/users) redirects to /dashboard?error=insufficient_permissions for super_admin (Demo) and tenant_admin (Saudi), reproducibly. The server returns 200 for the page and org_users_mst role is correct, so it looks like a client-side `withAdminRole` race (redirecting before role/tenant context has loaded). Fix hint: wait for the auth/role context to finish loading before deciding, and include super_admin in the allowed roles. **r2 2026-10-09:** sidebar Team Members > All Users now loads (Total 4); the direct URL still redirects — see FET-USL-S34.
5. **Financial_Expert_Tester / FET-USL-S5 (P1)** — `session_timeout_control` is disabled on all 5 plans, ENTERPRISE included (sys_ff_pln_flag_mappings_dtl is_enabled=f). Tenant customization (1.3–1.6, 6.5) can't be used or tested anywhere. Fix hint: enable it for the intended plans (at least ENTERPRISE) or document which plan should have it.
6. **Financial_Expert_Tester / FET-USL-S6 (P1)** — Session-end reason is lost for the user (2.7, 4.2, 5.7). A revoked or session-limit client gets 307 /login?redirect=… without reason=revoked / reason=session_limit, and APIs return 401 {"error":"Unauthorized"} without code SESSION_ENDED, so the revoked and session-limit banners never show. Fix hint: in middleware and API auth, look up the session's end_reason_code, return {code:"SESSION_ENDED", reason} and append ?reason=… on redirect. **r2 2026-10-09: banner still missing** — after a password change/reset the other device lands on /login?redirect=%2Fdashboard with no reason banner; revoked-session banner also still absent (see FET-USL-S37).
7. **Financial_Expert_Tester / FET-USL-S7 (P2)** — HQ platform edit leaks raw DB text (H.2): idle 9999 → 400 "new row for relation sys_auth_admin_config_cf violates check constraint chk_auth_cfg_value_valid". Fix hint: validate against min/max (and the hard limits) in the API and return a friendly "between X and Y" message like the tenant override path does.
8. **Financial_Expert_Tester / FET-USL-S8 (P2)** — CONFIG_CHANGED RESET audit rows store new_value = the old tenant value, and actor_auth_user_id is null for HQ-made changes (1.9). Fix hint: on RESET write old_value = tenant value and new_value = platform value (or null), and record the HQ actor id/email in a dedicated column.
9. **Financial_Expert_Tester / FET-USL-S9 (P2)** — With Remember me, the session expires in 7 days but the sb auth-token cookie expires after ~24 h (2.6), so the user may be signed out early despite ticking Remember me. Fix hint: set the auth cookie maxAge from AUTH_REMEMBER_ME_DAYS when isRememberMe is true.
10. **Financial_Expert_Tester / FET-USL-S10 (P2)** — The new-device notification is generic (5.5): inbox title "New notification: security.login.detected", generic body, empty Arabic title2, empty template_code. Fix hint: seed or link the 0577 template for security.login.detected (EN/AR with browser, IP and time placeholders) and fail loudly when a template is missing. **r2 2026-10-09: still raw** — bell shows "New notification: security.password.changed" and "New notification: security.login.detected" (generic template, no browser/IP/time); password body does not contain the password (good).
11. **Financial_Expert_Tester / FET-USL-S11 (P2)** — Login accepts obviously invalid identifiers ('ab', 'bad@') and spends a server round-trip and rate-limit attempt on them (1a.5). Fix hint: mirror the client Zod rule on the server (400 INVALID_IDENTIFIER) and make sure the inline client check blocks the request.
12. **Financial_Expert_Tester / FET-USL-S12 (P2)** — A forged tenant-metadata update (0.1) is blocked correctly but surfaces as GoTrue 500 unexpected_failure "Error updating user", which looks like an outage in logs and monitoring. Fix hint: raise the trigger error with a clear message/hint and map it to 403 in any app-level wrapper; exclude it from 5xx alerting.
13. **Financial_Expert_Tester / FET-USL-S13 (P2)** — Account security in Arabic: the right sidebar overlaps the main content at ~920 px viewport (page title and card right edges hidden), reproduced twice; English is fine (4.7). Fix hint: use logical properties (margin-inline-start/end) for the sidebar offset and test RTL at tablet widths.
14. **Financial_Expert_Tester / FET-USL-S14 (P2)** — Arabic gaps on Security & Sessions (1.10): page header title "Security & Sessions", most sidebar items and enum values REVOKE_OLDEST / BLOCK_NEW stay in English or raw. Fix hint: add ar.json keys for the header/sidebar and render enum values through translated labels ("Sign out the oldest device" / "Block the new sign-in").
15. **Financial_Expert_Tester / FET-USL-S15 (P2)** — HQ tenant Users list shows the raw i18n key "tenants.users.roles.super_admin" in the role column. Fix hint: add the missing role keys (super_admin, tenant_admin, operator, viewer) in HQ EN/AR catalogs and fall back to a humanized role name.
16. **Financial_Expert_Tester / FET-USL-S16 (P2)** — HQ platform policy page /en/auth-config has no sidebar entry (H.1 navigation step fails; reachable by URL only). Fix hint: add Settings → Sign-in & Sessions to the HQ sidebar, gated by the HQ permission.
17. **Financial_Expert_Tester / FET-USL-S17 (P2)** — The HQ tenant auth-config banner says the plan lacks session policy customization for Demo Laundry, which is on ENTERPRISE. That's confusing for HQ staff (related to S5). Fix hint: show the plan name and the exact flag ("Plan ENTERPRISE: session_timeout_control = off") with a link to plan flags.
18. **Financial_Expert_Tester / FET-USL-S18 (P2)** — The Active Sessions Audit dialog shows only "Created at". Fix hint: add signed-in-by, login IP / last IP, device, ended at, ended reason (localized) and ended by (user/admin/system).
19. **Financial_Expert_Tester / FET-USL-S19 (P2, a11y)** — The User code pencil (edit) icon button on the user Profile has no accessible name. Fix hint: add aria-label / title "Edit user code" (EN/AR).
20. **Financial_Expert_Tester / FET-USL-S20 (P2)** — Active Sessions rows don't link to the user, and /dashboard/users/[userId] only accepts the auth user UUID (/dashboard/users/U000001 → "User not found"; org row id → 404). With All Users broken (S4), admins can't reach user detail. Fix hint: make the user cell a link to the user detail, and have the route also resolve a user code or org row id.
21. **Financial_Expert_Tester / FET-USL-S21 (P2, perf)** — The user Activity tab takes ~5 s to load. Fix hint: index sys_auth_audit_log (tenant_org_id, auth_user_id, created_at desc), page the query server-side, and show a skeleton.
22. **Financial_Expert_Tester / FET-USL-S22 (P2, expert)** — Add a password-strength meter and a live policy checklist (length, upper, lower, number, not recently used) to every new-password form, so users see the rules before submitting instead of after a 422.
23. **Financial_Expert_Tester / FET-USL-S23 (P2, expert)** — Record a human "Signed out because…" reason (idle, revoked by <admin>, session limit, password changed, user deactivated) on every session end. Show it in the end-session audit and on the login banner.
24. **Financial_Expert_Tester / FET-USL-S24 (P2, expert)** — Add admin actions "Lock now" and "Force password change at next sign-in" on user detail (tenant + HQ) for suspected-compromise cases, with audit rows.
25. **Financial_Expert_Tester / FET-USL-S25 (P2, expert)** — Add CSV export (current filter) to Active Sessions for security reviews and audits.
26. **Financial_Expert_Tester / FET-USL-S26 (P2, expert)** — During the idle warning, show the countdown in the browser tab title (e.g. "(0:45) Are you still there?") so users working in another tab notice before being signed out.
27. **Financial_Expert_Tester / FET-USL-S27 (P3)** — Preview lacks QA fixtures: no role with auth_config:read only (1.7), no user_sessions:read-only role (4.12), no disposable users, no readable test inbox (4.14/4.15, 6.7, 6.12). Fix hint: seed a QA role set plus 2–3 disposable users per demo tenant (one without email) and a catch-all test mailbox so these scenarios stop being BLOCKED.

28. **Financial_Expert_Tester / FET-USL-S28 (P1)** — Idle timeout ends with the wrong reason (2.4): browser lands on /login?reason=session_expired ("Your session has expired…") instead of reason=idle_timeout, and a second tab gets no reason at all, although the server records IDLE_TIMEOUT. Fix hint: when the client idle state machine or the server status says IDLE_TIMEOUT, redirect with reason=idle_timeout and broadcast the reason to other tabs (same channel as sign-out) so every tab shows the right banner. Related to FET-USL-S6.
29. **Financial_Expert_Tester / FET-USL-S29 (P2)** — Cross-tab "Stay signed in" is delayed 3–12 s (2.5): the other tab's warning keeps counting down after the user already chose to stay. Fix hint: post the "stay" event on BroadcastChannel/storage immediately and close peer dialogs on receipt instead of waiting for the next poll.
30. **Financial_Expert_Tester / FET-USL-S30 (P2)** — Idle warning appeared ~35 s after sign-in with idle 1 min / warning 15 s (expected ~45 s). Fix hint: confirm the warning start = idle timeout − warning period, measured from last real input, not from page load/heartbeat time.
31. **Financial_Expert_Tester / FET-USL-S31 (P2)** — Explicit Sign Out lands on /login?redirect=%2Fdashboard%2Faccount%2Fsecurity, so the next person who signs in on that browser is sent to the previous user's last page. Fix hint: drop the redirect param on a deliberate sign-out; keep it only for expiry/revocation.
32. **Financial_Expert_Tester / FET-USL-S32 (P1)** — Lockout message shows 255 minutes instead of 15 (0.5/1a.6/6.14): "Too many failed login attempts. Your account has been locked for 255 minutes" and, while locked, "…try again in 255 minutes". Cause: DB TimeZone=Asia/Muscat and org_users_mst.locked_until is timestamp WITHOUT time zone; record_login_attempt sets NOW()+15 min (AUTH_LOCKOUT_MINUTES platform 15) and returns it without offset, and web-admin/app/api/auth/login/route.ts L161-166 (and the locked branch L118-123) plus lib/services/auth/password/admin-password.ts L218 parse it with new Date() on a UTC server, adding +240 min (15 + 240 = 255). The real lock is 15 min and starts at the 5th failure. Fix hint: return locked_until as timestamptz (AT TIME ZONE 'Asia/Muscat') from record_login_attempt/is_account_locked, or migrate locked_until and last_failed_login_at to timestamptz. Evidence: api-evidence/lockout-255.txt.
33. **Financial_Expert_Tester / FET-USL-S33 (P2)** — Admin Unlock on an account that is not locked says "The account was not locked." but still writes a second ACCOUNT_UNLOCKED audit row (details was_locked:false) — visible as a duplicate "Account unlocked" in Activity (6.14/6.15). Fix hint: don't audit no-ops (or log them with a distinct no-op event).
34. **Financial_Expert_Tester / FET-USL-S34 (P1-P2)** — Permission check is inconsistent between navigation and page: for super_admin, the direct URL /dashboard/users and the sidebar Security & Sessions link redirect to /dashboard?error=insufficient_permissions (no toast explaining why), while sidebar Team Members > All Users works and the direct URL /dashboard/settings/security loads. Extends FET-USL-S4 (client-side withAdminRole race). Fix hint: gate both link and page on the same permission (users:read / auth_config:read) and show a message when redirecting.
35. **Financial_Expert_Tester / FET-USL-S35 (P2)** — The admin revoke success toast reads "No sessions were ended." styled as success when revoked=0 (user-sessions-tab.tsx:60), and in the observed run no toast was visible at all. Fix hint: show an error/warning when revoked=0 and add an e2e test for admin single-session sign-out (see FET-USL-S2).
36. **Financial_Expert_Tester / FET-USL-S36 (P2)** — Closed incognito windows leave ACTIVE registry rows until the idle sweep (each window = new device cookie = new session row + NEW_DEVICE alert), e.g. 4 stale "Chrome on Linux" rows for one user; rows ended by the 5-min sweep only after the 30 min idle timeout. Fix hint: send a pagehide beacon to end/mark the session, and/or treat sessions without a recent heartbeat as stale in the list.
37. **Financial_Expert_Tester / FET-USL-S37 (P2)** — After a password reset or change the other device lands on /login?redirect=%2Fdashboard with no reason banner (6.2, HQ reset). Extends FET-USL-S6: PASSWORD_CHANGED should map to reason=password_changed on redirect and in the 401 body.
38. **Financial_Expert_Tester / FET-USL-S38 (P3)** — Minor UX: the user Activity tab shows the Effective Permissions block above Recent activity; the HQ users table name is not clickable (use the row menu); "Sign-in failed" messages don't show remaining attempts (generic until the lock on the 5th failure).
