/**
 * Commercial calculator — pure, domain-agnostic domain layer (ADR-060 §1).
 * No I/O, no Prisma, no Supabase, no i18n (enforced by ESLint for this folder).
 * P4-01 primitives: decimal money, rounding, largest-remainder allocation.
 * P4-02 resolvers: standard price, speed premium.
 * P4-03 line pricing (modifiers, override, line discounts, minimum price) and order discounts.
 * P4-04 tax per row (profiles, category, exemption, inclusive extraction, LINE/DOCUMENT rounding).
 * P4-05 item/piece levels (money_basis, PIECE fallback) and ready-by.
 * P4-06 invariant checker I1–I6 on a whole calculated order.
 * P5-01 one whole order through every step (`calculateCommercialOrder`).
 */
export * from './money';
export * from './rounding';
export * from './allocation';
export * from './standard-price';
export * from './speed';
export * from './errors';
export * from './adjustments';
export * from './line-pricing';
export * from './document-adjustments';
export * from './tax';
export * from './levels';
export * from './ready-by';
export * from './invariants';
export * from './commercial-order';
