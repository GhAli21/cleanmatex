import 'server-only';

import { sumMoney, type Money } from '@/lib/commercial';
import { DISCOUNT_CHANGE_OUTCOMES } from '@/lib/services/commercial/edit-discount-reevaluation';
import type { OrderChangePreviewSuccess } from '@/lib/services/order-change/order-change-preview.service';
import type { OrderFinEditQuote, OrderFinFactInput } from '@/lib/types/order-fin-view';
import { subMoney, toMoneyString } from '@/lib/utils/money';

const num = (value: Money) => value.toNumber();

/**
 * One Order Edit preview → the figures the edit view shows (PLAN §6.4, P3-08).
 * Reads the same result the Review dialog reads and Apply stores: the
 * projected total and financial result as the preview returns them, and the
 * value parts on the snapshot writer's basis (item gross, line + order
 * discounts, net charges, tax lines), so the card equals the saved order after Apply.
 *
 * @param preview - a successful `previewOrderChange` result, `commercial` included (server side only)
 * @returns the quote figures, or null when nothing changes (NO_CHANGE: show the saved order)
 * @example const quote = editQuoteFromPreview(preview); if (quote) mapEditQuoteToSourceSet(saved, quote)
 */
export function editQuoteFromPreview(preview: OrderChangePreviewSuccess): OrderFinEditQuote | null {
  const { financial, projectedTotal } = preview;
  if (!financial || projectedTotal == null) return null;

  const edit = preview.commercial;
  let projected: OrderFinEditQuote['projected'] = null;
  if (edit) {
    const { result, facts } = edit.quote;
    const t = result.totals;
    const changed = new Set(edit.discountChanges.map((c) => c.adjustmentId));
    const discounts: OrderFinFactInput[] = [
      // Each recorded order discount, was → now (D21); a removed one shows struck through at zero.
      ...edit.discountChanges.map((c): OrderFinFactInput => ({
        id: c.adjustmentId,
        label: { name: c.sourceName, name2: c.sourceName2 },
        amount: Number(c.amount),
        previousAmount: Number(c.previousAmount),
        state: c.outcome === DISCOUNT_CHANGE_OUTCOMES.REMOVED ? 'voided' : 'normal',
        statusCode: c.outcome,
        methodCode: c.sourceType,
      })),
      // An order discount the edit itself added has no recorded amount to compare with.
      ...result.document.adjustments
        .filter((a) => !changed.has(a.id) && !a.amount.isZero())
        .map((a): OrderFinFactInput => {
          const meta = edit.adjustmentMeta.get(a.id);
          return { id: a.id, label: { name: meta?.sourceName ?? null, name2: meta?.sourceName2 ?? null }, amount: num(a.amount), state: 'normal', methodCode: a.source };
        }),
    ];
    // shortcut: line discounts are one line, not one per source; split them when the side sheet needs it (P5).
    if (!t.lineDiscountTotal.isZero()) {
      discounts.push({ id: 'edit-line-discounts', labelKey: 'orders.finView.lines.lineDiscounts', amount: num(t.lineDiscountTotal), state: 'normal' });
    }

    projected = {
      itemsBase: num(t.grossTotal),
      extrasIncluded: num(sumMoney(result.lines.map((l) => l.item.money.includedModifierAmount))),
      speedPremiumIncluded: num(t.speedPremiumTotal),
      charges: num(t.chargesNetTotal),
      discount: num(t.lineDiscountTotal.plus(t.orderDiscountTotal)),
      tax: num(t.taxTotal),
      // The edit calculator applies no cash rounding: its total is the reviewed total Apply checks.
      rounding: 0,
      taxPricingMode: facts.pricingMode,
      facts: {
        charges: result.charges.map((c) => ({
          id: edit.keptChargeIds.get(c.chargeId) ?? c.chargeId,
          amount: num(c.netAmount),
          state: 'normal',
          methodCode: c.kind,
        })),
        discounts,
        taxes: result.taxLines.map((l) => {
          const label = facts.taxProfileLabels.get(l.profileId);
          return {
            id: l.profileId,
            label: { name: label?.label ?? l.taxType, name2: label?.label2 ?? null },
            amount: num(l.taxAmount),
            state: 'normal',
            methodCode: l.taxType,
          };
        }),
      },
    };
  }

  return {
    originalTotal: Number(preview.originalTotal),
    projectedTotal: Number(projectedTotal),
    // Apply's own `commercialDelta`.
    totalDelta: Number(toMoneyString(subMoney(projectedTotal, preview.originalTotal))),
    outcome: financial.outcome,
    paid: Number(financial.effectivePayments),
    credits: Number(financial.effectiveCredits),
    outstanding: Number(financial.outstandingAmount),
    overpaid: Number(financial.unresolvedOverpayment),
    projected,
  };
}
