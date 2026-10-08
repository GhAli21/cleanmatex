# Changelog — User Session Lifecycle

## 2026-10-08
- Phase 4–6 complete: Account security page, Active Sessions screen, user Sessions tab, password change/reset flows, reset-password page rewrite, global `SESSION_ENDED` handling, new-device alert (migration 0577), pg_cron sweep + Active Sessions nav (0576).
- Activity tab: bilingual event names from `sys_auth_event_cd`, translated columns, error/empty states.
- Local `supabase/config.toml`: `jwt_expiry = 600`, `secure_password_change = true`.
- Docs: guide moved into this folder, ADR added, `integration-contracts.md` §18, `AUTH_SYSTEM_EVALUATION.md` ticked.
- HQ (cleanmatexsaas): auth-config catalog/tenant screens + API, optional `user_code`/email on user creation, session revoke on admin password reset, `user_code` shown in the HQ users list/details, payment-setup repointed from the retired movement-type table to `sys_cash_drawer_trx_type_cd` with a reachable "Cash Drawer Codes" page.

## 2026-10-03
- Phase 0–3: security hardening (0561, 0568), `user_code` and one-account-per-membership (0563), auth config catalog (0570, 0573), session registry (0575), login/logout rewired, idle/absolute timeout with warning dialog and cross-tab sync, Security & Sessions settings screen.
