# Current Status — Human-Friendly Codes

**Last update:** 2026-11-01 (Asia/Muscat). **Overall:** CLOSED — `0666`–`0689` applied; P11 follow-ups code done, `0690` not applied yet; waiting for user apply, deploy and QA.

| Item | State |
|---|---|
| Applied migrations | `0666`–`0672`, `0674`, `0677`, `0678`, `0682`, `0683`, `0684`, `0685`, `0687`, `0688`, `0689` (applied by the user, local + remote; `0687`–`0689` on 2026-11-01) |
| Not applied yet | `0690_hq_doc_seq_role_grants.sql` (P11, A-71) — then run `supabase/tests/hfc_p11_role_grants_safety.test.sql` on local (DEV_GUIDE §22 step 6a) |
| Post-apply checks | Local safety tests `hfc_p5_scn_safety.test.sql` + `hfc_p6_safety.test.sql` (DEV_GUIDE §22 step 3) — not reported yet; types / Prisma regeneration optional (step 4) |
| Next free migration number | `0691` (latest file `0690`; `0686` is not an HFC file) |
| Deploy pending | web-admin (P3b, P4 screens, P5 code (`0687` applied), P8 notification fix, P11 code: `label_printing` removal, `credit_note_no` variables); HQ `platform-api` (P2.2, P7) then `platform-web` (P7) (`0688` applied); next customer mobile release (P8, P11 booking `ltrCode`) |
| QA on deployed envs (T9.1) | Pending — user-run, scenarios S1–S20 in `QA_TEST_GUIDE.md` |
| Performance on deployed envs (T9.2) | Pending — user-run, targets in `testing_guide_and_scenarios.md` §3 |
| Automated tests (2026-10-31) | web-admin HFC jest 29 suites / 237 tests pass; box Postgres chain `0666`→`0689` with P5 + P6 safety tests PASS |
| Automated tests (P11, 2026-11-01) | box Postgres `0687`→`0690` + rerun + `hfc_p11_role_grants_safety` PASS; web-admin jest 46 suites / 407 tests + new `credit-note-variables` (4) and `whatsapp-content-variables` (5) pass; Windows web-admin `tsc --noEmit` 0 errors; `flutter analyze` clean; customer-app booking test "step two" fails (not caused by P11) |
| Decisions to review | Every "DECIDED BY ASSISTANT WHILE USER AWAY, PLEASE REVIEW" row (A-50..A-74) in plan §20 |

## Blockers
None in code. The remaining steps need the user: apply `0690` (role grants, A-71), deploy, mobile release, smoke test, QA, approve follow-ups (DEV_GUIDE §25.1).

## Next action (user)
Follow [`deploy_guide.md`](./deploy_guide.md) → `DEV_GUIDE_DOC_SEQ_ENGINE.md` §22.
