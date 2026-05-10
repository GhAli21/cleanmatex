# Promotions

Discount mechanisms in CleanMateX: promo codes and automatic discount rules.

- **Original combined plan:** [`docs/dev/plans/promotions_and_gifts_30156abf.plan.md`](../../dev/plans/promotions_and_gifts_30156abf.plan.md)

> **Gift Cards** are a separate feature — see [`docs/features/Gift_Cards/`](../Gift_Cards/README.md).

---

## 1. Overview

CleanMateX supports two discount mechanisms that reduce the taxable base:

| Mechanism | Description | Tables |
|---|---|---|
| **Promo codes** | Operator/customer-entered codes with percentage or fixed discounts, usage caps, validity windows, category filters | `org_promo_codes_mst`, `org_promo_usage_log` |
| **Automatic discount rules** | Server-evaluated rules (weekday discount, loyalty tier discount); structured `conditions` JSONB | `org_discount_rules_cf` |

These are **commercial discounts** — they reduce the taxable base before VAT is applied.

Gift cards are not discounts. They are post-tax payment settlements. See [`docs/features/Gift_Cards/`](../Gift_Cards/README.md).

---

## 2. Stacking Policy

Single source of truth: [`web-admin/lib/constants/discount-stacking.ts`](../../../web-admin/lib/constants/discount-stacking.ts)

```
Subtotal
  → 1. manual_discount   (% or fixed, applies to subtotal)
  → 2. auto_rules        (best single rule fires)
  → 3. promo_code        (explicit staff/customer code)
  → VAT + additional tax
  → 4. gift_card         (stored-value debit, applied post-tax — NOT a discount)
  = Amount Due
```

Plain-English stacking rules:
- **autoRules: best_single** — only the highest-discount auto rule fires.
- **autoRulesWithPromo: stackable_flag** — auto rule + promo stack only when `rule.can_stack_with_promo = true`.
- **maxCombinedDiscountCap: subtotal** — `manual + auto + promo` capped at subtotal.

---

## 3. Permissions

| Permission | super_admin | tenant_admin | operator | viewer | Description |
|---|:---:|:---:|:---:|:---:|---|
| `promotions:read` | ✓ | ✓ | ✓ | ✓ | List + view promo codes, usage report |
| `promotions:write` | ✓ | ✓ | | | Create / edit / archive promo codes |
| `discount_rules:read` | ✓ | ✓ | | ✓ | List + view discount rules |
| `discount_rules:write` | ✓ | ✓ | | | Create / edit / archive discount rules |

---

## 4. Navigation

| Key | Path | Permission |
|---|---|---|
| `marketing_promos` | `/dashboard/marketing/promos` | `promotions:read` |
| `marketing_rules` | `/dashboard/marketing/discount-rules` | `discount_rules:read` |

---

## 5. Server Actions

### Promo codes (`app/actions/marketing/promo-actions.ts`)

| Action | Permission | Purpose |
|---|---|---|
| `listPromoCodes` | `promotions:read` | Paginated list |
| `createPromoCode` | `promotions:write` | Create new promo |
| `updatePromoCode` | `promotions:write` | Edit promo |
| `archivePromoCode` | `promotions:write` | Soft-delete |
| `getPromoCodeUsageAction` | `promotions:read` | Usage history |

### Discount rules (`app/actions/marketing/discount-rule-actions.ts`)

| Action | Permission | Purpose |
|---|---|---|
| `listDiscountRules` | `discount_rules:read` | Paginated list ordered by priority |
| `createDiscountRule` | `discount_rules:write` | Create rule with structured conditions |
| `updateDiscountRule` | `discount_rules:write` | Edit + reorder priority |
| `archiveDiscountRule` | `discount_rules:write` | Soft-delete |

---

## 6. Migrations

| Migration | Purpose |
|---|---|
| [`0029_payment_enhancement_tables.sql`](../../../supabase/migrations/0029_payment_enhancement_tables.sql) | Original tables: `org_promo_codes_mst`, `org_promo_usage_log`, `org_discount_rules_cf` |
| [`0081_comprehensive_rls_policies.sql`](../../../supabase/migrations/0081_comprehensive_rls_policies.sql) | RLS policies |
| [`0250_promo_usage_log_voiding.sql`](../../../supabase/migrations/0250_promo_usage_log_voiding.sql) | Adds `voided_at` / `voided_by` to `org_promo_usage_log` for cancellation reversal |
| [`0251_marketing_gifts_promotions_navigation_and_permissions.sql`](../../../supabase/migrations/0251_marketing_gifts_promotions_navigation_and_permissions.sql) | Navigation seeds + permissions |

---

## 7. Constants and Types

| File | Exports |
|---|---|
| `web-admin/lib/constants/discount-stacking.ts` | `DISCOUNT_STACKING_ORDER`, `STACKING_RULES` — frozen evaluation order |
| `web-admin/lib/constants/discount-conditions-schema.ts` | `DiscountConditions`, `discountConditionsSchema` — Zod + TS shape for `conditions` JSONB |

---

## 8. i18n Keys

Namespace: `marketing.promos.*` and `marketing.discountRules.*` in `messages/en.json` + `messages/ar.json`.

```
marketing
├── promos
│   ├── title, create, edit, archive, usageReport
│   ├── fields.{ code, name, discountType, discountValue, maxUses, validFrom, validTo, minOrder, categories }
│   ├── status.{ active, expired, maxReached }
│   └── errors.{ codeExists, maxUsesExceeded }
└── discountRules
    ├── title, create, edit, archive
    ├── fields.{ code, name, priority, discountType, discountValue, stackWithPromo, validFrom, validTo }
    ├── conditions.{ title, minOrder, minItems, categories, customerTiers, daysOfWeek, timeRanges }
    └── errors.{ codeExists }
```

---

## 9. Concurrency

```sql
-- applyPromoCodeTx — prevents concurrent over-use
SELECT id, current_uses, max_uses
FROM org_promo_codes_mst
WHERE id = ${promoCodeId} AND tenant_org_id = ${tenantOrgId}
FOR UPDATE;
```

---

## 10. Reversal on Order Cancellation

- `reversePromoUsageTx` soft-voids usage log rows (`voided_at`, `voided_by`).
- Decrements `current_uses` once per promo per cancellation.
- Per-customer cap is recomputed from non-voided rows on next validation.
- Called from `order-cancel-service.ts` inside the cancellation transaction.

---

## 11. Testing

| Test file | Coverage |
|---|---|
| `web-admin/__tests__/services/discount-service.test.ts` | `applyPromoCodeTx` TOCTOU guard, `getBestDiscount`, min-order filter |
| `web-admin/__tests__/services/order-cancel-service.test.ts` | Cancellation reverses promo; no-op paths |
| `web-admin/__tests__/integration/create-with-payment-promo-gift.integration.test.ts` | Promo + gift card in one TX; rollback on mid-TX failure; concurrent max_uses rejection |

```powershell
cd web-admin
npx jest --testPathPattern "order-cancel-service|discount-service|create-with-payment-promo-gift"
```
