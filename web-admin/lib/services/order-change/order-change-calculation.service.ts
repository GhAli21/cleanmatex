/**
 * Pure Edit calculation over already resolved quotes, tax, promotions, and charges.
 * It does not open a database client or redeem a promotion.
 * An unchanged line keeps its stored unit price when the catalog later changes.
 * A new or changed line uses an authorized override, otherwise the quote final price,
 * so a catalog discount is applied once. Create still consumes base price and is not modified here.
 * ITEM and PIECE extras stay inside the line. The service-speed premium is one order
 * amount and is taxed once. Other ORDER extras and non-preference charges are added
 * once and are not treated as taxable.
 */

import { roundMoneyAmount } from '@/lib/money/format-money';
import { round4 } from '@/lib/services/order-financial-aggregation';
import { applyExclusiveTax, extractTaxFromInclusive } from '@/lib/services/tax-extraction';
const SCALE = 4;
const SCALE_FACTOR = 10000n;
const PRICE_PATTERN = /^(-?)(\d+)(?:\.(\d{1,4}))?$/;

export type OrderChangeTaxMode = 'TAX_EXCLUSIVE' | 'TAX_INCLUSIVE';

export interface OrderChangePriceQuote {
  /** RPC or product unit before the price-list discount percent. */
  basePrice: string;
  /** Unit after that discount percent. This is the selling unit when no override applies. */
  finalPrice: string;
  discountPercent: string;
}

export interface OrderChangeCalculationLine {
  id: string;
  quantity: number;
  active: boolean;
  /** True for a new line or a line whose selling facts are policy-relevant. */
  repriced: boolean;
  persistedUnitPrice: string;
  quote?: OrderChangePriceQuote;
  priceOverride?: string;
  /** Active ITEM and PIECE extras for this line, already counted once by WP07. */
  lineEmbeddedExtra: string;
}

export interface OrderChangeCalculationCharge {
  type: string;
  amount: string;
}

export interface OrderChangePromotionInput {
  amount: string;
  cap: string;
  used: string;
  /** True when this order already consumed the promotion. No second redemption is applied. */
  alreadyRedeemedOnOrder: boolean;
}

export interface OrderChangeCalculationInput {
  lines: readonly OrderChangeCalculationLine[];
  taxMode: OrderChangeTaxMode;
  /** Percent, for example `5` for five percent. */
  taxRatePercent: string;
  currencyDecimalPlaces: number;
  overrideAllowed: boolean;
  /** Active ORDER preference extras from the WP07 cache. */
  orderPreferenceAddend: string;
  /** One order-level service-speed premium. It is taxed once and is not written onto items. */
  orderSpeedAddend?: string;
  charges?: readonly OrderChangeCalculationCharge[];
  promotion?: OrderChangePromotionInput;
  reviewedFingerprint?: string;
  reviewedDisplayTotal?: string;
}

export interface OrderChangeCalculationLineResult {
  id: string;
  active: boolean;
  unitPrice: string;
  merchandiseAmount: string;
  embeddedExtra: string;
  catalogAdjustment: string;
}

export interface OrderChangeCalculationSuccess {
  ok: true;
  lines: OrderChangeCalculationLineResult[];
  merchandiseSubtotal: string;
  promotionDiscount: string;
  taxAmount: string;
  orderPreferenceAddend: string;
  chargeTotal: string;
  /** Four-decimal commercial total. Tax is included once. */
  totalAmount: string;
  /** Currency display total. A difference from the reviewed display total requires re-review. */
  displayTotal: string;
  fingerprint: string;
  requiresReReview: boolean;
}

export interface OrderChangeCalculationFailure {
  ok: false;
  issue: { code: 'OVERRIDE_REQUIRED' | 'PRICE_UNRESOLVED' | 'MONEY_INVALID'; lineId?: string };
}

function parseUnits(value: string): bigint | null {
  const match = PRICE_PATTERN.exec(value.trim());
  if (!match) return null;
  const sign = match[1] === '-' ? -1n : 1n;
  const fraction = (match[3] ?? '').padEnd(SCALE, '0');
  return sign * (BigInt(match[2]) * SCALE_FACTOR + BigInt(fraction));
}

function formatUnits(units: bigint, places = SCALE): string {
  const sign = units < 0n ? '-' : '';
  const abs = units < 0n ? -units : units;
  const whole = abs / SCALE_FACTOR;
  const fraction = (abs % SCALE_FACTOR).toString().padStart(SCALE, '0').slice(0, places).padEnd(places, '0');
  return `${sign}${whole.toString()}.${fraction}`;
}

function sellingUnit(line: OrderChangeCalculationLine, overrideAllowed: boolean): { unit: bigint; adjustment: bigint } | OrderChangeCalculationFailure {
  if (!line.repriced) {
    const persisted = parseUnits(line.persistedUnitPrice);
    if (persisted === null) return { ok: false, issue: { code: 'MONEY_INVALID', lineId: line.id } };
    return { unit: persisted, adjustment: 0n };
  }
  if (line.priceOverride !== undefined) {
    if (!overrideAllowed) return { ok: false, issue: { code: 'OVERRIDE_REQUIRED', lineId: line.id } };
    const override = parseUnits(line.priceOverride);
    if (override === null) return { ok: false, issue: { code: 'MONEY_INVALID', lineId: line.id } };
    return { unit: override, adjustment: 0n };
  }
  if (!line.quote) return { ok: false, issue: { code: 'PRICE_UNRESOLVED', lineId: line.id } };
  const base = parseUnits(line.quote.basePrice);
  const finalPrice = parseUnits(line.quote.finalPrice);
  const discount = parseUnits(line.quote.discountPercent);
  if (base === null || finalPrice === null || discount === null) {
    return { ok: false, issue: { code: 'MONEY_INVALID', lineId: line.id } };
  }
  if (discount > 0n) return { unit: finalPrice, adjustment: base - finalPrice };
  return { unit: base, adjustment: 0n };
}

/**
 * Calculates projected Edit selling totals from resolved inputs.
 * The returned fingerprint covers the facts that would invalidate a review.
 */
export function calculateOrderChangeTotals(input: OrderChangeCalculationInput): OrderChangeCalculationSuccess | OrderChangeCalculationFailure {
  const taxRate = parseUnits(input.taxRatePercent);
  const orderAddend = parseUnits(input.orderPreferenceAddend);
  const speedAddend = parseUnits(input.orderSpeedAddend ?? '0.0000');
  if (taxRate === null || orderAddend === null || speedAddend === null || input.currencyDecimalPlaces < 0 || input.currencyDecimalPlaces > SCALE) {
    return { ok: false, issue: { code: 'MONEY_INVALID' } };
  }

  const lineResults: OrderChangeCalculationLineResult[] = [];
  let merchandise = 0n;
  let taxable = 0n;
  for (const line of input.lines) {
    const resolved = sellingUnit(line, input.overrideAllowed);
    if ('ok' in resolved) return resolved;
    const extra = parseUnits(line.lineEmbeddedExtra);
    if (extra === null || !Number.isInteger(line.quantity) || line.quantity < 0) {
      return { ok: false, issue: { code: 'MONEY_INVALID', lineId: line.id } };
    }
    const merchandiseAmount = line.active ? resolved.unit * BigInt(line.quantity) : 0n;
    const embedded = line.active ? extra : 0n;
    merchandise += merchandiseAmount;
    taxable += merchandiseAmount + embedded;
    lineResults.push({
      id: line.id,
      active: line.active,
      unitPrice: formatUnits(resolved.unit),
      merchandiseAmount: formatUnits(merchandiseAmount),
      embeddedExtra: formatUnits(embedded),
      catalogAdjustment: formatUnits(line.active ? resolved.adjustment : 0n),
    });
  }
  taxable += speedAddend;

  let promotion = 0n;
  if (input.promotion && !input.promotion.alreadyRedeemedOnOrder) {
    const amount = parseUnits(input.promotion.amount);
    const cap = parseUnits(input.promotion.cap);
    const used = parseUnits(input.promotion.used);
    if (amount === null || cap === null || used === null) return { ok: false, issue: { code: 'MONEY_INVALID' } };
    const remaining = cap > used ? cap - used : 0n;
    promotion = amount < remaining ? amount : remaining;
    if (promotion > taxable) promotion = taxable;
  }
  const taxableAfterPromotion = taxable - promotion;
  const taxableAmount = Number(formatUnits(taxableAfterPromotion));
  const rateFraction = Number(formatUnits(taxRate)) / 100;
  const taxNumber = input.taxMode === 'TAX_INCLUSIVE'
    ? extractTaxFromInclusive(taxableAmount, rateFraction).taxAmount
    : applyExclusiveTax(taxableAmount, rateFraction);
  const netCommercial = input.taxMode === 'TAX_INCLUSIVE'
    ? taxableAmount
    : round4(taxableAmount + taxNumber);

  let charges = 0n;
  for (const charge of input.charges ?? []) {
    if (charge.type === 'PREFERENCE') continue;
    const amount = parseUnits(charge.amount);
    if (amount === null) return { ok: false, issue: { code: 'MONEY_INVALID' } };
    charges += amount;
  }

  const total = round4(netCommercial + Number(formatUnits(orderAddend)) + Number(formatUnits(charges)));
  const persistedTotal = total.toFixed(4);
  const displayTotal = roundMoneyAmount(persistedTotal, input.currencyDecimalPlaces).toFixed(input.currencyDecimalPlaces);
  const fingerprint = [
    input.taxMode,
    formatUnits(taxRate),
    ...lineResults.map((line) => [line.id, line.active ? '1' : '0', line.unitPrice, line.merchandiseAmount, line.embeddedExtra].join(':')),
    formatUnits(promotion),
    formatUnits(orderAddend),
    formatUnits(speedAddend),
    formatUnits(charges),
    persistedTotal,
  ].join('|');

  return {
    ok: true,
    lines: lineResults,
    merchandiseSubtotal: formatUnits(merchandise),
    promotionDiscount: formatUnits(promotion),
    taxAmount: taxNumber.toFixed(4),
    orderPreferenceAddend: formatUnits(orderAddend),
    chargeTotal: formatUnits(charges),
    totalAmount: persistedTotal,
    displayTotal,
    fingerprint,
    requiresReReview: (input.reviewedFingerprint !== undefined && input.reviewedFingerprint !== fingerprint)
      || (input.reviewedDisplayTotal !== undefined && input.reviewedDisplayTotal !== displayTotal),
  };
}
