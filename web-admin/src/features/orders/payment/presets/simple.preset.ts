/**
 * SIMPLE preset — the curated ~80% cash/card fast lane (L6).
 *
 * Composition, not logic: the fast lane shows Simple-safe method chips inline and
 * keeps the advanced-dialog launchers (split, gift card, promo, store credit,
 * pay-later) out of the inline lane — they remain reachable through the
 * complexity suggestion / More options, and any that becomes *required* or
 * *blocked* still surfaces (the resolver enforces that). The chip policy is the
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
    // Kept out of the inline fast lane; reachable via suggestion / More options.
    // These are hidden ONLY while neither required nor blocked — the resolver
    // re-surfaces a required gate (e.g. gift-card PIN) or a blocked guard.
    [PAYMENT_CAPABILITY.CASH_CARD_SPLIT]: 'hidden',
    [PAYMENT_CAPABILITY.SPLIT_TENDER]: 'hidden',
    [PAYMENT_CAPABILITY.GIFT_CARD]: 'hidden',
    [PAYMENT_CAPABILITY.PROMO_CODE]: 'hidden',
    [PAYMENT_CAPABILITY.CUSTOMER_CREDIT]: 'hidden',
    [PAYMENT_CAPABILITY.PAY_LATER]: 'hidden',
    // CASH / CARD / CASH_DRAWER / FX_ROUNDING / SUBMIT_GUARDS / B2B / overpayment
    // keep their registry-intrinsic presentation (inline lines, or dialogs that
    // only appear when the registry marks them required/active).
  },
};
