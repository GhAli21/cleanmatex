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
