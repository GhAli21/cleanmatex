# Progress Summary — Human-Friendly Codes

**Date:** 2026-10-31, updated 2026-11-01 (Asia/Muscat). **Plan status:** CLOSED — all migrations applied; waiting for user deploy and QA.

## Done
- Engine, config, counters and consistency checks in the tenant DB (P1, applied).
- Order numbers, split sub-orders under the family root, tenant delete guard (P2, P2.1, applied); HQ create via `creating` (P2.2, code).
- Item and piece codes, external tag rules (P3, applied); tenant-wide scan and code display (P3b, code).
- Real CODE128 / QR labels and Labels & Tags settings (P4, applied).
- Store credit notes `SCN-YYYY-NNNNNN` (P5, code + `0687`, applied 2026-11-01).
- HQ permission codes and deprecation comments (P6, `0688`, `0689`, applied 2026-11-01).
- HQ Code Types, Code Consistency, General Config (API + screens) and wizard prefill (P7, code).
- Mobile LTR code display, Dart codec, notification fix, rule refresh (P8, code).
- Documentation pack, QA and performance guides, ADR-004 (P9).
- P11 follow-ups (2026-11-01, code): `0690` HQ role grants (not applied), `label_printing` removed from web-admin code, mobile booking `ltrCode`, `credit_note_no` notification variables (A-71..A-74).

## Waiting for the user
1. ~~Apply `0687` → `0688` → `0689`~~ — **done by the user 2026-11-01** (local + remote). Next: the local safety tests (`DEV_GUIDE_DOC_SEQ_ENGINE.md` §22 step 3).
2. Apply `0690` (local → `hfc_p11_role_grants_safety.test.sql` → remote); deploy web-admin, then HQ `platform-api` → `platform-web`; release the customer app; smoke test.
3. Run QA S1–S20 and the performance checks on the deployed environments (T9.1, T9.2).
4. Review the assistant decisions A-50..A-74 and approve or reject the follow-ups in `IMPLEMENTATION_REPORT.md` §7.

## Numbers
- Migrations written by HFC: 17 (`0666`–`0672`, `0674`, `0677`, `0678`, `0682`–`0685`, `0687`–`0690`); 16 applied (`0687`–`0689` on 2026-11-01), 1 pending (`0690`).
- SQL safety / engine test scripts: 8 (`supabase/tests/`, P11 adds `hfc_p11_role_grants_safety.test.sql`).
- web-admin HFC jest (2026-10-31 run): 29 suites / 237 tests pass.
- HQ jest (P2.2 + P7): platform-api 5 suites / 42 tests (P7) + tenant-create specs (P2.2); platform-web 2 suites / 7 tests.
- Mobile (P8): `mobile_core` 7 tests, customer app 2 widget tests.
