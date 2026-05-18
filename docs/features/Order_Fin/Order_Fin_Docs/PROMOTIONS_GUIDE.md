# Promotions Guide — Types, Stacking, Auto-Apply

## Promotion Types

| discountType | Behavior |
|---|---|
| PERCENTAGE | `discountAmount = min(orderTotal × rate/100, orderTotal)` |
| FIXED_AMOUNT | `discountAmount = min(fixedValue, orderTotal)` |
| BUY_X_GET_Y | Discount computed in `applyPromotionTx` (returns 0 for now — V2 feature) |

## Auto-Apply vs Coupon Code

**Auto-apply rules** (`promo_code IS NULL`): Active rules are evaluated by `getBestDiscount()` against `{order_total, items_count, service_categories, order_date}`. The best single rule is applied automatically — no code required.

**Coupon codes** (`promo_code IS NOT NULL`): Customer enters a code at checkout. `validatePromoCode()` checks validity: active, within date range, usage limits, minimum order amount, allowed categories.

## Stacking Rules

When a coupon code is entered AND an auto-rule qualifies:

1. If `auto_rule.can_stack_with_promo = false`: compare the two discounts, keep the larger one only
2. If `can_stack_with_promo = true`: apply both (auto-rule first, then promo on the reduced amount)

The `stacking_group` column on `org_order_discounts_dtl` groups stacking-limited discounts so the reconciliation can verify only one per group was applied.

## Usage Tracking

`applyPromotionTx(tx, { tenantId, promotionId, orderId, customerId })`:
1. Checks `max_usage` — counts rows in `org_promotion_usage_dtl` where `promotion_id = ?`
2. Checks `max_usage_per_customer` — counts rows for this customer
3. Inserts a usage row atomically inside the settlement transaction

This means if two orders race to use the last slot of a `max_usage=1` promo, exactly one will succeed (Postgres serialization).

## Eligibility Filters

| Field | Enforcement |
|---|---|
| valid_from / valid_to | Date range check |
| min_order_amount | orderTotal >= min |
| allowed_service_categories | Overlap check if not NULL |
| is_active | Must be true |
| tenant_org_id | Always filtered |

## `applyPromotionTx` vs `validatePromoCode`

- `validatePromoCode` — read-only check, returns `{ isValid, discountAmount }`. Used in order calculation preview.
- `applyPromotionTx` — transactional; inserts usage row. Used in settlement.
