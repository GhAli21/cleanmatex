# Current Status — Human-Friendly Codes

**Last update:** 2026-11-05 (Asia/Muscat). **Overall:** HFC migrations applied through `0697` (local + remote); types + `prisma.schema` regenerated both repos 2026-11-05. Morning deploy covered through `0690`/P11; **evening web-admin deploy (LEGACY/#7/#11) still pending**. Waiting for safety-test report, test-tenant smoke, QA, mobile release, P10 samples.

| Item | State |
|---|---|
| Applied migrations | `0666`–`0672`, `0674`, `0677`, `0678`, `0682`–`0685`, `0687`–`0690`, **`0693`, `0695`, `0696`, `0697`** (user, local + remote; `0693`/`0695`/`0696`/`0697` on 2026-11-05 evening) |
| Non-HFC in folder | `0691_speed_pricing_nav_audit.sql`, `0692_oc_edit_piece_speed_discount.sql`, `0694_retire_zero_speed_rules.sql` (not HFC; already applied with folder) |
| Not applied yet | None (HFC). |
| Post-apply checks | Types + `prisma.schema` regenerated both repos **2026-11-05** (after 0697). Four HFC safety tests (`hfc_f1`/`f2`/`f5`/`f11`) — **verification pending report**. |
| Next free migration number | **`0698`** (folder check: latest numbered `0697_ntf_credit_note_issued_use_credit_note_no.sql`) |
| Deploy | Morning 2026-11-05: web-admin / platform-api / platform-web deployed (through `0690`). **Pending:** redeploy web-admin with LEGACY removal, barcode shim delete, `credit_note.issued` emit. Optional platform-web. Mobile release still pending. |
| QA on deployed envs (T9.1) | Pending — user-run S1–S20 (`QA_TEST_GUIDE.md`) after evening deploy |
| Performance (T9.2) | Pending — `testing_guide_and_scenarios.md` §3 |
| Decisions | A-50..A-74 accepted. Closure: `FINAL_QA_RUNBOOK.md`. #12 QA user. #14 P10 blocked on live samples (`P10_BACKFILL_RUNBOOK.md`). #11 needs test-tenant verify after deploy. |

## Blockers
None in schema/types. Remaining: evening **deploy**, safety-test report, test-tenant smoke (incl. #11), QA S1–S20, mobile release, P10 supplier samples.

## Next action (user)
1. Deploy latest web-admin (and optional platform-web).
2. Test-tenant smoke per `FINAL_QA_RUNBOOK.md` §5.
3. Report four safety tests if not already run.
4. QA S1–S20 (#12).
5. Paste supplier_code samples when ready for P10.