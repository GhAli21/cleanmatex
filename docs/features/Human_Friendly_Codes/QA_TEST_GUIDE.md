# QA Test Guide — Human-Friendly Codes

Manual scenarios S1–S20 from plan §14.4 (T9.1). Run them on the **deployed** environments (local, then staging/remote) after DEV_GUIDE §22 is done. Each scenario has a Result line to fill in. Automated tests and performance checks: [`testing_guide_and_scenarios.md`](./testing_guide_and_scenarios.md).

**Status (2026-10-31):** all scenarios Pending (user-run on deployed env). Run each in English and Arabic (RTL; codes must read left-to-right).

Prerequisites: `0687`–`0689` applied; web-admin, HQ `platform-api` and `platform-web` deployed; for S7/S8/S9 a USB scanner and printed labels; for the scan dialog (S7, S9, S10) and the receipt barcode (S13) the tenant flag `human_codes_scan_labels` on (off for S19); for S20 a staging DB only.

## S1 — New order gets a day-based number in the organization's timezone
1. Set the organization timezone to Asia/Muscat. At 00:30 Muscat time, create an order.
**Expected:** Order number is ORD-<today in Muscat>-0001 (or next), shown in the order header, list and receipt.

**Result:** Pending (user-run on deployed env) — Env: ___ Date: ___ Tester: ___ Pass/Fail: ___

## S2 — Two staff create orders at the same moment
1. Two users in the same organization click "Create order" at the same time (10 times each).
**Expected:** 20 different numbers, none skipped except for any cancelled create; no error.

**Result:** Pending (user-run on deployed env) — Env: ___ Date: ___ Tester: ___ Pass/Fail: ___

## S3 — Order number cannot be changed
1. Try to edit the order number via any screen or API.
**Expected:** Not editable; API returns an error; number unchanged.

**Result:** Pending (user-run on deployed env) — Env: ___ Date: ___ Tester: ___ Pass/Fail: ___

## S4 — Split order
1. Split two items off ORD-…-0007.
**Expected:** New order ORD-…-0007-S1 appears, linked to the parent; splitting again gives -S2.
2. (P2.1) Split -S1 again.
**Expected:** ORD-…-0007-S3 (numbered under the root); the parent's totals and payments do not change; the sub-order lines show 0 price.

**Result:** Pending (user-run on deployed env) — Env: ___ Date: ___ Tester: ___ Pass/Fail: ___

## S5 — Piece codes
1. Create an order with 2 items (3 and 2 pieces).
**Expected:** Pieces show ORD-…-1-1, -1-2, -1-3, -2-1, -2-2 in full (no shortened UUID).

**Result:** Pending (user-run on deployed env) — Env: ___ Date: ___ Tester: ___ Pass/Fail: ___

## S6 — Print order label
1. Open an order and click "Print label".
**Expected:** Label prints with a QR and a barcode; the barcode text equals the order number; works in Arabic UI with the code shown left-to-right.

**Result:** Pending (user-run on deployed env) — Env: ___ Date: ___ Tester: ___ Pass/Fail: ___

## S7 — Scan order label with a USB scanner (Arabic keyboard layout)
1. Switch the computer keyboard to Arabic. Open the Scan dialog. Scan the order label.
**Expected:** The order opens. No Arabic letters appear in the field.

**Result:** Pending (user-run on deployed env) — Env: ___ Date: ___ Tester: ___ Pass/Fail: ___

## S8 — Scan a piece tag on the assembly screen
**Expected:** The piece is marked as scanned; the result is announced; field stays focused for the next scan.

**Result:** Pending (user-run on deployed env) — Env: ___ Date: ___ Tester: ___ Pass/Fail: ___

## S9 — Link a pre-printed tag
1. On a piece, choose "Link tag" and scan a tag already linked to another piece.
**Expected:** Message says the tag is in use by piece <code>, with a link to it; nothing changes.

**Result:** Pending (user-run on deployed env) — Env: ___ Date: ___ Tester: ___ Pass/Fail: ___

## S10 — Code from another organization
1. Scan a label printed by a different organization.
**Expected:** "Code not found". No details from the other organization.

**Result:** Pending (user-run on deployed env) — Env: ___ Date: ___ Tester: ___ Pass/Fail: ___

## S11 — Search by order number
1. Type the full order number in the orders search box and press Enter.
**Expected:** The order opens directly.

**Result:** Pending (user-run on deployed env) — Env: ___ Date: ___ Tester: ___ Pass/Fail: ___

## S12 — Store credit note
1. Issue a store credit note.
**Expected:** Number SCN-<year>-000001 (or next); old credit notes keep their old numbers.

**Result:** Pending (user-run on deployed env) — Env: ___ Date: ___ Tester: ___ Pass/Fail: ___

## S13 — Receipt
**Expected:** Receipt still shows the tracking QR that opens the customer tracking page.

**Result:** Pending (user-run on deployed env) — Env: ___ Date: ___ Tester: ___ Pass/Fail: ___

## S14 — Customer app with a sub-order
**Expected:** Customer can open ORD-…-S1 in the app/tracking page.

**Result:** Pending (user-run on deployed env) — Env: ___ Date: ___ Tester: ___ Pass/Fail: ___

## S15 — Notifications
**Expected:** SMS/WhatsApp show the order number (including -S1 for sub-orders); never a long technical ID.

**Result:** Pending (user-run on deployed env) — Env: ___ Date: ___ Tester: ___ Pass/Fail: ___

## S16 — HQ Code Types (EN + AR)
**Expected:** List shows ORDER (ORD, GENERAL) and the domain rows with examples; each row's drawer shows its "How it works" text; preview shows a sample for a chosen date/timezone; Arabic layout is right-to-left with codes left-to-right.

**Result:** Pending (user-run on deployed env) — Env: ___ Date: ___ Tester: ___ Pass/Fail: ___

## S17 — HQ Code Consistency
**Expected:** 0 errors on a healthy environment; "Run again" refreshes the time.

**Result:** Pending (user-run on deployed env) — Env: ___ Date: ___ Tester: ___ Pass/Fail: ___

## S18 — HQ General Config
**Expected:** Shows currency, timezone, language, country, fiscal start, VAT, support contacts, trial days.

**Result:** Pending (user-run on deployed env) — Env: ___ Date: ___ Tester: ___ Pass/Fail: ___

## S19 — Feature flag off
**Expected:** Scan dialog (top-bar button and Ctrl+Shift+F) and the receipt order barcode are hidden; label printing stays available (A-47: no `label_printing` flag); existing screens still work; numbers still generated.

**Result:** Pending (user-run on deployed env) — Env: ___ Date: ___ Tester: ___ Pass/Fail: ___

## S20 — Over 9,999 orders in a day (staging only, by script)
**Expected:** Order 10,000 is ORD-…-10000; search, scan and labels still work.
```

**Result:** Pending (user-run on deployed env) — Env: ___ Date: ___ Tester: ___ Pass/Fail: ___
