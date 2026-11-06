/**
 * Commercial line writer (ADR-060 §1, PLAN.md §4.1, §6, P5-01).
 *
 * Why: one place maps the calculator's result to the §6 columns, so Create,
 * Edit and the recompute can never store the same order differently. It is
 * the only writer of these columns. It builds Prisma data only; the caller
 * runs the writes inside its own transaction, after the item and piece rows
 * exist (their ids key the discount rows).
 *
 * Every amount goes through `toStorageString` (DECIMAL(19,4)), which refuses
 * to drop a digit, so nothing is rounded here (L22: rounded once, upstream).
 * Header totals are not written here: the rollup builds them from the rows (P5-02, I3).
 */
import 'server-only';

import type { Prisma } from '@prisma/client';
import {
  allocateMatrix,
  toStorageString,
  type AppliedAdjustment,
  type CommercialChargeResult,
  type CommercialLineResult,
  type CommercialOrderResult,
  type CommercialRowResult,
  type MoneyInput,
} from '@/lib/commercial';
import { DISC_ALLOC_MODES, PRICE_SOURCES } from '@/lib/constants/commercial';
import { CHARGE_TYPES } from '@/lib/constants/order-financial';
import { DISCOUNT_SOURCE_TYPE } from '@/lib/constants/discount-source-type';
import type { CommercialFacts, ResolvedLinePrice } from './commercial-context.loader';

const money = (value: MoneyInput) => toStorageString(value);
/** `tax_rate` is NUMERIC(5,2). */
const rate = (value: MoneyInput) => toStorageString(value, 2);

/** The §6.1 columns shared by item and piece rows. */
export interface LineMoneyColumns {
  money_basis: string;
  service_speed: string;
  ready_by_at: Date;
  price_source: string;
  price_list_id: string | null;
  speed_rule_id: string | null;
  list_unit_price: string;
  price_per_unit: string;
  total_price: string;
  service_pref_charge: string;
  speed_premium_amount: string;
  line_disc_amount: string;
  order_disc_alloc_amount: string;
  net_amount: string;
  tax_pricing_mode: string;
  tax_profile_id: string | null;
  tax_category_code: string;
  tax_exempt_reason: string | null;
  tax_rate: string;
  taxable_amount: string;
  tax_amount: string;
  line_total_amount: string;
}

/**
 * The §6.1 columns of one item or piece row.
 * @param row the item or piece result
 * @param line its line (speed and ready-by)
 * @param price the line's resolved standard and speed price
 * @param isOverride the line's price is a cashier override (`price_source` = MANUAL)
 * @param pricingMode the order's `tax_pricing_mode` (I6)
 * @returns the columns to spread into the row's create or update data
 */
export function lineMoneyColumns(
  row: CommercialRowResult,
  line: CommercialLineResult,
  price: ResolvedLinePrice,
  isOverride: boolean,
  pricingMode: string,
): LineMoneyColumns {
  const m = row.money;
  const ownSpeed = price.pieceSpeeds?.get(row.rowId);
  return {
    money_basis: row.moneyBasis,
    service_speed: ownSpeed?.serviceSpeed ?? price.serviceSpeed,
    ready_by_at: row.readyByAt ?? line.readyBy.readyByAt,
    // A cashier override or a custom item's entered price (no product) is MANUAL.
    price_source: isOverride || price.productId === null ? PRICE_SOURCES.MANUAL : price.standard.source,
    price_list_id: isOverride ? null : price.standard.priceListId,
    speed_rule_id: isOverride ? null : ownSpeed ? ownSpeed.ruleId : price.speed.ruleId,
    list_unit_price: money(m.listUnitPrice),
    price_per_unit: money(m.unitPrice),
    total_price: money(m.grossAmount),
    service_pref_charge: money(m.includedModifierAmount),
    speed_premium_amount: money(m.speedPremiumAmount),
    line_disc_amount: money(m.lineDiscountAmount),
    order_disc_alloc_amount: money(m.orderDiscountAllocAmount),
    net_amount: money(m.netAmount),
    tax_pricing_mode: pricingMode,
    tax_profile_id: row.tax.taxProfileId,
    tax_category_code: row.tax.taxCategoryCode,
    tax_exempt_reason: row.tax.exemptReason,
    tax_rate: rate(row.tax.taxRate),
    taxable_amount: money(m.taxableAmount),
    tax_amount: money(m.taxAmount),
    line_total_amount: money(m.lineTotalAmount),
  };
}

/**
 * The order's commercial snapshots, fixed at creation (§5.3); Edit never rewrites them.
 * @param result the calculated order
 * @param facts the facts it was calculated from
 * @param orderSpeed the order-wide speed the client chose
 * @returns `org_orders_mst` columns
 */
export function orderSnapshotColumns(result: CommercialOrderResult, facts: CommercialFacts, orderSpeed: string) {
  return {
    commercial_level: facts.level,
    tax_pricing_mode: facts.pricingMode,
    extra_price_pricing_mode: facts.extraPriceMode,
    disc_alloc_mode: facts.discAllocMode,
    disc_alloc_basis: facts.discAllocBasis,
    commercial_calc_version: result.calcVersion,
    service_speed: orderSpeed,
    speed_premium_amount: money(result.totals.speedPremiumTotal),
    ready_by: result.orderReadyBy,
  };
}

/** Labels and links the caller knows for an adjustment, keyed by adjustment id. */
export interface AdjustmentMeta {
  sourceId?: string | null;
  sourceName?: string | null;
  sourceName2?: string | null;
  /** C8 / PF-15: set for every applied promo, typed or automatic. */
  promotionId?: string | null;
  /** The cashier's reason for a manual line discount (P5-03c), stored in `rec_notes`. */
  notes?: string | null;
}

/** Labels and links for a charge, keyed by `chargeId`. */
export interface ChargeMeta {
  /** e.g. the `org_order_preferences_dtl` row the charge comes from. */
  sourceId?: string | null;
  label: string;
  label2?: string | null;
}

/** Labels for a header tax line, keyed by profile id. */
export interface TaxLineMeta {
  label: string;
  label2?: string | null;
}

/** Row ids and labels the child rows need. */
export interface CommercialChildRowsContext {
  tenantOrgId: string;
  orderId: string;
  currencyCode: string;
  userId: string | null;
  /** lineId → created `org_order_items_dtl.id`. */
  itemIds: ReadonlyMap<string, string>;
  /** piece rowId → created `org_order_item_pieces_dtl.id`. */
  pieceIds: ReadonlyMap<string, string>;
  adjustmentMeta: ReadonlyMap<string, AdjustmentMeta>;
  chargeMeta: ReadonlyMap<string, ChargeMeta>;
  taxLineMeta: ReadonlyMap<string, TaxLineMeta>;
}

/** The discount, charge and tax rows of one calculated order. */
export interface CommercialChildRows {
  discounts: Prisma.org_order_discounts_dtlUncheckedCreateInput[];
  charges: Prisma.org_order_charges_dtlUncheckedCreateInput[];
  taxes: Prisma.org_order_taxes_dtlUncheckedCreateInput[];
}

const required = (map: ReadonlyMap<string, string>, key: string, what: string): string => {
  const id = map.get(key);
  if (!id) throw new Error(`No created ${what} id for ${key}.`);
  return id;
};

/**
 * Builds the discount, charge and tax rows (§6.4, §6.5, `org_order_taxes_dtl`).
 *
 * - Line discounts: one ITEM (or PIECE) row per applied discount, the
 *   `PRICE_LIST` one included.
 * - Order discounts, `ALLOCATE_TO_LINES`: one ORDER row each; the shares
 *   live on the lines (`order_disc_alloc_amount`).
 * - Order discounts, `DOCUMENT_LEVEL`: one ORDER row per discount and tax
 *   category, split exactly both ways (`allocateMatrix`), so each discount
 *   adds up to its amount and each category to its allowance.
 * - Zero amounts get no row.
 * @param result the calculated order
 * @param ctx tenant, order, created row ids and labels
 * @returns the rows, ready for `createMany` in the caller's transaction
 * @throws Error when a created item or piece id is missing
 */
export function buildCommercialChildRows(result: CommercialOrderResult, ctx: CommercialChildRowsContext): CommercialChildRows {
  const base = { tenant_org_id: ctx.tenantOrgId, order_id: ctx.orderId, created_by: ctx.userId };
  const discounts: Prisma.org_order_discounts_dtlUncheckedCreateInput[] = [];
  const discountRow = (
    a: AppliedAdjustment,
    amount: MoneyInput,
    extra: Pick<Prisma.org_order_discounts_dtlUncheckedCreateInput, 'discount_level'> & Partial<Prisma.org_order_discounts_dtlUncheckedCreateInput>,
  ) => {
    const meta = ctx.adjustmentMeta.get(a.id) ?? {};
    // A price-list discount's id is its price list item.
    const defaultSourceId = a.source === DISCOUNT_SOURCE_TYPE.PRICE_LIST ? a.id : null;
    discounts.push({
      ...base,
      applied_seq: discounts.length + 1,
      source_type: a.source,
      source_id: meta.sourceId ?? defaultSourceId,
      source_name: meta.sourceName ?? null,
      source_name2: meta.sourceName2 ?? null,
      promotion_id: meta.promotionId ?? null,
      rec_notes: meta.notes ?? null,
      discount_type: a.calcType,
      discount_rate: a.rate ? a.rate.toString() : null,
      discount_amount: money(amount),
      ...extra,
    });
  };

  // ─── Line discounts ────────────────────────────────────────────────────
  for (const line of result.lines) {
    const pricedRows = line.item.pricing ? [line.item] : line.pieces.filter((p) => p.pricing);
    for (const row of pricedRows) {
      const isPiece = row !== line.item;
      for (const a of row.pricing!.adjustments) {
        if (a.amount.isZero()) continue;
        discountRow(a, a.amount, {
          discount_level: isPiece ? 'PIECE' : 'ITEM',
          order_item_id: required(ctx.itemIds, line.lineId, 'item'),
          order_item_piece_id: isPiece ? required(ctx.pieceIds, row.rowId, 'piece') : null,
        });
      }
    }
  }

  // ─── Order discounts ───────────────────────────────────────────────────
  const applied = result.document.adjustments.filter((a) => !a.amount.isZero());
  const categories = [...result.document.categoryShares].filter(([, share]) => !share.isZero());
  const orderRow = { discount_level: 'ORDER', order_item_id: null, order_item_piece_id: null };
  if (result.discAllocMode === DISC_ALLOC_MODES.DOCUMENT_LEVEL && applied.length > 0) {
    const cells = allocateMatrix(applied.map((a) => a.amount), categories.map(([, s]) => s), result.decimalPlaces);
    applied.forEach((a, i) => categories.forEach(([category], j) => {
      if (cells[i][j].isZero()) return;
      discountRow(a, cells[i][j], { ...orderRow, disc_alloc_mode: DISC_ALLOC_MODES.DOCUMENT_LEVEL, tax_category_code: category });
    }));
  } else {
    applied.forEach((a) => discountRow(a, a.amount, { ...orderRow, disc_alloc_mode: DISC_ALLOC_MODES.ALLOCATE_TO_LINES, tax_category_code: null }));
  }

  // ─── Charges ───────────────────────────────────────────────────────────
  const charges = result.charges.filter((c) => !c.netAmount.isZero()).map((c: CommercialChargeResult, i) => {
    const meta = ctx.chargeMeta.get(c.chargeId);
    if (!meta) throw new Error(`No label for charge ${c.chargeId}.`);
    return {
      ...base,
      applied_seq: i + 1,
      // Every calculator charge today is a preference extra (line SEPARATE or order-level).
      charge_type: CHARGE_TYPES.PREFERENCE,
      charge_source_id: meta.sourceId ?? null,
      label: meta.label,
      label2: meta.label2 ?? null,
      amount: money(c.netAmount),
      currency_code: ctx.currencyCode,
      tax_category_code: c.tax?.taxCategoryCode ?? null,
      tax_profile_id: c.tax?.taxProfileId ?? null,
      tax_rate: c.tax ? rate(c.tax.taxRate) : null,
      taxable_amount: c.tax ? money(c.taxableAmount) : null,
      tax_amount: c.tax ? money(c.taxAmount) : null,
    } satisfies Prisma.org_order_charges_dtlUncheckedCreateInput;
  });

  // ─── Header tax lines ──────────────────────────────────────────────────
  const taxes = result.taxLines.map((line, i) => {
    const meta = ctx.taxLineMeta.get(line.profileId);
    if (!meta) throw new Error(`No label for tax profile ${line.profileId}.`);
    return {
      ...base,
      applied_seq: i + 1,
      // The tenant-rate fallback has no profile row (written NULL, as today).
      tax_profile_id: line.isTenantRateFallback ? null : line.profileId,
      tax_type: line.taxType,
      label: meta.label,
      label2: meta.label2 ?? null,
      rate: line.ratePercent.toString(),
      is_compound: line.isCompound,
      taxable_amount: money(line.taxableAmount),
      tax_amount: money(line.taxAmount),
      currency_code: ctx.currencyCode,
    } satisfies Prisma.org_order_taxes_dtlUncheckedCreateInput;
  });

  return { discounts, charges, taxes };
}
