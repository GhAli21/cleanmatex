# Reconciliation Guide — 7 Checks, Severity, Monitoring

## Overview

`runReconciliation(tenantId, { runDate, branchId? })` executes 7 checks against the tenant's financial data for the given date. Results are written to `org_reconciliation_runs_mst` (overall status) and `org_reconciliation_issues_dtl` (per-check detail).

## The 7 Checks

### 1. PAYMENT_TOTAL_MATCH
**What:** For each completed order in the date range, verify that `SUM(org_order_payments_dtl.amount) + SUM(org_order_credit_apps_dtl.applied_amount) = org_orders_mst.total_paid_amount`

**Severity if failed:** BLOCKER

**Trigger:** Mismatch indicates a missing payment row or a snapshot update that didn't write a payment detail row.

---

### 2. STORED_VALUE_LEDGER
**What:** For each wallet, verify `current balance = SUM(TOP_UP) - SUM(REDEMPTION) - SUM(EXPIRY)` from `org_wallet_txn_dtl`

**Severity if failed:** BLOCKER

**Trigger:** Adjustment outside the ledger pattern or direct balance update without a txn row.

---

### 3. GIFT_CARD_LEDGER
**What:** For each gift card, verify `available_amount = original_amount - SUM(REDEEM txn amounts)`

**Severity if failed:** BLOCKER

---

### 4. REFUND_APPROVED
**What:** Count refunds in `PENDING_APPROVAL` status older than 48 hours

**Severity if failed:** WARNING

**Trigger:** Manager forgot to approve or reject a refund request.

---

### 5. OUTBOX_STUCK
**What:** Count outbox events with status=PENDING or status=FAILED where `next_retry_at < NOW() - 1 hour`

**Severity if failed:** WARNING

**Trigger:** Outbox worker down or event bus unreachable.

---

### 6. CASH_DRAWER_VARIANCE
**What:** For each closed session in the date range, check `ABS(variance) > threshold` (threshold configured per tenant, default 5.000 OMR)

**Severity if failed:** WARNING

---

### 7. LOYALTY_LEDGER
**What:** For each loyalty account, verify `points_balance = lifetime_earned - lifetime_redeemed`

**Severity if failed:** BLOCKER

---

## Overall Status

- `PASSED` — all 7 checks pass
- `PARTIAL` — at least one WARNING but no BLOCKERs
- `FAILED` — at least one BLOCKER

## run_no Format

`REC-{YYYYMMDD}-{seq:03d}` — sequential per date per tenant.

## Monitoring Recommendations

- Run reconciliation daily (migration 0296 sets up a pg_cron job)
- Alert on FAILED runs via the outbox event `RECONCILIATION_FAILED`
- Review CASH_DRAWER_VARIANCE issues weekly
- STORED_VALUE_LEDGER BLOCKER: often indicates a direct DB update bypassing the service layer — investigate immediately

## Viewing Results

The reconciliation UI at `/dashboard/billing/reconciliation` lists all runs. Each run's detail page shows per-check status and affected entity counts.
