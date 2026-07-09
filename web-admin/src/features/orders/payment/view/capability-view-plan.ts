/**
 * Capability view plan (L5, pure core of the view renderer).
 *
 * Given the registry-evaluated capabilities and the active preset, this produces
 * the ordered list of capabilities that actually surface in the view — each
 * tagged `inline` or `dialog` — with the hidden ones filtered out. It is the pure,
 * React-free heart of the L5 renderer: the React component (added next) walks a
 * {@link CapabilityViewPlan} and mounts each slot's real surface with
 * container-threaded props, but the *decision* of what shows and how lives here so
 * it can be unit-tested without React.
 *
 * No money math, no validation, no payload — it only reads registry facts and the
 * preset's composition intent via {@link resolveViewPresentation}.
 *
 * See `docs/features/Order_Fin/Payment_Modal_08_07_2026/`.
 */

import type { PaymentCapabilityKey } from '../capabilities/capability-keys';
import type { EvaluatedCapability } from '../capabilities/registry';
import type { PaymentPreset } from '../presets/preset-types';
import { resolveViewPresentation } from '../presets/presets';

/**
 * Presentation of a capability that is actually shown (hidden is filtered out of
 * the plan, so it can never appear here).
 */
export type VisiblePresentation = 'inline' | 'dialog';

/**
 * One capability's place in the active view.
 */
export interface CapabilityViewSlot {
  key: PaymentCapabilityKey;
  presentation: VisiblePresentation;
  /** The full registry-evaluated state (required/blocked/reasons/messageKeys). */
  evaluated: EvaluatedCapability;
}

/**
 * The ordered set of capabilities the active view surfaces, in registry order.
 */
export type CapabilityViewPlan = CapabilityViewSlot[];

/**
 * Builds the view plan: maps each evaluated capability through the preset's
 * presentation merge and drops the hidden ones, preserving registry order.
 *
 * @param capabilities - All registry-evaluated capabilities (registry order).
 * @param preset - The active view preset.
 * @returns The capabilities that surface, each tagged inline or dialog.
 */
export function planCapabilityView(
  capabilities: EvaluatedCapability[],
  preset: PaymentPreset,
): CapabilityViewPlan {
  const plan: CapabilityViewPlan = [];
  for (const evaluated of capabilities) {
    const presentation = resolveViewPresentation(evaluated, preset);
    if (presentation === 'hidden') continue;
    plan.push({ key: evaluated.key, presentation, evaluated });
  }
  return plan;
}

/**
 * Slots the view renders inline (method chips, FX line, drawer line, guards).
 *
 * @param plan - A view plan.
 * @returns The inline slots, in plan order.
 */
export function selectInlineSlots(plan: CapabilityViewPlan): CapabilityViewSlot[] {
  return plan.filter((slot) => slot.presentation === 'inline');
}

/**
 * Slots the view renders as a dialog-opener button.
 *
 * @param plan - A view plan.
 * @returns The dialog slots, in plan order.
 */
export function selectDialogSlots(plan: CapabilityViewPlan): CapabilityViewSlot[] {
  return plan.filter((slot) => slot.presentation === 'dialog');
}

/**
 * Slots that currently block submit (drive the submit-guard surface). Includes
 * both inline and dialog presentations — a blocked capability surfaces wherever
 * it sits.
 *
 * @param plan - A view plan.
 * @returns The blocked slots, in plan order.
 */
export function selectBlockedSlots(plan: CapabilityViewPlan): CapabilityViewSlot[] {
  return plan.filter((slot) => slot.evaluated.blocked);
}

/**
 * Blocked slots reduced to the ones the submit-guard surface should render: one
 * per distinct block reason, first occurrence in registry order winning. This
 * dedups the deliberate overlap in the registry — a specific capability (e.g.
 * `CASH_DRAWER`) and the aggregate `SUBMIT_GUARDS` both report the same reason
 * for a closed drawer, and the cashier must see that guard exactly once. Slots
 * blocked without a reason code are skipped (defensive: blocked always carries a
 * reason by contract).
 *
 * @param plan - A view plan.
 * @returns One blocked slot per distinct reason, in plan order.
 */
export function selectGuardSlots(plan: CapabilityViewPlan): CapabilityViewSlot[] {
  const seen = new Set<string>();
  const guards: CapabilityViewSlot[] = [];
  for (const slot of plan) {
    if (!slot.evaluated.blocked) continue;
    const reason = slot.evaluated.blockReason;
    if (!reason || seen.has(reason)) continue;
    seen.add(reason);
    guards.push(slot);
  }
  return guards;
}

/**
 * Slots with an unresolved required gate (must be resolved before submit).
 *
 * @param plan - A view plan.
 * @returns The required slots, in plan order.
 */
export function selectRequiredSlots(plan: CapabilityViewPlan): CapabilityViewSlot[] {
  return plan.filter((slot) => slot.evaluated.required);
}
