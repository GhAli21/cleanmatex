# Current Status — Human-Friendly Codes

**Last update:** 2026-11-07 (Asia/Muscat). **Overall:** **REOPENED for P12 release-proof remediation.** The user applied `0703_stock_transaction_hfc.sql` and `0705_doc_seq_type_implement_desc_ar.sql` locally and remotely, regenerated database types in both repos, and pulled Prisma. Local read-only verification confirms the stock-code schema/data invariants; application fixes now await deployment and deployed-environment QA.

| Item | State |
|---|---|
| Applied migrations | `0666`–`0672`, `0674`, `0677`, `0678`, `0682`–`0685`, `0687`–`0690`, `0693`, `0695`–`0697`, **`0703`, `0705`** (user, local + remote) |
| Non-HFC in folder | `0691_speed_pricing_nav_audit.sql`, `0692_oc_edit_piece_speed_discount.sql`, `0694_retire_zero_speed_rules.sql` (not HFC; already applied with folder) |
| Not applied yet | None (HFC). |
| Post-apply checks | Types + `prisma.schema` regenerated both repos **2026-11-05** (after 0697). Four HFC safety tests (`hfc_f1`/`f2`/`f5`/`f11`) — **verification pending report**. |
| Next free migration number | **`0698`** (folder check: latest numbered `0697_ntf_credit_note_issued_use_credit_note_no.sql`) |
| P12 stock migration | **Applied by user locally + remotely:** `0703_stock_transaction_hfc.sql`. Local read-only evidence: zero missing codes; zero duplicate tenant/code groups; `transaction_no` is NOT NULL; unique constraint and both triggers exist; registry level is GENERAL. Post-apply behavior/concurrency safety test remains required. |
| P12 application repairs | **Implemented; deployment/runtime proof pending:** Pay Later/Pay on Collection, piece-tracked splitting, receipt order number, public tracking QR, and authenticated settings proxies/legacy messaging redirect. Focused unit tests pass. |
| P12 HQ Code Types | **Implemented; deployment/runtime proof pending:** printed-prefix correction and DB-backed Arabic implementation descriptions (`0705`) flow through the HQ API and console. HQ API and console regression/a11y tests pass. |
| Deploy | Morning 2026-11-05: web-admin / platform-api / platform-web deployed (through `0690`). **Pending:** redeploy web-admin P12 fixes and deploy platform-api + platform-web together for Code Types localization. Mobile release still pending. |
| QA on deployed envs (T9.1) | Pending — user-run S1–S20 (`QA_TEST_GUIDE.md`) after evening deploy |
| Performance (T9.2) | Pending — `testing_guide_and_scenarios.md` §3 |
| Decisions | A-50..A-74 accepted. Closure: `FINAL_QA_RUNBOOK.md`. #12 QA user. #14 P10 blocked on live samples (`P10_BACKFILL_RUNBOOK.md`). #11 needs test-tenant verify after deploy. |

## Blockers
P12 must be deployed and proven before closure. Remaining: web-admin and HQ deployment, the stock-engine safety-test report, targeted QA S1/S4/S13/S14/S15/S16/S17, hardware QA S7/S8, flag-off QA S19, staging/performance QA S20, mobile release, and P10 supplier samples. The local web-admin production build is not yet evidenced: its Next compiler hung after compilation started without diagnostics; focused tests, typecheck, and lint passed.

## Next action (user)
1. Run `supabase/tests/hfc_stock_transaction_engine_safety.test.sql` against the approved local database; it rolls back its fixture writes.
2. Deploy the web-admin P12 repair and deploy platform-api + platform-web together.
3. Run targeted deployed QA S1, S4, S13, S14, S15, S16 and S17, then complete S7/S8/S19/S20 under their documented hardware/staging controls.
4. Continue the existing mobile-release and P10 work only after the release blockers are resolved.

## A-75 HQ nav (2026-11-06 Asia/Muscat)

Approved: Doc Seq Config at `/doc-seq-config` (types + consistency); legacy `/system-codes/doc-seq-*` redirect. Sidebar section **SaaS Backoffice Admin- HQ** (General Config + Doc Seq). **System Catalogs Codes** → `/system-codes`; Settlement + BVM direct links. Deploy platform-web to pick up.

## A-76..A-83 HQ doc-seq console redesign (2026-11-06 Asia/Muscat)

Code done and tested. New read-only API routes (`doc-seq/stats`, `doc-seq/counters`, `doc-seq/counters/tenants`, `general-config/history`) and redesigned hub, types (+ detail page), counters, consistency and General Config screens. The Code Types fix now displays `prefix` only and uses the required Arabic implementation description from `0705`; focused API and console/a11y tests pass. **User next:** deploy `platform-api` **and** `platform-web` together (the new screens call the new routes), then run `FINAL_QA_RUNBOOK.md` §8. Proposals P-1 (counter correction) and P-2 (delete old dialog) wait for approval.
