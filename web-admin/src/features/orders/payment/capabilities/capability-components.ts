/**
 * Capability → component wiring (L4 presentation binding).
 *
 * The registry (`registry.ts`) is a pure classifier and must stay React-free, so
 * the binding from a {@link PaymentCapabilityKey} to the React component that
 * renders its focused surface lives here instead. The Phase-4/5 view renderer
 * iterates `evaluateCapabilities(ctx, config)` and, for a capability that has a
 * dedicated surface, looks it up in {@link CAPABILITY_COMPONENTS} and mounts it
 * with engine-derived props it composes at that point.
 *
 * Each entry keeps its **precise component type** (via `as const` + `typeof`) —
 * these dialogs have heterogeneous props by design (each reflects its own engine
 * slice), so there is deliberately no uniform prop contract here. Callers access
 * a key directly (e.g. `CAPABILITY_COMPONENTS.GIFT_CARD`) and get full types.
 *
 * Capabilities with NO dedicated component are intentionally absent:
 * - `CASH` / `CARD` — inline method chips rendered directly by the view.
 * - `SUBMIT_GUARDS` — the aggregate submit-guard banner (a view concern).
 * Note `CASH_DRAWER` DOES have a component (the pick-one selection prompt) even
 * though the registry presents its *status* inline; the two are complementary.
 *
 * See `docs/features/Order_Fin/Payment_Modal_08_07_2026/`.
 */

import { PAYMENT_CAPABILITY, type PaymentCapabilityKey } from './capability-keys';
import { SplitTenderDialog } from './split-tender/split-tender-dialog';
import { CashDrawerSelectDialog } from './cash-drawer/cash-drawer-select-dialog';
import { GiftCardDialog } from './gift-card/gift-card-dialog';
import { PromoCodeDialog } from './promo-code/promo-code-dialog';
import { CustomerCreditDialog } from './customer-credit/customer-credit-dialog';
import { B2BAccountBillingDialog } from './b2b-account-billing/b2b-account-billing-dialog';
import { OverpaymentRoutingDialog } from './overpayment-routing/overpayment-routing-dialog';
import { PayLaterDialog } from './pay-later/pay-later-dialog';
import { FxRoundingLine } from './fx-rounding/fx-rounding-line';

/**
 * Every capability key that renders through a dedicated component, mapped to it.
 * `CASH_CARD_SPLIT` and `SPLIT_TENDER` both surface the split-tender dialog.
 */
export const CAPABILITY_COMPONENTS = {
  [PAYMENT_CAPABILITY.CASH_CARD_SPLIT]: SplitTenderDialog,
  [PAYMENT_CAPABILITY.SPLIT_TENDER]: SplitTenderDialog,
  [PAYMENT_CAPABILITY.GIFT_CARD]: GiftCardDialog,
  [PAYMENT_CAPABILITY.PROMO_CODE]: PromoCodeDialog,
  [PAYMENT_CAPABILITY.CUSTOMER_CREDIT]: CustomerCreditDialog,
  [PAYMENT_CAPABILITY.B2B_ACCOUNT_BILLING]: B2BAccountBillingDialog,
  [PAYMENT_CAPABILITY.CASH_DRAWER]: CashDrawerSelectDialog,
  [PAYMENT_CAPABILITY.OVERPAYMENT_ROUTING]: OverpaymentRoutingDialog,
  [PAYMENT_CAPABILITY.PAY_LATER]: PayLaterDialog,
  [PAYMENT_CAPABILITY.FX_ROUNDING]: FxRoundingLine,
} as const;

/**
 * Keys that have a dedicated capability component (subset of all keys).
 */
export type CapabilityComponentKey = keyof typeof CAPABILITY_COMPONENTS;

/**
 * Type guard: does this capability render through a dedicated component?
 * Narrows the key so `CAPABILITY_COMPONENTS[key]` is well-typed at the call site.
 *
 * @param key - Any capability key.
 * @returns True when a dedicated component exists for the key.
 */
export function hasCapabilityComponent(
  key: PaymentCapabilityKey,
): key is CapabilityComponentKey {
  return key in CAPABILITY_COMPONENTS;
}
