# Reusable Tender Panel — Design Discussion

**Status:** `DRAFT — UNDER DISCUSSION`
**Approved decision:** NOT YET APPROVED
**Started:** 2026-08-15
**Participants:** owner + engineering

> This is a live design discussion, not an approved plan and not a work package.
> Nothing here is scheduled, and no code has been written against it.
> "Recommended" below means *proposed*, never *agreed*.

---

## 1. What we are talking about

Extracting the split-payment experience into a **configurable, reusable tender component** that any screen can mount — rather than a split-payment dialog that the collect modal happens to borrow.

Origin: the collect-payment modal cannot do split tender (cash + card in one collection), while the new-order payment modal can. The question was "reuse the split dialog in collect?" — which became the better question: *should there be one configurable tender panel that both screens call?*

**Scope of the component:** payment-method config resolution + tender core (leg state) + tender view.
**Explicitly out of scope:** submit. See §8.

---

## 2. Key finding — the coupling is much lighter than first assessed

An earlier note in [`../Collect_Payment_Enhancement/STATUS.md`](../Collect_Payment_Enhancement/STATUS.md) claimed split tender "needs engine actions that live only inside `usePaymentEngine`". **That was overstated.** Reading the actual contract:

`SplitTenderDialog` ([split-tender-dialog.tsx:61-104](../../../../web-admin/src/features/orders/payment/capabilities/split-tender/split-tender-dialog.tsx#L61-L104)) is a **pure view**. Its props are plain data plus five typed functions:

```ts
actions: Pick<PaymentEngineActions,
  'updateLeg' | 'addLeg' | 'removeLegAt' | 'setActiveLegIndex' | 'fillLegRemaining'>
paymentLegs, activeLegIndex, activeAmountDraft, amountDue, legsTotal,
remainingBalance, methodOptions: CheckoutSettlementOption[], moneyEpsilon,
currencyCode, formatAmount, decimalPlaces, branchPaymentTerminals,
cardBrands, creditMethodCodes, payExtraIntent?
```

No engine object is required. Its own docstring says it "performs no money math", and the props comment states the **container** owns capping and draft sync. `methodOptions` is already the same `CheckoutSettlementOption` type the collect modal adopted in Phase 4.1.

Meanwhile `usePaymentLegs` ([use-payment-legs.ts](../../../../web-admin/src/features/orders/hooks/use-payment-legs.ts)) already is a generic tender core: it owns `paymentLegs`, `updateLeg` (capping via `resolvePaymentOverpaymentPolicy`), `removeLegAt`, `setActiveLegIndex`, `activeAmountDraft`, and quick-tender seams. Its params are generic (`saleTotal`, `decimalPlaces`, `getMethodOption`, `open`); only `giftCardSettlementAmount` is checkout-flavoured, and a collect-style caller passes `0`.

**Conclusion:** roughly 80% of the extraction already exists. What is missing is a documented seam, a config contract, and a second caller. This is what the reserved `B2B_COLLECTION` preset key ([preset-keys.ts:26](../../../../web-admin/src/features/orders/payment/presets/preset-keys.ts#L26)) anticipated — *"so a future view is an additive preset descriptor, never a fork."*

---

## 3. Governing principle — config narrows, never widens

Caller configuration may only **restrict** what tenant/branch configuration already permits.

`org_payment_methods_cf` (via `listCheckoutEligiblePaymentMethodConfigs`) already carries `allowed_in_pos`, `requires_cash_drawer`, `requires_terminal`, `requires_reference`, `supports_overpayment`, `supports_change_return`, `payment_nature`, `default_creation_status`, `display_order`.

If a caller could pass `methods: ['CASH','CARD']` and thereby *add* a method the tenant disabled, that is a config bypass on a money screen. **DB decides what is possible; caller decides what is offered; the intersection wins.**

---

## 4. "Which methods" is already modelled in the DB

The config already has per-context flags: `allowed_for_pay_now`, `allowed_for_pay_on_collection`, `allowed_for_invoice_payment`.

So callers should normally declare a **context** and let tenant config resolve the method set:

```ts
context: 'PAY_NOW' | 'PAY_ON_COLLECTION' | 'INVOICE_PAYMENT'
```

This removes hand-filtering from components. (Today the collect modal filters `allowed_for_pay_on_collection !== false` inline in the component — exactly the drift this prevents.)

An explicit method allowlist stays available as an **escape hatch** for special screens, not as the default.

---

## 5. Proposed config surface (sketch — not final)

```ts
interface TenderPanelConfig {
  // ---- WHAT CAN BE TENDERED ----
  context: TenderContext;                    // DB resolves the method set
  restrictToMethods?: PaymentMethodCode[];   // narrows only; never widens
  allowStoredValue?: boolean;                // wallet / advance / credit-note / loyalty
                                             // MUST be false for later collection:
                                             // collectPaymentTx throws
                                             // INVALID_PAYMENT_NATURE_FOR_COLLECTION

  // ---- HOW MANY LEGS ----
  legs:
    | { mode: 'single' }                     // no add/remove UI at all
    | { mode: 'multi';
        maxLegs?: number;
        maxPerMethod?: Partial<Record<PaymentMethodCode, number>>; };

  // ---- MONEY BEHAVIOUR ----
  amountDue: number;                          // caller-owned; the panel never prices
  allowOverTender?: 'never' | 'withIntent';   // gates the pay-extra toggle only;
                                              // per-method supports_overpayment /
                                              // supports_change_return still decide
                                              // feasibility
  captureTendered?: boolean;                  // cash tendered + change due
  prefill?: 'full' | 'zero' | 'remaining';

  // ---- CAPABILITY SURFACES ----
  // All default from method config. Caller may HIDE, never force-enable.
  cashDrawer?: 'auto' | 'hidden';
  terminal?: 'auto' | 'hidden';
  reference?: 'auto' | 'always';
  notes?: boolean;

  // ---- GOVERNANCE ----
  permissionCode: string;                     // e.g. orders:collect_payment vs orders:create

  // ---- PRESENTATION ----
  density?: 'pos' | 'compact';                // keypad + quick-tender vs plain fields
  readOnly?: boolean;                         // review an existing payment
  initialLegs?: TenderLeg[];                  // resume a partially-entered tender
}
```

### Derived rules (not caller-set)

- **Cash is one leg.** Rather than hardcoding `CASH`, default `maxPerMethod` to `1` for any method with `requires_cash_drawer` (one drawer session ⇒ one cash tender), unbounded otherwise. Callers may tighten, never loosen. This keeps the rule correct if a tenant configures a second cash-like method.
- Currency and decimal places come from tenant currency context, never from caller config.

### Events

- `onLegsChange` / dirty signal, so callers can block navigation mid-entry.

---

## 6. Design upgrade to make during extraction — leg identity

Today `PaymentLeg` keys on `method` (a method **code**). That is lossy: a tenant with two configured CARD rows collapses to one, and `optionByMethodKey` keys on `code::gateway_code`.

This is also precisely what makes the collect path ambiguous — collect's API takes `paymentMethodId` (config-row UUID) while submit takes `method` (code).

**Proposal:** the new tender core keys legs on **`orgPaymentMethodId`**, carrying `payment_method_code` alongside for display and policy. The identity mismatch then disappears: the panel emits legs carrying both, and each caller maps to its own payload shape.

**Open:** whether to migrate the existing `PaymentLeg` type or introduce a new `TenderLeg` and adapt at the new-order boundary.

---

## 7. Validation split

| Owner | Validates |
|---|---|
| Panel | *Tender shape* — leg sums vs `amountDue`, per-method requirements (`requires_reference`, `requires_terminal`), tendered ≥ leg amount, per-method leg caps |
| Caller | *Domain* — is this order still collectible, is the balance current, is the customer eligible |

---

## 8. Hard boundary — what the panel must NOT own

The panel emits a **tender intent**: legs + overpayment resolution + drawer/POS session refs.

It must not own: submit, the API contract, the idempotency key, voucher creation, or any order/receivable semantics.

Reasons this boundary is not negotiable:
- Collect is hard-gated to `PAY_ON_COLLECTION` ([order-settlement.service.ts:727](../../../../web-admin/lib/services/order-settlement.service.ts#L727)) and runs its **own overpayment engine**, which B04 deliberately kept rather than swapping to `buildSettlementPlan`'s parallel math, to guarantee financial parity. Unifying submit would re-open validated financial ground for no user benefit.
- Submit creates an order; collect settles an existing receivable. Different idempotency, different lifecycle, different permissions.

---

## 9. Known constraints to carry into any implementation

| Constraint | Source |
|---|---|
| Stored-value / credit legs are **rejected** for later collection | `INVALID_PAYMENT_NATURE_FOR_COLLECTION`, [order-settlement.service.ts:778-784](../../../../web-admin/lib/services/order-settlement.service.ts#L778-L784) |
| Cash-drawer binding is **per leg**; a multi-leg block must consider every cash leg | collect currently derives `cashDrawerRequired` from one `selectedMethod` |
| Overpayment math is **already N-leg capable** | `computeCollectionOverpaymentMetrics(outstanding, legs: CollectionLegInput[])`; `collectionLegIntroducesUnresolvedExcess` is per-leg sequenced. Only the modal's *wiring* is single-leg (`checkoutLegs`, `primaryCashLegRef`) |
| Shared components are **additive-only** | Anything under `src/features/orders/payment/**`, `hooks/use-payment-*`, `ui/payment-modal*` is co-owned with the highest-traffic money screen |
| `usePaymentCatalog` maps a non-ok response to an **empty option list** | [use-payment-catalog.ts:203](../../../../web-admin/src/features/orders/hooks/use-payment-catalog.ts#L203) — adopting its fetching as-is erases a caller's load-error/Retry surface |

---

## 10. Proposed sequencing (recommended, not approved)

Build it **for collect first**, then migrate new-order.

1. Extract the tender core + config contract; collect mounts it in `legs: { mode: 'single' }`. Parity gate: **byte-identical payload, voucher, and drawer movement** vs today.
2. Switch collect to `multi`; wire per-leg drawer binding and the (already N-leg) overpayment engine.
3. Migrate new-order behind its existing payment suites (630 tests across `__tests__/features/orders` + `__tests__/ui`).

Rationale: collect is lower-traffic, already open for work, and single-leg today — which makes step 1 a cheap, strong parity gate. Doing new-order first would put the highest-traffic money screen on unproven abstraction.

---

## 11. Open questions

| # | Question | Notes |
|---|---|---|
| Q1 | Does `INVOICE_PAYMENT` belong in this panel, or does the AR receipt flow stay separate? | Non-POC balances currently route to **Customers → Account Receipt**; ADR-PACK-008 keeps pay-on-collection distinct from AR |
| Q2 | Should the panel own the cash-drawer **session-opening** dialog, or only consume a bound session the caller supplies? | Today `useCashDrawer` is embedded in both modals and also used by the `features/cash-drawers` screens |
| Q3 | Migrate `PaymentLeg` to id-keyed, or introduce `TenderLeg` + adapter? | §6 |
| Q4 | Do any tenants actually have **two configured rows sharing method code + gateway**? | Determines how urgent §6 is. Check via remote DB MCP before deciding |
| Q5 | Is this its own work package, or a phase of an existing one? | It is a real financial-path change to money screens |
| Q6 | Does the panel own the pay-extra / overpayment resolution UI too, or does the caller compose it? | Collect and submit currently share those sub-components but resolve differently |

---

## 12. Not yet decided

- Component name and location (`src/ui/**` vs `src/features/orders/payment/**`). Note: if it reads orders RBAC or orders i18n it is feature UI, not a `Cmx` primitive — the same reasoning applied to `CollectPaymentButton`.
- Whether this supersedes the deferred split-tender item in the Collect Payment Enhancement, or ships alongside it.
- Effort sizing. None attempted here.

---

## 13. Related

- [`../Collect_Payment_Enhancement/STATUS.md`](../Collect_Payment_Enhancement/STATUS.md) — split tender deferred there; this discussion is the follow-on
- [`../ADR/ADR_payment_modal_single_engine_two_mode.md`](../ADR/ADR_payment_modal_single_engine_two_mode.md) — one engine, two modes
- [`../Payment_Modal_08_07_2026/`](../Payment_Modal_08_07_2026/) — composable payment system (capabilities, presets, registry)
- ADR-022 — partial later collection allowed by default
- ADR-PACK-008 — pay-on-collection is not AR
