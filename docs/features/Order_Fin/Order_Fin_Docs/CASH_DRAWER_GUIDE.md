# Cash Drawer Guide — Session Lifecycle, Variance, Force-Close

## Session Lifecycle

```
Drawer (org_cash_drawers_cf)
  │
  ├── openSession() → creates OPEN session
  │     - requires no existing OPEN session for drawer
  │     - records opening_balance
  │
  ├── recordMovement() → appends movement rows
  │     - CASH_IN: adds to expected balance
  │     - CASH_OUT: subtracts from expected balance
  │     - OPENING_BALANCE: initial count record
  │     - CLOSING_COUNT: pre-close count record (does not close session)
  │
  └── closeSession() → moves to CLOSED
        - fetches all CASH payments via org_order_payments_dtl in session window
        - computes: expectedBalance = openingBalance + cashIn - cashOut + cashPayments
        - computes: variance = closingBalance - expectedBalance
        - records variance; does NOT reject close even if variance != 0
```

## Variance Handling

A variance is recorded but does not block the session close. The cashier provides the physical count (`closingBalance`) and the system computes the expected amount from the payment audit trail.

Negative variance (short): drawer has less cash than expected — possible theft or error.
Positive variance (over): drawer has more cash — possible change error or unreported cash-in.

Variances exceeding the tenant's threshold are flagged by reconciliation check `CASH_DRAWER_VARIANCE`.

## Force-Close

If a session is stuck OPEN (e.g. cashier didn't close before shift end), a manager can force-close:

```typescript
closeSession(tenantId, drawerId, { closedBy, closingBalance, forceClose: true })
```

Force-closed sessions are marked `status='FORCE_CLOSED'` for audit trail visibility.

## Multiple Drawers

A branch can have multiple drawers (e.g. counter 1, counter 2). Each drawer is independent. Payments are linked to a session via `cash_drawer_session_id` on `org_order_payments_dtl` (only when `requiresCashDrawer=true` on the payment method).

## Permissions

- `billing.cash-drawers.manage` — required for open/close/movement operations
- Staff assigned to a drawer can only see their own session summary

## Integration with Settlement

When a CASH payment method has `requiresCashDrawer=true`, the settlement service links the payment row to the current open session:

```typescript
cash_drawer_session_id: opt.requiresCashDrawer ? (cashDrawerSessionId ?? null) : null,
```

The `cashDrawerSessionId` is passed by the client when creating an order with payment.
