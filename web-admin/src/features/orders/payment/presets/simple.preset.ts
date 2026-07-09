/**
 * SIMPLE preset — the curated ~80% cash/card fast lane (L6).
 *
 * Composition, not logic: the fast lane shows Simple-safe method chips inline and
 * surfaces the **common** advanced capabilities (split, gift card, store credit,
 * pay-later) as compact quick-action buttons (registry `dialog` presentation) so
 * the cashier can reach them without hunting through Advanced. The niche
 * launchers (the cash+card split shortcut, promo code) stay out of the fast lane
 * and are reached via More options / Advanced. Any capability that becomes
 * *required* or *blocked* always surfaces (the resolver enforces that). The chip
 * policy is the metadata form of the legacy `deriveSimpleModeMethodOptions`
 * filter (hardening #5); {@link SIMPLE_MODE_METHOD_CHIP_LIMIT} stays the single
 * source of the cap.
 *
 * See `docs/features/Order_Fin/Payment_Modal_08_07_2026/`.
 */

import { PAYMENT_CAPABILITY } from '../capabilities/capability-keys';
import { SIMPLE_MODE_METHOD_CHIP_LIMIT } from '../../ui/payment-modal-v4.utils';
import { PAYMENT_PRESET } from './preset-keys';
import type { PaymentPreset } from './preset-types';

/**
 * The SIMPLE view preset.
 */
export const SIMPLE_PRESET: PaymentPreset = {
  key: PAYMENT_PRESET.SIMPLE,
  messageKey: 'payment.presets.SIMPLE',
  layout: 'fast-lane',
  methodChips: {
    simpleSafeOnly: true,
    chipLimit: SIMPLE_MODE_METHOD_CHIP_LIMIT,
  },
  capabilityPresentation: {
    // Niche launchers kept out of the fast lane (reached via More options /
    // Advanced). Hidden ONLY while neither required nor blocked — the resolver
    // re-surfaces a required gate or a blocked guard.
    [PAYMENT_CAPABILITY.CASH_CARD_SPLIT]: 'hidden', // redundant with SPLIT_TENDER
    [PAYMENT_CAPABILITY.PROMO_CODE]: 'hidden', // less common on the fast lane
    // SPLIT_TENDER / GIFT_CARD / CUSTOMER_CREDIT / PAY_LATER intentionally OMITTED
    // → they fall back to the registry's `dialog` presentation and render as
    // Simple quick-action buttons (only when available). CASH / CARD / CASH_DRAWER
    // / FX_ROUNDING / SUBMIT_GUARDS / B2B / overpayment keep their registry
    // presentation (inline lines, or dialogs that appear when required/active).
  },
};
