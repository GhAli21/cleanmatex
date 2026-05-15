# CleanMateX V1 Payment + Cash Drawer — Client/Tenant-Level Implementation Guide

## Scope
Tenant/client-level payment method configuration, branch overrides, terminals, cash drawers, cash drawer sessions, cash drawer movements, order payment rows, credit applications, and refunds.

## 1. Executive Summary

The tenant/client layer is responsible for configuring and operating payment methods.

Tenant/client owns:

```text
which payment methods are enabled
which branches support which payment methods
which terminals exist
which cash drawers exist
who opens/closes drawers
actual payment transactions
actual cash movements
refunds
credit applications
```

HQ only defines global vocabulary.

Client config references:

```text
sys_payment_type_cd
sys_payment_method_cd
sys_payment_status_cd
sys_payment_gateway_cd
sys_card_brand_cd
sys_cash_drawer_session_status_cd
sys_cash_drawer_movement_type_cd
```

---

## 2. Client-Level Table Inventory

```text
org_payment_methods_cf
org_branch_payment_methods_cf
org_payment_terminals_cf
org_cash_drawers_mst
org_cash_drawer_sessions_mst
org_cash_drawer_movements_dtl
org_order_payments_dtl
org_order_credit_applications_dtl
org_order_refunds_dtl
```

---

## 3. Core Separation Rules

### Real Payments
Stored in:

```text
org_order_payments_dtl
```

Examples:

```text
CASH
CARD
CHECK
BANK_TRANSFER
PAYMENT_GATEWAY
COD
```

### Stored-Value Applications
Stored in:

```text
org_order_credit_applications_dtl
```

Examples:

```text
GIFT_CARD
WALLET
CUSTOMER_CREDIT
CUSTOMER_ADVANCE
LOYALTY_CREDIT
```

Never store these as normal payment rows.

### Invoice / AR
Invoice is not a payment.

It uses:

```text
payment_type_code = CREDIT_INVOICE
invoice_ar_amount
org_invoices_mst
```

---

## 4. Tenant Config Table: org_payment_methods_cf

### Purpose
Defines which HQ payment methods are enabled for a tenant and how they behave.

### SQL

```sql
create table if not exists public.org_payment_methods_cf (
  id uuid primary key default gen_random_uuid(),

  tenant_org_id uuid not null references public.org_tenants_mst(id) on delete cascade,

  payment_method_code varchar(50) not null references public.sys_payment_method_cd(payment_method_code),
  gateway_code varchar(80) references public.sys_payment_gateway_cd(code),

  display_name varchar(250) not null,
  display_name2 varchar(250),
  description text,
  description2 text,

  payment_nature varchar(50) not null default 'REAL_PAYMENT',

  is_enabled boolean not null default true,

  allowed_in_pos boolean not null default true,
  allowed_in_customer_app boolean not null default false,
  allowed_in_staff_app boolean not null default true,
  allowed_in_admin_app boolean not null default true,

  allowed_for_pay_now boolean not null default true,
  allowed_for_pay_on_collection boolean not null default true,
  allowed_for_invoice_payment boolean not null default true,
  allowed_for_refund boolean not null default true,

  supports_partial_payment boolean not null default true,
  supports_overpayment boolean not null default false,
  supports_change_return boolean not null default false,

  requires_reference boolean not null default false,
  requires_approval boolean not null default false,

  min_amount numeric(19,4),
  max_amount numeric(19,4),
  currency_code char(3),

  fee_type varchar(30) not null default 'NONE',
  fee_amount numeric(19,4) not null default 0,
  fee_rate numeric(9,4) not null default 0,

  settlement_account_hint text,
  clearing_account_hint text,

  gateway_config jsonb not null default '{}'::jsonb,
  ui_config jsonb not null default '{}'::jsonb,
  validation_rules jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,

  display_order integer not null default 0,

  rec_status smallint not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz,
  updated_by uuid,

  constraint uq_org_payment_methods_cf_method unique (tenant_org_id, payment_method_code, coalesce(gateway_code, '')),

  constraint chk_org_payment_methods_cf_payment_nature check (
    payment_nature in ('REAL_PAYMENT','CREDIT_APPLICATION','AR_ALLOCATION','DEFERRED_SETTLEMENT','INTERNAL_ADJUSTMENT')
  ),

  constraint chk_org_payment_methods_cf_fee_type check (fee_type in ('NONE','FIXED','PERCENTAGE')),

  constraint chk_org_payment_methods_cf_amounts check (
    (min_amount is null or min_amount >= 0)
    and (max_amount is null or max_amount >= 0)
    and (max_amount is null or min_amount is null or max_amount >= min_amount)
  ),

  constraint chk_org_payment_methods_cf_fees check (fee_amount >= 0 and fee_rate >= 0),
  constraint chk_org_payment_methods_cf_rec_status check (rec_status in (0,1,2))
);
```

### Indexes

```sql
create index if not exists idx_org_payment_methods_cf_tenant_active
on public.org_payment_methods_cf (tenant_org_id, rec_status, is_enabled, display_order);

create index if not exists idx_org_payment_methods_cf_method
on public.org_payment_methods_cf (payment_method_code);

create index if not exists idx_org_payment_methods_cf_gateway
on public.org_payment_methods_cf (gateway_code)
where gateway_code is not null;
```

### Example Configurations

| Scenario | payment_method_code | gateway_code | Notes |
|---|---|---|---|
| Cash | CASH | null | supports change return |
| Manual POS card | CARD | MANUAL | requires reference/auth |
| HyperPay online | PAYMENT_GATEWAY | HYPERPAY | online gateway |
| Bank transfer | BANK_TRANSFER | null | requires bank reference |

---

## 5. Branch Override Table: org_branch_payment_methods_cf

### Purpose
Controls payment method availability per branch.

### SQL

```sql
create table if not exists public.org_branch_payment_methods_cf (
  id uuid primary key default gen_random_uuid(),

  tenant_org_id uuid not null references public.org_tenants_mst(id) on delete cascade,
  branch_id uuid not null,

  org_payment_method_id uuid not null references public.org_payment_methods_cf(id) on delete cascade,

  is_enabled boolean not null default true,

  allowed_in_pos boolean,
  allowed_in_customer_app boolean,
  allowed_in_staff_app boolean,
  allowed_for_pay_now boolean,
  allowed_for_pay_on_collection boolean,
  allowed_for_invoice_payment boolean,
  allowed_for_refund boolean,

  cash_drawer_required boolean not null default false,
  terminal_required boolean not null default false,

  min_amount numeric(19,4),
  max_amount numeric(19,4),

  branch_gateway_config jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,

  display_order integer not null default 0,

  rec_status smallint not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz,
  updated_by uuid,

  constraint uq_org_branch_payment_methods_cf unique (tenant_org_id, branch_id, org_payment_method_id),

  constraint chk_org_branch_payment_methods_amounts check (
    (min_amount is null or min_amount >= 0)
    and (max_amount is null or max_amount >= 0)
    and (max_amount is null or min_amount is null or max_amount >= min_amount)
  ),

  constraint chk_org_branch_payment_methods_rec_status check (rec_status in (0,1,2))
);
```

---

## 6. Terminal Table: org_payment_terminals_cf

### Purpose
Defines physical/logical payment terminals.

### SQL

```sql
create table if not exists public.org_payment_terminals_cf (
  id uuid primary key default gen_random_uuid(),

  tenant_org_id uuid not null references public.org_tenants_mst(id) on delete cascade,
  branch_id uuid,

  terminal_code varchar(80) not null,
  terminal_name varchar(250) not null,
  terminal_name2 varchar(250),

  terminal_type varchar(50) not null,
  gateway_code varchar(80) references public.sys_payment_gateway_cd(code),

  serial_no varchar(120),
  merchant_id varchar(120),
  terminal_external_id varchar(120),

  is_enabled boolean not null default true,

  config jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,

  rec_status smallint not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz,
  updated_by uuid,

  constraint uq_org_payment_terminals_cf_code unique (tenant_org_id, terminal_code),

  constraint chk_org_payment_terminals_type check (
    terminal_type in ('POS_CARD_TERMINAL','CASH_DRAWER','ONLINE_GATEWAY','BANK_DEVICE','OTHER')
  ),

  constraint chk_org_payment_terminals_rec_status check (rec_status in (0,1,2))
);
```

---

## 7. Cash Drawer Table: org_cash_drawers_mst

### SQL

```sql
create table if not exists public.org_cash_drawers_mst (
  id uuid primary key default gen_random_uuid(),

  tenant_org_id uuid not null references public.org_tenants_mst(id) on delete cascade,
  branch_id uuid not null,

  drawer_code varchar(80) not null,
  drawer_name varchar(250) not null,
  drawer_name2 varchar(250),

  drawer_type varchar(50) not null default 'COUNTER',
  currency_code char(3) not null,

  is_active boolean not null default true,
  requires_session boolean not null default true,

  assigned_user_id uuid,
  assigned_terminal_id uuid references public.org_payment_terminals_cf(id),

  opening_float_required boolean not null default true,
  max_cash_limit numeric(19,4),

  metadata jsonb not null default '{}'::jsonb,

  rec_status smallint not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz,
  updated_by uuid,

  constraint uq_org_cash_drawers_mst_code unique (tenant_org_id, drawer_code),
  constraint chk_org_cash_drawers_type check (drawer_type in ('COUNTER','SAFE','DRIVER_BAG','TEMPORARY')),
  constraint chk_org_cash_drawers_max_cash check (max_cash_limit is null or max_cash_limit >= 0),
  constraint chk_org_cash_drawers_rec_status check (rec_status in (0,1,2))
);
```

---

## 8. Cash Drawer Session Table: org_cash_drawer_sessions_mst

### SQL

```sql
create table if not exists public.org_cash_drawer_sessions_mst (
  id uuid primary key default gen_random_uuid(),

  tenant_org_id uuid not null references public.org_tenants_mst(id) on delete cascade,
  branch_id uuid not null,
  cash_drawer_id uuid not null references public.org_cash_drawers_mst(id),

  session_no varchar(80) not null,

  opened_by uuid not null,
  opened_at timestamptz not null default now(),

  opening_float_amount numeric(19,4) not null default 0,
  currency_code char(3) not null,

  status varchar(50) not null default 'OPEN' references public.sys_cash_drawer_session_status_cd(code),

  expected_cash_amount numeric(19,4) not null default 0,
  counted_cash_amount numeric(19,4),
  difference_amount numeric(19,4),

  closed_by uuid,
  closed_at timestamptz,

  close_notes text,
  force_close_reason text,

  metadata jsonb not null default '{}'::jsonb,

  rec_status smallint not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz,
  updated_by uuid,

  constraint uq_org_cash_drawer_sessions_mst_session_no unique (tenant_org_id, session_no),

  constraint chk_org_cash_drawer_sessions_amounts check (
    opening_float_amount >= 0
    and expected_cash_amount >= 0
    and (counted_cash_amount is null or counted_cash_amount >= 0)
  ),

  constraint chk_org_cash_drawer_sessions_rec_status check (rec_status in (0,1,2))
);
```

### One Open Session Rule

```sql
create unique index if not exists uq_open_cash_drawer_session
on public.org_cash_drawer_sessions_mst (tenant_org_id, cash_drawer_id)
where status = 'OPEN' and rec_status = 1;
```

---

## 9. Cash Drawer Movement Table: org_cash_drawer_movements_dtl

### SQL

```sql
create table if not exists public.org_cash_drawer_movements_dtl (
  id uuid primary key default gen_random_uuid(),

  tenant_org_id uuid not null references public.org_tenants_mst(id) on delete cascade,
  branch_id uuid not null,
  cash_drawer_id uuid not null references public.org_cash_drawers_mst(id),
  cash_drawer_session_id uuid not null references public.org_cash_drawer_sessions_mst(id),

  movement_type varchar(50) not null references public.sys_cash_drawer_movement_type_cd(code),
  direction varchar(10) not null,
  amount numeric(19,4) not null,
  currency_code char(3) not null,

  order_id uuid,
  order_payment_id uuid,
  refund_id uuid,

  reference_no varchar(120),
  reason text,

  performed_by uuid not null,
  performed_at timestamptz not null default now(),

  metadata jsonb not null default '{}'::jsonb,

  rec_status smallint not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid,

  constraint chk_org_cash_drawer_movements_direction check (direction in ('IN','OUT','NONE')),
  constraint chk_org_cash_drawer_movements_amount check (amount >= 0),
  constraint chk_org_cash_drawer_movements_rec_status check (rec_status in (0,1,2))
);
```

### Indexes

```sql
create index if not exists idx_cash_drawer_movements_session
on public.org_cash_drawer_movements_dtl (tenant_org_id, cash_drawer_session_id, performed_at);

create index if not exists idx_cash_drawer_movements_order_payment
on public.org_cash_drawer_movements_dtl (order_payment_id)
where order_payment_id is not null;
```

---

## 10. org_order_payments_dtl Enhancements

Add if missing:

```sql
alter table public.org_order_payments_dtl
add column if not exists org_payment_method_id uuid,
add column if not exists branch_payment_method_id uuid,
add column if not exists payment_terminal_id uuid,
add column if not exists cash_drawer_id uuid,
add column if not exists cash_drawer_session_id uuid,
add column if not exists payment_method_code varchar(50),
add column if not exists payment_method_name_snapshot varchar(250),
add column if not exists payment_status varchar(50) default 'COMPLETED',
add column if not exists amount numeric(19,4),
add column if not exists currency_code char(3),
add column if not exists tendered_amount numeric(19,4),
add column if not exists change_returned_amount numeric(19,4),
add column if not exists card_brand_code varchar(50),
add column if not exists card_last4 varchar(4),
add column if not exists auth_code varchar(120),
add column if not exists gateway_code varchar(80),
add column if not exists gateway_transaction_id varchar(200),
add column if not exists gateway_reference varchar(200),
add column if not exists check_no varchar(120),
add column if not exists check_bank_name varchar(250),
add column if not exists check_due_date date,
add column if not exists check_status varchar(50),
add column if not exists bank_reference varchar(200),
add column if not exists idempotency_key text,
add column if not exists paid_at timestamptz,
add column if not exists received_by uuid,
add column if not exists branch_id uuid,
add column if not exists metadata jsonb default '{}'::jsonb;
```

### Add FKs Later After Existing Data Cleanup

```sql
alter table public.org_order_payments_dtl
add constraint fk_order_payments_method foreign key (payment_method_code) references public.sys_payment_method_cd(payment_method_code);

alter table public.org_order_payments_dtl
add constraint fk_order_payments_status foreign key (payment_status) references public.sys_payment_status_cd(code);

alter table public.org_order_payments_dtl
add constraint fk_order_payments_card_brand foreign key (card_brand_code) references public.sys_card_brand_cd(code);

alter table public.org_order_payments_dtl
add constraint fk_order_payments_gateway foreign key (gateway_code) references public.sys_payment_gateway_cd(code);
```

---

## 11. Runtime Flow: Open Cash Drawer

```text
cashier selects drawer
→ validate drawer belongs to tenant/branch
→ validate drawer is active
→ validate no OPEN session exists
→ cashier enters opening float
→ create org_cash_drawer_sessions_mst
→ create OPENING_FLOAT movement
→ expected_cash_amount = opening_float_amount
```

Validation:

```text
drawer active
branch matches user branch
no open session
opening float >= 0
currency valid
user has cash_drawer:open
```

---

## 12. Runtime Flow: Cash Payment

```text
checkout starts
→ resolve tenant payment method CASH
→ resolve branch override
→ validate method allowed for purpose
→ validate open cash drawer session
→ validate amount
→ validate tendered amount
→ calculate change
→ insert org_order_payments_dtl
→ insert org_cash_drawer_movements_dtl
→ update order payment summary
→ update drawer expected cash
```

Example:

```text
Order due = 7.500
Customer tendered = 10.000
Change = 2.500
```

Payment row:

```text
payment_method_code = CASH
amount = 7.500
tendered_amount = 10.000
change_returned_amount = 2.500
cash_drawer_session_id = current session
payment_status = COMPLETED
```

Cash movement:

```text
movement_type = CASH_SALE
direction = IN
amount = 7.500
```

Important:

```text
Drawer movement records retained cash, not tendered cash.
```

---

## 13. Runtime Flow: Card Payment

```text
resolve CARD or PAYMENT_GATEWAY
→ validate method enabled
→ validate terminal/gateway if required
→ create org_order_payments_dtl
→ store card brand, auth code, gateway reference
→ no cash drawer movement
```

For POS manual terminal:

```text
payment_method_code = CARD
gateway_code = MANUAL
```

For online gateway:

```text
payment_method_code = PAYMENT_GATEWAY
gateway_code = HYPERPAY / STRIPE / PAYTABS
```

---

## 14. Runtime Flow: Cash Refund

```text
refund approved
→ validate refund method CASH allowed
→ validate open cash drawer session
→ create org_order_refunds_dtl
→ create CASH_REFUND movement
→ update cash drawer expected amount
```

Movement:

```text
movement_type = CASH_REFUND
direction = OUT
amount = refund_amount
```

---

## 15. Runtime Flow: Close Cash Drawer

```text
cashier counts actual cash
→ system calculates expected cash
→ counted_cash_amount entered
→ difference = counted - expected
→ create CLOSING_COUNT movement
→ if difference < 0 create SHORTAGE movement
→ if difference > 0 create OVERAGE movement
→ update session status = CLOSED
```

Expected formula:

```text
expected_cash_amount =
opening_float
+ CASH_SALE
+ CASH_IN
- CASH_REFUND
- CASH_OUT
- CASH_DROP
```

---

## 16. Required Services

### PaymentMethodResolverService

```text
resolve tenant methods
resolve branch overrides
filter by channel
filter by purpose
filter by currency
return UI-ready allowed payment methods
```

### PaymentValidationService

```text
validate method enabled
validate branch allowed
validate amount limits
validate required references
validate cash drawer session
validate cash tender/change
validate check/card/bank fields
```

### PaymentCaptureService

```text
write org_order_payments_dtl
calculate cash change
call CashDrawerService for cash movements
emit payment events
```

### CashDrawerService

```text
open session
close session
get active session
record opening float
record cash sale movement
record cash refund movement
record cash in/out/drop
calculate expected cash
validate drawer access
force close drawer
```

### SettlementService

```text
sum payment rows
sum credit applications
calculate outstanding
update org_orders_mst summaries
```

---

## 17. Client-Level APIs

### Payment Config APIs

```text
GET    /api/client/v1/payment-methods
POST   /api/client/v1/payment-methods
PATCH  /api/client/v1/payment-methods/:id
DELETE /api/client/v1/payment-methods/:id
```

### Branch Payment APIs

```text
GET    /api/client/v1/branches/:branchId/payment-methods
POST   /api/client/v1/branches/:branchId/payment-methods
PATCH  /api/client/v1/branch-payment-methods/:id
```

### Terminal APIs

```text
GET    /api/client/v1/payment-terminals
POST   /api/client/v1/payment-terminals
PATCH  /api/client/v1/payment-terminals/:id
```

### Cash Drawer APIs

```text
GET    /api/client/v1/cash-drawers
POST   /api/client/v1/cash-drawers
PATCH  /api/client/v1/cash-drawers/:id
POST   /api/client/v1/cash-drawers/:id/open-session
POST   /api/client/v1/cash-drawer-sessions/:id/close
POST   /api/client/v1/cash-drawer-sessions/:id/cash-in
POST   /api/client/v1/cash-drawer-sessions/:id/cash-out
POST   /api/client/v1/cash-drawer-sessions/:id/cash-drop
GET    /api/client/v1/cash-drawer-sessions/:id/movements
```

### Order Payment APIs

```text
POST /api/client/v1/orders/:orderId/payments
POST /api/client/v1/orders/:orderId/refunds
GET  /api/client/v1/orders/:orderId/payment-summary
```

---

## 18. UI Screens

### Tenant Admin Payment Setup

```text
/tenant/settings/payments
```

Tabs:

```text
Payment Methods
Branch Overrides
Terminals
Cash Drawers
Refund Rules
Audit
```

### POS Cash Drawer

```text
/pos/cash-drawer
```

Actions:

```text
Open Session
Cash In
Cash Out
Cash Drop
Close Session
View Movements
```

### POS Checkout

Payment section:

```text
Cash
Card
Check
Bank Transfer
Payment Gateway
```

Credits section:

```text
Gift Card
Wallet
Customer Credit
Advance
Loyalty
```

Deferred section:

```text
Pay on Collection
Invoice / AR
```

---

## 19. Permissions

```text
payments:configure
payments:view_methods
payments:capture_cash
payments:capture_card
payments:capture_check
payments:capture_bank
payments:refund
cash_drawer:view
cash_drawer:open
cash_drawer:close
cash_drawer:cash_in
cash_drawer:cash_out
cash_drawer:cash_drop
cash_drawer:view_movements
cash_drawer:force_close
```

---

## 20. Reconciliation Rules

### Payment Reconciliation

```text
sum(org_order_payments_dtl.amount) = org_orders_mst.total_paid_amount
```

### Cash Drawer Reconciliation

```text
session.expected_cash_amount =
opening_float
+ cash sales
+ cash in
- cash refunds
- cash out
- cash drop
```

### Order Settlement Reconciliation

```text
net_receivable - total_paid - invoice_ar = outstanding
```

---

## 21. Testing Requirements

### Payment Method Config Tests

```text
tenant can enable cash
tenant can disable check
branch can override cash
branch can require cash drawer
branch can require terminal
```

### Cash Drawer Tests

```text
cannot open two sessions for same drawer
opening float creates movement
cash sale creates payment and movement
cash refund creates refund and movement
cash out requires reason
closing calculates shortage/overage
```

### Payment Tests

```text
cash requires open drawer
cash tendered >= amount
card does not require drawer
bank transfer requires reference
check requires check number
stored value does not create payment row
```

---

## 22. Implementation Order

```text
1. Create org_payment_methods_cf.
2. Create org_branch_payment_methods_cf.
3. Create org_payment_terminals_cf.
4. Create org_cash_drawers_mst.
5. Create org_cash_drawer_sessions_mst.
6. Create org_cash_drawer_movements_dtl.
7. Enhance org_order_payments_dtl.
8. Implement PaymentMethodResolverService.
9. Implement PaymentValidationService.
10. Implement CashDrawerService.
11. Implement PaymentCaptureService.
12. Implement SettlementService integration.
13. Build Tenant Admin payment setup UI.
14. Build POS cash drawer UI.
15. Build POS payment capture integration.
16. Add reconciliation reports.
17. Add tests.
```

---

## 23. Client-Level AI Assistant Rules

```text
Do not create sys_payment_gateway_provider_cd.
Do not create sys_payment_method_type_cd.
Use sys_payment_method_cd for payment method.
Use sys_payment_gateway_cd for gateway.
Use sys_payment_type_cd for settlement timing.
Do not store gift card/wallet/customer credit in org_order_payments_dtl.
Cash payments require open cash drawer session when branch method requires it.
Never allow more than one OPEN session per drawer.
Cash movement should record retained cash, not tendered cash.
```

---

## 24. Final Client Decision

The client layer is complete for V1 when it supports:

```text
tenant payment method enablement
branch overrides
payment terminals
cash drawers
cash sessions
cash movements
cash/card/check/bank/payment gateway order payment rows
credit applications separated from payments
refund foundation
payment reconciliation
cash drawer reconciliation
```
