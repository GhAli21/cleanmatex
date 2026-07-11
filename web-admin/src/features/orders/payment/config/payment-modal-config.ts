/**
 * Payment modal config boundary (L2 of the composable payment system).
 *
 * This is the isolated, mockable seam between the payment views and *where the
 * effective configuration comes from*. In this phase it returns code defaults
 * only (`DEFAULT_PAYMENT_MODAL_CONFIG`). Later, the body of
 * {@link resolvePaymentModalConfig} can be swapped to merge — in precedence
 * order — sys_* payment catalogs, HQ grants, paid add-ons, plan entitlements,
 * feature flags, tenant overrides, branch overrides, and role/user preferences,
 * **without changing any caller** (callers depend only on the returned shape).
 *
 * NOTE: this is distinct from `lib/services/payment-config.service.ts`, which
 * configures payment *methods* (the DB-backed method catalog). This config is
 * about the *modal experience* (mode + presets + capability visibility).
 *
 * See `docs/features/Order_Fin/ADR/ADR_payment_modal_single_engine_two_mode.md`
 * and `docs/features/Order_Fin/Payment_Modal_08_07_2026/`.
 */

import type { PaymentCapabilityKey } from '../capabilities/capability-keys';
import {
  ACTIVE_PAYMENT_PRESETS,
  PAYMENT_PRESET,
  type PaymentPresetKey,
} from '../presets/preset-keys';

/**
 * Presentation override for a single capability, resolved by config.
 * `undefined` (the default) means "use the capability's own rule".
 */
export type PaymentCapabilityPresentationOverride =
  | 'hidden'
  | 'inline'
  | 'dialog';

/**
 * The effective, resolved configuration that drives one payment modal session.
 * Capability *availability* is still decided by the registry from engine facts;
 * this config only enables presets and applies coarse per-capability overrides.
 */
export interface PaymentModalConfig {
  /** Presets available in this deployment. */
  presets: PaymentPresetKey[];
  /** Preset the modal opens in. */
  defaultPreset: PaymentPresetKey;
  /**
   * Coarse per-capability presentation overrides. Empty by default — capability
   * rules decide. Future config sources populate this.
   */
  capabilityOverrides: Partial<
    Record<PaymentCapabilityKey, PaymentCapabilityPresentationOverride>
  >;
}

/**
 * Context passed to {@link resolvePaymentModalConfig}. Deliberately minimal and
 * side-effect-free so the resolver stays mockable. Fields are optional so tests
 * and the current code-defaults path can call it with nothing.
 */
export interface PaymentModalConfigContext {
  tenantOrgId?: string;
  branchId?: string;
  /** Role keys of the current user, for future role-based presets. */
  roleKeys?: string[];
}

/**
 * Code-default configuration (this phase's single source of config truth).
 * Opens in Simple, both active presets available, no capability overrides.
 * The cashier always controls Simple/Full (amended ADR) — the modal never
 * auto-escalates or locks Simple.
 */
export const DEFAULT_PAYMENT_MODAL_CONFIG: PaymentModalConfig = {
  presets: ACTIVE_PAYMENT_PRESETS,
  defaultPreset: PAYMENT_PRESET.SIMPLE,
  capabilityOverrides: {},
};

/**
 * Resolves the effective payment modal config for a context.
 *
 * This phase returns code defaults only. The boundary exists so the resolution
 * source can later change (DB/API/plan/flags/overrides) with no caller change.
 *
 * @param _context - Resolution context (unused while code-defaults only).
 * @returns The effective {@link PaymentModalConfig}.
 */
export function resolvePaymentModalConfig(
  _context: PaymentModalConfigContext = {},
): PaymentModalConfig {
  return DEFAULT_PAYMENT_MODAL_CONFIG;
}
