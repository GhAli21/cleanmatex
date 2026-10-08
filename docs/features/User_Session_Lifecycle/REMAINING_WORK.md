# Remaining work register — User Session Lifecycle

**Refreshed 2026-10-09 — the program is code-complete** in both repos (tenant app `cleanmatex`, HQ `cleanmatexsaas`). Everything in the plan and the later password-management addition is built, and all of this program's migrations are applied local + remote. What is left is owner-only, plus work deliberately left for a later phase. See [STATUS.md](STATUS.md) for the per-phase record.

**Migrations (this program):** `0561`, `0563`, `0568`, `0570`, `0573`, `0575`, `0576`, `0577`, `0581`, `0584`, `0585` — all applied local + remote. The newest migration in the folder is `0587` (other programs use `0578–0580`, `0582–0583`, `0586`, `0587`), so the next free number is `0588+`; always re-list `supabase/migrations/` before numbering.

---

## 1. Owner-only — to close the plan

| # | Item | Required? | Detail |
|---|---|---|---|
| 1 | **Manual QA** | Required to close | Run [QA_TEST_GUIDE.md](QA_TEST_GUIDE.md): Phases 0–5, §6 (password flows, 6.1–6.21) and the HQ scenarios H.1–H.8. Nothing has been click-tested in a browser yet; all verification so far is automated (see §5). |
| 2 | **Commit both repos** | Required to close | Nothing from this program is committed in `cleanmatex` or `cleanmatexsaas`. This pass also repaired `docs/dev/rules/integration-contracts.md` (it was corrupted in commit `8a66fbaa`; see CHANGELOG) — commit that too. |
| 3 | **Mail settings** | Required only for the email features | Tenant app: `RESEND_API_KEY` (+ from address) and `NEXT_PUBLIC_SITE_URL`. HQ: `HQ_RESEND_API_KEY` (+ `HQ_RESEND_FROM_EMAIL`) and `TENANT_APP_URL`, in the `.env` file HQ actually loads (for example `.env.apilocaldbjh`). Without them the "email me a link", "email a link", and "notify user" options report *email not configured* instead of failing silently; everything else works. |
| 4 | **Hosted Supabase settings** | Recommended before go-live; **not** required for any feature to work | See §1.1. |
| 5 | **HQ role grants** | Required only when HQ RBAC enforcement is switched on | Grant `auth_config.view` and `auth_config.manage` to the HQ roles that should manage sign-in policy before setting `HQ_RBAC_ENFORCEMENT_ENABLED=true`. The permissions are inert until then. |

### 1.1 Hosted Supabase settings — what they do and what happens without them

Both are already set in the local `supabase/config.toml`; the hosted project has its own copy.

| Setting | Where (hosted) | Without it |
|---|---|---|
| **JWT expiry = 600 s** | Dashboard → Authentication → Sessions → *JWT expiry* (or Project Settings → API) | The app itself still revokes immediately (every page and API call is checked against the session registry). Only calls that go **straight from the browser to Supabase** with an already-issued access token keep working until that token expires — up to 1 hour (default 3600 s) instead of 10 minutes, after a session was revoked or timed out. |
| **Secure password change = on** | Dashboard → Authentication → Providers → Email → *Secure password change* | The app's own change/reset flows run on the server and are unaffected. But a browser holding a valid token can call Supabase's own password update directly, bypassing this app's policy checks (current password, strength, history, breached-password check); with the setting on, Supabase requires a recent sign-in or re-authentication for that call. |

Because the product is pre-launch with demo data only, neither blocks QA. Set both before real tenants sign in.

---

## 2. Decided — no work needed

- **Plan downgrade does not clear tenant overrides automatically.** HQ has an explicit action (`POST /auth-config/tenants/:id/overrides/clear-without-plan`, button on the tenant auth-config screen). Wiring it into plan-change / renewal code is billing behavior (HQ `CLAUDE.md` §11) and needs separate approval. Owner decision 2026-10-09: the manual action is enough for now.

---

## 3. Left out on purpose — a later phase

| Item | Why it is not built | What it would take |
|---|---|---|
| **MFA** | Out of scope by owner decision at planning time. | Supabase Auth MFA enrolment + challenge UI, a policy item (`AUTH_MFA_*`) in the config catalog, recovery codes, audit events. |
| **Password expiry / forced rotation** | Suggested during password management, not requested. | A policy item for max password age, a `pwd_changed_at` check in `fn_auth_session_validate` (the column already exists) that sets the forced-change flag, and a warning banner before expiry. |
| **cmx-api enforcement** | Deferred: the NestJS client API does not validate the session registry yet. | Call `fn_auth_session_validate` (or share the guard) from the cmx-api auth guard; the revocation contract is already in `integration-contracts.md` §18. |
| **Role change does not revoke sessions** | Permissions refresh through a separate path; deliberately out of scope. | A trigger on role assignment that calls `fn_auth_sessions_revoke(..., reason 'SECURITY')` or forces a permission-cache refresh. |
| **"Cannot reset a higher role" rule** | Suggested, not requested; today any holder of `users:reset_password` can reset any other user in the tenant (never themselves). | A role-rank comparison in `adminSetPassword` / `adminSendResetLink` and in HQ `resetPassword`, plus tests. |
| **Per-role forced-change defaults** | Suggested, not requested; forced change is currently a per-reset toggle (default on). | A catalog item or role attribute read by the admin reset dialog. |
| **Routes that authorise from `user.user_metadata.role`** | Outside this program; the field is user-editable (for example `app/api/v1/customers/export/route.ts`). | A separate hardening pass moving those checks to `requirePermission` / `hasPermissionServer`. |

---

## 4. Not part of this program

- **Notification program (HQ `notifications-hq`).** `tsc -p tsconfig.build.json` in `platform-api` fails with TS7056 on ordered-list and `rpc` repository methods, and `dispatch/__tests__/metering.service.spec.ts` has a type error plus 3 runtime failures (a missing `PricingService` provider). These files carry that program's uncommitted work, so this program did not change them; the fixes were tried, verified, and reverted. Full details and the tested fix are in HQ `docs/features/Notification_And_Communication_Hub/Notification_HANDOFF_from_User_Session_Lifecycle.md`. Until they apply it, HQ `tsc` and `nest build` will keep failing because of that module — not because of anything in this program.
- **Events this program depends on** (do not rename without telling this program's owner): Notification Hub events `security.password.changed` (template v1 `0345`, v2 `0581`, v3 `0584`) and `security.login.detected` (`0345`, v2 `0577`).
- **HQ builds not re-run.** HQ `nest build` / `next build` were last green on 2026-10-08, before password management. HQ `tsc` (platform-web), the tenant-users specs (20/20) and the web model tests (3/3) pass since. Re-run both HQ builds once the notification fix lands.
- **Browser smoke test (Playwright)** has not been done; it is not part of the plan.

### Cleared on 2026-10-09 (previously listed as "pre-existing, unrelated")

| Was | Cause and fix |
|---|---|
| jest `platform-inventories` nav-drift failure for `/dashboard/settings/permissions` | A malformed entry in `config/navigation.ts` (`},      {` on one line) made the inventory extractor attribute `auth_config:read` to the wrong entry. Formatting fixed, inventories rebuilt, drift = 0. |
| 3 page-gate FAILs in `check:ui-access-contract --wire` | `marketing/promotions` now checks permission on the server before redirecting; `reports/cash-variance/print` is wrapped in `RequireAnyPermission`; the pos-sessions one no longer reproduced. `--wire` reports PASS overall. |
| TS2737 BigInt errors in `lib/services/fx/*` | `web-admin/tsconfig.json` target raised from ES2017 to ES2020 (type-check only; the build uses Next's own compiler). `tsc` now reports 0 errors. |
| 2 TS errors in HQ `notifications-hq/routes` | Belongs to the Notification program — see above. |

Each of these also has an entry in `.claude/docs/common_issues.md` (and the mirrored skill, `.codex`, `.agents` and Cursor copies) as Issues 14–17.

---

## 5. Verification record (2026-10-09)

| Gate | Result |
|---|---|
| Tenant `eslint` (touched files) | clean |
| Tenant `tsc --noEmit` (fresh build info) | 0 errors |
| Tenant jest — auth, api/auth, features/auth-session, features/users | 21 suites, 222 tests pass |
| Tenant db-integration `auth-password-history` | 7/7 (local DB) |
| `check:ui-access-contract --wire` | PASS |
| `check:platform-info-inventories` / `check:i18n` | PASS / PASS |
| Tenant `npm run build` | exit 0 |
| HQ `tenant-users.service.spec` | 20/20 |
| HQ platform-web `tsc`, `reset-password-model` test | clean, 3/3 |
| HQ platform-api `tsc` | only the Notification program's TS7056 errors |
