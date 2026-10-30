/**
 * One whole order through the calculator (PLAN.md §8, P5-01).
 *
 * Why: Create, Edit, the cart quote and the recompute must get the same
 * figures from the same facts. The loader gathers the facts, this composes
 * the P4 steps in one fixed order, and the writer stores the result:
 * 1. price every PRICED row (`priceLine`);
 * 2. order discounts on the priced rows (`applyDocumentAdjustments`);
 * 3. tax on the priced rows, then on the separate charges (`calculateTax`);
 * 4. split items into pieces (ITEM) or sum pieces into items (PIECE);
 * 5. ready-by per line and order;
 * 6. check I1–I6 on the whole result before returning it.
 *
 * Separate charges are taxed in their own pass, so a DOCUMENT_LEVEL
 * allowance can never land on them (order discounts reduce lines only).
 * A charge with no tax input is untaxed; the loader gives every order
 * preference charge a tax input (L25), so this is for charges that are truly
 * outside the supply.
 */
import { MONEY_BASIS, type CommercialLevel, type DiscAllocBasis, type DiscAllocMode, type MoneyBasis } from '@/lib/constants/commercial';
import { TAX_PRICING_MODES, type TaxPricingMode } from '@/lib/constants/order-financial';
import type { AdjustmentInput } from './adjustments';
import { applyDocumentAdjustments, type DocumentAdjustmentResult } from './document-adjustments';
import { assertMoneyInvariants, type InvariantOrder } from './invariants';
import {
  allocateItemToPieces,
  buildRowMoney,
  resolveMoneyBasis,
  rollupPiecesToItem,
  type MoneyBasisDecision,
  type RowMoney,
} from './levels';
import { MODIFIER_PLACEMENTS, priceLine, type LinePricingInput, type LinePricingResult, type PriceModifier } from './line-pricing';
import { ZERO, sumMoney, toMoney, type Money, type MoneyInput } from './money';
import { resolveReadyBy, type ReadyByInput, type ReadyByLineInput, type ReadyByLineResult } from './ready-by';
import type { RoundingRule } from './rounding';
import { calculateTax, type TaxLineResult, type TaxProfileInput, type TaxRowInput, type TaxRowResult } from './tax';

/**
 * The calculator version written to `org_orders_mst.commercial_calc_version`.
 * Bump it when a rule changes a figure, so recompute and reconciliation know
 * which rules wrote an order (PLAN.md §4.3).
 */
export const COMMERCIAL_CALC_VERSION = 1;

// ─── Input ─────────────────────────────────────────────────────────────────

/** How one row is taxed; the loader resolves the category and profiles. */
export interface CommercialTaxInput {
  taxCategoryCode: string;
  exemptReason: string | null;
  /** `selectTaxProfiles(...)`; ignored for a non-STANDARD category. */
  profiles: readonly TaxProfileInput[];
}

/** One piece of a line, in allocation tie-break order (`piece_seq`, then id). */
export interface CommercialPieceInput {
  pieceId: string;
  /**
   * This piece's own modifiers (a piece preference). Item-priced line: they
   * join the line's modifiers, and the piece's allocation weight is one unit
   * plus them, so this piece's gross carries them (the modifier column itself
   * is split by gross shares). Piece-priced line: priced on it.
   */
  modifiers?: readonly PriceModifier[];
  /** This piece's own discounts; piece-priced lines only (P9). */
  adjustments?: readonly AdjustmentInput[];
}

/** One order line with every fact the calculator needs. */
export interface CommercialLineInput {
  lineId: string;
  quantity: MoneyInput;
  /** The product's `price_type`, for the PIECE fallback. */
  priceType: string | null;
  /** Everything `priceLine` needs except quantity and rounding. */
  pricing: Omit<LinePricingInput, 'quantity' | 'rounding'>;
  tax: CommercialTaxInput;
  pieces: readonly CommercialPieceInput[];
  /** The line's ready-by facts (`lineId` is added here). */
  readyBy: Omit<ReadyByLineInput, 'lineId'>;
}

/** An order-level charge (delivery, order preference extras). Never discounted. */
export interface CommercialChargeInput {
  chargeId: string;
  kind: string;
  amount: MoneyInput;
  /** Null: untaxed (a charge outside the supply). */
  tax: CommercialTaxInput | null;
}

/** A whole order's facts, with the order's snapshots (PLAN.md §5.3). */
export interface CommercialOrderInput {
  level: CommercialLevel;
  pricingMode: TaxPricingMode;
  discAllocMode: DiscAllocMode;
  discAllocBasis: DiscAllocBasis;
  /** The currency ACCOUNTING rule: decimals and mode. */
  rounding: RoundingRule;
  /** In tie-break order. */
  lines: readonly CommercialLineInput[];
  /** ORDER-level discounts in the order they apply (manual → rule → promo). */
  orderAdjustments: readonly AdjustmentInput[];
  charges: readonly CommercialChargeInput[];
  /** Start time, order preference minutes and any cashier time. */
  readyBy: Omit<ReadyByInput, 'lines'>;
}

// ─── Output ────────────────────────────────────────────────────────────────

/** The tax facts stored on a row (§6.1). */
export interface CommercialRowTax {
  taxCategoryCode: string;
  exemptReason: string | null;
  taxProfileId: string | null;
  taxRate: Money;
}

/** One stored item or piece row. */
export interface CommercialRowResult {
  rowId: string;
  moneyBasis: MoneyBasis;
  money: RowMoney;
  tax: CommercialRowTax;
  /** PRICED rows only: the applied discounts, modifiers and notices for the writer. */
  pricing: LinePricingResult | null;
}

/** One line: its basis, item row, piece rows and ready-by. */
export interface CommercialLineResult {
  lineId: string;
  basis: MoneyBasisDecision;
  item: CommercialRowResult;
  pieces: CommercialRowResult[];
  readyBy: ReadyByLineResult;
}

/** One stored charge row: an order charge or a SEPARATE modifier of a row. */
export interface CommercialChargeResult {
  chargeId: string;
  kind: string;
  /** The line (and piece) a SEPARATE modifier came from; null for an order charge. */
  sourceLineId: string | null;
  sourcePieceId: string | null;
  netAmount: Money;
  tax: CommercialRowTax | null;
  taxableAmount: Money;
  taxAmount: Money;
  lineTotalAmount: Money;
}

/** Header figures (`org_orders_mst`). */
export interface CommercialOrderTotals {
  /** Σ item gross (`total_price`). */
  grossTotal: Money;
  speedPremiumTotal: Money;
  lineDiscountTotal: Money;
  /** Σ order discounts, wherever they live. */
  orderDiscountTotal: Money;
  /** Σ item net − the DOCUMENT_LEVEL allowance: the lines after every discount. */
  netTotal: Money;
  chargesNetTotal: Money;
  /** Σ header tax lines (lines and charges). */
  taxTotal: Money;
  /** I3: what the customer owes before settlement. */
  totalAmount: Money;
}

/** The whole calculated order. */
export interface CommercialOrderResult {
  calcVersion: number;
  /** The currency decimals every figure is at; the writer splits at the same precision. */
  decimalPlaces: number;
  /** The `disc_alloc_mode` the order discounts were placed by. */
  discAllocMode: DiscAllocMode;
  lines: CommercialLineResult[];
  charges: CommercialChargeResult[];
  document: DocumentAdjustmentResult;
  /** One per profile, lines and charges merged (`org_order_taxes_dtl`). */
  taxLines: TaxLineResult[];
  /** Taxable amount per category after allowances, lines and charges. */
  categoryTaxable: Map<string, Money>;
  totals: CommercialOrderTotals;
  orderReadyBy: Date;
  readyByIsOverride: boolean;
}

// ─── Calculation ───────────────────────────────────────────────────────────

/** A row that carries a price: an item, or a piece of a PIECE-priced line. */
interface PricedRow {
  rowId: string;
  lineIndex: number;
  pieceId: string | null;
  pricing: LinePricingResult;
}

const rowTaxOf = (result: TaxRowResult): CommercialRowTax => ({
  taxCategoryCode: result.taxCategoryCode,
  exemptReason: result.exemptReason,
  taxProfileId: result.taxProfileId,
  taxRate: result.taxRate,
});

const taxRow = (rowId: string, netAmount: MoneyInput, tax: CommercialTaxInput): TaxRowInput => ({
  rowId, netAmount, taxCategoryCode: tax.taxCategoryCode, exemptReason: tax.exemptReason, profiles: tax.profiles,
});

/** Merges header tax lines by profile; charges are taxed in a pass of their own. */
function mergeTaxLines(...passes: TaxLineResult[][]): TaxLineResult[] {
  const merged = new Map<string, TaxLineResult>();
  for (const line of passes.flat()) {
    const prior = merged.get(line.profileId);
    merged.set(line.profileId, prior
      ? { ...prior, taxableAmount: prior.taxableAmount.plus(line.taxableAmount), taxAmount: prior.taxAmount.plus(line.taxAmount) }
      : { ...line });
  }
  return [...merged.values()];
}

/**
 * Calculates a whole order and checks I1–I6 before returning it.
 * @param input the order's snapshots, lines, order discounts, charges and ready-by facts, all resolved by the loader
 * @returns every stored row, the header tax lines, the totals and the ready-by
 * @throws CommercialRuleError a business rule the input breaks (e.g. DOCUMENT_DISCOUNT_EXCEEDS_BASE), or COMMERCIAL_INVARIANT_FAILED
 * @throws Error a malformed input (line-level modifiers or discounts on a PIECE-priced line)
 * @example
 * const result = calculateCommercialOrder(await loadCommercialContext(tenantOrgId, request));
 * result.totals.totalAmount.toString();
 */
export function calculateCommercialOrder(input: CommercialOrderInput): CommercialOrderResult {
  const { pricingMode, rounding } = input;
  const decimals = rounding.decimalPlaces;
  const basisOf = input.lines.map((line) => resolveMoneyBasis(input.level, {
    priceType: line.priceType, quantity: line.quantity, pieceCount: line.pieces.length,
  }));

  // ─── 1. Price the PRICED rows ──────────────────────────────────────────
  const pricedRows: PricedRow[] = input.lines.flatMap((line, lineIndex) => {
    if (basisOf[lineIndex].pieceBasis !== MONEY_BASIS.PRICED) {
      if (line.pieces.some((p) => (p.adjustments ?? []).length > 0)) {
        throw new Error(`Line ${line.lineId} is priced on the item; piece discounts need a piece-priced line.`);
      }
      const modifiers = [...line.pricing.modifiers, ...line.pieces.flatMap((p) => p.modifiers ?? [])];
      return [{ rowId: line.lineId, lineIndex, pieceId: null, pricing: priceLine({ ...line.pricing, modifiers, quantity: line.quantity, rounding }) }];
    }
    if (line.pricing.adjustments.length > 0) {
      throw new Error(`Line ${line.lineId} is priced per piece; its discounts belong on its pieces.`);
    }
    // One piece = one unit. What is charged once per line (a per-line speed
    // premium, a line preference) goes on the first piece.
    return line.pieces.map((piece, k) => ({
      rowId: piece.pieceId, lineIndex, pieceId: piece.pieceId,
      pricing: priceLine({
        ...line.pricing,
        speedLinePremium: k === 0 ? line.pricing.speedLinePremium : 0,
        modifiers: [...(k === 0 ? line.pricing.modifiers : []), ...(piece.modifiers ?? [])],
        adjustments: piece.adjustments ?? [],
        quantity: 1,
        rounding,
      }),
    }));
  });

  // ─── 2. Order discounts ────────────────────────────────────────────────
  const document = applyDocumentAdjustments({
    adjustments: input.orderAdjustments,
    lines: pricedRows.map((r) => ({
      lineId: r.rowId,
      grossAmount: r.pricing.grossAmount,
      netAmount: r.pricing.netBeforeDocument,
      taxCategoryCode: input.lines[r.lineIndex].tax.taxCategoryCode,
    })),
    mode: input.discAllocMode,
    basis: input.discAllocBasis,
    rounding,
  });
  const shareOf = (rowId: string) => document.lineShares.get(rowId) ?? ZERO;

  // ─── 3. Tax: priced rows, then separate charges ────────────────────────
  const rowTax = calculateTax({
    rows: pricedRows.map((r) => taxRow(r.rowId, r.pricing.netBeforeDocument.minus(shareOf(r.rowId)), input.lines[r.lineIndex].tax)),
    pricingMode,
    documentAllowances: document.categoryShares,
    currencyDecimalPlaces: decimals,
  });

  const chargeSources = [
    ...pricedRows.flatMap((r) => r.pricing.separateModifiers.map((m) => ({
      chargeId: `${r.rowId}:${m.id}`, kind: m.kind, amount: m.amount,
      sourceLineId: input.lines[r.lineIndex].lineId, sourcePieceId: r.pieceId,
      // A line's extra is part of the same supply, so it is taxed like the line.
      tax: input.lines[r.lineIndex].tax as CommercialTaxInput | null,
    }))),
    ...input.charges.map((c) => ({
      chargeId: c.chargeId, kind: c.kind, amount: toMoney(c.amount), sourceLineId: null, sourcePieceId: null, tax: c.tax,
    })),
  ];
  chargeSources.forEach((c) => {
    if (c.amount.isNegative()) throw new Error(`Charge ${c.chargeId} cannot be negative.`);
  });
  const taxedCharges = chargeSources.filter((c) => c.tax !== null);
  const chargeTax = taxedCharges.length > 0
    ? calculateTax({
      rows: taxedCharges.map((c) => taxRow(c.chargeId, c.amount, c.tax as CommercialTaxInput)),
      pricingMode,
      currencyDecimalPlaces: decimals,
    })
    : null;
  const inclusive = pricingMode === TAX_PRICING_MODES.TAX_INCLUSIVE;
  const charges: CommercialChargeResult[] = chargeSources.map((c) => {
    const taxed = chargeTax?.rows.get(c.chargeId);
    return {
      chargeId: c.chargeId, kind: c.kind, sourceLineId: c.sourceLineId, sourcePieceId: c.sourcePieceId,
      netAmount: c.amount,
      tax: taxed ? rowTaxOf(taxed) : null,
      taxableAmount: taxed?.taxableAmount ?? c.amount,
      taxAmount: taxed?.taxAmount ?? ZERO,
      lineTotalAmount: taxed?.lineTotalAmount ?? c.amount,
    };
  });

  // ─── 4. Item and piece rows ────────────────────────────────────────────
  const pricedResult = (r: PricedRow): CommercialRowResult => {
    const taxed = rowTax.rows.get(r.rowId)!;
    return {
      rowId: r.rowId,
      moneyBasis: MONEY_BASIS.PRICED,
      money: buildRowMoney({
        listUnitPrice: r.pricing.listUnitPrice,
        unitPrice: r.pricing.unitPrice,
        speedPremiumAmount: r.pricing.speedPremiumAmount,
        includedModifierAmount: r.pricing.includedModifierAmount,
        grossAmount: r.pricing.grossAmount,
        lineDiscountAmount: r.pricing.lineDiscountAmount,
        orderDiscountAllocAmount: shareOf(r.rowId),
        taxAmount: taxed.taxAmount,
      }, pricingMode),
      tax: rowTaxOf(taxed),
      pricing: r.pricing,
    };
  };

  const readyBy = resolveReadyBy({
    ...input.readyBy,
    lines: input.lines.map((line) => ({ ...line.readyBy, lineId: line.lineId })),
  });

  const lines: CommercialLineResult[] = input.lines.map((line, lineIndex) => {
    const basis = basisOf[lineIndex];
    const rows = pricedRows.filter((r) => r.lineIndex === lineIndex).map(pricedResult);
    let item: CommercialRowResult;
    let pieces: CommercialRowResult[];
    if (basis.itemBasis === MONEY_BASIS.ROLLUP) {
      pieces = rows;
      item = {
        rowId: line.lineId, moneyBasis: MONEY_BASIS.ROLLUP,
        money: rollupPiecesToItem(rows.map((p) => p.money), line.quantity, pricingMode, rounding),
        // Every piece is the same product, so it is taxed the same way.
        tax: rows[0].tax,
        pricing: null,
      };
    } else {
      item = rows[0];
      // Each piece weighs one unit plus its own INCLUDED extras, so a piece
      // preference stays on its piece; the chaining keeps each share within its parent.
      const unit = item.money.unitPrice;
      const weights = line.pieces.map((p) => unit.plus(sumMoney((p.modifiers ?? [])
        .filter((m) => m.placement === MODIFIER_PLACEMENTS.INCLUDED).map((m) => m.amount))));
      const shares = allocateItemToPieces(item.money, weights, pricingMode, decimals);
      pieces = line.pieces.map((piece, k) => ({
        rowId: piece.pieceId, moneyBasis: MONEY_BASIS.ALLOCATED, money: shares[k], tax: item.tax, pricing: null,
      }));
    }
    return { lineId: line.lineId, basis, item, pieces, readyBy: readyBy.lines[lineIndex] };
  });

  // ─── 5. Totals ─────────────────────────────────────────────────────────
  const sumItems = (key: keyof RowMoney) => sumMoney(lines.map((l) => l.item.money[key]));
  const allowance = sumMoney([...document.categoryShares.values()]);
  const taxLines = mergeTaxLines(rowTax.taxLines, chargeTax?.taxLines ?? []);
  const taxTotal = sumMoney(taxLines.map((l) => l.taxAmount));
  const netTotal = sumItems('netAmount').minus(allowance);
  const chargesNetTotal = sumMoney(charges.map((c) => c.netAmount));
  const totals: CommercialOrderTotals = {
    grossTotal: sumItems('grossAmount'),
    speedPremiumTotal: sumItems('speedPremiumAmount'),
    lineDiscountTotal: sumItems('lineDiscountAmount'),
    orderDiscountTotal: document.total,
    netTotal,
    chargesNetTotal,
    taxTotal,
    totalAmount: netTotal.plus(chargesNetTotal).plus(inclusive ? ZERO : taxTotal),
  };

  const categoryTaxable = new Map(rowTax.categoryTaxable);
  for (const [category, amount] of chargeTax?.categoryTaxable ?? []) {
    categoryTaxable.set(category, (categoryTaxable.get(category) ?? ZERO).plus(amount));
  }

  // ─── 6. I1–I6 on the whole result ──────────────────────────────────────
  const invariantOrder: InvariantOrder = {
    pricingMode,
    discAllocMode: input.discAllocMode,
    items: lines.map((l) => ({
      itemId: l.item.rowId, moneyBasis: l.item.moneyBasis, pricingMode, money: l.item.money,
      pieces: l.pieces.map((p) => ({ pieceId: p.rowId, moneyBasis: p.moneyBasis, pricingMode, money: p.money })),
    })),
    charges: charges.map((c) => ({ chargeId: c.chargeId, netAmount: c.netAmount, taxAmount: c.taxAmount, lineTotalAmount: c.lineTotalAmount })),
    documentAllowance: { amount: allowance, taxEffect: rowTax.lineTaxTotal.minus(rowTax.documentTaxTotal) },
    headerTotalAmount: totals.totalAmount,
  };
  assertMoneyInvariants(invariantOrder);

  return {
    calcVersion: COMMERCIAL_CALC_VERSION,
    decimalPlaces: decimals,
    discAllocMode: input.discAllocMode,
    lines,
    charges,
    document,
    taxLines,
    categoryTaxable,
    totals,
    orderReadyBy: readyBy.orderReadyBy,
    readyByIsOverride: readyBy.isOverride,
  };
}
