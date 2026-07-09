/**
 * Payment capabilities barrel — the single import site for the L3/L4 capability
 * layer (keys, pure registry classifier, the key→component wiring, and every
 * capability component + its prop/actions types).
 *
 * The Phase-4/5 view renderer imports capabilities from here so the composition
 * layer depends on one stable surface rather than reaching into each capability
 * folder.
 *
 * See `docs/features/Order_Fin/Payment_Modal_08_07_2026/`.
 */

// Keys + pure classifier.
export * from './capability-keys';
export * from './registry';

// Key → component wiring.
export * from './capability-components';

// Capability components + their prop/actions types.
export * from './split-tender/split-tender-dialog';
export * from './cash-drawer/cash-drawer-select-dialog';
export * from './gift-card/gift-card-dialog';
export * from './promo-code/promo-code-dialog';
export * from './customer-credit/customer-credit-dialog';
export * from './b2b-account-billing/b2b-account-billing-dialog';
export * from './overpayment-routing/overpayment-routing-dialog';
export * from './pay-later/pay-later-dialog';
export * from './fx-rounding/fx-rounding-line';
