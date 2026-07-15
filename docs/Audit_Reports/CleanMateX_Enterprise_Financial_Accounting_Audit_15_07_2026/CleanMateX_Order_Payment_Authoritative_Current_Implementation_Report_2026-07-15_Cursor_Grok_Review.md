# Review: Order Payment Authoritative Current Implementation Report (2026-07-15)

**Reviewer:** Cursor Grok · **Date:** 2026-07-15  
**Subject:** `CleanMateX_Order_Payment_Authoritative_Current_Implementation_Report_2026-07-15.md`  
**Scope:** Critical/High findings (C1–C3, H1–H6) and unsupported / overstated `IMPLEMENTED` statuses  
**Method:** Spot-check of cited runtime paths in `web-admin/` (no code changes)

---

## Review verdict

Critical/High findings **C1–C3 and H1–H6 are largely correct and code-backed**. The main problems are a few **overstated `IMPLEMENTED` statuses**, plus two **report accuracy nits** (ERP caller list, recon check count).

Checkout core (calc → submit → BVM → snapshot) authorities and formulas remain well supported. §51 overall stance (checkout `READY_WITH_CONSTRAINTS`; refunds / E2E order-to-cash `NOT_READY`) holds.

---

## Critical findings — validation

| ID | Report claim | Verdict | Evidence |
|---|---|---|---|
| **C1** | Cash refund leaves `outstanding=0` / `PAID` | **Supported** | `initiateRefund` create (`order-refund.service.ts:311–335`) never writes `refund_source_type` / `reopens_due_amount`. Snapshot outstanding adds only `reopens_due` (`order-financial-write.service.ts:779–786`). Header `PAID` uses gross `paid+credits` vs outstanding (`:450–463`), not net of refunds. |
| **C2** | Recon outstanding ≠ snapshot | **Supported** | Recon: `total − COMPLETED − activeCredits + PROCESSED refunds` (`order-checks.ts:198–200`). Snapshot: lifecycle paid + `APPLIED` credits + `reopens_due`. |
| **C3** | GC sale / wallet top-up: no payment / voucher / drawer | **Supported (wording tweak)** | `sellGiftCard` writes mst + `org_gift_card_txn_dtl` SALE only (`gift-card-service.ts:338–382`) — no BVM/drawer/payment. Wallet top-up route → `topUpWalletTx` balance + wallet txn only (`wallet/top-up/route.ts:36–43`, `stored-value.service.ts:42–89`). **Not** “zero ledger facts”: GC SALE / wallet TOP_UP exist; cash/BVM/GL capture is missing. Report’s UNVERIFIED note about SALE ledger is outdated — SALE **is** written. |

**C1 nuance (report slightly incomplete):** `classifyRefunds` heuristic still classifies CASH/ORIGINAL as real-payment refund for `netCollectedAmount` (`order-financial-write.service.ts:215–228`), but that does **not** reopen due or flip `PAID`. Core risk stands.

---

## High findings — validation

| ID | Claim | Verdict |
|---|---|---|
| **H1** | Later collection bypasses BVM; trips voucher-link recon | **Supported** — `collectPaymentTx` creates payments with no voucher (`order-settlement.service.ts:829+`, `voucherId: null` at `:939`); recon BLOCKER `ORDER_PAYMENT_LINK_EXISTS` (`order-checks.ts:301–347`). |
| **H2** | ERP payment/refund/GC dispatchers unwired | **Supported** — production callers: invoice (`ar-invoice.service.ts:1663`), expense (`erp-lite-expenses.service.ts:244`), petty cash (`:412`). No callers for payment/refund/gift-card. |
| **H3** | Tax-inclusive inconsistent | **Supported** — `calculateOrderTotals` has no `TAX_INCLUSIVE` branch; snapshot uses `taxAddend=0` for inclusive. |
| **H4** | Voucher reverse ≠ operational unwind | **Supported** — reverse lines `wiring_status: 'NOT_WIRED'` (`voucher-reversal.service.ts:130`). |
| **H5** | Collect retry can duplicate payments | **Supported** — payment `create` has **no** `idempotency_key`; route key optional (`collect-payment/route.ts:20`); fallback UUID (`order-settlement.service.ts:640`). |
| **H6** | Financial outbox never consumed | **Supported — and stronger than stated** — `claimBatch` / order-history-consumer have **no production callers** (tests + comments only). |

---

## Unsupported / overstated `IMPLEMENTED` statuses

### 1. Loyalty earn on settle — overclaimed

§19: `Loyalty earn on settle | IMPLEMENTED (queueEarnPoints)`

**Actual:** `queueEarnPoints` only emits `LOYALTY_EARN` to the outbox (`loyalty.service.ts:141–144`). `processEarnPoints` has **no runtime caller**. With H6, earn never posts.

**Correct status:** `DISCONNECTED` (or at best `PARTIAL` — emit-only).

This also undercuts treating loyalty earn as part of settlement completeness in §51.

### 2. §12 ERP caller list — incomplete (report bug)

Says only invoice + petty cash. Code also calls `dispatchExpenseRecordedInTransaction` (`erp-lite-expenses.service.ts:244`). Does not invalidate H2; fix the prose.

### 3. Recon “34 checks” — off by one

`EXECUTED_CHECK_NAMES` length is **35** (`reconciliation.service.ts:73–117`). Confirmed by counting `RECONCILIATION_CHECK_NAMES.` entries in that array. Minor.

### 4. Soft overclaims (downgrade recommended)

| Status in report | Issue | Safer status |
|---|---|---|
| §6 “B2B statement / customer receipts \| IMPLEMENTED” | Bundles two domains; GL disconnected elsewhere | Split; receipts `IMPLEMENTED`, B2B `IMPLEMENTED_WITH_CONSTRAINTS` (GL gap) |
| §8 / §16 “Refund … IMPLEMENTED” (workflow / idempotency) | True for request/approve/keys; easy to read as end-to-end ready | Keep only with explicit “controls only”; end-to-end already correctly `NOT_READY` |
| §17 Cash drawer “FOUNDATION: IMPLEMENTED” | OK if constrained; close aggregate unfiltered (`cash-drawer.service.ts:1428`) already noted | Keep `IMPLEMENTED_WITH_CONSTRAINTS` only |
| C3 “no operational or accounting record” | Ledger sale/top-up rows exist | “No tender / BVM / drawer / GL capture” |

No other high-impact false `IMPLEMENTED` found on the checkout core (calc → submit → BVM → snapshot). Those remain well supported.

---

## What holds as stated

- Canonical authorities (§3) and commercial formulas (§4–5)
- Refund reopen gap, recon drift, collect without BVM, ERP payment disconnect
- Tax-inclusive preview gap, voucher reverse gap, collect idempotency gap
- Outbox consumer gap (and loyalty earn as a concrete victim)
- §51 overall: checkout `READY_WITH_CONSTRAINTS`; refunds / E2E order-to-cash `NOT_READY`

---

## Suggested report edits

1. Downgrade **loyalty earn** from `IMPLEMENTED` → `DISCONNECTED`; link to H6/B7.  
2. Tighten **C3** wording; mark SALE ledger as verified.  
3. Fix §12 ERP callers to include expense.  
4. Fix recon check count 34 → 35.  
5. Optionally elevate loyalty-earn disconnect into §21 as **H7** (symptom of H6).

---

## Evidence index (review-only)

| Path | Used for |
|------|----------|
| `web-admin/lib/services/order-refund.service.ts` | C1 — no lineage/reopen columns |
| `web-admin/lib/services/order-financial-write.service.ts` | C1/C2 — outstanding, status, `classifyRefunds` |
| `web-admin/lib/services/reconciliation/order-checks.ts` | C2, H1 — outstanding formula, voucher-link |
| `web-admin/lib/services/gift-card-service.ts` | C3 — SALE ledger, no payment/BVM |
| `web-admin/lib/services/stored-value.service.ts` | C3 — wallet top-up |
| `web-admin/app/api/v1/customers/[id]/wallet/top-up/route.ts` | C3 — top-up entry |
| `web-admin/lib/services/order-settlement.service.ts` | H1/H5 — collect path, no payment idempotency |
| `web-admin/app/api/v1/orders/[id]/collect-payment/route.ts` | H5 — optional key |
| `web-admin/lib/services/erp-lite-auto-post.service.ts` | H2 — dispatchers |
| `web-admin/lib/services/erp-lite-expenses.service.ts` | H2 + §12 nit — expense/petty cash callers |
| `web-admin/lib/services/ar-invoice.service.ts` | H2 — invoice caller |
| `web-admin/lib/services/order-calculation.service.ts` | H3 — no TAX_INCLUSIVE branch |
| `web-admin/lib/services/voucher-reversal.service.ts` | H4 — `NOT_WIRED` |
| `web-admin/lib/services/outbox.service.ts` | H6 — `claimBatch` |
| `web-admin/lib/services/order-history-consumer.service.ts` | H6 — no production caller |
| `web-admin/lib/services/loyalty.service.ts` | Overclaim — `queueEarnPoints` emit-only |
| `web-admin/lib/services/reconciliation.service.ts` | Nit — 35 executed checks |
| `web-admin/lib/services/cash-drawer.service.ts` | Soft overclaim — close aggregate filter |
