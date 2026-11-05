# HFC FINAL apply / deploy / QA runbook

**Date:** 2026-11-05 (Asia/Muscat). After FOLLOWUPS #2-#7, #11, #14 (runbook), #3, jest-axe.

## 1. Migrations — **APPLIED 2026-11-05** (local + remote)

User applied these in order to **both** databases. `0691`/`0692`/`0694` are non-HFC (already applied earlier with the folder).

| # | File | FOLLOWUPS | Status |
|---|---|---|---|
| 1 | `0693_retire_label_printing_feature_flag.sql` | #1 | **Applied** local + remote 2026-11-05 |
| 2 | `0695_retire_legacy_label_settings_rows.sql` | #2 | **Applied** local + remote 2026-11-05 |
| 3 | `0696_drop_org_orders_mst_label_image_cols.sql` | #5 | **Applied** local + remote 2026-11-05 |
| 4 | `0697_ntf_credit_note_issued_use_credit_note_no.sql` | #11 | **Applied** local + remote 2026-11-05 |

**Next free migration number (folder check):** `0698` (latest numbered file `0697_...`).

**Not shipped as SQL:** #14 suppliers wave (see `P10_BACKFILL_RUNBOOK.md` — needs live `supplier_code` samples first).

## 2. Safety tests — **verification pending** (not yet reported by user)

Re-run on local after apply (each file rolls back):

```text
supabase/tests/hfc_f1_retire_label_printing_safety.test.sql
supabase/tests/hfc_f2_retire_legacy_label_settings_safety.test.sql
supabase/tests/hfc_f5_drop_order_label_image_cols_safety.test.sql
supabase/tests/hfc_f11_credit_note_template_safety.test.sql
```

Scratch box previously PASS for #2 (`hfc_f2`) and #5 (`hfc_f5`). Confirm on your DB when convenient.

## 3. Types / Prisma — **DONE 2026-11-05** (by you)

User regenerated types for **both repos** and regenerated/pulled `prisma.schema`. Order `qr_code`/`barcode` should now be absent from generated types; piece/item/receipt barcode/qr columns remain.

## 4. Deploy — **PENDING** (not reported this turn)

Earlier 2026-11-05 deploy covered through `0690` / P11 morning cut. This evening code still needs a deploy before test-tenant smoke of LEGACY removal and `credit_note.issued`:

1. ~~Apply 0693 → 0695 → 0696 → 0697~~ **DONE**
2. ~~Regenerate types + Prisma~~ **DONE**
3. **Deploy web-admin** (LEGACY removal #6, barcode shim delete #7, `credit_note.issued` emit #11)
4. **Deploy HQ platform-web** (optional for a11y-only; no required runtime change)
5. `platform-api` — no HFC change in this batch
6. Mobile — next release still pending (P8 LTR + P11 booking `ltrCode`)

`web-admin/scripts/sync-platform-inventory.mjs` already ran (#3).

## 5. Test-tenant-only verification — **PENDING** (after deploy)

### Smoke (finance / SCN)
1. Issue one store credit note → number `SCN-YYYY-######`.
2. Confirm **no** new `CN-<tenant8>-` issues (LEGACY removed in code).
3. With `issuedBy` set, confirm notification hub logs `credit_note.issued` (or outbox row) on **test tenant only** (#11).
4. Template preview / rendered body shows `{{credit_note_no}}` (0697 applied).

### Labels / orders
5. Print order label + piece tags still work.
6. Piece external tags (`org_order_pieces_dtl.barcode`) still link/unlink.

### Flags / settings
7. HQ flag catalog has no exact `label_printing` (siblings remain).
8. Settings → Labels & Tags still loads.

### Do **not** on production first
- Credit-note WhatsApp/SMS until test-tenant copy looks right.
- Supplier code rewrite (#14) until `P10_BACKFILL_RUNBOOK.md` samples are reviewed.

## 6. QA S1–S20 — **PENDING** (FOLLOWUPS #12)

After deploy: `QA_TEST_GUIDE.md` + perf table in `testing_guide_and_scenarios.md`.

## 7. Closure checklist (remaining)

- [ ] Four safety tests reported PASS (local)
- [ ] Deploy web-admin (and optional platform-web)
- [ ] Test-tenant smoke (section 5), including #11 credit_note.issued
- [ ] QA S1–S20 + perf (#12)
- [ ] Next customer mobile release
- [ ] Supplier `supplier_code` samples → P10 format decision (`P10_BACKFILL_RUNBOOK.md`)