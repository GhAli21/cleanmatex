# CleanMateX — Final Payment Modal Right Panel Specification

**Document Type:** UI/UX + Functional Implementation Specification  
**Module:** New Order Payment Modal / Order Finance / Settlement / POS Cashier UX  
**Version:** v1.0  
**Status:** Implementation Ready  
**Target:** AI coding assistant, frontend engineers, backend engineers, QA  

---

## 0. Purpose

Redesign the right-side payment summary panel so the cashier clearly understands:

```text
1. What the customer bought.
2. How the order is being settled now.
3. What remains or is overpaid.
4. What action is required before submit.
```

The panel must follow CleanMateX Order Fin v1.1 semantics:

```text
Order Value              = what customer bought.
Settlement               = how order is paid/credited now.
Receivable / Collection  = what remains due and how it is handled.
Tax Document             = fiscal/e-invoice document, separate from AR/payment.
Credit Application       = stored-value redemption such as gift card/wallet/customer credit.
Cash Drawer Impact       = operational cash custody impact for cash legs only.
```

The UI must not confuse:

```text
payment
credit application
discount
tax
AR invoice
tax document
cash drawer movement
```

---

## 1. Main UX Rule

Do **not** use one generic label like:

```text
Paid Amount
```

because settlement can include:

```text
cash
card
gateway
mobile payment
bank transfer
wallet
gift card
customer advance
customer credit
credit note
loyalty value
```

Use these labels instead:

```text
Total Settled Now
Real Payments Received
Credits / Stored Value Applied
Remaining Balance
Overpaid Amount
```

---

## 2. Right Panel Card Order

Implement cards in this exact order:

```text
1. Customer Card
2. Balance Result Card
3. Settlement Now Card
4. Payment Legs Card
5. Required Action Card
6. Balance Policy Card
7. Order Value Card
8. Discounts & Credits Card
9. Tax Breakdown Card
10. Tax Document Preview Card
11. Cash Drawer Impact Card
12. Currency / Rounding Card
13. Payment Notes Card
14. Posting Preview Card
15. Warnings Card
16. Debug / Calculation Trace Card — admin/support only
```

Conditional visibility:

```text
Required Action      → show only if action/blocker exists.
Balance Policy       → show only if remaining balance > 0.
Cash Drawer Impact   → show only if CASH leg exists.
Tax Document Preview → show if tax document policy is active.
Warnings             → show only if warnings exist.
Debug                → admin/support permission only.
```

---

## 3. Collapsible Card Behavior

Use **collapsible cards with smart defaults**, not free hide/unhide.

### 3.1 Non-collapsible critical cards

These must stay visible:

```text
Balance Result
Settlement Now
Required Action — when visible
```

They can support compact/expanded mode later, but must not fully collapse.

### 3.2 Collapsible cards

These can collapse/expand:

```text
Customer
Payment Legs
Balance Policy
Order Value
Discounts & Credits
Tax Breakdown
Tax Document Preview
Cash Drawer Impact
Currency / Rounding
Payment Notes
Posting Preview
Warnings
Debug
```

### 3.3 Collapsed card header must show summary

```text
Order Value                         OMR 2.461   ▼
Tax Breakdown                       OMR 0.161   ▼
Discounts & Credits                 OMR 0.500   ▼
```

### 3.4 Auto-expand rules

```text
Required Action       → always expanded when visible.
Warnings              → expanded when severity is high.
Cash Drawer Impact    → expanded when cash change/overpayment exists.
Tax Breakdown         → expanded when tax warning exists.
Discounts & Credits   → expanded when credit/discount mismatch exists.
Posting Preview       → expanded for complex settlement or admin/debug mode.
```

Do not persist collapse state in v1. Use smart defaults only.

---

## 4. Customer Card

Keep compact.

```text
Customer
JH Test dev21
9868****
```

Optional secondary details:

```text
Wallet Balance
Available Customer Credit
B2B / AR Account Status
Credit Limit
Current AR Balance
```

Rules:

```text
Do not make this card large.
Do not duplicate customer profile details.
Show credit/AR fields only if relevant to payment/AR decision.
Collapsed by default unless credit/AR warning exists.
```

---

## 5. Balance Result Card

This is the main decision card.

### 5.1 Display

```text
Balance Result

Order Total                  OMR 2.461
Total Settled Now            OMR 2.675
Remaining Balance            OMR 0.000
Overpaid Amount              OMR 0.214
Status                       Overpayment Requires Action
```

### 5.2 Status values

```text
Fully Settled
Remaining Balance
Partially Settled
Pending Payment
Authorized Payment
Overpayment Requires Action
Pay on Collection
AR Invoice Required
Blocked / Invalid
```

### 5.3 Calculation rules

```text
completedSettlement = completedRealPayments + appliedCredits
remainingBalance = max(orderTotal - completedSettlement, 0)
overpaidAmount = max(completedSettlement - orderTotal, 0)
```

Pending and authorized amounts must **not** reduce remaining balance.

### 5.4 Status resolution

```text
if blockers exist:
  status = Blocked / Invalid
else if overpaidAmount > 0:
  status = Overpayment Requires Action
else if pendingPaymentAmount > 0:
  status = Pending Payment
else if authorizedPaymentAmount > 0:
  status = Authorized Payment
else if remainingBalance = 0:
  status = Fully Settled
else if remainingBalance > 0 and selectedPolicy = PAY_ON_COLLECTION:
  status = Pay on Collection
else if remainingBalance > 0 and selectedPolicy = CREDIT_INVOICE:
  status = AR Invoice Required
else:
  status = Remaining Balance
```

---

## 6. Settlement Now Card

This card must split **real payments** from **credits/stored value**.

```text
Settlement Now

Real Payments Received
  Cash                         OMR 1.000
  Card                         OMR 1.675
  Gateway                      OMR 0.000

Credits / Stored Value Applied
  Gift Card                    OMR 0.300
  Wallet                       OMR 0.000
  Customer Credit              OMR 0.000

Total Settled Now              OMR 2.675
```

### 6.1 Real payments

Real payments include:

```text
CASH
CARD
BANK_TRANSFER
CHECK after clearance
MOBILE_PAYMENT
PAYMENT_GATEWAY after capture/settlement/completion
```

These increase `total_paid_amount`.

### 6.2 Credits / stored value

Credits include:

```text
GIFT_CARD
WALLET
CUSTOMER_ADVANCE
CUSTOMER_CREDIT
CREDIT_NOTE
LOYALTY_VALUE
MANUAL_CREDIT
```

These increase `total_credit_applied_amount`. They must **not** increase `total_paid_amount`.

### 6.3 Sign display

Use positive amount for credit summaries:

```text
Gift Card                    OMR 0.300
Credits Applied              OMR 0.300
```

If visually showing balance reduction, line-level negative is acceptable, but summary should stay semantically positive.

Avoid:

```text
Total credits applied       -OMR 0.300
```

---

## 7. Payment Legs Card

This card shows the source details behind Settlement Now.

```text
Payment Legs

#1 Card
Amount                       OMR 1.675
Status                       Completed
Reference                    0000 / AUTH-123

#2 Gift Card
Amount                       OMR 0.300
Status                       Applied
Reference                    ****143A
```

Each leg should show:

```text
leg number
type / method
amount
status
edit action
remove action
reference
source
cash drawer session if cash
gateway status if gateway
credit source if stored value
```

Leg categories:

```text
ORDER_PAYMENT
ORDER_CREDIT_APPLICATION
```

Do not mix them.

### 7.1 Real payment leg fields

```text
payment_method_code
amount
status
reference
gateway_transaction_id
card_last4
cash_drawer_session_id if cash
```

### 7.2 Credit application leg fields

```text
credit_application_type
amount
application_status
source_reference
masked_reference
available_balance_before
remaining_balance_after
```

### 7.3 Edit/remove rules

Allow editing/removing before submit. After submit:

```text
posted voucher lines are not edited silently
corrections require reversal / adjustment flow
```

---

## 8. Payment Leg Status Handling

The UI must not treat all payment legs as completed.

### 8.1 Completed real payments

```text
COMPLETED
CAPTURED
SETTLED
```

These reduce remaining balance.

### 8.2 Pending payments

```text
PENDING
PROCESSING
CAPTURE_PENDING
```

Visible but do not reduce remaining balance.

### 8.3 Authorized payments

```text
AUTHORIZED
```

Authorized card/payment does not reduce remaining balance until captured.

Required actions can show:

```text
Capture Now
Void Authorization
```

### 8.4 Failed attempts

```text
FAILED
REFUSED
CANCELLED
EXPIRED
VOIDED
REVERSED
```

Display as failed/audit only. They do not reduce remaining balance.

---

## 9. Credit Application Status Handling

Credits also need lifecycle treatment.

Status groups:

```text
APPLIED
PENDING
RESERVED
PROCESSING
FAILED
CANCELLED
REVERSED
EXPIRED
```

Rules:

```text
Only APPLIED credits reduce remaining balance.
PENDING / RESERVED / PROCESSING credits are visible but do not reduce balance yet.
FAILED / CANCELLED / EXPIRED do not reduce balance.
REVERSED credits may reopen due if not replaced.
```

Display:

```text
Credits / Stored Value

Applied
  Gift Card                    OMR 0.300

Reserved
  Wallet                       OMR 1.000

Failed
  Customer Credit              OMR 0.500
```

---

## 10. Required Action Card

Show only when cashier action is needed.

### 10.1 Overpayment

```text
Overpayment Handling

Overpaid Amount              OMR 0.214
Overpayment Source           Card
Recommended Action           Reduce Card Amount

Actions:
[ Reduce Payment Amount ]
[ Save as Customer Advance ]
[ Save as Customer Credit ]
```

If source is cash:

```text
Actions:
[ Return Cash Change ]
[ Save as Customer Advance ]
[ Save as Customer Credit ]
[ Reduce Cash Retained ]
```

### 10.2 Gateway pending

```text
Pending Payment

Gateway payment is not completed yet.
Outstanding is not reduced until confirmation.

Actions:
[ Wait for Confirmation ]
[ Submit as Pending Payment ]
[ Cancel Payment Attempt ]
```

### 10.3 Card authorized

```text
Authorized Payment

Amount is authorized but not captured.
It does not count as paid until captured.

Actions:
[ Capture Now ]
[ Void Authorization ]
```

### 10.4 Remaining balance

```text
Remaining Balance

Remaining Amount             OMR 1.140

Choose handling:
[ Pay Now ]
[ Pay on Collection ]
[ Create AR Invoice ]
```

### 10.5 Blocking reasons

If submit is blocked, show exact reasons:

```text
Cannot Submit

- Overpayment OMR 0.214 requires handling.
- Cash drawer session is required for cash leg.
- Gift card balance is insufficient.
- Card authorization is not captured.
```

---

## 11. Warnings Card

Separate warnings from blockers.

### Blocking errors

These prevent submit:

```text
overpayment unresolved
no cash drawer for cash leg
credit source insufficient
payment method disabled
AR credit limit exceeded
invalid payment amount
currency mismatch
```

### Non-blocking warnings

These allow submit but need attention:

```text
gateway still pending
customer has overdue AR balance
tax document will be generated later
cash drawer not required because no cash leg
manual discount near approval threshold
```

Display:

```text
Warnings

- Customer has overdue AR balance.
- Tax document will be generated on AR invoice issue.
```

---

## 12. Balance Policy Card

Show only when:

```text
remainingBalance > 0
```

Do not show when:

```text
remainingBalance = 0
overpaidAmount > 0
```

Options:

```text
Full Payment
Pay on Collection
Invoice Outstanding
```

### Full Payment

```text
User must add more settlement legs until remaining = 0.
```

### Pay on Collection

```text
pay_on_collection_amount = remaining balance
ar_receivable_amount = 0
no AR invoice
payment_status = PENDING_COLLECTION
```

Explanation:

```text
This amount will be collected at pickup/delivery. No AR invoice will be created.
```

### Invoice Outstanding

```text
ar_receivable_amount = remaining balance
create AR invoice
include in customer AR aging
```

Explanation:

```text
This amount will become a customer receivable and appear in AR aging.
```

---

## 13. AR / B2B Credit-Limit Validation

Show when user chooses:

```text
Invoice Outstanding
CREDIT_INVOICE
B2B account
```

Display:

```text
AR Eligibility

Customer Type               B2B
Credit Limit                OMR 100.000
Current AR Balance           OMR 85.000
New AR Amount                OMR 12.000
Available Limit              OMR 15.000
Status                       Allowed
```

Blocking case:

```text
AR invoice blocked: customer exceeds credit limit.
```

Permissions:

```text
ar_invoice:create
customer_credit_limit:override
```

If missing:

```text
Create AR Invoice
Disabled — missing permission: ar_invoice:create
```

---

## 14. Order Value Card

This card explains the sale value.

```text
Order Value

Subtotal                     OMR 2.500
Item / Piece Extras          OMR 0.000
Preference Extras            OMR 0.400
Service Charge               OMR 0.000
Delivery Charge              OMR 0.000
Express Charge               OMR 0.000
Other Charges                OMR 0.000
Gross Amount                 OMR 2.900
Commercial Discounts        -OMR 0.200
Net Before Tax               OMR 2.700
Tax                          OMR 0.161
Rounding                     OMR 0.000
Order Total                  OMR 2.861
```

Rules:

```text
Gift card must not appear as discount here.
Wallet must not appear as discount here.
Customer credit must not appear as discount here.
Commercial discounts reduce order total.
Credits reduce remaining balance.
```

---

## 15. Discounts & Credits Card

Separate commercial discounts from stored-value credits.

```text
Discounts & Credits

Commercial Discounts
  Manual Discount             OMR 0.200
  Promo Discount              OMR 0.000
  Rule Discount               OMR 0.000

Stored-Value Credits
  Gift Card                   OMR 0.300
  Wallet                      OMR 0.000
  Customer Credit             OMR 0.000
```

Rule:

```text
Commercial discounts reduce order total.
Stored-value credits reduce outstanding balance.
```

---

## 16. Tax Breakdown Card

### Tax-exclusive display

```text
Tax Breakdown

Tax Mode                     Tax Exclusive
Taxable Base                 OMR 2.300
VAT 5%                       OMR 0.115
Municipal Fee 2%             OMR 0.046
Total Tax                    OMR 0.161
```

### Tax-inclusive display

```text
Tax Breakdown

Tax Mode                     Tax Inclusive
Tax-Inclusive Price           OMR 2.461
Extracted Taxable Base        OMR 2.300
Extracted VAT                 OMR 0.115
Municipal Fee                 OMR 0.046
Order Total                   OMR 2.461
```

Rule:

```text
For TAX_INCLUSIVE, do not add tax again to total_amount.
Tax is extracted from the inclusive price.
```

---

## 17. Tax Document Preview Card

Show small preview. Do not overload.

Retail paid order:

```text
Tax Document

Expected Type                Simplified Tax Invoice
Trigger                      On Payment Confirmation
Status                       Pending
```

AR invoice order:

```text
Tax Document

Expected Type                Standard Tax Invoice
Trigger                      On AR Invoice Issue
Status                       Pending
```

Rules:

```text
AR invoice payment later does not normally create a new tax invoice.
Tax document belongs to taxable supply / invoice issue event.
Correction/refund after issue uses credit note or debit note.
```

---

## 18. Cash Drawer Impact Card

Show only if a CASH payment leg exists.

```text
Cash Drawer Impact

Cash Tendered                OMR 5.000
Cash Retained                OMR 2.461
Change Returned              OMR 2.539
Net Drawer In                OMR 2.461
Session                      Branch 2 Cash Drawer / SES-000005
```

Rules:

```text
total_paid_amount uses cash retained, not cash tendered.
Change Returned is valid only for cash overpayment.
If no cash leg exists, hide this card.
If payment method is card only, do not display bound cash drawer as required.
```

---

## 19. Overpayment Source Detection

The UI must know which leg caused overpayment.

Cash overpayment:

```text
Overpayment Source           Cash
Recommended Action           Return Cash Change
```

Card/gateway/bank overpayment:

```text
Overpayment Source           Card
Recommended Action           Reduce Payment Amount
```

Stored-value over-application:

```text
Overpayment Source           Gift Card
Recommended Action           Reduce Credit Application Amount
```

Allowed actions by source:

```text
Cash:
  Return Cash Change
  Save as Customer Advance
  Save as Customer Credit
  Reduce Cash Retained

Card/Gateway/Bank:
  Reduce Payment
  Void/Refund Excess if already captured
  Save as Customer Advance if policy allows
  Save as Customer Credit if policy allows

Stored Value:
  Reduce credit application
  Restore unused amount to source
```

---

## 20. Currency / Rounding Card

Single currency:

```text
Currency / Rounding

Currency                    OMR
Currency Decimals           3
Rounding                    OMR 0.000
```

Multi-currency:

```text
Currency / Rounding

Order Currency              AED
Base Currency               OMR
Exchange Rate               0.1047200000
Order Total                 AED 100.000
Base Total                  OMR 10.472
```

---

## 21. Payment Notes Card

Simple textarea at bottom.

```text
Payment Notes
Optional cashier note...
```

Rules:

```text
Do not block submit if empty.
Store notes with voucher/payment context.
```

---

## 22. Posting Preview Card

Use collapsed by default. Expand for admin/support or complex settlement.

Example:

```text
Posting Preview

Will Create:
- Order
- Receipt Voucher
- 1 order payment line: CARD OMR 1.675
- 1 credit application: GIFT_CARD OMR 0.300
- Cash drawer movement: none
- AR invoice: none
- Tax document: simplified invoice
```

For AR invoice:

```text
Will Create:
- Order
- Receipt Voucher
- AR Invoice OMR 1.140
- Tax document on AR invoice issue
```

For pay on collection:

```text
Will Create:
- Order
- Receipt Voucher for paid portion
- Pay-on-collection balance OMR 1.140
- No AR invoice
```

---

## 23. Debug / Calculation Trace Card

Admin/support only.

Permission:

```text
orders:financial_debug:view
```

Show:

```text
financial_calculation_snapshot
warning codes
pricing mode
currency exchange rate
engine version
calculation hash
trace id
```

Never show to normal cashier.

---

## 24. Submit Button Behavior

The submit button should reflect the financial result.

```text
Fully settled:
Submit — Fully Settled

Pay on collection:
Submit — Pay on Collection OMR 1.140

AR invoice:
Submit — Create AR Invoice OMR 1.140

Pending gateway:
Submit — Pending Payment

Overpayment unresolved:
Resolve Overpayment — OMR 0.214  (disabled)

Overpayment resolved as cash change:
Submit — Return Change OMR 0.214

Overpayment resolved as advance:
Submit — Save Advance OMR 0.214

Blocked:
Cannot Submit — Fix Required Issues
```

---

## 25. Permission-Driven Actions

Some buttons/options require permissions.

```text
Create AR Invoice                    ar_invoice:create
Override Credit Limit                customer_credit_limit:override
Save Overpayment as Customer Credit  customer_credit:create
Manual Discount                      order_discount:create_manual
Submit with Pending Gateway          order_payment:submit_pending
Submit with Warning Override         order_payment:override_warning
```

If user lacks permission:

```text
Show option disabled with reason.
```

Example:

```text
Create AR Invoice
Disabled — missing permission: ar_invoice:create
```

---

## 26. Accessibility and Keyboard Rules

Cashier speed matters.

Keyboard:

```text
Tab order follows visual order.
Enter confirms active amount field.
Esc closes modal only if no unsaved payment leg.
Numeric keypad must work.
Arrow keys can move between payment methods.
```

Accessibility:

```text
Collapsed cards keyboard accessible.
Amounts have text labels.
Color is not the only indicator.
Errors have text messages.
Screen reader labels for cards/buttons.
Focus moves to Required Action when submit is blocked.
```

---

## 27. Responsive Behavior

For smaller screens:

```text
Critical cards stay visible.
Non-critical cards collapse.
Only one optional detail card expanded at a time.
Submit footer remains sticky.
```

Critical cards:

```text
Balance Result
Settlement Now
Required Action if visible
```

---

## 28. Scenario Coverage

This design covers:

```text
1. Fully paid cash
2. Fully paid card
3. Fully paid gateway
4. Mixed cash + card
5. Mixed card + gift card
6. Full wallet settlement
7. Full gift card settlement
8. Customer credit application
9. Customer advance application
10. Credit note application
11. Partial payment + PAY_ON_COLLECTION
12. Partial payment + AR invoice
13. B2B credit invoice
14. Gateway pending
15. Gateway failed/refused
16. Card authorized but not captured
17. Cash overpayment with change
18. Card/gateway/bank overpayment
19. Overpayment saved as customer advance
20. Overpayment saved as customer credit
21. Stored-value over-application
22. Tax-exclusive order
23. Tax-inclusive order
24. Multi-tax order
25. Multi-currency order
26. Cash drawer required
27. Cash drawer not required
28. Tax document preview
29. AR credit-limit block
30. Permission-driven actions
```

---

## 29. Data Mapping Summary

Order value:

```text
orderTotal                 ← total_amount
subtotal                   ← subtotal_amount / items_base_amount
discounts                  ← total_discount_amount
tax                        ← total_tax_amount
rounding                   ← rounding_adjustment_amount
```

Settlement:

```text
realPaymentsCompleted      ← total_paid_amount
creditsApplied             ← total_credit_applied_amount
pendingPayments            ← pending_payment_amount
authorizedPayments         ← authorized_payment_amount
failedPayments             ← failed_payment_amount
remainingBalance           ← outstanding_amount preview
overpaidAmount             ← overpaid_amount preview
```

Receivable / collection:

```text
payOnCollectionAmount      ← pay_on_collection_amount
arReceivableAmount         ← ar_receivable_amount
arInvoiceId                ← ar_invoice_id
arInvoiceStatus            ← ar_invoice_status
```

Credit applications:

```text
credit type                ← credit_application_type
credit status              ← application_status
applied amount             ← applied_amount
```

Cash drawer:

```text
cash tendered              ← tendered_amount
cash retained              ← payment amount retained
change returned            ← change_returned_amount
cash drawer session        ← cash_drawer_session_id
```

---

## 30. Suggested Component Structure

Recommended files:

```text
web-admin/src/features/orders/ui/payment-modal/payment-summary-panel.tsx
web-admin/src/features/orders/ui/payment-modal/cards/customer-card.tsx
web-admin/src/features/orders/ui/payment-modal/cards/balance-result-card.tsx
web-admin/src/features/orders/ui/payment-modal/cards/settlement-now-card.tsx
web-admin/src/features/orders/ui/payment-modal/cards/payment-legs-card.tsx
web-admin/src/features/orders/ui/payment-modal/cards/required-action-card.tsx
web-admin/src/features/orders/ui/payment-modal/cards/balance-policy-card.tsx
web-admin/src/features/orders/ui/payment-modal/cards/order-value-card.tsx
web-admin/src/features/orders/ui/payment-modal/cards/discounts-credits-card.tsx
web-admin/src/features/orders/ui/payment-modal/cards/tax-breakdown-card.tsx
web-admin/src/features/orders/ui/payment-modal/cards/tax-document-preview-card.tsx
web-admin/src/features/orders/ui/payment-modal/cards/cash-drawer-impact-card.tsx
web-admin/src/features/orders/ui/payment-modal/cards/currency-rounding-card.tsx
web-admin/src/features/orders/ui/payment-modal/cards/payment-notes-card.tsx
web-admin/src/features/orders/ui/payment-modal/cards/posting-preview-card.tsx
web-admin/src/features/orders/ui/payment-modal/cards/warnings-card.tsx
web-admin/src/features/orders/ui/payment-modal/cards/debug-calculation-trace-card.tsx
```

Reusable helper:

```text
web-admin/src/features/orders/ui/payment-modal/components/collapsible-summary-card.tsx
```

---

## 31. Suggested View Model

Use a single calculated view model so UI does not recalculate business logic independently.

```ts
export type MoneyValue = {
  amount: string;
  currencyCode: string;
  formatted: string;
};

export type PaymentActionView = {
  code: string;
  label: string;
  disabled?: boolean;
  disabledReason?: string;
  permission?: string;
};

export type PaymentLegView = {
  kind: 'ORDER_PAYMENT';
  methodCode: string;
  amount: MoneyValue;
  status: string;
  reference?: string;
  gatewayTransactionId?: string;
  cardLast4?: string;
  cashDrawerSessionId?: string;
};

export type CreditApplicationLegView = {
  kind: 'ORDER_CREDIT_APPLICATION';
  creditApplicationType: string;
  amount: MoneyValue;
  applicationStatus: string;
  sourceReference?: string;
  maskedReference?: string;
  availableBalanceBefore?: MoneyValue;
  remainingBalanceAfter?: MoneyValue;
};

export type PaymentModalSummaryViewModel = {
  customer: {
    id: string;
    displayName: string;
    mobileMasked?: string;
    walletBalance?: MoneyValue;
    currentArBalance?: MoneyValue;
    creditLimit?: MoneyValue;
    availableCreditLimit?: MoneyValue;
    warnings: string[];
  };

  balance: {
    orderTotal: MoneyValue;
    totalSettledNow: MoneyValue;
    completedRealPayments: MoneyValue;
    appliedCredits: MoneyValue;
    pendingPayments: MoneyValue;
    authorizedPayments: MoneyValue;
    failedPayments: MoneyValue;
    remainingBalance: MoneyValue;
    overpaidAmount: MoneyValue;
    status:
      | 'FULLY_SETTLED'
      | 'REMAINING_BALANCE'
      | 'PARTIALLY_SETTLED'
      | 'PENDING_PAYMENT'
      | 'AUTHORIZED_PAYMENT'
      | 'OVERPAYMENT_REQUIRES_ACTION'
      | 'PAY_ON_COLLECTION'
      | 'AR_INVOICE_REQUIRED'
      | 'BLOCKED_INVALID';
  };

  settlement: {
    realPayments: PaymentLegView[];
    credits: CreditApplicationLegView[];
    totalSettledNow: MoneyValue;
  };

  paymentLegs: Array<PaymentLegView | CreditApplicationLegView>;

  requiredAction?: {
    type:
      | 'OVERPAYMENT'
      | 'PENDING_PAYMENT'
      | 'AUTHORIZED_PAYMENT'
      | 'REMAINING_BALANCE'
      | 'BLOCKED';
    title: string;
    message: string;
    recommendedAction?: string;
    actions: PaymentActionView[];
    blockingReasons: string[];
  };

  balancePolicy?: {
    remainingAmount: MoneyValue;
    selectedPolicy?: 'FULL_PAYMENT' | 'PAY_ON_COLLECTION' | 'CREDIT_INVOICE';
    options: PaymentActionView[];
    explanation: string;
  };

  orderValue: {
    subtotal: MoneyValue;
    pieceExtras: MoneyValue;
    preferenceExtras: MoneyValue;
    serviceCharge: MoneyValue;
    deliveryCharge: MoneyValue;
    expressCharge: MoneyValue;
    otherCharges: MoneyValue;
    grossAmount: MoneyValue;
    commercialDiscounts: MoneyValue;
    netBeforeTax: MoneyValue;
    tax: MoneyValue;
    rounding: MoneyValue;
    orderTotal: MoneyValue;
  };

  discountsAndCredits: {
    commercialDiscounts: Array<{ label: string; amount: MoneyValue }>;
    storedValueCredits: Array<{ label: string; amount: MoneyValue; status: string }>;
  };

  taxBreakdown: {
    taxMode: 'TAX_EXCLUSIVE' | 'TAX_INCLUSIVE';
    taxableBase: MoneyValue;
    taxInclusivePrice?: MoneyValue;
    rows: Array<{ label: string; rate?: string; amount: MoneyValue }>;
    totalTax: MoneyValue;
  };

  taxDocumentPreview?: {
    expectedType: string;
    trigger: string;
    status: string;
  };

  cashDrawer?: {
    cashTendered: MoneyValue;
    cashRetained: MoneyValue;
    changeReturned: MoneyValue;
    netDrawerIn: MoneyValue;
    sessionLabel: string;
  };

  currency: {
    currencyCode: string;
    currencyDecimals: number;
    rounding: MoneyValue;
    baseCurrencyCode?: string;
    exchangeRate?: string;
    baseTotal?: MoneyValue;
  };

  postingPreview: {
    lines: string[];
  };

  warnings: Array<{
    severity: 'INFO' | 'WARNING' | 'ERROR';
    code: string;
    message: string;
    blocking: boolean;
  }>;

  debug?: {
    financialCalculationSnapshot?: unknown;
    engineVersion?: number;
    calculationHash?: string;
    traceId?: string;
  };
};
```

---

## 32. Final Implementation Instruction for AI Coding Assistant

```text
Redesign the New Order Payment Modal right-side panel.

Implement cards in this order:
1. Customer
2. Balance Result
3. Settlement Now
4. Payment Legs
5. Required Action
6. Balance Policy
7. Order Value
8. Discounts & Credits
9. Tax Breakdown
10. Tax Document Preview
11. Cash Drawer Impact
12. Currency / Rounding
13. Payment Notes
14. Posting Preview
15. Warnings
16. Debug / Calculation Trace

Rules:
- Never use “Paid Amount” for combined settlements.
- Use “Total Settled Now”.
- Split settlement into Real Payments Received and Credits / Stored Value Applied.
- Gift card, wallet, customer advance, credit note, customer credit, and loyalty value are credits, not payments and not discounts.
- Commercial discounts reduce order total.
- Credits reduce outstanding balance.
- Pending payments do not reduce remaining balance.
- Authorized payments do not reduce remaining balance until captured.
- Only APPLIED credits reduce remaining balance.
- Show Balance Policy only when remaining balance > 0.
- Show Overpayment Handling when settled amount exceeds order total.
- Show Change Returned only for cash overpayment.
- For card/gateway/bank overpayment, recommend reducing payment or saving as customer credit/advance.
- For stored-value over-application, recommend reducing credit application amount.
- Show Cash Drawer Impact only when a CASH leg exists.
- Submit button text must reflect the financial outcome.
- Disable submit if blockers exist.
- Show exact blocking reasons.
- Keep Balance Result, Settlement Now, and Required Action visible when critical.
- Optional cards are collapsible with smart defaults.
- Add keyboard/accessibility support.
- Add responsive behavior.
- Show admin-only Debug / Calculation Trace only with permission.
```

---

## 33. Final Decision

```text
This specification is implementation-ready.
```

It is financially accurate, cashier-friendly, scalable for future Order Fin v1.1 features, and safe for mixed settlement, AR, stored value, gateway, tax, cash drawer, and overpayment scenarios.
