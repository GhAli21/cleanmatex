# Collect Payment Enhancement — STATUS

**Scope:** production-hardening of the shared Collect Payment modal
(`web-admin/src/features/orders/ui/collect-payment/order-collect-payment-modal.tsx`)
across its three mount surfaces.
**Plan:** `C:\Users\JHNLP\.claude\plans\what-enhancements-could-be-lively-taco.md`
**Started:** 2026-08-15

## Surfaces (all three share one modal)

| Route | Mount | Lifecycle |
|---|---|---|
| `/dashboard/ready/[id]` | `app/dashboard/ready/[id]/page.tsx` | persistent, `open` toggles |
| `/dashboard/delivery` | `app/dashboard/delivery/page.tsx` | conditional remount per list row |
| `/dashboard/orders/[id]` → Financial tab | `order-receivable-collection-panel.tsx` | persistent, `open` toggles |

The governed-edit CHARGE path deliberately does **not** mount it (`amendment-delta-notice.tsx`) because `collectPaymentTx` is `PAY_ON_COLLECTION`-scoped.

---

## Phase 1 — Defects · ✅ COMPLETE (2026-08-15)

| # | Item | Outcome |
|---|---|---|
| 1.1 | Dead trigger for unprivileged users | **Fixed.** Ready's trigger was a raw `<button>` with no permission check while the modal bails via `if (!canCollect) return null` — a user without `orders:collect_payment` clicked and nothing happened. Now routed through the new `CollectPaymentButton` |
| 1.2 | Missing i18n key | **Fixed.** `tPayment('cashDrawer.errors.noOpenSession')` (2 call sites) had no `errors` node in `cashDrawer.json` — it rendered the raw key path exactly when a cash collection was blocked. Repointed to the existing `cashDrawer.messages.noOpenSession` (no new keys) |
| 1.3 | CRITICAL RULE #16 | **Fixed.** All 6 legacy `showErrorToast`/`showSuccessToast` call sites → `cmxMessage` from `@ui/feedback` |
| 1.4 | Hardcoded currency | **Fixed.** `order.currencyCode ?? 'OMR'` → `?? tenantCurrencyCode` from `useTenantCurrency()`. The other two mounts already threaded currency correctly — no literal defaults remain |
| 1.5 | Money inputs | **Fixed.** Amount + Cash Tendered moved from raw `CmxInput type="number"` (hardcoded `step="0.001"`, `Number()` parsing, scroll-wheel mutation) to `CmxMoneyField` driven by tenant `decimalPlaces` |
| 1.6 | `cashLegRef` shadowing | **Fixed.** The submit block minted a fresh UUID into a shadowing local, so the pay-extra path and the submit-time resolution fallback named *different* legs. The stable ref is now seeded into the leg (`ensurePaymentLegRefs` preserves it) and the local renamed `submitCashLegRef` |
| 1.7 | Reset effect deps | **Fixed.** Converted to render-time Pattern A (`react-effects-patterns.md` §2) |

### Additional fixes found during Phase 1 (not in the original plan)

- **No-silent-money-mutation gap (CRITICAL RULE #15).** The reset effect ran on `[open, outstandingAmount]`, so a parent refetch that moved the outstanding balance while the dialog was open silently overwrote an amount the cashier had already typed. Pattern A narrows the reset to the open transition, closing it.
- **Cash-tendered validation.** Removing the tendered input's `min={amount}` needed a real replacement — that attribute only drove native form validation this dialog never invokes, so it blocked nothing. Added an inline `role="alert"` message + submit block mirroring the server's `CASH_TENDERED_LESS_THAN_AMOUNT` guard, so the cashier is told at entry time instead of on a rejected submit. New keys: `orders.collectPayment.cashTenderedBelowAmount` (EN/AR).
- **`cashLegRef` lifecycle.** Now regenerated per dialog-open alongside `idempotencyKey` — one dialog session is one logical cash leg.

### Reusable component added

**`CollectPaymentButton`** — `web-admin/src/features/orders/ui/collect-payment/collect-payment-button.tsx`

Centralises the `orders:collect_payment` gate for all three triggers. Denial uses the codebase's established soft-lock (`aria-disabled` + muted styling, click still fires and explains via `cmxMessage`) rather than an inert disabled control.

**Deviation from plan, recorded:** the plan called this "R2" with a `.stories.tsx`. It is placed in `features/orders/ui/` **without** a story and **without** the `Cmx` prefix, because the frontend skill's hard gates reserve `src/ui/` + `Cmx*` for generic design-system primitives (#4) and put domain UI in `src/features/<feature>/ui/` (#5). This component reads orders RBAC and orders i18n, so it is feature UI. The `/storybook` skill covers Cmx components. R1 (`CmxChangeDueRow`, Phase 3) *is* a genuine `src/ui` primitive and will carry a story.

**Second deviation:** `PickupHandoverCard`'s CTA is dual-purpose — "Collect remaining payment" *or* "Confirm handover". It was split rather than blanket-replaced; routing the handover confirm through the permission-aware button would have locked handover behind a payment permission it has never required. The shared `promptForCollection()` helper is now used by both the CTA and the server-side `PICKUP_COLLECTION_REQUIRED` fallback.

### New i18n keys (EN + AR)

- `orders.collectPayment.cashTenderedBelowAmount` — `"Cash tendered must be at least {amount}."`
- `orders.collectPayment.permissionRequired` — `"You do not have permission to collect payments. Required: {permissionCode}."`

### Files changed

- `web-admin/src/features/orders/ui/collect-payment/order-collect-payment-modal.tsx`
- `web-admin/src/features/orders/ui/collect-payment/collect-payment-button.tsx` *(new)*
- `web-admin/app/dashboard/ready/[id]/page.tsx`
- `web-admin/src/features/orders/ui/order-financial/order-receivable-collection-panel.tsx`
- `web-admin/src/features/pickup/ui/pickup-handover-card.tsx`
- `web-admin/messages/{en,ar}/orders/collectPayment.json`

### Gates (2026-08-15, all green)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | exit 0, clean |
| `npx eslint` (all touched files) | exit 0, 0 findings |
| `npm run check:i18n` | passed — locale trees, keys, placeholders aligned |
| targeted jest (5 suites) | 33/33 passed |
| `npm run build` | exit 0, full route manifest emitted |
| `npm run check:platform-info-inventories` | drift 0 (0 errors, 0 warnings); access-contract suites 10/10 |

**No migration.** No DB change was required or made.

### Not yet done for Phase 1

- **Modal UI tests.** The modal still has zero test coverage; the plan builds the matrix across phases. Phase 1 relied on existing service/route suites plus tsc/eslint/build.
- **Manual QA** on the three surfaces (EN + AR) — pending, to be captured in `QA_TEST_GUIDE.md` at Phase 6.

---

## Phase 2 — State contract · ✅ COMPLETE (2026-08-15)

| # | Item | Outcome |
|---|---|---|
| 2.1 | Method-load failure had no recovery | **Fixed.** Was toast-only + `setMethods([])`, leaving an empty dropdown and no way back short of closing. Now an inline `CmxSummaryMessage` + **Retry** driven by a `methodsReloadToken`. Fetch also gained a `cancelled` guard against out-of-order responses |
| 2.2 | No empty state | **Fixed.** When no method is eligible for collection at the branch, an explicit info panel replaces the empty select |
| 2.3 | Errors were toast-only | **Fixed.** Submit failures now persist inline *and* toast; cleared on next attempt and on open |
| 2.4 | Stale outstanding amount | **Fixed** — see below |
| 2.5 | Accessibility | **Fixed.** Added `CmxDialogDescription` (the dialog had a title only, so no `aria-describedby`); `autoFocus` on Amount; `aria-invalid`/`aria-describedby` wired on the tendered field |
| 2.6 | B31 pending detection incomplete | **Fixed** — see below |

### 2.4 — Stale outstanding balance (correctness)

`outstandingAmount` is a prop reflecting whatever the *parent* last read. The Delivery list passes a row value that can be minutes old, so another till collecting meanwhile left this dialog prefilled with a balance that no longer existed — the server rejected it (`FOR UPDATE` + outstanding re-check) but the cashier saw a wrong number and an opaque 422.

Now: an `/api/v1/orders/[id]/state` read on open supplies `effectiveOutstanding`, which replaced the prop across **all** derived money inputs (overpayment metrics, `capCollectPaymentAmount`, pay-extra `saleTotal`/allocation, the catalog `amount` query, the Outstanding display, and "Full outstanding").

`/state` was chosen deliberately: it is tenant-scoped and needs no permission beyond the session, whereas `financial-summary` requires `orders:view_financial_breakdown` that a till user may legitimately lack.

**CRITICAL RULE #15 compliance:** a late authoritative value re-prefills the amount **only while the field is untouched** (`amountDirty`). Once the cashier has typed, their figure is preserved and a warning explains the balance moved. Either way the change is visible, never silent. A submit failure also refetches the balance, turning an opaque rejection into "it moved to X".

### 2.6 — B31 resolved creation status

`willBePending` read `default_creation_status`, which carries only an **explicit** D9 override. A method reaching PENDING through the fallback chain (e.g. BANK_TRANSFER) therefore looked COMPLETED to the client — the cashier was told the order would be fully paid when it would not be.

`checkout-options` now additionally returns `resolved_creation_status`, computed with the *same* expression `collectPaymentTx` uses (`method.default_creation_status || resolveDefaultStatus(code, gateway)`), so the notice cannot drift from what the server writes. Additive — `default_creation_status` is retained and the client falls back to it.

### New i18n keys (EN + AR)

`loadMethodsRetry` · `noMethodsTitle` · `noMethodsDescription` · `dialogDescription` · `balanceChangedTitle` · `balanceRefreshed` · `balanceChangedKeepEntry`

### Files changed

- `web-admin/src/features/orders/ui/collect-payment/order-collect-payment-modal.tsx`
- `web-admin/app/api/v1/orders/checkout-options/route.ts` *(additive response field)*
- `web-admin/messages/{en,ar}/orders/collectPayment.json`

### Gates (2026-08-15, all green)

tsc exit 0 · eslint exit 0 · `check:i18n` passed · jest 5 suites 48/48 · `npm run build` exit 0. No migration.
## Phase 3 — POS speed · ✅ COMPLETE (2026-08-15)

| # | Item | Outcome |
|---|---|---|
| 3.2 | Quick-tender chips | **Added.** Reuses `PaymentQuickTenderChips` + the pure `deriveQuickTenderChips` deriver already used by the POS faces — currency-aware round-ups and notes, deduped, capped. Sets **tendered only**, never the amount, so it stays an explicit user action (#15) |
| 3.3 | Change Due | **Promoted** to the till-scale figure via the new `CmxChangeDueRow` (`size="lg"`) |
| 3.4 | Keyboard | **Added.** Enter submits from anywhere in the form, sharing one `submitDisabled` condition with the footer button; skipped inside textareas and on the method combobox. Dialog now also refuses to close mid-submit |
| 3.5 | Remaining-after-payment | **Added.** Partial collection is allowed (ADR-022) but the cashier had to subtract mentally |

### R1 — `CmxChangeDueRow` (new reusable, `src/ui/data-display/`)

`web-admin/src/ui/data-display/cmx-change-due-row.tsx` + `.stories.tsx` (5 stories: counter scale, till scale, RTL, two-decimal currency, hidden-below-epsilon).

**Fixed a live money-display bug by extraction.** The customer stored-value copy formatted change with a hardcoded `changeDue.toFixed(3)` and gated on a literal `0.001`. On a 2-decimal tenant (AED/SAR/QAR) it showed a third digit no other money field on that screen showed. The component now takes a caller-formatted, tenant-aware string and the shared `SETTLEMENT_MONEY_EPSILON`.

While there, two further hardcoded `decimalPlaces={3}` props in `stored-value-tender-fields.tsx` were switched to the tenant value from `useTenantCurrency()` — same bug family, same file.

**Scope decision (recorded):** the plan named three duplicate sites. Two were migrated — the collect modal and the stored-value fields, which were near-identical markup. The third, `payment-simple-view.tsx:567-579`, was **deliberately left alone**: it is a structurally different always-visible summary row inside the receipt column with its own `data-testid` that existing tests depend on. Forcing it through the shared component would have changed behaviour on the highest-traffic money screen, which the plan's additive-only guardrail forbids. The 2+ rule is still satisfied by the two genuine duplicates.

### New i18n keys (EN + AR)

`remainingAfterPayment`

### Files changed

- `web-admin/src/ui/data-display/cmx-change-due-row.tsx` *(new)* + `.stories.tsx` *(new)* + `index.ts`
- `web-admin/src/features/orders/ui/collect-payment/order-collect-payment-modal.tsx`
- `web-admin/src/features/customers/ui/stored-value-tender-fields.tsx`
- `web-admin/messages/{en,ar}/orders/collectPayment.json`

### Gates (2026-08-15, all green)

tsc 0 · eslint 0 · `check:i18n` passed · `npm run build` 0 · **shared-component regression: 68 suites / 630 tests passed** (all `__tests__/features/orders` payment suites, `__tests__/ui` incl. keypad + popover, cash-drawer, payments) — no regression on the new-order checkout graph.

### Deferred within Phase 3

**3.1 `PaymentAmountMoneyField` adoption** was not done. That component is engine-shaped — it expects `PaymentEngineActions` (`pressKeypad`, `fillLegRemaining`, active-leg draft state) that this modal does not have until Phase 4 adopts `usePaymentLegs`. Wiring it before then would have meant either faking an engine or editing the shared component for this caller, both of which the additive-only guardrail rules out. The keypad therefore arrives with Phase 4; `CmxMoneyField` (Phase 1) already removed the raw-number-input defects in the meantime.
## Phase 4 — Compose, don't fork · ✅ COMPLETE (scope corrected — 2026-08-15)

### 4.1 — Shared option type adopted; shared *fetching* deliberately not

The local `CheckoutMethodOption` interface is gone; the modal now builds on the shared `CheckoutSettlementOption` from `use-payment-catalog`. That closes the root cause of 5.1 — the old hand-listed interface simply omitted `requires_reference` and `requires_terminal`, so no UI could render or validate them.

**`usePaymentCatalog` itself was NOT adopted, and this is a correction to the plan.** Its checkout-options query maps a non-ok response to `{ paymentMethods: [], customerCredits: [] }` ([use-payment-catalog.ts:203](../../../../web-admin/src/features/orders/hooks/use-payment-catalog.ts#L203)). Adopting it would have silently reverted Phase 2.1: a failed catalog load would again present an empty method list with no error and no Retry. Fixing that inside the hook would change behaviour for the new-order modal, which the additive-only guardrail forbids. Reusing the *type* while keeping the local fetch delivers the actual goal at no cost.

### 4.2 — `usePaymentLegs` NOT adopted; split tender consequently deferred

Not started. The hook is genuinely standalone, but adopting it is a rewrite of this modal's single-leg state, and the `SplitTenderDialog` it would unlock additionally needs engine actions (`pressKeypad`, active-leg draft, `fillLegRemaining`) that only exist inside `usePaymentEngine`. Attempting it at the tail of this program would have meant either faking an engine surface or editing shared components used by the highest-traffic money screen.

**Consequence: 5.2 (split tender) is deferred with it**, along with 3.1 (`PaymentAmountMoneyField`, same dependency). Both are recorded below as open follow-ups rather than silently dropped. The API has always accepted N legs, so this remains a UI-only gap.

## Phase 5 — Capability gaps · ✅ COMPLETE except split tender (2026-08-15)

| # | Item | Outcome |
|---|---|---|
| 5.1 | Reference / check fields | **Fixed across all three layers** — see below |
| 5.2 | Split tender | **DEFERRED** — depends on Phase 4.2 |
| 5.3 | Collection notes | **Fixed.** `rec_notes` existed but nothing on this path wrote it. Plumbed UI → route schema → `CollectPaymentParams` → voucher line → wiring handler. No migration |
| 5.4 | Print receipt | **Fixed.** Optional `onPrintReceipt?` prop; Ready wires it to `openPrintPreview('receipt','thermal')`, the other two omit it and the control does not render. Closes a B04 deferral |
| 5.5 | Handover intent | **Fixed.** Optional `handoverIntent` prop, Ready-only: the pickup CTA sets it, changing the submit label to "Collect & release order" and adding a hint |

### 5.1 — the gap really was three layers deep

| Layer | Before | After |
|---|---|---|
| UI | No reference field at all | Per-method fields: check number/bank/date for CHECK, generic reference for other non-cash. `requires_reference` blocks submit with an inline `role="alert"` |
| Route Zod | Accepted only `reference` | New shared `collectionPaymentLegSchema` carries `reference`, `checkNumber`, `checkBank`, `checkDate`, and re-uses `validateCheckDueDate` so a check collected later cannot bypass a rule the same check would fail at order time |
| Service / DB | Already fully supported | Unchanged |

**Both routes now share one leg schema.** `/payments` and `/collect-payment` each declared the shape inline and independently — which is exactly how their contracts drifted. `collectionPaymentLegSchema` and `collectionNotesSchema` now live in `lib/validations/new-order-payment-schemas.ts` and both routes import them.

**Shared wiring change, kept strictly additive:** `VoucherLineForWiring.notes` was added as **optional** (every sibling field is required) so no existing handler or test fixture needed touching; `LINE_SELECT` gained `notes: true`; `order-payment-wiring.handler` writes `rec_notes: line.notes ?? null`. Submit-path lines simply leave it null. `notes` was also added to the collect idempotency hash, so a replay under the same key with a different note is a genuine conflict rather than a silent replay of the original.

### New i18n keys (EN + AR)

`reference` · `referencePlaceholder` · `referenceRequired` · `checkNumber` · `checkBank` · `checkDate` · `notes` · `notesPlaceholder` · `submitAndRelease` · `handoverHint`

### Files changed (Phases 4–5)

- `web-admin/src/features/orders/ui/collect-payment/order-collect-payment-modal.tsx`
- `web-admin/app/dashboard/ready/[id]/page.tsx`
- `web-admin/app/api/v1/orders/[id]/payments/route.ts`
- `web-admin/app/api/v1/orders/[id]/collect-payment/route.ts`
- `web-admin/lib/validations/new-order-payment-schemas.ts`
- `web-admin/lib/services/order-settlement.service.ts`
- `web-admin/lib/services/voucher-wiring.service.ts`
- `web-admin/lib/services/wiring/order-payment-wiring.handler.ts`
- `web-admin/lib/types/voucher-wiring.ts`
- `web-admin/messages/{en,ar}/orders/collectPayment.json`

### Gates (2026-08-15, all green)

tsc 0 · eslint 0 · `check:i18n` passed · **full jest 259 suites / 2423 tests passed** · `npm run build` compiled successfully. **No migration.**

## Phase 6 — Documentation · ✅ COMPLETE (2026-08-15)

Pack produced in this folder (README, developer/user guides, testing guide, CHANGELOG, version). QA scenarios added to `Remediation_Work_Packages/QA_TEST_GUIDE.md`. B04/B31 completion evidence updated. Platform inventories re-validated.

---

## Open follow-ups (carried forward, not dropped)

| Item | Why it is open |
|---|---|
| **Split tender (5.2) + `PaymentAmountMoneyField`/keypad (3.1)** | Deferred at implementation time as depending on adopting `usePaymentLegs` (4.2). **Correction (2026-08-15, design discussion):** the coupling was overstated — `SplitTenderDialog` is a pure view taking plain data plus five typed functions, not an engine object, and `usePaymentLegs` is already a generic tender core. The real work is collect's *container* going multi-leg (per-leg drawer binding, multi-leg pay-extra wiring), not the UI. Now folded into the reusable tender panel discussion: [`../Reusable_Tender_Panel/DESIGN_DISCUSSION.md`](../Reusable_Tender_Panel/DESIGN_DISCUSSION.md). API already accepts N legs — still a UI-only gap |
| **Modal UI tests** | The modal still has no dedicated test file. Covered indirectly by the full suite (2423 tests) plus tsc/eslint/build; a focused matrix is specified in `testing_guide_and_scenarios.md` |
| **Manual QA** | Not yet run on any surface — see the QA guide |

## Deferred (owner decision) — see plan

Customer credit at collection (blocked by `INVALID_PAYMENT_NATURE_FOR_COLLECTION`) · collect on non-PAY_ON_COLLECTION orders · tips/gratuity · `require_payment_before_handover` setting · duplicate collect routes · `openSession` dropping `notes`.
