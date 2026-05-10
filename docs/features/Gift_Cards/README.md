# Gift Cards

Stored-value payment feature — gift cards are liability settlements, not discounts.

- **V1 Plan:** [`docs/dev/plans/gift_card_v1_35b71bc5.plan.md`](../../dev/plans/gift_card_v1_35b71bc5.plan.md) — **complete**
- **V1 Implementation detail:** [`Gift_Card_V1_Implementation.md`](./Gift_Card_V1_Implementation.md)
- **V2 Roadmap:** [`Gift_Card_V2.md`](./Gift_Card_V2.md)
- **Core concept:** [`Core_Concept.md`](./Core_Concept.md)
- **Activation flow:** [`Activation_Flow.md`](./Activation_Flow.md)

---

## 1. Overview

Gift cards are stored-value instruments. When sold, a liability is created. When redeemed, the liability is settled against the invoice. They are **never** commercial discounts.

| Mechanism | Tables |
|---|---|
| Gift card master + balance | `org_gift_cards_mst` |
| Transaction ledger | `org_gift_card_txn_dtl` |
| Order settlement field | `org_orders_mst.gift_card_applied_amount` |
| Invoice settlement field | `org_invoice_mst.gift_card_applied_amount` |
| Payment tender row | `org_payments_dtl_tr` (payment_method = GIFT_CARD) |

**Calculation rule:**
```
commercialDiscount = manual + autoRule + promo
taxableBase        = subtotal - commercialDiscount
invoiceAmount      = taxableBase + VAT + otherTax
amountDue          = invoiceAmount - giftCardApplied   ← gift card is post-tax
```

---

## 2. Lifecycle

```
DRAFT → GENERATED → ACTIVE ──────────────────────────→ FULLY_REDEEMED
                      │                                       ↑
                      │        ┌── PARTIALLY_REDEEMED ────────┘
                      │        │   (refund reverts here)
                      ↓        ↓
                   SUSPENDED  EXPIRED
                      │
                      └──────→ VOIDED
```

| Status | Redeemable | Who sets it |
|---|:---:|---|
| DRAFT | No | Admin (batch prep) |
| GENERATED | No | System on code creation |
| ACTIVE | Yes | Auto on paid sale; manual admin activate |
| PARTIALLY_REDEEMED | Yes | System after partial use or refund |
| FULLY_REDEEMED | No | System when available_amount = 0 |
| EXPIRED | No | Admin manually; inline check at redemption |
| VOIDED | No | Admin void action |
| SUSPENDED | No | Admin suspend action |

**Activation triggers** — see [`Activation_Flow.md`](./Activation_Flow.md) for full matrix.

| Scenario | Trigger |
|---|---|
| Customer buys digital / physical card | Auto-ACTIVE after payment success |
| Admin creates promotional / goodwill card | Manual admin activation |
| Corporate batch | Batch approval + optional payment confirmation |
| Replacement card | Admin activation after voiding old card |

---

## 3. Permissions

| Permission | super_admin | tenant_admin | operator | Description |
|---|:---:|:---:|:---:|---|
| `gift_cards:read` | ✓ | ✓ | ✓ | List + view gift cards and transaction history |
| `gift_cards:sell` | ✓ | ✓ | ✓ | Sell gift cards at POS |
| `gift_cards:issue` | ✓ | ✓ | | Issue promotional / corporate / goodwill cards |
| `gift_cards:activate` | ✓ | ✓ | | Manually activate GENERATED cards |
| `gift_cards:redeem` | ✓ | ✓ | ✓ | Apply gift card at checkout |
| `gift_cards:refund` | ✓ | ✓ | | Reverse a gift card redemption |
| `gift_cards:void` | ✓ | ✓ | | Void / cancel gift cards |
| `gift_cards:adjust` | ✓ | ✓ | | Manual balance adjustment with required reason |
| `gift_cards:expire` | ✓ | ✓ | | Manually expire gift cards |

Seeded in migration `0257` via `sys_auth_permissions` + `sys_auth_role_default_permissions`.

---

## 4. Navigation

| Path | Screen | Permission |
|---|---|---|
| `/dashboard/marketing/gift-cards` | Gift Card List | `gift_cards:read` |
| `/dashboard/marketing/gift-cards/liability` | Liability Report | `gift_cards:read` |

---

## 5. issue_type and ERP accounting

`issue_type` on `org_gift_cards_mst` drives the ERP debit account on card creation.

| issue_type | Debit account | Credit account |
|---|---|---|
| SOLD | Cash / Card Received | Gift Card Liability |
| PROMOTIONAL / GOODWILL | Marketing Expense | Gift Card Liability |
| CORPORATE | Corporate Receivable | Gift Card Liability |
| MIGRATION / REPLACEMENT | As determined by admin | Gift Card Liability |

On redemption: `Dr Gift Card Liability → Cr AR / Invoice Settlement`
On expiry/breakage: `Dr Gift Card Liability → Cr Breakage Revenue`
On refund/void: reverse of original entry.

ERP events: `GIFT_CARD_SOLD`, `GIFT_CARD_REDEEMED`, `GIFT_CARD_EXPIRED`, `GIFT_CARD_REFUNDED`, `GIFT_CARD_VOIDED`, `GIFT_CARD_BONUS_GRANTED`.

---

## 6. Server actions

File: `web-admin/app/actions/marketing/gift-card-actions.ts`

| Action | Permission | Purpose |
|---|---|---|
| `listGiftCards` | `gift_cards:read` | Paginated list with filters |
| `sellGiftCardAction` | `gift_cards:sell` | Sell + auto-activate; returns generated code |
| `issueGiftCardAdmin` | `gift_cards:issue` | Create in GENERATED status |
| `activateGiftCardAction` | `gift_cards:activate` | GENERATED → ACTIVE |
| `suspendGiftCardAction` | — | Toggle SUSPENDED |
| `voidGiftCardAction` | `gift_cards:void` | Void card; forfeits balance |
| `adjustGiftCard` | `gift_cards:adjust` | Credit / debit with required reason |
| `listGiftCardTransactionsAction` | `gift_cards:read` | Tenant-wide transaction log |
| `getGiftCardTransactionsAction` | `gift_cards:read` | Per-card transaction history |
| `getGiftCardLiabilitySummaryAction` | `gift_cards:read` | KPI summary |
| `listGiftCardLiabilityAction` | `gift_cards:read` | Paginated liability report |
| `listGiftCardRedemptionsAction` | `gift_cards:read` | Redemptions report |
| `listGiftCardRefundsAction` | `gift_cards:read` | Refunds / reversals report |
| `listGiftCardAdjustmentsAction` | `gift_cards:read` | Adjustments audit report |

Checkout validate/apply: `web-admin/app/actions/payments/validate-gift-card.ts`

---

## 7. Migrations

| Migration | Purpose |
|---|---|
| `0029_payment_enhancement_tables.sql` | Original `org_gift_cards_mst` + `org_gift_card_transactions` tables |
| `0081_comprehensive_rls_policies.sql` | RLS policies |
| `0106_add_branch_id_to_transaction_tables.sql` | Adds `branch_id` to ledger |
| `0251_marketing_gifts_promotions_navigation_and_permissions.sql` | Navigation seed + `gift_cards:read` |
| `0257_gift_card_v1_schema.sql` | **V1** — table/column renames, status enum, dual PIN, stored-value fields, idempotency, currency_code, 8 new permissions |

---

## 8. Constants and types

| File | Exports |
|---|---|
| `web-admin/lib/constants/gift-card.ts` | `GIFT_CARD_STATUS`, `GIFT_CARD_TXN_TYPE`, `GIFT_CARD_TYPE`, `GIFT_CARD_ISSUE_TYPE`, `REDEEMABLE_STATUSES`, `REFUND_REVERTIBLE_STATUSES`, `GIFT_CARD_PIN_MAX_ATTEMPTS` |
| `web-admin/lib/types/payment.ts` | `GiftCard`, `GiftCardTransaction`, `GiftCardStatus`, `GiftCardTxnType` |
| `web-admin/lib/schemas/gift-card-metadata.schema.ts` | `GiftCardMetadataSchema` (Zod) |
| `web-admin/lib/constants/erp-lite-posting.ts` | `GIFT_CARD_SOLD`, `GIFT_CARD_REDEEMED`, `GIFT_CARD_EXPIRED`, `GIFT_CARD_REFUNDED`, `GIFT_CARD_VOIDED`, `GIFT_CARD_BONUS_GRANTED` |

---

## 9. i18n keys

Namespace: `giftCards.*` in `messages/en.json` + `messages/ar.json`.

```
giftCards
├── statuses.{ DRAFT, GENERATED, ACTIVE, PARTIALLY_REDEEMED, FULLY_REDEEMED, EXPIRED, VOIDED, SUSPENDED }
├── issueTypes.{ SOLD, PROMOTIONAL, CORPORATE, GOODWILL, MIGRATION, REPLACEMENT }
├── cardTypes.{ FIXED_VALUE, PROMOTIONAL, CORPORATE }
├── actions.{ sellCard, issueCard, activate, suspend, unsuspend, voidCard, adjustBalance, copyCode }
├── confirmations.{ voidTitle, voidMessage, suspendTitle, suspendMessage, activateTitle,
│                  debitAdjustTitle, debitAdjustMessage }
├── fields.{ giftCardCode, issueType, cardType, availableBalance, originalAmount,
│           redeemedAmount, activationDate, purchasedBy, recipient, currency,
│           adjustType, adjustReason, credit, debit, pinOptional, sameAsBuyer,
│           generatedNotice, newBalancePreview, balanceAfterApply, remainingDue }
├── errors.{ EXPIRED, SUSPENDED, VOIDED, INSUFFICIENT_BALANCE, INVALID_CODE, INVALID_PIN,
│           MAX_REDEMPTIONS_REACHED, CURRENCY_MISMATCH }
├── pos.{ scanOrType, enterPin, checkBalance, applyCard, cardApplied, settlement }
└── reports.{ liabilityTitle, liabilitySubtitle, totalOutstanding, activeCards,
             redeemedMtd, issuedMtd, expiredBalance, transactionsTitle,
             exportComingSoon, noCardsFound }
```

---

## 10. PIN security

- **New cards:** `pin_hash` via bcrypt (12 rounds); `card_pin = NULL`.
- **Legacy cards:** `card_pin` plaintext retained; auto-migrated to `pin_hash` on first successful use; `card_pin` cleared.
- Neither field is returned to any client response.
- After `GIFT_CARD_PIN_MAX_ATTEMPTS` (5) consecutive failures → lockout.

---

## 11. Concurrency — SELECT FOR UPDATE

All balance mutations hold a row-level lock:

```sql
-- redeemGiftCardTx / refundGiftCardTx
SELECT id, available_amount, status, expiry_date, currency_code,
       max_redemptions, redemption_count, original_amount
FROM org_gift_cards_mst
WHERE id = ${cardId} AND tenant_org_id = ${tenantOrgId}
FOR UPDATE;
```

Concurrent transactions block on the lock and re-read the committed value after release — prevents double-spend.

Refund idempotency: `idempotency_key` unique index on `org_gift_card_txn_dtl` prevents double-refund on POS retry.

---

## 12. Refund and reversal

- Refund capped at `original_amount`.
- Status revert after refund:
  - `newAvailable >= originalAmount` → ACTIVE
  - `newAvailable > 0` → PARTIALLY_REDEEMED
  - `newAvailable = 0` → FULLY_REDEEMED
  - VOIDED / EXPIRED / SUSPENDED → unchanged
- Order cancellation calls `refundGiftCardTx` with `idempotencyKey = orderId + ':refund'` inside the cancel transaction.

---

## 13. Order and invoice display

```
Subtotal:               XXX
Commercial Discounts:  −XXX   (promo + auto rule + manual)
─────────────────────────────
Taxable Base:           XXX
VAT (X%):               XXX
─────────────────────────────
Invoice Amount:         XXX
── Settlements ──────────────
Gift Card (CMX-...):   −XXX   ← gift_card_applied_amount
Cash:                   XXX
Card:                   XXX
─────────────────────────────
Amount Due:             XXX
```

Gift card **never** appears in the Discounts section.

---

## 14. UI components

| File | Purpose |
|---|---|
| `src/features/marketing/ui/gift-card-list-screen.tsx` | Admin list with status/issue_type badges and lifecycle actions |
| `src/features/marketing/ui/gift-card-sell-dialog.tsx` | Sell flow: auto-activates; shows generated code on success |
| `src/features/marketing/ui/gift-card-issue-dialog.tsx` | Admin issue: GENERATED status + manual activation notice |
| `src/features/marketing/ui/gift-card-detail-dialog.tsx` | Full detail: new fields, destructive confirms, adjust dialog |
| `src/features/marketing/ui/gift-card-transaction-log-screen.tsx` | All 6 TX types + idempotency_key |
| `src/features/marketing/ui/gift-cards-liability-rprt.tsx` | Liability report: KPI cards + paginated table |

---

## 15. Testing

File: `web-admin/__tests__/services/gift-card-service.test.ts` — **40 tests, 0 failures**

```powershell
cd web-admin
npx jest --testPathPattern="gift-card-service" --no-coverage
```

Coverage: sell/activate, redeem (partial/full), PIN hash + legacy migration, currency mismatch, max_redemptions, refund idempotency, status revert (5 cases), credit cap, void, suspend, expire.

---

## 16. V1 limitations — V2 roadmap

See [`Gift_Card_V2.md`](./Gift_Card_V2.md) for deferred items:
- QR code generation + scanning
- Scheduled expiry cron job
- Extended ERP lifecycle events (ACTIVATED, SUSPENDED, ADJUSTMENT)
- Breakage revenue timing policy
- Customer notifications (email/SMS)
- Customer app (claim, wallet, balance)
- HQ cross-tenant features (cleanmatexsaas)

---

## 17. Dependencies

| Package | Purpose |
|---|---|
| `bcryptjs` | PIN hashing |
| `@types/bcryptjs` | TypeScript types |
