/**
 * Payment view preset keys (L6 of the composable payment system).
 *
 * A preset is a *composition* of capabilities + layout — not duplicated business
 * logic. `SIMPLE` and `FULL` are the only presets built in this program. The
 * remaining members are **type scaffolding only** (not implemented this phase):
 * they exist so a future view is an additive preset descriptor, never a fork.
 *
 * See `docs/features/Order_Fin/Payment_Modal_08_07_2026/`.
 */

/**
 * Stable payment preset identifiers.
 *
 * `SIMPLE` / `FULL` are active. `SEMI_PRO` / `PRO` / `ACCOUNTANT` /
 * `B2B_COLLECTION` / `MOBILE_POS` are reserved for future views and are not
 * built or referenced by any active preset in this phase.
 */
export const PAYMENT_PRESET = {
  SIMPLE: 'SIMPLE',
  FULL: 'FULL',
  // Reserved — future views (type scaffolding only, not built this phase):
  SEMI_PRO: 'SEMI_PRO',
  PRO: 'PRO',
  ACCOUNTANT: 'ACCOUNTANT',
  B2B_COLLECTION: 'B2B_COLLECTION',
  MOBILE_POS: 'MOBILE_POS',
} as const;

/**
 * Union of all payment preset keys.
 */
export type PaymentPresetKey =
  (typeof PAYMENT_PRESET)[keyof typeof PAYMENT_PRESET];

/**
 * Presets that are actually implemented and selectable in this phase.
 */
export const ACTIVE_PAYMENT_PRESETS: PaymentPresetKey[] = [
  PAYMENT_PRESET.SIMPLE,
  PAYMENT_PRESET.FULL,
];
