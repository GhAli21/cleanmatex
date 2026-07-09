/**
 * Preset resolution + view-presentation merge (L6 → L5 boundary).
 *
 * `resolvePreset` maps a preset key to its descriptor (falling back to FULL for a
 * reserved/not-yet-built key so a config mistake degrades safely instead of
 * crashing the modal). `resolveViewPresentation` is the single pure function the
 * L5 renderer uses to decide how one capability surfaces in the active view — it
 * merges the registry's evaluated state with the preset's composition intent and
 * enforces the three invariants:
 *
 *   1. Unavailable ⇒ always `hidden` (a preset can never resurrect it).
 *   2. Blocked ⇒ always surfaces in place as its intrinsic guard (a preset can
 *      never suppress a blocked guard — switching views can't unblock it).
 *   3. Required ⇒ never `hidden` (a required gate must be resolvable; a preset
 *      may re-slot it inline/dialog but not hide it).
 *
 * Pure — no React, no money math.
 *
 * See `docs/features/Order_Fin/Payment_Modal_08_07_2026/`.
 */

import type { CapabilityPresentation, EvaluatedCapability } from '../capabilities/registry';
import { PAYMENT_PRESET, type PaymentPresetKey } from './preset-keys';
import type { PaymentPreset } from './preset-types';
import { SIMPLE_PRESET } from './simple.preset';
import { FULL_PRESET } from './full.preset';

/**
 * Built preset descriptors, keyed. Reserved keys (SEMI_PRO/PRO/…) are absent —
 * they are type scaffolding only this phase.
 */
const PRESET_BY_KEY: Partial<Record<PaymentPresetKey, PaymentPreset>> = {
  [PAYMENT_PRESET.SIMPLE]: SIMPLE_PRESET,
  [PAYMENT_PRESET.FULL]: FULL_PRESET,
};

/**
 * Resolves a preset key to its descriptor. A reserved/not-yet-built key falls
 * back to FULL (the safe superset) rather than throwing, so a config mistake
 * never crashes the payment modal.
 *
 * @param key - The requested preset key.
 * @returns The built preset descriptor (FULL if the key is not built).
 */
export function resolvePreset(key: PaymentPresetKey): PaymentPreset {
  return PRESET_BY_KEY[key] ?? FULL_PRESET;
}

/**
 * Decides how one capability surfaces in the active view by merging its
 * registry-evaluated state with the preset's composition intent. Enforces the
 * unavailable/blocked/required invariants (see file header).
 *
 * @param evaluated - The capability's registry-evaluated state (already config-resolved).
 * @param preset - The active view preset.
 * @returns The final presentation for this capability in this view.
 */
export function resolveViewPresentation(
  evaluated: EvaluatedCapability,
  preset: PaymentPreset,
): CapabilityPresentation {
  // (1) Unavailable is always hidden — a preset cannot resurrect it.
  if (!evaluated.available) return 'hidden';

  // (2) A blocked guard always surfaces in place with its intrinsic presentation.
  if (evaluated.blocked) return evaluated.presentation;

  const override = preset.capabilityPresentation[evaluated.key];

  // (3) A required gate may be re-slotted but never hidden by a preset.
  if (evaluated.required) {
    return override && override !== 'hidden' ? override : evaluated.presentation;
  }

  // Otherwise the preset's intent wins, else the registry's intrinsic rule.
  return override ?? evaluated.presentation;
}
