/**
 * FULL preset — the multi-capability workbench (L6).
 *
 * Composition, not logic: the workbench shows every catalog method inline (no
 * Simple-safe filter, no chip cap) and lets each capability keep its
 * registry-intrinsic presentation (dialog launchers appear per the registry's
 * availability rules). It adds no capability overrides — FULL is the safe
 * superset view, which is also why {@link resolvePreset} falls back to it for a
 * not-yet-built reserved preset.
 *
 * See `docs/features/Order_Fin/Payment_Modal_08_07_2026/`.
 */

import { PAYMENT_PRESET } from './preset-keys';
import type { PaymentPreset } from './preset-types';

/**
 * The FULL view preset.
 */
export const FULL_PRESET: PaymentPreset = {
  key: PAYMENT_PRESET.FULL,
  messageKey: 'payment.presets.FULL',
  layout: 'workbench',
  methodChips: {
    simpleSafeOnly: false,
    chipLimit: null,
  },
  capabilityPresentation: {},
};
