# Promotions and Gift Cards

End-to-end production feature combining stored-value gift cards, promo discount codes, and automatic discount rules across all checkout paths in CleanMateX.

- **Original plan:** [`docs/dev/plans/promotions_and_gifts_30156abf.plan.md`](../../dev/plans/promotions_and_gifts_30156abf.plan.md)
- **Gift Card V1 plan:** [`docs/dev/plans/gift_card_v1_35b71bc5.plan.md`](../../dev/plans/gift_card_v1_35b71bc5.plan.md) — **complete**
- **Gift Card V2 roadmap:** [`Gift_Card_V2.md`](./Gift_Card_V2.md)
- **Gift Card V1 implementation detail:** [`Gift_Card_V1_Implementation.md`](./Gift_Card_V1_Implementation.md)

---

## 1. Overview

CleanMateX supports three coordinated discount/payment mechanisms:

| Mechanism | Description | Tables |
|---|---|---|
| **Stored-value gift cards** | Stored-value liability; debited on redemption, restored on refund; treated as a payment settlement (not a discount) | `org_gift_cards_mst`, `org_gift_card_txn_dtl` |
| **Promo codes** | Operator/customer-entered codes with percentage or fixed discounts, usage caps, validity windows, category filters | `org_promo_codes_mst`, `org_promo_usage_log` |
| **Automatic discount rules** | Server-evaluated rules (weekday discount, loyalty tier discount); structured `conditions` JSONB | `org_discount_rules_cf` |

**Gift Card V1** (migration `0257`) elevated gift cards from a simple discount field to a full stored-value system with ledger, dual PIN, lifecycle states, ERP events, and proper liability accounting.

---

## 2. Permissions

| Permission | super_admin | tenant_admin | operator | viewer | Gates |
|---|:---:|:---:|:---:|:---:|---|
| `promotions:read` | ✓ | ✓ | ✓ | ✓ | List + view promo codes, usage report |
| `promotions:write` | ✓ | ✓ | | | Create / edit / archive promo codes |
| `gift_cards:read` | ✓ | ✓ | ✓ | ✓ | List + view gift cards, transaction history |
| `gift_cards:sell` | ✓ | ✓ | ✓ | | Sell gift cards at POS |
| `gift_cards:issue` | ✓ | ✓ | | | Issue promotional / corporate cards |
| `gift_cards:activate` | ✓ | ✓ | | | Manually activate GENERATED cards |
| `gift_cards:redeem` | ✓ | ✓ | ✓ | | Apply gift card at checkout |
| `gift_cards:refund` | ✓ | ✓ | | | Reverse a gift card redemption |
| `gift_cards:void` | ✓ | ✓ | | | Void / cancel gift cards |
| `gift_cards:adjust` | ✓ | ✓ | | | Manual balance adjustment |
| `gift_cards:expire` | ✓ | ✓ | | | Manually expire gift cards |
| `discount_rules:read` | ✓ | ✓ | | ✓ | List + view discount rules |
| `discount_rules:write` | ✓ | ✓ | | | Create / edit / archive discount rules |

Access contracts: [`web-admin/src/features/marketing/access/marketing-access.ts`](../../../web-admin/src/features/marketing/access/marketing-access.ts)

---

## 3. Navigation tree

| Key | Label (i18n) | Path | Permission |
|---|---|---|---|
| `marketing` | `navigation.marketing` | `/dashboard/marketing` | `promotions:read` |
| `marketing_promos` | `navigation.marketingPromos` | `/dashboard/marketing/promos` | `promotions:read` |
| `marketing_gift_cards` | `navigation.marketingGiftCards` | `/dashboard/marketing/gift-cards` | `gift_cards:read` |
| `marketing_gift_cards_liability` | `navigation.marketingGiftCardsLiability` | `/dashboard/marketing/gift-cards/liability` | `gift_cards:read` |
| `marketing_rules` | `navigation.marketingRules` | `/dashboard/marketing/discount-rules` | `discount_rules:read` |

---

## 4. Gift card lifecycle

```
DRAFT → GENERATED → ACTIVE ──────────────────────────────→ FULLY_REDEEMED
                      │                                          ↑
                      │          ┌── PARTIALLY_REDEEMED ────────┘
                      │          │   (refund reverts to here)
                      ↓          ↓
                   SUSPENDED  EXPIRED
                      │
                      └──────→ VOIDED
```

| Status | Redeemable | Who sets it |
|---|:---:|---|
| DRAFT | No | Admin (batch prep) |
| GENERATED | No | System (code created) |
| ACTIVE | Yes | Auto on paid sale; manual admin activate |
| PARTIALLY_REDEEMED | Yes | System after partial redemption or refund |
| FULLY_REDEEMED | No | System when available_amount = 0 |
| EXPIRED | No | Admin manually; inline check at redemption |
| VOIDED | No | Admin void action |
| SUSPENDED | No | Admin suspend action |

**Activation triggers** (from `docs/features/Promotions_and_Gift_Cards/9_Explain.md`):

| Scenario | Trigger |
|---|---|
| Customer buys digital/physical card | Auto-ACTIVE after payment success |
| Admin creates promotional card | Manual admin activation |
| Corporate batch | Batch approval + optional payment confirmation |
| Replacement card | Admin activation after voiding old card |

---

## 5. Stacking policy

Single source of truth: [`web-admin/lib/constants/discount-stacking.ts`](../../../web-admin/lib/constants/discount-stacking.ts)

```
Subtotal
  → 1. manual_discount   (% or fixed, applies to subtotal)
  → 2. auto_rules        (best single rule)
  → 3. promo_code        (explicit staff/customer code)
  → VAT + additional tax
  → 4. gift_card         (stored-value debit, applied post-tax to amountDue)
  = Amount Due
```

Gift card is **not** a discount — it is a post-tax payment settlement. It reduces `amount_due` only, never the taxable base.

Plain-English stacking rules:
- **autoRules: best_single** — only the highest-discount auto rule fires.
- **autoRulesWithPromo: stackable_flag** — auto rule + promo stack only when `rule.can_stack_with_promo = true`.
- **maxCombinedDiscountCap: subtotal** — `manual + auto + promo` capped at subtotal.

---

## 6. API routes (server actions)

All actions: `requirePermission` → Zod parse → service call inside `withTenantContext` → typed result.

### Promo codes ([`promo-actions.ts`](../../../web-admin/app/actions/marketing/promo-actions.ts))

| Action | Permission | Purpose |
|---|---|---|
| `listPromoCodes` | `promotions:read` | Paginated list |
| `createPromoCode` | `promotions:write` | Create new promo |
| `updatePromoCode` | `promotions:write` | Edit promo |
| `archivePromoCode` | `promotions:write` | Soft-delete |
| `getPromoCodeUsageAction` | `promotions:read` | Usage history |

### Gift cards ([`gift-card-actions.ts`](../../../web-admin/app/actions/marketing/gift-card-actions.ts))

| Action | Permission | Purpose |
|---|---|---|
| `listGiftCards` | `gift_cards:read` | Paginated list with status/type/issue_type filters |
| `sellGiftCardAction` | `gift_cards:sell` | Sell + auto-activate card; returns generated `gift_card_code` |
| `issueGiftCardAdmin` | `gift_cards:issue` | Create card in GENERATED status (manual activation required) |
| `activateGiftCardAction` | `gift_cards:activate` | GENERATED → ACTIVE |
| `suspendGiftCardAction` | — | Toggle SUSPENDED state |
| `voidGiftCardAction` | `gift_cards:void` | Void card; forfeits remaining balance |
| `adjustGiftCard` | `gift_cards:adjust` | Credit/debit balance with required reason |
| `cancelGiftCard` | `gift_cards:void` | Alias for void (legacy) |
| `listGiftCardTransactionsAction` | `gift_cards:read` | Tenant-wide transaction log |
| `getGiftCardTransactionsAction` | `gift_cards:read` | Per-card transaction history |
| `getGiftCardLiabilitySummaryAction` | `gift_cards:read` | KPI summary (outstanding, active count, MTD) |
| `listGiftCardLiabilityAction` | `gift_cards:read` | Paginated liability report |
| `listGiftCardRedemptionsAction` | `gift_cards:read` | Redemptions report |
| `listGiftCardRefundsAction` | `gift_cards:read` | Refunds/reversals report |
| `listGiftCardAdjustmentsAction` | `gift_cards:read` | Adjustments audit report |

### Validate / apply (checkout) ([`validate-gift-card.ts`](../../../web-admin/app/actions/payments/validate-gift-card.ts))

| Action | Purpose |
|---|---|
| `validateGiftCardAction` | Read-only balance check + dual PIN verification; returns error code |
| `checkGiftCardBalance` | Balance lookup by code |

### Discount rules ([`discount-rule-actions.ts`](../../../web-admin/app/actions/marketing/discount-rule-actions.ts))

| Action | Permission | Purpose |
|---|---|---|
| `listDiscountRules` | `discount_rules:read` | Paginated list ordered by priority |
| `createDiscountRule` | `discount_rules:write` | Create rule with structured conditions |
| `updateDiscountRule` | `discount_rules:write` | Edit + reorder priority |
| `archiveDiscountRule` | `discount_rules:write` | Soft-delete |

---

## 7. Migrations

| Migration | Purpose |
|---|---|
| [`0029_payment_enhancement_tables.sql`](../../../supabase/migrations/0029_payment_enhancement_tables.sql) | Original tables: promo codes, usage log, gift cards, gift transactions, discount rules |
| [`0081_comprehensive_rls_policies.sql`](../../../supabase/migrations/0081_comprehensive_rls_policies.sql) | RLS policies for all `org_*` tables |
| [`0106_add_branch_id_to_transaction_tables.sql`](../../../supabase/migrations/0106_add_branch_id_to_transaction_tables.sql) | Adds `branch_id` to gift card transactions |
| [`0250_promo_usage_log_voiding.sql`](../../../supabase/migrations/0250_promo_usage_log_voiding.sql) | Adds `voided_at` / `voided_by` to `org_promo_usage_log` for cancellation reversal |
| [`0251_marketing_gifts_promotions_navigation_and_permissions.sql`](../../../supabase/migrations/0251_marketing_gifts_promotions_navigation_and_permissions.sql) | Navigation seeds and `gift_cards:read` permission |
| [`0257_gift_card_v1_schema.sql`](../../../supabase/migrations/0257_gift_card_v1_schema.sql) | **Gift Card V1** — table/column renames, status enum, dual PIN, stored-value fields, idempotency, currency, 8 new permissions |

---

## 8. Constants and types

| Constant / type | File | Purpose |
|---|---|---|
| `GIFT_CARD_STATUS`, `GiftCardStatus` | [`lib/constants/gift-card.ts`](../../../web-admin/lib/constants/gift-card.ts) | Canonical 8-value status enum |
| `GIFT_CARD_TXN_TYPE`, `GiftCardTxnType` | [`lib/constants/gift-card.ts`](../../../web-admin/lib/constants/gift-card.ts) | 10-value transaction type enum |
| `GIFT_CARD_ISSUE_TYPE`, `GiftCardIssueType` | [`lib/constants/gift-card.ts`](../../../web-admin/lib/constants/gift-card.ts) | SOLD / PROMOTIONAL / CORPORATE / GOODWILL / MIGRATION / REPLACEMENT |
| `GIFT_CARD_TYPE`, `GiftCardType` | [`lib/constants/gift-card.ts`](../../../web-admin/lib/constants/gift-card.ts) | FIXED_VALUE / PROMOTIONAL / CORPORATE |
| `REDEEMABLE_STATUSES`, `REFUND_REVERTIBLE_STATUSES` | [`lib/constants/gift-card.ts`](../../../web-admin/lib/constants/gift-card.ts) | Guard arrays used in service layer |
| `GiftCard`, `GiftCardTransaction` | [`lib/types/payment.ts`](../../../web-admin/lib/types/payment.ts) | Full TypeScript types (pin fields excluded) |
| `GiftCardMetadataSchema` | [`lib/schemas/gift-card-metadata.schema.ts`](../../../web-admin/lib/schemas/gift-card-metadata.schema.ts) | Zod schema for metadata JSON column |
| `DISCOUNT_STACKING_ORDER`, `STACKING_RULES` | [`lib/constants/discount-stacking.ts`](../../../web-admin/lib/constants/discount-stacking.ts) | Frozen evaluation order |
| `DiscountConditions`, `discountConditionsSchema` | [`lib/constants/discount-conditions-schema.ts`](../../../web-admin/lib/constants/discount-conditions-schema.ts) | Zod + TS shape for `conditions` JSONB |

---

## 9. i18n keys

All UI strings: [`web-admin/messages/en.json`](../../../web-admin/messages/en.json) / [`messages/ar.json`](../../../web-admin/messages/ar.json).

```
marketing
├── title
├── promos
│   ├── title, create, edit, archive, usageReport
│   ├── fields.{ code, name, discountType, discountValue, maxUses, validFrom, validTo, minOrder, categories }
│   ├── status.{ active, expired, maxReached }
│   └── errors.{ codeExists, maxUsesExceeded }
├── giftCards
│   ├── title, issue, detail, adjust, cancel, transactions
│   ├── statuses.{ DRAFT, GENERATED, ACTIVE, PARTIALLY_REDEEMED, FULLY_REDEEMED, EXPIRED, VOIDED, SUSPENDED }
│   ├── issueTypes.{ SOLD, PROMOTIONAL, CORPORATE, GOODWILL, MIGRATION, REPLACEMENT }
│   ├── cardTypes.{ FIXED_VALUE, PROMOTIONAL, CORPORATE }
│   ├── actions.{ sellCard, issueCard, activate, suspend, unsuspend, voidCard, adjustBalance, copyCode }
│   ├── confirmations.{ voidTitle, voidMessage, suspendTitle, suspendMessage, activateTitle, debitAdjustTitle, debitAdjustMessage }
│   ├── fields.{ giftCardCode, issueType, cardType, availableBalance, originalAmount, redeemedAmount,
│   │           activationDate, purchasedBy, recipient, currency, adjustType, adjustReason,
│   │           credit, debit, pinOptional, sameAsBuyer, generatedNotice, newBalancePreview,
│   │           balanceAfterApply, remainingDue }
│   ├── errors.{ EXPIRED, SUSPENDED, VOIDED, INSUFFICIENT_BALANCE, INVALID_CODE, INVALID_PIN,
│   │           MAX_REDEMPTIONS_REACHED, CURRENCY_MISMATCH }
│   ├── pos.{ scanOrType, enterPin, checkBalance, applyCard, cardApplied, settlement }
│   └── reports.{ liabilityTitle, liabilitySubtitle, totalOutstanding, activeCards,
│               redeemedMtd, issuedMtd, expiredBalance, transactionsTitle, exportComingSoon, noCardsFound }
└── discountRules
    ├── title, create, edit, archive
    ├── fields.{ code, name, priority, discountType, discountValue, stackWithPromo, validFrom, validTo }
    ├── conditions.{ title, minOrder, minItems, categories, customerTiers, daysOfWeek, timeRanges }
    └── errors.{ codeExists }
```

Run `npm run check:i18n` after touching translations.

---

## 10. Receipt and order detail rendering

**Order detail page** (`order-details-full-client.tsx`):

```
Subtotal:               XXX
Commercial Discounts:  −XXX   ← promo + auto rule + manual (only if > 0)
─────────────────────────────
Taxable Base:           XXX
VAT (X%):               XXX
─────────────────────────────
Invoice Amount:         XXX
── Settlements ──────────────
Gift Card (CMX-...):   −XXX   ← gift_card_applied_amount (only if > 0)
Cash:                   XXX
Card:                   XXX
─────────────────────────────
Amount Due:             XXX
```

**Print report** (`order-invoices-payments-print-rprt.tsx`): gift card appears in a distinct "Settlements" subsection with purple styling — separate from promo/auto-rule discount lines.

---

## 11. PIN security

- **New cards:** `pin_hash` stored via bcrypt (12 rounds); `card_pin = NULL`.
- **Legacy cards:** `card_pin` plaintext retained; on first successful validation, migrated to `pin_hash` and `card_pin` cleared asynchronously.
- `card_pin` and `pin_hash` are **never returned** to any client response. `mapGiftCardToType` explicitly omits both fields.
- Failed PIN attempts tracked via `pin_failed_attempts` counter. After `GIFT_CARD_PIN_MAX_ATTEMPTS` (5) consecutive failures, card enters lockout.

---

## 12. SELECT FOR UPDATE locking strategy

All balance mutations use `SELECT … FOR UPDATE` so concurrent transactions block on the lock and re-read the committed value:

```sql
-- redeemGiftCardTx
SELECT id, available_amount, status, expiry_date, currency_code,
       max_redemptions, redemption_count, tenant_org_id
FROM org_gift_cards_mst
WHERE id = ${cardId} AND tenant_org_id = ${tenantOrgId}
FOR UPDATE;

-- refundGiftCardTx
SELECT id, available_amount, original_amount, status, tenant_org_id
FROM org_gift_cards_mst
WHERE id = ${cardId} AND tenant_org_id = ${tenantOrgId}
FOR UPDATE;

-- applyPromoCodeTx
SELECT id, current_uses, max_uses
FROM org_promo_codes_mst
WHERE id = ${promoCodeId} AND tenant_org_id = ${tenantOrgId}
FOR UPDATE;
```

---

## 13. Refund and reversal rules

### Gift card refund

- Implemented in `refundGiftCardTx` (composes into outer transaction).
- Requires `idempotency_key` — prevents double-refund on POS retry.
- Capped at `original_amount` — can never restore above face value.
- **Status revert after refund:**
  - `newAvailable >= originalAmount` → ACTIVE
  - `newAvailable > 0` → PARTIALLY_REDEEMED
  - `newAvailable = 0` → FULLY_REDEEMED
  - VOIDED / EXPIRED / SUSPENDED → unchanged

### Promo reversal on cancellation

- `reversePromoUsageTx` soft-voids usage log rows (`voided_at`, `voided_by`).
- Decrements `current_uses` once per promo per cancellation.
- Does not restore per-customer cap — recomputed from non-voided rows on next validation.

### Cancellation sequence (`order-cancel-service.ts`)

1. RPC `cmx_ord_canceling_transition` (status flip)
2. Cancel each completed payment
3. Inside `prisma.$transaction`:
   - `reversePromoUsageTx` if promo applied
   - `refundGiftCardTx` with `idempotencyKey = orderId + ':refund'` if gift card applied
4. Non-fatal warnings collected in `CancelOrderResult.warnings`

---

## 14. Testing

### Unit tests (`web-admin/__tests__/services/`)

| Test file | Coverage |
|---|---|
| `gift-card-service.test.ts` | 40 tests — sell/activate, redeem (partial/full), refund idempotency, status revert (5 cases), PIN hash + legacy migration, currency mismatch, max_redemptions, credit cap, void, suspend, expire |
| `discount-service.test.ts` | `applyPromoCodeTx` TOCTOU guard, `getBestDiscount`, min-order filter |
| `order-cancel-service.test.ts` | Cancellation reverses promo + refunds gift card; partial-refund warning; no-op paths |

### Integration tests (`web-admin/__tests__/integration/`)

| Test file | Coverage |
|---|---|
| `create-with-payment-promo-gift.integration.test.ts` | Promo + gift card in one TX; rollback on mid-TX failure; `SELECT FOR UPDATE` issued; concurrent max_uses rejection |

Run targeted suite:

```powershell
cd web-admin
npx jest --testPathPattern "order-cancel-service|discount-service|gift-card-service|create-with-payment-promo-gift"
```

**40 tests pass** (gift-card-service) + existing promo/cancel tests.

---

## 15. Dependencies added (Gift Card V1)

| Package | Purpose |
|---|---|
| `bcryptjs` | PIN hashing for new cards |
| `@types/bcryptjs` | TypeScript types |
