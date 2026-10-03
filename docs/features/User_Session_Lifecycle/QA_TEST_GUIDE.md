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