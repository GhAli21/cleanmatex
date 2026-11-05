# HFC open follow-ups — approval sheet

**Date:** 2026-11-05 (Asia/Muscat). **Done so far:** User applied `0693`/`0695`/`0696`/`0697` local+remote and regenerated types + Prisma (both repos) 2026-11-05. Code/docs for #1-#15 except open closure items. **Still open:** deploy (latest web-admin), safety-test report, test-tenant smoke (#11), QA #12, mobile release, P10 samples. See `FINAL_QA_RUNBOOK.md`.

**How to use:** reply with the numbers you approve (example: `approve 4, 9, 12, 13, 15`). The assistant does **one approved item at a time**, then ticks it here and updates this sheet + the plan / DEV_GUIDE §25.1.

Already DONE (not listed): **#8** `0690` role grants, **#10** booking `ltrCode`, and the **code** parts of **#1** / **#11**.

**Suggested first batch:** `4, 9, 12, 13, 15` (+ `#1` if you want the DB flag gone). Hold `5, 6, 7, 11, 14`. Do `#2` only if the `0685` NOTICE listed rows. Do `#3` after `#1`.

**Risk key:** low = safe / reversible; medium = code behaviour change; high-destructive = data or schema loss.

---


- [x] **#1 Retire `label_printing` in DB** — **APPLIED 2026-11-05** (Jehad Ali). `0693` applied local + remote; types + Prisma regenerated both repos. Safety test `hfc_f1_...` still useful to re-run locally (not yet reported). Inventory rebuild earlier; exact `label_printing` gone from catalog extract.


- [x] **#2 Old `LABEL_*` / `RECEIPT_ORDER_CODE128` settings** — **APPLIED 2026-11-05**. `0695` applied local + remote (idempotent; may have been no-op). Safety `hfc_f2_...` verification pending report.


- [x] **#3 Sync platform inventory** — **DONE 2026-11-05**. `web-admin/scripts/sync-platform-inventory.mjs` is local file copy only; ran successfully (docs inventory → `web-admin/data/platform/`).


- [x] **#4 Delete stray zip** — **DONE 2026-11-05** (Jehad Ali approved OK Now). Deleted `C:\Users\JHNLP\p4v2code.zip` (87,089 bytes / 0.08 MB, LastWrite 2026-10-31 08:51). Verified gone. Risk was low.


- [x] **#5 Drop `org_orders_mst.qr_code` / `barcode`** — **APPLIED 2026-11-05**. `0696` applied local + remote; types + Prisma regenerated (order image cols gone from schema). Safety `hfc_f5_...` verification pending report.


- [x] **#6 Remove LEGACY credit-note fallback** — **DONE 2026-11-05**. Removed ENGINE/LEGACY switch; always insert `''`. Tests 25/25 (`stored-value.service.test.ts`).


- [x] **#7 Retire barcode/order-number shims** — **PARTIAL 2026-11-05**. Deleted `barcode-generator.ts` + test (no live imports). **Kept** `order-number-generator.ts` — still imported/called by `order-service.ts:688` (`generateOrderNumberWithTx`). Related jest 21/21.


- [x] **#9 Install `jest-axe` in platform-web** — **DONE 2026-11-05** (Jehad Ali ok Now). `npm i -D jest-axe@^10.0.0 @types/jest-axe@^3.5.9` in `platform-web` (matches web-admin). Installed `jest-axe@10.0.0`. No platform-web tests import `jest-axe` yet (A-63 said add after install); `__tests__/ui/cmx-confirm-dialog.test.tsx` accessibility suite (non-axe) 4/4 passed.


- [x] **#11 Emit `credit_note.issued` + update `0382` text** — **MIG APPLIED 2026-11-05** (`0697` local + remote). Code emit wired earlier (needs `issuedBy`; fire-and-forget). **Still open:** deploy web-admin with emit code, then **test-tenant** verification (no prod WhatsApp/SMS until copy OK). Mocked unit test already PASS.


- [ I will do ] **#12 QA S1–S20 + perf** — You run `QA_TEST_GUIDE.md` and the perf table in `testing_guide_and_scenarios.md` on deployed envs. Risk: **low**. No deletes; no production messages if you stay on test tenants. Order: **first** product check. **Recommend: approve now**.


- [x] **#13a ADR-004 Accepted** — **DONE 2026-11-05** by Jehad Ali (engine in tenant DB; HQ only via `platform-api`). Was Proposed (A-69). Docs: HQ ADR-004 Status → Accepted.

- [x] **#13 Review decisions A-50..A-74** — **DONE 2026-11-05** (Jehad Ali: "yes you decide as expert"). A-50..A-74 **reviewed + accepted** on assistant expert recommendation; A-50 LEGACY status wording corrected (kept until FOLLOWUPS #6 later). Compact assessment appendix kept as the record. #13a ADR-004 already Accepted.


- [x] **#14 P10 backfill waves** — **RUNBOOK ONLY 2026-11-05**. Suppliers already have NOT NULL `supplier_code` + unique + DOMAIN `ERP_SUPPLIER`. Destructive rewrite **stopped** pending live samples — see `P10_BACKFILL_RUNBOOK.md`.


- [x] **#15 Fix booking widget test** — **DONE 2026-11-05** (Jehad Ali ok now). Stale test: UI shows l10n `booking.step2.packingSection` = **Packing** (since e8201264), not mock kind.name `Packing preferences`. Also updated obsolete `Selected preferences` / `1 selected` asserts to `FilterChip.selected` (per-piece rewrite). `flutter test test/booking/customer_order_booking_screen_test.dart` → 2/2 pass.

---

**Tick log** (assistant fills after each done item):
- 2026-11-05 — **#13a** ADR-004 Accepted (Jehad Ali).
- 2026-11-05 — **#1** Wrote `0693` + safety test; scratch PASS; inventory rebuild. **Applied by user 2026-11-05** local+remote.
- 2026-11-05 — **#9** Installed jest-axe@^10 + @types/jest-axe in platform-web (A-63).
- 2026-11-05 — **#4** Deleted `C:\Users\JHNLP\p4v2code.zip` (87,089 bytes). Approved OK Now.
- 2026-11-05 — **#15** Fixed stale booking step-two test (Packing + FilterChip.selected). 2/2 pass.
- 2026-11-05 — **#13** A-50..A-74 reviewed + accepted by Jehad Ali (expert recommendation). Review appendix kept as record. A-50 LEGACY wording fixed.
- 2026-11-05 — User applied **0693, 0695, 0696, 0697** local + remote; regenerated types (both repos) + Prisma pull/generate. Deploy / safety-test report / test-tenant smoke still open (`FINAL_QA_RUNBOOK.md`).

---

## A-50..A-74 compact review (record) — **ACCEPTED 2026-11-05** by Jehad Ali (expert recommendation)

Record of the assistant assessment presented before acceptance. **Status: reviewed + accepted by Jehad Ali 2026-11-05.** A-50 status wording was corrected as part of acceptance (LEGACY kept; removal = #6 later).

| Id | Decision (short) | Assessment |
|---|---|---|
| A-50 | P5 fallback = deploy-time `STORE_CREDIT_NOTE_NUMBERING` ENGINE/LEGACY constant (not env/flag) | **sound**; LEGACY **removed in code** (#6, 2026-11-05). Deploy of that build still pending. |
| A-51 | ENGINE inserts `''`, asserts number assigned or rolls back money tx | **sound** — matches no-silent-money-mutation. |
| A-52 | Keep old `CN-…`; SCN counter from 1 / existing SCN rows only | **sound** — reversible, no clash. |
| A-53 | Generic `fn_doc_seq_assign_code`; apply `0687` before P5 app deploy | **sound** — each step alone safe. |
| A-54 | `0688` adds permission codes only; no role grants in that mig | **sound** then amended by A-71/`0690` (applied) — chain coherent. |
| A-55 | No new tenant perms; scan/labels reuse `orders:read`; skip tenant nav | **sound**. |
| A-56 | `0689` COMMENT-only deprecate `qr_code`/`barcode`; drop separate | **sound**; drop **`0696` applied 2026-11-05** (#5). |
| A-57 | HQ routes `/api/hq/v1/doc-seq|general-config` + standard guards/perms | **sound**. |
| A-58 | Optimistic concurrency via body `version`; audit only changed fields | **sound**. |
| A-59 | Consistency severity derived; 60s cache; refresh ≤1/10s; preview GENERAL only | **sound**. |
| A-60 | HQ pages under system-codes + settings; HQ CmxCodeChip copy of tenant | **sound**. |
| A-61 | Confirm before period-field edits; on 409 reload (no silent merge) | **sound**. |
| A-62 | Wizard prefill only while field still at built-in default | **sound**. |
| A-63 | Add `jest-axe` to platform-web like web-admin | **sound**; **INSTALL DONE** (#9). a11y tests still to add (non-blocking). |
| A-64 | Dart `human_codes.dart` 1:1 with web helpers; `ltrCode` display-only | **sound**. Booking LTR follow-up done in A-73. |
| A-65 | cmx-api N/A until orders/scan module exists | **sound**. |
| A-66 | Transition notifications send `order_no` not UUID | **sound**. Status text slightly stale vs A-74 (vars added later without emit). |
| A-67 | Refresh HFC-RULE blocks both repos (helpers, LTR, no UUID in messages) | **sound**. |
| A-68 | Keep order-number / barcode shims + LEGACY until dated follow-ups | **sound** — matches #6/#7 later. |
| A-69 | ADR-004 Accepted (engine in tenant DB; HQ via platform-api) | **sound** — already **Accepted** (#13a). |
| A-70 | Full docs pack + QA guide + report beside existing docs | **sound**. |
| A-71 | `0690` role grants for TECH_ADMIN/SUPPORT as migration | **sound**; **applied** 2026-11-05. |
| A-72 | Remove `label_printing` from web-admin code; DB row later | **sound**; code done; **`0693` applied 2026-11-05** local+remote. |
| A-73 | Booking success uses `ltrCode(submittedOrderNumber)` | **sound**. Stale step-two test noted there is **fixed** (#15). |
| A-74 | Add `credit_note_no` notification variables; do not emit / change `0382` yet | **sound**; emit + `0697` done (#11). Test-tenant verify still open. |

**Summary (at delivery):** choices sound; A-69 already accepted. **On acceptance 2026-11-05:** A-50/A-66/A-72 status wording fixed in the plan; all A-50..A-74 marked reviewed + accepted. No product-behaviour change from this review alone.
