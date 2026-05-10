# Gift Card V1 — Implementation Detail
# From Plan F:\jhapp\cleanmatex\docs\dev\plans\gift_card_v1_35b71bc5.plan.md

**Status:** Complete — shipped 2026-05-09 / 2026-05-10
**Plan:** [`docs/dev/plans/gift_card_v1_35b71bc5.plan.md`](../../dev/plans/gift_card_v1_35b71bc5.plan.md) — all todos `done`
**Migration:** `0257_gift_card_v1_schema.sql`
**Build:** Green (169 pages, 0 TS errors)
**Tests:** 40/40 passing (gift-card-service) + all integration tests

---

## Implementation Checklist

### Security & Access Control

- [x] **Permissions** — 8 new permissions seeded in `sys_auth_permissions` + `sys_auth_role_default_permissions`

| Permission | super_admin | tenant_admin | operator | Description |
|---|:---:|:---:|:---:|---|
| `gift_cards:read` | ✓ | ✓ | ✓ | Pre-existing (migration 0251) |
| `gift_cards:sell` | ✓ | ✓ | ✓ | Sell gift cards at POS |
| `gift_cards:issue` | ✓ | ✓ | | Issue promotional / corporate / goodwill cards |
| `gift_cards:activate` | ✓ | ✓ | | Manually activate GENERATED cards |
| `gift_cards:redeem` | ✓ | ✓ | ✓ | Apply gift card at checkout |
| `gift_cards:refund` | ✓ | ✓ | | Reverse a gift card redemption |
| `gift_cards:void` | ✓ | ✓ | | Void / cancel gift cards |
| `gift_cards:adjust` | ✓ | ✓ | | Manual balance adjustment with reason |
| `gift_cards:expire` | ✓ | ✓ | | Manually expire gift cards |

- [x] **PIN security** — bcrypt hash (12 rounds) for new cards; legacy plaintext `card_pin` auto-migrated on first successful use; neither field returned to client.

---

### Navigation & UI Structure

- [x] **Navigation tree** — existing marketing tree unchanged; new liability report page added

| Path | Screen | Permission |
|---|---|---|
| `/dashboard/marketing/gift-cards` | Gift Card List | `gift_cards:read` |
| `/dashboard/marketing/gift-cards/liability` | Gift Card Liability Report | `gift_cards:read` |

---

### Configuration & Settings

- [ ] **Tenant settings** — no new tenant settings in V1. PIN requirement, expiry policy, max redemption rate limits, and QR flag deferred to V2.
- [ ] **Feature flags** — `gift_cards_enabled` enforcement deferred to V2. Gift cards always available in V1.

---

### Feature Management

- **Plan limits:** None defined for V1 — gift cards available on all tenant plans.
- **V2 items deferred:** QR code, scheduled expiry cron, customer notifications, customer app, feature flag enforcement, breakage timing policy. See [`Gift_Card_V2.md`](./Gift_Card_V2.md).

---

### Internationalization

- [x] Both `messages/en.json` and `messages/ar.json` updated and in parity (`npm run check:i18n` passed)

New keys added under `giftCards.*`:

| Namespace | Keys |
|---|---|
| `giftCards.statuses` | DRAFT, GENERATED, ACTIVE, PARTIALLY_REDEEMED, FULLY_REDEEMED, EXPIRED, VOIDED, SUSPENDED |
| `giftCards.issueTypes` | SOLD, PROMOTIONAL, CORPORATE, GOODWILL, MIGRATION, REPLACEMENT |
| `giftCards.cardTypes` | FIXED_VALUE, PROMOTIONAL, CORPORATE |
| `giftCards.actions` | sellCard, issueCard, activate, suspend, unsuspend, voidCard, adjustBalance, copyCode |
| `giftCards.confirmations` | voidTitle, voidMessage, suspendTitle, suspendMessage, activateTitle, debitAdjustTitle, debitAdjustMessage |
| `giftCards.fields` | giftCardCode, issueType, cardType, availableBalance, originalAmount, redeemedAmount, activationDate, purchasedBy, recipient, currency, adjustType, adjustReason, credit, debit, pinOptional, sameAsBuyer, generatedNotice, newBalancePreview, balanceAfterApply, remainingDue |
| `giftCards.errors` | EXPIRED, SUSPENDED, VOIDED, INSUFFICIENT_BALANCE, INVALID_CODE, INVALID_PIN, MAX_REDEMPTIONS_REACHED, CURRENCY_MISMATCH |
| `giftCards.pos` | scanOrType, enterPin, checkBalance, applyCard, cardApplied, settlement |
| `giftCards.reports` | liabilityTitle, liabilitySubtitle, totalOutstanding, activeCards, redeemedMtd, issuedMtd, expiredBalance, transactionsTitle, exportComingSoon, noCardsFound |

---

### API Routes (Server Actions)

All operations use Next.js server actions — no new REST endpoints.

| File | New actions added |
|---|---|
| `app/actions/marketing/gift-card-actions.ts` | `sellGiftCardAction`, `issueGiftCardAdmin`, `activateGiftCardAction`, `suspendGiftCardAction`, `voidGiftCardAction`, `getGiftCardLiabilitySummaryAction`, `listGiftCardLiabilityAction`, `listGiftCardRedemptionsAction`, `listGiftCardRefundsAction`, `listGiftCardAdjustmentsAction` |
| `app/actions/payments/validate-gift-card.ts` | Refactored to use `getGiftCardByCode` |

---

### Database & Schema

- [x] **Migration `0257_gift_card_v1_schema.sql`** — applied

**Table renames:**

| Old | New |
|---|---|
| `org_gift_card_transactions` | `org_gift_card_txn_dtl` |

**Column renames:**

| Table | Old | New |
|---|---|---|
| `org_orders_mst` | `gift_card_discount_amount` | `gift_card_applied_amount` |
| `org_invoice_mst` | `gift_card_discount_amount` | `gift_card_applied_amount` |
| `org_gift_cards_mst` | `card_number` | `gift_card_code` |

**New columns on `org_gift_cards_mst`:**

| Column | Type | Purpose |
|---|---|---|
| `pin_hash` | TEXT | bcrypt hash of PIN (new cards) |
| `available_amount` | DECIMAL(19,4) | Current redeemable balance |
| `redeemed_amount` | DECIMAL(19,4) | Cumulative amount redeemed |
| `bonus_amount` | DECIMAL(19,4) | Total bonus granted |
| `bonus_remaining` | DECIMAL(19,4) | Unredeemed bonus balance |
| `activation_date` | TIMESTAMPTZ | When card became ACTIVE |
| `batch_id` | UUID | Batch generation reference |
| `is_reloadable` | BOOLEAN | Whether balance can be topped up |
| `is_transferable` | BOOLEAN | Whether ownership can be transferred |
| `max_redemptions` | INT | Redemption count ceiling (null = unlimited) |
| `redemption_count` | INT | Cumulative redemption count |
| `purchased_by_cust_id` | UUID | Buyer (may differ from recipient) |
| `issue_type` | TEXT | SOLD / PROMOTIONAL / CORPORATE / GOODWILL / MIGRATION / REPLACEMENT |
| `gift_card_type` | TEXT | FIXED_VALUE / PROMOTIONAL / CORPORATE |
| `currency_code` | TEXT | Card currency (back-filled from tenant default) |

**New column on `org_gift_card_txn_dtl`:**

| Column | Type | Purpose |
|---|---|---|
| `idempotency_key` | TEXT | Unique per tenant; prevents double-debit / refund on retry |

**Status enum migrated to uppercase:**

| Old | New |
|---|---|
| `active` (full balance) | `ACTIVE` |
| `active` (partial balance) | `PARTIALLY_REDEEMED` |
| `active` (zero balance) | `FULLY_REDEEMED` |
| `used` | `FULLY_REDEEMED` |
| `expired` | `EXPIRED` |
| `cancelled` | `VOIDED` |
| `suspended` | `SUSPENDED` |

CHECK constraint `chk_gift_card_status` enforces canonical values going forward.

**Transaction type migrated to uppercase:** `redemption` → `REDEEM`, `refund` → `REFUND`, `adjustment` → `ADJUSTMENT`, `cancellation` → `VOID`. New types: `ISSUE`, `SALE`, `ACTIVATE`, `EXPIRE`, `BONUS_ADD`, `BONUS_REDEEM`.

**Indexes added:** `uq_gc_code_tenant` (unique code per tenant), `idx_gc_tenant_status`, `idx_gc_tenant_cust`, `idx_gc_tenant_buyer`, `idx_gc_tenant_expiry`, `idx_gc_tenant_batch`, `idx_gc_txn_card_date`, `uq_gc_txn_idem` (partial unique on idempotency_key).

**RLS:** `tenant_isolation_gc_txn_dtl` policy recreated on renamed table using `current_tenant_id()`.

---

### Constants & Types

- [x] `web-admin/lib/constants/gift-card.ts` — **new file**
  - `GIFT_CARD_STATUS` (8 values), `GIFT_CARD_TXN_TYPE` (10 values), `GIFT_CARD_TYPE`, `GIFT_CARD_ISSUE_TYPE`
  - `REDEEMABLE_STATUSES`, `REFUND_REVERTIBLE_STATUSES`, `GIFT_CARD_PIN_MAX_ATTEMPTS`

- [x] `web-admin/lib/schemas/gift-card-metadata.schema.ts` — **new file**
  - `GiftCardMetadataSchema` (Zod) — typed shape for `metadata` JSON column

- [x] `web-admin/lib/types/payment.ts` — updated
  - `GiftCard` type: `card_number` → `gift_card_code`; all new fields added; `card_pin` / `pin_hash` excluded

- [x] `web-admin/lib/constants/erp-lite-posting.ts` — updated
  - Added: `GIFT_CARD_SOLD`, `GIFT_CARD_REDEEMED`, `GIFT_CARD_EXPIRED`, `GIFT_CARD_REFUNDED`, `GIFT_CARD_VOIDED`, `GIFT_CARD_BONUS_GRANTED`

---

### Infrastructure & Dependencies

- [x] `bcryptjs` + `@types/bcryptjs` installed in `web-admin`
- No new environment variables
- No new external services

---

### Service Layer

File: `web-admin/lib/services/gift-card-service.ts`

| Function | Description |
|---|---|
| `generateGiftCardCode(tenantOrgId)` | `CMX-XXXX-XXXX-XXXX` via `crypto.randomBytes`; retries up to 10× |
| `sellGiftCard(params)` | Create + auto-activate; SALE ledger; `GIFT_CARD_SOLD` ERP event |
| `adminActivateGiftCard(id, tenantOrgId, actorId)` | GENERATED → ACTIVE; ACTIVATE ledger |
| `validateGiftCard(input)` | Read-only; dual PIN (hash → legacy fallback with auto-migration) |
| `redeemGiftCardTx(tx, params)` | FOR UPDATE; idempotency; currency match; max_redemptions; debit; REDEEM ledger |
| `refundGiftCardTx(tx, params)` | FOR UPDATE; idempotency; credit capped at original; status revert; REFUND ledger |
| `adminAdjustGiftCard(id, params)` | FOR UPDATE; credit/debit with required reason; ADJUSTMENT ledger |
| `voidGiftCard` | VOIDED; VOID ledger; `GIFT_CARD_VOIDED` ERP event |
| `expireGiftCard` | EXPIRED; EXPIRE ledger; `GIFT_CARD_EXPIRED` ERP event |

**Refund status revert:**
- `newAvailable >= originalAmount` → ACTIVE
- `newAvailable > 0` → PARTIALLY_REDEEMED
- `newAvailable = 0` → FULLY_REDEEMED
- VOIDED / EXPIRED / SUSPENDED → unchanged

---

### UI Components

| File | Status | What changed |
|---|---|---|
| `src/features/marketing/ui/gift-card-list-screen.tsx` | Modified | Status/issue_type badges, Activate/Suspend/Void actions with confirm dialogs, issue_type filter |
| `src/features/marketing/ui/gift-card-sell-dialog.tsx` | **New** | Sell flow: buyer/recipient, masked PIN (`dir="ltr"`), success state with Copy button |
| `src/features/marketing/ui/gift-card-issue-dialog.tsx` | Modified | issue_type + gift_card_type selects, GENERATED-status notice banner |
| `src/features/marketing/ui/gift-card-detail-dialog.tsx` | Modified | New fields, destructive confirms with balance display, Adjust with live preview |
| `src/features/marketing/ui/gift-card-transaction-log-screen.tsx` | Modified | All 6 TX types, idempotency_key column, gift_card_code (ltr) |
| `src/features/marketing/ui/gift-cards-liability-rprt.tsx` | **New** | KPI cards + paginated liability table with expiry colour coding |
| `app/dashboard/marketing/gift-cards/liability/page.tsx` | **New** | Route for liability report |
| `src/features/orders/ui/payment-modal-enhanced-02.tsx` | Modified | VOIDED error code added |
| `app/dashboard/orders/[id]/full/order-details-full-client.tsx` | Modified | Gift card in Settlements zone only |
| `src/features/orders/ui/order-invoices-payments-print-rprt.tsx` | Modified | Gift card in distinct Settlements subsection |

---

### Tests

File: `web-admin/__tests__/services/gift-card-service.test.ts` — **40 tests, 0 failures**

| Test group | Tests |
|---|---|
| Pre-existing V1 tests | 14 |
| Sell gift card auto-activation | 3 |
| Admin activate | 3 |
| validateGiftCard — PIN hash path | 5 |
| redeemGiftCardTx — currency enforcement | 2 |
| redeemGiftCardTx — max_redemptions | 3 |
| refundGiftCardTx — idempotency | 3 |
| refundGiftCardTx — status revert | 5 |
| adminAdjustGiftCard — credit cap | 2 |

```powershell
cd web-admin
npx jest --testPathPattern="gift-card-service" --no-coverage
```

---

### Rollback

Rollback SQL documented in plan Phase 9.4:
[`docs/dev/plans/gift_card_v1_35b71bc5.plan.md`](../../dev/plans/gift_card_v1_35b71bc5.plan.md)

Key steps: rename columns back, revert status values, drop new columns (optional), regenerate Prisma client.
