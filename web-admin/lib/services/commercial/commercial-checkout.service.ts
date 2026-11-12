/**
 * Checkout quote use case (ADR-060 §1, PLAN.md §4.1, §4.1a, P5-02).
 *
 * Why: the payment quote and Create submit must produce the same figures, so
 * both call this one function. It turns the New Order cart request into
 * intents, runs the commercial quote (loader → calculator) and keeps the
 * steps that are not price math where they already live:
 * - manual, rule and promo discounts are evaluated as today (manual first,
 *   percent winning over amount; a non-stackable rule competes with the
 *   promo on the after-manual base), each on the base the calculator leaves;
 * - the gift card stays settlement and never lowers the sale total;
 * - the currency cash-rounding rule still applies to the grand total (B17).
 *
 * The client's preference prices, line prices and `servicePrefCharge` are
 * ignored: every amount comes from the server facts (C2, PF-02, PF-12).
 */
import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { createClient } from '@/lib/supabase/server';
import {
  roundMoney,
  sumMoney,
  toMoney,
  type AdjustmentInput,
  type Money,
  type RoundingRule,
} from '@/lib/commercial';
import { SERVICE_SPEEDS } from '@/lib/constants/commercial';
import { DISCOUNT_CALC_TYPE, DISCOUNT_SOURCE_TYPE, MANUAL_LINE_DISCOUNT_LABEL, type DiscountCalcType } from '@/lib/constants/discount-source-type';
import { TAX_PRICING_MODES, TAX_TYPES } from '@/lib/constants/order-financial';
import type { DiscountLineInput } from '@/lib/db/order-discounts';
import type { OrderCalculationResult, TaxLineItem } from '@/lib/types/order-financial';
import type { PromoNotice, TaxProfileEntry } from '@/lib/types/payment-quote';
import { evaluateBestAutoApplyPromo, getBestDiscount, validatePromoCode } from '../discount-service';
import { validateGiftCard, validateGiftCardByIdForCalculation } from '../gift-card-service';
import { createTenantSettingsService } from '../tenant-settings.service';
import {
  PREFERENCE_KINDS,
  TENANT_RATE_PROFILE_ID,
  type CommercialDb,
  type CommercialOrderIntent,
  type LineIntent,
  type PreferenceIntent,
} from './commercial-context.loader';
import type { AdjustmentMeta } from './commercial-line.writer';
import { quoteCommercialOrder, type CommercialQuote, type OrderAdjustmentContext } from './commercial-quote.service';

/** A preference the cart picked; only the code is read. */
export interface CheckoutPreferenceRequest {
  preference_code: string;
}

/** One cart piece: its own preferences. */
export interface CheckoutPieceRequest {
  servicePrefs?: readonly CheckoutPreferenceRequest[];
  packingPrefCode?: string | null;
  /** This piece's own speed (P9-01); null or absent follows the line. */
  serviceSpeed?: string | null;
  /** A cashier discount on this piece (P9-01); `orders:discount` is checked by the caller. */
  lineDiscount?: CheckoutLineDiscountRequest | null;
}

/** A custom item line (no catalog product, P5-03e): entered unit price and its category. */
export interface CheckoutCustomItemRequest {
  name: string;
  name2?: string | null;
  unitPrice: number;
  serviceCategoryCode?: string | null;
}

/** One cart line as the payment quote and submit send it. */
export interface CheckoutLineRequest {
  /** Absent only for a custom item. */
  productId?: string | null;
  /** A line with no catalog product; its price needs `pricing:override` (checked by the caller). */
  customItem?: CheckoutCustomItemRequest | null;
  quantity: number;
  /** A cashier unit price; permission and reason are checked by the caller (PF-01). */
  priceOverride?: number | null;
  servicePrefs?: readonly CheckoutPreferenceRequest[];
  packingPrefCode?: string | null;
  /** Piece k is the k-th piece Create writes; missing pieces have no preferences. */
  pieces?: readonly CheckoutPieceRequest[];
  /** This line's own speed; null or absent follows the order speed (§5.4). */
  serviceSpeed?: string | null;
  /** A cashier discount on this line; `orders:discount` is checked by the caller (P5-03c). */
  lineDiscount?: CheckoutLineDiscountRequest | null;
}

/** A cashier line discount: a percent (0 < rate <= 100) or an amount at currency decimals. */
export interface CheckoutLineDiscountRequest {
  type: DiscountCalcType;
  value: number;
  /** Required at submit (the caller checks); stored on the discount row. */
  reason?: string | null;
}

/** The cart request (payment quote and submit share it). */
export interface CheckoutQuoteParams {
  tenantId: string;
  branchId?: string | null;
  userId?: string;
  customerId?: string | null;
  items: readonly CheckoutLineRequest[];
  /** The order speed code (`sys_service_speed_cd`); absent means STANDARD. */
  serviceSpeed?: string;
  orderServicePrefs?: readonly CheckoutPreferenceRequest[];
  percentDiscount?: number;
  amountDiscount?: number;
  promoCode?: string;
  promoCodeId?: string;
  giftCardNumber?: string;
  giftCardAmount?: number;
  giftCardId?: string;
  serviceCategories?: string[];
  /** General tax profiles the cashier selected; replace the defaults (checked by the loader). */
  taxProfileIds?: readonly string[];
  /** The ready-by the screen shows; null lets the resolver set it. */
  readyByAt?: string | null;
  /** Payment quotes fail on read errors instead of falling back. */
  strictFinancialReads?: boolean;
  /** Request-local timing; preserves each step's result and error. */
  measure?: <T>(stage: string, operation: () => Promise<T>) => Promise<T>;
  /** The Prisma client to read with; defaults to the shared client. */
  db?: CommercialDb;
}

/** The checkout quote: today's totals shape plus the calculated order behind it. */
export interface CheckoutQuote {
  /** Same shape as the legacy calculation, so the payment modal and the submit check are unchanged. */
  totals: OrderCalculationResult;
  quote: CommercialQuote;
  intent: CommercialOrderIntent;
  /** Labels and links for each order discount, keyed by adjustment id (writer input). */
  adjustmentMeta: ReadonlyMap<string, AdjustmentMeta>;
  /** The applied promo (typed or automatic), for its usage row (PF-15, C8). */
  promotionId: string | null;
  /** G15: a typed, valid promo code a non-combinable rule beat; null otherwise. */
  promoNotice: PromoNotice | null;
  /**
   * The general profiles in effect (the cashier's selection, else the
   * defaults), from the same read the tax was calculated with, so the tax
   * panel can never show a rate the order did not use. The fallback rate is not listed.
   */
  taxProfileEntries: TaxProfileEntry[];
}

/** Ids of the order discounts this use case resolves. */
export const CHECKOUT_ADJUSTMENT_IDS = {
  MANUAL: 'manual',
  RULE: 'rule',
  PROMO: 'promo',
} as const;

const pref = (code: string, kind: PreferenceIntent['kind']): PreferenceIntent => ({ code, kind });
const prefsOf = (service: readonly CheckoutPreferenceRequest[] | undefined, packing: string | null | undefined): PreferenceIntent[] => [
  ...(service ?? []).map((p) => pref(p.preference_code, PREFERENCE_KINDS.SERVICE)),
  ...(packing ? [pref(packing, PREFERENCE_KINDS.PACKING)] : []),
];

/**
 * The cart line id the quote and Create agree on.
 * @param index the line's position in the request
 * @returns `L1`, `L2`, …
 */
export const checkoutLineId = (index: number): string => `L${index + 1}`;

/**
 * The adjustment id of a cashier discount on cart line `index`.
 * @param index the line's position in the request
 * @returns `L1:manual`, …
 */
export const lineDiscountId = (index: number): string => `${checkoutLineId(index)}:${CHECKOUT_ADJUSTMENT_IDS.MANUAL}`;

const pieceDiscountId = (index: number, pieceIndex: number): string => `${checkoutPieceId(index, pieceIndex)}:${CHECKOUT_ADJUSTMENT_IDS.MANUAL}`;

/**
 * The cart piece id the quote and Create agree on.
 * @param index the line's position
 * @param pieceIndex the piece's position within the line
 * @returns `L1-p1`, …
 */
export const checkoutPieceId = (index: number, pieceIndex: number): string => `${checkoutLineId(index)}-p${pieceIndex + 1}`;

/**
 * Maps the cart request to intents. Prices sent by the client are never read.
 * @param params the cart request
 * @param receivedAt when the order starts (effective dates are read at this instant)
 * @returns the commercial intents (order discounts are resolved later)
 */
export function checkoutIntentOf(params: CheckoutQuoteParams, receivedAt: Date): CommercialOrderIntent {
  const readyBy = params.readyByAt ? new Date(params.readyByAt) : null;
  const lines: LineIntent[] = params.items.map((item, index) => ({
    lineId: checkoutLineId(index),
    productId: item.customItem ? null : item.productId ?? null,
    customItem: item.customItem
      ? { unitPrice: String(item.customItem.unitPrice), serviceCategoryCode: item.customItem.serviceCategoryCode ?? null }
      : null,
    quantity: item.quantity,
    serviceSpeed: item.serviceSpeed ?? null,
    overrideUnitPrice: item.priceOverride != null ? String(item.priceOverride) : null,
    preferences: prefsOf(item.servicePrefs, item.packingPrefCode),
    // Create writes ceil(quantity) pieces; piece k carries the cart's piece k.
    pieces: Array.from({ length: Math.max(1, Math.ceil(item.quantity)) }, (_, k) => {
      const piece = item.pieces?.[k];
      return {
        pieceId: checkoutPieceId(index, k),
        preferences: prefsOf(piece?.servicePrefs, piece?.packingPrefCode),
        serviceSpeed: piece?.serviceSpeed ?? null,
        discounts: piece?.lineDiscount
          ? [{ id: pieceDiscountId(index, k), source: DISCOUNT_SOURCE_TYPE.MANUAL, calcType: piece.lineDiscount.type, value: String(piece.lineDiscount.value) }]
          : [],
      };
    }),
    lineDiscounts: item.lineDiscount
      ? [{ id: lineDiscountId(index), source: DISCOUNT_SOURCE_TYPE.MANUAL, calcType: item.lineDiscount.type, value: String(item.lineDiscount.value) }]
      : [],
  }));
  return {
    branchId: params.branchId ?? null,
    customerId: params.customerId ?? null,
    serviceSpeed: params.serviceSpeed ?? SERVICE_SPEEDS.STANDARD,
    receivedAt,
    readyByOverride: readyBy && !Number.isNaN(readyBy.getTime()) ? readyBy : null,
    lines,
    orderPreferences: prefsOf(params.orderServicePrefs, null),
    orderAdjustments: [],
  };
}

const num = (value: Money) => value.toNumber();
const fixed = (id: string, source: string, amount: Money): AdjustmentInput =>
  ({ id, source, calcType: DISCOUNT_CALC_TYPE.FIXED_AMOUNT, value: amount.toString() });
/** A service amount, rounded once to the currency and never above what is left. */
const capped = (value: number | null | undefined, available: Money, rounding: RoundingRule): Money => {
  const amount = roundMoney(toMoney(Math.max(0, value ?? 0)), rounding);
  return amount.greaterThan(available) ? available : amount;
};

/**
 * Prices the cart through the commercial calculator and returns today's totals shape.
 * @param params the cart request; `tenantId` is the session tenant, resolved server-side by the caller
 * @returns the totals, the calculated order and the discount metadata for the writer
 * @throws CommercialContextError, CommercialRuleError (4xx in the route); Error('GIFT_CARD_INVALID') on a strict quote
 * @example
 * const checkout = await quoteCheckout({ tenantId, branchId, items: [{ productId, quantity: 2 }] });
 * checkout.totals.saleTotal; // 4.2
 */
export async function quoteCheckout(params: CheckoutQuoteParams): Promise<CheckoutQuote> {
  const { tenantId, userId, customerId, serviceCategories, promoCode, strictFinancialReads = false } = params;
  const branchId = params.branchId ?? undefined;
  const measure: NonNullable<CheckoutQuoteParams['measure']> = params.measure ?? ((_stage, operation) => operation());
  const tenantSettings = createTenantSettingsService(await createClient());
  const currencyConfig = await measure('currency', () => tenantSettings.getCurrencyConfig(tenantId, branchId, userId));
  const currencyCode = currencyConfig.currencyCode;
  const decimalPlaces = currencyConfig.decimalPlaces ?? 3;
  const intent = checkoutIntentOf(params, new Date());

  // ─── Order discounts: manual → rule → promo, evaluated as today ──────────
  const adjustmentMeta = new Map<string, AdjustmentMeta>();
  // Line discounts (P5-03c): labelled and carrying the cashier's reason for audit.
  params.items.forEach((item, index) => {
    item.pieces?.forEach((piece, k) => {
      if (piece.lineDiscount) {
        adjustmentMeta.set(pieceDiscountId(index, k), { ...MANUAL_LINE_DISCOUNT_LABEL, notes: piece.lineDiscount.reason?.trim() || null });
      }
    });
    if (!item.lineDiscount) return;
    adjustmentMeta.set(lineDiscountId(index), {
      ...MANUAL_LINE_DISCOUNT_LABEL, notes: item.lineDiscount.reason?.trim() || null,
    });
  });
  let promotionId: string | null = null;
  let promoNotice: PromoNotice | null = null;
  const resolveOrderAdjustments = async ({ linesNet, netAfter, rounding }: OrderAdjustmentContext) => {
    const adjustments: AdjustmentInput[] = [];
    const percent = params.percentDiscount ?? 0;
    const amount = params.amountDiscount ?? 0;
    // Percent wins over amount; both are never applied.
    if (percent > 0) {
      adjustments.push({ id: CHECKOUT_ADJUSTMENT_IDS.MANUAL, source: DISCOUNT_SOURCE_TYPE.MANUAL,
        calcType: DISCOUNT_CALC_TYPE.PERCENTAGE, value: String(Math.min(percent, 100)) });
    } else if (amount > 0) {
      const manual = capped(amount, linesNet, rounding);
      if (!manual.isZero()) adjustments.push(fixed(CHECKOUT_ADJUSTMENT_IDS.MANUAL, DISCOUNT_SOURCE_TYPE.MANUAL, manual));
    }
    if (adjustments.length > 0) {
      adjustmentMeta.set(CHECKOUT_ADJUSTMENT_IDS.MANUAL, { sourceName: 'Manual Discount', sourceName2: 'خصم يدوي' });
    }
    const afterManual = netAfter(adjustments);

    const bestRule = await measure('discounts', () => getBestDiscount(tenantId, {
      order_total: num(afterManual),
      items_count: params.items.length,
      service_categories: serviceCategories ?? [],
      order_date: new Date().toISOString(),
    }));
    let rule = bestRule ? capped(bestRule.discount_amount, afterManual, rounding) : toMoney(0);

    const evaluatePromo = (base: Money) => measure('promos', async () => {
      if (promoCode?.trim()) {
        const typed = await validatePromoCode({
          promo_code: promoCode, order_total: num(base), customer_id: customerId ?? undefined, service_categories: serviceCategories,
        }, { tenantId, currencyConfig, strictResolution: strictFinancialReads });
        return typed.isValid && typed.discountAmount != null
          ? { amount: capped(typed.discountAmount, base, rounding), id: typed.promoCode?.id ?? null, name: promoCode.toUpperCase() }
          : null;
      }
      const auto = await evaluateBestAutoApplyPromo({
        tenantId, orderTotal: num(base), customerId: customerId ?? undefined, serviceCategories, currencyConfig,
      });
      return auto?.isValid && auto.discountAmount != null && auto.promo
        ? { amount: capped(auto.discountAmount, base, rounding), id: auto.promo.id, name: auto.promo.promo_name ?? 'Auto Promo' }
        : null;
    });

    let promo: { amount: Money; id: string | null; name: string } | null;
    if (bestRule && !bestRule.rule.can_stack_with_promo) {
      // A non-stackable rule competes with the promo on the after-manual base; the larger wins.
      promo = await evaluatePromo(afterManual);
      if (promo && !promo.amount.isZero() && promo.amount.greaterThanOrEqualTo(rule)) rule = toMoney(0);
      else {
        // G15: a code the cashier typed and the server accepted is dropped; record why.
        if (promo && !promo.amount.isZero() && promoCode?.trim()) {
          promoNotice = {
            code: 'PROMO_NOT_APPLIED_RULE_WINS',
            promoCode: promo.name,
            ruleName: bestRule.rule.rule_name,
            ruleName2: bestRule.rule.rule_name2 ?? null,
          };
        }
        promo = null;
      }
    } else {
      const afterRule = rule.isZero() ? afterManual : netAfter([...adjustments, fixed(CHECKOUT_ADJUSTMENT_IDS.RULE, DISCOUNT_SOURCE_TYPE.DISCOUNT_RULE, rule)]);
      promo = await evaluatePromo(afterRule);
    }

    if (bestRule && !rule.isZero()) {
      adjustments.push(fixed(CHECKOUT_ADJUSTMENT_IDS.RULE, DISCOUNT_SOURCE_TYPE.DISCOUNT_RULE, rule));
      adjustmentMeta.set(CHECKOUT_ADJUSTMENT_IDS.RULE, {
        sourceId: bestRule.rule.id, sourceName: bestRule.rule.rule_name, sourceName2: bestRule.rule.rule_name2 ?? null,
      });
    }
    if (promo && !promo.amount.isZero()) {
      adjustments.push(fixed(CHECKOUT_ADJUSTMENT_IDS.PROMO, DISCOUNT_SOURCE_TYPE.PROMO_CODE, promo.amount));
      adjustmentMeta.set(CHECKOUT_ADJUSTMENT_IDS.PROMO, { sourceId: promo.id, sourceName: promo.name, promotionId: promo.id });
      promotionId = promo.id;
    }
    return adjustments;
  };

  const quote = await measure('pricing', () => quoteCommercialOrder(
    params.db ?? prisma,
    tenantId,
    intent,
    {
      currency: { code: currencyCode, decimalPlaces },
    },
    resolveOrderAdjustments,
  ));
  const { result, facts } = quote;
  const t = result.totals;

  // ─── Today's totals shape ────────────────────────────────────────────────
  const adjustmentAmount = (id: string) => result.document.adjustments.find((a) => a.id === id)?.amount ?? toMoney(0);
  const isVat = (type: string) => type === TAX_TYPES.VAT || type === TAX_TYPES.GST;
  const taxBreakdown: TaxLineItem[] = result.taxLines.map((line) => {
    const label = facts.taxProfileLabels.get(line.profileId);
    return {
      ...(line.isTenantRateFallback || line.profileId === TENANT_RATE_PROFILE_ID ? {} : { profileId: line.profileId }),
      taxType: line.taxType as TaxLineItem['taxType'],
      label: label?.label ?? line.taxType,
      label2: label?.label2 ?? null,
      rate: num(line.ratePercent),
      isCompound: line.isCompound,
      baseAmount: num(line.taxableAmount),
      taxAmount: num(line.taxAmount),
    };
  });
  const vat = result.taxLines.filter((l) => isVat(l.taxType));
  const vatValue = vat.reduce((s, l) => s.plus(l.taxAmount), toMoney(0));
  const additionalTax = t.taxTotal.minus(vatValue);
  // Lines and charges before tax: the total less its tax and the charges' own base.
  const chargesTaxable = result.charges.reduce((s, c) => s.plus(c.taxableAmount), toMoney(0));
  const inclusive = facts.pricingMode === TAX_PRICING_MODES.TAX_INCLUSIVE;
  const linesBeforeTax = inclusive ? t.totalAmount.minus(t.taxTotal).minus(chargesTaxable) : t.netTotal;

  // The order total is exact to the currency's decimals (Line-Level P10-04): the ACCOUNTING rule is
  // one minor unit (CHECK chk_scrr_acct_minor_unit, 0686), and cash rounding applies only to the change
  // on a cash tender (cash-change-rounding.service.ts). The field stays in the contract, always 0.
  const saleTotal = num(t.totalAmount);
  const roundingAdjustmentAmount = 0;

  // ─── Gift card: settlement, capped at the sale total ─────────────────────
  let giftCardApplied = 0;
  const giftCardId = params.giftCardId?.trim();
  const giftCardNumber = params.giftCardNumber?.trim();
  if (giftCardId || giftCardNumber) {
    // An id was authenticated (PIN checked) when the card was fetched; a number is the legacy path.
    const card = await measure('gift_card', () => giftCardId
      ? validateGiftCardByIdForCalculation(giftCardId, tenantId, strictFinancialReads ? { strictResolution: true } : undefined)
      : validateGiftCard({ gift_card_code: giftCardNumber! }, strictFinancialReads ? { tenantId, strictResolution: true } : undefined));
    // Keep the cashier's chosen credit on screen: an invalid strict quote fails instead of dropping it.
    if (strictFinancialReads && !card.isValid) throw new Error('GIFT_CARD_INVALID');
    if (card.isValid && card.availableBalance != null && card.availableBalance > 0) {
      const max = Math.min(card.availableBalance, saleTotal);
      giftCardApplied = Number(Math.min(params.giftCardAmount ?? max, max).toFixed(decimalPlaces));
    }
  }

  const discountLines: DiscountLineInput[] = result.document.adjustments
    .filter((a) => !a.amount.isZero())
    .map((a) => {
      const meta = adjustmentMeta.get(a.id) ?? {};
      return {
        sourceType: a.source,
        sourceId: meta.sourceId ?? undefined,
        sourceName: meta.sourceName ?? a.source,
        sourceName2: meta.sourceName2 ?? undefined,
        discountType: a.calcType,
        discountRate: a.rate ? num(a.rate) : undefined,
        discountAmount: num(a.amount),
      } as DiscountLineInput;
    });

  const vatTaxPercent = vat[0] ? Number(vat[0].ratePercent.toFixed(2)) : 0;
  const totals: OrderCalculationResult = {
    // The lines after their own discounts (a price-list discount included), as the cart shows them.
    subtotal: num(t.grossTotal.minus(t.lineDiscountTotal)),
    manualDiscount: num(adjustmentAmount(CHECKOUT_ADJUSTMENT_IDS.MANUAL)),
    autoRuleDiscount: num(adjustmentAmount(CHECKOUT_ADJUSTMENT_IDS.RULE)),
    promoDiscount: num(adjustmentAmount(CHECKOUT_ADJUSTMENT_IDS.PROMO)),
    afterDiscounts: num(linesBeforeTax),
    taxRate: vatTaxPercent / 100,
    taxAmount: num(vatValue),
    additionalTaxAmount: num(additionalTax),
    vatTaxPercent,
    vatValue: num(vatValue),
    taxBreakdown,
    giftCardApplied,
    saleTotal,
    currencyCode,
    decimalPlaces,
    discountLines,
    taxPricingMode: facts.pricingMode,
    roundingAdjustmentAmount,
    chargesTotal: num(t.chargesNetTotal),
    extrasIncludedAmount: num(sumMoney(result.lines.map((l) => l.item.money.includedModifierAmount))),
    speedPremiumIncludedAmount: num(t.speedPremiumTotal),
  };

  const selection = params.taxProfileIds ?? [];
  const inEffect = facts.taxProfiles.filter((p) => p.isDefault && !p.isTenantRateFallback);
  // The cashier's order when selected; otherwise by tax type, as the panel always listed them.
  const ordered = selection.length > 0
    ? selection.map((id) => inEffect.find((p) => p.id === id)).filter((p): p is (typeof inEffect)[number] => Boolean(p))
    : [...inEffect].sort((a, b) => a.taxType.localeCompare(b.taxType));
  const taxProfileEntries: TaxProfileEntry[] = ordered.map((p) => ({
    id: p.id,
    name: facts.taxProfileLabels.get(p.id)?.label ?? p.taxType,
    name2: facts.taxProfileLabels.get(p.id)?.label2 ?? null,
    tax_type: p.taxType,
    rate: toMoney(p.ratePercent).toNumber(),
    is_compound: p.isCompound,
    enabled: true,
  }));

  return { totals, quote, intent, adjustmentMeta, promotionId, promoNotice, taxProfileEntries };
}
