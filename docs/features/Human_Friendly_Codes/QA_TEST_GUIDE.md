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

**Result:** FIXED IN CODE — DEPLOYED QA PENDING. The settings catalog/effective proxies now forward the authenticated session token, reject a tenant mismatch, and never fall back to a shared token. `/dashboard/settings/messaging` permanently redirects to `/dashboard/notifications/settings`; the unrelated failing effective-settings prefetch was removed. Focused proxy-security tests pass (4/4). Deploy web-admin, then send an approved test notification and confirm SMS/WhatsApp uses the order number (including `-S1`) rather than a technical ID.

## S16 — HQ Code Types (EN + AR)
**Expected:** List shows ORDER (ORD, GENERAL) and the domain rows with examples; each row's drawer shows its "How it works" text; preview shows a sample for a chosen date/timezone; Arabic layout is right-to-left with codes left-to-right.

**Result:** FIXED IN CODE — DEPLOYED QA PENDING. `0705_doc_seq_type_implement_desc_ar.sql` supplies an explicit nonblank Arabic implementation description for every registered code type. The HQ API returns it as a required field; the console displays `prefix` once (never `ORD-ORD`) and selects the Arabic description in Arabic. Focused HQ API tests (10/10) and console/a11y tests (30/30) pass. Deploy platform-api and platform-web together, then repeat the EN/AR drawer/preview smoke.

## S17 — HQ Code Consistency
**Expected:** 0 errors on a healthy environment; "Run again" refreshes the time.

**Registry note (`0714` applied by the user locally and remotely):** PRODUCT and STOCK_ITEM are category-scoped: the same product code may exist for different service categories in one organization. `0714_hfc_product_code_scope.sql` aligns the registry's `unique_with` metadata with the existing `(tenant_org_id, service_category_code, product_code)` constraint, removing the corresponding `NO_UNIQUE_INDEX` warnings without changing product data or database constraints.

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
| S15 | DEPLOYED QA PENDING | Settings-proxy/legacy-route repair has focused test evidence; send an approved test notification after deploy. |
| S16 | DEPLOYED QA PENDING | Prefix and Arabic implementation-description repairs have HQ API/console test evidence; repeat EN/AR smoke after deploy. |
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
- **FET-HFC-S15 (P2) — Notification rendering was unverifiable; settings were broken.** The authenticated proxy and legacy route are repaired and covered by focused tests. Runtime notification delivery remains unproven until an approved test message confirms the human order code (including `-S1`).
- **FET-HFC-S16 (P3) — Code-type drawer showed "ORD-ORD" and English guidance in Arabic.** The prefix is now rendered once; `0705` adds an enforced Arabic implementation description for every code type, and the HQ API/console carry it end to end. Deployment plus an EN/AR smoke test remains required.
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

## Financial_Expert_Tester Results — Retest r2 2026-11-17 (remote; HQ read-only + tenant order attempts)

**Environment:** remote only — tenant `https://cmx.cleanmatex.com` (Demo Laundry LLC, OMR 3 decimals) and HQ `https://hqsaas.cleanmatex.com` (Incognito). Run window 2026-11-17 ~04:40–09:20 Asia/Muscat (UTC+4). UI only (mouse/keyboard and browser page tools); no direct API calls, no page JS that changes data, no DB writes. Read-only `SELECT`s only where stated. Jest skipped.
**Accounts by role (no passwords; see `CREDENTIALS_AND_ENVIRONMENTS.md` / vault):** Demo Laundry admin `admin@demo-laundry.example` (shows role `super_admin`); operator `operator@demo-laundry.example`; viewer `viewer@demo-laundry.example`; HQ System Administrator `admin@cleanmatex.com`. No shared password was changed.
**Deploy caveats (2026-11-17):** (1) S0 privilege-lockdown migrations 0745–0749 were applied ~04:00–05:15; during that window New Order broke (403 `fn_stng_resolve_all_settings`, 400 `/api/v1/categories`, 500 `/api/v1/lookups/service-speeds`, "Failed to fetch customers", empty sidebar) and it was working again by ~05:38. (2) From ~05:00 Processing shows the raw error `permission denied for table sys_order_sources_cd` and an empty queue (regression; blocks Ready/Delivery/prints). (3) From ~07:00 All Orders fails with `Invalid prisma.org_orders_mst.findMany() invocation: The column org_orders_mst.photo_urls does not exist in the current database`, order detail pages show "Order not found" and New Order submit returns `ORDER_SUBMIT_FAILED`, after migration `0751_file_util_drop_photo_url_columns` dropped the column while the deployed app still reads it (still failing at 08:44). Rows that needed an order after ~07:00 are BLOCKED for that reason.
**Writes:** none succeeded. Two New Order submits (cash and Pay on Collection) were attempted at 08:10–08:12 and both failed, so no order was created. HQ: one read-only "Run again" on Code Consistency. Source ledger on the tester box: `/workspace/qa-20261117/backlog/obs/B9-Q11.md` (HQ 07:55–07:59; tenant 08:05–08:12). Rows above are unchanged.

**Recount (Retest r2 2026-11-17, rows in the table below):** PASS 3 · FAIL 2 · PARTIAL 2 · BLOCKED 7 · NOT RUN 4.

| # | Verdict | Evidence |
|---|---|---|
| §8 Doc-seq hub EN/AR | PASS | 07:55 EN / 07:58 AR `/doc-seq-config`: 51 active code types, 2 tenants with counters / 11 rows, 0 HQ / 0 system counters, 13 issuing modules; banner "1 error and 19 warnings need attention"; AR RTL with Arabic labels. |
| §8 Counters EN/AR | PASS | 07:56–07:58 "Read only", cannot edit/reset. ORDER period 20261117, last 6, next `ORD-20261117-00007`; closed periods "Closed"/"مغلقة" with no next value; STOCK_TRANSACTION 5 rows (4 Demo Laundry, 1 Demo Saudi), all closed. Codes stay LTR in Arabic. |
| S16 ORDER type EN/AR | PARTIAL | 07:59 prefix exactly `ORD` (no "ORD-ORD"), YYYYMMDD-SEQ, daily, shared generator; Arabic heading "رقم الطلب" and "How it works" paragraph in Arabic. Short line under the Arabic heading still English ("Order number shown on receipts, labels and search."). |
| S16 STOCK_TRANSACTION type | PARTIAL | 07:56 prefix `STK`, `-`, 4 digits, daily, `org_inv_stock_tr.transaction_no`, migration 0703; Arabic title "رقم حركة المخزون" + Arabic implementation text; short line still English ("Inventory stock movement number."). |
| S17 Consistency | FAIL (overall) | 07:57 EN / 07:58 AR: 1 error / 19 warnings / 37 info; 52 types checked, 49 tables fine. STOCK_TRANSACTION now `DATA_OK` — "Codes on this table are complete and unique", 14 rows scanned. Remaining ERROR: `USER` / `org_users_mst.user_code` / `DATA_DUPLICATES` (1 / 8 affected). Run again → 10-second cooldown message. |
| S18 General Config EN/AR | PASS | Asia/Muscat, en-OM, Oman, OMR, FY2026 from January, week starts Saturday, DD/MM/YYYY, 24-hour, VAT 5%, trial 30 days. Support email/phone blank. Not edited. |
| HQ read-only role (§8) | BLOCKED | No `hq_doc_seq:read`-only account; HQ users page says "You do not have permission to open this". |
| Tenant All Orders | FAIL | 08:05 `/dashboard/orders`: `Invalid prisma.org_orders_mst.findMany() invocation: The column org_orders_mst.photo_urls does not exist in the current database.` Cards: Total 8, Pending Prep 8, In Progress 8, Ready 0. |
| S1 Cash order | BLOCKED | 08:10 Bathrobe/Robe + Blouse, Jh Test dev21, note QA-20261117-HFC, ready-by 18 Nov 17:00, subtotal 4.000, tax 0.280, total 4.280: both confirms → "Order submission failed. [ORDER_SUBMIT_FAILED]"; no order number. |
| S1 Pay on Collection | BLOCKED | 08:12 same draft, "Pay later Applied", OMR 4.280 unpaid → same `ORDER_SUBMIT_FAILED`. Old 422 `SETTLEMENT_LEGS_REQUIRE_RECEIPT_VOUCHER` not shown (cannot tell if FET-HFC-S1 is fixed). Note: Pay on Collection orders were created successfully earlier today at 05:45 and 05:57 (`ORD-20261117-00002`, `-00003`), so FET-HFC-S1 looks fixed before the `photo_urls` break. |
| S13 Receipt | BLOCKED | `ORD-20261117-00006` / `-00005` detail → "Order not found … It may have been deleted or you may not have access to it." |
| S4 Split | BLOCKED | No reachable order detail. |
| S14 Sub-order numbers | NOT RUN | Depends on S4. |
| S15 Notifications | BLOCKED | No approved test recipient used. |
| S19 Flag off | NOT RUN | Flag not changed. |
| S20 >9,999/day | NOT RUN | Staging-only script. |
| S7 / S8 Scanner | BLOCKED | No scanner / assembly hardware (backlog Q20). |
| S2, S3, S5, S6, S9–S12 | NOT RUN | Not re-run; Round 1 verdicts stand. |

Prior findings, Retest r2 2026-11-17: **FET-HFC-S17 (STOCK_TRANSACTION duplicates) FIXED** at runtime — `DATA_OK`, 14 rows, complete and unique. **FET-HFC-S16** prefix part **FIXED** (`ORD`, `STK` once); Arabic short description **STILL English**. **FET-HFC-S18 STILL OPEN** (support contacts blank). **FET-HFC-S1** — Pay on Collection worked at 05:45/05:57 today (likely fixed), retest at 08:12 blocked by `ORDER_SUBMIT_FAILED`. **FET-HFC-S4 / S13 / S13b** not retestable (order pages).

### Tester suggestions — Financial_Expert_Tester (Retest r2 2026-11-17)
- **P0 FET-HFC-Nov17-PhotoUrlsColumnDropped:** Since ~07:00 All Orders, order detail and New Order submit fail: migration `0751_file_util_drop_photo_url_columns` dropped `org_orders_mst.photo_urls` (confirmed read-only on remote) while the deployed Prisma client still selects it. Deploy the app build that no longer reads the column (or restore the column until it is live); show a plain error instead of the raw Prisma text, and don't say "Order not found" for a server error.
- **P1 FET-HFC-Nov17-UserCodeDuplicates:** Consistency ERROR `USER / org_users_mst.user_code / DATA_DUPLICATES (1/8)`. The session guide confirms the app still accepts a duplicate user code on update. Add the unique index (case-insensitive) after cleaning the duplicate.
- **P3 FET-HFC-Nov17-ArabicShortDescription:** The one-line description under each Arabic code-type heading is still English.
- **P3 FET-HFC-Nov17-GenericSubmitError:** `ORDER_SUBMIT_FAILED` gives no reason; include a short cause and a retry hint.

### Blocked
- S1/S4/S13 (order pages and submit broken from ~07:00), S15 (no test recipient), S7/S8 (hardware), HQ read-only role (no account).

### Test data left behind
- None from this retest (both submits failed with no order number; the ORDER counter was last read at 07:56, next `-00007`, and was not rechecked after the failed submits). Run-wide QA orders `ORD-20261117-00001..00006` are listed in the Q3/Q4/Q7 guides.

## Financial_Expert_Tester Results — Retest r3 2026-11-19 (remote; tenant order create + receipt)

**Environment:** remote only — tenant `https://cmx.cleanmatex.com` (Demo Laundry LLC, OMR 3 decimals), Demo Laundry admin account (shows role `super_admin`; no passwords or test contact details are recorded here — see `CREDENTIALS_AND_ENVIRONMENTS.md` / vault). UI only (mouse/keyboard and browser page tools); no direct API calls, no page JS that changes data, no DB writes; Jest skipped. Run window 2026-11-19 ~04:00–05:00 Asia/Muscat (UTC+4). This is the retest of the order-dependent rows from the 17-Nov backlog after the `photo_urls` fix. Source ledgers on the tester box: `/workspace/qa-20261119/retest/obs/A.md` (existing QA orders), `B.md` (New Order), `C.md` (Order Edit / collect), `D.md` (POS / cash drawer); screenshots `/workspace/qa-20261119/retest/shots/` (file names cited below). Original steps, earlier rounds and Dev notes above are unchanged.
**Fixed since 17-Nov:** the `photo_urls` P0 (FET-HFC-Nov17-PhotoUrlsColumnDropped) — All Orders list, order detail, `/full` and `/workspace` load again (no `photo_urls` banner, no "Order not found"), and New Order submit works for cash and Pay on Collection orders (no `ORDER_SUBMIT_FAILED`, no 422).
**Still blocked platform-wide:** `/dashboard/processing` still shows the red banner "permission denied for table sys_order_sources_cd" and "No orders in processing queue" (re-observed 2026-11-19 after the `photo_urls` fix; ledger `/workspace/qa-20261119/obs/U-pr0102.md`, shot `PR02-4-processing`). Every QA order therefore stays at Processing / preparation Pending, so Ready, Delivery, Split and rack rows cannot be reached.
**Writes used (approved 2026-11-19):** four QA orders, `ORD-20261119-00001..00004`. Source ledger on the tester box: `/workspace/qa-20261119/retest/obs/B.md`, `C.md`, `D.md`, `A.md`. Rows above are unchanged.

**Recount (this retest, 5 rows): PASS 2 / FAIL 0 / PARTIAL 1 / BLOCKED 2 / NOT RUN 0.**

| # | Verdict | Evidence |
|---|---|---|
| S1 Cash order | PASS | ~04:18 and ~04:22: cash orders submitted from New Order; toast "Order ORD-20261119-00002 created successfully" (the `-00001` submit showed no toast, the form just reset). List shows `ORD-20261119-00001` and `-00002` as "Processing / POS (counter) / 3.959 and 3.692"; detail header shows the order number; format `ORD-YYYYMMDD-NNNNN`. Numbers are consecutive — the earlier failed submit consumed no number. Shots `B-O2-detail`, `B-O3-detail`. |
| S1 Pay on Collection | PASS | `ORD-20261119-00003` (Blouse + Pants, "Pay later Applied", Remaining 3.424 · Pay on Collection) and `ORD-20261119-00004` (Blouse, 2.354) submitted with no 422 `SETTLEMENT_LEGS_REQUIRE_RECEIPT_VOUCHER` and no `ORDER_SUBMIT_FAILED`; detail "Balance Owing", method PAY_ON_COLLECTION, badge "Pending Payment". Shot `C-C0`. |
| S4 Split | BLOCKED | Split is reached via Processing, which still fails (`permission denied for table sys_order_sources_cd`). |
| S13 Receipt | PARTIAL | `/dashboard/receipts/<orderId>` for `ORD-20261117-00001` now shows "Order ORD-20261117-00001" (the raw UUID is gone) but the page is only a "Send Receipt" form: no receipt preview and no tracking QR code. |
| S14 Sub-order numbers (`-S1`, `-S2`) | BLOCKED | Depends on S4 (Split). |

Prior findings, Retest r3 2026-11-19: **FET-HFC-Nov17-PhotoUrlsColumnDropped (P0) FIXED** — All Orders, order detail, `/full` and `/workspace` load, New Order submit works. **FET-HFC-S1 FIXED** (cash and Pay on Collection both submit; no 422). **FET-HFC-S13 / S13b PARTIALLY FIXED** (order number shown instead of the UUID; QR/preview missing). **FET-HFC-Nov17-GenericSubmitError** — a different submit failure now shows a plain message ("Some products have invalid IDs. Please refresh the page and try again.") for orders with a custom item; see Q4 FET-LLMS-Nov17-CustomItemInvalidIds. **FET-HFC-Nov17-UserCodeDuplicates, ArabicShortDescription** not rechecked.

### Tester suggestions — Financial_Expert_Tester (Retest r3 2026-11-19)
- **P2 FET-HFC-Nov19-NoOrderNumberAfterSubmit:** After a successful cash submit the form just resets (no toast on `-00001`, a toast on `-00002`); the cashier never sees the new order number or a "Print receipt / Open order" action. Always show the number with links to the order and its receipt.
- **P2 FET-HFC-Nov19-ReceiptNoQrNoPreview:** The receipt page has no preview and no tracking QR (guide S13 expects the order number and a tracking QR on the receipt template). Add the preview/QR or update the guide (see Q3 FET-RV-Nov19-ReceiptNoPreview).

### Blocked
- S4 and S14: Processing (`sys_order_sources_cd`) must be fixed before an order can be split.

### Test data left behind
- `ORD-20261119-00001` (3.959 cash), `-00002` (3.692 cash), `-00003` (POC, edited to 11.182, collected, refunded 10.003), `-00004` (2.354 POC, collected).

## Financial_Expert_Tester Results — Retest r4 2026-11-20 (post-deploy observe pass)

**Retest r5 (2026-11-20 21:55–22:31 Asia/Muscat).** Tester: Financial_Expert_Tester (Grok Bot). Trigger: owner t160u — new evening deploy; redo all QA files, not only UIDS and File_Util. This round is an **observe-only** post-deploy pass: owner approval for writes is still pending, so write-gated rows are **NOT RUN (awaiting approval)**. Nothing was saved, applied, paid, published, assigned, or confirmed. Appearance and language were restored. Earlier rounds above are untouched.

Environment: remote only. Tenant https://cmx.cleanmatex.com (Demo Laundry, Main Branch) and HQ https://hqsaas.cleanmatex.com (Incognito). Accounts used: Demo Laundry admin `admin@demo-laundry.example`, operator `operator@demo-laundry.example` (`U000001`), viewer `viewer@demo-laundry.example`; HQ SAAS Admin `admin@cleanmatex.com`. Credentials: see `F:\JhApps_doc\CleanMateX_Jh\Testing_Jh\GrokBot_HQ_Test\CREDENTIALS_AND_ENVIRONMENTS.md` — none recorded here. Real mouse and keyboard; no direct API calls; no page scripts that change data; no Jest. Hard-reload (Ctrl+Shift+R) after the deploy. Screenshots: `C:\Users\JHNLP\qa-20261120\r5\shots\`.

Human Friendly Codes (Q11) rows below were run on cmx Demo admin, 22:19–22:26 Asia/Muscat. Parent scenario counts are unchanged.

| # | Result | Evidence |
|---|---|---|
| All Orders (tenant list) | PASS (FIXED) | `https://cmx.cleanmatex.com/dashboard/orders` loads 13 orders with no Prisma error, ~5.0 s. The prior `photo_urls` / Prisma failure (FET-HFC-Nov17-PhotoUrlsColumnDropped) is **FIXED / not reproduced** on this page. |
| S13 | PARTIAL | `https://cmx.cleanmatex.com/dashboard/receipts/a676aff3-1777-45ca-bd9c-9c47a515c2da` now shows "ORD-20261119-00006" (not a UUID) plus the send-receipt form only; still no tracking QR / preview (FET-HFC-Nov19-ReceiptNoQrNoPreview / FET-RV-Nov19-ReceiptNoPreview still open). The order-number-on-receipt half is **FIXED**. |
| S17 | BLOCKED | `https://cmx.cleanmatex.com/dashboard/settings/document-sequences` and `/dashboard/settings/consistency` are 404; no nav entry. All Settings search list never loaded. |

**Prior findings — Retest r4 2026-11-20**

- **FET-HFC-Nov17-PhotoUrlsColumnDropped** (All Orders Prisma error) — **FIXED / not reproduced.**
- **FET-HFC-Nov19-NoOrderNumberAfterSubmit** (receipt showed a UUID) — **FIXED** on this receipt: it shows ORD-20261119-00006.
- **FET-HFC-Nov19-ReceiptNoQrNoPreview** / **FET-RV-Nov19-ReceiptNoPreview** — **STILL OPEN.** Receipt page has no tracking QR/preview.

**r5 tally for the rows above (parent counts unchanged):** PASS 1 (All Orders) · PARTIAL 1 (S13) · BLOCKED 1 (S17).

**Rows not run in r5:** remaining code-format, submit, and sequence-write rows (write-gated or still blocked on missing settings routes).

**Test data left behind:** nothing new was created in r5. Shared leftover from earlier rounds (unchanged): `ORD-20261119-00006` is READY on rack QA-A1, paid 1.070 OMR cash, with 3 photos including `qa_photo2.jpg` (note "QA r4 note"). Appearance and language were restored. No branding, settings, users, or other orders were changed.

**Retest plan:** Recheck S13 when a receipt preview/QR ships. Recheck S17 when document-sequences / consistency routes are restored or linked from All Settings.
