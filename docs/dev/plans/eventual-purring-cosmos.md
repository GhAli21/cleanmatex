# Plan: Order Discount Audit Trail (`org_ord_discounts_dtl`)

## Context
The `org_orders_mst` table stores a single flat `discount` amount with no record of which
source produced it (discount rule, promo code, gift card, or manual override). The
`org_discount_rules_cf` table already exists but is never linked back to any order.
This means accountants cannot audit, explain, or report on any order's discount composition.

**Goal:** Add `org_ord_discounts_dtl` — one row per discount line per order (multiple lines
of the same source_type are allowed: two stacking rules, two manual overrides, etc.) — and
wire it into all creation/payment flows, plus a per-source UI breakdown in the order detail page.

---

## Critical Files

| Role | Path |
|------|------|
| Migration | `supabase/migrations/0254_ord_discount_audit.sql` |
| Prisma schema | `web-admin/prisma/schema.prisma` |
| New constant | `web-admin/lib/constants/discount-source-type.ts` |
| New DB module | `web-admin/lib/db/order-discounts.ts` |
| Calculation service (extend) | `web-admin/lib/services/order-calculation.service.ts` |
| Create-with-payment route (extend) | `web-admin/app/api/v1/orders/create-with-payment/route.ts` |
| Payment service (extend) | `web-admin/lib/services/payment-service.ts` |
| Order detail page (extend) | `web-admin/app/dashboard/orders/[id]/page.tsx` |
| New UI component | `web-admin/src/features/orders/ui/order-discount-breakdown.tsx` |
| Order detail client (extend) | `web-admin/app/dashboard/orders/[id]/order-detail-client.tsx` |
| i18n EN | `web-admin/messages/en.json` |
| i18n AR | `web-admin/messages/ar.json` |

---

## Phase 1 — Migration `0254_ord_discount_audit.sql`

Table name: `org_ord_discounts_dtl` (21 chars ✓)

```sql
BEGIN;

CREATE TABLE IF NOT EXISTS public.org_ord_discounts_dtl (
  id              UUID        NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id   UUID        NOT NULL,
  order_id        UUID        NOT NULL,
  applied_seq     SMALLINT    NOT NULL,          -- insertion order within this order (1, 2, 3…)
  source_type     VARCHAR(20) NOT NULL,          -- MANUAL|DISCOUNT_RULE|PROMO_CODE|GIFT_CARD
  source_id       UUID,                          -- null for MANUAL
  source_name     VARCHAR(255),                  -- denormalized EN (survives source deletion)
  source_name2    VARCHAR(255),                  -- denormalized AR
  discount_type   VARCHAR(20) NOT NULL,          -- PERCENTAGE|FIXED_AMOUNT
  discount_rate   DECIMAL(5,2),                  -- null when FIXED_AMOUNT
  discount_amount DECIMAL(19,4) NOT NULL,
  is_voided       BOOLEAN     NOT NULL DEFAULT FALSE,
  voided_at       TIMESTAMPTZ,
  voided_by       VARCHAR(120),
  rec_status      SMALLINT    DEFAULT 1,
  rec_order       INTEGER,
  rec_notes       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      VARCHAR(120),
  created_info    VARCHAR(255),
  updated_at      TIMESTAMPTZ,
  updated_by      VARCHAR(120),
  updated_info    VARCHAR(255),
  CONSTRAINT pk_org_ord_discounts_dtl PRIMARY KEY (id),
  CONSTRAINT fk_ord_disc_order
    FOREIGN KEY (order_id, tenant_org_id)
    REFERENCES public.org_orders_mst(id, tenant_org_id) ON DELETE CASCADE,
  -- No unique constraint on source_type: multiple DISCOUNT_RULE or MANUAL lines are valid
  -- (stacking rules, sequential manual overrides). Deduplication is the service layer's job.
  CONSTRAINT chk_ord_disc_source_type
    CHECK (source_type IN ('MANUAL', 'DISCOUNT_RULE', 'PROMO_CODE', 'GIFT_CARD')),
  CONSTRAINT chk_ord_disc_calc_type
    CHECK (discount_type IN ('PERCENTAGE', 'FIXED_AMOUNT')),
  CONSTRAINT chk_ord_disc_amount_pos
    CHECK (discount_amount > 0),
  CONSTRAINT chk_ord_disc_seq_pos
    CHECK (applied_seq > 0)
);

CREATE INDEX IF NOT EXISTS idx_ord_disc_tenant_order
  ON public.org_ord_discounts_dtl (tenant_org_id, order_id);
CREATE INDEX IF NOT EXISTS idx_ord_disc_tenant_source
  ON public.org_ord_discounts_dtl (tenant_org_id, source_type);
-- Composite: filters by source_type within a specific order (e.g. "all rules for order X")
CREATE INDEX IF NOT EXISTS idx_ord_disc_order_source
  ON public.org_ord_discounts_dtl (tenant_org_id, order_id, source_type);

ALTER TABLE public.org_ord_discounts_dtl ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_org_ord_discounts_dtl ON public.org_ord_discounts_dtl;
CREATE POLICY tenant_isolation_org_ord_discounts_dtl
  ON public.org_ord_discounts_dtl FOR ALL
  USING  (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

DROP POLICY IF EXISTS service_role_org_ord_discounts_dtl ON public.org_ord_discounts_dtl;
CREATE POLICY service_role_org_ord_discounts_dtl
  ON public.org_ord_discounts_dtl FOR ALL
  USING  (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

COMMENT ON TABLE public.org_ord_discounts_dtl IS
  'Audit trail of every discount line applied to an order. '
  'Multiple rows of the same source_type are valid (stacking rules, sequential manual overrides). '
  'Amounts and names denormalized — history survives rule/promo/gift-card deletion.';

COMMIT;
```

**Design decisions:**
- **No unique constraint on source_type** — multiple DISCOUNT_RULE rows are valid when rules stack (`can_stack_with_other_rules = true`); multiple MANUAL rows are valid for sequential overrides. The DB does not enforce one-per-type.
- **`applied_seq`** is the insertion order within each `insertDiscountLinesTx` call (index + 1). Used for deterministic display ordering. Secondary sort by `created_at` for lines added in separate calls.
- **Idempotency** is the route layer's responsibility (the idempotency-key middleware in create-with-payment already prevents double-execution). No upsert needed — use `createMany`.
- Composite FK `(order_id, tenant_org_id)` → `org_orders_mst(id, tenant_org_id)` — same pattern as `org_asm_tasks_mst`, enforces tenant boundary at DB level.
- RLS uses `current_tenant_id()` — matches pattern from migration 0166 (`org_order_preferences_dtl`).

---

## Phase 2 — Prisma Schema

**File:** `web-admin/prisma/schema.prisma`

Add model `org_ord_discounts_dtl` after `org_order_preferences_dtl`:

```prisma
model org_ord_discounts_dtl {
  id              String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenant_org_id   String    @db.Uuid
  order_id        String    @db.Uuid
  applied_seq     Int       @db.SmallInt
  source_type     String    @db.VarChar(20)
  source_id       String?   @db.Uuid
  source_name     String?   @db.VarChar(255)
  source_name2    String?   @db.VarChar(255)
  discount_type   String    @db.VarChar(20)
  discount_rate   Decimal?  @db.Decimal(5, 2)
  discount_amount Decimal   @db.Decimal(19, 4)
  is_voided       Boolean   @default(false)
  voided_at       DateTime? @db.Timestamptz(6)
  voided_by       String?   @db.VarChar(120)
  rec_status      Int?      @default(1) @db.SmallInt
  rec_order       Int?
  rec_notes       String?
  created_at      DateTime? @default(now()) @db.Timestamptz(6)
  created_by      String?   @db.VarChar(120)
  created_info    String?   @db.VarChar(255)
  updated_at      DateTime? @db.Timestamptz(6)
  updated_by      String?   @db.VarChar(120)
  updated_info    String?   @db.VarChar(255)

  org_orders_mst  org_orders_mst  @relation(
    fields: [order_id, tenant_org_id], references: [id, tenant_org_id],
    onDelete: Cascade, map: "fk_ord_disc_order")
  org_tenants_mst org_tenants_mst @relation(
    fields: [tenant_org_id], references: [id],
    onDelete: Cascade, map: "fk_ord_disc_tenant")

  @@index([tenant_org_id, order_id],              map: "idx_ord_disc_tenant_order")
  @@index([tenant_org_id, source_type],           map: "idx_ord_disc_tenant_source")
  @@index([tenant_org_id, order_id, source_type], map: "idx_ord_disc_order_source")
  @@schema("public")
}
```

Add back-relation in `org_orders_mst`:
```prisma
  org_ord_discounts_dtl  org_ord_discounts_dtl[]
```

Add back-relation in `org_tenants_mst`:
```prisma
  org_ord_discounts_dtl  org_ord_discounts_dtl[]
```

---

## Phase 3 — Constant File

**File to create:** `web-admin/lib/constants/discount-source-type.ts`

```typescript
export const DISCOUNT_SOURCE_TYPE = {
  MANUAL:        'MANUAL',
  DISCOUNT_RULE: 'DISCOUNT_RULE',
  PROMO_CODE:    'PROMO_CODE',
  GIFT_CARD:     'GIFT_CARD',
} as const;
export type DiscountSourceType = (typeof DISCOUNT_SOURCE_TYPE)[keyof typeof DISCOUNT_SOURCE_TYPE];

/** Display priority order for sorting mixed-type line lists in the UI */
export const DISCOUNT_SOURCE_DISPLAY_ORDER: Record<DiscountSourceType, number> = {
  MANUAL: 1, DISCOUNT_RULE: 2, PROMO_CODE: 3, GIFT_CARD: 4,
};

export const DISCOUNT_CALC_TYPE = {
  PERCENTAGE:   'PERCENTAGE',
  FIXED_AMOUNT: 'FIXED_AMOUNT',
} as const;
export type DiscountCalcType = (typeof DISCOUNT_CALC_TYPE)[keyof typeof DISCOUNT_CALC_TYPE];
```

---

## Phase 4 — DB Module

**File to create:** `web-admin/lib/db/order-discounts.ts`

Exports:

```typescript
export interface DiscountLineInput {
  sourceType: DiscountSourceType;
  sourceId?: string;
  sourceName: string;
  sourceName2?: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountRate?: number;
  discountAmount: number;
}

export interface OrderDiscountLine { /* all columns, Decimal cast to number */ }

// Insert all non-zero lines inside caller's transaction.
// applied_seq = MAX(existing seq for this order) + array_index + 1
//   → safe for multiple calls (creation + payment-time); never produces duplicate seq values.
// Idempotency is caller's responsibility (idempotency-key middleware in the route).
export async function insertDiscountLinesTx(tx, { orderId, tenantOrgId, lines, createdBy }): Promise<void>

// Void all active lines for an order.
// OUT OF SCOPE for this plan — function is created ready for the cancellation/refund flow.
// Call site: order cancellation service (future work).
export async function voidDiscountLinesTx(tx, { orderId, tenantOrgId, voidedBy }): Promise<void>

// Read all active (non-voided) lines, ordered by applied_seq ASC then created_at ASC
export async function getDiscountLinesForOrder(tenantOrgId, orderId): Promise<OrderDiscountLine[]>
```

**Key implementation details:**

- `insertDiscountLinesTx` first queries `MAX(applied_seq)` for the order within the same tx,
  then assigns `seq = maxSeq + index + 1` for each line. Uses Prisma `createMany()` — no upsert.
- Multiple rows of the same `source_type` are intentionally allowed.
- `getDiscountLinesForOrder` sorts by `applied_seq ASC, created_at ASC` to handle lines
  added in separate tx calls (creation vs payment-time).

---

## Phase 5 — Extend `order-calculation.service.ts`

**File:** `web-admin/lib/services/order-calculation.service.ts`

1. Import `DISCOUNT_SOURCE_TYPE`, `DISCOUNT_CALC_TYPE` and `DiscountLineInput`.
2. Add `discountLines: DiscountLineInput[]` to `OrderCalculationResult` interface.
3. Before the `return` statement, build `discountLines[]` from the already-computed local
   variables (`manualDiscount`, `autoRuleDiscount`/`bestRule`, `promoDiscount`, `giftCardApplied`).
4. Include `discountLines` in the returned object.

Source name derivation:
- MANUAL → hardcoded `'Manual Discount'` / `'خصم يدوي'`
- DISCOUNT_RULE → `bestRule.rule.name` / `bestRule.rule.name2` + `bestRule.rule.id`
- PROMO_CODE → `params.promoCode?.toUpperCase()` + `params.promoCodeId`
- GIFT_CARD → `'Gift Card …XXXX'` (last 4 of card number) + `resolvedGiftCardId`

---

## Phase 6 — Update `create-with-payment` Route

**File:** `web-admin/app/api/v1/orders/create-with-payment/route.ts`

Import `insertDiscountLinesTx`.

Inside the Prisma `$transaction` block, **after** the gift card `applyGiftCardTx` call and
**before** the `return { orderId, orderNo, currentStatus }`:

```typescript
if (serverTotals.discountLines.length > 0) {
  await insertDiscountLinesTx(tx, {
    orderId, tenantOrgId: tenantId,
    lines: serverTotals.discountLines, createdBy: userId,
  });
}
```

`serverTotals` is already in scope (result of `calculateOrderTotals()`).

---

## Phase 7a — Update `OrderService.createOrder()` (traditional workflow path)

**File:** `web-admin/lib/services/order-service.ts`

The POST `/api/v1/orders` route calls `OrderService.createOrder()` — a **third creation path**
that sets `discount_rate`, `discount_type`, `promo_code_id`, `promo_discount_amount`,
`gift_card_id`, `gift_card_discount_amount` from client input but does NOT call
`calculateOrderTotals()`. Discount lines must be built from these stored fields.

1. Import `insertDiscountLinesTx`, `DISCOUNT_SOURCE_TYPE`, `DISCOUNT_CALC_TYPE`.
2. After the `org_orders_mst` insert (inside the existing transaction), add a helper call:
   ```typescript
   const orderDiscountLines = buildDiscountLinesFromOrderInput({
     discountType:          input.discount_type,
     discountRate:          input.discount_rate,
     discountAmount:        input.discount,     // total manual discount
     promoCodeId:           input.promo_code_id,
     promoCode:             input.promo_code,   // pass through from request
     promoDiscountAmount:   input.promo_discount_amount,
     giftCardId:            input.gift_card_id,
     giftCardNumber:        input.gift_card_number,
     giftCardDiscountAmount: input.gift_card_discount_amount,
   });
   if (orderDiscountLines.length > 0) {
     await insertDiscountLinesTx(tx, { orderId, tenantOrgId, lines: orderDiscountLines, createdBy: userId });
   }
   ```
3. `buildDiscountLinesFromOrderInput` is a new shared helper extracted to
   `web-admin/lib/db/order-discounts.ts` (export alongside existing functions).
   It derives discount lines from the stored order fields — used by both this path and Phase 7b.

---

## Phase 7b — Update Payment Service (quick-drop orders)

**File:** `web-admin/lib/services/payment-service.ts`

Quick-drop orders receive discounts at payment time (not order creation time). The
`ProcessPaymentInput` already carries `manual_discount_amount`, `promo_code_id`,
`promo_discount_amount`, `gift_card_id`, `gift_card_applied_amount`, `discount_rate`.

1. Import `insertDiscountLinesTx`, `buildDiscountLinesFromOrderInput` from `order-discounts.ts`.
2. Add `promo_code?: string` as explicit field to `ProcessPaymentInput` (remove `(metadata as any)` anti-pattern).
3. Add private helper `buildDiscountLinesFromPaymentInput(input): DiscountLineInput[]` that
   delegates to `buildDiscountLinesFromOrderInput` (reuse Phase 7a shared helper).
4. Inside **both** the single-invoice `$transaction` block AND the FIFO multi-invoice loop,
   after each payment record is created and before the `return`, call:
   ```typescript
   if (input.order_id) {
     const lines = buildDiscountLinesFromPaymentInput(input);
     if (lines.length > 0)
       await insertDiscountLinesTx(dbTx, { orderId: input.order_id, tenantOrgId: tenantId, lines, createdBy: input.processed_by });
   }
   ```
   **Why FIFO too:** Confirmed (line 331–334 in payment-service.ts) — the FIFO path sets
   `manual_discount_amount`, `promo_discount_amount`, `gift_card_applied_amount` on each
   payment transaction. Quick-drop orders paid via FIFO never go through create-with-payment
   (Phase 6), so without this change, those orders would never get discount lines written.

   **Note on `promo_code` string:** `ProcessPaymentInput` stores the promo code string in
   `metadata` (not as a named field). Add `promo_code?: string` as an explicit optional field
   to `ProcessPaymentInput` so `buildDiscountLinesFromPaymentInput` can access it
   type-safely without `(metadata as any)`.

---

## Phase 7c — Order Cancel Service (void discount lines)

**File:** `web-admin/lib/services/order-cancel-service.ts`

The cancel flow already calls `reversePromoUsageTx()` and `refundToGiftCardTx()` in a single
transaction. Add `voidDiscountLinesTx` in the same transaction block, **after** the promo
reversal and gift card refund, **before** the transaction commits:

```typescript
import { voidDiscountLinesTx } from '@/lib/db/order-discounts';

// Inside the cancel $transaction block:
await voidDiscountLinesTx(tx, {
  orderId:      order.id,
  tenantOrgId:  tenantOrgId,
  voidedBy:     cancelledBy,
});
```

This closes the audit trail — voided lines remain in the table for accounting history but are
excluded from `getDiscountLinesForOrder()` (which filters `is_voided = false`).

---

## Phase 7d — API Report Routes (include discount lines)

**Files:**
- `web-admin/app/api/v1/orders/[id]/report/invoices-payments-rprt/route.ts`
- `web-admin/app/api/v1/orders/[id]/report/payments-rprt/route.ts`

Both report APIs return order header + related financial records. Update the handler for each:

1. Import `getDiscountLinesForOrder`.
2. Add to the parallel data fetch alongside existing queries.
3. Include `discountLines` in the JSON response body under `order.discountLines`.
4. The report-rendering React components (server-rendered) will display the breakdown.

---

## Phase 8 — Order Detail Data Fetch (`page.tsx`)

**File:** `web-admin/app/dashboard/orders/[id]/page.tsx`

1. Import `getDiscountLinesForOrder` and `OrderDiscountLine`.
2. Add to the `Promise.all` call:
   ```typescript
   getDiscountLinesForOrder(tenantId, orderId).catch(() => [] as OrderDiscountLine[])
   ```
   The `.catch(() => [])` ensures graceful degradation during migration window.
3. Pass `discountLines` to `<OrderDetailClient>` as a prop.
4. No new translation keys needed in the `translations` object passed to `<OrderDetailClient>` —
   `OrderDiscountBreakdown` calls `useTranslations('orders.detail')` directly.

---

## Phase 9 — `OrderDiscountBreakdown` Component

**File to create:** `web-admin/src/features/orders/ui/order-discount-breakdown.tsx`

```
'use client'

Props:
  lines: OrderDiscountLine[]
  isLoading?: boolean
  // No translations prop — component calls useTranslations('orders.detail') directly.
  // This avoids manual {count} string-replace; next-intl interpolation is used instead:
  //   t('discountShowAll', { count: n })
  locale: 'en' | 'ar'

Internal hooks (all confirmed exist in the codebase):
  - useRTL()          → web-admin/lib/hooks/useRTL.ts
  - useTenantCurrency() → web-admin/lib/context/tenant-currency-context.tsx
    Returns { currencyCode: string, decimalPlaces: number } — matches formatMoneyAmountWithCode signature
  - useTranslations('orders.detail') — next-intl, interpolation via t('key', { count })

Amount formatting:
  formatMoneyAmountWithCode(amount, { currencyCode, decimalPlaces, locale })
  → web-admin/lib/money/format-money.ts

Behaviour:
  - 0 lines → return null
  - isLoading → 2 skeleton rows (animate-pulse, no layout shift)
  - All lines shown — NO collapse/expand.
    Rationale: max real-world lines is ~4 (one per source type in current flow).
    Hiding 1 behind "Show 1 more" is worse UX than showing all. Remove this complexity.
  - Each row: [source-type badge] [source_name + rate label] [right: -amount in red]
  - Badge colours: MANUAL=gray-100/700, DISCOUNT_RULE=blue-100/700,
                   PROMO_CODE=green-100/700, GIFT_CARD=purple-100/700
  - RTL: flex-row-reverse when useRTL() returns true
  - source_name2 shown when locale='ar' and source_name2 is non-null
  - rate label: " (10%)" appended to name when discount_type='PERCENTAGE'
```

**i18n keys needed for this component** (subset of Phase 11 — remove `discountShowAll` and
`discountHide` since collapse is removed):
```
discountManual, discountRule, discountPromo, discountGiftCard
discountTypePercent, discountTypeFixed
```

---

## Phase 10 — Update `order-detail-client.tsx`

**File:** `web-admin/app/dashboard/orders/[id]/order-detail-client.tsx`

1. Add `discountLines: OrderDiscountLine[]` to `OrderDetailClientProps` interface.
2. Import `OrderDiscountBreakdown`. No translations prop needed — component uses `useTranslations` internally.
3. In the Payment Details section (lines 597–604), replace the flat discount row:

```tsx
{order.discount > 0 && (
  <div className="text-sm">
    <div className={`flex ${isRTL ? 'flex-row-reverse' : 'justify-between'}`}>
      <span className="text-gray-600">{t.discount}</span>
      <span className="font-medium text-red-600">-{fmtOrderMoney(order.discount)}</span>
    </div>
    {discountLines.length > 0 && (
      <OrderDiscountBreakdown
        lines={discountLines}
        locale={locale}
      />
    )}
  </div>
)}
```

4. No new translation keys are passed via the translations prop to `OrderDetailClient` —
   the breakdown component manages its own strings via `useTranslations('orders.detail')`.

---

## Phase 11 — i18n

**`web-admin/messages/en.json`** — inside `orders.detail` object (6 keys):
```json
"discountBreakdown":   "Discount Breakdown",
"discountManual":      "Manual",
"discountRule":        "Rule",
"discountPromo":       "Promo",
"discountGiftCard":    "Gift Card",
"discountTypePercent": "Percent",
"discountTypeFixed":   "Fixed"
```

**`web-admin/messages/ar.json`** — inside `orders.detail` object (6 keys):
```json
"discountBreakdown":   "تفاصيل الخصم",
"discountManual":      "يدوي",
"discountRule":        "قاعدة",
"discountPromo":       "ترويج",
"discountGiftCard":    "بطاقة هدية",
"discountTypePercent": "نسبة مئوية",
"discountTypeFixed":   "مبلغ ثابت"
```

`discountShowAll` and `discountHide` removed — collapse UX eliminated (see Phase 9).

---

## Phase 12 — Print & Receipt Components

### 12a — `order-receipt-print.tsx`
**File:** `web-admin/src/features/orders/ui/order-receipt-print.tsx`

Currently shows total/paid/balance with no discount line. A customer receiving this receipt
cannot see why their total is lower than the subtotal — a legal and UX gap.

Add a discount section between subtotal and total in the payment summary (lines 102–123):
```tsx
{order.discount > 0 && (
  <div className="flex justify-between text-sm">
    <span>{t('discount')}</span>
    <span className="text-red-600">-{fmt(order.discount)}</span>
  </div>
)}
{discountLines.map((line) => (
  <div key={line.id} className="flex justify-between text-xs text-gray-500 ps-3">
    <span>{sourceLabel(line.source_type, locale)}</span>
    <span>-{fmt(line.discount_amount)}</span>
  </div>
))}
```
- `discountLines` passed as prop from the parent that renders the receipt.
- `sourceLabel()` is a shared pure function in `order-discounts.ts` (returns EN/AR label for a source_type).
- Add i18n key `orders.print.discount` (EN: "Discount", AR: "الخصم") if not existing.

### 12b — `order-details-print.tsx`
**File:** `web-admin/src/features/orders/ui/order-details-print.tsx`

Same gap as receipt. Apply identical pattern — discount section between items and total.

### 12c — `pricing-breakdown.tsx` (new order preview)
**File:** `web-admin/src/features/orders/ui/pricing-breakdown.tsx`

This component shows the discount in the new order wizard BEFORE the order is saved.
Currently shows only the aggregate `discount` field from `calculateOrderTotals()`.

Update to consume `discountLines` from the calculation result:
- The parent (`PaymentModalEnhanced02`) already has access to the `serverTotals` object.
- Pass `serverTotals.discountLines` as a prop.
- Show source badges inline below the aggregate discount row (same `OrderDiscountBreakdown`
  component reused — pass `isLoading` during debounced preview fetch).

---

## Phase 13 — i18n Print Keys

Add to `en.json` and `ar.json` under `orders.print` (if namespace exists, add keys; if not, create it):
```json
// en.json
"orders": {
  "print": {
    "discount": "Discount",
    "discountBreakdown": "Discount Details"
  }
}
// ar.json
"orders": {
  "print": {
    "discount": "الخصم",
    "discountBreakdown": "تفاصيل الخصم"
  }
}
```

---

## Phase 14 — Build Verification

```powershell
# From web-admin/
npx prisma validate          # confirms schema + relations compile
npx prisma generate          # regenerates Prisma client with new model
npm run build                # full Next.js TS compile — catches all missing props/types
npm run check:i18n           # verifies no orphaned or missing translation keys
```

After user applies migration: optionally run `npx prisma db pull` to confirm schema sync.

---

## Phase 15 — Documentation

### 15a — Create feature doc
**File to create:** `docs/features/Discount_Audit_Trail/README.md`

Follow the pattern from `docs/features/orders/edit_order/README.md` and
`docs/features/Promotions_and_Gift_Cards/README.md`. Sections:

1. **Overview** — What this feature adds and why (accounting audit trail for order discounts)
2. **Architecture** — Data flow: `calculateOrderTotals()` → `insertDiscountLinesTx()` → `org_ord_discounts_dtl` → `getDiscountLinesForOrder()` → UI
3. **Database Schema** — `org_ord_discounts_dtl` table, columns, constraints, indexes, RLS policies
4. **Three Creation Paths** — Document all three: create-with-payment, OrderService.createOrder, payment-service (quick-drop)
5. **Cancellation** — How `voidDiscountLinesTx` closes the audit trail
6. **API** — Which routes now include `discountLines` in their response
7. **UI Components** — `OrderDiscountBreakdown` props + usage, print components
8. **Constants & Types** — `DISCOUNT_SOURCE_TYPE`, `DISCOUNT_CALC_TYPE`, `DiscountLineInput`, `OrderDiscountLine`
9. **i18n Keys** — All new keys with EN/AR values
10. **Migration** — `0254_ord_discount_audit.sql` — purpose, constraints, RLS
11. **Testing Guide** — How to verify each creation path writes lines, cancel voids them
12. **Known Limitations** — Order edit does not yet update discount lines; future work
13. **Implementation Status** checklist

### 15b — Update Promotions & Gift Cards README
**File:** `docs/features/Promotions_and_Gift_Cards/README.md`

Add a section: **"Discount Audit Trail Integration"** documenting:
- `org_ord_discounts_dtl` captures promo code and gift card lines
- `PROMO_CODE` and `GIFT_CARD` source types and what `source_id`/`source_name` contain
- How cancellation voids the audit lines alongside `reversePromoUsageTx`

### 15c — Update Cancel/Return docs
**File:** `docs/features/orders/cancel_return/cancel_return_implementation.md`

Add one paragraph: cancellation now calls `voidDiscountLinesTx` inside the cancel transaction,
marking all discount lines `is_voided = true` with timestamp and `voidedBy`.

### 15d — Update `.claude/docs/business_logic.md`
Add rule: "Every discount source applied to an order MUST produce a row in
`org_ord_discounts_dtl`. Discount lines are voided (not deleted) on cancellation."

---

## Dependency / Execution Order

```
Phase 1  (migration SQL)    — write first, user applies to DB
Phase 2  (Prisma schema)   ─┐
Phase 3  (constants)        ├─ parallel
Phase 11 (i18n detail)     ─┘
Phase 4  (DB module)        — needs 2 + 3
Phase 5  (calc service)     — needs 3 + 4
Phase 6  (create-w-pay)     — needs 4 + 5
Phase 7a (order-service)    — needs 4 + 3
Phase 7b (payment-svc)      — needs 4 + 7a helper
Phase 7c (cancel-svc)       — needs 4
Phase 7d (report routes)    — needs 4
Phase 8  (page.tsx)         — needs 4
Phase 9  (breakdown UI)     — needs 4
Phase 10 (detail client)    — needs 8 + 9
Phase 12 (print/receipt)    — needs 4 + 9 (reuses OrderDiscountBreakdown)
Phase 13 (print i18n)       — parallel with 12
Phase 14 (build)            — needs all above
Phase 15 (docs)             — parallel with 14
```

---

## No-Gaps Checklist

**Database**
- [ ] Migration 0254: composite FK, 4 CHECK constraints, 3 indexes, 2 RLS policies, table comment
- [ ] Prisma model: no `@@unique`, 3 `@@index`, 2 back-relations on `org_orders_mst` + `org_tenants_mst`

**Constants & Types**
- [ ] `DISCOUNT_SOURCE_TYPE` + `DISCOUNT_SOURCE_DISPLAY_ORDER` + `DISCOUNT_CALC_TYPE`
- [ ] `DiscountLineInput`, `OrderDiscountLine` interfaces exported

**DB Module (`order-discounts.ts`)**
- [ ] `buildDiscountLinesFromOrderInput` — shared helper, reused by all 3 creation paths
- [ ] `insertDiscountLinesTx` — createMany, seq = MAX(existing)+index+1, skips zero-amount
- [ ] `voidDiscountLinesTx` — marks `is_voided=true`, timestamp, voidedBy
- [ ] `getDiscountLinesForOrder` — non-voided only, sorted applied_seq ASC + created_at ASC
- [ ] `sourceLabel(sourceType, locale)` — pure helper for print components

**Backend — All 3 creation paths**
- [ ] `create-with-payment` route: lines from `serverTotals.discountLines` in transaction
- [ ] `OrderService.createOrder()`: lines from order input fields via `buildDiscountLinesFromOrderInput`
- [ ] `payment-service` single-invoice + FIFO: lines via `buildDiscountLinesFromPaymentInput`
- [ ] `ProcessPaymentInput`: `promo_code?: string` added (type-safe)

**Backend — Lifecycle**
- [ ] `order-cancel-service.ts`: `voidDiscountLinesTx` in cancel transaction
- [ ] Report routes `invoices-payments-rprt` + `payments-rprt`: include `discountLines` in response

**Calculation Service**
- [ ] `OrderCalculationResult.discountLines: DiscountLineInput[]` added
- [ ] `calculateOrderTotals()` builds and returns `discountLines`

**Frontend — Order Detail**
- [ ] `page.tsx`: parallel fetch with `.catch(() => [])`, prop passed
- [ ] `OrderDiscountBreakdown`: `useTranslations` internally, `useRTL`, `useTenantCurrency`,
       `formatMoneyAmountWithCode`, skeleton, source-type badges, no collapse
- [ ] `order-detail-client.tsx`: flat discount row → breakdown component

**Frontend — New Order Preview**
- [ ] `pricing-breakdown.tsx`: show `discountLines` source badges below aggregate row
- [ ] `payment-modal-enhanced-02.tsx`: pass `serverTotals.discountLines` to `PricingBreakdown`

**Frontend — Print**
- [ ] `order-receipt-print.tsx`: discount section with per-source lines
- [ ] `order-details-print.tsx`: same discount section pattern

**i18n**
- [ ] EN + AR: 7 keys under `orders.detail` (breakdown, manual, rule, promo, giftCard, percent, fixed)
- [ ] EN + AR: 2 keys under `orders.print` (discount, discountBreakdown)
- [ ] `npm run check:i18n` passes

**Build**
- [ ] `npx prisma validate` passes
- [ ] `npx prisma generate` succeeds
- [ ] `npm run build` green — zero TypeScript errors

**Documentation**
- [ ] `docs/features/Discount_Audit_Trail/README.md` created (13 sections)
- [ ] `docs/features/Promotions_and_Gift_Cards/README.md` updated (audit trail integration section)
- [ ] `docs/features/orders/cancel_return/cancel_return_implementation.md` updated
- [ ] `.claude/docs/business_logic.md` updated (audit trail rule added)
