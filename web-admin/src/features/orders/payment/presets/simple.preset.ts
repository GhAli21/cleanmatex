/**
 * SIMPLE preset — the curated ~80% cash/card fast lane (L6).
 *
 * Composition, not logic: the fast lane shows Simple-safe method chips inline and
 * surfaces **all available** advanced capabilities as compact quick-action buttons
 * (registry `dialog` presentation) so the cashier can reach them without hunting
 * through Advanced. Individual capabilities can be hidden from the fast lane by
 * uncommenting their line in `capabilityPresentation` below (they stay reachable
 * via More options / Advanced). Any capability that becomes *required* or
 * *blocked* always surfaces (the resolver enforces that). The chip policy is the
 * metadata form of the legacy `deriveSimpleModeMethodOptions` filter (hardening
 * #5); {@link SIMPLE_MODE_METHOD_CHIP_LIMIT} stays the single source of the cap.
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
    // Fast-lane quick-action buttons. By DEFAULT every available advanced
    // capability shows as a button (only when the registry marks it available for
    // the session). To hide one from the Simple fast lane — still reachable via
    // More options / Advanced — UNCOMMENT its line below. Required/blocked
    // capabilities always re-surface regardless (the resolver enforces that).
    // CASH / CARD / CASH_DRAWER / FX_ROUNDING / SUBMIT_GUARDS are inline surfaces,
    // not buttons, so they are not listed here.
    //
    // [PAYMENT_CAPABILITY.SPLIT_TENDER]: 'hidden',
    // [PAYMENT_CAPABILITY.CASH_CARD_SPLIT]: 'hidden',      // redundant with SPLIT_TENDER
    // [PAYMENT_CAPABILITY.GIFT_CARD]: 'hidden',
    // [PAYMENT_CAPABILITY.PROMO_CODE]: 'hidden',
    // [PAYMENT_CAPABILITY.CUSTOMER_CREDIT]: 'hidden',
    // [PAYMENT_CAPABILITY.PAY_LATER]: 'hidden',
    // [PAYMENT_CAPABILITY.B2B_ACCOUNT_BILLING]: 'hidden',
    // [PAYMENT_CAPABILITY.OVERPAYMENT_ROUTING]: 'hidden',
  },
};
