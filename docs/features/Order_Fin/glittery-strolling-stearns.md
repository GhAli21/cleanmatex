# Order Financial Platform — Comprehensive Implementation Plan

## Context

CleanMateX needs a production-grade, enterprise-quality financial platform built on top of its existing order system. The current checkout flow (create-with-payment) supports single-leg payments and basic promo/gift card discounts. The goal is a full normalized financial fact layer: multi-leg payments, per-order charges/taxes/discounts/credits, stored value (wallet, advance, credit note), loyalty, a promotion engine, cash drawer sessions, tax engine, outbox-driven async events, and a reconciliation system — all multi-tenant, bilingual (EN/AR + RTL), RBAC-gated, and production-ready.

**No production data exists. No dual-write, no backward-compat shims — clean build only.**

**Existing assets to extend (do NOT recreate):**
- `org_gift_cards_mst` + `org_gift_card_txn_dtl` — already exist (migrations 0029, 0257, 0258)
- `org_promotions_mst` + `org_promotion_usage_dtl` — renamed from `org_promo_codes_mst` + `org_promo_usage_log` in migration 0288; extended with campaign-level columns in same migration
- `org_discount_rules_cf` — already exists
- `gift-card-service.ts`, `discount-service.ts`, `tax.service.ts`, `invoice-service.ts`, `payment-service.ts` — extend, don't replace
- Prisma models for migrations 0267–0271 — all exist; only 3 sys code table models are missing

**Next available migration number: 0278**

---

## Architectural Decisions (Locked)

### ADR: Credit Note vs Customer Credit — V1 Scope

**Decision:** V1 uses **Credit Note** (`CREDIT_NOTE`) as the only formal credit instrument.

| Concept | Tables | Status |
|---|---|---|
| Credit Note | `org_credit_notes_mst` + `org_credit_note_txn_dtl` | **IN V1** |
| Customer Credit (generic balance) | `org_customer_credits_mst` + `org_customer_credit_txn_dtl` | **OUT OF V1 SCOPE** |

**Rationale:**
- A Credit Note is a **formal document-based credit** with a `credit_note_no`, reason, expiry, and full audit trail. It maps directly to refund issuance and B2B billing workflows.
- A Customer Credit is a **generic reloadable balance** not tied to any specific document. It overlaps in purpose with Wallet and would create duplicate credit concepts if introduced alongside Credit Notes in the same release.
- Introducing both in V1 without a clear boundary would lead to confusion in the UI, API, and accounting reconciliation.

**Rules enforced by this decision:**
- `CREDIT_NOTE` is the only value in `CREDIT_APPLICATION_TYPES` for document-based customer credits.
- `org_credit_note_txn_dtl.txn_type` values: `ISSUE`, `REDEMPTION`, `REFUND`, `EXPIRY`, `CORRECTION`.
- Any future `CUSTOMER_CREDIT` concept must go through an ADR before implementation and must justify why Wallet + Credit Note do not already cover the need.

### ADR: org_payment_methods_cf = Unified Tenant Checkout Settlement Options Config

**Decision:** `org_payment_methods_cf` is the **single source of truth for every checkout settlement option** a tenant offers — not only real payments. `payment_nature` controls backend routing; the UI groups by it.

| `payment_nature`      | UI section           | Backend writes to                                                              |
|---|---|---|
| `REAL_PAYMENT`        | Payment Methods      | `org_order_payments_dtl`                                                       |
| `CREDIT_APPLICATION`  | Credits Applied      | `org_order_credit_apps_dtl` + stored-value ledger via `credit_application_type`|
| `DEFERRED_SETTLEMENT` | Deferred Settlement  | `org_orders_mst` snapshot cols only (`payment_status`, `outstanding_amount`)   |
| `AR_ALLOCATION`       | Invoice / AR         | Invoice/AR fields — **disabled by default in V1**                              |
| `INTERNAL_ADJUSTMENT` | Internal (admin)     | Adjustment table — **disabled by default in V1**                               |

**Rules enforced by this decision:**
- `org_order_payments_dtl` contains **REAL_PAYMENT legs only**. Any row written there has `payment_nature_snapshot = 'REAL_PAYMENT'` enforced by DB check constraint.
- `PROMO_CODE`/`COUPON` is a **discount source**, not a payment method, not a credit application, and not a settlement option. It must never appear in `org_payment_methods_cf`.
- Gateway providers (`HYPERPAY`, `PAYTABS`, `STRIPE`) must **not** be `payment_method_code` values in tenant config. Use `payment_method_code = PAYMENT_GATEWAY` + `gateway_code = HYPERPAY` etc.
- `PAYMENT_GATEWAY` may appear multiple times per tenant (one row per gateway_code). Unique index is `(tenant_org_id, payment_method_code, COALESCE(gateway_code, ''))` — not a simple unique on `(tenant_org_id, payment_method_code)`.
- `AR_ALLOCATION` and `INTERNAL_ADJUSTMENT` rows are seeded with `is_enabled = false` in V1. Enabling them requires explicit tenant config and future UI work.

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
  ADD COLUMN promotion_id        UUID,  -- FK to org_promotions_mst added in 0288 (after rename)
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

// Checkout settlement routing — mirrors org_payment_methods_cf.payment_nature (from sys_payment_method_cd)
export const PAYMENT_NATURE = {
  REAL_PAYMENT:        'REAL_PAYMENT',
  CREDIT_APPLICATION:  'CREDIT_APPLICATION',
  DEFERRED_SETTLEMENT: 'DEFERRED_SETTLEMENT',
  AR_ALLOCATION:       'AR_ALLOCATION',
  INTERNAL_ADJUSTMENT: 'INTERNAL_ADJUSTMENT',
} as const

// Mirrors org_payment_methods_cf.settlement_type_code check constraint
export const SETTLEMENT_TYPE_CODES = {
  PAY_IN_ADVANCE:    'PAY_IN_ADVANCE',
  PAY_ON_COLLECTION: 'PAY_ON_COLLECTION',
  PAY_ON_DELIVERY:   'PAY_ON_DELIVERY',
  CREDIT_INVOICE:    'CREDIT_INVOICE',
} as const

// All derived types via (typeof X)[keyof typeof X]
```

**Alignment rule:** All values must match exact DB column check constraints if exists or the related lookup table data.
**PROMO_CODE / COUPON rule:** Promotion codes are a discount source. They must never appear in `PAYMENT_NATURE`, `SETTLEMENT_TYPE_CODES`, `CREDIT_APPLICATION_TYPES`, or any checkout settlement constant.

---

### Naming Convention (apply throughout all phases)

**Order-related services** (directly operate on order financial data): prefix with `order-`
- `order-settlement.service.ts` — writes order financial fact rows (charges, taxes, discounts, credits, payments) to DB
- `order-refund.service.ts` — handles refund lifecycle scoped to an order
- `order-calculation.service.ts` ✓ already correct

**General-purpose / cross-domain services** (used by orders AND other contexts): no prefix
- `tax-engine.service.ts` — computes tax rates, applies profiles, handles exemptions; used by orders, invoices, quotes, B2B statements
- `stored-value.service.ts`, `cash-drawer.service.ts`, `loyalty.service.ts`
- `promotion-engine.service.ts`, `outbox.service.ts`, `reconciliation.service.ts`

**Non-order-specific services** (customer-level / infrastructure): no prefix
- `stored-value.service.ts`, `cash-drawer.service.ts`, `loyalty.service.ts`
- `promotion-engine.service.ts`, `outbox.service.ts`, `reconciliation.service.ts`

**API routes**: order-related routes live under `/orders/[id]/` (already correct in plan).

**DB tables**: `order_` prefix already applied to all order fact tables (`org_order_charges_dtl`, `org_order_taxes_dtl`, etc.) ✓

---

### Project Standards Applied to ALL Tables (database skill rules)

Every table must have:
```sql
-- Audit columns (MANDATORY on all tables)
created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
created_by    UUID,
created_info  TEXT,                    -- e.g. 'api:create-with-payment'
updated_at    TIMESTAMPTZ,
updated_by    UUID,
updated_info  TEXT,

-- Soft delete (on mst/cf tables)
is_active     BOOLEAN NOT NULL DEFAULT TRUE,
rec_status    SMALLINT NOT NULL DEFAULT 1,

-- Bilingual (on any table with user-visible name/label fields)
name          TEXT NOT NULL,
name2         TEXT,                    -- Arabic

-- Money fields
amount        DECIMAL(19,4),
rate          DECIMAL(5,2),           -- percentages

-- Currency + exchange rate (on ALL tables that store monetary amounts)
currency_code   TEXT NOT NULL,
exchange_rate   DECIMAL(19,6) NOT NULL DEFAULT 1,  -- rate to tenant base currency
```

Tables that need `currency_code` + `exchange_rate` added vs plan draft:
- `org_order_charges_dtl` — add `exchange_rate`
- `org_order_taxes_dtl` — add `exchange_rate`
- `org_order_discounts_dtl` (renamed) — add both
- `org_order_credit_apps_dtl` — add `exchange_rate`
- `org_order_payments_dtl` — add `exchange_rate` (already has currency_code)
- `org_order_refunds_dtl` — add both
- `org_wallet_txn_dtl` — add `exchange_rate`
- `org_advance_txn_dtl` — add `exchange_rate`
- `org_credit_note_txn_dtl` — add `exchange_rate`
- `org_gift_card_txn_dtl` — add `exchange_rate` (existing table, add via migration)
- `org_promotion_usage_dtl` — add `currency_code` + `exchange_rate` (renamed + extended in 0288)
- `org_promotions_mst` — add `currency_code` + `exchange_rate` (renamed + extended in 0288)
- `org_fin_recon_runs_mst` — add `currency_code` (base currency of the run)

#### P0.4 — New Types File
**File:** `web-admin/lib/types/order-financial.ts` (CREATE NEW)

```typescript
export type FinancialBreakdownSnapshot = { subtotal, chargesTotal, grossTotal, discountTotal, netBeforeTax, taxBreakdown: TaxLineItem[], taxTotal, grandTotal, creditsTotal, netReceivable, paymentLegsTotal, changeReturned, outstanding, currencyCode, decimalPlaces }
export type TaxLineItem = { taxType, label, label2, rate, baseAmount, taxAmount }
export type ChargeLineItem = { chargeType, label, label2, amount, sourceId }
export type CreditApplicationInput = { type: CreditApplicationType, referenceId: string, amount: number }
export type PaymentLegInput = { paymentMethodId, kind, amount, reference?, terminalId?, cashTendered? }
export type ReconciliationIssue = { id, checkName, severity, affectedEntityType, affectedEntityId?, expectedValue?, actualValue?, delta?, message, status }

// Checkout settlement grouping — returned by checkout-config.service.ts
export type SettlementOption = {
  id: string
  paymentMethodCode: string
  paymentNature: PaymentNature
  gatewayCode: string | null
  displayName: string
  displayName2: string | null
  settlementTypeCode: SettlementTypeCode | null
  creditApplicationType: CreditApplicationType | null
  requiresCashDrawer: boolean
  requiresTerminal: boolean
  minAmount: number | null        // per-option amount limit (max gift card apply, etc.)
  maxAmount: number | null        // per-option amount limit
  minOrderAmount: number | null   // order-total eligibility floor
  maxOrderAmount: number | null   // order-total eligibility ceiling
  isPlatformDisabled: boolean     // HQ disabled for this specific tenant
  isGloballyDisabled: boolean     // HQ disabled across all tenants (joined from sys)
  // enriched at runtime by getCheckoutOptions():
  availableBalance?: number       // wallet balance, gift card remaining, loyalty points value
}

export type CheckoutSettlementOptions = {
  paymentMethods:      SettlementOption[]   // payment_nature = REAL_PAYMENT
  creditApplications:  SettlementOption[]   // payment_nature = CREDIT_APPLICATION
  deferredSettlement:  SettlementOption[]   // payment_nature = DEFERRED_SETTLEMENT
  arOptions:           SettlementOption[]   // payment_nature = AR_ALLOCATION
}
```

**Update `payment.ts`:** Add `LOYALTY_TXN_TYPES` constant.

**Cleanup rule:** Remove `GIFT_CARD` and `PROMO_CODE` from the legacy `PAYMENT_METHODS` constant in `payment.ts`. `GIFT_CARD` is now a `CREDIT_APPLICATION` type, not a payment method. `PROMO_CODE` is never a settlement option — it is a discount source only. This cleanup is safe because `org_payment_methods_cf` is the runtime source; the legacy constant was only used in old checkout code being replaced.

#### P0.5 — Migration 0279: sys Financial Lookup Tables
**File:** `supabase/migrations/0279_sys_financial_lookup_tables.sql`

Create all lookup code tables needed by the financial platform, with full EN/AR seed data.
These tables are referenced (logically) by CHECK constraints across the financial migrations.
Max 30-char table name rule strictly applied.

```sql
-- ── sys_payment_nature_cd ─────────────────────────────────────────────────────
CREATE TABLE sys_payment_nature_cd (
  payment_nature  TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  name2           TEXT,
  description     TEXT,
  sort_order      SMALLINT NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  rec_status      SMALLINT NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO sys_payment_nature_cd (payment_nature, name, name2, sort_order) VALUES
  ('REAL_PAYMENT',        'Real Payment',         'دفعة حقيقية',          1),
  ('CREDIT_APPLICATION',  'Credit Application',   'تطبيق رصيد',           2),
  ('DEFERRED_SETTLEMENT', 'Deferred Settlement',  'تسوية مؤجلة',          3),
  ('AR_ALLOCATION',       'AR Allocation',        'تخصيص ذمم مدينة',      4),
  ('INTERNAL_ADJUSTMENT', 'Internal Adjustment',  'تسوية داخلية',         5);

-- ── sys_credit_app_types_cd ───────────────────────────────────────────────────
-- NOTE: max 30 chars → sys_credit_app_types_cd (not sys_credit_application_types_cd)
CREATE TABLE sys_credit_app_types_cd (
  credit_app_type TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  name2           TEXT,
  description     TEXT,
  sort_order      SMALLINT NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  rec_status      SMALLINT NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO sys_credit_app_types_cd (credit_app_type, name, name2, sort_order) VALUES
  ('GIFT_CARD',      'Gift Card',          'بطاقة هدية',    1),
  ('WALLET',         'Wallet',             'المحفظة',       2),
  ('ADVANCE',        'Customer Advance',   'سلفة العميل',   3),
  ('CREDIT_NOTE',    'Credit Note',        'إشعار دائن',    4),
  ('LOYALTY_POINTS', 'Loyalty Points',     'نقاط الولاء',   5);

-- ── sys_settlement_type_codes_cd — NOT CREATED ──────────────────────────────
-- sys_payment_type_cd already exists (created in migration 0001, seeded in 0030).
-- Its PK is payment_type_code and contains: PAY_IN_ADVANCE, PAY_ON_COLLECTION,
-- PAY_ON_DELIVERY, CREDIT_INVOICE. SETTLEMENT_TYPE_CODES constants map to these
-- exact PK values. No new table needed.

-- ── sys_charge_types_cd ───────────────────────────────────────────────────────
CREATE TABLE sys_charge_types_cd (
  charge_type   TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  name2         TEXT,
  sort_order    SMALLINT NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  rec_status    SMALLINT NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO sys_charge_types_cd (charge_type, name, name2, sort_order) VALUES
  ('PREFERENCE',        'Preference Charge',   'رسوم تفضيل',         1),
  ('EXPRESS',           'Express Charge',      'رسوم سريعة',          2),
  ('BULK_SURCHARGE',    'Bulk Surcharge',      'رسوم الكميات',        3),
  ('SPECIAL_HANDLING',  'Special Handling',    'معالجة خاصة',         4);

-- ── sys_tax_types_cd ──────────────────────────────────────────────────────────
CREATE TABLE sys_tax_types_cd (
  tax_type      TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  name2         TEXT,
  sort_order    SMALLINT NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  rec_status    SMALLINT NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO sys_tax_types_cd (tax_type, name, name2, sort_order) VALUES
  ('VAT',    'Value Added Tax',    'ضريبة القيمة المضافة',  1),
  ('GST',    'GST',                'ضريبة السلع والخدمات',  2),
  ('CUSTOM', 'Custom Tax',         'ضريبة مخصصة',           3);

-- ── sys_refund_methods_cd ─────────────────────────────────────────────────────
CREATE TABLE sys_refund_methods_cd (
  refund_method TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  name2         TEXT,
  sort_order    SMALLINT NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  rec_status    SMALLINT NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO sys_refund_methods_cd (refund_method, name, name2, sort_order) VALUES
  ('ORIGINAL_METHOD', 'Original Payment Method', 'طريقة الدفع الأصلية', 1),
  ('CASH',            'Cash Refund',              'استرداد نقدي',        2),
  ('CREDIT_NOTE',     'Credit Note',              'إشعار دائن',          3),
  ('WALLET',          'Wallet Credit',            'رصيد المحفظة',        4);

-- ── sys_refund_reason_codes_cd ────────────────────────────────────────────────
CREATE TABLE sys_refund_reason_codes_cd (
  reason_code   TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  name2         TEXT,
  sort_order    SMALLINT NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  rec_status    SMALLINT NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO sys_refund_reason_codes_cd (reason_code, name, name2, sort_order) VALUES
  ('DUPLICATE',   'Duplicate Charge',    'رسوم مكررة',          1),
  ('QUALITY',     'Quality Issue',       'مشكلة جودة',          2),
  ('CANCELLED',   'Order Cancelled',     'تم إلغاء الطلب',      3),
  ('OVERCHARGE',  'Overcharge',          'فرض رسوم زائدة',      4),
  ('OTHER',       'Other',               'أخرى',                5);
```

**No RLS** — these are global sys tables (no `tenant_org_id`).
**No Prisma models needed** — sys lookup tables are read-only reference data; consumed via DB CHECK constraints and TypeScript constants. Add models only if needed for admin UI.
**`SETTLEMENT_TYPE_CODES` constant** maps to `sys_payment_type_cd.payment_type_code` values (existing table). The CHECK constraint on `org_payment_methods_cf.settlement_type_code` uses: `PAY_IN_ADVANCE`, `PAY_ON_COLLECTION`, `PAY_ON_DELIVERY`, `CREDIT_INVOICE`.

---

### PHASE 1 — Order Financial Fact Tables

Each migration: CREATE TABLE → RLS → indexes → no app code changes yet.

#### P1.1 — Migration 0280: Order Charges
**File:** `supabase/migrations/0280_order_charges_dtl.sql`

```sql
CREATE TABLE org_order_charges_dtl (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id       UUID NOT NULL,
  order_id            UUID NOT NULL REFERENCES org_orders_mst(id) ON DELETE CASCADE,
  charge_type         TEXT NOT NULL CHECK (charge_type IN ('PREFERENCE','EXPRESS','BULK_SURCHARGE','SPECIAL_HANDLING')),
  charge_source_id    UUID,                             -- preference ID or rule ID
  label               TEXT NOT NULL,
  label2              TEXT,
  amount              DECIMAL(19,4) NOT NULL CHECK (amount >= 0),
  currency_code       TEXT NOT NULL,
  exchange_rate       DECIMAL(19,6) NOT NULL DEFAULT 1,
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
-- Note: no rec_status/is_active — voided flag used instead (immutable ledger rows)

CREATE INDEX IF NOT EXISTS idx_order_charges_order
  ON org_order_charges_dtl (tenant_org_id, order_id);
CREATE INDEX IF NOT EXISTS idx_order_charges_type
  ON org_order_charges_dtl (tenant_org_id, charge_type);

ALTER TABLE org_order_charges_dtl ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_org_order_charges_dtl
  ON org_order_charges_dtl FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());
```

**Prisma:** Add `org_order_charges_dtl` model.

#### P1.2 — Migration 0281: Order Taxes
**File:** `supabase/migrations/0281_order_taxes_dtl.sql`

```sql
CREATE TABLE org_order_taxes_dtl (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id       UUID NOT NULL,
  order_id            UUID NOT NULL REFERENCES org_orders_mst(id) ON DELETE CASCADE,
  tax_profile_id      UUID,                             -- nullable; FK added after 0289
  tax_type            TEXT NOT NULL CHECK (tax_type IN ('VAT','GST','CUSTOM')),
  label               TEXT NOT NULL,
  label2              TEXT,
  rate                DECIMAL(5,2) NOT NULL CHECK (rate >= 0 AND rate <= 100),
  is_compound         BOOLEAN NOT NULL DEFAULT FALSE,
  taxable_amount      DECIMAL(19,4) NOT NULL,
  tax_amount          DECIMAL(19,4) NOT NULL,
  currency_code       TEXT NOT NULL,
  exchange_rate       DECIMAL(19,6) NOT NULL DEFAULT 1,
  applied_seq         SMALLINT NOT NULL DEFAULT 1,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID,
  created_info        TEXT,
  updated_at          TIMESTAMPTZ,
  updated_by          UUID,
  updated_info        TEXT,
  metadata            JSONB
);
-- Note: no rec_status — immutable ledger row; void handled at order level

CREATE INDEX IF NOT EXISTS idx_order_taxes_order
  ON org_order_taxes_dtl (tenant_org_id, order_id);
CREATE INDEX IF NOT EXISTS idx_order_taxes_type
  ON org_order_taxes_dtl (tenant_org_id, tax_type);

ALTER TABLE org_order_taxes_dtl ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_org_order_taxes_dtl
  ON org_order_taxes_dtl FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());
```

**Prisma:** Add `org_order_taxes_dtl` model.

#### P1.3 — Migration 0282: Order Financial Snapshot Columns
**File:** `supabase/migrations/0282_orders_financial_snapshot.sql`

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
  payment_status              TEXT DEFAULT 'UNPAID'
                                CHECK (payment_status IN (
                                  'UNPAID',
                                  'PENDING_COLLECTION',
                                  'PARTIALLY_PAID',
                                  'PAID',
                                  'OVERPAID',
                                  'REFUNDED',
                                  'PARTIALLY_REFUNDED'
                                )),
  rounding_adjustment_amount  DECIMAL(19,4) DEFAULT 0,
  change_returned_amount      DECIMAL(19,4) DEFAULT 0,
  outstanding_amount          DECIMAL(19,4),
  financial_engine_version    SMALLINT DEFAULT 1;
```

**Prisma:** Add these fields to `org_orders_mst` model.

#### P1.4 — Migration 0283: Harden Credit Apps + Fix Refund FK
**File:** `supabase/migrations/0283_harden_credit_apps_refunds.sql`

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

-- Add payment_nature_snapshot to org_order_payments_dtl
-- Enforces that this table contains REAL_PAYMENT legs only.
-- Credit applications and deferred settlements are NEVER written here.
ALTER TABLE org_order_payments_dtl
  ADD COLUMN IF NOT EXISTS payment_nature_snapshot TEXT
    NOT NULL DEFAULT 'REAL_PAYMENT'
    CHECK (payment_nature_snapshot = 'REAL_PAYMENT');
```

**Prisma:** Update `org_order_credit_apps_dtl` and `org_order_refunds_dtl` models to reflect new columns + FK change. Add `payment_nature_snapshot` field to `org_order_payments_dtl` model.

---

### PHASE 2 — Stored Value Tables

#### P2.1 — Migration 0284: Wallet
**File:** `supabase/migrations/0284_customer_wallets.sql`

```sql
CREATE TABLE org_customer_wallets_mst (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id    UUID NOT NULL,
  customer_id      UUID NOT NULL REFERENCES org_customers_mst(id) ON DELETE RESTRICT,
  balance          DECIMAL(19,4) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  currency_code    TEXT NOT NULL,
  last_activity_at TIMESTAMPTZ,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  rec_status       SMALLINT NOT NULL DEFAULT 1,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       UUID,
  created_info     TEXT,
  updated_at       TIMESTAMPTZ,
  updated_by       UUID,
  updated_info     TEXT,
  metadata         JSONB,
  CONSTRAINT uq_wallet_per_customer UNIQUE (tenant_org_id, customer_id)
);

CREATE TABLE org_wallet_txn_dtl (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id   UUID NOT NULL,
  wallet_id       UUID NOT NULL REFERENCES org_customer_wallets_mst(id) ON DELETE RESTRICT,
  customer_id     UUID NOT NULL,
  txn_type        TEXT NOT NULL CHECK (txn_type IN ('TOP_UP','REDEMPTION','REFUND','EXPIRY','CORRECTION')),
  amount          DECIMAL(19,4) NOT NULL,
  currency_code   TEXT NOT NULL,
  exchange_rate   DECIMAL(19,6) NOT NULL DEFAULT 1,
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
  created_info    TEXT,
  CONSTRAINT uq_wallet_txn_idempotency UNIQUE (tenant_org_id, idempotency_key)
);
-- Note: txn rows are immutable (no updated_at) — append-only ledger

CREATE INDEX IF NOT EXISTS idx_wallets_customer
  ON org_customer_wallets_mst (tenant_org_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_wallet_txn_wallet
  ON org_wallet_txn_dtl (tenant_org_id, wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_txn_order
  ON org_wallet_txn_dtl (tenant_org_id, order_id) WHERE order_id IS NOT NULL;

ALTER TABLE org_customer_wallets_mst ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_org_customer_wallets_mst
  ON org_customer_wallets_mst FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

ALTER TABLE org_wallet_txn_dtl ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_org_wallet_txn_dtl
  ON org_wallet_txn_dtl FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());
```

**Prisma:** Add `org_customer_wallets_mst` + `org_wallet_txn_dtl` models.

#### P2.2 — Migration 0285: Customer Advances
**File:** `supabase/migrations/0285_customer_advances.sql`

Same structure pattern as wallet. Separate table per business semantics (advance = pre-payment deposited, wallet = topped-up credit).

```sql
CREATE TABLE org_customer_advances_mst (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id    UUID NOT NULL,
  customer_id      UUID NOT NULL REFERENCES org_customers_mst(id) ON DELETE RESTRICT,
  balance          DECIMAL(19,4) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  currency_code    TEXT NOT NULL,
  last_activity_at TIMESTAMPTZ,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  rec_status       SMALLINT NOT NULL DEFAULT 1,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       UUID,
  created_info     TEXT,
  updated_at       TIMESTAMPTZ,
  updated_by       UUID,
  updated_info     TEXT,
  metadata         JSONB,
  CONSTRAINT uq_advance_per_customer UNIQUE (tenant_org_id, customer_id)
);

CREATE TABLE org_advance_txn_dtl (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id   UUID NOT NULL,
  advance_id      UUID NOT NULL REFERENCES org_customer_advances_mst(id) ON DELETE RESTRICT,
  customer_id     UUID NOT NULL,
  txn_type        TEXT NOT NULL CHECK (txn_type IN ('ISSUE','REDEMPTION','REFUND','CORRECTION')),
  amount          DECIMAL(19,4) NOT NULL,
  currency_code   TEXT NOT NULL,
  exchange_rate   DECIMAL(19,6) NOT NULL DEFAULT 1,
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
  created_info    TEXT,
  CONSTRAINT uq_advance_txn_idempotency UNIQUE (tenant_org_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_advances_customer
  ON org_customer_advances_mst (tenant_org_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_advance_txn_advance
  ON org_advance_txn_dtl (tenant_org_id, advance_id);
CREATE INDEX IF NOT EXISTS idx_advance_txn_order
  ON org_advance_txn_dtl (tenant_org_id, order_id) WHERE order_id IS NOT NULL;

ALTER TABLE org_customer_advances_mst ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_org_customer_advances_mst
  ON org_customer_advances_mst FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

ALTER TABLE org_advance_txn_dtl ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_org_advance_txn_dtl
  ON org_advance_txn_dtl FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());
```

**Prisma:** Add both models.

#### P2.3 — Migration 0286: Credit Notes
**File:** `supabase/migrations/0286_credit_notes.sql`

```sql
CREATE TABLE org_credit_notes_mst (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id     UUID NOT NULL,
  customer_id       UUID NOT NULL REFERENCES org_customers_mst(id) ON DELETE RESTRICT,
  credit_note_no    TEXT NOT NULL,
  original_amount   DECIMAL(19,4) NOT NULL,
  remaining_balance DECIMAL(19,4) NOT NULL,
  currency_code     TEXT NOT NULL,
  reason            TEXT NOT NULL,
  related_order_id  UUID,
  expires_at        DATE,
  status            TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','EXHAUSTED','EXPIRED','CANCELLED')),
  issued_by         UUID,
  issued_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_by      UUID,
  cancelled_at      TIMESTAMPTZ,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  rec_status        SMALLINT NOT NULL DEFAULT 1,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID,
  created_info      TEXT,
  updated_at        TIMESTAMPTZ,
  updated_by        UUID,
  updated_info      TEXT,
  metadata          JSONB,
  CONSTRAINT uq_credit_note_no UNIQUE (tenant_org_id, credit_note_no)
);

CREATE TABLE org_credit_note_txn_dtl (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id   UUID NOT NULL,
  credit_note_id  UUID NOT NULL REFERENCES org_credit_notes_mst(id) ON DELETE RESTRICT,
  customer_id     UUID NOT NULL,
  txn_type        TEXT NOT NULL CHECK (txn_type IN ('ISSUE','REDEMPTION','REFUND','EXPIRY','CORRECTION')),
  amount          DECIMAL(19,4) NOT NULL,
  currency_code   TEXT NOT NULL,
  exchange_rate   DECIMAL(19,6) NOT NULL DEFAULT 1,
  balance_before  DECIMAL(19,4) NOT NULL,
  balance_after   DECIMAL(19,4) NOT NULL,
  order_id        UUID,
  credit_app_id   UUID,
  idempotency_key TEXT,
  notes           TEXT,
  performed_by    UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID,
  created_info    TEXT,
  CONSTRAINT uq_cn_txn_idempotency UNIQUE (tenant_org_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_credit_notes_customer
  ON org_credit_notes_mst (tenant_org_id, customer_id, status);
CREATE INDEX IF NOT EXISTS idx_credit_notes_no
  ON org_credit_notes_mst (tenant_org_id, credit_note_no);
CREATE INDEX IF NOT EXISTS idx_cn_txn_note
  ON org_credit_note_txn_dtl (tenant_org_id, credit_note_id);
CREATE INDEX IF NOT EXISTS idx_cn_txn_order
  ON org_credit_note_txn_dtl (tenant_org_id, order_id) WHERE order_id IS NOT NULL;

ALTER TABLE org_credit_notes_mst ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_org_credit_notes_mst
  ON org_credit_notes_mst FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

ALTER TABLE org_credit_note_txn_dtl ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_org_credit_note_txn_dtl
  ON org_credit_note_txn_dtl FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());
```

**Prisma:** Add both models.

---

### PHASE 3 — Loyalty

#### P3.1 — Migration 0287: Loyalty Tables
**File:** `supabase/migrations/0287_loyalty.sql`

```sql
CREATE TABLE org_loyalty_programs_cf (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id             UUID NOT NULL,
  program_name              TEXT NOT NULL,
  program_name2             TEXT,
  earn_rate_per_unit        DECIMAL(10,4) NOT NULL DEFAULT 1,
  redeem_rate_per_point     DECIMAL(10,6) NOT NULL DEFAULT 0.01,
  min_redeem_points         INTEGER NOT NULL DEFAULT 100,
  max_redeem_pct_of_order   DECIMAL(5,2) NOT NULL DEFAULT 20.00,
  points_expiry_days        INTEGER,
  is_active                 BOOLEAN NOT NULL DEFAULT TRUE,
  rec_status                SMALLINT NOT NULL DEFAULT 1,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by                UUID,
  created_info              TEXT,
  updated_at                TIMESTAMPTZ,
  updated_by                UUID,
  updated_info              TEXT,
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
  rec_status        SMALLINT NOT NULL DEFAULT 1,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID,
  created_info      TEXT,
  updated_at        TIMESTAMPTZ,
  updated_by        UUID,
  updated_info      TEXT
);

CREATE TABLE org_loyalty_accounts_mst (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id    UUID NOT NULL,
  customer_id      UUID NOT NULL REFERENCES org_customers_mst(id) ON DELETE RESTRICT,
  program_id       UUID NOT NULL REFERENCES org_loyalty_programs_cf(id),
  points_balance   INTEGER NOT NULL DEFAULT 0 CHECK (points_balance >= 0),
  lifetime_earned  INTEGER NOT NULL DEFAULT 0,
  current_tier_id  UUID REFERENCES org_loyalty_tiers_cf(id),
  last_activity_at TIMESTAMPTZ,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  rec_status       SMALLINT NOT NULL DEFAULT 1,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       UUID,
  created_info     TEXT,
  updated_at       TIMESTAMPTZ,
  updated_by       UUID,
  updated_info     TEXT,
  CONSTRAINT uq_loyalty_acct UNIQUE (tenant_org_id, customer_id)
);

CREATE TABLE org_loyalty_txn_dtl (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id   UUID NOT NULL,
  account_id      UUID NOT NULL REFERENCES org_loyalty_accounts_mst(id),
  customer_id     UUID NOT NULL,
  txn_type        TEXT NOT NULL CHECK (txn_type IN ('EARN','REDEEM','EXPIRE','ADJUST','BONUS')),
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_loyalty_programs_tenant
  ON org_loyalty_programs_cf (tenant_org_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_tiers_program
  ON org_loyalty_tiers_cf (tenant_org_id, program_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_customer
  ON org_loyalty_accounts_mst (tenant_org_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_txn_account
  ON org_loyalty_txn_dtl (tenant_org_id, account_id);

-- RLS
ALTER TABLE org_loyalty_programs_cf ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_org_loyalty_programs_cf
  ON org_loyalty_programs_cf FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

ALTER TABLE org_loyalty_tiers_cf ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_org_loyalty_tiers_cf
  ON org_loyalty_tiers_cf FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

ALTER TABLE org_loyalty_accounts_mst ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_org_loyalty_accounts_mst
  ON org_loyalty_accounts_mst FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

ALTER TABLE org_loyalty_txn_dtl ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_org_loyalty_txn_dtl
  ON org_loyalty_txn_dtl FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());
```

**Seed data — loyalty programs + tiers for both demo tenants:**
```sql
-- ─── Tenant 1 Program ───
WITH prog1 AS (
  INSERT INTO org_loyalty_programs_cf
    (id, tenant_org_id, program_name, program_name2,
     earn_rate_per_unit, redeem_rate_per_point,
     min_redeem_points, max_redeem_pct_of_order,
     points_expiry_days, is_active, rec_status)
  VALUES
    ('aaaaaaaa-0001-0001-0001-000000000001',
     '11111111-1111-1111-1111-111111111111',
     'CleanMate Rewards', 'مكافآت كلين ميت',
     1.00, 0.01, 100, 20.00, 365, true, 1)
  RETURNING id
)
INSERT INTO org_loyalty_tiers_cf
  (id, tenant_org_id, program_id, name, name2,
   min_points, bonus_multiplier, sort_order, is_active, rec_status)
SELECT
  gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
  id, name, name2, min_pts, multiplier, ord, true, 1
FROM prog1
CROSS JOIN (VALUES
  ('Bronze',   'برونزي',      0,     1.00, 1),
  ('Silver',   'فضي',         1000,  1.25, 2),
  ('Gold',     'ذهبي',        5000,  1.50, 3),
  ('Platinum', 'بلاتيني',     15000, 2.00, 4),
  ('VIP',      'في آي بي',    50000, 3.00, 5)
) AS t(name, name2, min_pts, multiplier, ord);

-- ─── Tenant 2 Program ───
WITH prog2 AS (
  INSERT INTO org_loyalty_programs_cf
    (id, tenant_org_id, program_name, program_name2,
     earn_rate_per_unit, redeem_rate_per_point,
     min_redeem_points, max_redeem_pct_of_order,
     points_expiry_days, is_active, rec_status)
  VALUES
    ('aaaaaaaa-0002-0002-0002-000000000002',
     'c9ac29d1-219c-4a3a-8887-f860550c32be',
     'Prestige Points', 'نقاط البرستيج',
     1.50, 0.015, 50, 25.00, 730, true, 1)
  RETURNING id
)
INSERT INTO org_loyalty_tiers_cf
  (id, tenant_org_id, program_id, name, name2,
   min_points, bonus_multiplier, sort_order, is_active, rec_status)
SELECT
  gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
  id, name, name2, min_pts, multiplier, ord, true, 1
FROM prog2
CROSS JOIN (VALUES
  ('Member',   'عضو',         0,     1.00, 1),
  ('Silver',   'فضي',         2000,  1.25, 2),
  ('Gold',     'ذهبي',        8000,  1.75, 3),
  ('Diamond',  'ألماسي',      25000, 2.50, 4)
) AS t(name, name2, min_pts, multiplier, ord);
```

**Prisma:** Add all 4 models.

---

### PHASE 4 — Promotions Engine

> Renames `org_promo_codes_mst` → `org_promotions_mst` and `org_promo_usage_log` → `org_promotion_usage_dtl`, then extends both with campaign-level fields. No new tables are created.

#### P4.1 — Migration 0288: Extend Promotion Tables
**File:** `supabase/migrations/0288_extend_promo_tables.sql`

```sql
-- ── Step 1: Rename tables ───────────────────────────────────────────────────
ALTER TABLE org_promo_codes_mst    RENAME TO org_promotions_mst;
ALTER TABLE org_promo_usage_log    RENAME TO org_promotion_usage_dtl;

-- Rename existing indexes to match new table names (originals used old table name)
ALTER INDEX IF EXISTS idx_promo_codes_tenant   RENAME TO idx_promotions_tenant;
ALTER INDEX IF EXISTS idx_promo_codes_code     RENAME TO idx_promotions_code;
ALTER INDEX IF EXISTS idx_promo_codes_validity RENAME TO idx_promotions_validity;
ALTER INDEX IF EXISTS idx_promo_usage_tenant   RENAME TO idx_promo_usage_dtl_tenant;
ALTER INDEX IF EXISTS idx_promo_usage_promo    RENAME TO idx_promo_usage_dtl_promo;
ALTER INDEX IF EXISTS idx_promo_usage_customer RENAME TO idx_promo_usage_dtl_customer;
ALTER INDEX IF EXISTS idx_promo_usage_order    RENAME TO idx_promo_usage_dtl_order;

-- Drop + recreate RLS policies with new table name
DROP POLICY IF EXISTS tenant_isolation_org_promo_codes_mst ON org_promotions_mst;
CREATE POLICY tenant_isolation_org_promotions_mst ON org_promotions_mst
  FOR ALL USING (tenant_org_id IN (
    SELECT tenant_org_id FROM org_users_mst WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS tenant_isolation_org_promo_usage_log ON org_promotion_usage_dtl;
CREATE POLICY tenant_isolation_org_prom_usage_dtl ON org_promotion_usage_dtl
  FOR ALL USING (tenant_org_id IN (
    SELECT tenant_org_id FROM org_users_mst WHERE user_id = auth.uid()
  ));

-- ── Step 2: Extend org_promotions_mst ──────────────────────────────────────
-- Allow NULL promo_code for auto-apply rules (existing column is NOT NULL)
ALTER TABLE org_promotions_mst
  ALTER COLUMN promo_code DROP NOT NULL;

-- New campaign-level columns
ALTER TABLE org_promotions_mst
  ADD COLUMN IF NOT EXISTS promo_type               TEXT,
  ADD COLUMN IF NOT EXISTS stackable                BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stacking_group           TEXT,
  ADD COLUMN IF NOT EXISTS max_stacking_discount    DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS applicable_customer_grps TEXT[],
  ADD COLUMN IF NOT EXISTS currency_code            TEXT,
  ADD COLUMN IF NOT EXISTS exchange_rate            DECIMAL(19,6) NOT NULL DEFAULT 1;

-- Index for auto-apply rule lookup
CREATE INDEX IF NOT EXISTS idx_promo_codes_auto_apply
  ON org_promotions_mst (tenant_org_id, is_active, valid_from, valid_to)
  WHERE promo_code IS NULL;

-- ── Step 3: Extend org_promotion_usage_dtl ────────────────────────────────
ALTER TABLE org_promotion_usage_dtl
  ADD COLUMN IF NOT EXISTS currency_code   TEXT,
  ADD COLUMN IF NOT EXISTS exchange_rate   DECIMAL(19,6) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

ALTER TABLE org_promotion_usage_dtl
  ADD CONSTRAINT uq_promo_usage_idempotency
    UNIQUE (tenant_org_id, idempotency_key);

-- ── Step 4: FK on org_order_discounts_dtl.promotion_id ────────────────────
-- org_promotions_mst now exists (renamed above) — add FK directly
ALTER TABLE org_order_discounts_dtl
  ADD CONSTRAINT fk_ord_disc_promo
    FOREIGN KEY (promotion_id) REFERENCES org_promotions_mst(id) ON DELETE SET NULL;
```

**Existing column name mapping** (use these names everywhere — do NOT alias):

| Plan concept | Existing DB column |
|---|---|
| `usage_limit` | `max_uses` |
| `usage_limit_per_customer` | `max_uses_per_customer` |
| `usage_count` | `current_uses` |
| `minimum_order_amount` | `min_order_amount` |
| `name` / `name2` | `promo_name` / `promo_name2` |

**Seed data — realistic promotions for both demo tenants (INSERT into `org_promotions_mst`):**
```sql
-- ─── Tenant 1: Oman market promotions (OMR) ───
-- Note: discount_type uses existing DB values ('percentage' / 'fixed_amount' lowercase)
INSERT INTO org_promotions_mst
  (id, tenant_org_id, promo_code, promo_name, promo_name2,
   discount_type, discount_value, promo_type,
   min_order_amount, max_uses, max_uses_per_customer,
   valid_from, valid_to, stackable, currency_code,
   is_active, rec_status, created_by) VALUES

-- Welcome offer — auto-apply (NULL code), first order only
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
  NULL, 'Welcome 10% Off', 'خصم ترحيبي 10%',
  'percentage', 10.000, 'PERCENTAGE',
  NULL, NULL, 1, '2024-01-01', NULL, false, 'OMR', true, 1, NULL),

-- Ramadan campaign — coupon code
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
  'RAMADAN25', 'Ramadan Special 25%', 'عرض رمضان 25%',
  'percentage', 25.000, 'PERCENTAGE',
  20.000, 500, 1, '2025-03-01', '2025-03-31', false, 'OMR', true, 1, NULL),

-- Fixed OMR discount — requires minimum order
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
  'SAVE8', 'Save 8 OMR', 'وفّر 8 ريال عماني',
  'fixed_amount', 8.000, 'FIXED_AMOUNT',
  40.000, 1000, 2, '2024-01-01', NULL, false, 'OMR', true, 1, NULL),

-- Weekend bonus — stackable with loyalty
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
  'WEEKEND15', 'Weekend 15% Off', 'خصم نهاية الأسبوع 15%',
  'percentage', 15.000, 'PERCENTAGE',
  12.000, NULL, NULL, '2024-01-01', NULL, true, 'OMR', true, 1, NULL),

-- Bulk order discount — auto-apply, no code
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
  NULL, 'Bulk Order 5% Off', 'خصم الطلبات الكبيرة 5%',
  'percentage', 5.000, 'PERCENTAGE',
  80.000, NULL, NULL, '2024-01-01', NULL, true, 'OMR', true, 1, NULL),

-- B2B corporate code
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
  'CORP30', 'Corporate Partner 30%', 'شريك مؤسسي 30%',
  'percentage', 30.000, 'PERCENTAGE',
  60.000, NULL, NULL, '2024-01-01', NULL, false, 'OMR', true, 1, NULL);

-- ─── Tenant 2: Saudi market promotions (SAR) ───
INSERT INTO org_promotions_mst
  (id, tenant_org_id, promo_code, promo_name, promo_name2,
   discount_type, discount_value, promo_type,
   min_order_amount, max_uses, max_uses_per_customer,
   valid_from, valid_to, stackable, currency_code,
   is_active, rec_status, created_by) VALUES

-- Welcome offer — auto-apply, first order only
(gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
  NULL, 'First Order 20 SAR Off', 'خصم 20 ريال للطلب الأول',
  'fixed_amount', 20.000, 'FIXED_AMOUNT',
  NULL, NULL, 1, '2024-01-01', NULL, false, 'SAR', true, 1, NULL),

-- Saudi National Day campaign (September 23 — 94th)
(gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
  'KSA94', 'National Day 25% Off', 'عروض اليوم الوطني 25%',
  'percentage', 25.000, 'PERCENTAGE',
  80.000, 500, 1, '2025-09-20', '2025-09-23', false, 'SAR', true, 1, NULL),

-- Referral bonus
(gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
  'REFER25', 'Referral 25 SAR', 'مكافأة الإحالة 25 ريال',
  'fixed_amount', 25.000, 'FIXED_AMOUNT',
  50.000, NULL, 1, '2024-01-01', NULL, false, 'SAR', true, 1, NULL),

-- VIP member stackable — auto-apply
(gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
  NULL, 'VIP Member 10% Extra', 'خصم إضافي للأعضاء 10%',
  'percentage', 10.000, 'PERCENTAGE',
  NULL, NULL, NULL, '2024-01-01', NULL, true, 'SAR', true, 1, NULL),

-- Summer clearance
(gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
  'SUMMER20', 'Summer Sale 20%', 'تخفيضات الصيف 20%',
  'percentage', 20.000, 'PERCENTAGE',
  60.000, 300, 2, '2025-06-01', '2025-08-31', false, 'SAR', true, 1, NULL),

-- Express service add-on (stackable)
(gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
  'EXPRESS30', 'Express 30 SAR Off', 'خصم 30 ريال على الخدمة السريعة',
  'fixed_amount', 30.000, 'FIXED_AMOUNT',
  150.000, NULL, NULL, '2024-01-01', NULL, true, 'SAR', true, 1, NULL);
```

**Prisma:** Rename model `org_promo_codes_mst` → `org_promotions_mst` and `org_promo_usage_log` → `org_promotion_usage_dtl`. Add 7 new fields to `org_promotions_mst`. Add 3 new fields + unique constraint to `org_promotion_usage_dtl`. Update all `@@map` decorators and relation references across the schema.

---

### PHASE 5 — Tax Configuration

#### P5.1 — Migration 0289: Tax Profiles
**File:** `supabase/migrations/0289_tax_config.sql`

```sql
CREATE TABLE org_tax_profiles_cf (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id   UUID NOT NULL,
  name            TEXT NOT NULL,
  name2           TEXT,
  tax_type        TEXT NOT NULL CHECK (tax_type IN ('VAT','GST','CUSTOM')),
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
  created_info    TEXT,
  updated_at      TIMESTAMPTZ,
  updated_by      UUID,
  updated_info    TEXT
);

CREATE INDEX IF NOT EXISTS idx_tax_profiles_tenant
  ON org_tax_profiles_cf (tenant_org_id, is_active, is_default);

ALTER TABLE org_tax_profiles_cf ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_org_tax_profiles_cf
  ON org_tax_profiles_cf FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

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
  rec_status      SMALLINT NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID,
  created_info    TEXT,
  updated_at      TIMESTAMPTZ,
  updated_by      UUID,
  updated_info    TEXT
);

CREATE INDEX IF NOT EXISTS idx_tax_exemptions_tenant
  ON org_tax_exemptions_cf (tenant_org_id, customer_id, is_active);

ALTER TABLE org_tax_exemptions_cf ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_org_tax_exemptions_cf
  ON org_tax_exemptions_cf FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());
```

Add FK from `org_order_taxes_dtl.tax_profile_id → org_tax_profiles_cf(id)` in this migration.

**Seed data for both demo tenants** — realistic GCC-market tax profiles:
```sql
-- ─── Tenant 1: 11111111-1111-1111-1111-111111111111 (Oman / OMR) ───
-- Oman introduced VAT at 5% effective April 2021 (Royal Decree 121/2020)
INSERT INTO org_tax_profiles_cf
  (id, tenant_org_id, name, name2, tax_type, rate, is_compound,
   applies_to, effective_from, is_default, is_active, rec_status, created_by) VALUES
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
  'VAT 5%', 'ضريبة القيمة المضافة 5%',
  'VAT', 5.00, false, NULL, '2024-01-01', true, true, 1, NULL),

(gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
  'VAT Exempt', 'معفى من ضريبة القيمة المضافة',
  'VAT', 0.00, false, ARRAY['EXEMPT_SERVICE'], '2024-01-01', false, true, 1, NULL),

(gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
  'Zero-Rated VAT', 'ضريبة صفرية',
  'VAT', 0.00, false, ARRAY['EXPORT'], '2024-01-01', false, true, 1, NULL),

(gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
  'Selective Tax 100%', 'ضريبة انتقائية 100%',
  'CUSTOM', 100.00, false, ARRAY['TOBACCO'], '2024-01-01', false, true, 1, NULL);

-- ─── Tenant 2: c9ac29d1-219c-4a3a-8887-f860550c32be (Saudi Arabia / SAR) ───
-- Saudi VAT raised to 15% effective July 2020 (Royal Decree M/113)
INSERT INTO org_tax_profiles_cf
  (id, tenant_org_id, name, name2, tax_type, rate, is_compound,
   applies_to, effective_from, is_default, is_active, rec_status, created_by) VALUES
(gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
  'VAT 15%', 'ضريبة القيمة المضافة 15%',
  'VAT', 15.00, false, NULL, '2024-01-01', true, true, 1, NULL),

(gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
  'VAT Exempt', 'معفى من ضريبة القيمة المضافة',
  'VAT', 0.00, false, ARRAY['EXEMPT_SERVICE'], '2024-01-01', false, true, 1, NULL),

(gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
  'Zero-Rated VAT', 'ضريبة صفرية',
  'VAT', 0.00, false, ARRAY['EXPORT'], '2024-01-01', false, true, 1, NULL),

(gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
  'Selective Tax 100%', 'ضريبة انتقائية 100%',
  'CUSTOM', 100.00, false, ARRAY['TOBACCO'], '2024-01-01', false, true, 1, NULL),

(gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
  'Municipal Fee 2%', 'رسوم بلدية 2%',
  'CUSTOM', 2.00, false, NULL, '2024-01-01', false, true, 1, NULL);
```

**Seed for `org_tax_exemptions_cf`** — sample B2B exemption for each tenant:
```sql
INSERT INTO org_tax_exemptions_cf
  (id, tenant_org_id, customer_id, exemption_type, certificate_no,
   valid_from, is_active, created_by) VALUES
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
  NULL, 'GOVERNMENT_ENTITY', 'GOV-OM-2024-001', '2024-01-01', true, NULL),
(gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
  NULL, 'GOVERNMENT_ENTITY', 'GOV-SA-2024-001', '2024-01-01', true, NULL),
(gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
  NULL, 'DIPLOMATIC_MISSION', 'DIP-SA-2024-001', '2024-01-01', true, NULL);
```

**Prisma:** Add both models + update `org_order_taxes_dtl` relation.

---

### PHASE 6 — Infrastructure Tables

#### P6.1 — Migration 0290: Currency Rounding Rules
**File:** `supabase/migrations/0290_currency_rounding.sql`

```sql
CREATE TABLE sys_currency_rounding_rules_cd (
  currency_code     TEXT PRIMARY KEY,
  rounding_method   TEXT NOT NULL DEFAULT 'HALF_UP'
                      CHECK (rounding_method IN ('HALF_UP','HALF_DOWN','FLOOR','CEIL')),
  rounding_unit     DECIMAL(10,6) NOT NULL DEFAULT 0.01,
  notes             TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  rec_status        SMALLINT NOT NULL DEFAULT 1,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Seed data (all GCC + common international currencies):**
```sql
INSERT INTO sys_currency_rounding_rules_cd
  (currency_code, rounding_method, rounding_unit, notes) VALUES
-- GCC
('SAR', 'HALF_UP', 0.01,   'Saudi Riyal — 2 decimals; 0.01 halalas'),
('AED', 'HALF_UP', 0.01,   'UAE Dirham — 2 decimals; fils'),
('QAR', 'HALF_UP', 0.01,   'Qatari Riyal — 2 decimals; dirham'),
('KWD', 'HALF_UP', 0.001,  'Kuwaiti Dinar — 3 decimals; fils'),
('BHD', 'HALF_UP', 0.001,  'Bahraini Dinar — 3 decimals; fils'),
('OMR', 'HALF_UP', 0.001,  'Omani Rial — 3 decimals; baisa'),
-- Arab region
('EGP', 'HALF_UP', 0.01,   'Egyptian Pound — 2 decimals; piastres'),
('JOD', 'HALF_UP', 0.001,  'Jordanian Dinar — 3 decimals; fils'),
('LBP', 'HALF_UP', 1.00,   'Lebanese Pound — 0 decimals'),
-- International
('USD', 'HALF_UP', 0.01,   'US Dollar — 2 decimals; cents'),
('GBP', 'HALF_UP', 0.01,   'British Pound — 2 decimals; pence'),
('EUR', 'HALF_UP', 0.01,   'Euro — 2 decimals; cents'),
('INR', 'HALF_UP', 0.01,   'Indian Rupee — 2 decimals; paise');
```

**Prisma:** Add `sys_currency_rounding_rules_cd` model.

#### P6.2 — Migration 0291: Extend org_payment_methods_cf + Seed Payment Config

**File:** `supabase/migrations/0291_payment_config_seed.sql`

`org_payment_methods_cf` is the **unified tenant checkout settlement options config table**.
`payment_nature` controls backend routing. The table covers real payments, credit applications,
deferred settlements, and AR options — not only "payment methods" in the narrow sense.

**Key facts verified from existing migrations:**
- `org_payment_methods_cf` created in 0269 — already has gateway-aware unique index `uq_org_payment_methods_cf`
- `sys_payment_gateway_cd` exists (0043) with STRIPE, HYPERPAY, PAYTABS — no `is_globally_disabled` yet
- `sys_payment_type_cd` exists (0001) — PKs: `PAY_IN_ADVANCE`, `PAY_ON_COLLECTION`, `PAY_ON_DELIVERY`, `CREDIT_INVOICE`
- In `sys_payment_method_cd`: `PAY_ON_COLLECTION` and `INVOICE` are deprecated (migration 0267); `PAYMENT_GATEWAY` is already seeded
- `PAY_ON_DELIVERY` and `CREDIT_INVOICE` do NOT exist in `sys_payment_method_cd` — must be added in Step 3

```sql
-- ── Step 0a: Add HQ-level disable controls to sys_payment_method_cd ──────────
-- HQ disables a payment method code globally across ALL tenants
ALTER TABLE sys_payment_method_cd
  ADD COLUMN IF NOT EXISTS is_globally_disabled      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS globally_disabled_reason  TEXT,
  ADD COLUMN IF NOT EXISTS globally_disabled_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS globally_disabled_by      TEXT;

-- ── Step 0b: Add HQ-level disable controls to sys_payment_gateway_cd ─────────
-- HQ disables a gateway globally (e.g. fraud incident, platform contract termination)
ALTER TABLE sys_payment_gateway_cd
  ADD COLUMN IF NOT EXISTS is_globally_disabled      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS globally_disabled_reason  TEXT,
  ADD COLUMN IF NOT EXISTS globally_disabled_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS globally_disabled_by      TEXT;

-- ── Step 0c: Add platform-level disable controls to org_payment_methods_cf ───
-- HQ disables a method for a SPECIFIC tenant only (compliance, plan restriction)
ALTER TABLE org_payment_methods_cf
  ADD COLUMN IF NOT EXISTS is_platform_disabled      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS platform_disabled_reason  TEXT,
  ADD COLUMN IF NOT EXISTS platform_disabled_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS platform_disabled_by      TEXT;

-- ── Step 1: Extend org_payment_methods_cf with routing + eligibility columns ─
ALTER TABLE org_payment_methods_cf
  ADD COLUMN IF NOT EXISTS settlement_type_code    TEXT
    CHECK (settlement_type_code IN (
      'PAY_IN_ADVANCE','PAY_ON_COLLECTION','PAY_ON_DELIVERY','CREDIT_INVOICE'
    )),
  ADD COLUMN IF NOT EXISTS credit_application_type TEXT
    CHECK (credit_application_type IN (
      'GIFT_CARD','WALLET','ADVANCE','CREDIT_NOTE','LOYALTY_POINTS'
    )),
  ADD COLUMN IF NOT EXISTS requires_cash_drawer    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS requires_terminal       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS min_order_amount        DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS max_order_amount        DECIMAL(19,4);
  -- NOTE: existing min_amount/max_amount = per-option amount limits (e.g. max gift card redemption)
  --       min_order_amount/max_order_amount = order-total eligibility filters for checkout UI

-- ── Step 2: Unique index — ALREADY EXISTS ────────────────────────────────────
-- migration 0269 created: uq_org_payment_methods_cf ON
--   org_payment_methods_cf (tenant_org_id, payment_method_code, COALESCE(gateway_code, ''))
-- No action needed. Do NOT recreate — would create a redundant duplicate index.

-- ── Step 3: Seed sys_payment_method_cd — add missing codes ────────────────────
-- Adds CREDIT_APPLICATION codes (GIFT_CARD, WALLET, ADVANCE, CREDIT_NOTE, LOYALTY_POINTS).
-- Adds PAY_ON_DELIVERY (DEFERRED_SETTLEMENT) — needed for Batch C FK.
-- Adds CREDIT_INVOICE (AR_ALLOCATION, is_enabled=false) — replaces deprecated INVOICE.
-- Re-activates PAY_ON_COLLECTION (was deprecated in 0267; unified design needs it active).
-- PAYMENT_GATEWAY already seeded in 0267 — ON CONFLICT DO NOTHING handles it.
-- HYPERPAY/PAYTABS/STRIPE remain deprecated as PROVIDER (not globally disabled).
INSERT INTO sys_payment_method_cd
  (payment_method_code, payment_method_name, payment_method_name2,
   payment_nature, method_category, is_enabled, is_active, rec_status,
   is_deprecated, replacement_code)
VALUES
  ('GIFT_CARD',       'Gift Card',            'بطاقة هدية',         'CREDIT_APPLICATION',  'STORED_VALUE', true,  true, 1, false, NULL),
  ('WALLET',          'Wallet',               'المحفظة',            'CREDIT_APPLICATION',  'STORED_VALUE', true,  true, 1, false, NULL),
  ('ADVANCE',         'Customer Advance',     'سلفة العميل',        'CREDIT_APPLICATION',  'STORED_VALUE', true,  true, 1, false, NULL),
  ('CREDIT_NOTE',     'Credit Note',          'إشعار دائن',         'CREDIT_APPLICATION',  'STORED_VALUE', true,  true, 1, false, NULL),
  ('LOYALTY_POINTS',  'Loyalty Points',       'نقاط الولاء',        'CREDIT_APPLICATION',  'LOYALTY',      true,  true, 1, false, NULL),
  ('PAYMENT_GATEWAY', 'Payment Gateway',      'بوابة الدفع',        'REAL_PAYMENT',        'GATEWAY',      true,  true, 1, false, NULL),
  ('PAY_ON_DELIVERY', 'Pay on Delivery',      'الدفع عند التسليم',  'DEFERRED_SETTLEMENT', 'TIMING',       true,  true, 1, false, NULL),
  ('CREDIT_INVOICE',  'Credit Invoice',       'فاتورة آجلة',        'AR_ALLOCATION',       'INVOICE',      false, true, 1, false, NULL)
ON CONFLICT (payment_method_code) DO NOTHING;

-- Re-activate PAY_ON_COLLECTION — was deprecated in 0267 but unified design requires it
-- as an active, non-deprecated code for the FK and checkout visibility
UPDATE sys_payment_method_cd
SET is_deprecated = false, is_active = true, rec_status = 1,
    payment_nature = 'DEFERRED_SETTLEMENT', method_category = 'TIMING',
    replacement_code = NULL
WHERE payment_method_code = 'PAY_ON_COLLECTION';

-- HYPERPAY/PAYTABS/STRIPE remain deprecated (PROVIDER nature) — no change needed
-- INVOICE remains deprecated — replaced by CREDIT_INVOICE above
```

**Prisma:**
- `sys_payment_method_cd`: Add `is_globally_disabled`, `globally_disabled_reason`, `globally_disabled_at`, `globally_disabled_by` fields.
- `sys_payment_gateway_cd`: Add same 4 governance fields.
- `org_payment_methods_cf`: Add 6 routing/eligibility fields (`settlement_type_code`, `credit_application_type`, `requires_cash_drawer`, `requires_terminal`, `min_order_amount`, `max_order_amount`) + 4 platform-disable fields. Remove `@@unique([tenant_org_id, payment_method_code])` if present — uniqueness enforced by existing gateway-aware DB index `uq_org_payment_methods_cf`.

**Disable logic — checkout query must apply all three gates:**
```sql
-- A method is available to a tenant only when ALL three pass:
WHERE o.is_enabled = true
  AND o.is_active = true
  AND o.is_platform_disabled = false      -- HQ has not disabled for this specific tenant
  AND s.is_globally_disabled = false      -- HQ has not disabled globally across all tenants
  AND (s.is_deprecated IS NULL OR s.is_deprecated = false)
-- (join org_payment_methods_cf o with sys_payment_method_cd s on o.payment_method_code = s.payment_method_code)
-- For PAYMENT_GATEWAY rows: also join sys_payment_gateway_cd g on o.gateway_code = g.code
--   AND add: g.is_globally_disabled = false
```

This query pattern is implemented in `checkout-config.service.ts → getCheckoutOptions()`.

Both demo tenants need sample cash drawers and payment method configs for a realistic dev/demo environment:

```sql
-- ─── Cash Drawers — Tenant 1 (Oman / OMR) ───
-- NOTE: branch_id = NULL = template-only placeholder.
-- Must be updated with a real branch id from org_branches_mst before production use.
INSERT INTO org_cash_drawers_mst
  (id, tenant_org_id, branch_id, drawer_code, drawer_name, drawer_name2,
   drawer_type, currency_code, requires_session, opening_float_required,
   max_cash_limit, is_active, rec_status, created_by)
VALUES
-- Main counter drawer (OMR — 3 decimal currency, smaller nominal amounts)
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
  NULL, 'DRAWER-01', 'Main Counter Drawer', 'صندوق الكاونتر الرئيسي',
  'COUNTER', 'OMR', true, true, 2000.000, true, 1, NULL),
-- Safe / drop safe
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
  NULL, 'SAFE-01', 'Branch Safe', 'خزنة الفرع',
  'SAFE', 'OMR', false, false, 20000.000, true, 1, NULL),
-- Driver cash bag
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
  NULL, 'DRIVER-01', 'Driver Bag #1', 'حقيبة السائق 1',
  'DRIVER_BAG', 'OMR', true, false, 800.000, true, 1, NULL);

-- ─── Cash Drawers — Tenant 2 (Saudi Arabia / SAR) ───
-- NOTE: branch_id = NULL = template-only; update with real org_branches_mst id before production.
INSERT INTO org_cash_drawers_mst
  (id, tenant_org_id, branch_id, drawer_code, drawer_name, drawer_name2,
   drawer_type, currency_code, requires_session, opening_float_required,
   max_cash_limit, is_active, rec_status, created_by)
VALUES
(gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
  NULL, 'DRAWER-01', 'Reception Drawer', 'صندوق الاستقبال',
  'COUNTER', 'SAR', true, true, 10000.00, true, 1, NULL),
(gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
  NULL, 'DRAWER-02', 'VIP Counter Drawer', 'صندوق كاونتر VIP',
  'COUNTER', 'SAR', true, true, 10000.00, true, 1, NULL),
(gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
  NULL, 'SAFE-01', 'Main Safe', 'الخزنة الرئيسية',
  'SAFE', 'SAR', false, false, 100000.00, true, 1, NULL),
(gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
  NULL, 'DRIVER-01', 'Driver Bag #1', 'حقيبة السائق 1',
  'DRIVER_BAG', 'SAR', true, false, 3000.00, true, 1, NULL),
(gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
  NULL, 'DRIVER-02', 'Driver Bag #2', 'حقيبة السائق 2',
  'DRIVER_BAG', 'SAR', true, false, 3000.00, true, 1, NULL);

-- ─── Payment Method / Settlement Options Config — 3-batch seed ────────────────
--
-- Seed strategy: 3 source-specific batches, using NOT EXISTS instead of ON CONFLICT
-- to avoid hitting the expression-based unique index with partial conditions.
--
-- Batch A: REAL_PAYMENT + CREDIT_APPLICATION — sourced from sys_payment_method_cd
--   strict filter: is_active=true AND is_enabled=true AND rec_status=1
--                  AND is_deprecated=false AND is_globally_disabled=false
--   excludes: DEFERRED_SETTLEMENT, AR_ALLOCATION, PROVIDER, INTERNAL_ADJUSTMENT
--   includes: CASH, CARD, CHECK, BANK_TRANSFER, MOBILE_PAYMENT, PAYMENT_GATEWAY (base row),
--             GIFT_CARD, WALLET, ADVANCE, CREDIT_NOTE, LOYALTY_POINTS
--
-- Batch B: PAYMENT_GATEWAY rows — one per active gateway from sys_payment_gateway_cd
--   payment_method_code = 'PAYMENT_GATEWAY', gateway_code = g.code
--
-- Batch C: DEFERRED + AR — direct INSERT for PAY_ON_COLLECTION, PAY_ON_DELIVERY, CREDIT_INVOICE
--   sourced conceptually from sys_payment_type_cd but inserted directly to avoid FK complexity.
--   AR rows (CREDIT_INVOICE) seeded with is_enabled=false.
--
-- Column mapping (sys → org):
--   payment_method_name → display_name, payment_method_name2 → display_name2
--   sys-only fields (method_category, colors, icon, image) stored in metadata JSONB

-- ═══ TENANT 1: 11111111-1111-1111-1111-111111111111 (Oman / OMR) ══════════════

-- Batch A: REAL_PAYMENT + CREDIT_APPLICATION from sys_payment_method_cd
INSERT INTO org_payment_methods_cf (
  id, tenant_org_id, payment_method_code, payment_nature, gateway_code,
  settlement_type_code, credit_application_type,
  requires_cash_drawer, requires_terminal,
  is_enabled, is_platform_disabled,
  is_active, rec_status, rec_order, rec_notes,
  created_at, created_by, created_info, updated_at, updated_by, updated_info,
  display_name, display_name2, metadata,
  allowed_in_pos, allowed_in_customer_app, allowed_in_staff_app, allowed_in_admin_app,
  allowed_for_pay_now, allowed_for_pay_on_collection,
  allowed_for_invoice_payment, allowed_for_refund,
  supports_partial_payment, supports_change_return, supports_overpayment,
  requires_reference, requires_approval, display_order
)
SELECT
  gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
  s.payment_method_code, s.payment_nature, NULL,
  NULL,  -- settlement_type_code: not applicable for REAL_PAYMENT / CREDIT_APPLICATION
  CASE s.payment_method_code
    WHEN 'GIFT_CARD'      THEN 'GIFT_CARD'
    WHEN 'WALLET'         THEN 'WALLET'
    WHEN 'ADVANCE'        THEN 'ADVANCE'
    WHEN 'CREDIT_NOTE'    THEN 'CREDIT_NOTE'
    WHEN 'LOYALTY_POINTS' THEN 'LOYALTY_POINTS'
    ELSE NULL
  END,
  CASE WHEN s.payment_method_code = 'CASH' THEN true ELSE false END,
  CASE WHEN s.payment_method_code = 'CARD' THEN true ELSE false END,
  s.is_enabled, false,
  s.is_active, s.rec_status, s.rec_order, s.rec_notes,
  s.created_at, s.created_by, s.created_info, s.updated_at, s.updated_by, s.updated_info,
  s.payment_method_name, s.payment_method_name2,
  jsonb_build_object(
    'method_category', s.method_category,
    'payment_method_color1', s.payment_method_color1,
    'payment_method_color2', s.payment_method_color2,
    'payment_method_color3', s.payment_method_color3,
    'payment_method_icon', s.payment_method_icon,
    'payment_method_image', s.payment_method_image
  ),
  true, false, false, true, true, true, true, true,
  true,
  CASE WHEN s.payment_method_code = 'CASH' THEN true ELSE false END,
  CASE WHEN s.payment_method_code = 'CASH' THEN true ELSE false END,
  false, false,
  ROW_NUMBER() OVER (ORDER BY s.payment_nature, s.payment_method_code)
FROM sys_payment_method_cd s
WHERE s.is_active = true AND s.is_enabled = true AND s.rec_status = 1
  AND s.is_deprecated = false AND s.is_globally_disabled = false
  AND s.payment_nature IN ('REAL_PAYMENT', 'CREDIT_APPLICATION')
  AND s.payment_method_code != 'PAYMENT_GATEWAY'  -- PAYMENT_GATEWAY handled in Batch B
  AND NOT EXISTS (
    SELECT 1 FROM org_payment_methods_cf o
    WHERE o.tenant_org_id = '11111111-1111-1111-1111-111111111111'
      AND o.payment_method_code = s.payment_method_code
      AND COALESCE(o.gateway_code, '') = ''
  );

-- Batch B: One row per active gateway from sys_payment_gateway_cd
--   payment_method_code = 'PAYMENT_GATEWAY', gateway_code = g.code (HYPERPAY, PAYTABS, STRIPE…)
--   requires_terminal = true (gateway = card terminal or redirect flow)
INSERT INTO org_payment_methods_cf (
  id, tenant_org_id, payment_method_code, payment_nature, gateway_code,
  settlement_type_code, credit_application_type,
  requires_cash_drawer, requires_terminal,
  is_enabled, is_platform_disabled,
  is_active, rec_status,
  display_name, display_name2, metadata,
  allowed_in_pos, allowed_in_customer_app, allowed_in_staff_app, allowed_in_admin_app,
  allowed_for_pay_now, allowed_for_pay_on_collection,
  allowed_for_invoice_payment, allowed_for_refund,
  supports_partial_payment, supports_change_return, supports_overpayment,
  requires_reference, requires_approval, display_order
)
SELECT
  gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
  'PAYMENT_GATEWAY', 'REAL_PAYMENT', g.code,
  NULL, NULL,
  false, true,
  true, false,
  true, 1,
  g.name, g.name2,
  jsonb_build_object('gateway_type', g.gateway_type, 'fee_percentage', g.fee_percentage),
  true, false, false, true, true, true, true, true,
  true, false, false, false, false,
  100 + ROW_NUMBER() OVER (ORDER BY g.code)
FROM sys_payment_gateway_cd g
WHERE g.is_active = true AND g.is_globally_disabled = false
  AND NOT EXISTS (
    SELECT 1 FROM org_payment_methods_cf o
    WHERE o.tenant_org_id = '11111111-1111-1111-1111-111111111111'
      AND o.payment_method_code = 'PAYMENT_GATEWAY'
      AND o.gateway_code = g.code
  );

-- Batch C: DEFERRED_SETTLEMENT + AR_ALLOCATION — direct INSERT
--   Sources: PAY_ON_COLLECTION, PAY_ON_DELIVERY (DEFERRED, enabled)
--            CREDIT_INVOICE (AR, disabled by default in V1)
--   settlement_type_code mirrors sys_payment_type_cd.payment_type_code value exactly
INSERT INTO org_payment_methods_cf (
  id, tenant_org_id, payment_method_code, payment_nature, gateway_code,
  settlement_type_code, credit_application_type,
  requires_cash_drawer, requires_terminal,
  is_enabled, is_platform_disabled,
  is_active, rec_status,
  display_name, display_name2, metadata,
  allowed_in_pos, allowed_in_customer_app, allowed_in_staff_app, allowed_in_admin_app,
  allowed_for_pay_now, allowed_for_pay_on_collection,
  allowed_for_invoice_payment, allowed_for_refund,
  supports_partial_payment, supports_change_return, supports_overpayment,
  requires_reference, requires_approval, display_order
)
SELECT * FROM (VALUES
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
   'PAY_ON_COLLECTION', 'DEFERRED_SETTLEMENT', NULL::TEXT,
   'PAY_ON_COLLECTION', NULL::TEXT, false, false,
   true, false, true, 1,
   'Pay on Collection', 'الدفع عند الاستلام', '{}'::JSONB,
   true, false, false, true, false, true, false, false,
   true, false, false, false, false, 200),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
   'PAY_ON_DELIVERY', 'DEFERRED_SETTLEMENT', NULL::TEXT,
   'PAY_ON_DELIVERY', NULL::TEXT, false, false,
   true, false, true, 1,
   'Pay on Delivery', 'الدفع عند التسليم', '{}'::JSONB,
   false, false, false, true, false, false, false, false,
   true, false, false, false, false, 201),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
   'CREDIT_INVOICE', 'AR_ALLOCATION', NULL::TEXT,
   'CREDIT_INVOICE', NULL::TEXT, false, false,
   false, false, true, 1,  -- is_enabled=false: AR disabled by default in V1
   'Credit Invoice', 'فاتورة آجلة', '{}'::JSONB,
   false, false, false, true, false, false, true, false,
   true, false, false, true, true, 202)
) AS v(id, tenant_org_id, payment_method_code, payment_nature, gateway_code,
        settlement_type_code, credit_application_type,
        requires_cash_drawer, requires_terminal,
        is_enabled, is_platform_disabled, is_active, rec_status,
        display_name, display_name2, metadata,
        allowed_in_pos, allowed_in_customer_app, allowed_in_staff_app, allowed_in_admin_app,
        allowed_for_pay_now, allowed_for_pay_on_collection,
        allowed_for_invoice_payment, allowed_for_refund,
        supports_partial_payment, supports_change_return, supports_overpayment,
        requires_reference, requires_approval, display_order)
WHERE NOT EXISTS (
  SELECT 1 FROM org_payment_methods_cf o
  WHERE o.tenant_org_id = v.tenant_org_id
    AND o.payment_method_code = v.payment_method_code
    AND COALESCE(o.gateway_code, '') = ''
);

-- ═══ TENANT 2: c9ac29d1-219c-4a3a-8887-f860550c32be (Saudi Arabia / SAR) ══════

-- Batch A: REAL_PAYMENT + CREDIT_APPLICATION from sys_payment_method_cd
INSERT INTO org_payment_methods_cf (
  id, tenant_org_id, payment_method_code, payment_nature, gateway_code,
  settlement_type_code, credit_application_type,
  requires_cash_drawer, requires_terminal,
  is_enabled, is_platform_disabled,
  is_active, rec_status, rec_order, rec_notes,
  created_at, created_by, created_info, updated_at, updated_by, updated_info,
  display_name, display_name2, metadata,
  allowed_in_pos, allowed_in_customer_app, allowed_in_staff_app, allowed_in_admin_app,
  allowed_for_pay_now, allowed_for_pay_on_collection,
  allowed_for_invoice_payment, allowed_for_refund,
  supports_partial_payment, supports_change_return, supports_overpayment,
  requires_reference, requires_approval, display_order
)
SELECT
  gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
  s.payment_method_code, s.payment_nature, NULL,
  NULL,
  CASE s.payment_method_code
    WHEN 'GIFT_CARD'      THEN 'GIFT_CARD'
    WHEN 'WALLET'         THEN 'WALLET'
    WHEN 'ADVANCE'        THEN 'ADVANCE'
    WHEN 'CREDIT_NOTE'    THEN 'CREDIT_NOTE'
    WHEN 'LOYALTY_POINTS' THEN 'LOYALTY_POINTS'
    ELSE NULL
  END,
  CASE WHEN s.payment_method_code = 'CASH' THEN true ELSE false END,
  CASE WHEN s.payment_method_code = 'CARD' THEN true ELSE false END,
  s.is_enabled, false,
  s.is_active, s.rec_status, s.rec_order, s.rec_notes,
  s.created_at, s.created_by, s.created_info, s.updated_at, s.updated_by, s.updated_info,
  s.payment_method_name, s.payment_method_name2,
  jsonb_build_object(
    'method_category', s.method_category,
    'payment_method_color1', s.payment_method_color1,
    'payment_method_color2', s.payment_method_color2,
    'payment_method_color3', s.payment_method_color3,
    'payment_method_icon', s.payment_method_icon,
    'payment_method_image', s.payment_method_image
  ),
  true, false, false, true, true, true, true, true,
  true,
  CASE WHEN s.payment_method_code = 'CASH' THEN true ELSE false END,
  CASE WHEN s.payment_method_code = 'CASH' THEN true ELSE false END,
  false, false,
  ROW_NUMBER() OVER (ORDER BY s.payment_nature, s.payment_method_code)
FROM sys_payment_method_cd s
WHERE s.is_active = true AND s.is_enabled = true AND s.rec_status = 1
  AND s.is_deprecated = false AND s.is_globally_disabled = false
  AND s.payment_nature IN ('REAL_PAYMENT', 'CREDIT_APPLICATION')
  AND s.payment_method_code != 'PAYMENT_GATEWAY'
  AND NOT EXISTS (
    SELECT 1 FROM org_payment_methods_cf o
    WHERE o.tenant_org_id = 'c9ac29d1-219c-4a3a-8887-f860550c32be'
      AND o.payment_method_code = s.payment_method_code
      AND COALESCE(o.gateway_code, '') = ''
  );

-- Batch B: One row per active gateway from sys_payment_gateway_cd
INSERT INTO org_payment_methods_cf (
  id, tenant_org_id, payment_method_code, payment_nature, gateway_code,
  settlement_type_code, credit_application_type,
  requires_cash_drawer, requires_terminal,
  is_enabled, is_platform_disabled,
  is_active, rec_status,
  display_name, display_name2, metadata,
  allowed_in_pos, allowed_in_customer_app, allowed_in_staff_app, allowed_in_admin_app,
  allowed_for_pay_now, allowed_for_pay_on_collection,
  allowed_for_invoice_payment, allowed_for_refund,
  supports_partial_payment, supports_change_return, supports_overpayment,
  requires_reference, requires_approval, display_order
)
SELECT
  gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
  'PAYMENT_GATEWAY', 'REAL_PAYMENT', g.code,
  NULL, NULL,
  false, true,
  true, false,
  true, 1,
  g.name, g.name2,
  jsonb_build_object('gateway_type', g.gateway_type, 'fee_percentage', g.fee_percentage),
  true, false, false, true, true, true, true, true,
  true, false, false, false, false,
  100 + ROW_NUMBER() OVER (ORDER BY g.code)
FROM sys_payment_gateway_cd g
WHERE g.is_active = true AND g.is_globally_disabled = false
  AND NOT EXISTS (
    SELECT 1 FROM org_payment_methods_cf o
    WHERE o.tenant_org_id = 'c9ac29d1-219c-4a3a-8887-f860550c32be'
      AND o.payment_method_code = 'PAYMENT_GATEWAY'
      AND o.gateway_code = g.code
  );

-- Batch C: DEFERRED_SETTLEMENT + AR_ALLOCATION — direct INSERT
INSERT INTO org_payment_methods_cf (
  id, tenant_org_id, payment_method_code, payment_nature, gateway_code,
  settlement_type_code, credit_application_type,
  requires_cash_drawer, requires_terminal,
  is_enabled, is_platform_disabled,
  is_active, rec_status,
  display_name, display_name2, metadata,
  allowed_in_pos, allowed_in_customer_app, allowed_in_staff_app, allowed_in_admin_app,
  allowed_for_pay_now, allowed_for_pay_on_collection,
  allowed_for_invoice_payment, allowed_for_refund,
  supports_partial_payment, supports_change_return, supports_overpayment,
  requires_reference, requires_approval, display_order
)
SELECT * FROM (VALUES
  (gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
   'PAY_ON_COLLECTION', 'DEFERRED_SETTLEMENT', NULL::TEXT,
   'PAY_ON_COLLECTION', NULL::TEXT, false, false,
   true, false, true, 1,
   'Pay on Collection', 'الدفع عند الاستلام', '{}'::JSONB,
   true, false, false, true, false, true, false, false,
   true, false, false, false, false, 200),
  (gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
   'PAY_ON_DELIVERY', 'DEFERRED_SETTLEMENT', NULL::TEXT,
   'PAY_ON_DELIVERY', NULL::TEXT, false, false,
   true, false, true, 1,
   'Pay on Delivery', 'الدفع عند التسليم', '{}'::JSONB,
   false, false, false, true, false, false, false, false,
   true, false, false, false, false, 201),
  (gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
   'CREDIT_INVOICE', 'AR_ALLOCATION', NULL::TEXT,
   'CREDIT_INVOICE', NULL::TEXT, false, false,
   false, false, true, 1,
   'Credit Invoice', 'فاتورة آجلة', '{}'::JSONB,
   false, false, false, true, false, false, true, false,
   true, false, false, true, true, 202)
) AS v(id, tenant_org_id, payment_method_code, payment_nature, gateway_code,
        settlement_type_code, credit_application_type,
        requires_cash_drawer, requires_terminal,
        is_enabled, is_platform_disabled, is_active, rec_status,
        display_name, display_name2, metadata,
        allowed_in_pos, allowed_in_customer_app, allowed_in_staff_app, allowed_in_admin_app,
        allowed_for_pay_now, allowed_for_pay_on_collection,
        allowed_for_invoice_payment, allowed_for_refund,
        supports_partial_payment, supports_change_return, supports_overpayment,
        requires_reference, requires_approval, display_order)
WHERE NOT EXISTS (
  SELECT 1 FROM org_payment_methods_cf o
  WHERE o.tenant_org_id = v.tenant_org_id
    AND o.payment_method_code = v.payment_method_code
    AND COALESCE(o.gateway_code, '') = ''
);

-- ─── Payment Terminals — Tenant 1 ───
INSERT INTO org_payment_terminals_cf
  (id, tenant_org_id, branch_id, terminal_code, terminal_name, terminal_name2,
   terminal_type, is_enabled, is_active, rec_status, created_by)
VALUES
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
  NULL, 'POS-001', 'Main POS Terminal', 'جهاز البيع الرئيسي',
  'POS_CARD_TERMINAL', true, true, 1, NULL),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
  NULL, 'MOB-001', 'Mobile POS #1', 'جهاز بيع متنقل 1',
  'POS_CARD_TERMINAL', true, true, 1, NULL);

-- ─── Payment Terminals — Tenant 2 ───
INSERT INTO org_payment_terminals_cf
  (id, tenant_org_id, branch_id, terminal_code, terminal_name, terminal_name2,
   terminal_type, is_enabled, is_active, rec_status, created_by)
VALUES
(gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
  NULL, 'POS-001', 'Reception POS', 'جهاز استقبال POS',
  'POS_CARD_TERMINAL', true, true, 1, NULL),
(gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
  NULL, 'POS-002', 'VIP Counter POS', 'جهاز VIP POS',
  'POS_CARD_TERMINAL', true, true, 1, NULL),
(gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
  NULL, 'MOB-001', 'Driver Mobile POS', 'جهاز السائق المتنقل',
  'POS_CARD_TERMINAL', true, true, 1, NULL);
```

#### P6.3 — Migration 0292: Outbox + Idempotency
**File:** `supabase/migrations/0292_outbox_idempotency.sql`

```sql
CREATE TABLE org_domain_events_outbox (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id   UUID NOT NULL REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,
  aggregate_type  TEXT NOT NULL,
  aggregate_id    UUID NOT NULL,
  payload         JSONB NOT NULL,
  status          TEXT NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING','PROCESSING','PROCESSED','FAILED')),
  attempts        SMALLINT NOT NULL DEFAULT 0,
  max_attempts    SMALLINT NOT NULL DEFAULT 6,
  next_retry_at   TIMESTAMPTZ,
  processed_at    TIMESTAMPTZ,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Indexes:
CREATE INDEX IF NOT EXISTS idx_outbox_worker_poll
  ON org_domain_events_outbox (status, next_retry_at)
  WHERE status IN ('PENDING','FAILED');
CREATE INDEX IF NOT EXISTS idx_outbox_aggregate
  ON org_domain_events_outbox (tenant_org_id, aggregate_id, event_type);

ALTER TABLE org_domain_events_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_org_domain_events_outbox
  ON org_domain_events_outbox FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

CREATE TABLE org_idempotency_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id   UUID NOT NULL REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  key             TEXT NOT NULL,
  resource_type   TEXT NOT NULL,
  resource_id     UUID,
  response_cache  JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
  CONSTRAINT uq_idempotency_key UNIQUE (tenant_org_id, key, resource_type)
);
CREATE INDEX IF NOT EXISTS idx_idempotency_lookup
  ON org_idempotency_keys (tenant_org_id, key, resource_type);

ALTER TABLE org_idempotency_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_org_idempotency_keys
  ON org_idempotency_keys FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());
```

**Prisma:** Add both models.

#### P6.4 — Migration 0293: Reconciliation Tables
**File:** `supabase/migrations/0293_reconciliation.sql`

```sql
CREATE TABLE org_fin_recon_runs_mst (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id   UUID NOT NULL,
  run_no          TEXT NOT NULL,
  run_type        TEXT NOT NULL DEFAULT 'MANUAL' CHECK (run_type IN ('DAILY','MANUAL')),
  period_from     DATE NOT NULL,
  period_to       DATE NOT NULL,
  branch_id       UUID,
  currency_code   TEXT NOT NULL,                     -- base currency of the run
  status          TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','RUNNING','PASSED','FAILED','PARTIAL')),
  total_checked   INTEGER DEFAULT 0,
  passed_checks   INTEGER DEFAULT 0,
  failed_checks   INTEGER DEFAULT 0,
  warning_checks  INTEGER DEFAULT 0,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  triggered_by    UUID,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  rec_status      SMALLINT NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID,
  created_info    TEXT,
  updated_at      TIMESTAMPTZ,
  updated_by      UUID,
  updated_info    TEXT,
  metadata        JSONB,
  CONSTRAINT uq_recon_run_no UNIQUE (tenant_org_id, run_no)
);

CREATE TABLE org_fin_recon_issues_dtl (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id         UUID NOT NULL,
  run_id                UUID NOT NULL REFERENCES org_fin_recon_runs_mst(id) ON DELETE CASCADE,
  check_name            TEXT NOT NULL,
  severity              TEXT NOT NULL CHECK (severity IN ('BLOCKER','WARNING','INFO')),
  affected_entity_type  TEXT,
  affected_entity_id    UUID,
  expected_value        DECIMAL(19,4),
  actual_value          DECIMAL(19,4),
  delta                 DECIMAL(19,4),
  message               TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'OPEN'
                          CHECK (status IN ('OPEN','ACKNOWLEDGED','RESOLVED')),
  acknowledged_by       UUID,
  acknowledged_at       TIMESTAMPTZ,
  resolved_by           UUID,
  resolved_at           TIMESTAMPTZ,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fin_recon_runs_status
  ON org_fin_recon_runs_mst (tenant_org_id, status, period_from);

CREATE INDEX IF NOT EXISTS idx_fin_recon_issues_run
  ON org_fin_recon_issues_dtl (run_id, severity, status);

ALTER TABLE org_fin_recon_runs_mst ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_org_fin_recon_runs_mst
  ON org_fin_recon_runs_mst FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

ALTER TABLE org_fin_recon_issues_dtl ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_org_fin_recon_issues
  ON org_fin_recon_issues_dtl FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());
```

**Prisma:** Add both models.

---

### PHASE 7 — Permissions + Navigation

#### P7.1 — Migration 0294: Seed All New Permissions
**File:** `supabase/migrations/0294_financial_permissions_seed.sql`

Seed into `sys_permissions_cd` (or equivalent permission table — check existing pattern):

```sql
-- Orders financial
('orders:view_financial_breakdown', 'View order financial detail'),
('orders:process_refund', 'Process refund'),
('orders:approve_refund', 'Approve refund (manager gate)'),
('orders:collect_payment', 'Collect payment on PAY_ON_COLLECTION orders'),

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
('promotions:view', ...),
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

#### P7.2 — Migration 0295: Navigation Entries
**File:** `supabase/migrations/0295_financial_navigation.sql`

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

Internally call `tax-engine.service.ts` for tax breakdown.

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

#### P8.3 — New `order-settlement.service.ts`
**File:** `web-admin/lib/services/order-settlement.service.ts`

Responsible for writing all financial fact rows in a single transaction.
Routes each selected settlement option by `payment_nature` from `org_payment_methods_cf`:

```typescript
async function settleOrder(tx: PrismaTx, params: {
  orderId: string
  tenantId: string
  breakdown: FinancialBreakdownSnapshot
  chargeLines: ChargeLineItem[]
  taxLines: TaxLineItem[]
  discountLines: DiscountLineInput[]
  // Each item includes the resolved org_payment_methods_cf row (contains payment_nature)
  settlementLegs: ResolvedSettlementLeg[]
  cashDrawerSessionId?: string
}): Promise<SettlementResult>

// ResolvedSettlementLeg — resolved by checkout-config.service.ts before this call
type ResolvedSettlementLeg = {
  settlementOption: SettlementOption   // full row from org_payment_methods_cf
  amount: number
  reference?: string
  terminalId?: string
  cashTendered?: number
  creditReferenceId?: string           // gift card code, wallet id, credit note id, etc.
}
```

Routing inside tx by `settlementLeg.settlementOption.payment_nature`:

| `payment_nature`      | Action                                                                                |
|---|---|
| `REAL_PAYMENT`        | Write `org_order_payments_dtl` row (`payment_nature_snapshot = 'REAL_PAYMENT'`)      |
| `CREDIT_APPLICATION`  | SELECT FOR UPDATE on source balance; write `org_order_credit_apps_dtl`; call `stored-value.service.ts` or `loyalty.service.ts` to debit ledger |
| `DEFERRED_SETTLEMENT` | No payment row; set `payment_status`, `pay_on_collection_amount`, `outstanding_amount` on order |
| `AR_ALLOCATION`       | Write invoice/AR fields only (V1: rejected if is_enabled=false)                       |
| `INTERNAL_ADJUSTMENT` | Rejected in V1 unless explicitly enabled                                              |

Steps inside tx:
1. Write `org_order_charges_dtl` rows
2. Write `org_order_taxes_dtl` rows
3. Write `org_order_discounts_dtl` rows (via existing `insertDiscountLinesTx`)
4. For each `CREDIT_APPLICATION` leg: SELECT FOR UPDATE on source balance → write `org_order_credit_apps_dtl` → debit ledger via `stored-value.service.ts` / `loyalty.service.ts`
5. For each `REAL_PAYMENT` leg: write `org_order_payments_dtl` row with `payment_nature_snapshot = 'REAL_PAYMENT'`; if CASH leg: link to `cashDrawerSessionId`
6. For `DEFERRED_SETTLEMENT` leg: skip payment row; set order snapshot:
   - `payment_status = 'PENDING_COLLECTION'`, `outstanding_amount = grand_total`, `pay_on_collection_amount = grand_total`
7. Update `org_orders_mst` snapshot columns:
   - PAY_NOW / fully settled → `payment_status = 'PAID'`, `outstanding_amount = 0`
8. Emit outbox events (ORDER_COMPLETED + per-credit-type STORED_VALUE_CHANGED / GIFT_CARD_REDEEMED)

**PAY_ON_COLLECTION — second-step collection function:**
```typescript
async function collectPaymentTx(tx: PrismaTx, params: {
  orderId: string
  tenantId: string
  paymentLegs: PaymentLegInput[]   // actual cash/card/mobile used at collection
  cashDrawerSessionId?: string
  collectedBy: string
}): Promise<SettlementResult>
```

Steps inside tx:
1. Load order (SELECT FOR UPDATE) — verify `payment_status = 'PENDING_COLLECTION'`
2. Write `org_order_payments_dtl` rows for the actual payment legs
3. Compute `change_returned_amount` if cash tendered > outstanding
4. Update `org_orders_mst`:
   - `total_paid_amount = sum of payment legs`
   - `outstanding_amount = 0`
   - `pay_on_collection_amount = 0`
   - `change_returned_amount`
   - `payment_status = 'PAID'` (or `'OVERPAID'` if change returned)
5. Link payment rows to `cashDrawerSessionId` if cash leg present
6. Emit `PAYMENT_RECEIVED` outbox event

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

Extends existing `discount-service.ts` — operates on `org_promotions_mst` (renamed from `org_promo_codes_mst`), adding auto-apply (NULL promo_code) and stacking logic on top of the existing coupon code flow.

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

#### P8.8 — New `order-refund.service.ts`
**File:** `web-admin/lib/services/order-refund.service.ts`

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

#### P8.12 — New `checkout-config.service.ts`
**File:** `web-admin/lib/services/checkout-config.service.ts`

Reads `org_payment_methods_cf` and returns settlement options grouped by `payment_nature`.
Called by checkout preview and create-with-payment routes before `order-settlement.service.ts`.

```typescript
async function getCheckoutOptions(
  tenantId: string,
  orderContext: { amount: number; customerId?: string; orderType?: string }
): Promise<CheckoutSettlementOptions>
```

Steps:
1. Query with three-gate filter + gateway join:
   ```sql
   SELECT o.*, s.is_globally_disabled AS sys_globally_disabled,
          s.is_deprecated, g.is_globally_disabled AS gw_globally_disabled
   FROM org_payment_methods_cf o
   JOIN sys_payment_method_cd s ON s.payment_method_code = o.payment_method_code
   LEFT JOIN sys_payment_gateway_cd g ON g.code = o.gateway_code
   WHERE o.tenant_org_id = :tenantId
     AND o.is_enabled = true
     AND o.is_active = true
     AND o.rec_status = 1
     AND o.is_platform_disabled = false
     AND s.is_globally_disabled = false
     AND (s.is_deprecated IS NULL OR s.is_deprecated = false)
     AND (o.gateway_code IS NULL OR g.is_globally_disabled = false)
   ```
2. Filter by `min_order_amount`/`max_order_amount` against `orderContext.amount`
3. For each `CREDIT_APPLICATION` row: enrich `availableBalance`:
   - `GIFT_CARD` → skip (balance looked up at time of redemption by code)
   - `WALLET` → call `stored-value.service.getWalletBalance(tenantId, customerId)`
   - `ADVANCE` → call `stored-value.service.getAdvanceBalance(tenantId, customerId)`
   - `CREDIT_NOTE` → call `stored-value.service.getCreditNotes(tenantId, customerId)` (sum active balances)
   - `LOYALTY_POINTS` → call `loyalty.service.getLoyaltyAccount(tenantId, customerId)` (points × redeem_rate)
4. Group rows:
   ```typescript
   switch (row.payment_nature) {
     case 'REAL_PAYMENT':        → paymentMethods
     case 'CREDIT_APPLICATION':  → creditApplications
     case 'DEFERRED_SETTLEMENT': → deferredSettlement
     case 'AR_ALLOCATION':       → arOptions
   }
   ```
5. Return `CheckoutSettlementOptions`

```typescript
// Also exposes a resolver used by order-settlement.service.ts
async function resolveSettlementLeg(
  tenantId: string,
  paymentMethodCode: string,
  gatewayCode: string | null,
  amount: number
): Promise<SettlementOption>
// Loads org_payment_methods_cf row + joins sys_payment_method_cd + sys_payment_gateway_cd
// to get payment_nature and verify gateway is not globally disabled before routing
```

**Note:** `INTERNAL_ADJUSTMENT` rows are never returned by `getCheckoutOptions()` — they are admin-only and must be accessed through a separate manager flow, not the standard checkout UI.

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
- `web-admin/app/api/v1/orders/create-with-payment/route.ts` — extend Zod schema; call `order-settlement.service.ts` for fact-table writes
- `web-admin/app/api/v1/orders/preview-payment/route.ts` — extend to accept credit applications + loyalty

Full multi-leg payment support, credit applications, loyalty redemption, cash drawer context.

#### P9.2 — Collect Payment Route (PAY_ON_COLLECTION second step)
**File:** `web-admin/app/api/v1/orders/[orderId]/collect-payment/route.ts`

`POST` — called when staff physically collects payment at counter or on delivery.

Zod input:
```typescript
{
  paymentLegs: PaymentLegInput[]   // actual cash/card/mobile used
  cashDrawerSessionId?: string     // required if any leg is CASH
  collectedBy: string
}
```

Guards:
- `requirePermission('orders:collect_payment')`
- Order must have `payment_status = 'PENDING_COLLECTION'`
- Sum of `paymentLegs.amount` must be ≥ `outstanding_amount`
- If CASH leg: `cashDrawerSessionId` required + session must be OPEN

Calls `order-settlement.service.collectPaymentTx()`.

Response: updated `FinancialBreakdownSnapshot` + `change_returned_amount`.

**Permission to seed in 0294:** `orders:collect_payment` — assigned to CASHIER + MANAGER roles.

#### P9.3 — Order Refund Routes
**Files:** (order-prefixed in path; use `order-refund.service.ts`)
- `POST web-admin/app/api/v1/orders/[orderId]/refund/route.ts`
- `GET web-admin/app/api/v1/orders/[orderId]/refunds/route.ts`
- `PATCH web-admin/app/api/v1/orders/refunds/[refundId]/approve/route.ts`

#### P9.4 — Cash Drawer Routes
**Files (all under `web-admin/app/api/v1/cash-drawers/`):**
- `GET route.ts` — list drawers
- `POST [drawerId]/open-session/route.ts`
- `POST [drawerId]/close-session/route.ts`
- `POST [drawerId]/cash-movement/route.ts`
- `GET [drawerId]/session/[sessionId]/summary/route.ts`

#### P9.5 — Stored Value Routes
**Files (under `web-admin/app/api/v1/customers/[customerId]/`):**
- `GET stored-value/route.ts`
- `POST wallet/top-up/route.ts`
- `GET wallet/ledger/route.ts`
- `POST advance/issue/route.ts`
- `GET advance/ledger/route.ts`
- `POST credit-note/issue/route.ts`
- `GET credit-notes/route.ts`

#### P9.6 — Gift Card Routes (extend existing)
**Files:**
- `GET web-admin/app/api/v1/gift-cards/[cardCode]/balance/route.ts`
- `GET web-admin/app/api/v1/gift-cards/[cardCode]/ledger/route.ts`

#### P9.7 — Loyalty Routes
**Files:**
- `GET web-admin/app/api/v1/loyalty/config/route.ts`
- `PATCH web-admin/app/api/v1/loyalty/config/route.ts`
- `GET web-admin/app/api/v1/customers/[customerId]/loyalty/route.ts`
- `POST web-admin/app/api/v1/loyalty/tiers/route.ts`

#### P9.8 — Promotions Routes
**Files (under `web-admin/app/api/v1/marketing/promotions/`):**
- `GET route.ts` — paginated list
- `POST route.ts` — create
- `GET [promoId]/route.ts`
- `PATCH [promoId]/route.ts`
- `DELETE [promoId]/route.ts`
- `POST validate/route.ts` — validate code before checkout

#### P9.9 — Tax Config Routes
**Files (under `web-admin/app/api/v1/settings/tax/`):**
- `GET profiles/route.ts`
- `POST profiles/route.ts`
- `PATCH profiles/[profileId]/route.ts`
- `GET exemptions/route.ts`
- `POST exemptions/route.ts`

#### P9.10 — Payment Config Routes
**Files (under `web-admin/app/api/v1/settings/payments/`):**
- `GET methods/route.ts`
- `PATCH methods/[methodId]/route.ts`
- `GET terminals/route.ts`
- `POST terminals/route.ts`

#### P9.11 — Reconciliation Routes
**Files (under `web-admin/app/api/v1/finance/reconciliation/`):**
- `GET runs/route.ts`
- `POST runs/route.ts`
- `GET runs/[runId]/route.ts`
- `PATCH issues/[issueId]/route.ts`

#### P9.12 — Financial Report Routes
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

#### P16.2 — Migration 0296: pg_cron Jobs
**File:** `supabase/migrations/0296_pg_cron_jobs.sql`

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

All new documentation follows the `/documentation` skill structure: files go into `docs/features/Order_Fin/` using the standard template (README, developer_guide, current_status, progress_summary, technical_docs/).
Existing planning docs already under `docs/features/Order_Fin/` stay where they are.

#### P19.1 — Core Feature Docs (Standard Structure)
Create/update the following files in `docs/features/Order_Fin/`:

**`README.md`** — Feature overview following the standard template:
- Purpose and scope of the Order Financial Platform
- Architecture summary (fact tables → service layer → API routes → UI)
- Key ADRs (payment_nature routing, credit note v1 scope, unified config table)
- Link to developer_guide.md, technical_docs/, and Order_Fin_Docs/

**`developer_guide.md`** — How to work with this feature:
- Service dependency graph (which service calls which)
- Multi-leg settlement flow walkthrough
- SELECT FOR UPDATE pattern for stored value
- Idempotency key usage
- Outbox event emission and worker consumption
- Environment setup notes

**`current_status.md`** — Implementation status per phase (updated after each phase):
```markdown
## Implementation Status
- [ ] PHASE 0 — Foundation (migrations + constants + types)
- [ ] PHASE 1 — Order Financial Fact Tables
- [ ] PHASE 2 — Stored Value Tables
- [ ] PHASE 3 — Loyalty
- [ ] PHASE 4 — Promotions Engine
- [ ] PHASE 5 — Tax Configuration
- [x] PHASE 6 — Infrastructure Tables
- [x] PHASE 7 — Permissions + Navigation
- [ ] PHASE 8 — Service Layer
- [ ] PHASE 9 — API Routes
- [ ] PHASE 10–14 — UI Pages
- [ ] PHASE 15 — Print & Export
- [ ] PHASE 16 — Background Jobs
- [ ] PHASE 17 — i18n
- [ ] PHASE 18 — Testing
- [ ] PHASE 19 — Documentation
```

**`progress_summary.md`** — Session-by-session progress log (append after each work session):
```markdown
# Progress Summary — Order Financial Platform

## Template (copy per session)
### Session: YYYY-MM-DD
**Completed:** [list what was done]
**In Progress:** [what is partially done and its % complete]
**Blockers:** [anything blocking progress]
**Next Session:** [numbered list of what to do next]
```

**`CHANGELOG.md`** — Chronological list of changes:
- Each migration with date applied
- Each service created
- Each API route shipped
- Each UI page deployed

#### P19.2 — Technical Docs
Create in `docs/features/Order_Fin/technical_docs/`:

**`tech_api.md`** — Full API contract documentation for all new routes:
- Full request/response schemas for every route in PHASE 9
- Error codes and messages
- Permission required per route
- Idempotency key header format

**`tech_data_model.md`** — Data model documentation:
- ER diagram (text/Mermaid) for all new tables
- Table descriptions and column-level docs
- Migration dependency graph (0278 → 0296)
- CHECK constraint reference table
- Currency + exchange_rate field applicability per table

#### P19.3 — Domain Guide Docs
Create in `docs/features/Order_Fin/Order_Fin_Docs/`:

- `ORDER_FINANCIAL_PLATFORM.md` — formula, financial flow, architecture decisions
- `STORED_VALUE_GUIDE.md` — wallet/advance/credit-note business rules, SELECT FOR UPDATE, idempotency
- `LOYALTY_GUIDE.md` — earn/redeem rules, tier logic, async earn via outbox
- `PROMOTIONS_GUIDE.md` — promotion types, stacking rules, auto-apply vs coupon
- `TAX_ENGINE_GUIDE.md` — profile config, compound tax, exemptions
- `RECONCILIATION_GUIDE.md` — 7 checks, severity levels, monitoring
- `CASH_DRAWER_GUIDE.md` — session lifecycle, variance handling, force-close rules
- `OUTBOX_PATTERN_GUIDE.md` — event types, retry schedule, worker architecture

#### P19.4 — Root Index Update
**File:** `docs/features/folders_lookup.md`

Add entry for `Order_Fin` feature folder:
```markdown
- [Order Financial Platform](Order_Fin/README.md) — Multi-leg payments, stored value, loyalty, promotions, tax engine, reconciliation, outbox pattern
```

#### P19.5 — Code Documentation (Trigger agents after each phase)
After completing each phase, run the `code-documenter` agent on all new files:
- **After PHASE 0:** Constants file + types file
- **After each migration:** SQL migration files (file-level header, table comment, index rationale, RLS policy explanation)
- **After each service in PHASE 8:** JSDoc for all public functions with `@param tenantOrgId` and `withTenantContext` inline comment
- **After each API route in PHASE 9:** Route-level JSDoc block
- **After all UI pages:** Component-level JSDoc and RTL Tailwind annotations

#### P19.6 — Implementation Checklist (per documentation skill standards)
The following must be documented per feature:

| Item | File | Status |
|---|---|---|
| Permissions | `developer_guide.md` | — |
| Navigation tree | `developer_guide.md` | — |
| Tenant settings | `developer_guide.md` | — |
| Feature flags | `developer_guide.md` | — |
| Plan limits | `developer_guide.md` | — |
| i18n keys | `developer_guide.md` | — |
| API routes | `technical_docs/tech_api.md` | — |
| Migrations list | `technical_docs/tech_data_model.md` | — |
| Constants & types | `technical_docs/tech_data_model.md` | — |
| Env vars | `developer_guide.md` | — |

---

## Critical Files Reference

| File | Action |
|---|---|
| `web-admin/prisma/schema.prisma` | Add 3 missing sys models + models for all new tables |
| `web-admin/lib/constants/order-financial.ts` | CREATE — all new constants |
| `web-admin/lib/types/order-financial.ts` | CREATE — all new types |
| `web-admin/lib/constants/payment.ts` | Add `LOYALTY_TXN_TYPES` |
| `web-admin/lib/services/order-calculation.service.ts` | Extend return type; call tax-engine.service.ts |
| `web-admin/lib/services/tax-engine.service.ts` | CREATE (general-purpose: used by orders, invoices, quotes, B2B) |
| `web-admin/lib/services/order-settlement.service.ts` | CREATE (order-prefixed: settles order finances) |
| `web-admin/lib/services/order-refund.service.ts` | CREATE (order-prefixed: refunds an order) |
| `web-admin/lib/services/stored-value.service.ts` | CREATE (customer-level, no order prefix) |
| `web-admin/lib/services/loyalty.service.ts` | CREATE (customer-level, no order prefix) |
| `web-admin/lib/services/promotion-engine.service.ts` | CREATE (engine-level, no order prefix) |
| `web-admin/lib/services/cash-drawer.service.ts` | CREATE (branch-level, no order prefix) |
| `web-admin/lib/services/outbox.service.ts` | CREATE (infrastructure, no order prefix) |
| `web-admin/lib/services/reconciliation.service.ts` | CREATE (financial-level, no order prefix) |
| `web-admin/lib/services/checkout-config.service.ts` | CREATE (reads org_payment_methods_cf, groups by payment_nature, enriches balances) |
| `web-admin/lib/services/invoice-service.ts` | Extend (2 new functions) |
| `web-admin/lib/constants/payment.ts` | Remove GIFT_CARD + PROMO_CODE from PAYMENT_METHODS; add LOYALTY_TXN_TYPES |
| `web-admin/app/api/v1/orders/create-with-payment/route.ts` | Extend (multi-leg, credits, loyalty) |
| `web-admin/app/api/v1/orders/preview-payment/route.ts` | Extend |
| `web-admin/config/navigation.ts` | Add all new nav items (dual-write with 0295) |
| `web-admin/messages/en.json` | Add all i18n keys |
| `web-admin/messages/ar.json` | Add all Arabic keys |
| `supabase/functions/outbox-worker/index.ts` | CREATE |
| `supabase/migrations/0278–0296.sql` | CREATE all (19 migrations) |

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
0278 (rename + extend org_order_discounts_dtl)
 └── 0279 (sys financial lookup tables: payment_nature, credit_app_types, settlement_type_codes, charge_types, tax_types, refund methods) + SEED all code values
 └── 0280 (org_order_charges_dtl)
 └── 0281 (org_order_taxes_dtl)
 └── 0282 (snapshot cols on org_orders_mst)
 └── 0283 (harden org_order_credit_apps_dtl + fix org_order_refunds_dtl FK + payment_nature_snapshot on org_order_payments_dtl)
 └── 0284 (org_customer_wallets_mst + org_wallet_txn_dtl)
 └── 0285 (org_customer_advances_mst + org_advance_txn_dtl)
 └── 0286 (org_credit_notes_mst + org_credit_note_txn_dtl)
 └── 0287 (loyalty: program + tiers + accounts + txn) + SEED loyalty programs & tiers
 └── 0288 (rename + extend org_promotions_mst + org_promotion_usage_dtl) ← FK 0278
       + SEED promotions for both demo tenants into org_promotions_mst
 └── 0289 (org_tax_profiles_cf + org_tax_exemptions_cf) ← adds FK to 0281 taxes col
       + SEED tax profiles & exemptions for both demo tenants
 └── 0290 (sys_currency_rounding_rules_cd) + SEED all GCC + international currencies
 └── 0291 (governance columns on sys_payment_method_cd + sys_payment_gateway_cd; routing cols on org_payment_methods_cf; seed new sys codes; 3-batch tenant seed; cash drawers; terminals)
       ← depends on 0269 (org_payment_methods_cf) + 0270 (org_cash_drawers_mst)
 └── 0292 (org_domain_events_outbox + org_idempotency_keys) — independent
 └── 0293 (org_fin_recon_runs_mst + org_fin_recon_issues_dtl) — independent
 └── 0294 (permissions seed) — after all tables exist
 └── 0295 (navigation seed in sys_components_cd + dual-write navigation.ts) — after 0294
 └── 0296 (pg_cron schedule jobs) — after 0292 + 0293
```

**Seed migrations summary:**
| Migration | Seeded data |
|---|---|
| 0279 | All sys financial lookup code tables: payment_nature, credit_app_types, settlement_type_codes, charge_types, tax_types, refund methods — full EN/AR labels |
| 0287 | Loyalty programs (2 tenants × 1 program) + tiers (5 + 4 tiers) |
| 0288 | Rename org_promo_codes_mst→org_promotions_mst, org_promo_usage_log→org_promotion_usage_dtl; 12 seed promo rows |
| 0289 | Tax profiles (4 Oman/OMR + 5 Saudi/SAR) + exemptions |
| 0290 | Currency rounding rules (13 currencies) |
| 0291 | (1) Governance cols on sys_payment_method_cd (is_globally_disabled + 3 audit). (2) Governance cols on sys_payment_gateway_cd (same 4). (3) Platform-disable cols on org_payment_methods_cf (is_platform_disabled + 3 audit). (4) Routing/eligibility cols on org_payment_methods_cf (settlement_type_code, credit_application_type, requires_cash_drawer, requires_terminal, min/max_order_amount). (5) Seed sys_payment_method_cd: GIFT_CARD, WALLET, ADVANCE, CREDIT_NOTE, LOYALTY_POINTS, PAY_ON_DELIVERY, CREDIT_INVOICE; re-activate PAY_ON_COLLECTION; PAYMENT_GATEWAY already seeded in 0267. (6) Cash drawers (3 OMR + 5 SAR; branch_id=NULL template). (7) 3-batch settlement options per tenant (Batch A: REAL_PAYMENT+CREDIT_APPLICATION from sys_payment_method_cd; Batch B: PAYMENT_GATEWAY rows from sys_payment_gateway_cd; Batch C: PAY_ON_COLLECTION+PAY_ON_DELIVERY+CREDIT_INVOICE direct inserts). (8) Terminals (2 OMR + 3 SAR). |
| 0294 | All new permissions + role assignments |
| 0295 | sys_components_cd navigation rows (9 new items) |

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
10. Phase 19 (documentation — update current_status.md + progress_summary.md after EVERY phase, not just at the end)

---

## Phase Progress Tracker

**Update this section immediately after completing each item.** Mark `[x]` when done, add date.
Keep `docs/features/Order_Fin/current_status.md` in sync with this tracker.

### PHASE 0 — Foundation ✅ 2026-05-16
- [x] P0.1 — Add 3 Missing Prisma Models (`sys_card_brand_cd`, `sys_cash_drawer_session_status_cd`, `sys_cash_drawer_movement_type_cd`) — 2026-05-16
- [x] P0.2 — Migration 0278: Rename `org_ord_discounts_dtl` → `org_order_discounts_dtl` + extend — 2026-05-16
- [x] P0.3 — Create `web-admin/lib/constants/order-financial.ts` — 2026-05-16
- [x] P0.4 — Create `web-admin/lib/types/order-financial.ts`; update `payment.ts` — 2026-05-16
- [x] P0.5 — Migration 0279: sys financial lookup tables + full EN/AR seed — 2026-05-16

### PHASE 1 — Order Financial Fact Tables ✅ 2026-05-16
- [x] P1.1 — Migration 0280: `org_order_charges_dtl` — 2026-05-16
- [x] P1.2 — Migration 0281: `org_order_taxes_dtl` — 2026-05-16
- [x] P1.3 — Migration 0282: snapshot columns on `org_orders_mst` — 2026-05-16
- [x] P1.4 — Migration 0283: harden credit apps + fix refund FK + `payment_nature_snapshot` — 2026-05-16

### PHASE 2 — Stored Value Tables ✅ 2026-05-16
- [x] P2.1 — Migration 0284: `org_customer_wallets_mst` + `org_wallet_txn_dtl` — 2026-05-16
- [x] P2.2 — Migration 0285: `org_customer_advances_mst` + `org_advance_txn_dtl` — 2026-05-16
- [x] P2.3 — Migration 0286: `org_credit_notes_mst` + `org_credit_note_txn_dtl` — 2026-05-16

### PHASE 3 — Loyalty ✅ 2026-05-16
- [x] P3.1 — Migration 0287: 4 loyalty tables + seed (2 programs, 9 tiers) — 2026-05-16
- [x] P3.2 — Prisma models: `org_loyalty_programs_cf`, `org_loyalty_tiers_cf`, `org_loyalty_accounts_mst`, `org_loyalty_txn_dtl` — 2026-05-16

### PHASE 4 — Promotions Engine ✅ 2026-05-16
- [x] P4.1 — Migration 0288: rename promo tables + extend + seed (12 promo rows, tenant-2 conditional) — 2026-05-16
- [x] P4.2 — Prisma: rename `org_promo_codes_mst` → `org_promotions_mst`, `org_promo_usage_log` → `org_promotion_usage_dtl`; add 7 new fields; update all relation references — 2026-05-16

### PHASE 5 — Tax Configuration ✅ 2026-05-16
- [x] P5.1 — Migration 0289: `org_tax_profiles_cf` + `org_tax_exemptions_cf` + FK on `org_order_taxes_dtl` + seed — 2026-05-16
- [x] P5.2 — Prisma: `org_tax_profiles_cf`, `org_tax_exemptions_cf` models; `org_order_taxes_dtl` relation wired — 2026-05-16

### PHASE 6 — Infrastructure Tables ✅ 2026-05-16
- [x] P6.1 — Migration 0290: `sys_currency_rounding_rules_cd` + 13 currency seeds — 2026-05-16
- [x] P6.2 — Migration 0291: governance cols + routing cols + 3-batch payment method seed + cash drawers + terminals — 2026-05-16
- [x] P6.3 — Migration 0292: `org_domain_events_outbox` + `org_idempotency_keys` — 2026-05-16
- [x] P6.4 — Migration 0293: `org_fin_recon_runs_mst` + `org_fin_recon_issues_dtl` — 2026-05-16
- [x] P6.5 — Prisma: 5 new models + 10 new cols on `org_payment_methods_cf` + 8 missing back-relations on `org_tenants_mst`; build green — 2026-05-16

### PHASE 7 — Permissions + Navigation ✅ 2026-05-16
- [x] P7.1 — Migration 0294: seed all new permissions into `sys_auth_permissions` + role mappings — 2026-05-16
- [x] P7.2 — Migration 0295: seed `sys_components_cd` navigation (9 entries) + update `navigation.ts` (dual-write) — 2026-05-16

### PHASE 8 — Service Layer
- [ ] P8.1 — Extend `order-calculation.service.ts` (new return type)
- [ ] P8.2 — Create `tax-engine.service.ts`
- [ ] P8.3 — Create `order-settlement.service.ts` (+ `collectPaymentTx`)
- [ ] P8.4 — Create `stored-value.service.ts` (wallet + advance + credit note)
- [ ] P8.5 — Create `loyalty.service.ts`
- [ ] P8.6 — Create `promotion-engine.service.ts`
- [ ] P8.7 — Create `cash-drawer.service.ts`
- [ ] P8.8 — Create `order-refund.service.ts`
- [ ] P8.9 — Create `outbox.service.ts`
- [ ] P8.10 — Create `reconciliation.service.ts`
- [ ] P8.11 — Extend `invoice-service.ts` (2 new functions)
- [ ] P8.12 — Create `checkout-config.service.ts`
- [ ] Run `code-documenter` agent on all 12 service files

### PHASE 9 — API Routes
- [ ] P9.1 — Extend `create-with-payment/route.ts` + `preview-payment/route.ts`
- [ ] P9.2 — `orders/[orderId]/collect-payment/route.ts`
- [ ] P9.3 — Order refund routes (3 routes)
- [ ] P9.4 — Cash drawer routes (5 routes)
- [ ] P9.5 — Stored value routes (7 routes under `customers/[customerId]/`)
- [ ] P9.6 — Gift card routes (2 routes)
- [ ] P9.7 — Loyalty routes (4 routes)
- [ ] P9.8 — Promotions routes (6 routes)
- [ ] P9.9 — Tax config routes (5 routes)
- [ ] P9.10 — Payment config routes (4 routes)
- [ ] P9.11 — Reconciliation routes (4 routes)
- [ ] P9.12 — Financial report routes (3 routes)

### PHASE 10 — UI: Billing Section
- [ ] P10.1 — Cash Drawer pages (list + detail + session)
- [ ] P10.2 — Refunds pages (list + order tab)
- [ ] P10.3 — Reconciliation pages (list + detail + issue management)
- [ ] P10.4 — Order detail + full detail pages (Financial tab)

### PHASE 11 — UI: Customer Stored Value
- [ ] P11.1 — Stored Value hub page
- [ ] P11.2 — Customer detail Stored Value tab

### PHASE 12 — UI: Marketing
- [ ] P12.1 — Promotions management page
- [ ] P12.2 — Loyalty program management page

### PHASE 13 — UI: Config And Settings
- [ ] P13.1 — Tax Setup page
- [ ] P13.2 — Enhance Payment Setup page (terminals tab + overrides tab)

### PHASE 14 — UI: Financial Reports
- [ ] P14.1 — Financial Reports hub (3 report tabs + CSV export)

### PHASE 15 — Print & Export
- [ ] P15.1 — Enhanced receipt (charges + tax breakdown + credits + multi-leg)
- [ ] P15.2 — Cash Drawer session report (`*-rprt.tsx` pattern)
- [ ] P15.3 — Tax report CSV export
- [ ] P15.4 — Reconciliation issue PDF/CSV export

### PHASE 16 — Background Jobs
- [ ] P16.1 — `supabase/functions/outbox-worker/index.ts`
- [ ] P16.2 — Migration 0296: pg_cron jobs (outbox + expiry + recon trigger)

### PHASE 17 — i18n
- [ ] P17 — Add all keys to `messages/en.json` + `messages/ar.json`; run `npm run check:i18n`

### PHASE 18 — Testing
- [ ] P18.1 — Unit tests: 9 service files + schemas + tenant isolation
- [ ] P18.2 — Integration tests: 4 test files
- [ ] P18.3 — E2E tests: 5 Playwright spec files

### PHASE 19 — Documentation
- [x] P19.1 — `docs/features/Order_Fin/README.md`
- [x] P19.1 — `docs/features/Order_Fin/developer_guide.md`
- [x] P19.1 — `docs/features/Order_Fin/current_status.md`
- [x] P19.1 — `docs/features/Order_Fin/progress_summary.md`
- [x] P19.1 — `docs/features/Order_Fin/CHANGELOG.md`
- [x] P19.2 — `docs/features/Order_Fin/technical_docs/tech_api.md`
- [x] P19.2 — `docs/features/Order_Fin/technical_docs/tech_data_model.md`
- [x] P19.3 — 8 domain guide docs in `Order_Fin_Docs/`
- [x] P19.4 — Update `docs/features/folders_lookup.md` with Order_Fin entry
- [ ] P19.5 — Run `code-documenter` on all migration SQL files (deferred — inline SQL comments sufficient for dev phase)
- [ ] P19.5 — Run `code-documenter` on all new service TS files (deferred)
- [ ] P19.5 — Run `code-documenter` on all new API route files (deferred)

---

### Build Checks (run after every phase)
- [x] `cd web-admin && npx tsc --noEmit` — 0 errors (2026-05-18)
- [x] `cd web-admin && npm run check:i18n` — passed (2026-05-18)
- [ ] `cd web-admin && npm run build` — not yet run (full Next.js build)
- [ ] `npm run check:i18n` — no missing keys (after Phase 17)
