# BVM — Brief Test Guide

**Date:** 2026-05-20
**Purpose:** Manual QA for Business Voucher Module. Run these flows with Claude present.

---

## Before You Start

1. Start the dev server: `cd web-admin && npm run dev`
2. Log in as **admin** (or tenant_admin) at `http://localhost:3000`
3. Navigate to **Internal Finance → Business Vouchers** — now shows the BVM list
4. Click **New Voucher** — opens the BVM create form (type selector, direction, party, description)
5. After creating, you land on the voucher detail page — add lines and post from there
6. Open **Browser DevTools → Console** for API-level flows (add lines, post, cancel, reverse)

---

## Flow 1 — Create a RECEIPT_VOUCHER and Post It

### Step 1 — Create voucher header (UI Form)

1. Go to **Internal Finance → Business Vouchers** → click **New Voucher**
2. Select type: **Receipt Voucher**
3. Direction auto-sets to **In**
4. Party Type: **Customer**, Party Name: `Test Customer`
5. Description: `Test receipt voucher`
6. Click **Create** — you are redirected to the voucher detail page
7. Copy the voucher ID from the URL: `/dashboard/internal_fin/vouchers/{VOUCHER_ID}`

**Verify on the detail page:**
- [ ] Status badge shows **DRAFT**
- [ ] Voucher No is generated (e.g. `RV-2026-000001`)
- [ ] **Post Voucher** and **Cancel Voucher** buttons are visible

---

### Step 2 — Add an ORDER_PAYMENT line

```javascript
const VOUCHER_ID = '319ba301-a8a2-49d5-a928-33ad67327dd7';

const r2 = await fetch(`/api/v1/finance/vouchers/${VOUCHER_ID}/lines`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    line_role: 'ORDER_PAYMENT',
    line_type: 'RECEIPT',
    target_type: 'ORDER',
    order_id: '00000000-0000-0000-0000-000000000001',
    payment_method_code: 'CASH',
    amount: 100,
    tendered_amount: 120
  })
});
console.log(await r2.json());
```

**Expected:** `{ success: true, data: { id: "...", line_no: 1 } }`

---

### Step 3 — Post the voucher

```javascript
const r3 = await fetch(`/api/v1/finance/vouchers/${VOUCHER_ID}/post`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ idempotency_key: 'test-post-001' })
});
console.log(await r3.json());
```

**Expected:** `{ success: true, data: { voucher_status: "POSTED", fromCache: false } }`

---

### Step 4 — Verify `posting_status` is still NOT_POSTED

```javascript
const r4 = await fetch(`/api/v1/finance/vouchers/${VOUCHER_ID}`);
const detail = await r4.json();
console.log('voucher_status:', detail.data.voucher_status);      // → POSTED
console.log('posting_status:', detail.data.posting_status);      // → NOT_POSTED ← CRITICAL
```

**Expected:** `voucher_status: "POSTED"` AND `posting_status: "NOT_POSTED"`

---

### Step 5 — View in UI

Navigate to: `http://localhost:3000/dashboard/internal_fin/vouchers/PASTE-ID-HERE`

**Verify:**
- [ ] Status badge shows **POSTED**
- [ ] All fields are read-only (no edit button)
- [ ] Lines tab shows the ORDER_PAYMENT line with `POSTED` status
- [ ] **Reverse** button is visible; **Post** button is gone

---

## Flow 2 — Idempotent Post (Same Key → Same Result)

Post the same voucher again with the same idempotency key:

```javascript
const r5 = await fetch(`/api/v1/finance/vouchers/${VOUCHER_ID}/post`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ idempotency_key: 'test-post-001' })
});
console.log(await r5.json());
```

**Expected:** `{ success: true, data: { fromCache: true } }` — no duplicate, same voucher_no

---

## Flow 3 — Cancel a DRAFT Voucher

### Step 1 — Create a new DRAFT voucher

```javascript
const rc = await fetch('/api/v1/finance/vouchers', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    voucher_type: 'RECEIPT_VOUCHER',
    direction: 'IN',
    voucher_date: new Date().toISOString().split('T')[0],
    total_amount: 50
  })
});
const draftData = await rc.json();
const DRAFT_ID = draftData.data.id;
console.log('Draft ID:', DRAFT_ID);
```

### Step 2 — Cancel it

```javascript
const rcancel = await fetch(`/api/v1/finance/vouchers/${DRAFT_ID}/cancel`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ reason: 'Test cancellation' })
});
console.log(await rcancel.json());
```

**Expected:** `{ success: true, data: { voucher_status: "CANCELLED" } }`

### Step 3 — Try to post the CANCELLED voucher (should fail)

```javascript
const rfail = await fetch(`/api/v1/finance/vouchers/${DRAFT_ID}/post`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({})
});
console.log(await rfail.json());
```

**Expected:** `{ success: false, error: "Invalid voucher status transition: CANCELLED → POSTED..." }`

---

## Flow 4 — Reverse a POSTED Voucher

Using `VOUCHER_ID` from Flow 1 (which is POSTED):

```javascript
const rrev = await fetch(`/api/v1/finance/vouchers/${VOUCHER_ID}/reverse`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ reason: 'Test reversal — data entry error' })
});
const revData = await rrev.json();
console.log(revData);
```

**Expected:** `{ success: true, data: { reversalVoucherId: "..." } }`

**Verify:**
- [ ] Original voucher: navigate to `/dashboard/internal_fin/vouchers/VOUCHER_ID` → status **REVERSED**
- [ ] Reversal voucher: navigate to `/dashboard/internal_fin/vouchers/REVERSAL_ID` → status **POSTED**, direction opposite

---

## Flow 5 — Cashier Role Restriction

### Step 1 — Log in as a cashier user (or switch role)

If you have a cashier user, log in as them. Alternatively, test the service-level restriction directly:

```javascript
// Try to create a PAYMENT_VOUCHER as a cashier — blocked at service layer
const rblock = await fetch('/api/v1/finance/vouchers', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    voucher_type: 'PAYMENT_VOUCHER',
    direction: 'OUT',
    voucher_date: new Date().toISOString().split('T')[0],
    total_amount: 50
  })
});
console.log(await rblock.json());
```

**Expected (when logged in as cashier):** `{ success: false, error: "Role 'cashier' is not permitted to create vouchers of type 'PAYMENT_VOUCHER'..." }`

**Expected (when logged in as admin):** Creates successfully (cashier restriction is role-based)

---

## Flow 6 — Validation Checks

### BANK_TRANSFER without bank_reference

```javascript
const rv = await fetch('/api/v1/finance/vouchers', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ voucher_type: 'RECEIPT_VOUCHER', direction: 'IN', total_amount: 100, voucher_date: new Date().toISOString().split('T')[0] })
});
const vdata = await rv.json();
const VID = vdata.data.id;

// Add line with BANK_TRANSFER but no bank_reference → should fail
const rvl = await fetch(`/api/v1/finance/vouchers/${VID}/lines`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    line_role: 'ORDER_PAYMENT',
    line_type: 'RECEIPT',
    target_type: 'ORDER',
    order_id: '00000000-0000-0000-0000-000000000001',
    payment_method_code: 'BANK_TRANSFER',
    amount: 100
    // bank_reference intentionally omitted
  })
});
console.log(await rvl.json());
```

**Expected:** `{ success: false, error: "bank_reference is required for BANK_TRANSFER..." }`

---

## Flow 7 — Lookup Endpoints

These should return data filtered by user role:

```javascript
// Voucher types (cashier sees fewer options)
const rtypes = await fetch('/api/v1/finance/vouchers/lookups/types');
console.log('Types:', (await rtypes.json()).data?.map(t => t.code));

// Line roles
const rroles = await fetch('/api/v1/finance/vouchers/lookups/line-roles');
console.log('Line roles count:', (await rroles.json()).data?.length);

// Expense categories for this tenant
const rcat = await fetch('/api/v1/finance/vouchers/lookups/expense-categories');
console.log('Expense categories:', (await rcat.json()).data);
```

**Expected (admin):** All 5 voucher types, all 19 line roles

---

## Checklist Summary

| Flow | Test | Expected | Pass? |
|---|---|---|---|
| 1 | Create RECEIPT_VOUCHER + add line + post | `voucher_status=POSTED`, `posting_status=NOT_POSTED` | |
| 1 | View posted voucher in UI | Read-only, POSTED badge, Reverse button | |
| 2 | Post same key twice | `fromCache: true` on second call | |
| 3 | Cancel DRAFT | `voucher_status=CANCELLED` | |
| 3 | Post CANCELLED voucher | Error: invalid transition | |
| 4 | Reverse POSTED | Original=REVERSED, reversal voucher created | |
| 5 | Cashier creates PAYMENT_VOUCHER | Error: role not permitted | |
| 6 | BANK_TRANSFER without bank_reference | Error: bank_reference required | |
| 7 | Lookup endpoints return data | Types + line roles + categories | |

---

## Known Limitations (not bugs)

| Item | Status |
|---|---|
| `wiring_status` stays `NOT_WIRED` | Intentional — wiring service is a future phase |
| `posting_status` stays `NOT_POSTED` | Intentional — GL service is a future phase |
| Add-line UI on detail page | Lines must be added via API (detail page shows lines but add-line form is Phase W1) |
