# Unification Audit: Order, Payment, and Audit Types

**Document Status**: ✅ **COMPLETED** (Updated: 2026-02-19)

This document tracks the unification of payment, order, and audit-related types across the CleanMateX codebase to establish single sources of truth and prevent duplication.

---

## ✅ Completed Unifications

### 1. Payment Domain Types (Single Source: `lib/constants/payment.ts`)

All payment-related constants and types have been successfully unified with `lib/constants/payment.ts` as the single source of truth.

#### Payment Methods & Kinds

| Item | Source | Re-exported from |
|------|--------|------------------|
| `PAYMENT_KINDS` | `constants/payment.ts` | `order-types.ts`, `types/payment.ts` |
| `PAYMENT_METHODS` | `constants/payment.ts` | `order-types.ts`, `types/payment.ts` |
| `PaymentMethodCode` | `constants/payment.ts` | `order-types.ts`, `types/payment.ts` |
| `PaymentKind` | `constants/payment.ts` | `order-types.ts`, `types/payment.ts` |
| `getPaymentTypeFromMethod()` | `constants/payment.ts` | `order-types.ts`, `types/payment.ts` |

**Implementation Details:**

```typescript
// lib/constants/payment.ts (Source of Truth)
export const PAYMENT_KINDS = {
  NORMAL: 'normal',
  INVOICE: 'invoice',
  DEPOSIT: 'deposit',
  ADVANCE: 'advance',
  POS: 'pos',
} as const;

export const PAYMENT_METHODS = {
  CASH: 'CASH',
  CARD: 'CARD',
  CHECK: 'CHECK',
  INVOICE: 'INVOICE',
  PAY_ON_COLLECTION: 'PAY_ON_COLLECTION',
  BANK_TRANSFER: 'BANK_TRANSFER',
  MOBILE_PAYMENT: 'MOBILE_PAYMENT',
  GIFT_CARD: 'GIFT_CARD',
  PROMO_CODE: 'PROMO_CODE',
  HYPERPAY: 'HYPERPAY',
  PAYTABS: 'PAYTABS',
  STRIPE: 'STRIPE',
} as const;

export type PaymentMethodCode = typeof PAYMENT_METHODS[keyof typeof PAYMENT_METHODS];
export type PaymentKind = typeof PAYMENT_KINDS[keyof typeof PAYMENT_KINDS];

// Re-exported from:
// - lib/constants/order-types.ts
// - lib/types/payment.ts
```

#### Payment Type IDs

| Item | Source | Re-exported from | Status |
|------|--------|------------------|--------|
| `PAYMENT_TYPE_IDS` | `constants/payment.ts` | `types/payment.ts` | ✅ Done |
| `PaymentTypeId` | `constants/payment.ts` | `types/payment.ts` | ✅ Done |

**Implementation Details:**

```typescript
// lib/constants/payment.ts (Source of Truth)
export const PAYMENT_TYPE_IDS = {
  PAY_IN_ADVANCE: 'PAY_IN_ADVANCE',
  PAY_ON_COLLECTION: 'PAY_ON_COLLECTION',
  PAY_ON_DELIVERY: 'PAY_ON_DELIVERY',
  CREDIT_INVOICE: 'CREDIT_INVOICE',
} as const;

export type PaymentTypeId = typeof PAYMENT_TYPE_IDS[keyof typeof PAYMENT_TYPE_IDS];

// Used in getPaymentTypeFromMethod() return type
export function getPaymentTypeFromMethod(method: string): PaymentTypeId | undefined {
  // ... implementation
}
```

#### Invoice Status

| Item | Source | Re-exported from | Status |
|------|--------|------------------|--------|
| `INVOICE_STATUSES` | `constants/payment.ts` | `types/payment.ts` | ✅ Done |
| `InvoiceStatus` | `constants/payment.ts` | `types/payment.ts` | ✅ Done |

**Implementation Details:**

```typescript
// lib/constants/payment.ts (Source of Truth)
export const INVOICE_STATUSES = {
  DRAFT: 'draft',
  PENDING: 'pending',
  PARTIAL: 'partial',
  PAID: 'paid',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
} as const;

export type InvoiceStatus = typeof INVOICE_STATUSES[keyof typeof INVOICE_STATUSES];
```

#### Payment Transaction Status

| Item | Source | Re-exported from | Status |
|------|--------|------------------|--------|
| `PAYMENT_STATUSES` | `constants/payment.ts` | `types/payment.ts` | ✅ Done |
| `PaymentStatus` | `constants/payment.ts` | `types/payment.ts` | ✅ Done |

**Implementation Details:**

```typescript
// lib/constants/payment.ts (Source of Truth)
export const PAYMENT_STATUSES = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
  PARTIALLY_REFUNDED: 'partially_refunded',
} as const;

export type PaymentStatus = typeof PAYMENT_STATUSES[keyof typeof PAYMENT_STATUSES];
```

**Note:** This is distinct from order-level `payment_status` in `types/order.ts` (pending, partial, paid, refunded, failed). The naming makes it clear that `PAYMENT_STATUSES` refers to transaction lifecycle, not order payment status.

#### Payment Gateway

| Item | Source | Re-exported from | Status |
|------|--------|------------------|--------|
| `PAYMENT_GATEWAYS` | `constants/payment.ts` | `types/payment.ts` | ✅ Done |
| `PaymentGateway` | `constants/payment.ts` | `types/payment.ts` | ✅ Done |

**Implementation Details:**

```typescript
// lib/constants/payment.ts (Source of Truth)
export const PAYMENT_GATEWAYS = {
  HYPERPAY: 'hyperpay',
  PAYTABS: 'paytabs',
  STRIPE: 'stripe',
  MANUAL: 'manual',
} as const;

export type PaymentGateway = typeof PAYMENT_GATEWAYS[keyof typeof PAYMENT_GATEWAYS] | null;
```

---

### 2. Order Status Types (Single Source: `lib/types/workflow.ts`)

Order workflow status types have been clarified with `lib/types/workflow.ts` as the authoritative source for all workflow-related statuses.

#### Workflow OrderStatus (Canonical)

| Item | Source | Usage | Status |
|------|--------|-------|--------|
| `OrderStatus` type | `lib/types/workflow.ts` | Workflow service, API routes, UI components | ✅ Canonical |
| `ORDER_STATUSES` array | `lib/types/workflow.ts` | All workflow operations | ✅ Canonical |
| `STATUS_META` | `lib/types/workflow.ts` | UI rendering, labels, colors | ✅ Canonical |

**Implementation Details:**

```typescript
// lib/types/workflow.ts (Source of Truth for Workflow)
export type OrderStatus =
  | 'draft'
  | 'intake'
  | 'preparation'
  | 'processing'
  | 'sorting'
  | 'washing'
  | 'drying'
  | 'finishing'
  | 'assembly'
  | 'qa'
  | 'packing'
  | 'ready'
  | 'out_for_delivery'
  | 'delivered'
  | 'closed'
  | 'cancelled';

export const ORDER_STATUSES: OrderStatus[] = [
  'draft', 'intake', 'preparation', 'processing', 'sorting',
  'washing', 'drying', 'finishing', 'assembly', 'qa',
  'packing', 'ready', 'out_for_delivery', 'delivered',
  'closed', 'cancelled'
];

export const STATUS_META: Record<OrderStatus, {
  label: string;
  labelAr: string;
  color: string;
  icon: string;
  description: string;
}> = { /* ... */ };
```

**Used by:**
- `lib/services/workflow-service.ts`
- `app/api/orders/[id]/status/route.ts`
- All workflow-related UI components
- `lib/validations/workflow-schema.ts` (Zod schema)

#### Simplified OrderStatus (UI/Filters Only)

| Item | Source | Usage | Status |
|------|--------|-------|--------|
| `ORDER_STATUSES` | `lib/constants/order-types.ts` | Simplified UI filters (optional) | ⚠️ Documented |
| `OrderStatus` type | `lib/constants/order-types.ts` | Simplified set (NOT for workflow) | ⚠️ Documented |

**Implementation Details:**

```typescript
// lib/constants/order-types.ts (Simplified Set - NOT for Workflow)
/**
 * Order Status Types (simplified set for UI/filters).
 * For workflow transitions and full lifecycle, use lib/types/workflow.ts
 * (OrderStatus, ORDER_STATUSES) as source of truth.
 */
export const ORDER_STATUSES = {
  DRAFT: 'draft',
  PENDING: 'pending',
  PREPARING: 'preparing',
  INTAKE: 'intake',
  PROCESSING: 'processing',
  READY: 'ready',
  DELIVERED: 'delivered',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export type OrderStatus = typeof ORDER_STATUSES[keyof typeof ORDER_STATUSES];
```

**Status:** ⚠️ **Grandfathered** - This simplified set is documented but NOT imported anywhere in the codebase. It exists for potential future use in simplified UI filters. The comment clearly states that `lib/types/workflow.ts` is the source of truth for workflow operations.

**Note:** There is a naming collision between:
- `OrderStatus` in `lib/types/workflow.ts` (16 states: draft → closed)
- `OrderStatus` in `lib/constants/order-types.ts` (9 states: draft → completed)

**Resolution:** Always import from `lib/types/workflow.ts` for any workflow-related operations. The `order-types.ts` version is preserved for potential future use but is clearly documented as NOT for workflow operations.

#### Special Status: Retail Terminal

| Item | Source | Usage | Status |
|------|--------|-------|--------|
| `RETAIL_TERMINAL_STATUS` | `lib/constants/order-types.ts` | POS retail-only orders | ✅ Done |

**Implementation Details:**

```typescript
// lib/constants/order-types.ts
/** Status for retail-only orders at creation (skip workflow, POS completed) */
export const RETAIL_TERMINAL_STATUS = 'closed' as const;
```

This constant is used for POS terminal orders that bypass the normal workflow and are immediately marked as `closed`.

---

### 3. Audit Field Types (Standardized)

All database tables follow the standardized audit field pattern defined in database conventions.

#### Standard Audit Fields

| Field | Type | Purpose | Required |
|-------|------|---------|----------|
| `created_at` | `TIMESTAMP` | Record creation timestamp | ✅ Always |
| `created_by` | `VARCHAR(120)` | User who created record | ✅ Always |
| `created_info` | `TEXT` | Additional creation metadata | ⚠️ Optional |
| `updated_at` | `TIMESTAMP` | Last update timestamp | ✅ Always |
| `updated_by` | `VARCHAR(120)` | User who last updated | ✅ Always |
| `updated_info` | `TEXT` | Additional update metadata | ⚠️ Optional |
| `rec_status` | `SMALLINT` | Record status (0=deleted) | ✅ Always |
| `rec_order` | `INTEGER` | Display/sort order | ⚠️ Optional |
| `rec_notes` | `VARCHAR(200)` | Record notes | ⚠️ Optional |
| `is_active` | `BOOLEAN` | Active flag | ✅ Always |

**Reference:** See `.claude/docs/database_conventions.md` for complete audit field specifications.

---

## 📋 Usage Guidelines

### For Developers

#### Payment Types

```typescript
// ✅ Correct: Import from constants (single source)
import {
  PAYMENT_METHODS,
  PAYMENT_KINDS,
  PAYMENT_TYPE_IDS,
  INVOICE_STATUSES,
  PAYMENT_STATUSES,
  PAYMENT_GATEWAYS,
  type PaymentMethodCode,
  type PaymentKind,
  type PaymentTypeId,
  type InvoiceStatus,
  type PaymentStatus,
  type PaymentGateway,
} from '@/lib/constants/payment';

// ✅ Also correct: Import from types (re-exported for convenience)
import {
  type PaymentMethodCode,
  PAYMENT_METHODS,
} from '@/lib/types/payment';

// ❌ Wrong: Don't define payment constants inline
const paymentMethod = 'CASH'; // Should use PAYMENT_METHODS.CASH
```

#### Order Status

```typescript
// ✅ Correct: Import from workflow.ts for workflow operations
import {
  type OrderStatus,
  ORDER_STATUSES,
  STATUS_META,
} from '@/lib/types/workflow';

// ❌ Wrong: Don't import from order-types.ts for workflow
import { OrderStatus } from '@/lib/constants/order-types'; // Simplified set only!

// ✅ Correct: Use workflow utilities
import {
  getStatusIndex,
  isStatusBefore,
  getNextStatus,
  getAllowedTransitions,
} from '@/lib/types/workflow';
```

#### Audit Fields

```typescript
// ✅ Correct: Use standardized audit field names
interface MyEntity {
  id: string;
  // ... business fields ...

  // Standard audit fields
  created_at: string;
  created_by: string;
  created_info?: string;
  updated_at?: string;
  updated_by?: string;
  updated_info?: string;
  rec_status: number;
  rec_order?: number;
  rec_notes?: string;
  is_active: boolean;
}

// ❌ Wrong: Don't use non-standard audit field names
interface BadEntity {
  createdDate: string;    // Should be created_at
  createdUser: string;    // Should be created_by
  active: boolean;        // Should be is_active
}
```

---

## 🔄 Migration Status

### Completed Migrations

- ✅ Payment methods and kinds unified in `lib/constants/payment.ts`
- ✅ Payment type IDs unified in `lib/constants/payment.ts`
- ✅ Invoice statuses unified in `lib/constants/payment.ts`
- ✅ Payment transaction statuses unified in `lib/constants/payment.ts`
- ✅ Payment gateways unified in `lib/constants/payment.ts`
- ✅ Order workflow status documented with `lib/types/workflow.ts` as source of truth
- ✅ All payment types re-exported from `lib/types/payment.ts` for convenience
- ✅ Audit field patterns standardized in database conventions

### No Further Action Required

- ℹ️ Simplified `ORDER_STATUSES` in `lib/constants/order-types.ts` is documented as NOT for workflow use
- ℹ️ All files properly re-export from single sources of truth
- ℹ️ Comments and documentation clearly indicate authoritative sources

---

## 📚 Related Documentation

- **Database Conventions**: `.claude/docs/database_conventions.md`
- **Payment Types Implementation**: `lib/constants/payment.ts`
- **Payment Types Interface**: `lib/types/payment.ts`
- **Workflow Types**: `lib/types/workflow.ts`
- **Order Types**: `lib/constants/order-types.ts`

---

## ✅ Summary Table

| Category | Source of Truth | Status | Re-exported From |
|----------|----------------|--------|------------------|
| **Payment Methods** | `lib/constants/payment.ts` | ✅ Complete | `order-types.ts`, `types/payment.ts` |
| **Payment Kinds** | `lib/constants/payment.ts` | ✅ Complete | `order-types.ts`, `types/payment.ts` |
| **Payment Type IDs** | `lib/constants/payment.ts` | ✅ Complete | `types/payment.ts` |
| **Invoice Status** | `lib/constants/payment.ts` | ✅ Complete | `types/payment.ts` |
| **Payment Status** | `lib/constants/payment.ts` | ✅ Complete | `types/payment.ts` |
| **Payment Gateway** | `lib/constants/payment.ts` | ✅ Complete | `types/payment.ts` |
| **Order Workflow Status** | `lib/types/workflow.ts` | ✅ Canonical | Used everywhere |
| **Simplified Order Status** | `lib/constants/order-types.ts` | ⚠️ Documented | Not imported (future use) |
| **Retail Terminal Status** | `lib/constants/order-types.ts` | ✅ Complete | Used for POS orders |
| **Audit Fields** | Database conventions | ✅ Standardized | All tables |

**Legend:**
- ✅ Complete: Fully implemented and documented
- ⚠️ Documented: Exists but marked as secondary/future use
- ℹ️ Info: Additional notes or context

---

**Last Updated:** 2026-02-19
**Document Version:** 2.0
**Status:** ✅ All unifications completed and documented
