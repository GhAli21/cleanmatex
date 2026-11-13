# Tenant Users — QA Test Guide

Owner-runnable scenarios for one global user (`sys_users_mst`) with many organization memberships (`org_users_mst`). One sign-in stays with one organization until logout. These scenarios are not marked passed. Run them on local, then remote, after migrations `0734`, `0736`, and `0737`.

**Related:** [PLAN.md](PLAN.md) · session [QA_TEST_GUIDE.md](../User_Session_Lifecycle/QA_TEST_GUIDE.md)

## Before you start

Prepare this data. Use real organization names from `org_tenants_mst`. Do not use a customer record.

| Who | Setup |
|---|---|
| Organization A and Organization B | Both active |
| Shared user | One login (same email, mobile, and password) with an active organization user in A and in B |
| Single user | One login with an active organization user only in A |
| Inactive membership | The shared user's organization user in A set inactive, for the activate scenario only. Restore it afterward |
| Tenant admin | `users:update` and `users:reset_password` in the organization you are testing |
| HQ operator | `hq_org_users:read` and `hq_org_users:lock` |

Sign-in URL: `/login`. Users: **Team Members → Users** · `/dashboard/users`. Add user: `/dashboard/users/new`. User detail: `/dashboard/users/{userId}` where `{userId}` is the global user id. Account security: user menu → **Account security** · `/dashboard/account/security`. HQ workspace: `/org-users-manage`.

A `PENDING` session is the picker. It is not a business session. An `ACTIVE` session is the only organization authority.

## 1. Sign-in picker

| # | Scenario | Steps | Expected |
|---|---|---|---|
| 1.1 | One organization skips the picker | Sign out. Sign in as the single user | No dialog. Lands on `/dashboard` for organization A |
| 1.2 | Two organizations show the picker | Sign out. Sign in as the shared user | Dialog title **Choose an organization** / **اختر المنشأة**. Only the two organization names. No roles, no other people, no other employers |
| 1.3 | Choice binds that organization | In 1.2, choose organization B | Dashboard shows organization B. Data is B's. There is no organization switcher in the shell |
| 1.4 | Last organization is highlighted | Sign out from B and sign in again | B is marked as the last organization. Choosing A still works. The highlight is not automatic sign-in |
| 1.5 | Cancel does not choose | Open the picker, press Escape or **Cancel** | Signed out. Next sign-in shows the picker again. No `ACTIVE` session was left for the highlighted row |
| 1.6 | Pending cannot open the dashboard | Stop on the picker. Open `/dashboard` in the same browser | Sent back to `/login`. The picker can be shown again. Business pages do not load |
| 1.7 | Inactive or suspended organization is absent | Deactivate the membership in B, or suspend organization B. Sign in as the shared user | B is not in the list. If A is the only eligible row, sign-in goes straight to A. If none remain, sign-in is denied with a clear locked or inactive message |
| 1.8 | Arabic and RTL | Switch the login page to Arabic and repeat 1.2 | **اختر المنشأة**. Hint says the sign-in stays with the chosen organization until sign-out. Layout is RTL. Keyboard can reach every organization and Cancel |
| 1.9 | Audit | After a successful choice | `sys_auth_audit_log` has `LAUNDRY_CHOSEN` for that global user and organization. No password or token in the row |

## 2. One organization per sign-in

| # | Scenario | Steps | Expected |
|---|---|---|---|
| 2.1 | No switcher | While signed in, check the top bar and the user menu | Organization name is a label. There is no control that changes organization without signing out |
| 2.2 | Other organization is not the session | Signed in to A, open Users | The list is organization A. The shared user's B membership is not in this list |
| 2.3 | Logout is required to change organization | Sign out, sign in, choose the other organization | The new dashboard is the organization you chose. The previous session is ended |

## 3. Create an organization user

Page: `/dashboard/users/new`. Leave the email or phone field so the lookup runs. You can also press Save, which looks up before it writes.

| # | Scenario | Steps | Expected |
|---|---|---|---|
| 3.1 | New global user | Email and phone that exist nowhere. Fill name, role, and password. Save | Password fields stay visible. One `sys_users_mst` row and one organization user in this organization. They can sign in |
| 3.2 | Add an existing login | In organization B, type the shared user's email and leave the field | Warning: this global user already has a login. Saving adds them to this organization. Password fields hide. Save does not ask for a new email, mobile, or password. No list of other employers |
| 3.3 | Already active here | Type an email that already has an active organization user in this organization | Message that this global user is already active here, plus **Open the user**. Save does not create a second row |
| 3.4 | Inactive membership | Type the email of a global user whose organization user here is inactive. Save | Message that saving turns the membership back on. No new password. The same row becomes active. A second insert does not appear |
| 3.5 | Same email is one global user | After 3.2, search `sys_users_mst` by that email | One row. Two `org_users_mst` rows, one per organization, with different membership ids |
| 3.6 | Arabic | Repeat 3.2 in Arabic | **هذا المستخدم العام لديه تسجيل دخول بالفعل.** Organization is **المنشأة**, not مستأجر |

## 4. Lock this organization only

User detail: `/dashboard/users/{userId}`. The button is hidden without `users:update`, and hidden on your own user.

| # | Scenario | Steps | Expected |
|---|---|---|---|
| 4.1 | Lock copy | **Lock in this organization** | Confirm: they are signed out of this organization only. Their login at other organizations stays usable |
| 4.2 | Lock signs out only here | Shared user is signed in to A in browser 1 and to B in browser 2. In A, lock them | Browser 1's next request goes to sign-in. Browser 2 in B keeps working |
| 4.3 | Locked organization is omitted | Sign out and sign in as the locked user | Organization A is not in the picker. B can still be chosen |
| 4.4 | Unlock | **Unlock in this organization** and confirm | They can sign in to A again. A global lock or a password-attack lock, if one is still set, still denies every organization |
| 4.5 | Cannot lock yourself | Open your own user detail | No lock button |
| 4.6 | Audit | After 4.2 and 4.4 | `MEMBERSHIP_LOCKED` then `MEMBERSHIP_UNLOCKED` in `sys_auth_audit_log`, with this organization id |

## 5. Password is global

Account security: `/dashboard/account/security`. Read the hint before submitting.

| # | Scenario | Steps | Expected |
|---|---|---|---|
| 5.1 | Warning before save | Open Change password in English, then Arabic | English: the password is the same at every organization, and saving signs you out of every organization, including this one. Arabic: **كلمة المرور هذه واحدة لكل المنشآت. حفظها يسجّل خروجك من كل المنشآت، بما فيها هذه.** |
| 5.2 | Every organization ends | Shared user is signed in to A and, in another browser, to B. Change the password in A | Both browsers must sign in again. The new password works for A and for B. The old password does not |
| 5.3 | Administrator reset | On another user's detail, **Reset password**, set a temporary password | Hint: they are signed out of every organization. Their sessions in A and B end |
| 5.4 | Forced change | Sign in with the temporary password | The screen says the password is the same at every organization. After save, the browser goes to `/login` |

## 6. HQ locks

Workspace: `/org-users-manage`. A tenant-app token must receive 403 on these HQ routes.

| # | Scenario | Steps | Expected |
|---|---|---|---|
| 6.1 | Search | Exact email, mobile, or user code | One global user. No leading-wildcard search |
| 6.2 | Detail | Open that user | Global lock, attack lock, and every membership: organization name, active, membership lock |
| 6.3 | Global lock | Lock the global user | They are signed out of A and B. Sign-in is denied at every organization until HQ unlocks |
| 6.4 | Membership lock from HQ | Unlock the global user. Lock only the A membership | Same result as scenario 4.2: A ends, B stays |
| 6.5 | Attack lock is not a laundry unlock | Cause the password-attack lock (repeated wrong passwords). In the tenant app, unlock the A membership | Sign-in is still denied at A and at B. HQ **Unlock account** / clear attack lock allows sign-in again |
| 6.6 | Check order | Set a global lock and a membership lock. Clear only the membership lock | Sign-in is still denied everywhere until the global lock is cleared |

## 7. Delete and deactivation

| # | Scenario | Steps | Expected |
|---|---|---|---|
| 7.1 | Deactivate one membership | Deactivate the organization user in A | Sessions for A end. A session already open in B stays. The auth user still exists |
| 7.2 | Hard delete while another membership remains | Delete the organization user in A while B remains | `auth.users` and `sys_users_mst` remain. They can still sign in to B |
| 7.3 | Hard delete of the last membership | Delete the only remaining organization user | That auth user and `sys_users_mst` row are removed. The email can be used again for a new global user |

## 8. Staff API does not trust a tenant claim

Automated coverage: `cmx-api/src/common/guards/staff-session.spec.ts` (token claim ignored, `X-Tenant-Id` ignored, `PENDING` rejected).

| # | Scenario | Steps | Expected |
|---|---|---|---|
| 8.1 | Header is not an override | With a signed-in session for A, call a cmx-api route that uses `JwtAuthGuard` and `TenantGuard`, and send `X-Tenant-Id` of B | The organization on the request is A. B's data is not returned |
| 8.2 | Claim is not an override | Repeat with a token that still contains a `tenant_org_id` claim for B while the session row is A | The organization is A |
| 8.3 | Pending is rejected | Call the same route while the picker is open and no organization has been chosen | 401. The header does not turn the pending sign-in into organization B |

## 9. What this file does not cover

Customers, `sys_person_mst`, and in-session organization switching are out of this release. Do not test them here.

## Financial_Expert_Tester Results

**Round 1 — 2026-11-13, 20:51–21:06 Asia/Muscat.** Remote adaptation: the guide says local, then remote. Per owner direction this ran only on deployed https://cmx.cleanmatex.com (Demo Laundry LLC) and https://hqsaas.cleanmatex.com (HQ). UI-only, observe-only: no Save, Confirm, Lock, Unlock, Reset, Deactivate, or Delete was pressed. Lock and Reset password dialogs were opened only to read them, then cancelled. Roles signed in: Demo admin, operator (U000001), viewer, and HQ SAAS Admin. Credentials are in the credentials file, not here. Screenshots `tu-00`…`tu-28` are on the FET box under `/workspace/qa-20261113/shots/tenants-users/`.

**Main blocker:** no shared user exists. HQ exact-email search showed operator@demo-laundry.example (U000001), admin@demo-laundry.example (U000003), and admin@saudiriyadhdemo.com (U000002) each with exactly one organization user. Creating one needs a write (scenario 3.2 Save, or HQ "Add an organization user"), which waits for owner approval.

| # | Result | Evidence |
|---|---|---|
| 1.1 | PASS | Admin, operator, and viewer, each single-organization, went straight to `/dashboard` with no dialog. Label "Demo Laundry LLC" and sidebar "CURRENT TENANT … Role: super_admin/operator/viewer" (tu-02, tu-19, tu-22) |
| 1.2 | BLOCKED | No shared user (see blocker). Picker dialog never shown |
| 1.3 | BLOCKED | Needs 1.2 |
| 1.4 | BLOCKED | Needs 1.2 |
| 1.5 | BLOCKED | Needs 1.2 |
| 1.6 | BLOCKED | Needs a PENDING picker session |
| 1.7 | NOT RUN | Mutate (deactivate membership or suspend org) plus needs a shared user |
| 1.8 | PARTIAL | `/login` switches to RTL with Arabic copy and back to EN cleanly (tu-00, tu-01). The **اختر المنشأة** picker, its hint, and keyboard reach could not be checked without a shared user |
| 1.9 | BLOCKED | Needs a successful picker choice. DB audit row not checked |
| 2.1 | PASS | "Demo Laundry LLC" is a plain label in the top bar. User menu shows Profile, Account security, Settings, and Sign Out, with no organization switch (tu-03). Same for operator and viewer |
| 2.2 | PASS | Admin: Team Members → All Users and direct `/dashboard/users` both load, listing Demo Laundry staff only (tu-04). B-membership absence can't be shown without a shared user |
| 2.3 | BLOCKED | Needs a second organization for the same login |
| 3.1 | NOT RUN | Mutate (creates a global user). Lookup part only: `qa.nobody.tu1113@example.com` → password fields stay visible (tu-14). Nothing saved |
| 3.2 | PARTIAL | Lookup only, as Demo admin with `admin@saudiriyadhdemo.com` (a Saudi Demo login): banner "This global user already has a login. Saving adds them to this organization. No new password is needed." Password fields hidden, no list of other employers or organization names (tu-13). Save not pressed |
| 3.3 | PARTIAL | `operator@demo-laundry.example` → "This global user is already active in this organization." plus **Open the user** link (tu-12). Save not pressed, so "no second row" not checked. **Create User** stays enabled under the banner |
| 3.4 | NOT RUN | Needs an inactive membership (mutate) |
| 3.5 | BLOCKED | Needs 3.2 Save. DB not queried |
| 3.6 | PARTIAL | Banner in AR: "هذا المستخدم العام لديه تسجيل دخول بالفعل. الحفظ يضيفه إلى هذه المنشأة. لا حاجة لكلمة مرور جديدة." Uses المنشأة, RTL OK (tu-15, tu-16). But the same page subtitle still says "إنشاء حساب مستخدم جديد لهذا **المستأجر**", and the sidebar says "المستأجر الحالي" and "إدارة المستأجر". EN subtitle: "Create a new user account for this tenant" |
| 4.1 | PASS | Operator detail `/dashboard/users/7dbe9b05-…`: "Lock in this organization" → dialog "Lock this organization user? They are signed out of this organization only. Their login at other organizations stays usable." Cancelled. Operator still Active and unlocked (tu-07, tu-09). HQ at 21:04: "Organization-user lock: No" |
| 4.2 | BLOCKED | Needs a shared user in 2 browsers plus a lock (mutate) |
| 4.3 | BLOCKED | Needs 4.2 |
| 4.4 | BLOCKED | Needs 4.2 |
| 4.5 | PASS | Admin's own detail page has no lock button (tu-10). Operator and viewer get `/dashboard?error=insufficient_permissions` on `/dashboard/users`, `/users/new`, and admin's detail page, so no lock or reset is reachable (tu-20) |
| 4.6 | BLOCKED | Needs 4.2 and 4.4 |
| 5.1 | PASS | `/dashboard/account/security` EN: "Enter your current password, then choose a new one. This password is the same at every organization. Saving it signs you out of every organization, including this one." AR: "…كلمة المرور هذه واحدة لكل المنشآت. حفظها يسجّل خروجك من كل المنشآت، بما فيها هذه." (tu-17, tu-18). Same hint for operator and viewer. Nothing typed |
| 5.2 | BLOCKED | Needs a shared user plus a password change (mutate) |
| 5.3 | PARTIAL | Hint verified: Reset password → "Choose the password: Set a temporary password and give it to the user directly. They are signed out of every organization." Cancelled, nothing typed (tu-08). Session end in A and B not run |
| 5.4 | NOT RUN | Needs 5.3 Set password (mutate) |
| 6.1 | PASS | HQ sidebar "Organization Users" → `/en/org-users-manage` "Global users" (1.6 s). Exact emails each open one global user. Partial "demo-laundry" and "operator" → "No global user matches that identity", no wildcard (tu-27) |
| 6.2 | PASS | Operator: "Operator Son Of Operator User", U000001, ACTIVE. "Not globally locked" [Lock every organization]. "No attack lock is set. Failed attempts: 0". Membership Demo Laundry LLC · Active Yes · Org-user lock No · operator [Lock this organization]. "Add an organization user" form shown. Nothing clicked (tu-26) |
| 6.3 | NOT RUN | High-impact for a shared account (global lock). Needs approval and a test user |
| 6.4 | BLOCKED | Needs a shared user plus a lock |
| 6.5 | NOT RUN | Needs repeated wrong passwords (approved lockout test only) |
| 6.6 | NOT RUN | Mutate (global plus membership lock) |
| 7.1 | NOT RUN | Mutate (deactivate) |
| 7.2 | NOT RUN | Delete (high-impact) |
| 7.3 | NOT RUN | Delete (high-impact) |
| 8.1 | NOT RUN | API header tampering is outside FET's UI-only scope. Automated coverage: `staff-session.spec.ts` |
| 8.2 | NOT RUN | Same as 8.1 |
| 8.3 | NOT RUN | Same as 8.1 |

**Recount (Round 1):** PASS 8 · FAIL 0 · PARTIAL 5 · BLOCKED 14 · NOT RUN 13 (40 rows).

**Test data left behind:** none. No user, membership, lock, or password changed. Browser left on cmx `/login` (EN), and HQ signed out.

### Tester suggestions (Financial_Expert_Tester)

- **P1 FET-TU-Nov13-NoSharedUserFixture.** No login belongs to two organizations on remote, so 14 scenarios (picker, binding, cross-org lock, global password) can't run. Fix: seed one QA shared user (for example `qa.shared@…` in Demo Laundry plus BlueWave or Saudi Demo) through HQ "Add an organization user", and name it in this guide's "Before you start".
- **P2 FET-TU-Nov13-SignOutSaysExpired.** Every deliberate Sign Out (admin, operator, viewer) lands on `/login?reason=session_expired&redirect=%2Fdashboard%3Ferror%3Dinsufficient_permissions` with "Your session has expired. Please sign in again." (tu-21, tu-24). Same defect as FET-SH-Nov12-SignOutSaysExpired. Fix: a voluntary logout should use `reason=signed_out` and neutral copy.
- **P2 FET-TU-Nov13-RedirectCarriesAcrossUsers.** The post-login `redirect` from the previous user's session (`/dashboard?error=insufficient_permissions`) is kept on `/login`, so the next account (viewer, 21:02) lands on an error URL. Fix: drop `redirect` on voluntary logout, or ignore it when the signing-in user differs.
- **P2 FET-TU-Nov13-SilentPermissionRedirect.** Operator and viewer opening `/dashboard/users`, `/users/new`, or a user detail get `/dashboard?error=insufficient_permissions` after about 4–4.7 s with no message. Fix: show a cmxMessage ("You don't have access to Team Members") or a 403 page.
- **P2 FET-TU-Nov13-TenantWordingLeft.** 3.6 asks for المنشأة, not مستأجر. The banner is correct, but the Add New User subtitle says "…لهذا المستأجر" / "for this tenant", and the sidebar says "CURRENT TENANT / المستأجر الحالي" and "Tenant Admin / إدارة المستأجر". HQ role "Tenant Administrator · مدير المستأجر". Fix: rename to organization / المنشأة in `users.json` (en/ar) and the shell.
- **P2 FET-TU-Nov13-CrossOrgEmailDisclosure.** Typing any email in Add New User tells a tenant admin whether that address has a login anywhere on the platform (a Saudi Demo admin email gave "already has a login"). This is by design for attach, but it is an account-enumeration signal across tenants. Fix: keep it, but rate-limit the lookup, audit it, and consider showing the hint only on Save.
- **P3 FET-TU-Nov13-CreateEnabledWhenActive.** With "already active in this organization", **Create User** stays enabled (tu-12). Fix: disable it and make **Open the user** the primary action.
- **P3 FET-TU-Nov13-UnlockShownWhenUnlocked.** Operator detail shows "Unlock account" next to "Lock in this organization" while the user is not locked (tu-07). Fix: show Unlock only when a lock exists.
- **P3 FET-TU-Nov13-DoubleAsterisk.** "Display Name * *" and "Role * *" on Add New User (tu-12). Fix: one required marker.
- **P3 FET-TU-Nov13-UsersNewFirstRedirect.** The first direct open of `/dashboard/users/new` as admin redirected away (tu-05). It opened on the next try. Fix: check the permission-loading race on first navigation.
- **P3 FET-TU-Nov13-HqRawValues.** On `/en/org-users-manage`: organization picker shows UUIDs ("BlueWave Laundry Co. · 20000002-2222-…"), role column shows raw `super_admin` / `tenant_admin`, status shows "ACTIVE", and role labels mix EN and AR ("Admin · مدير"). Fix: show localized labels only and hide ids.
- **P3 FET-TU-Nov13-HqEnterDoesNotSearch.** Pressing Enter in the HQ search field does nothing. Fix: submit on Enter.
- **P3 FET-TU-Nov13-NameMismatch.** The same login is "Operator Demo 1" in the tenant and "Operator Son Of Operator User" in HQ, and the admin name is misspelled "Admin Demo Lanudry" in the data. Fix: clarify global name vs organization display name in HQ detail, and correct the seed typo.
- **P3 FET-TU-Nov13-HqOrgCountsZeroActive.** HQ dashboard "TOTAL ORGANIZATIONS 4 / 0 active · 0 trial" while the list shows 1 Active and 3 Trial (same as FET-SH-Nov13 HqOrgCountsZeroActive).

**Needs owner approval to continue (asked once):** create one QA shared user (Demo Laundry plus a second org) and its 2-browser sessions, then lock/unlock, password change/reset, deactivate, and restore on that QA user only. Deletes (7.2, 7.3), global lock (6.3), and the attack-lock test (6.5) are high-impact and need an explicit yes.
