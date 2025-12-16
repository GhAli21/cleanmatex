---
prd_code: PRD-SAAS-MNG-0003
title: Billing & Subscription Management
version: v0.1.0
last_updated: 2025-01-14
author: Gehad Abdo Mohammed Ali
status: Planning
priority: Critical
category: Core Platform Management
parent_prd: PRD-SAAS-MNG-0001
---

# PRD-SAAS-MNG-0003: Billing & Subscription Management

## Executive Summary

The Billing & Subscription Management system handles all financial operations for the CleanMateX SaaS platform, including subscription plans, invoice generation, payment processing, usage tracking, and revenue management. This is a **critical revenue-generating component** that must be reliable, accurate, and compliant with financial regulations.

### Problem Statement

**Current Gap**: No platform-level billing system exists for:
- Generating monthly subscription invoices for tenants
- Processing subscription payments
- Tracking usage-based charges
- Managing failed payments and dunning
- Revenue recognition and reporting
- Discount codes and promotions
- Plan upgrades/downgrades
- Refunds and credits

### Solution

Build a comprehensive billing system within the Platform HQ Console that automates subscription billing, payment processing, usage metering, and revenue management while providing full visibility and control to platform administrators.

---

## 1. Scope & Objectives

### 1.1 In Scope

**Subscription Plan Management:**
- ✅ Define and manage subscription plans (Free, Starter, Growth, Pro, Enterprise)
- ✅ Configure plan features and limits
- ✅ Set pricing and billing cycles
- ✅ Create custom enterprise plans

**Invoice Management:**
- ✅ Automated monthly invoice generation
- ✅ Usage-based billing calculations
- ✅ Invoice customization and branding
- ✅ Invoice delivery (email, PDF download)
- ✅ Invoice status tracking (pending, paid, overdue, cancelled)

**Payment Processing:**
- ✅ Multiple payment gateway integration (Stripe, HyperPay, PayTabs)
- ✅ Automated payment collection
- ✅ Payment method management
- ✅ Retry logic for failed payments
- ✅ Payment reconciliation

**Usage Tracking & Metering:**
- ✅ Track billable usage (orders, users, storage, API calls)
- ✅ Real-time usage monitoring
- ✅ Overage charges calculation
- ✅ Usage alerts and notifications

**Dunning Management:**
- ✅ Automated retry for failed payments
- ✅ Escalating email reminders
- ✅ Suspension workflow for non-payment
- ✅ Grace periods

**Revenue Management:**
- ✅ Revenue recognition
- ✅ MRR/ARR calculations
- ✅ Revenue analytics and forecasting
- ✅ Financial reporting

**Discounts & Promotions:**
- ✅ Discount code creation and management
- ✅ Percentage and fixed-amount discounts
- ✅ Time-limited promotions
- ✅ Referral credits

### 1.2 Out of Scope (Future Phases)

- ❌ Multi-currency billing (OMR only for now)
- ❌ Tax calculation automation (manual for now)
- ❌ Automated refund processing (manual approval required)
- ❌ Cryptocurrency payments
- ❌ Wire transfer automation
- ❌ Complex tiered pricing (simple tiers only)

---

## 2. Subscription Plans

### 2.1 Plan Structure

**Existing Plans** (from migration 0006):

| Plan | Price/Month | Features | Limits |
|------|-------------|----------|--------|
| **Free Trial** | OMR 0 | Basic features, 14 days | 20 orders/month, 1 branch, 2 users |
| **Starter** | OMR 29 | PDF invoices, loyalty | 100 orders/month, 1 branch, 5 users |
| **Growth** | OMR 79 | Driver app, marketplace | 500 orders/month, 3 branches, 15 users |
| **Pro** | OMR 199 | B2B, analytics, API | 2000 orders/month, 10 branches, 50 users |
| **Enterprise** | Custom | All features, white-label | Unlimited, custom limits |

### 2.2 Plan Management UI

**URL**: `/platform-admin/billing/plans`

```
┌─────────────────────────────────────────────────────────────┐
│ Subscription Plans Management                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ [+ Create Custom Plan]                          [Import]    │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ FREE TRIAL                                    [Edit]    ││
│ │ OMR 0.000 / month                                       ││
│ │                                                         ││
│ │ Features: Basic features only                           ││
│ │ Limits: 20 orders/mo, 1 branch, 2 users                ││
│ │ Duration: 14 days                                       ││
│ │ Active Tenants: 15                                      ││
│ │                                                         ││
│ │ [View Details] [Duplicate] [Deactivate]                ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ STARTER                                       [Edit]    ││
│ │ OMR 29.000 / month                                      ││
│ │                                                         ││
│ │ Features: PDF invoices, loyalty programs                ││
│ │ Limits: 100 orders/mo, 1 branch, 5 users               ││
│ │ Active Tenants: 45                                      ││
│ │ MRR: OMR 1,305.000                                      ││
│ │                                                         ││
│ │ [View Details] [Duplicate] [Edit Pricing]              ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ ... (Growth, Pro, Enterprise)                               │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 Plan Configuration

**Edit Plan Modal:**

```typescript
interface SubscriptionPlan {
  plan_code: string,              // 'STARTER', 'GROWTH', etc.
  plan_name: string,
  plan_name_ar: string,
  description: string,
  description_ar: string,

  // Pricing
  base_price: number,             // Monthly base price in OMR
  annual_price: number | null,    // Optional annual pricing
  setup_fee: number | null,       // One-time setup fee

  // Billing
  billing_cycle: 'monthly' | 'annual' | 'custom',
  trial_days: number,             // 0 for no trial

  // Features (JSONB)
  features: {
    pdf_invoices: boolean,
    whatsapp_receipts: boolean,
    in_app_receipts: boolean,
    printing: boolean,
    b2b_contracts: boolean,
    white_label: boolean,
    marketplace_listings: boolean,
    loyalty_programs: boolean,
    driver_app: boolean,
    multi_branch: boolean,
    advanced_analytics: boolean,
    api_access: boolean
  },

  // Limits (JSONB)
  limits: {
    max_orders_per_month: number,  // -1 for unlimited
    max_branches: number,
    max_users: number,
    max_storage_mb: number,
    max_api_calls_per_month: number
  },

  // Overage pricing (optional)
  overage_pricing: {
    per_order: number | null,      // OMR per order beyond limit
    per_user: number | null,       // OMR per additional user
    per_gb_storage: number | null
  },

  // Visibility
  is_public: boolean,              // Show on website
  is_active: boolean,              // Available for selection
  is_default: boolean,             // Default plan for new tenants

  // Metadata
  display_order: number,
  recommended: boolean,            // "Most Popular" badge
  color: string,                   // UI theme color
  icon: string                     // Plan icon
}
```

### 2.4 Custom Enterprise Plans

**Create Custom Plan Form:**

```
┌─────────────────────────────────────────────────────────────┐
│ Create Custom Enterprise Plan                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Tenant: [Select Tenant ▼]                                   │
│                                                             │
│ Plan Name: [___________________________]                     │
│ Plan Code: [ENTERPRISE_CUSTOM_001_____]                     │
│                                                             │
│ Pricing                                                     │
│ Base Price: OMR [_____] / [Monthly ▼]                      │
│ Setup Fee:  OMR [_____] (optional)                          │
│ Contract Term: [12] months                                  │
│                                                             │
│ Custom Limits                                               │
│ Max Orders/Month:  [Unlimited ▼] or [_____]                │
│ Max Branches:      [_____]                                  │
│ Max Users:         [_____]                                  │
│ Max Storage:       [_____] GB                               │
│ Max API Calls/Month: [_____]                                │
│                                                             │
│ Features (Select All That Apply)                            │
│ ☑ PDF Invoices        ☑ WhatsApp Receipts                  │
│ ☑ B2B Contracts       ☑ White Label                        │
│ ☑ Driver App          ☑ Multi-Branch                       │
│ ☑ Advanced Analytics  ☑ API Access                         │
│ ☑ Marketplace         ☑ Loyalty Programs                   │
│                                                             │
│ Notes/Special Terms:                                        │
│ ┌─────────────────────────────────────────────────────────┐│
│ │                                                         ││
│ │                                                         ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ [Create Plan]  [Save as Template]  [Cancel]                │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Invoice Management

### 3.1 Invoice Generation

**Automated Monthly Billing Job:**

```typescript
// Scheduled job: Run on 1st of every month at 00:00
async function generateMonthlyInvoices() {
  const billingDate = new Date();
  const billingPeriodStart = startOfMonth(subMonths(billingDate, 1));
  const billingPeriodEnd = endOfMonth(subMonths(billingDate, 1));

  // Get all active subscriptions
  const activeSubscriptions = await db.org_subscriptions_mst.find({
    status: { $in: ['active', 'trial'] },
    is_active: true
  });

  for (const subscription of activeSubscriptions) {
    try {
      const invoice = await generateInvoice({
        tenant_org_id: subscription.tenant_org_id,
        subscription_id: subscription.id,
        billing_period_start: billingPeriodStart,
        billing_period_end: billingPeriodEnd,
        billing_date: billingDate
      });

      await sendInvoiceEmail(invoice);
      await attemptPaymentCollection(invoice);

      logger.info(`Invoice generated for tenant ${subscription.tenant_org_id}`, {
        invoice_id: invoice.id,
        amount: invoice.total
      });
    } catch (error) {
      logger.error(`Failed to generate invoice for ${subscription.tenant_org_id}`, error);
      await createSupportTicket({
        tenant_org_id: subscription.tenant_org_id,
        category: 'billing',
        priority: 'high',
        subject: 'Invoice generation failed',
        description: error.message
      });
    }
  }
}
```

### 3.2 Invoice Calculation Logic

**Invoice Line Items:**

```typescript
interface InvoiceLineItem {
  description: string,
  description_ar: string,
  quantity: number,
  unit_price: number,
  total: number,
  type: 'subscription' | 'overage' | 'setup_fee' | 'discount'
}

async function calculateInvoice(params: {
  tenant_org_id: string,
  subscription_id: string,
  billing_period_start: Date,
  billing_period_end: Date
}): Promise<Invoice> {
  const { tenant_org_id, subscription_id, billing_period_start, billing_period_end } = params;

  const subscription = await db.org_subscriptions_mst.findById(subscription_id);
  const plan = await db.sys_plan_subscriptions_types_cf.findOne({ plan_code: subscription.plan_code });
  const usage = await getUsageForPeriod(tenant_org_id, billing_period_start, billing_period_end);

  const lineItems: InvoiceLineItem[] = [];

  // 1. Base subscription charge
  if (subscription.status === 'active') {
    lineItems.push({
      description: `${plan.plan_name} Subscription`,
      description_ar: `اشتراك ${plan.plan_name_ar}`,
      quantity: 1,
      unit_price: plan.base_price,
      total: plan.base_price,
      type: 'subscription'
    });
  }

  // 2. Setup fee (first invoice only)
  if (subscription.first_invoice && plan.setup_fee > 0) {
    lineItems.push({
      description: 'One-time Setup Fee',
      description_ar: 'رسوم الإعداد لمرة واحدة',
      quantity: 1,
      unit_price: plan.setup_fee,
      total: plan.setup_fee,
      type: 'setup_fee'
    });
  }

  // 3. Overage charges (if applicable)
  const limits = plan.limits;
  const overagePricing = plan.overage_pricing;

  // Orders overage
  if (limits.max_orders_per_month > 0 && usage.orders_count > limits.max_orders_per_month) {
    const overage = usage.orders_count - limits.max_orders_per_month;
    if (overagePricing.per_order) {
      lineItems.push({
        description: `Additional Orders (${overage} orders)`,
        description_ar: `طلبات إضافية (${overage} طلب)`,
        quantity: overage,
        unit_price: overagePricing.per_order,
        total: overage * overagePricing.per_order,
        type: 'overage'
      });
    }
  }

  // Users overage
  if (limits.max_users > 0 && usage.active_users > limits.max_users) {
    const overage = usage.active_users - limits.max_users;
    if (overagePricing.per_user) {
      lineItems.push({
        description: `Additional Users (${overage} users)`,
        description_ar: `مستخدمون إضافيون (${overage} مستخدم)`,
        quantity: overage,
        unit_price: overagePricing.per_user,
        total: overage * overagePricing.per_user,
        type: 'overage'
      });
    }
  }

  // 4. Apply discounts
  const activeDiscounts = await getActiveDiscounts(tenant_org_id);
  for (const discount of activeDiscounts) {
    const discountAmount = calculateDiscount(lineItems, discount);
    if (discountAmount > 0) {
      lineItems.push({
        description: `Discount: ${discount.code}`,
        description_ar: `خصم: ${discount.code}`,
        quantity: 1,
        unit_price: -discountAmount,
        total: -discountAmount,
        type: 'discount'
      });
    }
  }

  // 5. Calculate totals
  const subtotal = lineItems
    .filter(item => item.type !== 'discount')
    .reduce((sum, item) => sum + item.total, 0);

  const discount_total = lineItems
    .filter(item => item.type === 'discount')
    .reduce((sum, item) => sum + Math.abs(item.total), 0);

  const tax = 0; // Tax calculation TBD (Oman VAT 5% planned)

  const total = subtotal - discount_total + tax;

  return {
    tenant_org_id,
    subscription_id,
    billing_period_start,
    billing_period_end,
    line_items: lineItems,
    subtotal,
    discount_total,
    tax,
    total,
    currency: 'OMR'
  };
}
```

### 3.3 Invoice Database Schema

```sql
CREATE TABLE sys_tenant_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id),
  subscription_id UUID REFERENCES org_subscriptions_mst(id),

  -- Invoice details
  invoice_no VARCHAR(100) NOT NULL UNIQUE,
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,

  -- Billing period
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,

  -- Plan info (snapshot at invoice time)
  plan_code VARCHAR(50) NOT NULL,
  plan_name VARCHAR(255),

  -- Line items
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Amounts
  subtotal DECIMAL(10,3) NOT NULL,
  discount_total DECIMAL(10,3) DEFAULT 0,
  tax DECIMAL(10,3) DEFAULT 0,
  total DECIMAL(10,3) NOT NULL,
  amount_paid DECIMAL(10,3) DEFAULT 0,
  amount_due DECIMAL(10,3) NOT NULL,

  -- Currency
  currency VARCHAR(3) DEFAULT 'OMR',

  -- Status
  status VARCHAR(20) DEFAULT 'pending',
  CHECK (status IN ('draft', 'pending', 'paid', 'overdue', 'cancelled', 'refunded')),

  -- Payment details
  paid_at TIMESTAMP,
  payment_method VARCHAR(50),
  payment_gateway VARCHAR(50),
  payment_gateway_ref VARCHAR(255),
  payment_gateway_fee DECIMAL(10,3),

  -- Metadata
  notes TEXT,
  internal_notes TEXT,

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_at TIMESTAMP,
  updated_by UUID,

  -- Indexes
  INDEX idx_invoice_tenant (tenant_org_id, invoice_date DESC),
  INDEX idx_invoice_status (status, due_date),
  INDEX idx_invoice_no (invoice_no),
  INDEX idx_invoice_period (billing_period_start, billing_period_end)
);

-- Invoice number sequence
CREATE SEQUENCE seq_invoice_number START WITH 1000;

-- Invoice payments (for partial payments)
CREATE TABLE sys_tenant_invoice_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES sys_tenant_invoices(id),
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id),

  -- Payment details
  payment_date DATE NOT NULL,
  amount DECIMAL(10,3) NOT NULL,
  payment_method VARCHAR(50),
  payment_gateway VARCHAR(50),
  payment_gateway_ref VARCHAR(255),
  payment_gateway_fee DECIMAL(10,3),

  -- Status
  status VARCHAR(20) DEFAULT 'pending',
  CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),

  -- Metadata
  notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,

  INDEX idx_payment_invoice (invoice_id),
  INDEX idx_payment_tenant (tenant_org_id, payment_date DESC)
);
```

### 3.4 Invoice UI

**Invoice List Page**: `/platform-admin/billing/invoices`

```
┌─────────────────────────────────────────────────────────────┐
│ Invoices                                                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Filters: [All Statuses ▼] [All Tenants ▼] [This Month ▼]  │
│ Search: [_________________] 🔍                              │
│                                                             │
│ ┌─────┬──────────┬────────────┬────────┬────────┬────────┐ │
│ │ No  │ Tenant   │ Date       │ Amount │ Status │ Action │ │
│ ├─────┼──────────┼────────────┼────────┼────────┼────────┤ │
│ │1001 │Al-Noor   │2025-01-01  │79.000  │ Paid   │ View   │ │
│ │1002 │Express   │2025-01-01  │29.000  │Overdue │ View   │ │
│ │1003 │Premium   │2025-01-01  │199.000 │Pending │ View   │ │
│ └─────┴──────────┴────────────┴────────┴────────┴────────┘ │
│                                                             │
│ Total: OMR 3,457.000 | Paid: OMR 2,105.000 | Due: OMR 1,352│
│                                                             │
│ [Generate Invoices]  [Export CSV]  [Email Reminders]       │
└─────────────────────────────────────────────────────────────┘
```

**Invoice Detail Page**: `/platform-admin/billing/invoices/:id`

```
┌─────────────────────────────────────────────────────────────┐
│ Invoice #1001                                               │
│ Status: [Paid ✓]                                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ From:                          To:                          │
│ CleanMateX Platform            Al-Noor Laundry Services     │
│ Muscat, Oman                   P.O. Box 123, Muscat         │
│                                Tax ID: 1234567890           │
│                                                             │
│ Invoice Date: January 1, 2025                               │
│ Due Date: January 15, 2025                                  │
│ Billing Period: Dec 1-31, 2024                              │
│                                                             │
│ ┌─────────────────────────┬───────┬──────────┬───────────┐ │
│ │ Description             │ Qty   │ Unit Price│ Total    │ │
│ ├─────────────────────────┼───────┼──────────┼───────────┤ │
│ │ Growth Plan Subscription│ 1     │ 79.000   │ 79.000   │ │
│ │ Additional Orders (25)  │ 25    │ 0.500    │ 12.500   │ │
│ │ Discount: LAUNCH2025    │       │          │ -10.000  │ │
│ └─────────────────────────┴───────┴──────────┴───────────┘ │
│                                                             │
│                                      Subtotal:   91.500 OMR│
│                                      Discount:  -10.000 OMR│
│                                      Tax (5%):    4.075 OMR│
│                                      ────────────────────── │
│                                      Total:      85.575 OMR│
│                                      Paid:       85.575 OMR│
│                                      Due:         0.000 OMR│
│                                                             │
│ Payment: Paid on Jan 5, 2025 via Stripe (card ****4242)    │
│                                                             │
│ [Download PDF]  [Send Email]  [Record Payment]  [Void]     │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Payment Processing

### 4.1 Payment Gateway Integration

**Supported Gateways:**

1. **Stripe** (International, primary)
2. **HyperPay** (GCC region)
3. **PayTabs** (GCC region)

**Payment Gateway Configuration:**

```typescript
interface PaymentGatewayConfig {
  gateway_code: string,          // 'stripe', 'hyperpay', 'paytabs'
  gateway_name: string,
  is_active: boolean,
  is_default: boolean,
  region: string[],              // ['GCC', 'INTL']

  // Credentials (encrypted)
  credentials: {
    api_key: string,
    secret_key: string,
    merchant_id: string,
    webhook_secret: string
  },

  // Supported payment methods
  payment_methods: string[],     // ['card', 'wallet', 'bank_transfer']

  // Fees
  transaction_fee_percentage: number,
  transaction_fee_fixed: number,

  // Limits
  min_amount: number,
  max_amount: number,

  // Settings
  auto_capture: boolean,
  retry_enabled: boolean,
  max_retries: number
}
```

### 4.2 Payment Collection Flow

```typescript
async function attemptPaymentCollection(invoice: Invoice): Promise<PaymentResult> {
  const tenant = await getTenant(invoice.tenant_org_id);
  const paymentMethod = await getDefaultPaymentMethod(tenant.id);

  if (!paymentMethod) {
    logger.warn(`No payment method for tenant ${tenant.id}`);
    await emailQueue.add('payment-method-required', {
      tenant_id: tenant.id,
      invoice_id: invoice.id
    });
    return { success: false, reason: 'no_payment_method' };
  }

  const gateway = getPaymentGateway(paymentMethod.gateway);

  try {
    const paymentIntent = await gateway.createPaymentIntent({
      amount: invoice.total,
      currency: invoice.currency,
      payment_method: paymentMethod.id,
      customer: tenant.gateway_customer_id,
      metadata: {
        invoice_id: invoice.id,
        tenant_id: tenant.id,
        invoice_no: invoice.invoice_no
      }
    });

    if (paymentIntent.status === 'succeeded') {
      await recordPayment({
        invoice_id: invoice.id,
        amount: invoice.total,
        payment_gateway: paymentMethod.gateway,
        payment_gateway_ref: paymentIntent.id,
        payment_gateway_fee: paymentIntent.fee,
        status: 'completed'
      });

      await updateInvoiceStatus(invoice.id, 'paid');

      await emailQueue.add('payment-successful', {
        tenant_id: tenant.id,
        invoice_id: invoice.id,
        amount: invoice.total
      });

      return { success: true, payment_id: paymentIntent.id };
    } else {
      // Payment requires action (3DS, etc.)
      await emailQueue.add('payment-action-required', {
        tenant_id: tenant.id,
        invoice_id: invoice.id,
        action_url: paymentIntent.next_action_url
      });

      return { success: false, reason: 'action_required', action_url: paymentIntent.next_action_url };
    }
  } catch (error) {
    logger.error(`Payment failed for invoice ${invoice.id}`, error);

    await recordPayment({
      invoice_id: invoice.id,
      amount: invoice.total,
      payment_gateway: paymentMethod.gateway,
      status: 'failed',
      notes: error.message
    });

    // Start dunning process
    await startDunningProcess(invoice.id);

    return { success: false, reason: 'payment_failed', error: error.message };
  }
}
```

### 4.3 Payment Methods Management

```sql
CREATE TABLE sys_tenant_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id),

  -- Payment gateway
  gateway VARCHAR(50) NOT NULL,
  gateway_customer_id VARCHAR(255),
  gateway_payment_method_id VARCHAR(255),

  -- Payment method details
  type VARCHAR(20) NOT NULL, -- 'card', 'bank', 'wallet'

  -- Card details (encrypted/tokenized)
  card_brand VARCHAR(20),
  card_last4 VARCHAR(4),
  card_exp_month INTEGER,
  card_exp_year INTEGER,

  -- Bank details
  bank_name VARCHAR(100),
  bank_account_last4 VARCHAR(4),

  -- Status
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,

  INDEX idx_payment_method_tenant (tenant_org_id),
  INDEX idx_payment_method_default (tenant_org_id, is_default) WHERE is_default = true
);
```

---

## 5. Dunning Management

### 5.1 Dunning Process

**Dunning Workflow:**

```
Payment Failed
    ↓
Day 1: Immediate retry + Email "Payment Failed"
    ↓
Day 3: Retry + Email "Payment Reminder"
    ↓
Day 7: Retry + Email "Urgent: Payment Required"
    ↓
Day 14: Final retry + Email "Final Notice"
    ↓
Day 15: Suspend tenant + Email "Account Suspended"
    ↓
Day 45: Cancel subscription + Email "Account Cancelled"
```

### 5.2 Dunning Configuration

```typescript
interface DunningConfig {
  retry_schedule: DunningRetry[],
  suspension_days: number,       // 15 days
  cancellation_days: number      // 45 days
}

interface DunningRetry {
  day: number,                   // Days after initial failure
  action: 'retry' | 'email' | 'suspend' | 'cancel',
  email_template: string,
  priority: 'normal' | 'urgent' | 'critical'
}

const defaultDunningSchedule: DunningRetry[] = [
  { day: 0, action: 'retry', email_template: 'payment_failed', priority: 'normal' },
  { day: 3, action: 'retry', email_template: 'payment_reminder_1', priority: 'normal' },
  { day: 7, action: 'retry', email_template: 'payment_reminder_2', priority: 'urgent' },
  { day: 14, action: 'retry', email_template: 'payment_final_notice', priority: 'critical' },
  { day: 15, action: 'suspend', email_template: 'account_suspended', priority: 'critical' },
  { day: 45, action: 'cancel', email_template: 'account_cancelled', priority: 'critical' }
];
```

### 5.3 Dunning Tracking

```sql
CREATE TABLE sys_tenant_dunning (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id),
  invoice_id UUID NOT NULL REFERENCES sys_tenant_invoices(id),

  -- Dunning status
  status VARCHAR(20) DEFAULT 'active',
  CHECK (status IN ('active', 'resolved', 'suspended', 'cancelled')),

  -- Failure details
  first_failure_date DATE NOT NULL,
  last_retry_date DATE,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 4,

  -- Actions taken
  emails_sent INTEGER DEFAULT 0,
  calls_made INTEGER DEFAULT 0,

  -- Resolution
  resolved_at TIMESTAMP,
  resolution_method VARCHAR(50), -- 'payment_successful', 'manual_payment', 'plan_change', 'cancelled'

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,

  INDEX idx_dunning_tenant (tenant_org_id),
  INDEX idx_dunning_status (status, first_failure_date)
);
```

---

## 6. Usage Tracking & Metering

### 6.1 Billable Metrics

**Tracked Usage Metrics:**

```typescript
interface UsageMetrics {
  tenant_org_id: string,
  billing_period_start: Date,
  billing_period_end: Date,

  // Order metrics
  orders_count: number,
  orders_completed: number,
  orders_cancelled: number,
  revenue: number,

  // User metrics
  active_users: number,
  total_users: number,

  // Storage metrics
  storage_mb_used: number,

  // API metrics (future)
  api_calls: number,

  // Branch metrics
  branches_count: number
}
```

### 6.2 Usage Collection

**Daily Usage Aggregation Job:**

```typescript
// Scheduled job: Run daily at 23:59
async function aggregateUsageMetrics() {
  const today = new Date();
  const tenants = await getAllActiveTenants();

  for (const tenant of tenants) {
    const metrics = await calculateDailyUsage(tenant.id, today);

    await db.sys_tenant_metrics_daily.upsert({
      tenant_org_id: tenant.id,
      metric_date: today,
      ...metrics
    });
  }
}

async function calculateDailyUsage(tenantId: string, date: Date): Promise<UsageMetrics> {
  const startOfDay = new Date(date.setHours(0, 0, 0, 0));
  const endOfDay = new Date(date.setHours(23, 59, 59, 999));

  const [orders, users, storage, branches] = await Promise.all([
    db.org_orders_mst.count({
      tenant_org_id: tenantId,
      created_at: { $gte: startOfDay, $lte: endOfDay }
    }),
    db.org_users_mst.count({
      tenant_org_id: tenantId,
      is_active: true,
      last_login_at: { $gte: subDays(date, 30) } // Active in last 30 days
    }),
    calculateStorageUsage(tenantId),
    db.org_branches_mst.count({
      tenant_org_id: tenantId,
      is_active: true
    })
  ]);

  return {
    tenant_org_id: tenantId,
    metric_date: date,
    orders_count: orders,
    active_users: users,
    storage_mb_used: storage,
    branches_count: branches
  };
}
```

### 6.3 Usage Alerts

**Alert Thresholds:**

```typescript
interface UsageAlert {
  metric: 'orders' | 'users' | 'storage' | 'api_calls',
  threshold_percentage: number,  // 80%, 90%, 100%
  current_usage: number,
  limit: number,
  alert_level: 'warning' | 'critical'
}

async function checkUsageAlerts(tenantId: string) {
  const subscription = await getCurrentSubscription(tenantId);
  const plan = await getPlan(subscription.plan_code);
  const usage = await getCurrentMonthUsage(tenantId);

  const alerts: UsageAlert[] = [];

  // Check orders
  if (plan.limits.max_orders_per_month > 0) {
    const percentage = (usage.orders_count / plan.limits.max_orders_per_month) * 100;
    if (percentage >= 80) {
      alerts.push({
        metric: 'orders',
        threshold_percentage: percentage,
        current_usage: usage.orders_count,
        limit: plan.limits.max_orders_per_month,
        alert_level: percentage >= 100 ? 'critical' : 'warning'
      });
    }
  }

  // Check users, storage, etc. (similar logic)

  if (alerts.length > 0) {
    await notifyTenantOfUsageAlerts(tenantId, alerts);
  }

  return alerts;
}
```

---

## 7. Revenue Management

### 7.1 Revenue Metrics

**Key Revenue Metrics:**

```typescript
interface RevenueMetrics {
  // Recurring Revenue
  mrr: number,                    // Monthly Recurring Revenue
  arr: number,                    // Annual Recurring Revenue

  // Growth
  mrr_growth: number,             // MRR growth %
  new_mrr: number,                // MRR from new customers
  expansion_mrr: number,          // MRR from upgrades
  contraction_mrr: number,        // MRR lost from downgrades
  churned_mrr: number,            // MRR lost from churn

  // Customer metrics
  total_customers: number,
  paying_customers: number,
  trial_customers: number,

  // Average Revenue
  arpu: number,                   // Average Revenue Per User
  arpc: number,                   // Average Revenue Per Customer

  // Lifetime Value
  ltv: number,                    // Customer Lifetime Value
  cac: number,                    // Customer Acquisition Cost
  ltv_cac_ratio: number          // LTV/CAC ratio (target: >3)
}
```

### 7.2 MRR Calculation

```typescript
async function calculateMRR(): Promise<number> {
  const activeSubscriptions = await db.org_subscriptions_mst.find({
    status: 'active',
    is_active: true
  });

  let totalMRR = 0;

  for (const subscription of activeSubscriptions) {
    const plan = await getPlan(subscription.plan_code);

    if (subscription.billing_cycle === 'monthly') {
      totalMRR += plan.base_price;
    } else if (subscription.billing_cycle === 'annual') {
      totalMRR += plan.annual_price / 12;
    }
  }

  return totalMRR;
}

async function calculateARR(): Promise<number> {
  const mrr = await calculateMRR();
  return mrr * 12;
}
```

### 7.3 Revenue Analytics Dashboard

**URL**: `/platform-admin/billing/revenue`

```
┌─────────────────────────────────────────────────────────────┐
│ Revenue Analytics                                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌──────────────┬──────────────┬──────────────┬───────────┐ │
│ │ MRR          │ ARR          │ Growth       │ Customers │ │
│ ├──────────────┼──────────────┼──────────────┼───────────┤ │
│ │ OMR 12,450   │ OMR 149,400  │ +15.2%       │ 156       │ │
│ │ ↑ +1,650     │ ↑ +19,800    │ This month   │ +12 new   │ │
│ └──────────────┴──────────────┴──────────────┴───────────┘ │
│                                                             │
│ MRR Breakdown                                               │
│ ┌─────────────────────────────────────────────────────────┐│
│ │     15,000│                                    ⬆         ││
│ │     12,500│                          ⬆       ⬆           ││
│ │     10,000│                ⬆       ⬆                     ││
│ │      7,500│      ⬆       ⬆                               ││
│ │      5,000│    ⬆                                         ││
│ │      2,500│  ⬆                                           ││
│ │          0├─────┬─────┬─────┬─────┬─────┬─────┬────────││
│ │           Aug  Sep  Oct  Nov  Dec  Jan  Feb             ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ MRR Movement (January)                                      │
│ Starting MRR:        OMR 10,800                             │
│ + New Customers:     OMR  2,100                             │
│ + Expansions:        OMR    750                             │
│ - Contractions:      OMR    200                             │
│ - Churn:             OMR  1,000                             │
│ ────────────────────────────────                            │
│ Ending MRR:          OMR 12,450                             │
│                                                             │
│ [View Details] [Export Report] [Forecast]                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Discounts & Promotions

### 8.1 Discount Codes

**Discount Code Structure:**

```typescript
interface DiscountCode {
  code: string,                  // 'LAUNCH2025', 'SAVE20'
  description: string,

  // Discount type
  type: 'percentage' | 'fixed_amount' | 'free_months',
  value: number,                 // 20 (for 20%), 10.000 (for OMR 10), 2 (for 2 months free)

  // Applicability
  applies_to: 'all_plans' | 'specific_plans' | 'first_invoice' | 'recurring',
  plan_codes: string[],          // If specific_plans
  max_redemptions: number,       // -1 for unlimited
  max_per_customer: number,      // Usually 1

  // Duration
  valid_from: Date,
  valid_until: Date,
  duration_months: number | null, // How many months discount applies

  // Status
  is_active: boolean,
  times_redeemed: number,

  created_at: Date,
  created_by: string
}
```

### 8.2 Discount Application

```typescript
async function applyDiscount(tenantId: string, code: string): Promise<DiscountApplication> {
  const discount = await db.sys_discount_codes.findOne({ code, is_active: true });

  if (!discount) {
    throw new Error('Invalid or expired discount code');
  }

  // Validate expiration
  if (discount.valid_until && new Date() > discount.valid_until) {
    throw new Error('Discount code has expired');
  }

  // Validate max redemptions
  if (discount.max_redemptions > 0 && discount.times_redeemed >= discount.max_redemptions) {
    throw new Error('Discount code has been fully redeemed');
  }

  // Check customer usage
  const customerUsage = await db.sys_discount_redemptions.count({
    tenant_org_id: tenantId,
    discount_code: code
  });

  if (customerUsage >= discount.max_per_customer) {
    throw new Error('You have already used this discount code');
  }

  // Apply discount to subscription
  await db.org_subscriptions_mst.update(
    { tenant_org_id: tenantId },
    {
      discount_code: code,
      discount_value: discount.value,
      discount_type: discount.type,
      discount_duration_months: discount.duration_months,
      discount_applied_at: new Date()
    }
  );

  // Record redemption
  await db.sys_discount_redemptions.insert({
    tenant_org_id: tenantId,
    discount_code: code,
    redeemed_at: new Date()
  });

  // Increment redemption count
  await db.sys_discount_codes.increment({ code }, 'times_redeemed', 1);

  return { success: true, discount };
}
```

---

## 9. Plan Upgrades & Downgrades

### 9.1 Plan Change Logic

```typescript
async function changePlan(tenantId: string, newPlanCode: string): Promise<PlanChangeResult> {
  const subscription = await getCurrentSubscription(tenantId);
  const currentPlan = await getPlan(subscription.plan_code);
  const newPlan = await getPlan(newPlanCode);

  const isUpgrade = newPlan.base_price > currentPlan.base_price;
  const isDowngrade = newPlan.base_price < currentPlan.base_price;

  if (isUpgrade) {
    return await handleUpgrade(tenantId, subscription, currentPlan, newPlan);
  } else if (isDowngrade) {
    return await handleDowngrade(tenantId, subscription, currentPlan, newPlan);
  } else {
    throw new Error('Cannot change to the same plan');
  }
}

async function handleUpgrade(
  tenantId: string,
  subscription: Subscription,
  currentPlan: Plan,
  newPlan: Plan
): Promise<PlanChangeResult> {
  // Calculate prorated charge
  const daysRemaining = differenceInDays(subscription.current_period_end, new Date());
  const daysInPeriod = differenceInDays(subscription.current_period_end, subscription.current_period_start);
  const unusedAmount = (currentPlan.base_price / daysInPeriod) * daysRemaining;
  const newAmount = (newPlan.base_price / daysInPeriod) * daysRemaining;
  const prorationAmount = newAmount - unusedAmount;

  // Immediate charge for proration
  const prorationInvoice = await createProrationInvoice({
    tenant_org_id: tenantId,
    description: `Upgrade to ${newPlan.plan_name}`,
    amount: prorationAmount,
    due_immediately: true
  });

  const payment = await attemptPaymentCollection(prorationInvoice);

  if (payment.success) {
    // Update subscription
    await db.org_subscriptions_mst.update(
      { tenant_org_id: tenantId },
      {
        plan_code: newPlan.plan_code,
        plan_name: newPlan.plan_name,
        base_price: newPlan.base_price,
        plan_changed_at: new Date(),
        previous_plan_code: currentPlan.plan_code
      }
    );

    // Update feature flags
    await updateTenantFeatures(tenantId, newPlan.features);

    // Log plan change
    await logPlanChange({
      tenant_org_id: tenantId,
      from_plan: currentPlan.plan_code,
      to_plan: newPlan.plan_code,
      change_type: 'upgrade',
      proration_amount: prorationAmount
    });

    return { success: true, proration_invoice: prorationInvoice };
  } else {
    throw new Error('Payment failed for plan upgrade');
  }
}

async function handleDowngrade(
  tenantId: string,
  subscription: Subscription,
  currentPlan: Plan,
  newPlan: Plan
): Promise<PlanChangeResult> {
  // Downgrade takes effect at end of current billing period
  await db.org_subscriptions_mst.update(
    { tenant_org_id: tenantId },
    {
      scheduled_plan_code: newPlan.plan_code,
      scheduled_plan_change_date: subscription.current_period_end,
      plan_change_scheduled_at: new Date()
    }
  );

  // Notify tenant
  await emailQueue.add('plan-downgrade-scheduled', {
    tenant_id: tenantId,
    current_plan: currentPlan.plan_name,
    new_plan: newPlan.plan_name,
    effective_date: subscription.current_period_end
  });

  return {
    success: true,
    message: `Plan downgrade scheduled for ${subscription.current_period_end}`,
    effective_date: subscription.current_period_end
  };
}
```

---

## 10. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Invoice Generation Success Rate | > 99% | % of invoices generated without errors |
| Payment Collection Rate | > 95% | % of invoices paid on first attempt |
| Dunning Recovery Rate | > 40% | % of failed payments recovered |
| Revenue Recognition Accuracy | 100% | Manual audit vs automated |
| Billing Query Resolution Time | < 24 hours | Average time to resolve billing support tickets |
| Payment Processing Time | < 5 seconds | p95 payment processing duration |

---

## 11. Implementation Plan

### Phase 1: Foundation (Week 1-2)
- ✅ Create billing database schema
- ✅ Build plan management UI
- ✅ Implement invoice generation logic
- ✅ Setup invoice number sequencing

### Phase 2: Payment Processing (Week 3-4)
- ✅ Integrate Stripe payment gateway
- ✅ Build payment collection flow
- ✅ Implement webhook handlers
- ✅ Payment method management

### Phase 3: Dunning & Recovery (Week 5)
- ✅ Dunning process automation
- ✅ Retry logic implementation
- ✅ Email notification system
- ✅ Suspension workflows

### Phase 4: Usage & Metering (Week 6)
- ✅ Usage tracking implementation
- ✅ Daily aggregation jobs
- ✅ Overage calculation
- ✅ Usage alerts

### Phase 5: Revenue Analytics (Week 7)
- ✅ MRR/ARR calculations
- ✅ Revenue dashboard
- ✅ Financial reporting

### Phase 6: Advanced Features (Week 8)
- ✅ Discount codes system
- ✅ Plan upgrades/downgrades
- ✅ Proration logic
- ✅ HyperPay/PayTabs integration

---

## 12. Related PRDs

- [PRD-SAAS-MNG-0001: Platform HQ Console (Master)](PRD-SAAS-MNG-0001_Platform_HQ_Console.md)
- [PRD-SAAS-MNG-0002: Tenant Lifecycle Management](PRD-SAAS-MNG-0002_Tenant_Lifecycle.md)
- [PRD-SAAS-MNG-0004: Analytics & Reporting](PRD-SAAS-MNG-0004_Analytics_Reporting.md)
- [PRD-SAAS-MNG-0011: Automation & Workers](PRD-SAAS-MNG-0011_Automation_Workers.md)

---

**End of PRD-SAAS-MNG-0003**
