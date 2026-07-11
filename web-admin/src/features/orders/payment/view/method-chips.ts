/**
 * Preset-driven method-chip derivation (L5/L6 — hardening #5).
 *
 * Re-expresses the Simple-face method filter as **preset metadata** rather than a
 * hardcoded call: the view asks a preset's {@link PresetMethodChipPolicy} which
 * inline method chips to show. This keeps method visibility preset-driven (a
 * future view is an additive descriptor) instead of branching in the view.
 *
 * It does NOT re-implement the Simple-safe rule — for `simpleSafeOnly` it reuses
 * the single-source {@link deriveSimpleModeMethodOptions} (Simple-safe codes,
 * cash-first, capped), so there is no drift. Pure — no React, no money math.
 *
 * See `docs/features/Order_Fin/Payment_Modal_08_07_2026/`.
 */

import {
  deriveSimpleModeMethodOptions,
  type SimpleModeMethodOptionLike,
} from '../../ui/payment-modal-v4.utils';
import type { PresetMethodChipPolicy } from '../presets/preset-types';

/**
 * Applies a preset's method-chip policy to the catalog options.
 *
 * - `simpleSafeOnly` → the Simple-safe set (via `deriveSimpleModeMethodOptions`);
 *   a tighter `chipLimit` is applied on top, a looser/absent one is a no-op since
 *   the deriver already caps at `SIMPLE_MODE_METHOD_CHIP_LIMIT`.
 * - otherwise (workbench) → all options in catalog order, capped only if the
 *   policy sets a `chipLimit`.
 *
 * @param options - Catalog settlement options (already tenant/branch filtered).
 * @param policy - The active preset's method-chip policy.
 * @returns The method chips to render inline, in the policy's order.
 */
export function applyMethodChipPolicy<T extends SimpleModeMethodOptionLike>(
  options: T[],
  policy: PresetMethodChipPolicy,
): T[] {
  if (!policy.simpleSafeOnly) {
    return policy.chipLimit == null ? options : options.slice(0, policy.chipLimit);
  }
  const safe = deriveSimpleModeMethodOptions(options);
  return policy.chipLimit == null ? safe : safe.slice(0, policy.chipLimit);
}
