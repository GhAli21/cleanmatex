# Payment Modal — Composable Capabilities: Feature Documentation

**Date:** 2026-07-10
**Status:** Functionally live on `feature/payment-modal-composable-capabilities` (pre-merge; kill-switch retained until QA sign-off)
**Authoritative refs:** [`Payment_Modal_Implementation_STATUS.md`](./Payment_Modal_Implementation_STATUS.md) (phase board) · [`Payment_Modal_Implementation_Plan.md`](./Payment_Modal_Implementation_Plan.md) (plan + handoff rules H1–H9) · [`../ADR/ADR_payment_modal_single_engine_two_mode.md`](../ADR/ADR_payment_modal_single_engine_two_mode.md) (amended 2026-07-08) · [`Deferred_Backend_Tasks.md`](./Deferred_Backend_Tasks.md)
**Manual QA guide:** [`Manual_QA_Checklist.md`](./Manual_QA_Checklist.md) (annotatable; executed on the Vercel preview)
**Sub-feature docs:** [`Pay_Extra_Top_Strip_QA_R4_5_Feature_Docs.md`](./Pay_Extra_Top_Strip_QA_R4_5_Feature_Docs.md)

## What it is

One headless payment engine with two user-controlled faces (Simple fast lane / Full workbench). Payment complications (split, gift card, promo, store credit, pay-later, B2B billing, overpayment routing, cash drawer, FX) are **capabilities**: classified by a pure registry from session facts, surfaced as in-place dialogs / inline lines / submit guards — never as a forced mode change. Server 422 rejections route back to the owning capability as an in-view guard with a one-click corrective action.

## Architecture (layer map)

| Layer | Module | Role |
|---|---|---|
| L1 engine | `hooks/use-payment-engine.ts` (+ slices) | All money math, state, payload — FROZEN contract, pinned by the payload oracle |
| L2 config | `payment/config/payment-modal-config.ts` | `resolvePaymentModalConfig()`; `PAYMENT_MODE_USER_CONTROLLED` kill-switch |
| L3 domain | `payment/domain/` (reasons, context, projector, server-error routing) + `payment/capabilities/registry.ts` | Pure classifier — no money math, no React |
| L4 surfaces | `payment/capabilities/{key}/` + `payment/primitives/` | Dialogs + shell + guard + suggestion + shared leg fields (RHF-free; typed `PaymentEngineActions` only) |
| L5 view | `payment/view/` (plan, renderer, method-chips, guard affordance) | Plan → 3 regions (inline / actions / guards); no capability knowledge |
| L6 presets | `payment/presets/` (SIMPLE / FULL) | Layout + chip policy + per-capability presentation intent; invariants: unavailable⇒hidden, blocked⇒surfaces, required⇒never hidden |

Module home: `web-admin/src/features/orders/payment/`. Container: `web-admin/src/features/orders/ui/payment-full-view.tsx`.

## Capabilities (13)

| Key | Presentation | Surface | Opened from |
|---|---|---|---|
| CASH / CARD | inline | method chips + amount editor + `PaymentLegDetailFields` | always in view |
| CASH_CARD_SPLIT | dialog | `SplitTenderDialog` (alias of SPLIT_TENDER) | quick-action · server guard |
| SPLIT_TENDER | dialog | `SplitTenderDialog` | quick-action · server guard |
| GIFT_CARD | dialog | `GiftCardDialog` (PIN inside — ADR #6) | quick-action · server guard |
| PROMO_CODE | dialog | `PromoCodeDialog` | quick-action · server guard |
| CUSTOMER_CREDIT | dialog | `CustomerCreditDialog` (wallet/advance/credit-note) | quick-action · server guard |
| PAY_LATER | dialog | `PayLaterDialog` (NONE / PAY_ON_COLLECTION / CREDIT_INVOICE) | quick-action · server guard |
| B2B_ACCOUNT_BILLING | dialog (required gate — ADR #3) | `B2BAccountBillingDialog` | quick-action · server guard *(in-place since 2026-07-10)* |
| CASH_DRAWER | inline (required prompt when ambiguous) | drawer section + `CashDrawerSelectDialog` | inline · server guard |
| OVERPAYMENT_ROUTING | dialog (required — ADR #5) | `OverpaymentRoutingDialog` (adapter over `PaymentExtraReceiptDialog`) | quick-action · pay-extra strip · server guard |
| FX_ROUNDING | inline (read-only — ADR #9) | `FxRoundingLine` | Full rail (non-base currency only) |
| SUBMIT_GUARDS | guard aggregate | `PaymentSubmitGuard` (per-leg reference/terminal/check rules) | footer (message-only) |

Every dialog capability opens **in-place** — the Advanced fallback in `onOpenCapability` is dead-code defense only.

## Permissions (all pre-existing; none added by this program)

| Code | UI use | Server enforcement |
|---|---|---|
| `orders:create` | — | submit-order route `requirePermission` + CSRF + idempotency |
| `orders:apply_credit` | shows/enables the customer-credit surface (`canApplyCustomerCredit`) | re-checked server-side |
| `orders:overpayment_allocate` (+ disposition codes) | pay-extra toggle ON + allocate destinations (QA-R4.5) | orchestrator re-validates resolution |
| `orders:override_credit_limit` | **not wired** — credit override is hard-denied (Phase 0B); gated re-enable is a HIGH-PRIORITY deferred task | `assertCreditWithinPolicy` takes no override input |

Access contracts unchanged except QA-R4.5's `payExtraIntentEnable` action (already documented in its own doc).

## Feature flags / kill-switches

| Flag | Kind | State |
|---|---|---|
| `PAYMENT_MODE_USER_CONTROLLED` | code constant (L2 config) | `true` = amended-ADR behavior (no auto-escalation, Simple never locked). Flip to `false` for legacy auto-escalate rollback. **Removal after QA sign-off** — tracked in `Deferred_Backend_Tasks.md` |
| `NEW_ORDER_PROMO_GIFT_DISABLED` | code kill-flag | folded into `giftCardSupported`/`promoSupported` by the projector — gift/promo capability fully hidden when set (engine handlers also early-return: defense in depth) |

No DB feature flags, tenant settings, or plan limits are read or added.

## i18n (EN + AR, `check:i18n` green)

| Namespace (`newOrder.payment.*`) | Keys | Notes |
|---|---|---|
| `capabilities.<KEY>.{title,action,description}` | all 10 dialog/inline capabilities + `dialog.{errorFallback,required}` + `FX_ROUNDING.{exchangeRate,rounding}` | quick-action labels, dialog chrome, guard action labels |
| `mode.*` | `simple/advanced/toggleLabel`, `suggest{Title,Action,Dismiss}`, `simpleView.*` (incl. `quickActionsTitle`, `advancedLegActiveTitle`, `advancedLegActiveHint`), `reasons.<NEEDS_ADVANCED_REASON>` | suggestion + Simple face |
| `payExtraIntent.*` | QA-R4.5 set | see its doc |
| `errors.*` | `b2bCreditHold`, `b2bCreditExceeded`, `splitAmountMismatch`, `deferredLegNotAlone`, `paymentReferenceRequired`, `paymentTerminalRequired`, `outstandingPolicyRequired` | server 422 toast + guard message (same string, never diverge) |
| `reasons.<code>` | **PENDING** — lands with the guards-region strangler migration (`reasonMessageKey` has no consumer yet; adding keys now would be dead i18n) | last open Phase-6 item |

Dialog bodies reuse their legacy namespaces (`splitPayment.*`, `giftCard.*`, `promoCode.*`, `customerCredits.*`, `b2b.*`, `cashDrawer.*`, `rightRail.*`, `remainder.*`, `validatePayment.*`).

## APIs / DB

- **No new endpoints, no migrations, no navigation, no env vars.**
- Consumed as-is: `POST /api/v1/orders/submit-order` (422 error codes → `routeServerErrorToGuard` → in-view guard; unknown codes stay toast-only), `GET /api/v1/b2b-contracts?customer_id=` (via shared `use-b2b-contracts.ts` — tenant resolved server-side from session).
- **One backend change in the whole program (Phase 0B):** B2B credit-limit exceedance hard-denied in the orchestrator; the client `creditLimitOverride` payload field is inert (schema frozen).

## Trust model

All capability gating is UX-only. The server re-validates everything on submit: totals recompute, split-sum equality, deferred-leg isolation, outstanding policy, drawer session, overpayment resolution, per-leg reference/terminal/check rules, credit limits (hard). A crafted client gains nothing from bypassing the UI.

## Tests (gate state 2026-07-10)

- Payment module: **32 suites / 274 tests** — registry, projector, presets, plan, renderer, method-chips parity, every capability dialog, suggestion, server-error routing, guard affordance, config, facade.
- **Payload oracle: 10 fixtures / 21 assertions** — 8 live-recorded baselines + 2 hand-authored H7 fixtures (`customer-credit`, `drawer-choice`), each round-tripped through `buildPaymentPayload` **and** validated against `newOrderPaymentPayloadSchema`.
- Related: `overpayment-policy.test.ts`, `attempt-pay-extra-intent-change.test.ts`, `credit-limit-hard-deny.test.ts` (structural inertness).
- Run: `npm test -- __tests__/features/orders/payment` (NOT `npx jest` — SWC transform note in STATUS).

## Rollout / risks

- Kill-switch rollback path: flip `PAYMENT_MODE_USER_CONTROLLED = false` → legacy auto-escalate-and-lock returns (retained until QA sign-off, then removed).
- Manual QA in progress (§1 mode-reversal: all pass). Remaining sections gate the merge.
- Branch carries foreign pos-sessions/cash-drawer commits → re-run `/security-review` on a cleaned branch before merge (first review: no HIGH/MED).
- `b2bRequiredFieldsMissing` is `false` by design today: the server defines no required-B2B-field rule (contract/cost-center/PO are optional, persisted verbatim). If a tenant policy ever requires them, wire the fact in the projector — the required-gate UI (badge + guard) already exists.

## Simple↔Advanced active-leg binding (2026-07-11)

One engine, two faces — state survives mode switches (ADR). The Simple face must **not** bind its amount/detail editor to an Advanced-only or off-chip active leg (e.g. Stripe behind the chip cap):

| Rule | Implementation |
|---|---|
| Retarget on Simple | `resolveSimpleFaceActiveLegIndex` — index only; never rewrite amounts |
| Simple editor binding | `simpleFaceActiveLeg` gates amount, draft, details, cap hint, quick-tender, keypad |
| Chip / method highlight | Primary = **active** match (`method::gateway`); secondary slate = leg exists |
| Split dialog options | `toSettlementOptionKey` — never look up by `payment_method_code` alone |
| Manual QA | [`Manual_QA_Checklist.md`](./Manual_QA_Checklist.md) §7 |

## Developer entry points

| Concern | Path (under `web-admin/src/features/orders/`) |
|---|---|
| Registry / reasons / projector | `payment/domain/*`, `payment/capabilities/registry.ts` |
| Dialogs + primitives | `payment/capabilities/{key}/`, `payment/primitives/` |
| View plan / renderer / guard affordance | `payment/view/*` |
| Presets | `payment/presets/*` |
| Simple-face helpers | `ui/payment-modal-v4.utils.ts` (`isLegOnSimpleFace`, `resolveSimpleFaceActiveLegIndex`, `toSettlementOptionKey`) |
| Container wiring | `ui/payment-full-view.tsx` (quick-actions `onOpenCapability`, dialog mounts, server-guard footer, Simple retarget) |
| Server-guard state | `hooks/use-order-submission.ts` (`serverGuard`, `routeServerErrorToGuard`) |
| B2B contracts | `hooks/use-b2b-contracts.ts` |
| Payload oracle | `web-admin/__tests__/features/orders/payment-payload-fixtures/` |
