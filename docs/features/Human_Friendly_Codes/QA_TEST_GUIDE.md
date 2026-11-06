# QA Test Guide — Human-Friendly Codes

Manual scenarios S1–S20 from plan §14.4 (T9.1). Run them on the **deployed** environments (local, then staging/remote) after DEV_GUIDE §22 is done. Each scenario has a Result line to fill in. Automated tests and performance checks: [`testing_guide_and_scenarios.md`](./testing_guide_and_scenarios.md).

**Status (2026-10-31):** all scenarios Pending (user-run on deployed env). Run each in English and Arabic (RTL; codes must read left-to-right).

Prerequisites: `0687`–`0689` applied; web-admin, HQ `platform-api` and `platform-web` deployed; for S7/S8/S9 a USB scanner and printed labels; for the scan dialog (S7, S9, S10) and the receipt barcode (S13) the tenant flag `human_codes_scan_labels` on (off for S19); for S20 a staging DB only.

## S1 — New order gets a day-based number in the organization's timezone
1. Set the organization timezone to Asia/Muscat. At 00:30 Muscat time, create an order.
**Expected:** Order number is ORD-<today in Muscat>-0001 (or next), shown in the order header, list and receipt.

**Result:** PARTIAL — Env: Preview (cmx.cleanmatex.com), Demo Laundry LLC. Date: 2026-11-05 ~22:09-22:16 Asia/Muscat. Tester: Financial_Expert_Tester. Cash / pay-in-advance creation WORKS and yields correct day-based numbers in the org timezone (ORD-20261105-0002 at 22:11:29, -0003 at 22:13:58, -0004 at 22:15:56; ORD-20261105-0001 already present at 22:07:36). Pay Later / Pay on Collection FAILS: at 22:09:37 POST /api/v1/orders/submit-order returned HTTP 422 with raw toast 'SETTLEMENT_LEGS_REQUIRE_RECEIPT_VOUCHER [SETTLEMENT_LEGS_REQUIRE_RECEIPT_VOUCHER]'. Root cause: order-submit-orchestrator.service.ts:445 builds settlementLegs from all paymentLegs and :1032-1034 throws when settlementLegs exist but plan.shouldCreateReceiptVoucher is false (set only for real/credit legs at order-settlement-planner.service.ts:212). See FET-HFC-S1 (P1).

## S2 — Two staff create orders at the same moment
1. Two users in the same organization click "Create order" at the same time (10 times each).
**Expected:** 20 different numbers, none skipped except for any cancelled create; no error.

**Result:** PASS (rapid-sequential approximation of concurrency) — Env: Preview. Date: 2026-11-05 ~22:39-22:41 Asia/Muscat. Three orders created back-to-back in the New Order POS, cash / pay-in-advance, customer Jh Test dev21: ORD-20261105-00006 (created 22:39:51), -00007 (22:40:44), -00008 (22:41:13), each 0.856 OMR / 1 piece. Sequence continuous (00006->00007->00008), no duplicate or skipped numbers. DB: org_doc_seq_mst ORDER period 20261105 last_value=8, and 0 duplicate order_no across all 8 orders today. Evidence: s02-rapid-creates.png. LIMIT: this is rapid sequential single-session creation, not true two-staff concurrent submits; genuine parallel contention on the counter needs the staging parallel-create script (see S20 / hot-tenant perf row), which stays BLOCKED here. Number allocation itself is atomic (DB sequence/identity), so the approximation shows no gaps or duplicates under fast successive submits.

## S3 — Order number cannot be changed
1. Try to edit the order number via any screen or API.
**Expected:** Not editable; API returns an error; number unchanged.

**Result:** PASS — Env: Preview. Date: 2026-11-05 ~22:24 Asia/Muscat. Edit Order screen shows #ORD-20261105-0002 as a read-only heading; editable fields are items/preferences/dates/customer only, no order-number field (s03-edit-no-order-no-field.png). Order Master Data shows Order No as a plain read-only value (s03-order-master-data-readonly.png). DB enforced independently: trigger trg_ord_no_guard BEFORE UPDATE OF order_no calls fn_doc_seq_guard_immutable('order_no') and raises DOC_SEQ_CODE_IMMUTABLE on any change (catalog-verified; no UPDATE attempted).

## S4 — Split order
1. Split two items off ORD-…-0007.
**Expected:** New order ORD-…-0007-S1 appears, linked to the parent; splitting again gives -S2.
2. (P2.1) Split -S1 again.
**Expected:** ORD-…-0007-S3 (numbered under the root); the parent's totals and payments do not change; the sub-order lines show 0 price.

**Result:** FAIL — Env: Preview. Date: 2026-11-05 ~22:27 Asia/Muscat. Split action reachable (Processing list -> row ORD-20261105-0004 -> Simple processing -> Split checkbox -> Split Order (1) -> Confirm Split Order with required reason). Every Confirm Split fails with toast 'Invalid piece id: <uuid>' (e.g. 044e9abd-82e3-43bf-9017-3aae59f82562, 785f24c0-fa02-4c16-8048-807ebec9050c). No sub-order created, so no ORD-...-S1 / split-of-split. Root cause: processing-modal.tsx:104 sets piece id to the bare DB UUID for piece-tracked orders, but order-split.service.ts:116-118 requires '{itemId}-piece-{n}' and throws ORD_SPLIT_BAD_PIECE_ID. See FET-HFC-S4 (P1). Parent unchanged (5 pieces, 4.708 OMR paid). Screenshots: s04-split-modal.png, s04-split-confirm-dialog-error.png.

## S5 — Piece codes
1. Create an order with 2 items (3 and 2 pieces).
**Expected:** Pieces show ORD-…-1-1, -1-2, -1-3, -2-1, -2-2 in full (no shortened UUID).

**Result:** PASS — Env: Preview. Date: 2026-11-05 ~22:17 Asia/Muscat. On ORD-20261105-0004 item codes are ORD-20261105-0004-1 and -2; all five piece codes render in full with no shortened UUID: -1-1, -1-2, -1-3, -2-1, -2-2 (s05-pieces-shirt-1.png, s05-pieces-1-and-2.png). Reconfirmed on the full order details page.

## S6 — Print order label
1. Open an order and click "Print label".
**Expected:** Label prints with a QR and a barcode; the barcode text equals the order number; works in Arabic UI with the code shown left-to-right.

**Result:** PASS — Env: Preview. Date: 2026-11-05 ~22:23-22:25 Asia/Muscat. EN Print Label on ORD-20261105-0002 shows Main Branch 2 / Order / large ORD-20261105-0002 above a linear barcode, a QR code, Ready by 06 Nov 17:00, Items 1, Pieces 1, Customer Jh d. (s06-print-label-en.webp). AR label is RTL with Arabic text (الفرع الثاني 2 / الطلب) while the code stays LTR, Items 2 / Pieces 5 correct (s06-ar-label-preview.webp, s06-ar-order-detail.png). Nothing printed/saved.

## S7 — Scan order label with a USB scanner (Arabic keyboard layout)
1. Switch the computer keyboard to Arabic. Open the Scan dialog. Scan the order label.
**Expected:** The order opens. No Arabic letters appear in the field.

**Result:** BLOCKED — No physical USB scanner available in this environment; cannot scan a printed label on an Arabic keyboard layout. Scan dialog itself verified via typed input (S10/S11).

## S8 — Scan a piece tag on the assembly screen
**Expected:** The piece is marked as scanned; the result is announced; field stays focused for the next scan.

**Result:** BLOCKED — Requires a physical scanner and the assembly screen hardware flow; not available here.

## S9 — Link a pre-printed tag
1. On a piece, choose "Link tag" and scan a tag already linked to another piece.
**Expected:** Message says the tag is in use by piece <code>, with a link to it; nothing changes.

**Result:** PASS — Env: Preview. Date: 2026-11-05 ~22:37 Asia/Muscat. Via the top-bar Scan dialog: linked external tag TAGQA0001 to piece ORD-20261105-0004-1-1 (toast 'Tag TAGQA0001 linked to ORD-20261105-0004-1-1'); the scan result then showed Tag: TAGQA0001 for that piece. Re-attempting the SAME tag on piece ORD-20261105-0004-1-2 produced the validation status 'Tag "TAGQA0001" is already on piece ORD-20261105-0004-1-1. Remove it there first or use a different tag.' — it names the holding piece code and nothing changed (piece 1-2 still shows Tag: No tag). Screenshot: s09-link-tag-inuse.png.

## S10 — Code from another organization
1. Scan a label printed by a different organization.
**Expected:** "Code not found". No details from the other organization.

**Result:** PASS — Env: Preview. Date: 2026-11-05 ~22:24 Asia/Muscat. Scan dialog (top-bar Scan) accepted a typed order number belonging to a different org and answered 'Nothing matches this code.' with no cross-tenant detail (s10-scan-other-org.png). Wording differs slightly from the guide's 'Code not found' but behaviour is correct; scan-resolve.service.ts enforces tenant scoping with the same SCAN_NOT_FOUND for foreign and missing codes (no enumeration).

## S11 — Search by order number
1. Type the full order number in the orders search box and press Enter.
**Expected:** The order opens directly.

**Result:** PASS — Env: Preview. Date: 2026-11-05 22:18:00 Asia/Muscat. Typing ORD-20261105-0002 in the orders-list search + Enter navigated directly to /dashboard/orders/6c5ec787-665e-4b5c-a37c-7f14b6f8d097 (s11-search-navigating.png, s11-search-opened-0002.png).

## S12 — Store credit note
1. Issue a store credit note.
**Expected:** Number SCN-<year>-000001 (or next); old credit notes keep their old numbers.

**Result:** PASS — Env: Preview. Date: 2026-11-05 ~22:28 Asia/Muscat. Issued from customer Jh Test dev21 -> Stored Value -> Credit Notes -> Issue Credit Note (0.100 OMR, reason 'QA S12 store credit note'). New note code SCN-2026-000001 (0.100 original/remaining, Active, No Expiry) — correct SCN-YYYY-NNNNNN engine format; sequence starts at 000001 because the legacy CN-11111111-0000x notes used a different scheme. Legacy notes unchanged (CN-11111111-00003 still 5.000 Active). Toast 'Credit note issued successfully'. Screenshot: s12-credit-note.png.

## S13 — Receipt
**Expected:** Receipt still shows the tracking QR that opens the customer tracking page.

**Result:** FAIL — Env: Preview. Date: 2026-11-05 ~22:23-22:32 Asia/Muscat. (a) /dashboard/receipts/<id> shows 'Order: 6c5ec787-665e-4b5c-a37c-7f14b6f8d097' (raw UUID) instead of ORD-20261105-0002; page.tsx:54 prints the route UUID and fetches only customer_type, not order_no. (b) The receipt page is only a Send Receipt form (Receipt Type / Delivery Channels / Language) with no tracking QR rendered. (c) The thermal/A4 receipt template order-receipt-print.tsx renders the order CODE128 barcode of order.orderNo (correct) but has NO tracking-QR component at all. The QR appears only on the label. See FET-HFC-S13 (P1) and FET-HFC-S13b (P2). Screenshots: s13-receipt-en.png, s13-receipt-qr.png.

## S14 — Customer app with a sub-order
**Expected:** Customer can open ORD-…-S1 in the app/tracking page.

**Result:** BLOCKED — Blocked by S4: no sub-order exists because split fails, so there is no ORD-...-S1 to open in the customer app/tracking page.

## S15 — Notifications
**Expected:** SMS/WhatsApp show the order number (including -S1 for sub-orders); never a long technical ID.

**Result:** PARTIAL — Env: Preview. Date: 2026-11-05 ~22:29 Asia/Muscat. No notification body preview captured. /dashboard/settings/allsettings shows 'Error Loading Settings / Failed to fetch effective settings'; /dashboard/settings/messaging returns 404. Order page and processing dialog display the human code (#ORD-20261105-0004), not the UUID, but that is UI not an SMS/WhatsApp body. Did NOT send any real SMS/WhatsApp. See FET-HFC-S15 (P2).

## S16 — HQ Code Types (EN + AR)
**Expected:** List shows ORDER (ORD, GENERAL) and the domain rows with examples; each row's drawer shows its "How it works" text; preview shows a sample for a chosen date/timezone; Arabic layout is right-to-left with codes left-to-right.

**Result:** PASS — Env: HQ (hqsaas.cleanmatex.com/en/system-codes/doc-seq-types). Date: 2026-11-05 ~22:0x Asia/Muscat. 51 code types paginated 20/page; ORDER drawer shows format/reset/storage/uniqueness/generator functions and 'How it works'; Asia/Muscat preview produced exactly ORD-20261105-0001 without consuming a number; Arabic list+drawer are RTL with codes LTR. Minor: drawer shows 'ORD-ORD' as Prefix (doc-seq-type-dialog.tsx:130 joins type.prefix + type.typePrefix; suppress duplication when equal) — FET-HFC-S16 (P3). Screenshots begin s16-.

## S17 — HQ Code Consistency
**Expected:** 0 errors on a healthy environment; "Run again" refreshes the time.

**Result:** FAIL — Env: HQ Code Consistency. Date: 2026-11-05 ~22:02 Asia/Muscat. Report: Errors 1, Warnings 21, Info 38, Types checked 52, Schema checks 58. Single error: STOCK_TRANSACTION (org_inv_stock_tr.transaction_no), 13 rows, 8 duplicates. DB confirms STK-20260218-0001 occurs 8x in one tenant (7 with identical created_at -> concurrency race) and STK-20260218-0002 2x; NO unique index on (tenant_org_id, transaction_no). Cause: inventory-service.ts:563-587 read-latest-then-increment (UTC) + a second writer deduct_retail_stock_for_order; 0667_doc_seq_type_config.sql:583-585 already flags this as deferred. 'Run again' refreshed the timestamp (AR 2026/11/05 10:02:04 PM). See FET-HFC-S17 (P1). Screenshots begin s17-.

## S18 — HQ General Config
**Expected:** Shows currency, timezone, language, country, fiscal start, VAT, support contacts, trial days.

**Result:** PASS — Env: HQ General Config (EN+AR). Date: 2026-11-05 ~22:0x Asia/Muscat. Shows OMR, Oman, English, en-OM, Asia/Muscat; FY2026 starting January; week starts Saturday; DD/MM/YYYY, 24-hour; VAT 5%; trial 30 days. Support email and phone are EMPTY — recommend filling for a production-like env (FET-HFC-S18, P3). No config changed. Screenshots begin s18-.

## S19 — Feature flag off
**Expected:** Scan dialog (top-bar button and Ctrl+Shift+F) and the receipt order barcode are hidden; label printing stays available (A-47: no `label_printing` flag); existing screens still work; numbers still generated.

**Result:** PARTIAL — Env: Preview + code review. Date: 2026-11-05. human_codes_scan_labels is plan-bound (catalog default false, all five plans map true, NO tenant override rows). Flag-off behaviour is enforced fail-closed in code: global-scan-trigger.tsx returns null unless the flag is true (top-bar Scan button and Ctrl+Shift+F inert), and the receipt order barcode is capped by the flag (order-receipt-print.tsx showOrderBarcode). Label printing has no flag (A-47) and stays available. NOT toggled live: flipping a plan-bound flag on the shared Demo tenant risks affecting others; recommend an HQ tenant override to false, verify, then remove. See FET-HFC-S19 (P3).

## S20 — Over 9,999 orders in a day (staging only, by script)
**Expected:** Order 10,000 is ORD-…-10000; search, scan and labels still work.
```

**Result:** BLOCKED — Staging-only: requires a staging DB script to create >9,999 orders in one day to reach ORD-...-10000. Not runnable against the shared Preview tenant.


---

## Financial_Expert_Tester Results — Round 1 (2026-11-05, Preview + HQ)

**Env:** tenant app `cmx.cleanmatex.com` (Demo Laundry LLC, tenant `11111111-1111-1111-1111-111111111111`) and HQ `hqsaas.cleanmatex.com`. All times Asia/Muscat (UTC+4). **Tester:** Financial_Expert_Tester (Grok Bot). **Method:** UI-first; database evidence read-only (`SELECT`/`EXPLAIN`/catalog only, `PGOPTIONS=-c default_transaction_read_only=on`). No `fn_doc_seq_next` executed directly (it would consume a number). No flags, settings or shared passwords changed; no real SMS/WhatsApp sent. Evidence screenshots in `shots/` (`sNN-*.png`).

**Headline:** 10 PASS, 4 PARTIAL, 3 BLOCKED, 3 FAIL out of 20. The numbering engine itself is solid — day-based order numbers, full item/piece codes, immutable order number, tenant-scoped scan, engine credit-note numbering, HQ code types and general config all work. The failures are at the edges: pay-later order submission, order split, and the receipt page/tracking QR.

| Scenario | Result | One-liner |
|---|---|---|
| S1 | PARTIAL | Cash orders numbered correctly; Pay-on-Collection submit fails HTTP 422. |
| S2 | PASS | Rapid sequential creates: 00006/00007/00008, no gaps or duplicates. |
| S3 | PASS | Order number read-only in UI and immutable by DB trigger. |
| S4 | FAIL | Split always fails: "Invalid piece id". |
| S5 | PASS | Item and piece codes render in full, no UUIDs. |
| S6 | PASS | EN + AR labels: code LTR, CODE128 + QR. |
| S7 | BLOCKED | No USB scanner. |
| S8 | BLOCKED | No scanner / assembly hardware. |
| S9 | PASS | Re-used tag refused, names the holding piece. |
| S10 | PASS | Foreign org code -> "Nothing matches this code.", no leak. |
| S11 | PASS | Search by order number opens the order directly. |
| S12 | PASS | New note SCN-2026-000001; legacy CN notes unchanged. |
| S13 | FAIL | Receipt page shows raw UUID; receipt template has no tracking QR. |
| S14 | BLOCKED | No sub-order exists (S4 split fails). |
| S15 | PARTIAL | No notification preview; settings page errors, messaging 404. |
| S16 | PASS | HQ Code Types EN+AR; preview exact; minor "ORD-ORD" prefix. |
| S17 | FAIL | Consistency: 1 error — STOCK_TRANSACTION 8 duplicates. |
| S18 | PASS | General Config correct; support contacts empty. |
| S19 | PARTIAL | Flag-off is fail-closed in code; not toggled on shared tenant. |
| S20 | BLOCKED | Staging-only >9,999-orders script. |

### Tester suggestions — Financial_Expert_Tester (FET-HFC-S#)

- **FET-HFC-S1 (P1) — Pay-on-Collection / Pay Later cannot be submitted.** `POST /api/v1/orders/submit-order` returns HTTP 422 with the raw code `SETTLEMENT_LEGS_REQUIRE_RECEIPT_VOUCHER`. Cause: `order-submit-orchestrator.service.ts:445` builds `settlementLegs` from **all** `paymentLegs`, and `:1032-1034` throws when settlement legs exist but `plan.shouldCreateReceiptVoucher` is false; that flag is only set for real payment/credit legs (`order-settlement-planner.service.ts:212`). Fix: make the guard use the same real/credit-leg set as the planner (or skip settlement when there is nothing to settle), and replace the raw error code with a user-friendly message. Also clear the stale toast after a later successful submit.
- **FET-HFC-S4 (P1) — Order split is broken for every piece-tracked order.** Confirm Split always toasts `Invalid piece id: <uuid>`. Cause: `processing-modal.tsx:104` sets the piece `id` to the bare DB UUID when an order is tracked by piece (which HFC enables), but `order-split.service.ts:116-118` (`piecesToSplitLines`) requires the `{itemId}-piece-{n}` shape and throws `ORD_SPLIT_BAD_PIECE_ID`. Fix: have the split mutation send `{itemId, pieceSeq}` (or the `{itemId}-piece-{n}` id) regardless of track-by-piece, e.g. use `piece.itemId` + `piece.pieceNumber` instead of `piece.id` when building `pieceIds`. This also unblocks S14.
- **FET-HFC-S13 (P1) — Receipt page shows the raw order UUID.** `/dashboard/receipts/[orderId]` subtitle reads `Order: 6c5ec787-…` instead of `ORD-20261105-0002`. Cause: `app/dashboard/receipts/[orderId]/page.tsx:54` prints the route UUID and the page fetches only `customer_type`, not `order_no`. Fix: fetch and display `order_no`.
- **FET-HFC-S13b (P2) — No tracking QR on the receipt.** The guide expects the receipt to carry a tracking QR that opens the customer tracking page. The thermal/A4 template `order-receipt-print.tsx` renders only the order CODE128 barcode (correct value `order.orderNo`), and has no QR component; the QR appears only on the label. Fix: add the public-tracking QR (`getPublicTrackingPathForOrderId`) to the receipt template, or correct the guide if the QR is label-only by design.
- **FET-HFC-S17 (P1) — STOCK_TRANSACTION duplicate numbers (data integrity).** HQ Consistency reported 1 error: 8 duplicates across 13 rows; DB confirmed `STK-20260218-0001` ×8 and `STK-20260218-0002` ×2. Cause: the former `inventory-service.ts` writer used read-latest-then-increment (UTC, not tenant tz), while `deduct_retail_stock_for_order` restarted a local counter for every order. **Repair applied by the user on 2026-11-07 locally + remotely:** `0703_stock_transaction_hfc.sql` performs deterministic historical repair, atomic DB-owned assignment for both writers, `NOT NULL`, immutability, and tenant-scoped uniqueness; the web writer no longer supplies `transaction_no`. Local read-only verification confirms zero blank/duplicate groups plus the constraint, triggers and GENERAL registry. **Status remains open** until `hfc_stock_transaction_engine_safety.test.sql`, real concurrent inventory/order writes, and deployed HQ consistency prove the repair in runtime. Related warnings: 9 `NO_UNIQUE_INDEX`, 8 `NOT_NULL_MISSING` on other types; KPI "types checked 52" vs 51 listed.
- **FET-HFC-S15 (P2) — Notification rendering unverifiable; settings broken.** `/dashboard/settings/allsettings` shows "Error Loading Settings – Failed to fetch effective settings" and `/dashboard/settings/messaging` returns 404, so the SMS/WhatsApp order-number rendering could not be previewed. Fix the effective-settings fetch and the messaging route, then confirm notification bodies use the human code (incl. `-S1` for sub-orders).
- **FET-HFC-S16 (P3) — Code-type drawer shows "ORD-ORD".** `doc-seq-type-dialog.tsx:130` joins `type.prefix` and `type.typePrefix`; suppress the duplication when they are equal. Cosmetic. Also "How it works" body stays English in the Arabic drawer.
- **FET-HFC-S18 (P3) — HQ support contacts empty.** General Config support email and phone are blank; fill them for a production-like environment.
- **FET-HFC-S19 (P3) — Verify flag-off via an HQ tenant override.** `human_codes_scan_labels` is plan-bound with no tenant override, so S19 was verified fail-closed in code only. Add a tenant override to `false`, confirm the Scan button / Ctrl+Shift+F and the receipt barcode hide while labels and numbering keep working, then remove the override.
- **FET-HFC-S2-Note (P3) — Order-create "Ready By" defaults to today.** The New Order date picker defaults to the current date and then rejects it with "Date must be in the future", forcing a manual change to tomorrow. Default to tomorrow (or the next valid slot).

### Test data left behind (Demo Laundry, customer Jh Test dev21, branch Main Branch 2)
- Orders created this run (cash / pay-in-advance, PAID): `ORD-20261105-0002` (`6c5ec787-665e-4b5c-a37c-7f14b6f8d097`, 0.856 OMR), `ORD-20261105-0003` (`cd4ac165-9a37-4b5e-9300-59152ca8e236`, 0.856), `ORD-20261105-0004` (`d689a228-721e-414d-968a-bce57b19dac1`, 4.708). S2 rapid creates: `ORD-20261105-00006`, `ORD-20261105-00007`, `ORD-20261105-00008` (0.856 OMR each).
- `ORD-20261105-0001` (`721248ac-c444-440e-9da1-f0d546f2f7a9`, 11.877) was already present, not created here.
- Store credit note issued: `SCN-2026-000001` (0.100 OMR, Active). Legacy notes `CN-11111111-00001..00003` unchanged.
- External tag `TAGQA0001` linked to piece `ORD-20261105-0004-1-1`.
- ORDER counter `org_doc_seq_mst` period `20261105` last_value=8; 0 duplicate order numbers; 0 sub-orders (S4 split fails); 15 pieces total; failed pay-later attempts left no partial rows and consumed no numbers (counter increments roll back with the caller transaction).
- No passwords changed; no flags or settings modified.
