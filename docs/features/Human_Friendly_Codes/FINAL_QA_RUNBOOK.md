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

### A-75 nav smoke (after platform-web deploy)

- [ ] Sidebar **SaaS Backoffice Admin- HQ** shows General Config + Doc Seq Config / Code Types / Code Consistency
- [ ] `/doc-seq-config`, `/doc-seq-config/types`, `/doc-seq-config/consistency` load
- [ ] Legacy `/system-codes/doc-seq-types` and `.../consistency` redirect
- [ ] **System Catalogs Codes** opens `/system-codes`; Settlement + BVM + Payment Setup + Cash & POS are direct sidebar links
- [ ] Deploy HQ `platform-api` + `platform-web` (A-76..A-83) and run §8

## 8. HQ doc-seq console smoke (A-76..A-83, 2026-11-06) — **PENDING** (after deploying `platform-api` + `platform-web` together)

Run as SUPER_ADMIN, then once as a user with only `hq_doc_seq:read` and once with `hq_general_config:read` only. Repeat a few steps in Arabic (RTL).

**Hub `/doc-seq-config`**
1. Sidebar + top bar are visible (A-76 fix). Breadcrumb: Backoffice › Doc Seq Config.
2. Health banner shows errors/warnings (or "All code types are consistent") and links to Consistency.
3. KPI cards show numbers; click a "By generator / scope / restart" item → Types opens already filtered.
4. Without `hq_general_config:read` the General Config card is disabled and says which permission is needed.

**Code Types `/doc-seq-config/types`**
5. Type `inv.no/` in search → list still loads (no error). Filters + sort change the URL; reload / Back keeps them.
6. Page size options include 20; change page; Export CSV opens in Excel with Arabic names readable.
7. Sort a column with the keyboard (Tab to header, Enter).
8. Click a row → detail page.

**Type detail `/doc-seq-config/types/<CODE>`**
9. Overview shows format parts legend; Preview: enter `Mars/Base` → inline error, no request; valid zone/date → sample code + period line.
10. Counters tab: tenants using the type + latest counters; "Open all counters" lands on Counters filtered by the type.
11. Checks tab: for a type in a `PREFIX_SHARED` row, that row is listed. `/doc-seq-config/types/NOPE` → "Code type not found".

**Code Counters `/doc-seq-config/counters`**
12. Switch scope Tenant / HQ / System; pick a tenant (search box); type `2026/11` in Period → inline hint, list not broken.
13. Current-period rows show Next number + Next code; closed periods show "Closed". No edit/reset buttons anywhere.
14. Export CSV.

**Code Consistency `/doc-seq-config/consistency`**
15. Issue list shows severity, meaning and fix; click an Errors KPI → list filters; filters survive reload.
16. Run again → second click within 10 s shows countdown / friendly warning (no red error). CSV + Copy JSON work.

**General Config `/settings/general-config`**
17. "Last updated … by <name>" shows a name, not an id. History panel lists recent saves (old → new).
18. Edit → change Support email to `bad` → inline error, cannot review. Fix it → Review changes shows old → new → Save → success toast; history updates.
19. Change time zone → review shows the period warning. Close the form with unsaved edits → "Discard your changes?" confirm.
20. As a user without `hq_general_config:manage`: Edit is visible but disabled with the reason.
