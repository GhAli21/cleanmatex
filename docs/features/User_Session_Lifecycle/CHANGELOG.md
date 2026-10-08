# Changelog — User Session Lifecycle

## 2026-10-09 — Close-out pass
- Fixed three previously "unrelated" failures: the `platform-inventories` nav-drift jest test (a malformed `settings_security` block in `config/navigation.ts` made the inventory extractor mis-attribute `auth_config:read`), the page-gate FAILs on `/dashboard/marketing/promotions` (server-side permission check before the redirect) and `/dashboard/reports/cash-variance/print` (`RequireAnyPermission`), and the BigInt TS2737 errors (`web-admin/tsconfig.json` target ES2017 → ES2020, type-check only). `check:ui-access-contract --wire` is PASS, `tsc` reports 0 errors, tenant build passes.
- Repaired `docs/dev/rules/integration-contracts.md`: commit `8a66fbaa` had a full duplicate of §1–§17 pasted into the §18 table (a regex-replacement token expanded the text before the match). Removed the duplicate (883 → 453 lines), restored the `{2,29}$` regex text, and extended §18 with the password contracts. HQ's copy of that file is a different version (it has §15–16, not §17–18) and was not touched.
- Added [REMAINING_WORK.md](REMAINING_WORK.md); brought STATUS, README, ADR, the guide and the implementation plan in line with what shipped; clarified that the hosted Supabase settings are recommended hardening, not required for any feature.
- HQ `notifications-hq` type errors (TS7056) and a stale metering spec belong to the Notification program: handoff in HQ `docs/features/Notification_And_Communication_Hub/Notification_HANDOFF_from_User_Session_Lifecycle.md`.
- Debugging knowledge base: Issues 14–17 added to every copy of `common_issues.md` / `common-issues.md` and the Cursor rule.

## 2026-10-09 — Password management
- Self-service: optional **two-field** change (new + re-type) when policy `AUTH_PWD_REQUIRE_CURRENT` is off (limited to a fresh sign-in, `AUTH_PWD_FRESH_SIGNIN_MIN`); success dialog "Sign out now / Later"; **Email me a link** option; password-link emails via `/auth/confirm`.
- Administrators (`users:reset_password`, now also granted to `admin`): set a temporary password (generate/copy, forced change by default), email a link, unlock an account — tenant app and HQ.
- Forced password change (`pwd_must_change`) enforced by proxy, API validator and server actions.
- Shared acceptance rules: strength, password history (`fn_auth_pwd_reuse_check`), breached-password check; owner notification after every change (`security.password.changed`).
- Config catalog: new **PASSWORD** group (4 items) in the tenant Security & Sessions screen and HQ screens.
- Migrations 0581 (flag, history, config, events, validate fn, role grant, template v2), 0584 (bilingual actor template v3), 0585 (history ordering).

## 2026-10-08
- Phase 4–6 complete: Account security page, Active Sessions screen, user Sessions tab, password change/reset flows, reset-password page rewrite, global `SESSION_ENDED` handling, new-device alert (migration 0577), pg_cron sweep + Active Sessions nav (0576).
- Activity tab: bilingual event names from `sys_auth_event_cd`, translated columns, error/empty states.
- Local `supabase/config.toml`: `jwt_expiry = 600`, `secure_password_change = true`.
- Docs: guide moved into this folder, ADR added, `integration-contracts.md` §18, `AUTH_SYSTEM_EVALUATION.md` ticked.
- HQ (cleanmatexsaas): auth-config catalog/tenant screens + API, optional `user_code`/email on user creation, session revoke on admin password reset, `user_code` shown in the HQ users list/details, payment-setup repointed from the retired movement-type table to `sys_cash_drawer_trx_type_cd` with a reachable "Cash Drawer Codes" page.

## 2026-10-03
- Phase 0–3: security hardening (0561, 0568), `user_code` and one-account-per-membership (0563), auth config catalog (0570, 0573), session registry (0575), login/logout rewired, idle/absolute timeout with warning dialog and cross-tab sync, Security & Sessions settings screen.
