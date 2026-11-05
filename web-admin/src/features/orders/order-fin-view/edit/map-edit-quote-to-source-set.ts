/**
 * Edit adapter (PLAN §6.4, D20, P3-08): the saved order plus one Order Edit
 * quote → the same normalized source set, so the same builders run. Pure,
 * runs on client and server, no fetch, no money math.
 *
 * The quote replaces the value side (items, charges, discounts, taxes, total)
 * and the settlement result (balance, overpaid). The settlement facts
 * (payments, credits, refunds…) stay as saved: an edit never moves money.
 */
import { isArReceivablePaymentTypeCode } from '@/lib/constants/order-financial';
import type { OrderFinDataSource, OrderFinEditQuote, OrderFinFactInput, OrderFinSourceSet } from '@/lib/types/order-fin-view';

// Sources the quote re-prices; the saved rows behind them describe the order before the edit.
const REPRICED: OrderFinDataSource[] = ['items', 'charges', 'discounts', 'taxes'];

/**
 * @param saved - the saved order's source set (`normalizeOrderFinSources`)
 * @param quote - the edit preview as figures (`editQuoteFromPreview`)
 * @returns an `edit` source set; resolve the config with `sourceKind: 'edit'` for the was → now metrics
 * @example assembleOrderFinancialView(mapEditQuoteToSourceSet(saved, quote), resolveOrderFinDisplayConfig({ preset: 'totals' }, 'edit'), new Date().toISOString())
 */
export function mapEditQuoteToSourceSet(saved: OrderFinSourceSet, quote: OrderFinEditQuote): OrderFinSourceSet {
  const s = saved.snapshot;
  // No saved snapshot: "Financial data unavailable" stays, never a projection over zeros.
  if (!s) return { sourceKind: 'edit', snapshot: null, facts: saved.facts, errors: saved.errors };
  const p = quote.projected;

  const facts = { ...saved.facts };
  const errors = { ...saved.errors };
  if (p) {
    // A kept row keeps its saved label (charges carry the saved row id).
    const savedLabel = (source: OrderFinDataSource, f: OrderFinFactInput) =>
      f.label ?? saved.facts[source]?.find((x) => x.id === f.id)?.label;
    const relabel = (source: OrderFinDataSource, list: OrderFinFactInput[]) =>
      list.map((f) => {
        const label = savedLabel(source, f);
        return label ? { ...f, label } : f;
      });
    // Line-by-line item money is not in the quote; the saved lines are pre-edit, so none are shown.
    facts.items = [];
    facts.charges = relabel('charges', p.facts.charges);
    facts.discounts = relabel('discounts', p.facts.discounts);
    facts.taxes = relabel('taxes', p.facts.taxes);
    for (const source of REPRICED) delete errors[source];
  }

  return {
    sourceKind: 'edit',
    snapshot: {
      ...s,
      ...(p ? {
        itemsBase: p.itemsBase,
        extrasIncluded: p.extrasIncluded,
        speedPremiumIncluded: p.speedPremiumIncluded,
        charges: p.charges,
        discount: p.discount,
        tax: p.tax,
        rounding: p.rounding,
        taxPricingMode: p.taxPricingMode,
      } : {}),
      total: quote.projectedTotal,
      paid: quote.paid,
      credits: quote.credits,
      outstanding: quote.outstanding,
      overpaid: quote.overpaid,
      // The writer's rule: an AR order's receivable is its outstanding.
      receivable: isArReceivablePaymentTypeCode(s.settlementType) ? quote.outstanding : 0,
      // The saved snapshot's reconciliation facts do not describe the projection.
      mismatchCount: 0,
      // The base-currency total is written at Apply; until then it is unknown, never the old one.
      baseCurrency: s.baseCurrency ? { ...s.baseCurrency, total: null } : null,
      engineVersion: null,
      calculationHash: null,
      traceId: null,
    },
    facts,
    errors,
    edit: {
      originalTotal: quote.originalTotal,
      projectedTotal: quote.projectedTotal,
      totalDelta: quote.totalDelta,
      outcome: quote.outcome,
    },
  };
}
