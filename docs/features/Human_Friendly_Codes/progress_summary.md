# Progress Summary — Human-Friendly Codes

**Date:** 2026-10-31, updated 2026-11-05 (Asia/Muscat). **Plan status:** CLOSED — all 17 HFC migrations applied through `0690`; web/HQ deployed 2026-11-05; waiting for smoke test, QA and the next mobile release.

## Done
- Engine, config, counters and consistency checks in the tenant DB (P1, applied).
- Order numbers, split sub-orders under the family root, tenant delete guard (P2, P2.1, applied); HQ create via `creating` (P2.2, code).
- Item and piece codes, external tag rules (P3, applied); tenant-wide scan and code display (P3b, code).
- Real CODE128 / QR labels and Labels & Tags settings (P4, applied).
- Store credit notes `SCN-YYYY-NNNNNN` (P5, code + `0687`, applied 2026-11-01).
- HQ permission codes and deprecation comments (P6, `0688`, `0689`, applied 2026-11-01).
- HQ Code Types, Code Consistency, General Config (API + screens) and wizard prefill (P7, **deployed 2026-11-05**).
- Mobile LTR code display, Dart codec, notification fix, rule refresh (P8; web-admin notification fix **deployed 2026-11-05**; mobile release pending).
- Documentation pack, QA and performance guides, ADR-004 **Accepted** 2026-11-05 (P9 / A-69).
- P11 follow-ups: `0690` HQ role grants (**applied 2026-11-05**), `label_printing` removed from web-admin code, mobile booking `ltrCode` (ships with next app release), `credit_note_no` notification variables (A-71..A-74). Types + `prisma.schema` regenerated; web-admin / `platform-api` / `platform-web` deployed 2026-11-05.

- HQ doc-seq console redesign A-76..A-83 (2026-11-06, code + tests, no migration): hub KPIs, type detail page, read-only counters, consistency issue list, General Config validation / review / history. **Deploy `platform-api` + `platform-web` pending.**

## Waiting for the user
1. ~~Apply `0687` → `0688` → `0689`~~ — **done by the user 2026-11-01** (local + remote).
2. ~~Apply `0690`; regenerate types / `prisma.schema`; deploy web-admin, HQ `platform-api`, HQ `platform-web`~~ — **done by the user 2026-11-05** (morning).
2b. ~~Apply `0693`/`0695`/`0696`/`0697`; regenerate types + Prisma~~ — **done by the user 2026-11-05** (evening, local+remote).
2c. Deploy latest web-admin (LEGACY / barcode shim / credit_note.issued emit) — **pending** (not reported this turn).
3. Smoke test (DEV_GUIDE §22 step 7): issue one store credit note → number looks like `SCN-2026-000001`; HQ Code Types / Consistency / General Config open as SUPER_ADMIN.
4. Release the customer mobile app (P8 LTR + P11 booking `ltrCode`).
5. Run QA S1–S20 and the performance checks on the deployed environments (T9.1, T9.2).
6. ~~Review A-50..A-74.~~ **DONE 2026-11-05**. ~~Apply `0693`/`0695`/`0696`/`0697` + types/Prisma~~ **DONE 2026-11-05** (user, local+remote). Remaining: evening **deploy**, safety-test report, test-tenant smoke (#11), QA #12, mobile release, P10 samples (`FINAL_QA_RUNBOOK.md`). ~~ADR-004~~ **Accepted**. Booking test **fixed** (#15).

## Numbers
- Migrations written by HFC: 21 (`0666`–`0672`, `0674`, `0677`, `0678`, `0682`–`0685`, `0687`–`0690`, `0693`, `0695`–`0697`); **all applied** through `0697` (evening 2026-11-05). Non-HFC `0691`/`0692`/`0694` in folder. **Next free: `0698`**.
- SQL safety / engine test scripts: 8 (`supabase/tests/`, P11 adds `hfc_p11_role_grants_safety.test.sql`).
- web-admin HFC jest (2026-10-31 run): 29 suites / 237 tests pass.
- HQ jest (P2.2 + P7): platform-api 5 suites / 42 tests (P7) + tenant-create specs (P2.2); platform-web 2 suites / 7 tests.
- Mobile (P8): `mobile_core` 7 tests, customer app 2 widget tests.
