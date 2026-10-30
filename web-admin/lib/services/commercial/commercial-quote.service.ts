/**
 * Commercial quote service (ADR-060 §1, §9; PLAN.md §4.1, P5-01).
 *
 * Why: the New Order cart, Edit Preview and Create must show and store the
 * same figures. This is the one read-only path: loader → calculator, no
 * write. Create calls the same steps inside its transaction and hands the
 * result to the writer.
 *
 * Order discounts: discount rules and promotions are still evaluated by
 * `discount-service` (PLAN.md §8.6). Each needs the base left after the ones
 * before it (manual → rule → promo), so the resolver gets the lines' net and
 * `netAfter`, which runs the pure calculator with a trial set of discounts.
 * The order is then calculated once more with the resolved discounts.
 */
import 'server-only';

import { calculateCommercialOrder, type AdjustmentInput, type CommercialOrderResult, type Money, type RoundingRule } from '@/lib/commercial';
import {
  buildCommercialOrderInput,
  loadCommercialFacts,
  type CommercialDb,
  type CommercialFacts,
  type CommercialLoaderDeps,
  type CommercialOrderIntent,
  type ResolvedLinePrice,
} from './commercial-context.loader';

/** What a resolver can read about the priced lines. */
export interface OrderAdjustmentContext {
  /** Σ line net after line discounts, before any order discount. */
  linesNet: Money;
  /** The lines' net after the given order discounts (no write, pure calculator). */
  netAfter: (adjustments: readonly AdjustmentInput[]) => Money;
  /** The order's currency rounding; a resolved amount must be at its decimals. */
  rounding: RoundingRule;
}

/**
 * Resolves the order discounts once the lines are priced.
 * @returns the ORDER adjustments in the order they apply (manual → rule → promo)
 */
export type OrderAdjustmentResolver = (context: OrderAdjustmentContext) => Promise<readonly AdjustmentInput[]>;

/** A quote: the calculated order, the resolved line prices and the facts used. */
export interface CommercialQuote {
  result: CommercialOrderResult;
  prices: ResolvedLinePrice[];
  facts: CommercialFacts;
  /** The order discounts that were applied (the intent's, or the resolver's). */
  orderAdjustments: readonly AdjustmentInput[];
}

/**
 * Quotes an order from intents without writing anything.
 * @param db the Prisma client, or the caller's transaction client (Create)
 * @param tenantOrgId the session tenant, resolved server-side by the caller
 * @param intent the client's order intents
 * @param deps the tenant currency and the VAT-rate fallback
 * @param resolveOrderAdjustments optional: evaluates manual, rule and promo discounts on the priced lines; replaces `intent.orderAdjustments`
 * @returns the calculated order, with I1–I6 already checked
 * @throws CommercialContextError, CommercialRuleError (both map to 4xx in the route)
 * @example
 * const quote = await quoteCommercialOrder(prisma, tenantOrgId, intent, { currency, getTenantVatRate });
 * quote.result.totals.totalAmount.toString();
 */
export async function quoteCommercialOrder(
  db: CommercialDb,
  tenantOrgId: string,
  intent: CommercialOrderIntent,
  deps: CommercialLoaderDeps,
  resolveOrderAdjustments?: OrderAdjustmentResolver,
): Promise<CommercialQuote> {
  const facts = await loadCommercialFacts(db, tenantOrgId, intent, deps);
  const { input, prices } = buildCommercialOrderInput(intent, facts);
  let orderAdjustments = input.orderAdjustments;
  if (resolveOrderAdjustments) {
    const netAfter = (adjustments: readonly AdjustmentInput[]) =>
      calculateCommercialOrder({ ...input, orderAdjustments: adjustments }).totals.netTotal;
    // With no order discount, the net total is exactly Σ line net after line discounts.
    orderAdjustments = await resolveOrderAdjustments({ linesNet: netAfter([]), netAfter, rounding: facts.rounding });
  }
  const result = calculateCommercialOrder({ ...input, orderAdjustments });
  return { result, prices, facts, orderAdjustments };
}
