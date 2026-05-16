# Order Financial Platform — Comprehensive Implementation Plan

## Context

CleanMateX needs a production-grade, enterprise-quality financial platform built on top of its existing order system. The current checkout flow (create-with-payment) supports single-leg payments and basic promo/gift card discounts. The goal is a full normalized financial fact layer: multi-leg payments, per-order charges/taxes/discounts/credits, stored value (wallet, advance, credit note), loyalty, a promotion engine, cash drawer sessions, tax engine, outbox-driven async events, and a reconciliation system — all multi-tenant, bilingual (EN/AR + RTL), RBAC-gated, and production-ready.

**No production data exists. No dual-write, no backward-compat shims — clean build only.**

**Existing assets to extend (do NOT recreate):**
- `org_gift_cards_mst` + `org_gift_card_txn_dtl` — already exist (migrations 0029, 0257, 0258)
- `org_promo_codes_mst` + `org_promo_usage_log` — already exist
- `org_discount_rules_cf` — already exists
- `gift-card-service.ts`, `discount-service.ts`, `tax.service.ts`, `invoice-service.ts`, `payment-service.ts` — extend, don't replace
- Prisma models for migrations 0267–0271 — all exist; only 3 sys code table models are missing

**Next available migration number: 0278**

---

## Implementation Phases

---

### PHASE 0 — Foundation (Zero Behavior Change)

**Goal:** Sync code layer with existing DB; add constants/types; rename discount table. No UI or logic changes.

#### P0.1 — Add 3 Missing Prisma Models
**File:** `web-admin/prisma/schema.prisma`

Add models for HQ code tables created in migration 0267:
```prisma
model sys_card_brand_cd { ... }
model sys_cash_drawer_session_status_cd { ... }
model sys_cash_drawer_movement_type_cd { ... }
```
Add relations from `org_cash_drawer_sessions_mst` and `org_order_payments_dtl` to `sys_card_brand_cd`.

#### P0.2 — Migration 0278: Rename Discount Table + Extend
**File:** `supabase/migrations/0278_rename_order_discounts_dtl.sql`

```sql
-- 1. Rename table
ALTER TABLE org_ord_discounts_dtl RENAME TO org_order_discounts_dtl;

-- 2. Rename indexes (all >30 chars must be addressed)
-- Drop old indexes, recreate with new table-derived names

-- 3. Drop + recreate RLS policies with new table name

-- 4. Add new columns (extend for promotions):
ALTER TABLE org_order_discounts_dtl
  ADD COLUMN promotion_id        UUID REFERENCES org_promotions_mst(id),
  ADD COLUMN stacking_group      TEXT,
  ADD COLUMN charge_type         TEXT;  -- for future charge tracking link

-- 5. Rename Prisma model reference everywhere
```

**Prisma:** Rename `org_ord_discounts_dtl` → `org_order_discounts_dtl` in schema.

#### P0.3 — New Constants File
**File:** `web-admin/lib/constants/order-financial.ts` (CREATE NEW)

```typescript
export const CHARGE_TYPES = { PREFERENCE, EXPRESS, BULK_SURCHARGE, SPECIAL_HANDLING } as const
export const TAX_TYPES = { VAT, GST, CUSTOM } as const
export const CREDIT_APPLICATION_TYPES = { GIFT_CARD, WALLET, ADVANCE, CREDIT_NOTE, LOYALTY_POINTS } as const
export const REFUND_REASON_CODES = { DUPLICATE, QUALITY, CANCELLED, OVERCHARGE, OTHER } as const
export const REFUND_METHODS = { ORIGINAL_METHOD, CASH, CREDIT_NOTE, WALLET } as const
export const STORED_VALUE_TXN_TYPES = { TOP_UP, REDEMPTION, REFUND, EXPIRY, CORRECTION, ISSUE } as const
export const PROMO_TYPES = { PERCENTAGE, FIXED_AMOUNT, BUY_X_GET_Y, FREE_ITEM } as const
export const RECONCILIATION_CHECK_NAMES = { PAYMENT_TOTAL_MATCH, CREDIT_APP_BALANCE, STORED_VALUE_LEDGER, TAX_CALCULATION, DISCOUNT_VALIDATION, REFUND_CONSISTENCY, OUTBOX_PROCESSED } as const
export const RECONCILIATION_SEVERITIES = { BLOCKER, WARNING, INFO } as const
export const RECONCILIATION_RUN_STATUSES = { PENDING, RUNNING, PASSED, FAILED, PARTIAL } as const
export const OUTBOX_EVENT_TYPES = { ORDER_COMPLETED, PAYMENT_RECEIVED, REFUND_PROCESSED, LOYALTY_EARN, STORED_VALUE_CHANGED, GIFT_CARD_REDEEMED } as const
export const OUTBOX_STATUSES = { PENDING, PROCESSING, PROCESSED, FAILED } as const
// All derived types via (typeof X)[keyof typeof X]
```

**Alignment rule:** All values must match exact DB column check constraints if exists or the related lookup table data.

#### P0.4 — New Types File
**File:** `web-admin/lib/types/order-financial.ts` (CREATE NEW)

```typescript
export type FinancialBreakdownSnapshot = { subtotal, chargesTotal, grossTotal, discountTotal, netBeforeTax, taxBreakdown: TaxLineItem[], taxTotal, grandTotal, creditsTotal, netReceivable, paymentLegsTotal, changeReturned, outstanding, currencyCode, decimalPlaces }
export type TaxLineItem = { taxType, label, label2, rate, baseAmount, taxAmount }
export type ChargeLineItem = { chargeType, label, label2, amount, sourceId }
export type CreditApplicationInput = { type: CreditApplicationType, referenceId: string, amount: number }
export type PaymentLegInput = { paymentMethodId, kind, amount, reference?, terminalId?, cashTendered? }
export type ReconciliationIssue = { id, checkName, severity, affectedEntityType, affectedEntityId?, expectedValue?, actualValue?, delta?, message, status }
```

**Update `payment.ts`:** Add `LOYALTY_TXN_TYPES` constant.

**Note:** Do NOT remove `GIFT_CARD`/`PROMO_CODE` from `PAYMENT_METHODS` yet — Phase 12 cleanup only.

---

### PHASE 1 — Order Financial Fact Tables

Each migration: CREATE TABLE → RLS → indexes → no app code changes yet.

#### P1.1 — Migration 0279: Order Charges
**File:** `supabase/migrations/0279_order_charges_dtl.sql`

```sql
CREATE TABLE org_order_charges_dtl (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id       UUID NOT NULL,
  order_id            UUID NOT NULL REFERENCES org_orders_mst(id) ON DELETE CASCADE,
  charge_type         TEXT NOT NULL,                    -- CHECK: PREFERENCE|EXPRESS|BULK_SURCHARGE|SPECIAL_HANDLING
  charge_source_id    UUID,                             -- preference ID or rule ID
  label               TEXT NOT NULL,
  label2              TEXT,
  amount              DECIMAL(19,4) NOT NULL CHECK (amount >= 0),
  currency_code       TEXT NOT NULL,
  applied_seq         SMALLINT NOT NULL DEFAULT 1,
  is_voided           BOOLEAN NOT NULL DEFAULT FALSE,
  voided_at           TIMESTAMPTZ,
  voided_by           UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID,
  created_info        TEXT,
  updated_at          TIMESTAMPTZ,
  updated_by          UUID,
  updated_info        TEXT,
  metadata            JSONB
);
-- RLS: current_tenant_id()
-- Indexes: (tenant_org_id, order_id), (tenant_org_id, charge_type)
```

**Prisma:** Add `org_order_charges_dtl` model.

#### P1.2 — Migration 0280: Order Taxes
**File:** `supabase/migrations/0280_order_taxes_dtl.sql`

```sql
CREATE TABLE org_order_taxes_dtl (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id       UUID NOT NULL,
  order_id            UUID NOT NULL REFERENCES org_orders_mst(id) ON DELETE CASCADE,
  tax_profile_id      UUID,                             -- nullable; FK added after 0288
  tax_type            TEXT NOT NULL,                    -- VAT|GST|CUSTOM
  label               TEXT NOT NULL,
  label2              TEXT,
  rate                DECIMAL(5,2) NOT NULL CHECK (rate >= 0 AND rate <= 100),
  is_compound         BOOLEAN NOT NULL DEFAULT FALSE,
  taxable_amount      DECIMAL(19,4) NOT NULL,
  tax_amount          DECIMAL(19,4) NOT NULL,
  currency_code       TEXT NOT NULL,
  applied_seq         SMALLINT NOT NULL DEFAULT 1,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID,
  updated_at          TIMESTAMPTZ,
  updated_by          UUID,
  metadata            JSONB
);
-- RLS: current_tenant_id()
-- Indexes: (tenant_org_id, order_id), (tenant_org_id, tax_type)
```

**Prisma:** Add `org_order_taxes_dtl` model.

#### P1.3 — Migration 0281: Order Financial Snapshot Columns
**File:** `supabase/migrations/0281_orders_financial_snapshot.sql`

Add to `org_orders_mst`:
```sql
ALTER TABLE org_orders_mst ADD COLUMN IF NOT EXISTS
  total_charges_amount        DECIMAL(19,4),
  total_discount_amount       DECIMAL(19,4),
  total_tax_amount            DECIMAL(19,4),
  total_credit_applied_amount DECIMAL(19,4),
  total_paid_amount           DECIMAL(19,4),
  net_receivable_amount       DECIMAL(19,4),
  pay_on_collection_amount    DECIMAL(19,4),
  rounding_adjustment_amount  DECIMAL(19,4) DEFAULT 0,
  change_returned_amount      DECIMAL(19,4) DEFAULT 0,
  outstanding_amount          DECIMAL(19,4),
  financial_engine_version    SMALLINT DEFAULT 1;
```

**Prisma:** Add these fields to `org_orders_mst` model.

#### P1.4 — Migration 0282: Harden Credit Apps + Fix Refund FK
**File:** `supabase/migrations/0282_harden_credit_apps_refunds.sql`

```sql
-- Extend org_order_credit_apps_dtl
ALTER TABLE org_order_credit_apps_dtl
  ADD COLUMN credit_note_no       TEXT,
  ADD COLUMN balance_before       DECIMAL(19,4),
  ADD COLUMN balance_after        DECIMAL(19,4),
  ADD COLUMN idempotency_key      TEXT,
  ADD CONSTRAINT uq_credit_app_idempotency
    UNIQUE (tenant_org_id, idempotency_key);

-- Fix org_order_refunds_dtl: change FK from org_payments_dtl_tr → org_order_payments_dtl
ALTER TABLE org_order_refunds_dtl
  DROP CONSTRAINT org_order_refunds_dtl_original_payment_id_fkey,
  ADD CONSTRAINT org_order_refunds_dtl_original_payment_id_fkey
    FOREIGN KEY (original_payment_id) REFERENCES org_order_payments_dtl(id) ON DELETE RESTRICT;

-- Add refund_no sequence + column
ALTER TABLE org_order_refunds_dtl
  ADD COLUMN refund_no            TEXT,
  ADD COLUMN reason_code          TEXT,
  ADD COLUMN idempotency_key      TEXT,
  ADD CONSTRAINT uq_refund_idempotency
    UNIQUE (tenant_org_id, idempotency_key);
```

**Prisma:** Update both models to reflect new columns + FK change.

---

### PHASE 2 — Stored Value Tables

#### P2.1 — Migration 0283: Wallet
**File:** `supabase/migrations/0283_customer_wallets.sql`

```sql
CREATE TABLE org_customer_wallets_mst (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id   UUID NOT NULL,
  customer_id     UUID NOT NULL REFERENCES org_customers_mst(id) ON DELETE RESTRICT,
  balance         DECIMAL(19,4) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  currency_code   TEXT NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  last_activity_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ,
  updated_by      UUID,
  CONSTRAINT uq_wallet_per_customer UNIQUE (tenant_org_id, customer_id)
);

CREATE TABLE org_wallet_txn_dtl (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id   UUID NOT NULL,
  wallet_id       UUID NOT NULL REFERENCES org_customer_wallets_mst(id) ON DELETE RESTRICT,
  customer_id     UUID NOT NULL,
  txn_type        TEXT NOT NULL,   -- TOP_UP|REDEMPTION|REFUND|EXPIRY|CORRECTION
  amount          DECIMAL(19,4) NOT NULL,
  balance_before  DECIMAL(19,4) NOT NULL,
  balance_after   DECIMAL(19,4) NOT NULL,
  order_id        UUID,
  credit_app_id   UUID,
  idempotency_key TEXT,
  reference_no    TEXT,
  notes           TEXT,
  performed_by    UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID,
  CONSTRAINT uq_wallet_txn_idempotency UNIQUE (tenant_org_id, idempotency_key)
);
-- RLS on both: current_tenant_id()
-- Indexes: wallet (tenant+customer), txn (tenant+wallet_id, tenant+order_id)
```

**Prisma:** Add `org_customer_wallets_mst` + `org_wallet_txn_dtl` models.

#### P2.2 — Migration 0284: Customer Advances
**File:** `supabase/migrations/0284_customer_advances.sql`

Same structure pattern as wallet. Separate table per business semantics (advance = pre-payment deposited, wallet = topped-up credit).

```sql
CREATE TABLE org_customer_advances_mst (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id   UUID NOT NULL,
  customer_id     UUID NOT NULL,
  balance         DECIMAL(19,4) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  currency_code   TEXT NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  last_activity_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ,
  updated_by      UUID,
  CONSTRAINT uq_advance_per_customer UNIQUE (tenant_org_id, customer_id)
);

CREATE TABLE org_advance_txn_dtl (
  -- Same shape as org_wallet_txn_dtl but references org_customer_advances_mst
  -- txn_type: ISSUE|REDEMPTION|REFUND|CORRECTION
);
-- RLS + indexes
```

**Prisma:** Add both models.

#### P2.3 — Migration 0285: Credit Notes
**File:** `supabase/migrations/0285_credit_notes.sql`

```sql
CREATE TABLE org_credit_notes_mst (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id       UUID NOT NULL,
  customer_id         UUID NOT NULL,
  credit_note_no      TEXT NOT NULL,
  original_amount     DECIMAL(19,4) NOT NULL,
  remaining_balance   DECIMAL(19,4) NOT NULL,
  currency_code       TEXT NOT NULL,
  reason              TEXT NOT NULL,
  related_order_id    UUID,
  expires_at          DATE,
  status              TEXT NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE|EXHAUSTED|EXPIRED|CANCELLED
  issued_by           UUID,
  issued_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_by        UUID,
  cancelled_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID,
  updated_at          TIMESTAMPTZ,
  updated_by          UUID,
  metadata            JSONB,
  CONSTRAINT uq_credit_note_no UNIQUE (tenant_org_id, credit_note_no)
);

CREATE TABLE org_credit_note_txn_dtl (
  -- Tracks ISSUE|REDEMPTION|REFUND|EXPIRY|CORRECTION
  -- balance_before, balance_after per transaction
);
-- RLS + indexes
```

**Prisma:** Add both models.

---

### PHASE 3 — Loyalty

#### P3.1 — Migration 0286: Loyalty Tables
**File:** `supabase/migrations/0286_loyalty.sql`

```sql
CREATE TABLE org_loyalty_programs_cf (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id             UUID NOT NULL,
  program_name              TEXT NOT NULL,
  program_name2             TEXT,
  earn_rate_per_unit        DECIMAL(10,4) NOT NULL DEFAULT 1,  -- points per currency unit
  redeem_rate_per_point     DECIMAL(10,6) NOT NULL DEFAULT 0.01,
  min_redeem_points         INTEGER NOT NULL DEFAULT 100,
  max_redeem_pct_of_order   DECIMAL(5,2) NOT NULL DEFAULT 20.00,
  points_expiry_days        INTEGER,                           -- NULL = never
  is_active                 BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by                UUID,
  updated_at                TIMESTAMPTZ,
  updated_by                UUID,
  CONSTRAINT uq_loyalty_per_tenant UNIQUE (tenant_org_id)
);

CREATE TABLE org_loyalty_tiers_cf (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id     UUID NOT NULL,
  program_id        UUID NOT NULL REFERENCES org_loyalty_programs_cf(id),
  name              TEXT NOT NULL,
  name2             TEXT,
  min_points        INTEGER NOT NULL,
  bonus_multiplier  DECIMAL(5,2) NOT NULL DEFAULT 1.00,
  sort_order        SMALLINT NOT NULL DEFAULT 0,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID
);

CREATE TABLE org_loyalty_accounts_mst (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id   UUID NOT NULL,
  customer_id     UUID NOT NULL,
  program_id      UUID NOT NULL REFERENCES org_loyalty_programs_cf(id),
  points_balance  INTEGER NOT NULL DEFAULT 0 CHECK (points_balance >= 0),
  lifetime_earned INTEGER NOT NULL DEFAULT 0,
  current_tier_id UUID REFERENCES org_loyalty_tiers_cf(id),
  last_activity_at TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ,
  updated_by      UUID,
  CONSTRAINT uq_loyalty_acct UNIQUE (tenant_org_id, customer_id)
);

CREATE TABLE org_loyalty_txn_dtl (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id   UUID NOT NULL,
  account_id      UUID NOT NULL REFERENCES org_loyalty_accounts_mst(id),
  customer_id     UUID NOT NULL,
  txn_type        TEXT NOT NULL,   -- EARN|REDEEM|EXPIRE|ADJUST|BONUS
  points          INTEGER NOT NULL,
  points_before   INTEGER NOT NULL,
  points_after    INTEGER NOT NULL,
  order_id        UUID,
  credit_app_id   UUID,
  idempotency_key TEXT,
  notes           TEXT,
  performed_by    UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID,
  CONSTRAINT uq_loyalty_txn_idempotency UNIQUE (tenant_org_id, idempotency_key)
);
-- RLS on all 4: current_tenant_id()
```

**Prisma:** Add all 4 models.

---

### PHASE 4 — Promotions Engine

> Note: `org_promo_codes_mst` + `org_promo_usage_log` already exist. This phase adds CAMPAIGN-level promotions (rules-based engine) that is separate from simple coupon codes.

#### P4.1 — Migration 0287: Promotions Master
**File:** `supabase/migrations/0287_promotions_mst.sql`

```sql
CREATE TABLE org_promotions_mst (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id             UUID NOT NULL,
  promo_code                TEXT,                  -- NULL = auto-apply rule
  name                      TEXT NOT NULL,
  name2                     TEXT,
  promo_type                TEXT NOT NULL,         -- PERCENTAGE|FIXED_AMOUNT|BUY_X_GET_Y|FREE_ITEM
  discount_type             TEXT NOT NULL,         -- PERCENTAGE|FIXED
  discount_value            DECIMAL(19,4) NOT NULL CHECK (discount_value > 0),
  minimum_order_amount      DECIMAL(19,4),
  applicable_service_types  TEXT[],               -- NULL = all
  applicable_customer_grps  TEXT[],               -- NULL = all
  usage_limit               INTEGER,               -- NULL = unlimited
  usage_limit_per_customer  INTEGER,
  usage_count               INTEGER NOT NULL DEFAULT 0,
  valid_from                TIMESTAMPTZ NOT NULL,
  valid_to                  TIMESTAMPTZ,
  stackable                 BOOLEAN NOT NULL DEFAULT FALSE,
  stacking_group            TEXT,
  max_stacking_discount     DECIMAL(19,4),
  is_active                 BOOLEAN NOT NULL DEFAULT TRUE,
  rec_status                SMALLINT NOT NULL DEFAULT 1,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by                UUID,
  created_info              TEXT,
  updated_at                TIMESTAMPTZ,
  updated_by                UUID,
  updated_info              TEXT,
  metadata                  JSONB,
  CONSTRAINT uq_promo_code UNIQUE (tenant_org_id, promo_code)
);

CREATE TABLE org_promo_usage_dtl (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id   UUID NOT NULL,
  promotion_id    UUID NOT NULL REFERENCES org_promotions_mst(id) ON DELETE RESTRICT,
  customer_id     UUID,
  order_id        UUID NOT NULL,
  discount_amount DECIMAL(19,4) NOT NULL,
  used_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID
);
-- RLS on both: current_tenant_id()
-- Indexes: (tenant+is_active+valid_from+valid_to), (tenant+promo_code), (tenant+promotion_id+customer_id)
```

**Add FK to 0278 column:** `org_order_discounts_dtl.promotion_id → org_promotions_mst(id)` — add FK in this migration.

**Prisma:** Add `org_promotions_mst` + `org_promo_usage_dtl` models.

---

### PHASE 5 — Tax Configuration

#### P5.1 — Migration 0288: Tax Profiles
**File:** `supabase/migrations/0288_tax_config.sql`

```sql
CREATE TABLE org_tax_profiles_cf (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id   UUID NOT NULL,
  name            TEXT NOT NULL,
  name2           TEXT,
  tax_type        TEXT NOT NULL,          -- VAT|GST|CUSTOM
  rate            DECIMAL(5,2) NOT NULL CHECK (rate >= 0 AND rate <= 100),
  is_compound     BOOLEAN NOT NULL DEFAULT FALSE,
  applies_to      TEXT[],                 -- service type codes; NULL = all
  effective_from  DATE NOT NULL,
  effective_to    DATE,
  is_default      BOOLEAN NOT NULL DEFAULT FALSE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  rec_status      SMALLINT NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ,
  updated_by      UUID
);

CREATE TABLE org_tax_exemptions_cf (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id   UUID NOT NULL,
  customer_id     UUID,
  service_type    TEXT,
  exemption_type  TEXT NOT NULL,
  certificate_no  TEXT,
  valid_from      DATE NOT NULL,
  valid_to        DATE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID
);
-- RLS on both: current_tenant_id()
```

Add FK from `org_order_taxes_dtl.tax_profile_id → org_tax_profiles_cf(id)` in this migration.

**Prisma:** Add both models + update `org_order_taxes_dtl` relation.

---

### PHASE 6 — Infrastructure Tables

#### P6.1 — Migration 0289: Currency Rounding Rules
**File:** `supabase/migrations/0289_currency_rounding.sql`

```sql
CREATE TABLE sys_currency_rounding_rules_cd (
  currency_code     TEXT PRIMARY KEY,
  rounding_method   TEXT NOT NULL DEFAULT 'HALF_UP',  -- HALF_UP|HALF_DOWN|FLOOR|CEIL
  rounding_unit     DECIMAL(10,6) NOT NULL DEFAULT 0.01,
  notes             TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE
);
-- Seed GCC currencies: SAR, AED, KWD (0.005), QAR, BHD (0.005), OMR (0.005)
```

**Prisma:** Add `sys_currency_rounding_rules_cd` model.

#### P6.2 — Migration 0290: Outbox + Idempotency
**File:** `supabase/migrations/0290_outbox_idempotency.sql`

```sql
CREATE TABLE org_domain_events_outbox (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id   UUID NOT NULL,
  event_type      TEXT NOT NULL,
  aggregate_type  TEXT NOT NULL,
  aggregate_id    UUID NOT NULL,
  payload         JSONB NOT NULL,
  status          TEXT NOT NULL DEFAULT 'PENDING',   -- PENDING|PROCESSING|PROCESSED|FAILED
  attempts        SMALLINT NOT NULL DEFAULT 0,
  max_attempts    SMALLINT NOT NULL DEFAULT 6,
  next_retry_at   TIMESTAMPTZ,
  processed_at    TIMESTAMPTZ,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Index: (status, next_retry_at) WHERE status IN ('PENDING','FAILED') -- for worker polling
-- Index: (tenant_org_id, aggregate_id, event_type)

CREATE TABLE org_idempotency_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id   UUID NOT NULL,
  key             TEXT NOT NULL,
  resource_type   TEXT NOT NULL,
  resource_id     UUID,
  response_cache  JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
  CONSTRAINT uq_idempotency_key UNIQUE (tenant_org_id, key, resource_type)
);
-- Index: (tenant_org_id, key, resource_type)
-- RLS on both: current_tenant_id()
```

**Prisma:** Add both models.

#### P6.3 — Migration 0291: Reconciliation Tables
**File:** `supabase/migrations/0291_reconciliation.sql`

```sql
CREATE TABLE org_fin_recon_runs_mst (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id   UUID NOT NULL,
  run_no          TEXT NOT NULL,
  run_type        TEXT NOT NULL DEFAULT 'MANUAL',    -- DAILY|MANUAL
  period_from     DATE NOT NULL,
  period_to       DATE NOT NULL,
  branch_id       UUID,
  status          TEXT NOT NULL DEFAULT 'PENDING',   -- PENDING|RUNNING|PASSED|FAILED|PARTIAL
  total_checked   INTEGER DEFAULT 0,
  passed_checks   INTEGER DEFAULT 0,
  failed_checks   INTEGER DEFAULT 0,
  warning_checks  INTEGER DEFAULT 0,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  triggered_by    UUID,
  metadata        JSONB,
  CONSTRAINT uq_recon_run_no UNIQUE (tenant_org_id, run_no)
);

CREATE TABLE org_fin_recon_issues_dtl (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id         UUID NOT NULL,
  run_id                UUID NOT NULL REFERENCES org_fin_recon_runs_mst(id) ON DELETE CASCADE,
  check_name            TEXT NOT NULL,
  severity              TEXT NOT NULL,               -- BLOCKER|WARNING|INFO
  affected_entity_type  TEXT,
  affected_entity_id    UUID,
  expected_value        DECIMAL(19,4),
  actual_value          DECIMAL(19,4),
  delta                 DECIMAL(19,4),
  message               TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'OPEN', -- OPEN|ACKNOWLEDGED|RESOLVED
  acknowledged_by       UUID,
  acknowledged_at       TIMESTAMPTZ,
  resolved_by           UUID,
  resolved_at           TIMESTAMPTZ,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- RLS on both: current_tenant_id()
-- Indexes: (tenant+status+period_from), (run_id+severity+status)
```

**Prisma:** Add both models.

---

### PHASE 7 — Permissions + Navigation

#### P7.1 — Migration 0292: Seed All New Permissions
**File:** `supabase/migrations/0292_financial_permissions_seed.sql`

Seed into `sys_permissions_cd` (or equivalent permission table — check existing pattern):

```sql
-- Orders financial
('orders:view_financial_breakdown', 'View order financial detail'),
('orders:process_refund', 'Process refund'),
('orders:approve_refund', 'Approve refund (manager gate)'),

-- Cash drawer
('cash_drawer:view', ...), ('cash_drawer:open_session', ...),
('cash_drawer:close_session', ...), ('cash_drawer:record_movement', ...),
('cash_drawer:view_reports', ...),

-- Stored value
('stored_value:view_balances', ...), ('stored_value:top_up_wallet', ...),
('stored_value:issue_advance', ...), ('stored_value:issue_credit_note', ...),
('stored_value:view_ledger', ...), ('stored_value:adjust_balance', ...),

-- Gift cards (extend existing)
('gift_cards:cancel', ...), ('gift_cards:view_ledger', ...),

-- Loyalty
('loyalty:view_config', ...), ('loyalty:manage_config', ...),
('loyalty:view_customer_points', ...), ('loyalty:adjust_points', ...),

-- Promotions (campaign level — separate from existing promotions:read)
('promotions:create', ...), ('promotions:edit', ...),
('promotions:delete', ...), ('promotions:activate_deactivate', ...),

-- Tax
('tax:view_config', ...), ('tax:manage_config', ...), ('tax:view_reports', ...),

-- Reconciliation
('reconciliation:view', ...), ('reconciliation:run', ...),
('reconciliation:acknowledge_issues', ...),

-- Payment config
('payment_config:view', ...), ('payment_config:manage', ...),

-- Finance reports
('finance_reports:view', ...), ('finance_reports:export', ...)
```

Map to roles per the RBAC table in the planning session.

#### P7.2 — Migration 0293: Navigation Entries
**File:** `supabase/migrations/0293_financial_navigation.sql`

Insert into `sys_components_cd`:

| nav_key | parent | label (EN) | label (AR) | path | permissions |
|---|---|---|---|---|---|
| `cash_drawers` | `billing` | Cash Drawers | الصناديق النقدية | /dashboard/billing/cash-drawers | cash_drawer:view |
| `refunds` | `billing` | Refunds | المرتجعات | /dashboard/billing/refunds | orders:process_refund |
| `reconciliation` | `billing` | Reconciliation | التسوية المالية | /dashboard/billing/reconciliation | reconciliation:view |
| `customer_stored_value` | `customers` (section) | Stored Value | القيمة المخزنة | /dashboard/customers/stored-value | stored_value:view_balances |
| `gift_cards_admin` | `marketing` | Gift Cards (Admin) | بطاقات الهدايا | /dashboard/marketing/gift-cards | gift_cards:view |
| `loyalty_program` | `marketing` | Loyalty Program | برنامج الولاء | /dashboard/marketing/loyalty | loyalty:view_config |
| `promotions_engine` | `marketing` | Promotions | العروض الترويجية | /dashboard/marketing/promotions | promotions:view |
| `tax_setup` | `config_settings` | Tax Setup | إعداد الضريبة | /dashboard/settings/tax | tax:view_config |
| `fin_reports` | `reports` | Financial Reports | التقارير المالية | /dashboard/reports/financial | finance_reports:view |

**MANDATORY DUAL-WRITE:** Also update `web-admin/config/navigation.ts` with all corresponding entries.

---

### PHASE 8 — Service Layer

All new services created in `web-admin/lib/services/`. All use `withTenantContext` + `PrismaTx` pattern.

#### P8.1 — Rewrite `order-calculation.service.ts`
**File:** `web-admin/lib/services/order-calculation.service.ts`

New return type `FinancialBreakdownSnapshot` (replace flat `OrderCalculationResult`).

Extend function signature to accept:
```typescript
interface OrderCalculationParams {
  // ... existing params unchanged ...
  creditApplications?: CreditApplicationInput[]
  loyaltyPointsToRedeem?: number
}
```

New return:
```typescript
interface CalculationResult {
  breakdown: FinancialBreakdownSnapshot  // NEW structured type
  // Keep backward-compat flat fields for existing code during transition:
  subtotal, finalTotal, taxAmount, vatValue, giftCardApplied, ...
  chargeLines: ChargeLineItem[]   // NEW
  taxLines: TaxLineItem[]         // NEW  
  discountLines: DiscountLineInput[]
  creditLines: CreditApplicationInput[]  // NEW
}
```

Internally call new `tax-engine.service.ts` for tax breakdown.

#### P8.2 — New `tax-engine.service.ts`
**File:** `web-admin/lib/services/tax-engine.service.ts`

```typescript
// Load active tax profile for tenant+branch+serviceType
// Return per-line tax breakdown
// Support compound taxes (applied on top of each other)
// Support exemptions (check org_tax_exemptions_cf)
async function calculateTax(params: TaxCalcParams): Promise<TaxLineItem[]>
```

Reads from `org_tax_profiles_cf`. Falls back to tenant `tax_rate` setting if no profile configured.

#### P8.3 — New `settlement.service.ts`
**File:** `web-admin/lib/services/settlement.service.ts`

Responsible for writing all financial fact rows in a single transaction:
```typescript
async function settleOrder(tx: PrismaTx, params: {
  orderId, tenantId, breakdown: FinancialBreakdownSnapshot,
  chargeLines, taxLines, discountLines, creditApplications,
  paymentLegs, cashDrawerSessionId?
}): Promise<SettlementResult>
```

Steps inside tx:
1. Write `org_order_charges_dtl` rows
2. Write `org_order_taxes_dtl` rows
3. Write `org_order_discounts_dtl` rows (via existing `insertDiscountLinesTx`)
4. Write `org_order_credit_apps_dtl` rows (SELECT FOR UPDATE on source balances)
5. Write `org_order_payments_dtl` rows (multi-leg)
6. Update `org_orders_mst` snapshot columns
7. Emit outbox events (ORDER_COMPLETED + per-credit-type events)

#### P8.4 — New `stored-value.service.ts`
**File:** `web-admin/lib/services/stored-value.service.ts`

```typescript
// Wallet
async function getWalletBalance(tenantId, customerId): Promise<WalletBalance>
async function topUpWalletTx(tx, params): Promise<WalletTxn>
async function redeemWalletTx(tx, params): Promise<WalletTxn>  // SELECT FOR UPDATE

// Advance
async function getAdvanceBalance(tenantId, customerId): Promise<AdvanceBalance>
async function issueAdvanceTx(tx, params): Promise<AdvanceTxn>
async function redeemAdvanceTx(tx, params): Promise<AdvanceTxn>  // SELECT FOR UPDATE

// Credit Note
async function issueCreditNote(tenantId, params): Promise<CreditNote>
async function redeemCreditNoteTx(tx, params): Promise<CreditNoteTxn>  // SELECT FOR UPDATE
async function getCreditNotes(tenantId, customerId): Promise<CreditNote[]>

// Stored value summary
async function getStoredValueSummary(tenantId, customerId): Promise<StoredValueSummary>
```

All balance mutations: `SELECT ... FOR UPDATE`, then insert ledger row, then update master balance.

#### P8.5 — New `loyalty.service.ts`
**File:** `web-admin/lib/services/loyalty.service.ts`

```typescript
async function getLoyaltyAccount(tenantId, customerId): Promise<LoyaltyAccount>
async function redeemPointsTx(tx, params): Promise<LoyaltyTxn>  // SELECT FOR UPDATE
async function queueEarnPoints(tenantId, params): Promise<void>  // writes outbox event
async function processEarnPoints(tx, params): Promise<LoyaltyTxn>  // called by outbox worker
async function getLoyaltyConfig(tenantId): Promise<LoyaltyProgram>
async function getCustomerTier(account: LoyaltyAccount): Promise<LoyaltyTier | null>
```

Earn is async (via outbox). Redeem is in-transaction (SELECT FOR UPDATE).

#### P8.6 — New `promotion-engine.service.ts`
**File:** `web-admin/lib/services/promotion-engine.service.ts`

```typescript
async function getAutoApplyPromotions(tenantId, orderContext): Promise<Promotion[]>
async function validatePromoCode(tenantId, code, customerId?, orderAmount?): Promise<PromoValidation>
async function applyPromotionTx(tx, params): Promise<PromoApplication>  // SELECT FOR UPDATE
async function calculatePromotionDiscount(promotion, orderAmount): Promise<number>
// Stacking: sort by discount desc, apply stacking rules, enforce max_stacking_discount
```

Complements existing `discount-service.ts` — call it for enterprise-level promotions; promo codes remain in existing service.

#### P8.7 — New `cash-drawer.service.ts`
**File:** `web-admin/lib/services/cash-drawer.service.ts`

```typescript
async function getDrawers(tenantId, branchId?): Promise<CashDrawer[]>
async function openSession(tenantId, drawerId, params): Promise<CashDrawerSession>
async function closeSession(tenantId, sessionId, params): Promise<SessionCloseResult>
async function recordMovement(tenantId, drawerId, params): Promise<Movement>
async function getSessionSummary(tenantId, sessionId): Promise<SessionSummary>
async function validateDrawerForCashPayment(tenantId, drawerId): Promise<void>
```

#### P8.8 — New `refund.service.ts`
**File:** `web-admin/lib/services/refund.service.ts`

```typescript
async function initiateRefund(tenantId, orderId, params): Promise<Refund>
async function approveRefund(tenantId, refundId, approverId): Promise<Refund>
async function processRefund(tenantId, refundId): Promise<Refund>  // actual reversal
async function getOrderRefunds(tenantId, orderId): Promise<Refund[]>
// Writes outbox REFUND_PROCESSED event
// If method=WALLET: calls stored-value.service topUp
// If method=CREDIT_NOTE: calls issueCreditNote
```

#### P8.9 — New `outbox.service.ts`
**File:** `web-admin/lib/services/outbox.service.ts`

```typescript
async function emitEventTx(tx, tenantId, eventType, aggregateType, aggregateId, payload): Promise<void>
async function claimBatch(limit: number): Promise<OutboxEvent[]>
async function markProcessed(eventId): Promise<void>
async function markFailed(eventId, error): Promise<void>
async function scheduleRetry(eventId, attempts): Promise<void>
// Retry schedule: 1m → 5m → 15m → 1h → 4h → FAILED
```

#### P8.10 — New `reconciliation.service.ts`
**File:** `web-admin/lib/services/reconciliation.service.ts`

```typescript
async function runReconciliation(tenantId, params): Promise<ReconRun>
// 7 checks:
// 1. PAYMENT_TOTAL_MATCH — sum(org_order_payments_dtl) = org_orders_mst.total_paid_amount
// 2. CREDIT_APP_BALANCE — credit apps don't exceed grand_total
// 3. STORED_VALUE_LEDGER — ledger sum = master balance
// 4. TAX_CALCULATION — sum(org_order_taxes_dtl) = org_orders_mst.total_tax_amount
// 5. DISCOUNT_VALIDATION — discount total matches snapshot
// 6. REFUND_CONSISTENCY — refund amounts don't exceed paid amounts
// 7. OUTBOX_PROCESSED — no stuck PENDING/FAILED events older than 1h
async function acknowledgeIssue(tenantId, issueId, status, notes): Promise<void>
```

#### P8.11 — Extend `invoice-service.ts`
**File:** `web-admin/lib/services/invoice-service.ts`

Add:
- `updateInvoiceWithFinancialSnapshot(tx, invoiceId, breakdown)` — record snapshot totals
- `getInvoiceWithBreakdown(tenantId, invoiceId)` — fetch with joined fact tables

---

### PHASE 9 — API Routes

Create all new routes under `web-admin/app/api/v1/`. Each follows:
1. `requirePermission(...)` → extract `tenantId, userId`
2. Zod schema validation
3. `withTenantContext(tenantId, ...)` wrapping
4. Service call(s)
5. Consistent response envelope

#### P9.1 — Extend Checkout Routes
**Files:**
- `web-admin/app/api/v1/orders/create-with-payment/route.ts` — extend Zod schema; call `settlement.service.ts` for fact-table writes
- `web-admin/app/api/v1/orders/preview-payment/route.ts` — extend to accept credit applications + loyalty

Full multi-leg payment support, credit applications, loyalty redemption, cash drawer context.

#### P9.2 — Refund Routes
**Files:**
- `POST web-admin/app/api/v1/orders/[orderId]/refund/route.ts`
- `GET web-admin/app/api/v1/orders/[orderId]/refunds/route.ts`
- `PATCH web-admin/app/api/v1/refunds/[refundId]/approve/route.ts`

#### P9.3 — Cash Drawer Routes
**Files (all under `web-admin/app/api/v1/cash-drawers/`):**
- `GET route.ts` — list drawers
- `POST [drawerId]/open-session/route.ts`
- `POST [drawerId]/close-session/route.ts`
- `POST [drawerId]/cash-movement/route.ts`
- `GET [drawerId]/session/[sessionId]/summary/route.ts`

#### P9.4 — Stored Value Routes
**Files (under `web-admin/app/api/v1/customers/[customerId]/`):**
- `GET stored-value/route.ts`
- `POST wallet/top-up/route.ts`
- `GET wallet/ledger/route.ts`
- `POST advance/issue/route.ts`
- `GET advance/ledger/route.ts`
- `POST credit-note/issue/route.ts`
- `GET credit-notes/route.ts`

#### P9.5 — Gift Card Routes (extend existing)
**Files:**
- `GET web-admin/app/api/v1/gift-cards/[cardCode]/balance/route.ts`
- `GET web-admin/app/api/v1/gift-cards/[cardCode]/ledger/route.ts`

#### P9.6 — Loyalty Routes
**Files:**
- `GET web-admin/app/api/v1/loyalty/config/route.ts`
- `PATCH web-admin/app/api/v1/loyalty/config/route.ts`
- `GET web-admin/app/api/v1/customers/[customerId]/loyalty/route.ts`
- `POST web-admin/app/api/v1/loyalty/tiers/route.ts`

#### P9.7 — Promotions Routes
**Files (under `web-admin/app/api/v1/marketing/promotions/`):**
- `GET route.ts` — paginated list
- `POST route.ts` — create
- `GET [promoId]/route.ts`
- `PATCH [promoId]/route.ts`
- `DELETE [promoId]/route.ts`
- `POST validate/route.ts` — validate code before checkout

#### P9.8 — Tax Config Routes
**Files (under `web-admin/app/api/v1/settings/tax/`):**
- `GET profiles/route.ts`
- `POST profiles/route.ts`
- `PATCH profiles/[profileId]/route.ts`
- `GET exemptions/route.ts`
- `POST exemptions/route.ts`

#### P9.9 — Payment Config Routes
**Files (under `web-admin/app/api/v1/settings/payments/`):**
- `GET methods/route.ts`
- `PATCH methods/[methodId]/route.ts`
- `GET terminals/route.ts`
- `POST terminals/route.ts`

#### P9.10 — Reconciliation Routes
**Files (under `web-admin/app/api/v1/finance/reconciliation/`):**
- `GET runs/route.ts`
- `POST runs/route.ts`
- `GET runs/[runId]/route.ts`
- `PATCH issues/[issueId]/route.ts`

#### P9.11 — Financial Report Routes
**Files (under `web-admin/app/api/v1/finance/reports/`):**
- `GET orders-summary/route.ts`
- `GET payments-breakdown/route.ts`
- `GET tax-report/route.ts`

---

### PHASE 10 — UI: Internal Finance Operations (Billing Section)

All pages in `web-admin/app/dashboard/billing/`. Follow existing billing page patterns. Use `src/features/billing/ui/` for feature components.

#### P10.1 — Cash Drawer Pages
- **List:** `billing/cash-drawers/page.tsx` — Show drawers, active session badge, open/close buttons
- **Detail/Session:** `billing/cash-drawers/[drawerId]/page.tsx` — Tabs: Overview, Current Session, Session History, Movements
- **Session Summary:** `billing/cash-drawers/[drawerId]/session/[sessionId]/page.tsx` — Full breakdown with payment method table

**UX:**
- Real-time balance display
- Color-coded variance (green=match, red=short, amber=over)
- Confirm dialog before close with physical count input
- Movement type badges

#### P10.2 — Refunds Pages
- **List:** `billing/refunds/page.tsx` — All refunds with status filter, date range, approval actions
- **Detail per Order:** Refunds tab on `orders/[id]/page.tsx`

**UX:**
- Inline approve/reject on PENDING_APPROVAL refunds
- Refund method badge
- Link back to original order

#### P10.3 — Reconciliation Pages
- **List:** `billing/reconciliation/page.tsx` — Runs list, status badges, run button (manager permission gate)
- **Detail:** `billing/reconciliation/[runId]/page.tsx` — Summary cards (BLOCKER/WARNING/INFO counts) + issues table
- **Issue Management:** Inline acknowledge/resolve in issues table with notes field

**UX:**
- Color-coded severity (red=blocker, amber=warning, blue=info)
- Filter by severity and status
- Delta amount display (expected vs actual)
- Auto-scroll to first BLOCKER issue

#### P10.4 — Enhance Existing Order Detail Page And Order Full Details Page 
**File:**
- `web-admin/app/dashboard/orders/[id]/page.tsx`
- `web-admin/app/dashboard/orders/[id]/full/page.tsx`
 
Add new "Financial" tab:
- `FinancialBreakdownCard` — charges, discounts, taxes, credits, payment legs in structured layout
- `OrderPaymentsTable` — multi-leg payments with method, amount, status, terminal
- `OrderRefundsSection` — list refunds, initiate refund button

---

### PHASE 11 — UI: Customer Management — Stored Value

#### P11.1 — Stored Value Hub Page
**File:** `web-admin/app/dashboard/customers/stored-value/page.tsx`

List all customers with stored value (wallet balance, advance balance, active credit notes). Filters: balance > 0, customer search.

#### P11.2 — Customer Detail — Stored Value Tab
**File:** `web-admin/app/dashboard/customers/[id]/page.tsx`

Add "Stored Value" tab alongside existing tabs:
- Wallet card: balance, top-up button (modal), transaction history table
- Advance card: balance, issue advance button (modal), transaction history table
- Credit Notes table: list with status badge, remaining balance, expiry, issue credit note button

**UX:**
- Balance displayed prominently (large number with currency)
- History in collapsible accordion per type
- Transaction type badges (colored)
- Top-up / Issue forms in CmxDialog modals with amount validation
- Confirmation step before issuing

---

### PHASE 12 — UI: Marketing

#### P12.1 — Promotions Management
**File:** `web-admin/app/dashboard/marketing/promotions/page.tsx`

Full CRUD for enterprise promotions (separate from existing promo codes page at `/marketing/promos`):
- List with status toggle (active/inactive), type badge, usage progress bar
- Create/Edit in slide-over drawer (CmxDialog) with full form
- Inline activate/deactivate toggle
- Validate Code quick-check modal

**UX:**
- Usage progress bar: `usageCount / usageLimit`
- Stacking indicator badge
- Date range display (valid from → valid to or "No Expiry")
- Empty state with CTA

#### P12.2 — Loyalty Program Management
**File:** `web-admin/app/dashboard/marketing/loyalty/page.tsx`

Two sections:
- **Config card:** Earn rate, redeem rate, min redeem, max % per order, expiry days — editable form with dirty tracking
- **Tiers table:** Create/edit/delete tiers; sort order drag handle

---

### PHASE 13 — UI: Config And Settings

#### P13.1 — Tax Setup Page
**File:** `web-admin/app/dashboard/settings/tax/page.tsx`

- Tax Profiles table: list, create, edit, set default, deactivate
- Tax Exemptions table: list, create, deactivate
- Per-profile: rate, type badge, applies-to chips, effective dates
- Confirm dialog before changing default profile

#### P13.2 — Enhance Payment Setup Page
**File:** `web-admin/app/dashboard/settings/payments/page.tsx` (already exists)

Enhance to include:
- Terminal management tab (list terminals, add terminal form)
- Branch payment method overrides tab

---

### PHASE 14 — UI: Financial Reports

#### P14.1 — Financial Reports Hub
**File:** `web-admin/app/dashboard/reports/financial/page.tsx`

Three report tabs:
1. **Orders Summary** — date range + branch filter, KPI cards (total orders, gross, tax, net), table with pagination, CSV export
2. **Payments Breakdown** — by method bar chart + table, method filter
3. **Tax Report** — by type table, grand total footer, date range, branch filter

**UX patterns:**
- All reports follow existing `reports/orders/page.tsx` pattern
- Loading skeletons during fetch
- Empty state with date range adjustment prompt
- Export button calls API with same filters

---

### PHASE 15 — Print & Export

#### P15.1 — Enhanced Receipt
**File:** `web-admin/app/dashboard/billing/payments/[id]/print/receipt-voucher/page.tsx` (extend)

Add to receipt template:
- Charges section (if any)
- Tax breakdown per type (VAT line, custom tax line)
- Credits applied (gift card: last 4 of code; wallet: "Wallet Credit"; etc.)
- Multi-leg payment rows
- Change returned row

#### P15.2 — Cash Drawer Session Report
**File:** `web-admin/app/dashboard/billing/cash-drawers/[drawerId]/session/[sessionId]/print/page.tsx` (NEW, follows `*-rprt.tsx` pattern)

Print-ready session summary: opening balance, all movements, payment method breakdown, expected vs counted variance.

#### P15.3 — Tax Report Export
Download CSV from `GET /api/v1/finance/reports/tax-report?format=csv` — handled in route.ts.

#### P15.4 — Reconciliation Issue Export
PDF/CSV of reconciliation run issues.

---

### PHASE 16 — Background Jobs

#### P16.1 — Outbox Worker Edge Function
**File:** `supabase/functions/outbox-worker/index.ts` (CREATE)

```typescript
// Invoked by pg_cron every 30s via HTTP
// 1. SELECT ... FOR UPDATE SKIP LOCKED LIMIT 50 WHERE status='PENDING' AND next_retry_at <= NOW()
// 2. Route by event_type:
//    ORDER_COMPLETED → post to org_payments_dtl_tr
//    LOYALTY_EARN → insert org_loyalty_txn_dtl, update balance
//    REFUND_PROCESSED → post reversal
//    STORED_VALUE_CHANGED → update materialized view (if any)
//    GIFT_CARD_REDEEMED → check/mark exhausted
// 3. On success: mark PROCESSED
// 4. On error: scheduleRetry (1m→5m→15m→1h→4h→FAILED)
```

#### P16.2 — Migration 0294: pg_cron Jobs
**File:** `supabase/migrations/0294_pg_cron_jobs.sql`

```sql
-- Outbox worker trigger (every 30s)
SELECT cron.schedule('outbox-worker', '*/1 * * * *', $$
  SELECT net.http_post(url := 'SUPABASE_FUNCTION_URL/outbox-worker', ...) 
$$);

-- Expiry worker (daily 02:00 UTC)
SELECT cron.schedule('expiry-worker', '0 2 * * *', $$
  -- Gift cards
  UPDATE org_gift_cards_mst SET is_active=false, status='EXPIRED'
  WHERE expiry_date < CURRENT_DATE AND status='ACTIVE';
  -- Credit notes
  UPDATE org_credit_notes_mst SET status='EXPIRED'
  WHERE expires_at < CURRENT_DATE AND status='ACTIVE';
$$);

-- Reconciliation auto-run (daily 03:00 UTC) — only if tenant setting enabled
-- Handled by outbox worker picking up RECON_TRIGGER events
```

---

### PHASE 17 — i18n

**Files:**
- `web-admin/messages/en.json` — add all keys from the i18n plan (financial, cash_drawer, stored_value, gift_cards, loyalty, promotions, refunds, tax_setup, reconciliation, finance_reports sections)
- `web-admin/messages/ar.json` — add all Arabic equivalents
- Run `npm run check:i18n` after additions

---

### PHASE 18 — Testing

#### P18.1 — Unit Tests (Jest)
**Location:** `web-admin/__tests__/services/`

- `order-calculation.service.test.ts` — test new FinancialBreakdownSnapshot shape; credit application math; rounding
- `tax-engine.service.test.ts` — VAT, GST, compound tax, exemption logic
- `settlement.service.test.ts` — mock tx; verify all fact rows written
- `stored-value.service.test.ts` — SELECT FOR UPDATE mock; balance before/after; idempotency
- `loyalty.service.test.ts` — earn/redeem/tier calculation
- `promotion-engine.service.test.ts` — stacking rules, max discount ceiling
- `cash-drawer.service.test.ts` — session state machine, variance calculation
- `refund.service.test.ts` — refund limit validation, method routing
- `reconciliation.service.test.ts` — all 7 checks, BLOCKER/WARNING/INFO classification

**Location:** `web-admin/__tests__/validations/`
- `financial-schemas.test.ts` — Zod schema edge cases

**Location:** `web-admin/__tests__/tenant-isolation/`
- `financial-tenant-isolation.test.ts` — cross-tenant data access prevention

#### P18.2 — Integration Tests
**Location:** `web-admin/__tests__/integration/`

- `checkout-multi-payment.test.ts` — multi-leg checkout with wallet + cash
- `gift-card-redemption.test.ts` — concurrent redemption race prevention
- `refund-flow.test.ts` — initiate → approve → process
- `reconciliation-run.test.ts` — full run with known mismatches

#### P18.3 — E2E Tests (Playwright)
**Location:** `web-admin/e2e/`

- `cash-drawer.spec.ts` — open session → movement → close
- `stored-value.spec.ts` — top-up wallet → apply at checkout
- `promotions.spec.ts` — create promotion → validate code
- `tax-setup.spec.ts` — create tax profile → set as default
- `reconciliation.spec.ts` — run reconciliation → acknowledge issue

---

### PHASE 19 — Documentation

#### P19.1 — Feature Documentation
**Files (create under `docs/features/Order_Fin/Order_Fin_Docs/`):**
- `ORDER_FINANCIAL_PLATFORM.md` — overview, formula, architecture decisions
- `STORED_VALUE_GUIDE.md` — wallet/advance/credit-note business rules, SELECT FOR UPDATE, idempotency
- `LOYALTY_GUIDE.md` — earn/redeem rules, tier logic, async pattern
- `PROMOTIONS_GUIDE.md` — promotion types, stacking rules, vs promo codes distinction
- `TAX_ENGINE_GUIDE.md` — profile config, compound tax, exemptions
- `RECONCILIATION_GUIDE.md` — 7 checks, severity levels, monitoring
- `CASH_DRAWER_GUIDE.md` — session lifecycle, variance handling, force-close rules
- `OUTBOX_PATTERN_GUIDE.md` — event types, retry schedule, worker architecture

#### P19.2 — API Documentation
**File:** `docs/features/Order_Fin/Order_Fin_Docs/order-financial-api.md`

Full request/response contract documentation for all new routes.

#### P19.3 — Migration Guide
**File:** `docs/features/Order_Fin/Order_Fin_Docs/order-financial-migration-order.md`

Dependency graph + execution order (0278 → 0294) with rollback notes per migration.

#### P19.4 — Constants & Types Reference
**File:** `docs/features/Order_Fin/Order_Fin_Docs/order-financial-constants-types.md`

Map every new constant to its DB column check constraint.

---

## Critical Files Reference

| File | Action |
|---|---|
| `web-admin/prisma/schema.prisma` | Add 3 missing sys models + models for all new tables |
| `web-admin/lib/constants/order-financial.ts` | CREATE — all new constants |
| `web-admin/lib/types/order-financial.ts` | CREATE — all new types |
| `web-admin/lib/constants/payment.ts` | Add `LOYALTY_TXN_TYPES` |
| `web-admin/lib/services/order-calculation.service.ts` | Extend return type; call tax-engine |
| `web-admin/lib/services/tax-engine.service.ts` | CREATE |
| `web-admin/lib/services/settlement.service.ts` | CREATE |
| `web-admin/lib/services/stored-value.service.ts` | CREATE |
| `web-admin/lib/services/loyalty.service.ts` | CREATE |
| `web-admin/lib/services/promotion-engine.service.ts` | CREATE |
| `web-admin/lib/services/cash-drawer.service.ts` | CREATE |
| `web-admin/lib/services/refund.service.ts` | CREATE |
| `web-admin/lib/services/outbox.service.ts` | CREATE |
| `web-admin/lib/services/reconciliation.service.ts` | CREATE |
| `web-admin/lib/services/invoice-service.ts` | Extend (2 new functions) |
| `web-admin/app/api/v1/orders/create-with-payment/route.ts` | Extend (multi-leg, credits, loyalty) |
| `web-admin/app/api/v1/orders/preview-payment/route.ts` | Extend |
| `web-admin/config/navigation.ts` | Add all new nav items (dual-write with 0293) |
| `web-admin/messages/en.json` | Add all i18n keys |
| `web-admin/messages/ar.json` | Add all Arabic keys |
| `supabase/functions/outbox-worker/index.ts` | CREATE |
| `supabase/migrations/0278–0294.sql` | CREATE all (17 migrations) |

## Existing Patterns to Reuse

| Pattern | Location |
|---|---|
| `withTenantContext()` | `web-admin/lib/db/tenant-context.ts` |
| `requirePermission()` | `web-admin/lib/middleware/require-permission.ts` |
| `PrismaTx` type | Derived in each service from `typeof prisma.$transaction` |
| `SELECT FOR UPDATE` lock | `web-admin/lib/services/discount-service.ts` (applyPromoCodeTx) |
| Idempotency check pattern | `web-admin/app/api/v1/orders/create-with-payment/route.ts` L113-127 |
| `generate_session_no()` function | `supabase/migrations/0270_v1_cash_drawer_tables.sql` (reuse pattern) |
| `getAuthContext()` | Used in all existing pages |
| `useHasPermission()` | `web-admin/lib/hooks/use-has-permission.ts` |
| `hasPermissionServer()` | `web-admin/lib/services/permission-service-server.ts` |
| Report page pattern | `web-admin/app/dashboard/reports/orders/page.tsx` |
| Settings page pattern | `web-admin/app/dashboard/settings/general/page.tsx` |
| Feature components dir | `web-admin/src/features/billing/ui/` |
| Print report pattern | `web-admin/app/dashboard/billing/payments/[id]/print/receipt-voucher/` |

## Migration Dependency Order

```
0278 (rename discounts)
 └── 0279 (charges)
 └── 0280 (taxes)
 └── 0281 (snapshot cols on orders_mst)
 └── 0282 (harden credit_apps + fix refund FK)
 └── 0283 (wallet)
 └── 0284 (advance)
 └── 0285 (credit_notes)
 └── 0286 (loyalty)
 └── 0287 (promotions_mst) ← adds FK to 0278 discount col
 └── 0288 (tax profiles) ← adds FK to 0280 taxes col
 └── 0289 (currency rounding) — independent
 └── 0290 (outbox + idempotency) — independent
 └── 0291 (reconciliation) — independent
 └── 0292 (permissions seed) — after all tables exist
 └── 0293 (navigation seed) — after 0292
 └── 0294 (pg_cron jobs) — after 0290 + 0291
```

## Verification

1. **TypeScript:** `cd web-admin && npx tsc --noEmit` — must pass with 0 errors
2. **Build:** `cd web-admin && npm run build` — must succeed
3. **Unit Tests:** `cd web-admin && npm test -- --coverage` — must pass; target 70%+ coverage on new services
4. **i18n Check:** `npm run check:i18n` — no missing keys
5. **Manual checkout flow:** Open session → create order with wallet + cash → verify fact tables written (charges, taxes, payments, credit_apps)
6. **Manual reconciliation:** Run → confirm all 7 checks execute → verify PASSED status
7. **RTL check:** Load every new page in AR locale; verify layout mirrors correctly

---

## Implementation Order Recommendation

1. Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7 (migrations first, all together in one working session)
2. Phase 8 (all services — backend only, no UI)
3. Phase 9 (API routes — can be tested with curl/Postman)
4. Phase 10 checkout enhancement (wires services to existing checkout)
5. Phase 11–14 (UI, in parallel where possible)
6. Phase 15 (print)
7. Phase 16 (background jobs)
8. Phase 17 (i18n — can run alongside UI phases)
9. Phase 18 (tests — write unit tests alongside each service)
10. Phase 19 (documentation — final)
