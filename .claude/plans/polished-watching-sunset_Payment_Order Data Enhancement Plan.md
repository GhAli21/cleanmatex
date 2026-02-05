# Payment & Order Data Enhancement Plan

## Overview
Enhance payment and order tables to capture complete financial transaction details including VAT, discounts, currency exchange rates, and payment metadata. This addresses critical gaps in the current implementation where calculated amounts (VAT, discounts) are lost after order submission.

## Current State Analysis

### Critical Issues Identified

1. **Missing Data in org_payments_dtl_tr**
   - ❌ `order_id` - Currently NULLABLE, not always populated
   - ❌ `customer_id` - Currently NULLABLE, not always populated
   - ❌ VAT/discount breakdowns only in metadata (non-queryable)
   - ❌ Payment modal calculates totals but they're lost after submission

2. **Missing Data in org_orders_mst**
   - ❌ No `currency_code` column
   - ❌ No `currency_ex_rate` column
   - ❌ No `vat` column (only generic `tax`)
   - ❌ No `vat_rate` column
   - ❌ No `discount_rate` column
   - ❌ No breakdown of discount types (manual vs promo vs gift card)
   - ❌ Existing money fields use DECIMAL(10,3) instead of standard DECIMAL(19,4)

3. **Missing Data in org_invoice_mst**
   - ❌ No `currency_code` column
   - ❌ No `vat` column (only generic `tax`)
   - ❌ No `vat_rate` stored as column
   - ❌ Discount amount stored but no percentage/type breakdown
   - ❌ Existing money fields use DECIMAL(10,3) instead of standard DECIMAL(19,4)

### Current Schema Strengths

✓ org_payments_dtl_tr has flexible `invoice_id OR order_id OR customer_id` relationship
✓ org_payments_dtl_tr already uses DECIMAL(19,4) for money fields (correct precision)
✓ Metadata JSONB columns exist for extensibility
✓ Proper tenant isolation on all tables
✓ Payment method/type codes properly enforced via FK
✓ Audit fields (created_at/by, updated_at/by) consistent

### Precision Standard

**All money fields will use DECIMAL(19,4)** for consistency:
- Supports up to 999,999,999,999,999.9999
- 4 decimal places accommodate micro-payments and exchange rate precision
- Matches existing org_payments_dtl_tr standard

### Currency Configuration

**Currency values come from tenant settings, NOT hardcoded:**
- `currency_code`: Retrieved from `TENANT_CURRENCY` setting via `tenantSettingsService.getSettingValue()`
- `decimal_places`: Retrieved from branch settings `TENANT_DECIMAL_PLACES`, fallback to tenant settings
- No database defaults for currency_code - must be populated dynamically in application code
- Each tenant can have different currency (OMR, SAR, AED, KWD, etc.)

## Proposed Schema Changes

### 1. org_orders_mst Enhancements

**New Columns:**
```sql
-- Currency fields
currency_code VARCHAR(3) NOT NULL  -- No default - populated from tenant settings
currency_ex_rate DECIMAL(10,6) NOT NULL DEFAULT 1.000000

-- VAT breakdown
vat_rate DECIMAL(5,2) DEFAULT 0  -- e.g., 5.00 for 5%
vat_amount DECIMAL(19,4) DEFAULT 0  -- Consistent with payment table

-- Discount breakdown
discount_rate DECIMAL(5,2) DEFAULT 0  -- Percentage discount applied
discount_type VARCHAR(20)  -- 'manual', 'promo', 'auto', 'gift_card'
promo_code_id UUID  -- FK to org_promo_codes_mst
gift_card_id UUID  -- FK to org_gift_cards_mst
promo_discount_amount DECIMAL(19,4) DEFAULT 0  -- Consistent with payment table
gift_card_discount_amount DECIMAL(19,4) DEFAULT 0  -- Consistent with payment table

-- Payment reference
payment_type_code VARCHAR(30)  -- FK to sys_payment_type_cd
```

**Rationale:**
- `currency_ex_rate`: Future-proof for multi-currency support (GCC expansion)
- `vat_rate` vs `vat_amount`: Store both for audit trail (rate can change over time)
- Separate discount tracking: Essential for reporting/analytics
- `payment_type_code`: Links to PAY_IN_ADVANCE, PAY_ON_COLLECTION, etc.
- **DECIMAL(19,4)**: Consistent precision for all money fields across all tables

### 2. org_payments_dtl_tr Enhancements

**Modified Columns:**
```sql
-- Keep existing flexible relationship model
-- order_id, customer_id, invoice_id all remain NULLABLE
-- Existing constraint ensures at least ONE is NOT NULL
```

**New Columns:**
```sql
-- Amount breakdown (move from metadata to columns)
subtotal DECIMAL(19,4) DEFAULT 0
discount_rate DECIMAL(5,2) DEFAULT 0
discount_amount DECIMAL(19,4) DEFAULT 0
vat_rate DECIMAL(5,2) DEFAULT 0
vat_amount DECIMAL(19,4) DEFAULT 0  -- Rename current 'vat' to 'vat_amount' for clarity
tax_amount DECIMAL(19,4) DEFAULT 0  -- Rename current 'tax' to 'tax_amount'

-- Discount breakdown
manual_discount_amount DECIMAL(19,4) DEFAULT 0
promo_discount_amount DECIMAL(19,4) DEFAULT 0
gift_card_applied_amount DECIMAL(19,4) DEFAULT 0
promo_code_id UUID  -- FK to org_promo_codes_mst
gift_card_id UUID  -- FK to org_gift_cards_mst

-- Currency fields
currency_ex_rate DECIMAL(10,6) NOT NULL DEFAULT 1.000000

-- Check payment details
check_number VARCHAR(100)  -- Move from metadata to column for indexing
check_bank VARCHAR(100)
check_date DATE
```

**Enhanced Metadata Structure:**
```typescript
interface PaymentMetadata {
  // Gateway responses
  gateway_transaction_id?: string;
  gateway_response?: Record<string, any>;
  card_last_four?: string;
  card_brand?: string;

  // Additional context
  payment_notes?: string;
  reconciliation_reference?: string;

  // Full calculation breakdown (for audit)
  calculation_breakdown?: {
    original_subtotal: number;
    manual_discount: { type: 'percent' | 'amount', value: number };
    promo_discount: { code: string, amount: number };
    subtotal_after_discounts: number;
    vat_calculation: { rate: number, amount: number };
    gift_card_applied: { number: string, amount: number };
    final_total: number;
  };

  // Extensibility
  [key: string]: any;
}
```

**Constraint - No Changes:**
```sql
-- Keep existing flexible constraint (no modification needed)
-- Existing: CHECK (invoice_id IS NOT NULL OR order_id IS NOT NULL OR customer_id IS NOT NULL)
-- This allows: invoice-only payments, order deposits, customer advances, etc.
```

### 3. org_invoice_mst Enhancements

**New Columns:**
```sql
-- Currency fields
currency_code VARCHAR(3) NOT NULL  -- No default - populated from tenant settings
currency_ex_rate DECIMAL(10,6) NOT NULL DEFAULT 1.000000

-- VAT breakdown
vat_rate DECIMAL(5,2) DEFAULT 0
vat_amount DECIMAL(19,4) DEFAULT 0  -- Consistent precision

-- Discount breakdown
discount_rate DECIMAL(5,2) DEFAULT 0  -- Percentage
discount_type VARCHAR(20)  -- 'manual', 'promo', 'auto'
promo_code_id UUID  -- FK to org_promo_codes_mst
promo_discount_amount DECIMAL(19,4) DEFAULT 0  -- Consistent precision
```

**Enhanced Metadata:**
```typescript
interface InvoiceMetadata {
  // Promo/gift card details
  promo_code_applied?: string;
  gift_card_applied?: string;
  gift_card_amount?: number;

  // Tax breakdown for complex scenarios
  tax_breakdown?: {
    vat: { rate: number, amount: number };
    service_tax?: { rate: number, amount: number };
    delivery_tax?: { rate: number, amount: number };
  };

  // Payment gateway integration
  payment_gateway_response?: Record<string, any>;

  // Billing details
  billing_address?: Record<string, any>;

  [key: string]: any;
}
```

## Additional Suggestions

### 1. New Column: org_orders_mst.service_charge

**Rationale:** Many laundry services charge delivery fees, express service fees, or special handling charges

```sql
service_charge DECIMAL(19,4) DEFAULT 0  -- Consistent precision
service_charge_type VARCHAR(50)  -- 'delivery', 'express', 'special_handling'
```

### 2. New Column: org_payments_dtl_tr.payment_channel

**Rationale:** Track where payment originated (useful for analytics)

```sql
payment_channel VARCHAR(30)  -- 'web_admin', 'mobile_app', 'pos', 'api', 'whatsapp'
```

### 3. New Column: org_orders_mst.payment_terms

**Rationale:** For corporate/invoice customers with credit terms

```sql
payment_terms VARCHAR(50)  -- 'net_30', 'net_60', 'immediate', 'cod'
payment_due_date DATE
```

### 4. New Table: org_payment_reconciliation_log

**Rationale:** Track daily cash/card reconciliation for accounting

```sql
CREATE TABLE org_payment_reconciliation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  reconciliation_date DATE NOT NULL,
  payment_method_code VARCHAR(50) NOT NULL,
  expected_amount DECIMAL(19,4) NOT NULL,
  actual_amount DECIMAL(19,4) NOT NULL,
  variance DECIMAL(19,4) NOT NULL,
  reconciled_by VARCHAR(120),
  reconciled_at TIMESTAMP,
  notes TEXT,
  status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'reconciled', 'variance_noted'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120)
);
```

## Migration Strategy

### Migration 0089: Enhance org_orders_mst

```sql
-- Add currency fields
-- Note: No DEFAULT for currency_code - must be populated from tenant settings
ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3),  -- Will be made NOT NULL after data population
  ADD COLUMN IF NOT EXISTS currency_ex_rate DECIMAL(10,6) NOT NULL DEFAULT 1.000000;

-- Add VAT breakdown
ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS vat_rate DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_amount DECIMAL(19,4) DEFAULT 0;

-- Add discount breakdown
ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS discount_rate DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS promo_code_id UUID,
  ADD COLUMN IF NOT EXISTS gift_card_id UUID,
  ADD COLUMN IF NOT EXISTS promo_discount_amount DECIMAL(19,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gift_card_discount_amount DECIMAL(19,4) DEFAULT 0;

-- Add payment type
ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS payment_type_code VARCHAR(30);

-- Add service charge
ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS service_charge DECIMAL(19,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_charge_type VARCHAR(50);

-- Add payment terms
ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(50),
  ADD COLUMN IF NOT EXISTS payment_due_date DATE;

-- Add foreign keys
ALTER TABLE org_orders_mst
  ADD CONSTRAINT fk_orders_promo_code
    FOREIGN KEY (promo_code_id) REFERENCES org_promo_codes_mst(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_orders_gift_card
    FOREIGN KEY (gift_card_id) REFERENCES org_gift_cards_mst(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_orders_payment_type
    FOREIGN KEY (payment_type_code) REFERENCES sys_payment_type_cd(payment_type_code);

-- Add comments
COMMENT ON COLUMN org_orders_mst.currency_code IS 'ISO 4217 currency code (default: OMR)';
COMMENT ON COLUMN org_orders_mst.currency_ex_rate IS 'Exchange rate to base currency at time of order';
COMMENT ON COLUMN org_orders_mst.vat_rate IS 'VAT percentage applied (e.g., 5.00 for 5%)';
COMMENT ON COLUMN org_orders_mst.vat_amount IS 'Calculated VAT amount in currency';
```

### Migration 0090: Enhance org_payments_dtl_tr

```sql
-- Rename existing columns for clarity
ALTER TABLE org_payments_dtl_tr
  RENAME COLUMN tax TO tax_amount;
ALTER TABLE org_payments_dtl_tr
  RENAME COLUMN vat TO vat_amount;

-- Keep order_id and customer_id NULLABLE for flexibility
-- (User decision: maintain flexibility for deposits, refunds, etc.)

-- Add new amount breakdown columns
ALTER TABLE org_payments_dtl_tr
  ADD COLUMN IF NOT EXISTS subtotal DECIMAL(19,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_rate DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(19,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_rate DECIMAL(5,2) DEFAULT 0;

-- Add discount breakdown
ALTER TABLE org_payments_dtl_tr
  ADD COLUMN IF NOT EXISTS manual_discount_amount DECIMAL(19,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promo_discount_amount DECIMAL(19,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gift_card_applied_amount DECIMAL(19,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promo_code_id UUID,
  ADD COLUMN IF NOT EXISTS gift_card_id UUID;

-- Add currency exchange rate
ALTER TABLE org_payments_dtl_tr
  ADD COLUMN IF NOT EXISTS currency_ex_rate DECIMAL(10,6) NOT NULL DEFAULT 1.000000;

-- Add check details
ALTER TABLE org_payments_dtl_tr
  ADD COLUMN IF NOT EXISTS check_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS check_bank VARCHAR(100),
  ADD COLUMN IF NOT EXISTS check_date DATE;

-- Add payment channel
ALTER TABLE org_payments_dtl_tr
  ADD COLUMN IF NOT EXISTS payment_channel VARCHAR(30) DEFAULT 'web_admin';

-- Keep existing constraint (at least one reference must exist)
-- No change needed - existing constraint remains:
-- CHECK (invoice_id IS NOT NULL OR order_id IS NOT NULL OR customer_id IS NOT NULL)

-- Add foreign keys
ALTER TABLE org_payments_dtl_tr
  ADD CONSTRAINT fk_payments_promo_code
    FOREIGN KEY (promo_code_id) REFERENCES org_promo_codes_mst(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_payments_gift_card
    FOREIGN KEY (gift_card_id) REFERENCES org_gift_cards_mst(id) ON DELETE SET NULL;

-- Create index for check numbers
CREATE INDEX IF NOT EXISTS idx_payments_check_number
  ON org_payments_dtl_tr(tenant_org_id, check_number)
  WHERE check_number IS NOT NULL;
```

### Migration 0091: Enhance org_invoice_mst

```sql
-- Add currency fields
-- Note: No DEFAULT for currency_code - must be populated from tenant settings
ALTER TABLE org_invoice_mst
  ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3),  -- Will be made NOT NULL after data population
  ADD COLUMN IF NOT EXISTS currency_ex_rate DECIMAL(10,6) NOT NULL DEFAULT 1.000000;

-- Add VAT breakdown
ALTER TABLE org_invoice_mst
  ADD COLUMN IF NOT EXISTS vat_rate DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_amount DECIMAL(19,4) DEFAULT 0;

-- Add discount breakdown
ALTER TABLE org_invoice_mst
  ADD COLUMN IF NOT EXISTS discount_rate DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS promo_code_id UUID,
  ADD COLUMN IF NOT EXISTS promo_discount_amount DECIMAL(19,4) DEFAULT 0;

-- Add foreign keys
ALTER TABLE org_invoice_mst
  ADD CONSTRAINT fk_invoice_promo_code
    FOREIGN KEY (promo_code_id) REFERENCES org_promo_codes_mst(id) ON DELETE SET NULL;
```

### Migration 0092: Create payment reconciliation log

```sql
CREATE TABLE IF NOT EXISTS org_payment_reconciliation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  reconciliation_date DATE NOT NULL,
  payment_method_code VARCHAR(50) NOT NULL REFERENCES sys_payment_method_cd(payment_method_code),
  expected_amount DECIMAL(19,4) NOT NULL,
  actual_amount DECIMAL(19,4) NOT NULL,
  variance DECIMAL(19,4) GENERATED ALWAYS AS (actual_amount - expected_amount) STORED,
  reconciled_by VARCHAR(120),
  reconciled_at TIMESTAMP,
  notes TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reconciled', 'variance_noted')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  updated_at TIMESTAMP,
  updated_by VARCHAR(120),

  CONSTRAINT unique_reconciliation_per_day
    UNIQUE (tenant_org_id, reconciliation_date, payment_method_code)
);

-- Enable RLS
ALTER TABLE org_payment_reconciliation_log ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY tenant_isolation_select ON org_payment_reconciliation_log
  FOR SELECT USING (tenant_org_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_insert ON org_payment_reconciliation_log
  FOR INSERT WITH CHECK (tenant_org_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_update ON org_payment_reconciliation_log
  FOR UPDATE USING (tenant_org_id = current_setting('app.current_tenant_id')::uuid);

-- Indexes
CREATE INDEX idx_reconciliation_tenant_date ON org_payment_reconciliation_log(tenant_org_id, reconciliation_date DESC);
CREATE INDEX idx_reconciliation_status ON org_payment_reconciliation_log(tenant_org_id, status);
```

## Code Changes Required

### 0. Enhance Tenant Settings Service

**File:** [web-admin/lib/services/tenant-settings.service.ts](web-admin/lib/services/tenant-settings.service.ts)

Add new methods to retrieve currency and decimal places settings:

```typescript
/**
 * Get tenant's configured currency code
 * @param tenantId - The tenant organization ID
 * @param branchId - Optional branch ID for branch-specific currency
 * @returns Promise<string> - Currency code (e.g., 'OMR', 'SAR', 'AED')
 */
async getTenantCurrency(
  tenantId: string,
  branchId?: string
): Promise<string> {
  try {
    // First check branch settings if branchId provided
    if (branchId) {
      const branchCurrency = await this.getSettingValue(branchId, 'BRANCH_CURRENCY');
      if (branchCurrency) return branchCurrency;
    }

    // Fall back to tenant settings
    const tenantCurrency = await this.getSettingValue(tenantId, 'TENANT_CURRENCY');
    return tenantCurrency || 'OMR'; // Default fallback
  } catch (error) {
    console.error('[TenantSettingsService] Error getting currency:', error);
    return 'OMR'; // Safe default
  }
}

/**
 * Get tenant's configured decimal places for currency
 * @param tenantId - The tenant organization ID
 * @param branchId - Optional branch ID for branch-specific decimal places
 * @returns Promise<number> - Decimal places (typically 2, 3, or 4)
 */
async getTenantDecimalPlaces(
  tenantId: string,
  branchId?: string
): Promise<number> {
  try {
    // First check branch settings if branchId provided
    if (branchId) {
      const branchDecimal = await this.getSettingValue(branchId, 'TENANT_DECIMAL_PLACES');
      if (branchDecimal !== null) return parseInt(branchDecimal, 10);
    }

    // Fall back to tenant settings
    const tenantDecimal = await this.getSettingValue(tenantId, 'TENANT_DECIMAL_PLACES');
    return tenantDecimal ? parseInt(tenantDecimal, 10) : 3; // Default 3 for OMR
  } catch (error) {
    console.error('[TenantSettingsService] Error getting decimal places:', error);
    return 3; // Safe default
  }
}

/**
 * Get currency configuration (code + decimal places) in one call
 * @param tenantId - The tenant organization ID
 * @param branchId - Optional branch ID
 * @returns Promise<{currencyCode: string, decimalPlaces: number}>
 */
async getCurrencyConfig(
  tenantId: string,
  branchId?: string
): Promise<{ currencyCode: string; decimalPlaces: number }> {
  const [currencyCode, decimalPlaces] = await Promise.all([
    this.getTenantCurrency(tenantId, branchId),
    this.getTenantDecimalPlaces(tenantId, branchId),
  ]);

  return { currencyCode, decimalPlaces };
}
```

**Rationale:**
- Centralized currency configuration retrieval
- Branch-level overrides with tenant-level fallbacks
- Safe defaults (OMR, 3 decimals) if settings not configured
- Parallel fetching for performance

### 1. Update TypeScript Types

**File:** [web-admin/types/database.ts](web-admin/types/database.ts)

Add new fields to table interfaces:
- `OrgOrdersMst` - currency, VAT, discount breakdown fields
- `OrgPaymentsDtlTr` - amount breakdown, check details
- `OrgInvoiceMst` - currency, VAT fields

### 2. Update Prisma Schema

**File:** [web-admin/prisma/schema.prisma](web-admin/prisma/schema.prisma)

Regenerate after migrations with:
```bash
npx prisma db pull
npx prisma generate
```

### 3. Update Payment Service

**File:** [web-admin/lib/services/payment-service.ts](web-admin/lib/services/payment-service.ts)

**Function:** `recordPaymentTransaction` (lines 359-397)

**Add import:**
```typescript
import { tenantSettingsService } from './tenant-settings.service';
```

**Change from:**
```typescript
await prisma.org_payments_dtl_tr.create({
  data: {
    tenant_org_id: tenantId,
    invoice_id: input.invoiceId,
    order_id: input.orderId,
    customer_id: input.customerId,
    paid_amount: input.amount,
    tax: input.tax || 0,
    vat: input.vat || 0,
    // ... existing fields
  }
});
```

**To:**
```typescript
// Get currency configuration from tenant settings
const { currencyCode } = await tenantSettingsService.getCurrencyConfig(
  tenantId,
  input.branchId
);

await prisma.org_payments_dtl_tr.create({
  data: {
    // Required fields
    tenant_org_id: tenantId,
    invoice_id: input.invoiceId,
    order_id: input.orderId,  // Still nullable
    customer_id: input.customerId,  // Still nullable

    // Amount breakdown
    subtotal: input.subtotal,
    discount_rate: input.discountRate || 0,
    discount_amount: input.discountAmount || 0,
    manual_discount_amount: input.manualDiscountAmount || 0,
    promo_discount_amount: input.promoDiscountAmount || 0,
    gift_card_applied_amount: input.giftCardAmount || 0,

    // VAT/Tax
    vat_rate: input.vatRate || 0,
    vat_amount: input.vatAmount || 0,
    tax_amount: input.taxAmount || 0,

    // Total
    paid_amount: input.finalTotal,

    // Currency (from tenant settings, NOT hardcoded)
    currency_code: input.currencyCode || currencyCode,
    currency_ex_rate: input.currencyExRate || 1.0,

    // Payment details
    payment_method_code: input.paymentMethod,
    payment_type_code: input.paymentType,
    payment_channel: 'web_admin',

    // Check details (if applicable)
    check_number: input.checkNumber,
    check_bank: input.checkBank,
    check_date: input.checkDate,

    // References
    promo_code_id: input.promoCodeId,
    gift_card_id: input.giftCardId,

    // Enhanced metadata
    metadata: {
      calculation_breakdown: {
        original_subtotal: input.subtotal,
        manual_discount: input.manualDiscount,
        promo_discount: { code: input.promoCode, amount: input.promoDiscountAmount },
        subtotal_after_discounts: input.afterDiscounts,
        vat_calculation: { rate: input.vatRate, amount: input.vatAmount },
        gift_card_applied: { number: input.giftCardNumber, amount: input.giftCardAmount },
        final_total: input.finalTotal
      },
      ...input.metadata
    },

    // Audit
    status: 'completed',
    paid_at: new Date(),
    paid_by: userId,
    created_by: userId,
  }
});
```

### 4. Update Order Submission Hook

**File:** [web-admin/src/features/orders/hooks/use-order-submission.ts](web-admin/src/features/orders/hooks/use-order-submission.ts)

**Lines:** 76-133

Enhance the payload sent to `/api/v1/orders` to include:
```typescript
{
  // ... existing order data

  // Currency (will be fetched from tenant settings in API)
  // currencyCode - not needed in payload, API will fetch from settings
  currencyExRate: 1.0,

  // VAT breakdown
  vatRate: paymentData.totals.vatTaxPercent,
  vatAmount: paymentData.totals.vatValue,

  // Discount breakdown
  discountRate: paymentData.percentDiscount || 0,
  discountType: paymentData.promoCode ? 'promo' :
                paymentData.percentDiscount || paymentData.amountDiscount ? 'manual' : null,
  promoCodeId: paymentData.promoCodeId,
  giftCardId: paymentData.giftCardId,
  promoDiscountAmount: paymentData.promoDiscount || 0,
  giftCardDiscountAmount: paymentData.giftCardAmount || 0,

  // Payment type
  paymentTypeCode: getPaymentTypeFromMethod(paymentData.paymentMethod),

  // Payment details for transaction
  paymentDetails: {
    subtotal: paymentData.totals.subtotal,
    discountRate: paymentData.percentDiscount || 0,
    discountAmount: paymentData.totals.manualDiscount + paymentData.totals.promoDiscount,
    manualDiscountAmount: paymentData.totals.manualDiscount,
    promoDiscountAmount: paymentData.totals.promoDiscount,
    giftCardAmount: paymentData.totals.giftCardApplied,
    vatRate: paymentData.totals.vatTaxPercent,
    vatAmount: paymentData.totals.vatValue,
    finalTotal: paymentData.totals.finalTotal,
    checkNumber: paymentData.checkNumber,
    promoCode: paymentData.promoCode,
    giftCardNumber: paymentData.giftCardNumber,
  }
}
```

### 5. Update Order API Route

**File:** [web-admin/app/api/v1/orders/route.ts](web-admin/app/api/v1/orders/route.ts) (inferred path)

**Add import:**
```typescript
import { tenantSettingsService } from '@/lib/services/tenant-settings.service';
```

Update the order creation to save new fields to `org_orders_mst`:
```typescript
// Get currency configuration from tenant settings
const { currencyCode } = await tenantSettingsService.getCurrencyConfig(
  tenantId,
  input.branchId
);

const order = await prisma.org_orders_mst.create({
  data: {
    // ... existing fields

    // Currency (from tenant settings)
    currency_code: input.currencyCode || currencyCode,
    currency_ex_rate: input.currencyExRate || 1.0,

    // VAT
    vat_rate: input.vatRate || 0,
    vat_amount: input.vatAmount || 0,

    // Discount breakdown
    discount_rate: input.discountRate || 0,
    discount_type: input.discountType,
    promo_code_id: input.promoCodeId,
    gift_card_id: input.giftCardId,
    promo_discount_amount: input.promoDiscountAmount || 0,
    gift_card_discount_amount: input.giftCardDiscountAmount || 0,

    // Payment type
    payment_type_code: input.paymentTypeCode,
  }
});
```

Then pass the enhanced `paymentDetails` to `processPayment()`.

### 6. Update Payment Action

**File:** [web-admin/app/actions/payments/process-payment.ts](web-admin/app/actions/payments/process-payment.ts)

Update the `ProcessPaymentInput` interface to accept all new fields:
```typescript
export interface ProcessPaymentInput {
  orderId: string;
  amount: number;  // Keep for backward compatibility
  paymentMethod: PaymentMethodCode;
  paymentKind: 'invoice' | 'deposit' | 'advance' | 'pos';

  // New: Amount breakdown
  subtotal?: number;
  discountRate?: number;
  discountAmount?: number;
  manualDiscountAmount?: number;
  promoDiscountAmount?: number;
  giftCardAmount?: number;
  vatRate?: number;
  vatAmount?: number;
  taxAmount?: number;
  finalTotal?: number;

  // New: Currency (optional - will default to tenant settings)
  currencyCode?: string;
  currencyExRate?: number;
  branchId?: string;  // For branch-specific currency settings

  // New: References
  promoCodeId?: string;
  giftCardId?: string;
  promoCode?: string;
  giftCardNumber?: string;

  // New: Check details
  checkNumber?: string;
  checkBank?: string;
  checkDate?: Date;

  // Existing
  notes?: string;
}
```

### 7. Update Invoice Creation

**File:** [web-admin/lib/services/payment-service.ts](web-admin/lib/services/payment-service.ts)

**Function:** `createInvoiceForOrder` (lines 1259-1292)

**Change from:**
```typescript
await prisma.org_invoice_mst.create({
  data: {
    subtotal: amountToCharge,
    discount: 0,  // ❌ Hardcoded
    tax: 0,       // ❌ Hardcoded
    total: amountToCharge,
    // ...
  }
});
```

**To:**
```typescript
// Get currency from tenant settings if order doesn't have it
const { currencyCode } = await tenantSettingsService.getCurrencyConfig(
  order.tenant_org_id,
  order.branch_id
);

await prisma.org_invoice_mst.create({
  data: {
    // Amount breakdown from order
    subtotal: order.subtotal,
    discount: order.discount,
    tax: order.tax,
    vat_rate: order.vat_rate,
    vat_amount: order.vat_amount,
    total: order.total,

    // Currency (from order or tenant settings)
    currency_code: order.currency_code || currencyCode,
    currency_ex_rate: order.currency_ex_rate || 1.0,

    // Discount details
    discount_rate: order.discount_rate,
    discount_type: order.discount_type,
    promo_code_id: order.promo_code_id,
    promo_discount_amount: order.promo_discount_amount,

    // ...rest
  }
});
```

### 8. Update Payment Validation Schema

**File:** [web-admin/lib/validations/new-order-payment-schemas.ts](web-admin/lib/validations/new-order-payment-schemas.ts)

Add validation for new fields:
```typescript
export const newOrderPaymentSchema = z.object({
  // ... existing fields

  // Amount breakdown
  subtotal: z.number().min(0),
  manualDiscountAmount: z.number().min(0).optional(),
  promoDiscountAmount: z.number().min(0).optional(),
  giftCardAmount: z.number().min(0).optional(),
  vatRate: z.number().min(0).max(100),
  vatAmount: z.number().min(0),
  finalTotal: z.number().min(0),

  // Currency (optional - defaults from tenant settings)
  currencyCode: z.string().length(3).optional(),
  currencyExRate: z.number().min(0).default(1.0),
  branchId: z.string().uuid().optional(),

  // Check details
  checkBank: z.string().optional(),
  checkDate: z.date().optional(),
});
```

**Note:** Currency code is optional in validation - the API will fetch from tenant settings if not provided.

### 9. Add Migration for Currency Settings

**Create:** `supabase/migrations/0093_seed_currency_settings.sql`

```sql
-- Seed default currency settings for existing tenants
-- This ensures all tenants have TENANT_CURRENCY and TENANT_DECIMAL_PLACES configured

-- Insert TENANT_CURRENCY setting definition (if not exists)
INSERT INTO sys_tenant_settings_cd (setting_code, setting_name, setting_name2, setting_type, default_value, is_active)
VALUES
  ('TENANT_CURRENCY', 'Tenant Currency Code', 'رمز عملة المستأجر', 'string', 'OMR', true),
  ('TENANT_DECIMAL_PLACES', 'Currency Decimal Places', 'المنازل العشرية للعملة', 'number', '3', true),
  ('BRANCH_CURRENCY', 'Branch Currency Code', 'رمز عملة الفرع', 'string', NULL, true)
ON CONFLICT (setting_code) DO NOTHING;

-- Apply default currency settings to all existing tenants (if not already set)
INSERT INTO org_tenant_settings_cf (tenant_org_id, setting_code, setting_value, created_at, created_by)
SELECT
  t.id as tenant_org_id,
  'TENANT_CURRENCY' as setting_code,
  'OMR' as setting_value,  -- Default for GCC region
  CURRENT_TIMESTAMP as created_at,
  'MIGRATION' as created_by
FROM org_tenants_mst t
WHERE NOT EXISTS (
  SELECT 1 FROM org_tenant_settings_cf cf
  WHERE cf.tenant_org_id = t.id AND cf.setting_code = 'TENANT_CURRENCY'
);

INSERT INTO org_tenant_settings_cf (tenant_org_id, setting_code, setting_value, created_at, created_by)
SELECT
  t.id as tenant_org_id,
  'TENANT_DECIMAL_PLACES' as setting_code,
  '3' as setting_value,  -- 3 decimals for OMR
  CURRENT_TIMESTAMP as created_at,
  'MIGRATION' as created_by
FROM org_tenants_mst t
WHERE NOT EXISTS (
  SELECT 1 FROM org_tenant_settings_cf cf
  WHERE cf.tenant_org_id = t.id AND cf.setting_code = 'TENANT_DECIMAL_PLACES'
);

COMMENT ON COLUMN sys_tenant_settings_cd.setting_code IS 'Unique identifier for setting (TENANT_CURRENCY, TENANT_DECIMAL_PLACES, etc.)';
COMMENT ON COLUMN org_tenant_settings_cf.setting_value IS 'Value for the setting (e.g., OMR, 3, SAR)';
```

**Rationale:**
- Ensures all tenants have currency configuration
- Supports future multi-currency expansion (SAR, AED, KWD, BHD)
- Allows per-tenant currency customization

## Critical Files to Modify

1. **Database Migrations**
   - Create: `supabase/migrations/0089_enhance_org_orders_mst.sql`
   - Create: `supabase/migrations/0090_enhance_org_payments_dtl_tr.sql`
   - Create: `supabase/migrations/0091_enhance_org_invoice_mst.sql`
   - Create: `supabase/migrations/0092_create_payment_reconciliation_log.sql`
   - Create: `supabase/migrations/0093_seed_currency_settings.sql`

2. **TypeScript Types**
   - Modify: [web-admin/types/database.ts](web-admin/types/database.ts)
   - Modify: [web-admin/types/database.generated.ts](web-admin/types/database.generated.ts) (via `prisma generate`)
   - Modify: [web-admin/lib/types/payment.ts](web-admin/lib/types/payment.ts)

3. **Prisma Schema**
   - Modify: [web-admin/prisma/schema.prisma](web-admin/prisma/schema.prisma) (via `prisma db pull`)

4. **Backend Services**
   - Modify: [web-admin/lib/services/tenant-settings.service.ts](web-admin/lib/services/tenant-settings.service.ts)
     - Add: `getTenantCurrency()` method
     - Add: `getTenantDecimalPlaces()` method
     - Add: `getCurrencyConfig()` method
   - Modify: [web-admin/lib/services/payment-service.ts](web-admin/lib/services/payment-service.ts)
     - Function: `recordPaymentTransaction` (lines 359-397)
     - Function: `createInvoiceForOrder` (lines 1259-1292)

5. **API Actions**
   - Modify: [web-admin/app/actions/payments/process-payment.ts](web-admin/app/actions/payments/process-payment.ts)
   - Modify: [web-admin/app/api/v1/orders/route.ts](web-admin/app/api/v1/orders/route.ts) (inferred)

6. **Frontend Hooks**
   - Modify: [web-admin/src/features/orders/hooks/use-order-submission.ts](web-admin/src/features/orders/hooks/use-order-submission.ts) (lines 76-133)

7. **Validation**
   - Modify: [web-admin/lib/validations/new-order-payment-schemas.ts](web-admin/lib/validations/new-order-payment-schemas.ts)

## Verification Plan

### 1. Database Schema Verification

```bash
# After running migrations
psql -U postgres -d cleanmatex_dev

# Verify org_orders_mst columns
\d org_orders_mst

# Verify org_payments_dtl_tr columns
\d org_payments_dtl_tr

# Verify org_invoice_mst columns
\d org_invoice_mst

# Verify new reconciliation table
\d org_payment_reconciliation_log

# Check foreign keys
SELECT conname, conrelid::regclass, confrelid::regclass
FROM pg_constraint
WHERE contype = 'f'
AND conrelid::regclass::text IN ('org_orders_mst', 'org_payments_dtl_tr', 'org_invoice_mst');
```

### 2. Type Generation Verification

```bash
cd web-admin
npx prisma db pull
npx prisma generate

# Verify types compile
npm run build
```

### 3. End-to-End Test

**Scenario:** Create new order with payment including VAT, discounts, and gift card

1. Navigate to `/dashboard/orders/new`
2. Add items to order (subtotal: 100.000 OMR)
3. Apply 10% manual discount (discount: 10.000 OMR)
4. Apply promo code "WELCOME10" (additional 5.000 OMR)
5. Apply gift card worth 10.000 OMR
6. VAT 5% calculated on (100 - 10 - 5) = 85.000 = 4.250 OMR
7. Final total: 85.000 + 4.250 - 10.000 = 79.250 OMR
8. Select payment method: Card
9. Submit order

**Verify in Database:**
```sql
-- Check order record
SELECT
  order_no,
  subtotal,  -- Should be 100.000
  discount,  -- Should be 15.000 (10 + 5)
  discount_rate,  -- Should be 10.00
  promo_discount_amount,  -- Should be 5.000
  gift_card_discount_amount,  -- Should be 10.000
  vat_rate,  -- Should be 5.00
  vat_amount,  -- Should be 4.250
  total,  -- Should be 79.250
  currency_code,  -- Should be 'OMR'
  currency_ex_rate,  -- Should be 1.000000
  payment_type_code
FROM org_orders_mst
WHERE order_no = '<order_number>';

-- Check payment record
SELECT
  subtotal,  -- Should be 100.000
  discount_amount,  -- Should be 15.000
  manual_discount_amount,  -- Should be 10.000
  promo_discount_amount,  -- Should be 5.000
  gift_card_applied_amount,  -- Should be 10.000
  vat_rate,  -- Should be 5.00
  vat_amount,  -- Should be 4.250
  paid_amount,  -- Should be 79.250
  payment_method_code,  -- Should be 'CARD'
  currency_code,  -- Should be 'OMR'
  metadata->'calculation_breakdown'  -- Should contain full breakdown
FROM org_payments_dtl_tr
WHERE order_id = '<order_id>';

-- Check invoice record
SELECT
  invoice_no,
  subtotal,
  discount,
  vat_rate,
  vat_amount,
  total,
  currency_code,
  promo_code_id,
  promo_discount_amount
FROM org_invoice_mst
WHERE order_id = '<order_id>';
```

### 4. Reporting Query Test

**Verify data is queryable for reports:**
```sql
-- Daily sales report with VAT breakdown
SELECT
  DATE(created_at) as sale_date,
  COUNT(*) as total_orders,
  SUM(subtotal) as gross_sales,
  SUM(discount) as total_discounts,
  SUM(promo_discount_amount) as promo_discounts,
  SUM(gift_card_discount_amount) as gift_card_used,
  SUM(vat_amount) as total_vat_collected,
  SUM(total) as net_sales
FROM org_orders_mst
WHERE tenant_org_id = '<tenant_id>'
  AND created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY sale_date DESC;

-- Payment method breakdown
SELECT
  payment_method_code,
  COUNT(*) as transaction_count,
  SUM(paid_amount) as total_collected,
  SUM(vat_amount) as vat_collected,
  SUM(discount_amount) as discounts_applied
FROM org_payments_dtl_tr
WHERE tenant_org_id = '<tenant_id>'
  AND paid_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY payment_method_code;
```

### 5. Migration Rollback Test

**Verify rollback scripts work if needed:**
```sql
-- Test rollback for migration 0090
BEGIN;

-- Drop new columns
ALTER TABLE org_payments_dtl_tr
  DROP COLUMN IF EXISTS subtotal,
  DROP COLUMN IF EXISTS discount_rate,
  DROP COLUMN IF EXISTS discount_amount,
  -- ... etc

-- Restore old constraint
ALTER TABLE org_payments_dtl_tr
DROP CONSTRAINT org_payments_dtl_tr_reference_check;

ALTER TABLE org_payments_dtl_tr
ADD CONSTRAINT org_payments_dtl_tr_reference_check
CHECK (
  invoice_id IS NOT NULL OR
  order_id IS NOT NULL OR
  customer_id IS NOT NULL
);

-- Test rollback works
ROLLBACK;
```

## Risks & Mitigations

### Risk 1: Breaking Changes to Existing Code
**Mitigation:**
- Keep existing columns (rename, don't drop)
- Make new fields optional/nullable initially
- Gradual migration of data population

### Risk 2: Performance Impact on Queries
**Mitigation:**
- Add indexes on new foreign keys (promo_code_id, gift_card_id)
- Monitor query performance post-deployment
- Consider materialized views for reporting

### Risk 3: Data Migration for Existing Records
**Mitigation:**
- Existing records have defaults (0, NULL, 'OMR', 1.0)
- No need to backfill historical data
- Only new orders populate new fields

### Risk 4: Data Consistency with Nullable References
**Mitigation:**
- Application-level validation ensures order_id populated for order payments
- Business logic enforces customer_id when known
- Existing constraint prevents completely orphaned payments

## Success Criteria

✓ All migrations run successfully without errors
✓ Prisma schema regenerated and types compile
✓ Frontend build succeeds without type errors
✓ End-to-end test creates order with all breakdown data saved
✓ Database queries return correct breakdown amounts
✓ Reporting queries work and are performant
✓ No existing functionality broken (payment status, invoice creation)
✓ Metadata still contains calculation_breakdown for audit trail
