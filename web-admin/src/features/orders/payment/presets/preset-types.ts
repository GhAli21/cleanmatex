/**
 * Payment preset descriptor types (L6 of the composable payment system).
 *
 * A preset is a **composition** — it declares how a view arranges the capability
 * layer, never new business logic. The registry (L3) still decides each
 * capability's availability/required/blocked/intrinsic-presentation from engine
 * facts; a preset only expresses, for *this* view, the layout and which
 * available capabilities surface inline vs behind a dialog button vs hidden.
 *
 * These are pure declarative types — no React, no money math. The Phase-4/5 view
 * renderer (L5) consumes them.
 *
 * See `docs/features/Order_Fin/Payment_Modal_08_07_2026/`.
 */

import type { PaymentCapabilityKey } from '../capabilities/capability-keys';
import type { CapabilityPresentation } from '../capabilities/registry';
import type { PaymentPresetKey } from './preset-keys';

/**
 * How a preset lays out the payment surface.
 * - `fast-lane`: the curated ~80% cash/card face (Simple).
 * - `workbench`: the full multi-capability workspace (Full).
 */
export type PresetLayout = 'fast-lane' | 'workbench';

/**
 * Inline method-chip policy for a preset — the metadata form of the legacy
 * `deriveSimpleModeMethodOptions` filter (hardening #5). The renderer applies
 * this instead of hardcoding a Simple-only filter, so method visibility is
 * preset-driven, not branched in the view.
 */
export interface PresetMethodChipPolicy {
  /**
   * When true, inline chips are restricted to Simple-safe tenders (cash +
   * card/gateway with no reference detail); everything else routes through the
   * complexity suggestion / More options. When false, all catalog methods show.
   */
  simpleSafeOnly: boolean;
  /**
   * Max inline method chips before overflow routes through More options.
   * `null` means no cap (workbench shows every method).
   */
  chipLimit: number | null;
}

/**
 * Declarative preset descriptor. Composition only.
 */
export interface PaymentPreset {
  key: PaymentPresetKey;
  /** i18n label root (namespace `newOrder`), resolved by the consuming UI. */
  messageKey: string;
  layout: PresetLayout;
  methodChips: PresetMethodChipPolicy;
  /**
   * View-composition presentation intent per capability. For an **available**
   * capability that is neither required nor blocked, the value overrides the
   * registry's intrinsic presentation for this view (e.g. Simple hides the
   * advanced-dialog launchers from the fast lane). An absent key means "use the
   * registry's intrinsic presentation". A preset can never resurrect an
   * unavailable capability, never hide a required gate, and never suppress a
   * blocked guard — {@link resolveViewPresentation} enforces all three.
   */
  capabilityPresentation: Partial<
    Record<PaymentCapabilityKey, CapabilityPresentation>
  >;
}
