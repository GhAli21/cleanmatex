/**
 * Payment presets barrel (L6) — keys, descriptor types, the built SIMPLE/FULL
 * descriptors, and the preset/view-presentation resolvers. The Phase-4/5 view
 * renderer imports the preset layer from here.
 *
 * See `docs/features/Order_Fin/Payment_Modal_08_07_2026/`.
 */

export * from './preset-keys';
export * from './preset-types';
export * from './simple.preset';
export * from './full.preset';
export * from './presets';
