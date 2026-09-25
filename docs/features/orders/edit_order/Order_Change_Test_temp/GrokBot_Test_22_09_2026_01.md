# CleanMateX Order Edit E2E Test Report

> **Owner rule 2026-09-25:** no maker ≠ checker — holding the permission is the only approval gate, the same user may approve. Statements below recommending a different-user approval are superseded.

- **Tester:** Test_app_and_report (Grok Bot)
- **Dates:** 22–23 Sep 2026 (Asia/Muscat)
- **Environment:** https://cmx.cleanmatex.com
- **Tenant:** Demo Laundry LLC
- **Login:** admin@demo-laundry.example (super_admin)
- **Scope:** Create 3 orders (zero / half / full payment) → Order Details → Edit → compare before vs after; integrity + UX recommendations
- **Screenshots folder:** `GrokBot_Test_22_09_2026_01_SC\`

---

## Executive summary

| Goal | Result |
|------|--------|
| Create ZERO payment order | **PASS** |
| Create HALF payment order | **PASS** (after cash drawer session) |
| Create FULL payment order | **PASS** (after cash drawer session) |
| Edit + Save (ZERO) | **PASS** |
| Edit + Save (HALF) | **PASS** — financials unchanged |
| Edit + Save (FULL) | **PASS** — financials unchanged |
| Values integrity overall | **MOSTLY PASS** — with open integrity findings below |
| Overall A–Z Order Edit E2E (this run) | **PASS with findings** |

**Bottom line:** After the app update + opening a cash drawer session via **Switch to Advanced**, create (zero/half/full) and Edit Save all succeeded. Edit no longer hits the previous circular-JSON blocker. Remaining issues are mainly **customer display integrity** and **item label drift after edit** (`DRY_CLEAN` vs Business Blazer).

---

## Environment / setup notes

- New Order: `/dashboard/orders/new`
- Details: `/dashboard/orders/{id}`
- Edit: `/dashboard/orders/{id}/edit`
- Product used: **Business Blazer** only (avoid Shirt/Suit — invalid seeded UUIDs `4444…`)
- Paid cash requires an open **cash drawer session**. Use payment modal **Switch to Advanced** → open/select session (e.g. SES-000022, Branch 2 Cash Drawer). Without it: *“Open a cash drawer session before taking cash for this order.”*

---

## Orders created (this A–Z run)

| Variant | Order # | Result | Total | Paid | Balance | Notes |
|---------|---------|--------|-------|------|---------|-------|
| ZERO | (created in run; edit verified) | PASS | 2.800 | 0.000 | 2.800 | Pay on Collection |
| HALF | **ORD-20260923-0002** | PASS | 2.800 | 1.400 | 1.400 | Cash half + Pay on Collection remainder |
| FULL | **ORD-20260923-0003** | PASS | 2.800 | 2.800 | 0.000 | UUID `eab33e6e-09ff-4add-a327-a01983cb4bb5` |

FULL details URL:  
https://cmx.cleanmatex.com/dashboard/orders/eab33e6e-09ff-4add-a327-a01983cb4bb5/full

Earlier same-day half-pay success (session discovery): **ORD-20260922-0002** (screenshot `10_…`).

---

## Edit integrity matrices

### ZERO_PAY

| Field | Before → After | OK? |
|-------|----------------|-----|
| Ready By | Changed to future | Yes |
| Notes | Edit note persisted | Yes |
| Total / Paid / Balance | Unchanged (2.800 / 0 / 2.800) | Yes |
| Edit Save | Succeeded (was circular JSON before update) | Yes |

Evidence: `12_zero_pay_after_edit_details.png`, `13_zero_pay_after_edit_alt.png`

### HALF_PAY — ORD-20260923-0002

| Field | Before → After | OK? |
|-------|----------------|-----|
| Ready By | Changed to future | Yes |
| Notes | `E2E edit HALF` saved & verified | Yes |
| Total | 2.800 → 2.800 | Yes |
| Paid | 1.400 → 1.400 | Yes |
| Balance | 1.400 → 1.400 | Yes |
| Customer display | Mismatch/blank-name issue still present | **Finding** |

Evidence: `14_`–`17_half_pay_*.png`

### FULL_PAY — ORD-20260923-0003

| Field | Before → After | OK? |
|-------|----------------|-----|
| Ready By | Changed | Yes |
| Notes | `E2E edit FULL` saved | Yes |
| Total / Paid / Balance | 2.800 / 2.800 / 0.000 stable | Yes |
| Customer name | Appears blank in details | **Finding** |
| Item label after edit | Shows `DRY_CLEAN` instead of Business Blazer | **Finding** |

Evidence: `18_`–`22_full_pay_*.png`

---

## Findings

### F1 — Cash drawer session required for cash (P0 ops / UX)

Paid cash create blocked until a drawer session is open. Error: *Open a cash drawer session before taking cash for this order.*  
Workaround: **Switch to Advanced** → create/select session.  
Earlier opaque `ORDER_SUBMIT_FAILED` on full cash was consistent with missing/invalid drawer context.  
Evidence: `09_cash_drawer_session_required.png`

### F2 — Customer mismatch after HALF create (P0 integrity)

Selected **Jh Test dev21**; after create, list showed **Test Customer2 Mohammed Ahmed**.  
Evidence: `11_pause_half_pay_customer_mismatch_ORD-20260923-0002.png`  
Disposition: noted; testing continued per instruction.

### F3 — Blank customer name on details (P1)

FULL (and sometimes HALF) details show blank customer name despite order existing.

### F4 — Item label becomes `DRY_CLEAN` after edit (P1 integrity / UX)

After FULL edit save, item display label drifted from **Business Blazer** to **DRY_CLEAN** (category code?). Financials stayed correct; label integrity failed.

### F5 — Invalid seeded catalog UUIDs (P1 create hygiene)

Shirt/Suit ids like `44444444-4444-4444-4444-…` fail UUID validation. Prefer known-good products (Business Blazer).

### F6 — Edit Save circular JSON (P0 — **fixed in this retest**)

Previously: client circular JSON via `HTMLButtonElement.stateNode`; no API call.  
This retest: Edit Save works for ZERO / HALF / FULL.

---

## Note — customer mismatch (paused then continued)

**When:** 23 Sep 2026 ~00:08 Asia/Muscat  

Selected customer: Jh Test dev21 → HALF order ORD-20260923-0002 created (2.800 / paid 1.400 / balance 1.400) but list showed Test Customer2 Mohammed Ahmed. Logged as F2; continued with edit + FULL per tester.

---

## UX recommendations (as a counter user)

1. **Block cash tender until a drawer session is active** — disable Cash / show a primary “Open cash drawer” action instead of failing at Submit.
2. **Surface the active drawer session** in the payment header (branch + session id + cashier).
3. **Confirm customer on the payment / submit step** — large name + phone chip; require explicit confirm if list/search selection is ambiguous.
4. **After create, land on details with customer name always visible**; never blank.
5. **Edit should preserve product display name**; if showing category, show both (“Business Blazer · Dry clean”).
6. **Hide or quarantine invalid catalog UUID products** in New Order grid.
7. **Toast copy:** prefer “Open cash drawer session” over generic `ORDER_SUBMIT_FAILED`.
8. **Edit Save success:** brief confirmation of what changed (Ready By, notes) without changing money fields unless user edits payments.
9. **Orders list columns:** show paid / balance badges so half vs full vs zero are scannable.
10. **One-click “Pay remaining”** from details for half-paid orders.

---

## Screenshot index (`GrokBot_Test_22_09_2026_01_SC`)

| File | What it shows |
|------|----------------|
| `09_cash_drawer_session_required.png` | Cash blocked without drawer session |
| `10_retest_half_pay_earlier_ORD-20260922-0002.png` | Earlier half-pay success after session |
| `11_pause_half_pay_customer_mismatch_ORD-20260923-0002.png` | Customer mismatch on list |
| `12_` / `13_zero_pay_after_edit_*.png` | ZERO after successful edit |
| `14_`–`17_half_pay_*.png` | HALF before / edit / after |
| `18_`–`22_full_pay_*.png` | FULL create / edit / after (incl. DRY_CLEAN label) |
| Earlier `01`–`08` if present | Prior failure evidence from first pass |

---

## Sign-off

| Item | Status |
|------|--------|
| Zero create + edit | Pass |
| Half create + edit | Pass (customer display finding) |
| Full create + edit | Pass (blank name + DRY_CLEAN label findings) |
| Financial integrity on non-payment edits | Pass |
| Overall | **PASS with findings** |

*Report finalized 23 Sep 2026 after complete A–Z retest.*

---

## Deep pass — add item + priced preference (same 3 orders) — COMPLETE

**Goal:** Re-open ORD-20260923-0001 / 0002 / 0003, edit with **new catalog item + priced service preference**, validate money on **screen and cloud DB**.

**DB source:** Cloud Postgres from `.env.dbcloudjh` (local Supabase on port 54322 has **0** orders).

**Edit pattern used on all three:** Bathrobe/Robe 1.800 + Heavy Starch +0.300 (Business Blazer not found in Edit search). Expected new total **4.900**.

### Final cloud DB (after all three deep edits)

| Order | UUID | Status | Items | Total | Paid | Outstanding | Pref/piece extra | Tax |
|-------|------|--------|-------|-------|------|-------------|------------------|-----|
| ORD-20260923-0001 ZERO | `5a19407f-076e-4669-881f-f11be2b849b7` | PENDING_COLLECTION | 2 | 4.9000 | 0.0000 | 4.9000 | 0.3000 / 0.3000 | 0.3210 |
| ORD-20260923-0002 HALF | `acfeb148-05fe-4f3b-82f2-f134fb920879` | PARTIALLY_PAID | 2 | 4.9000 | 1.4000 | 3.5000 | 0.3000 / 0.3000 | 0.3210 |
| ORD-20260923-0003 FULL | `eab33e6e-09ff-4add-a327-a01983cb4bb5` | PARTIALLY_PAID | 2 | 4.9000 | 2.8000 | 2.1000 | 0.3000 / 0.3000 | 0.3210 |

Item-row sums = header totals for all three (**match**). Payment rows unchanged: HALF cash 1.400; FULL cash 2.800; ZERO none.

### ZERO — PASS (UI + DB)

- Before: total 2.800 / paid 0 / outstanding 2.800 / PENDING_COLLECTION
- After UI: total 4.900 / paid 0 / balance 4.900
- After DB: matches UI. Paid stayed 0; outstanding rose with total (**expected**).

Screens: `23_deep_ZERO_before.png`, `24_deep_ZERO_edit.png`, `25_deep_ZERO_after.png`

### HALF — PASS (UI + DB)

- Before: total 2.800 / paid 1.400 / outstanding 1.400 / PARTIALLY_PAID
- Save required **edit reason** (payment already recorded) + total-increased ack
- After UI: total 4.900 / paid 1.400 / balance 3.500
- After DB: matches. Status stayed PARTIALLY_PAID. Paid not auto-topped-up (**correct unless product should prompt for more cash**).

Screens: `26_deep_HALF_before.png`, `27_deep_HALF_edit.png`, `28_deep_HALF_after.png`

### FULL — PASS (UI + DB)

- Before: total 2.800 / paid 2.800 / outstanding 0 / **PAID**
- Save required edit reason (same as HALF)
- After UI: total 4.900 / paid 2.800 / balance 2.100 / status became balance-owing / Pending Payment
- After DB: total 4.900 / paid 2.800 / outstanding 2.100 / status **PARTIALLY_PAID** (was PAID)
- **No negative balance.** Paid amount preserved. Status correctly left PAID when total rose above paid.

Screens: `29_deep_FULL_before.png`, `30_deep_FULL_edit.png`, `31_deep_FULL_after.png`

### Deep-pass findings

1. **Business Blazer not searchable** on Edit Order — used Bathrobe/Robe instead.
2. **Edit reason required** when changing items on orders that already have payment (HALF + FULL) — good control.
3. **Order total increased** confirmation after save — good UX.
4. Increasing total does **not** auto-collect more payment; outstanding grows; FULL correctly moves **PAID → PARTIALLY_PAID**.
5. `product_name` blank on some item rows in DB (display/integrity note).
6. Blank customer **Name** on details while phone/email and edit cart show customer — pre-existing display issue, not caused by these edits.
7. Validate demo money against **cloud** DB only (local has no order rows).

### Deep-pass sign-off

| Case | UI money | DB money | Status transition | Result |
|------|----------|----------|-------------------|--------|
| ZERO | Pass | Pass | stayed PENDING_COLLECTION | **PASS** |
| HALF | Pass | Pass | stayed PARTIALLY_PAID | **PASS** |
| FULL | Pass | Pass | PAID → PARTIALLY_PAID | **PASS** |
| Overall deep pass | | | | **PASS with findings** |

*Deep pass closed 23 Sep 2026 (Asia/Muscat).*


---

## Overpayment test — ORD-20260923-0003 remove item (2026-09-23)

**Question:** If edit removes an item so paid > new total, what happens to the overpayment?

**Setup before remove:** total 4.900 / paid 2.800 / outstanding 2.100 / PARTIALLY_PAID (2 items).

**Action:** Removed Business Blazer (2.800). Kept Bathrobe/Robe + Heavy Starch (2.100). Reason: `Overpayment integrity test - remove item`.

### Result — PASS with findings

| Layer | Total | Paid | Outstanding | Overpaid | Status |
|-------|-------|------|-------------|----------|--------|
| UI after | 2.100 | 2.800 | shows 0.700 as "balance" with **Overpaid** badge; payment label Paid | implied 0.700 | Overpaid / Paid |
| Cloud DB | 2.1000 | 2.8000 | 0.0000 | **0.7000** | **OVERPAID** |

- Cash payment row unchanged: COMPLETED 2.800.
- `org_order_refunds_dtl`: **0 rows**
- `org_order_credit_apps_dtl`: **0 rows**
- `org_fin_overpay_disp_dtl`: **0 rows**
- Order fields: refunded 0, customer credit issued 0, credit applied 0.

**What the overpayment does:** It is **recorded** as `overpaid_amount = 0.700` and `payment_status = OVERPAID`. It is **not** auto-refunded, **not** auto-issued as customer credit, and **not** written to an overpay-disposition row. UI advises handling refund/credit from Payments manually.

### Findings / bugs

1. **Wrong dialog amount:** After save, dialog said total fell 4.900 → 2.100 and **"2.800 OMR is now owed back to the customer"** — should be **0.700** (paid − new total), not the removed line price / full paid amount.
2. **UI wording clash:** header shows balance **0.700** with Overpaid badge while Financial tab Outstanding = **0.000** and Payments balance = **-0.700**. Same money, three presentations.
3. **No automatic settlement** of overpayment (by design or gap — needs product decision).

Screens: `32_overpay_FULL_before.png` … `36_overpay_FULL_financial.png`


---

## Extended money cases (23 Sep 2026 ~03:00 Asia/Muscat)

**Goal:** Cover remaining high-value Order Edit money paths on the same three orders.  
**Rule:** Pause on hard errors; always compare **UI + cloud DB**; document full UI path so findings are reproducible.

### Current cloud baseline before Case 1 (this session)

| Order | Total | Paid | Outstanding | Overpaid | payment_status |
|-------|-------|------|-------------|----------|----------------|
| ORD-20260923-0001 ZERO | 4.900 | 0.000 | 4.900 | 0.000 | PENDING_COLLECTION |
| ORD-20260923-0002 HALF | 4.900 | 1.400 | 3.500 | 0.000 | PARTIALLY_PAID |
| ORD-20260923-0003 FULL | 2.100 | 2.800 | 0.000 | 0.700 | OVERPAID |

---

## Case 1 — HALF overpay (ORD-20260923-0002) — COMPLETE

### Intent
Prove overpayment is not only a FULL-order path: drop HALF total **below** the 1.400 already paid and check dialog math, status, refunds/credits.

### Full UI path (repro)
1. Open Full Order Details:  
   `https://cmx.cleanmatex.com/dashboard/orders/acfeb148-05fe-4f3b-82f2-f134fb920879/full`  
   (or **Orders** → search `ORD-20260923-0002` → open row → **Full** view).
2. Note header money: **Total / Paid Amount / Balance Due** and status badges.
3. Click **Edit** (URL `.../edit`).
4. Remove **Business Blazer** (2.800) and **Bathrobe/Robe** (with Heavy Starch) so the cart would be empty.
5. Empty cart blocked: *“Please add at least one item to the order.”*
6. Add cheapest catalog item found: **Standard Bra** @ **0.700 OMR**.
7. Click **Save Changes**.
8. Reason required → enter `Case1 HALF overpay - remove items below paid` → confirm.
9. Read confirmation dialog + success toast (capture exact owed-back wording).
10. Back on Full Details: note **Overpaid** badge, Paid checkmark, header balance.
11. Open **Financial** tab, then **Payments** tab; record Outstanding, Credits, Refunds, Payments balance, cash leg.

### Before (UI)
| Field | Value |
|-------|-------|
| Total | 4.900 OMR |
| Paid Amount | 1.400 OMR |
| Balance Due | 3.500 OMR |
| Badges | Processing, Normal, Pending Payment, Balance Owing, Preparation Pending |

### After (UI)
| Field | Value |
|-------|-------|
| Total | 0.700 OMR |
| Paid Amount | 1.400 OMR |
| Balance Due (header) | 0.700 OMR |
| Payment status | ✓ Paid |
| Overpaid badge | **Yes** |
| Payment method | CASH |

### Financial / Payments tabs (UI)
| Field | Value |
|-------|-------|
| Total | 0.700 |
| Paid | 1.400 |
| Credits | 0.000 |
| Outstanding | 0.000 |
| Credit applications | none |
| Refunds | none |
| Payments balance | **-0.700** |
| Cash leg | COMPLETED / REAL_PAYMENT / 1.400 OMR |

### Confirmation dialog (substance)
- Order total decreased from **4.900** to **0.700** OMR.
- Dialog claimed **4.200 OMR is now owed back to the customer** (process refund or credit from Payments).
- Change + reason recorded in edit history.
- Toast: Order updated successfully.

### Cloud DB after (verified)
| Field | Value |
|-------|-------|
| total_amount | 0.7000 |
| total_paid_amount | 1.4000 |
| outstanding_amount | 0.0000 |
| overpaid_amount | **0.7000** |
| payment_status | **OVERPAID** |
| Items | 1× WASH_AND_IRON @ 0.700 (Standard Bra; `product_name` blank in DB) |
| Refunds / credit apps / overpay disposition | **0 / 0 / 0** |

### Result — PASS with findings
HALF can reach OVERPAID the same way as FULL: `overpaid_amount = paid − total`, no auto refund/credit.

### Findings
1. **Wrong “owed back” amount (P0):** Dialog showed **4.200** (= Δ total 4.900→0.700). Correct customer overpay is **0.700** (= paid 1.400 − new total 0.700). Same bug class as earlier FULL dialog (quoted 2.800 instead of 0.700). Pattern: UI uses **total decrease** (or a line/paid figure), not `max(0, paid − new_total)`.
2. **Empty cart blocked** — good; must keep ≥1 item.
3. **UI balance clash:** header Balance Due 0.700 + Overpaid vs Financial Outstanding 0.000 vs Payments balance −0.700.
4. `product_name` blank on new item row in cloud DB.

### Screens (`GrokBot_Test_22_09_2026_01_SC`)
`37_case1_HALF_before.png` … `46_case1_HALF_extra2.png`

---

## Case 2 — Grow overpaid FULL (ORD-20260923-0003) — COMPLETE

### Intent
On already **OVERPAID** order (2.100 total / 2.800 paid / 0.700 over):
- **A)** add item so total rises but stays **under** paid → overpay shrinks.
- **B)** add more so total rises **above** paid → leave OVERPAID, show balance due; cash row stays 2.800.

### Full UI path (repro)
1. Open Full Order Details:  
   `https://cmx.cleanmatex.com/dashboard/orders/eab33e6e-09ff-4add-a327-a01983cb4bb5/full`  
   (Orders → search `ORD-20260923-0003` → **Full**).
2. Confirm header: Total 2.100 / Paid 2.800 / Balance Due 0.700 / **Overpaid**.
3. Click **Edit**.
4. **Step A:** Add **Polo Shirt (Dry Clean)** @ **0.600** (keep Bathrobe + Heavy Starch). New total **2.700**.
5. **Save Changes** → reason dialog (required because payment exists):
   - Title: *Reason required*
   - Body: *This order already has payment recorded. Editing its items changes the total — please enter a reason before saving.*
   - Field: *Reason for this change \** (min 5 characters)
   - Buttons: Cancel / **Save with reason**
6. Enter `Case2A grow overpaid - shrink overpay` → Save with reason.
7. On Full Details + **Financial** + **Payments**: note Overpaid still on, Outstanding 0, Payments balance ≈ −0.100, cash still 2.800.
8. **Edit** again.
9. **Step B:** Add **Standard Bra** @ **0.700**. New total **3.400**.
10. Save with reason `Case2B grow overpaid - create balance due`.
11. Confirm Overpaid cleared; Balance Due / Balance Owing **0.600**; Financial Outstanding **0.600**; cash row still exactly **2.800**; no new payment row.

### Before (UI + DB)
| Field | Value |
|-------|-------|
| Total | 2.100 |
| Paid | 2.800 |
| Outstanding | 0.000 |
| Overpaid | 0.700 |
| Status | OVERPAID |
| Items | Bathrobe/Robe + Heavy Starch ≈ 2.100 |

### After Step A (UI)
| Field | Value |
|-------|-------|
| Total | 2.700 |
| Paid | 2.800 |
| Financial Outstanding | 0.000 |
| Overpaid badge | still present |
| Payments balance | −0.100 |
| Cash payment row | 2.800 unchanged |

### After Step B (UI + cloud DB verified)
| Field | UI | Cloud DB |
|-------|----|----------|
| Total | 3.400 | 3.4000 |
| Paid | 2.800 | 2.8000 |
| Outstanding | 0.600 | 0.6000 |
| Overpaid | cleared | 0.0000 |
| payment_status | Balance Owing / partial | **PARTIALLY_PAID** |
| Cash row | 2.800 only | unchanged (no new payment) |

### Items after B (DB)
| Service | Qty | Unit | Line |
|---------|-----|------|------|
| WASH_AND_IRON (Bathrobe+starch) | 1 | 1.800 | 2.100 |
| DRY_CLEAN (Polo) | 1 | 0.600 | 0.600 |
| WASH_AND_IRON (Standard Bra) | 1 | 0.700 | 0.700 |

### Result — PASS
Growing an overpaid order correctly shrinks overpay then flips to balance due without inventing payments. Cash leg stays untouched.

### Findings
1. Reason dialog on paid orders is clear and enforced (good).
2. No bogus “owed back” dialog on **increase** path (good contrast to decrease/overpay bug in Case 1 / earlier FULL remove).
3. Payments balance sign tracks overpay (−0.100 after A) then flips with outstanding after B.
4. `product_name` still blank in DB for lines.

### Screens
`47_case2_FULL_before.png` … `55_case2_extra.png`

---

## Case 3 — Settle overpay via Payments (ORD-20260923-0002) — COMPLETE (PARTIAL / P0 money inconsistency)

### Intent
Clear the **0.700 OVERPAID** on HALF by refund and/or customer credit from Payments, then confirm cloud `overpaid_amount` → 0.

### Full UI path (create + approve)
1. Open Full Order Details for `ORD-20260923-0002`.
2. **Financial** tab — confirm Total 0.700 / Paid 1.400 / Credits 0 / Outstanding 0 / Overpaid showing.
3. **Payments** tab (also reachable via **Back to Order → Payments & Credits**).
4. Click **Refund…**
5. Refund dialog:
   - Source: existing **CASH** payment (1.400 refundable)
   - Amount: **0.700**
   - Destination: **Cash (record-only)**
   - Reason: **Overcharge**
   - No Advanced cash-drawer session required for this path
6. Submit → created **REF-000009** (**PENDING_APPROVAL**).
7. Approve path (tester): **Internal Finance → Refunds**  
   `https://cmx.cleanmatex.com/dashboard/internal_fin/refunds`  
   → open **REF-000009** → approve (dual-control / second user).
8. Re-check refunds list, Full Order Details header, **Financial**, **Payments & Credits**, and cloud DB.

### Before create (UI + DB)
| Field | Value |
|-------|-------|
| Total | 0.700 |
| Paid | 1.400 |
| Outstanding | 0.000 |
| Overpaid | 0.700 |
| payment_status | OVERPAID |

### After create (before approval)
| Field | Value |
|-------|-------|
| Header money | unchanged (still Overpaid 0.700) |
| Refund row | **REF-000009** / −0.700 / Cash / Real payment refund / **PENDING_APPROVAL** |
| Cloud `refund_status` | **PENDING_APPROVAL** |
| Cloud `reason_code` | OVERCHARGE |
| `approved_by` / `approved_at` / `processed_at` | null |
| AR Credits | 0 sources / 0.0000 available — **no Issue credit** control seen |

### After approval (UI) — ~04:25 Asia/Muscat
| Surface | Observation |
|---------|-------------|
| Internal Finance → Refunds | **REF-000009** **Processed**, **OMR 0.700**, Cash, Overcharge, linked to ORD-20260923-0002 (approver not shown on list) |
| Order header (main money strip) | Total **0.700** / Paid **1.400** / Credits **0.000** / Balance Due **0.000 (Settled)**; **OVERPAID** badge still present |
| Financial Details | Outstanding **0.000**; refund row **PROCESSED** **0.700** |
| Payments & Credits | Cash payment **1.400 COMPLETED/Verified**; refund **−0.700 PROCESSED**, source “Real payment refund”; no balance reopened |
| Full Order Details (alternate money wording) | Separately showed Balance Due **0.700** with Overpaid badge — **inconsistent** with main/Financial settled **0.000** |

### After approval (cloud DB) — `org_orders_mst` / `org_order_refunds_dtl`
| Field | Value |
|-------|-------|
| `total_amount` | 0.7000 |
| `total_paid_amount` | **1.4000** (unchanged gross) |
| `outstanding_amount` | 0.0000 |
| `overpaid_amount` | **0.7000** (still set) |
| `refunded_amount` / `real_payment_refunded_amount` | **0.7000** |
| `net_collected_amount` | **0.7000** (= total; economically settled) |
| `payment_status` | **OVERPAID** (not flipped to PAID) |
| Payment row (`org_order_payments_dtl`) | Single CASH **1.4000 COMPLETED** (not reduced) |
| REF-000009 | `refund_status` **PROCESSED**, `reason_code` OVERCHARGE, method CASH |
| REF-000009 `approved_at` | 2026-09-23 04:19:51.964+04 |
| REF-000009 `processed_at` | 2026-09-23 04:20:33.79+04 |

### Result — PARTIAL PASS (approval path works; money snapshot fails)
- **Pass:** Refund create + dual-control approval + process to **PROCESSED**; refund amount/reason/method correct; `net_collected` equals total.
- **Fail / P0:** After processed refund for overcharge, order still **`OVERPAID` / `overpaid_amount=0.700`** in DB and UI badge; `total_paid_amount` stays at gross 1.400. UI also disagrees with itself (Financial “Settled 0.000” vs Full Details Balance Due **0.700** + Overpaid).

### Findings
1. **Dual-control on refunds (expected):** create alone does not settle; approval required — confirmed.
2. **P0 — overpay not cleared after PROCESSED refund:** snapshot fields `overpaid_amount` / `payment_status` / UI OVERPAID badge should clear when `net_collected == total` (or when refund covers overpay). Same class of money-display bugs as Case 1 owed-back dialog.
3. **P1 — contradictory Balance Due wording** on Full Details vs header/Financial after refund.
4. **No Issue-credit path** exercised (0 available credit) — still open if product supports credit settle for overpay.
5. Cash refund destination “record-only” without drawer session may be intentional for demo.

### Screens
Create/pending: `56_case3_HALF_before_header.png` … `64_case3_refunds_approval_list.png`  
After approval: `71_case3_refunds_REF000009_processed.png` … `74_case3_payments_after_approve.png`

---

## Case 4 — Pieces-only / preference-only edit (ORD-20260923-0001) — COMPLETE

### Intent
On unpaid ZERO order: change **quantity/pieces** and **priced preference** without adding/removing catalog products; confirm money and whether edit-reason is required.

### Full UI path (repro)
1. Open Full Details: Orders → `ORD-20260923-0001` → Full  
   (`…/dashboard/orders/5a19407f-076e-4669-881f-f11be2b849b7/full`).
2. Note header: Total **4.900** / Paid **0** / Outstanding **4.900**.
3. Click **Edit**.
4. **Step A — quantity:** Order Items → Business Blazer → **Increase quantity** 1→2  
   (this is whole-line quantity / piece count — there is **no separate “pieces” editor** beyond line qty).
5. **Save**. No reason dialog on this unpaid order.
6. Confirm total **7.700** (4.900 + 2.800).
7. **Edit** again.
8. **Step B — preference:** Edit Items Preferences → Bathrobe/Robe → remove **Heavy Starch** (+0.300).
9. **Save**. Again no reason dialog.
10. Confirm total **7.400** (7.700 − 0.300). Paid 0 / Outstanding 7.400.

### Before
| Layer | Total | Paid | Outstanding | Notes |
|-------|-------|------|-------------|-------|
| UI | 4.900 | 0 | 4.900 | Blazer 2.800 + Bathrobe+Heavy Starch 2.100 |
| Cloud | 4.900 | 0 | 4.900 | PENDING_COLLECTION |

### After Step A (qty 1→2 on Blazer)
| Layer | Total | Notes |
|-------|-------|-------|
| UI | 7.700 | +2.800 for second Blazer unit |

### After Step B (remove Heavy Starch) — final UI + cloud DB
| Field | UI | Cloud DB |
|-------|----|----------|
| Total | 7.400 | 7.4000 |
| Paid | 0 | 0.0000 |
| Outstanding | 7.400 | 7.4000 |
| Overpaid | — | 0.0000 |
| payment_status | unpaid / pending collection | **PENDING_COLLECTION** |

### Items after B (DB)
| Service | Qty | Unit | Line |
|---------|-----|------|------|
| DRY_CLEAN (Blazer) | **2** | 2.800 | **5.600** |
| WASH_AND_IRON (Bathrobe) | 1 | 1.800 | **1.800** (starch charge gone) |

### Result — PASS
Quantity and preference edits recalculate money correctly. No catalog lines added/removed. No payments taken.

### Findings
1. **No edit-reason on unpaid orders** — contrast with paid HALF/FULL which require reason. Document as intentional or gap.
2. **No separate piece editor** — “pieces” = line quantity control (“Increase quantity”).
3. Preference remove path is clear (**Edit Items Preferences** → line → remove Heavy Starch).
4. `product_name` still blank in DB lines.

### Screens
`65_case4_ZERO_before.png` … `70_case4_extra.png`

---

## Extended-cases rollup (Cases 1–4)

| Case | Order | Result | Notes |
|------|-------|--------|-------|
| 1 HALF overpay | ORD-…-0002 | **PASS w/ P0** | Dialog owed-back used Δtotal (4.200) not paid−total (0.700) |
| 2 Grow overpaid FULL | ORD-…-0003 | **PASS** | Overpay shrinks then flips to PARTIALLY_PAID; cash row untouched |
| 3 Settle overpay | ORD-…-0002 | **PARTIAL / P0** | REF-000009 **PROCESSED**; overpay badge/DB still OVERPAID; UI Balance Due inconsistent |
| 4 Qty + preference | ORD-…-0001 | **PASS** | Unpaid: no reason; money correct |

*Last updated 23 Sep 2026 ~04:25 Asia/Muscat.*


---

## Suggested fix for Case 3 P0 (overpay not cleared after PROCESSED refund)

**Target local tree:** `F:\jhapp\cleanmatex`  
**Repo remote:** `https://github.com/GhAli21/cleanmatex`

### How to run this (pick one)
1. **Local private Cursor worker** on JHNHPLP: `agent worker start --name JHNHPLP` (or your preferred name), then ask the agent to apply the prompt below against `F:\jhapp\cleanmatex`.
2. **Cursor cloud agent** on `GhAli21/cleanmatex` with the prompt below → open PR → pull/merge into `F:\jhapp\cleanmatex`.

### Exact prompt (copy-paste)

```
Fix a money-snapshot bug in CleanMateX after an overcharge refund is approved/processed.

Work in the local codebase at F:\jhapp\cleanmatex (or the checked-out cleanmatex repo).

## Symptoms (reproduced on demo cmx.cleanmatex.com + cloud DB)
Order ORD-20260923-0002 (HALF pay):
- Order total 0.700, paid cash 1.400 → OVERPAID 0.700 after Order Edit reduced items.
- Created refund REF-000009 for 0.700 (Cash, reason Overcharge) via order Payments → Refund…
- After second-user approval, refund status became PROCESSED.

**What is wrong after PROCESSED:**
- Cloud org_orders_mst: refunded_amount / real_payment_refunded_amount = 0.700 and net_collected_amount = 0.700 (correct economically), BUT overpaid_amount still 0.700, payment_status still OVERPAID, total_paid_amount still gross 1.400.
- Payment row still shows CASH 1.400 COMPLETED (unchanged).
- UI: OVERPAID badge remains; Financial/Payments show Balance Due 0.000 Settled and refund −0.700 PROCESSED; Full Order Details inconsistently showed Balance Due 0.700 with Overpaid badge.

## Related finding from same test suite (same class of bug)
On Order Edit save that creates overpay, the confirm dialog showed "owed back" = Δtotal instead of max(0, paid − new_total). Fix that only if it shares the same money-recalc helper; otherwise prefer the refund-settlement snapshot bug as primary.

## Expected outcome
When an overcharge/overpay refund is PROCESSED and net collected equals (or is ≤) order total:
- overpaid_amount → 0
- payment_status → appropriate non-OVERPAID status (e.g. PAID / FULLY_PAID — match existing enum conventions in the codebase)
- UI OVERPAID badge and Balance Due wording consistent with Financial / net collected
- Do not invent extra payment rows unless the product already does that; prefer correcting the order financial snapshot recalculation on refund process/approve.

## Constraints
- Investigate first; do not assume a single file. Look for refund approve/process handlers and any shared order money recalculation (payment_status, overpaid_amount, outstanding_amount, net_collected).
- Preserve dual-control: PENDING_APPROVAL refunds must still not settle money until PROCESSED.
- Add or update unit/integration tests around snapshot recalc if the repo has a pattern for them.
- Prefer a clear commit message / PR description of root cause + how to verify.

## Done when
Order money recalculates correctly after PROCESSED overpay refund, with tests or a clear manual verify note matching the scenario above. On ORD-20260923-0002-style data: after PROCESSED 0.700 overcharge refund, overpaid_amount=0, payment_status not OVERPAID, UI badge cleared, Balance Due consistent across header / Financial / Full Details.
```

*Prompt added 23 Sep 2026 ~10:52 Asia/Muscat.*
