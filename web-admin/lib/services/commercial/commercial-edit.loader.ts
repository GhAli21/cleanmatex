/**
 * Order Edit on the commercial calculator (Line-Level P6-01; Reusable View
 * P1B-04, P1B-06, P1B-07; ADR-060 §1, PLAN.md §5.3, L24, D22).
 *
 * Why: Edit must store the same figures Create would for the same order, so
 * it runs the one calculator, not a second one. What differs is where the
 * facts come from:
 * - the order's own snapshots (level, tax mode, extra-price mode, discount
 *   allocation) and its recorded tax profiles and rates, never today's settings;
 * - a line already on the order keeps its stored list price, price-list
 *   discount, speed premium and ready-by (L24); its speed rule is read again
 *   only when its speed changes, and its ready-by is then counted again;
 * - a new line is priced from the catalog on the edit date, like Create;
 * - preferences keep the price on their row (a new row carries the price the
 *   review read from the catalog);
 * - recorded line discounts are kept as recorded (a percentage applied again,
 *   an amount kept); recorded order discounts are re-evaluated on the new base
 *   (D21, `edit-discount-reevaluation.ts`) and each change is reported.
 *
 * Two parts, so the mapping is testable without a database:
 * - `readEditOrderRecord`: the reads; every `org_*` query filters
 *   `tenant_org_id` explicitly (CRITICAL RULE #4);
 * - `buildEditIntent`: record + projected edit → calculator intents.
 */
import 'server-only';

import type { PrismaClient } from '@prisma/client';
import { toMoney, type AdjustmentInput, type StandardPriceResult } from '@/lib/commercial';
import { PRICE_SOURCES, type CommercialLevel, type DiscAllocBasis, type DiscAllocMode } from '@/lib/constants/commercial';
import { DISCOUNT_CALC_TYPE, DISCOUNT_SOURCE_TYPE, MANUAL_LINE_DISCOUNT_LABEL, type DiscountCalcType } from '@/lib/constants/discount-source-type';
import { CHARGE_TYPES, type ExtraPricePricingMode, type TaxPricingMode } from '@/lib/constants/order-financial';
import { PREFS_LEVEL } from '@/lib/constants/order-preferences';
import {
  PRICED_PREFERENCE_SYS_KINDS,
  TENANT_RATE_PROFILE_ID,
  type CommercialDb,
  type CommercialLoaderDeps,
  type CommercialOrderIntent,
  type CustomItemIntent,
  type LineIntent, type PieceIntent,
  type PreferenceIntent,
  type ProductFacts,
  type RecordedCommercialSnapshot,
  type RecordedTaxProfile,
} from './commercial-context.loader';
import type { AdjustmentMeta } from './commercial-line.writer';
import { quoteCommercialOrder, type CommercialQuote } from './commercial-quote.service';
import {
  discountChangesOf,
  reevaluateOrderDiscounts,
  type DiscountChange,
  type DiscountRemovalReason,
  type EditDiscountRule,
  type EditPromotion,
  type RecordedOrderDiscount,
} from './edit-discount-reevaluation';

// ─── Errors ────────────────────────────────────────────────────────────────

/** Why an order cannot be re-priced in Edit; the routes map each code to an EN/AR message. */
export const COMMERCIAL_EDIT_ERRORS = {
  /** The order was written before the calculator (no snapshots or line prices): owner decision 2026-10-28. */
  ORDER_NEEDS_RECOMPUTE: 'ORDER_NEEDS_RECOMPUTE',
} as const;
/** Derived union of the Edit pricing error codes. */
export type CommercialEditErrorCode = (typeof COMMERCIAL_EDIT_ERRORS)[keyof typeof COMMERCIAL_EDIT_ERRORS];

/** An order Edit cannot re-price. */
export class CommercialEditError extends Error {
  readonly code: CommercialEditErrorCode;

  constructor(code: CommercialEditErrorCode, message: string) {
    super(message);
    this.name = 'CommercialEditError';
    this.code = code;
  }
}

// ─── Record (what is stored) ───────────────────────────────────────────────

/** One active item row with its §6.1 money. */
export interface EditStoredItem {
  id: string;
  productId: string | null;
  quantity: number;
  serviceCategoryCode: string | null;
  serviceSpeed: string | null;
  readyByAt: Date | null;
  priceSource: string | null;
  priceListId: string | null;
  speedRuleId: string | null;
  listUnitPrice: string | null;
  pricePerUnit: string;
  speedPremiumAmount: string | null;
  priceOverride: string | null;
  taxCategoryCode: string | null;
  taxExemptReason: string | null;
}

/** One active piece row, in `piece_seq` order. */
export interface EditStoredPiece {
  id: string;
  itemId: string;
  pieceSeq: number;
  /** The figures a piece with its own speed keeps through an edit (P9-01). */
  serviceSpeed: string | null;
  pricePerUnit: string | null;
  speedPremiumAmount: string | null;
  speedRuleId: string | null;
  readyByAt: Date | null;
}

/** One active preference row and its stored price. */
export interface EditStoredPreference {
  id: string;
  level: string;
  itemId: string | null;
  pieceId: string | null;
  code: string;
  sysKind: string;
  amount: string;
}

/** One active, non-voided discount row. */
export interface EditStoredDiscount {
  id: string;
  level: string | null;
  itemId: string | null;
  pieceId: string | null;
  sourceType: string;
  sourceId: string | null;
  sourceName: string | null;
  sourceName2: string | null;
  promotionId: string | null;
  discountType: string;
  discountRate: string | null;
  discountAmount: string;
  notes: string | null;
  appliedSeq: number;
}

/** One active, non-voided charge row. */
export interface EditStoredCharge {
  id: string;
  chargeType: string;
  sourceId: string | null;
  amount: string;
  taxCategoryCode: string | null;
}

/** One active header tax line. */
export interface EditStoredTaxLine {
  profileId: string | null;
  taxType: string;
  label: string;
  label2: string | null;
  ratePercent: string;
  isCompound: boolean;
}

/** The rounding and scope facts of a profile the order was taxed with. */
export interface EditTaxProfileRow {
  id: string;
  appliesTo: readonly string[] | null;
  roundingLevel: string;
  roundingMode: string | null;
  outputDecimalPlaces: number | null;
  incrementMinor: number | null;
}

/** Everything Edit reads about one order before re-pricing it. */
export interface EditOrderRecord {
  orderId: string;
  branchId: string | null;
  customerId: string | null;
  serviceSpeed: string;
  /** When the ready-by clock started (received time, else creation time). */
  readyByStartAt: Date;
  calcVersion: number | null;
  snapshot: Pick<RecordedCommercialSnapshot, 'level' | 'discAllocMode' | 'discAllocBasis' | 'pricingMode' | 'extraPriceMode'> | null;
  /** In tie-break order (`rec_order`, then creation). */
  items: EditStoredItem[];
  pieces: EditStoredPiece[];
  preferences: EditStoredPreference[];
  discounts: EditStoredDiscount[];
  charges: EditStoredCharge[];
  taxLines: EditStoredTaxLine[];
  /** Products of the stored lines, read without the active filter. */
  products: ReadonlyMap<string, ProductFacts>;
  taxProfiles: ReadonlyMap<string, EditTaxProfileRow>;
  /** The rules the recorded discounts came from, read without the active filter (D21). */
  discountRules: ReadonlyMap<string, EditDiscountRule>;
  /** The promotions the recorded discounts came from, read without the active filter (D21). */
  promotions: ReadonlyMap<string, EditPromotion>;
}

/** The reads `readEditOrderRecord` needs (the Prisma client or a transaction client). */
export type EditRecordDb = Pick<PrismaClient,
  | 'org_orders_mst' | 'org_order_items_dtl' | 'org_order_item_pieces_dtl' | 'org_order_preferences_dtl'
  | 'org_order_discounts_dtl' | 'org_order_charges_dtl' | 'org_order_taxes_dtl' | 'org_product_data_mst'
  | 'org_tax_profiles_cf' | 'org_discount_rules_cf' | 'org_promotions_mst'>;

const text = (value: { toString(): string } | null | undefined): string | null => (value == null ? null : value.toString());
const amount = (value: { toString(): string } | null | undefined): string => text(value) ?? '0';

/**
 * Reads one order's commercial record for Edit.
 * @param db the Prisma client or the caller's transaction client
 * @param tenantOrgId the session tenant (resolved server-side by the caller)
 * @param orderId the order being edited
 * @returns the stored snapshots, lines, preferences, discounts, charges and tax lines
 * @throws Error when the order does not exist for this tenant
 * @example
 * const record = await readEditOrderRecord(prisma, tenantOrgId, orderId);
 */
export async function readEditOrderRecord(db: EditRecordDb, tenantOrgId: string, orderId: string): Promise<EditOrderRecord> {
  const scope = { tenant_org_id: tenantOrgId, order_id: orderId };
  const [order, items, pieces, preferences, discounts, charges, taxLines] = await Promise.all([
    db.org_orders_mst.findFirst({
      where: { id: orderId, tenant_org_id: tenantOrgId },
      select: {
        id: true, branch_id: true, customer_id: true, service_speed: true, received_at: true, created_at: true,
        commercial_calc_version: true, commercial_level: true, tax_pricing_mode: true, extra_price_pricing_mode: true,
        disc_alloc_mode: true, disc_alloc_basis: true,
      },
    }),
    db.org_order_items_dtl.findMany({
      where: { ...scope, rec_status: 1 },
      orderBy: [{ rec_order: 'asc' }, { created_at: 'asc' }, { id: 'asc' }],
      select: {
        id: true, product_id: true, quantity: true, service_category_code: true, service_speed: true, ready_by_at: true,
        price_source: true, price_list_id: true, speed_rule_id: true, list_unit_price: true, price_per_unit: true,
        speed_premium_amount: true, price_override: true, tax_category_code: true, tax_exempt_reason: true,
      },
    }),
    db.org_order_item_pieces_dtl.findMany({
      where: { ...scope, rec_status: 1 },
      orderBy: [{ piece_seq: 'asc' }, { id: 'asc' }],
      select: {
        id: true, order_item_id: true, piece_seq: true, service_speed: true, price_per_unit: true,
        speed_premium_amount: true, speed_rule_id: true, ready_by_at: true,
      },
    }),
    db.org_order_preferences_dtl.findMany({
      where: { ...scope, rec_status: 1 },
      orderBy: [{ prefs_no: 'asc' }, { id: 'asc' }],
      select: {
        id: true, prefs_level: true, order_item_id: true, order_item_piece_id: true,
        preference_code: true, preference_sys_kind: true, extra_price: true,
      },
    }),
    db.org_order_discounts_dtl.findMany({
      where: { ...scope, rec_status: 1, is_voided: false },
      orderBy: [{ applied_seq: 'asc' }, { id: 'asc' }],
      select: {
        id: true, discount_level: true, order_item_id: true, order_item_piece_id: true, source_type: true, source_id: true,
        source_name: true, source_name2: true, promotion_id: true, discount_type: true, discount_rate: true,
        discount_amount: true, rec_notes: true, applied_seq: true,
      },
    }),
    db.org_order_charges_dtl.findMany({
      where: { ...scope, rec_status: 1, is_voided: false },
      orderBy: [{ applied_seq: 'asc' }, { id: 'asc' }],
      select: { id: true, charge_type: true, charge_source_id: true, amount: true, tax_category_code: true },
    }),
    db.org_order_taxes_dtl.findMany({
      where: { ...scope, rec_status: 1 },
      orderBy: [{ applied_seq: 'asc' }, { id: 'asc' }],
      select: { tax_profile_id: true, tax_type: true, label: true, label2: true, rate: true, is_compound: true },
    }),
  ]);
  if (!order) throw new Error(`Order ${orderId} not found for this tenant.`);

  const productIds = [...new Set(items.map((i) => i.product_id).filter((id): id is string => id != null))];
  const profileIds = [...new Set(taxLines.map((t) => t.tax_profile_id).filter((id): id is string => id != null))];
  const ruleIds = [...new Set(discounts.filter((d) => d.source_type === DISCOUNT_SOURCE_TYPE.DISCOUNT_RULE)
    .map((d) => d.source_id).filter((id): id is string => id != null))];
  const promotionIds = [...new Set(discounts.filter((d) => d.source_type === DISCOUNT_SOURCE_TYPE.PROMO_CODE)
    .map((d) => d.promotion_id ?? d.source_id).filter((id): id is string => id != null))];
  const [products, profiles, rules, promotions] = await Promise.all([
    db.org_product_data_mst.findMany({
      where: { tenant_org_id: tenantOrgId, id: { in: productIds } },
        select: {
          is_retail_item: true,
          id: true, service_category_code: true, price_type: true, default_sell_price: true, min_sell_price: true,
          turnaround_hh: true, tax_category_code: true, tax_supply_code: true, tax_exempt_reason: true,
        },
    }),
    db.org_tax_profiles_cf.findMany({
      where: { tenant_org_id: tenantOrgId, id: { in: profileIds } },
      select: {
        id: true, applies_to: true, rounding_level: true, rounding_mode: true,
        output_decimal_places: true, rounding_increment_minor: true,
      },
    }),
    ruleIds.length > 0
      ? db.org_discount_rules_cf.findMany({
        where: { tenant_org_id: tenantOrgId, id: { in: ruleIds } },
        select: { id: true, discount_type: true, discount_value: true, conditions: true },
      })
      : [],
    promotionIds.length > 0
      ? db.org_promotions_mst.findMany({
        where: { tenant_org_id: tenantOrgId, id: { in: promotionIds } },
        select: {
          id: true, discount_type: true, discount_value: true, max_discount_amount: true,
          min_order_amount: true, max_order_amount: true, applicable_categories: true,
        },
      })
      : [],
  ]);

  const s = order;
  const snapshot = s.commercial_level && s.tax_pricing_mode && s.extra_price_pricing_mode && s.disc_alloc_mode && s.disc_alloc_basis
    ? {
      level: s.commercial_level as CommercialLevel,
      pricingMode: s.tax_pricing_mode as TaxPricingMode,
      extraPriceMode: s.extra_price_pricing_mode as ExtraPricePricingMode,
      discAllocMode: s.disc_alloc_mode as DiscAllocMode,
      discAllocBasis: s.disc_alloc_basis as DiscAllocBasis,
    }
    : null;

  return {
    orderId: order.id,
    branchId: order.branch_id,
    customerId: order.customer_id,
    serviceSpeed: order.service_speed ?? 'STANDARD',
    readyByStartAt: order.received_at ?? order.created_at ?? new Date(0),
    calcVersion: order.commercial_calc_version,
    snapshot,
    items: items.map((i) => ({
      id: i.id,
      productId: i.product_id,
      quantity: Number(i.quantity ?? 1),
      serviceCategoryCode: i.service_category_code,
      serviceSpeed: i.service_speed,
      readyByAt: i.ready_by_at,
      priceSource: i.price_source,
      priceListId: i.price_list_id,
      speedRuleId: i.speed_rule_id,
      listUnitPrice: text(i.list_unit_price),
      pricePerUnit: amount(i.price_per_unit),
      speedPremiumAmount: text(i.speed_premium_amount),
      priceOverride: text(i.price_override),
      taxCategoryCode: i.tax_category_code,
      taxExemptReason: i.tax_exempt_reason,
    })),
    pieces: pieces.map((p) => ({
      id: p.id,
      itemId: p.order_item_id,
      pieceSeq: p.piece_seq ?? 0,
      serviceSpeed: p.service_speed,
      pricePerUnit: text(p.price_per_unit),
      speedPremiumAmount: text(p.speed_premium_amount),
      speedRuleId: p.speed_rule_id,
      readyByAt: p.ready_by_at,
    })),
    preferences: preferences.map((p) => ({
      id: p.id,
      level: p.prefs_level,
      itemId: p.order_item_id,
      pieceId: p.order_item_piece_id,
      code: p.preference_code,
      sysKind: p.preference_sys_kind ?? '',
      amount: amount(p.extra_price),
    })),
    discounts: discounts.map((d) => ({
      id: d.id,
      level: d.discount_level,
      itemId: d.order_item_id,
      pieceId: d.order_item_piece_id,
      sourceType: d.source_type,
      sourceId: d.source_id,
      sourceName: d.source_name,
      sourceName2: d.source_name2,
      promotionId: d.promotion_id,
      discountType: d.discount_type,
      discountRate: text(d.discount_rate),
      discountAmount: amount(d.discount_amount),
      notes: d.rec_notes,
      appliedSeq: d.applied_seq ?? 0,
    })),
    charges: charges.map((c) => ({
      id: c.id,
      chargeType: c.charge_type,
      sourceId: c.charge_source_id,
      amount: amount(c.amount),
      taxCategoryCode: c.tax_category_code,
    })),
    taxLines: taxLines.map((t) => ({
      profileId: t.tax_profile_id,
      taxType: t.tax_type,
      label: t.label,
      label2: t.label2,
      ratePercent: amount(t.rate),
      isCompound: t.is_compound ?? false,
    })),
    products: new Map(products.map((p) => [p.id, {
      id: p.id,
      serviceCategoryCode: p.service_category_code,
      priceType: p.price_type,
      defaultSellPrice: text(p.default_sell_price),
      minSellPrice: text(p.min_sell_price),
      turnaroundHours: text(p.turnaround_hh),
      isRetailItem: p.is_retail_item === true,
      taxCategoryCode: p.tax_category_code,
      taxSupplyCode: p.tax_supply_code,
      taxExemptReason: p.tax_exempt_reason,
    }])),
    taxProfiles: new Map(profiles.map((p) => [p.id, {
      id: p.id,
      appliesTo: p.applies_to,
      roundingLevel: p.rounding_level,
      roundingMode: p.rounding_mode,
      outputDecimalPlaces: p.output_decimal_places,
      incrementMinor: p.rounding_increment_minor,
    }])),
    discountRules: new Map(rules.map((r): [string, EditDiscountRule] => [r.id, {
      id: r.id, discountType: r.discount_type, discountValue: r.discount_value.toString(), conditions: r.conditions,
    }])),
    promotions: new Map(promotions.map((p): [string, EditPromotion] => [p.id, {
      id: p.id,
      discountType: p.discount_type,
      discountValue: p.discount_value.toString(),
      maxDiscountAmount: text(p.max_discount_amount),
      minOrderAmount: text(p.min_order_amount),
      maxOrderAmount: text(p.max_order_amount),
      applicableCategories: p.applicable_categories,
    }])),
  };
}

// ─── Projection (what the edit asks for) ───────────────────────────────────

/** A cashier's line discount set by the edit (P6-02c). */
export interface EditLineDiscount {
  type: DiscountCalcType;
  /** The percent or the amount, as money text. */
  value: string;
  reason: string;
}

/** One line after the edit. */
export interface EditProjectedLine {
  /** The stored item id, or the new line's client reference. */
  id: string;
  /** What the edit sets on this line's pieces (P9-01), by piece id. */
  pieceChanges?: ReadonlyMap<string, { serviceSpeed?: string; lineDiscount?: EditLineDiscount | null }>;
  quantity: number;
  /** The line's speed after the edit; null keeps a stored line's speed (a new line takes the order speed). */
  serviceSpeed: string | null;
  /** Active pieces after the edit: stored ones by `piece_seq`, then new ones. */
  pieceIds: readonly string[];
  /** New lines only: the catalog product. */
  productId?: string | null;
  /** New lines only: a line with no catalog product, at its entered price (P6-02d). */
  customItem?: CustomItemIntent | null;
  /** An authorized cashier price; on a stored line, absent keeps its own and null clears it (P6-02c). */
  overrideUnitPrice?: string | null;
  /** The line's cashier discount; on a stored line, absent keeps its own and null removes it (P6-02c). */
  lineDiscount?: EditLineDiscount | null;
}

/** One active preference row after the edit, with its price. */
export interface EditProjectedPreference {
  id: string;
  level: string;
  itemId: string | null;
  pieceId: string | null;
  code: string;
  /** `preference_sys_kind` of the row, or the catalog kind of a new one. */
  sysKind: string;
  amount: string;
}

/** The whole order after the edit. */
export interface EditProjection {
  /** The order-wide speed after the edit. */
  serviceSpeed: string;
  /** Active lines; stored ones keep their order, new ones follow. */
  lines: readonly EditProjectedLine[];
  preferences: readonly EditProjectedPreference[];
  /** The edit time: new-line prices and speed rules are read at it. */
  editedAt: Date;
}

/** Intents and the labels the writer needs to store the calculated order. */
export interface EditIntent {
  intent: CommercialOrderIntent;
  recorded: RecordedCommercialSnapshot;
  /** Labels and links of every kept discount, keyed by adjustment id. */
  adjustmentMeta: ReadonlyMap<string, AdjustmentMeta>;
  /** Stored charge kept as it is, keyed by its calculator charge id. */
  keptChargeIds: ReadonlyMap<string, string>;
  /** The recorded ORDER discounts, in applied order; `quoteOrderEdit` re-evaluates them (D21). */
  recordedOrderDiscounts: readonly RecordedOrderDiscount[];
}

/** The calculator id of a stored charge Edit keeps unchanged. */
export const keptChargeId = (chargeRowId: string): string => `kept:${chargeRowId}`;

const isGeneral = (appliesTo: readonly string[] | null) => !appliesTo || appliesTo.length === 0;

/**
 * The profiles an order was taxed with (D22): the rate on its tax line, the
 * rounding and scope of the profile row. A general profile is a default; a
 * supply-code profile is chosen by its code, as at creation.
 * @param record the stored tax lines and profile rows
 * @returns the recorded profiles and their labels
 */
export function recordedTaxContext(record: Pick<EditOrderRecord, 'taxLines' | 'taxProfiles'>): Pick<RecordedCommercialSnapshot, 'taxProfiles' | 'taxProfileLabels'> {
  const taxProfiles: RecordedTaxProfile[] = [];
  const taxProfileLabels = new Map<string, { label: string; label2: string | null }>();
  for (const line of record.taxLines) {
    const id = line.profileId ?? TENANT_RATE_PROFILE_ID;
    const row = line.profileId ? record.taxProfiles.get(line.profileId) : undefined;
    const appliesTo = row?.appliesTo ?? null;
    taxProfiles.push({
      id,
      taxType: line.taxType,
      ratePercent: line.ratePercent,
      isCompound: line.isCompound,
      isDefault: isGeneral(appliesTo),
      appliesTo,
      roundingLevel: row?.roundingLevel ?? 'DOCUMENT',
      outputDecimalPlaces: row?.outputDecimalPlaces ?? null,
      roundingMode: row?.roundingMode ?? null,
      incrementMinor: row?.incrementMinor ?? null,
      ...(line.profileId ? {} : { isTenantRateFallback: true }),
    });
    taxProfileLabels.set(id, { label: line.label, label2: line.label2 });
  }
  return { taxProfiles, taxProfileLabels };
}

/**
 * A stored discount row as a calculator adjustment: a percentage is applied
 * again on the new base, an amount is kept.
 */
const adjustmentOf = (id: string, rows: readonly EditStoredDiscount[]): AdjustmentInput => {
  const first = rows[0];
  const isPercent = first.discountType === DISCOUNT_CALC_TYPE.PERCENTAGE && first.discountRate != null;
  const value = isPercent
    ? first.discountRate as string
    : rows.reduce((sum, r) => sum.plus(toMoney(r.discountAmount)), toMoney(0)).toString();
  return {
    id,
    source: first.sourceType,
    calcType: isPercent ? DISCOUNT_CALC_TYPE.PERCENTAGE : DISCOUNT_CALC_TYPE.FIXED_AMOUNT as DiscountCalcType,
    value,
  };
};

const metaOf = (row: EditStoredDiscount): AdjustmentMeta => ({
  sourceId: row.sourceId,
  sourceName: row.sourceName,
  sourceName2: row.sourceName2,
  promotionId: row.promotionId,
  notes: row.notes,
});

/**
 * The stored premium of a line, split back into its unit and per-line parts
 * (unit premium = unit price − list price; the rest of the stored premium is per line).
 */
function storedSpeed(item: EditStoredItem): { unitPremium: string; linePremium: string; ruleId: string | null } {
  if (item.priceOverride != null) return { unitPremium: '0', linePremium: '0', ruleId: item.speedRuleId };
  const unitPremium = toMoney(item.pricePerUnit).minus(toMoney(item.listUnitPrice as string));
  const linePremium = toMoney(item.speedPremiumAmount ?? '0').minus(unitPremium.times(item.quantity));
  return { unitPremium: unitPremium.toString(), linePremium: linePremium.toString(), ruleId: item.speedRuleId };
}

/** A piece on its own speed is stored with a speed other than its line's (every piece row stores one). */
const hasOwnSpeed = (piece: EditStoredPiece, item: EditStoredItem) =>
  piece.serviceSpeed != null && piece.serviceSpeed !== item.serviceSpeed;

/** A piece's stored premium, as its own one-unit line: what it keeps while its speed is unchanged. */
function storedPieceSpeed(piece: EditStoredPiece, item: EditStoredItem) {
  if (item.priceOverride != null) return { unitPremium: '0', linePremium: '0', ruleId: piece.speedRuleId };
  const unitPremium = toMoney(piece.pricePerUnit ?? '0').minus(toMoney(item.listUnitPrice as string));
  const linePremium = toMoney(piece.speedPremiumAmount ?? '0').minus(unitPremium);
  return { unitPremium: unitPremium.toString(), linePremium: linePremium.toString(), ruleId: piece.speedRuleId };
}

/**
 * The stored premium of a line with pieces on their own speed: only the pieces that
 * follow the line count, because the item's own figures are the sum of them all.
 */
function storedFollowerSpeed(item: EditStoredItem, pieces: readonly EditStoredPiece[]) {
  const followers = pieces.filter((p) => !hasOwnSpeed(p, item));
  const [first] = followers;
  if (!first) return { unitPremium: '0', linePremium: '0', ruleId: item.speedRuleId };
  const own = storedPieceSpeed(first, item);
  const premium = followers.reduce((sum, p) => sum.plus(p.speedPremiumAmount ?? '0'), toMoney(0));
  return {
    unitPremium: own.unitPremium,
    linePremium: premium.minus(toMoney(own.unitPremium).times(followers.length)).toString(),
    ruleId: item.speedRuleId,
  };
}

/**
 * Turns the stored order and the projected edit into calculator intents.
 * @param record what `readEditOrderRecord` read
 * @param projection the order after the edit (lines, pieces, preferences, speed)
 * @returns the intents, the recorded snapshot and the labels the writer needs
 * @throws CommercialEditError ORDER_NEEDS_RECOMPUTE for an order written before the calculator
 * @example
 * const { intent, recorded } = buildEditIntent(record, { serviceSpeed: 'STANDARD', lines, preferences: [], editedAt: new Date() });
 */
export function buildEditIntent(record: EditOrderRecord, projection: EditProjection): EditIntent {
  if (record.calcVersion == null || !record.snapshot || record.items.some((i) => i.listUnitPrice == null)) {
    throw new CommercialEditError(COMMERCIAL_EDIT_ERRORS.ORDER_NEEDS_RECOMPUTE,
      'This order was saved before line-level pricing; its prices must be recalculated before they can be edited.');
  }
  const stored = new Map(record.items.map((i) => [i.id, i] as const));
  const piecesByItem = new Map<string, string[]>();
  for (const piece of record.pieces) piecesByItem.set(piece.itemId, [...(piecesByItem.get(piece.itemId) ?? []), piece.id]);
  const adjustmentMeta = new Map<string, AdjustmentMeta>();

  // ─── Preferences, by owner ─────────────────────────────────────────────
  const prefIntent = (p: EditProjectedPreference): PreferenceIntent[] => {
    const kind = PRICED_PREFERENCE_SYS_KINDS[p.sysKind];
    return kind ? [{ code: p.code, kind, amount: p.amount, rowId: p.id }] : [];
  };
  const prefsAt = (level: string, ownerId: string | null) => projection.preferences
    .filter((p) => p.level === level && (level === PREFS_LEVEL.PIECE ? p.pieceId === ownerId : level === PREFS_LEVEL.ITEM ? p.itemId === ownerId : true))
    .flatMap(prefIntent);

  // ─── Lines: stored ones in their order, then new ones ─────────────────
  const projected = new Map(projection.lines.map((l) => [l.id, l] as const));
  const ordered = [
    ...record.items.filter((i) => projected.has(i.id)).map((i) => projected.get(i.id) as EditProjectedLine),
    ...projection.lines.filter((l) => !stored.has(l.id)),
  ];
  // A cashier line discount set by the edit, labelled as on Create and carrying its reason.
  const manualDiscount = (lineId: string, discount: EditLineDiscount | null | undefined): AdjustmentInput[] => {
    if (!discount) return [];
    const id = `${lineId}:manual`;
    adjustmentMeta.set(id, { ...MANUAL_LINE_DISCOUNT_LABEL, notes: discount.reason });
    return [{ id, source: DISCOUNT_SOURCE_TYPE.MANUAL, calcType: discount.type, value: discount.value }];
  };
  const lines: LineIntent[] = ordered.map((line) => {
    const item = stored.get(line.id);
    const serviceSpeed = line.serviceSpeed ?? item?.serviceSpeed ?? projection.serviceSpeed;
    const storedPieceById = new Map(record.pieces.filter((p) => p.itemId === line.id).map((p) => [p.id, p] as const));
    // A discount the edit sets on the line replaces the cashier discounts of its pieces too.
    const replacesPieceManual = line.lineDiscount !== undefined;
    const pieces = line.pieceIds.map((pieceId): PieceIntent => {
      const stored = storedPieceById.get(pieceId);
      const change = line.pieceChanges?.get(pieceId);
      const replaces = replacesPieceManual || change?.lineDiscount !== undefined;
      const discounts = [
        ...record.discounts
          .filter((d) => d.pieceId === pieceId && d.sourceType !== DISCOUNT_SOURCE_TYPE.PRICE_LIST
            && !(replaces && d.sourceType === DISCOUNT_SOURCE_TYPE.MANUAL))
          .map((d, k) => {
            const id = `${pieceId}:d${k + 1}`;
            adjustmentMeta.set(id, metaOf(d));
            return adjustmentOf(id, [d]);
          }),
        ...manualDiscount(pieceId, change?.lineDiscount),
      ];
      const ownStored = item && stored && hasOwnSpeed(stored, item) ? stored : null;
      const pieceSpeed = change?.serviceSpeed ?? ownStored?.serviceSpeed ?? null;
      return {
        pieceId,
        preferences: prefsAt(PREFS_LEVEL.PIECE, pieceId),
        discounts,
        serviceSpeed: pieceSpeed,
        // Unchanged, it keeps the premium and ready time agreed at drop-off (L24).
        pinnedSpeed: item && ownStored && !change?.serviceSpeed
          ? { ...storedPieceSpeed(ownStored, item), readyByAt: ownStored.readyByAt }
          : null,
      };
    });
    const base = {
      lineId: line.id,
      quantity: line.quantity,
      serviceSpeed,
      preferences: prefsAt(PREFS_LEVEL.ITEM, line.id),
      pieces,
    };
    if (!item) {
      return {
        ...base,
        productId: line.productId ?? null,
        customItem: line.customItem ?? null,
        overrideUnitPrice: line.overrideUnitPrice ?? null,
        lineDiscounts: manualDiscount(line.id, line.lineDiscount),
      };
    }

    // ─── A stored line keeps its agreed price (L24) ──────────────────────
    const own = record.discounts.filter((d) => d.itemId === item.id && d.level !== 'ORDER');
    const priceList = own.find((d) => d.sourceType === DISCOUNT_SOURCE_TYPE.PRICE_LIST);
    const itemPieces = record.pieces.filter((p) => p.itemId === item.id);
    const mixedSpeeds = itemPieces.some((p) => hasOwnSpeed(p, item));
    const firstFollower = itemPieces.find((p) => !hasOwnSpeed(p, item));
    // A discount the edit sets replaces the line's own cashier discount (P6-02c).
    const replacesManual = line.lineDiscount !== undefined;
    const lineDiscounts = [
      // A piece's discounts stay on the piece (P9-01); a price list applies through the unit price.
      ...own.filter((d) => d.pieceId == null && d.sourceType !== DISCOUNT_SOURCE_TYPE.PRICE_LIST && !(replacesManual && d.sourceType === DISCOUNT_SOURCE_TYPE.MANUAL)).map((d, k) => {
        const id = `${item.id}:d${k + 1}`;
        adjustmentMeta.set(id, metaOf(d));
        return adjustmentOf(id, [d]);
      }),
      ...manualDiscount(item.id, line.lineDiscount),
    ];
    const listUnitPrice = item.listUnitPrice as string;
    const source = item.priceSource === PRICE_SOURCES.PRICE_LIST || item.priceSource === PRICE_SOURCES.CUSTOMER_PRICE
      ? item.priceSource
      : PRICE_SOURCES.PRODUCT_DEFAULT;
    const standard: StandardPriceResult = {
      unitPrice: toMoney(listUnitPrice),
      source,
      priceListId: item.priceListId,
      priceListItemId: priceList?.sourceId ?? null,
      priceListDiscountPercent: toMoney(priceList?.discountRate ?? '0'),
    };
    const product = item.productId ? record.products.get(item.productId) : undefined;
    const speedChanged = serviceSpeed !== item.serviceSpeed;
    const overrideUnitPrice = line.overrideUnitPrice !== undefined ? line.overrideUnitPrice : item.priceOverride;
    // A cleared cashier price returns to the list price and the speed rule in force today.
    const overrideCleared = item.priceOverride != null && overrideUnitPrice == null;
    return {
      ...base,
      productId: item.productId,
      // A custom line keeps its entered price as its list price.
      customItem: item.productId ? null : { unitPrice: listUnitPrice, serviceCategoryCode: item.serviceCategoryCode },
      overrideUnitPrice,
      lineDiscounts,
      pinned: {
        product: {
          id: item.productId,
          serviceCategoryCode: product?.serviceCategoryCode ?? item.serviceCategoryCode,
          priceType: product?.priceType ?? null,
          defaultSellPrice: product?.defaultSellPrice ?? listUnitPrice,
          minSellPrice: null,
          turnaroundHours: product?.turnaroundHours ?? null,
          isRetailItem: product?.isRetailItem ?? false,
          taxCategoryCode: item.taxCategoryCode ?? 'STANDARD',
          taxSupplyCode: product?.taxSupplyCode ?? null,
          taxExemptReason: item.taxExemptReason,
        },
        standard,
        // A changed speed reads the rule in force today; the ready-by is counted again.
        speed: speedChanged || overrideCleared ? null : mixedSpeeds ? storedFollowerSpeed(item, itemPieces) : storedSpeed(item),
        readyByAt: speedChanged ? null : mixedSpeeds ? firstFollower?.readyByAt ?? item.readyByAt : item.readyByAt,
        tax: { taxCategoryCode: item.taxCategoryCode ?? 'STANDARD', exemptReason: item.taxExemptReason },
      },
    };
  });

  // ─── Order discounts: one adjustment per recorded discount ────────────
  const groups = new Map<string, EditStoredDiscount[]>();
  for (const d of record.discounts.filter((row) => row.level === 'ORDER')) {
    const key = [d.sourceType, d.sourceId, d.promotionId, d.discountType, d.discountRate, d.sourceName].join('|');
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }
  const sortedGroups = [...groups.values()].sort((a, b) => a[0].appliedSeq - b[0].appliedSeq);
  const recordedOrderDiscounts: RecordedOrderDiscount[] = sortedGroups.map((rows, k) => ({
    id: `order:d${k + 1}`,
    sourceType: rows[0].sourceType,
    sourceId: rows[0].sourceId,
    promotionId: rows[0].promotionId,
    sourceName: rows[0].sourceName,
    sourceName2: rows[0].sourceName2,
    discountType: rows[0].discountType,
    discountRate: rows[0].discountRate,
    amount: rows.reduce((sum, r) => sum.plus(toMoney(r.discountAmount)), toMoney(0)).toString(),
  }));
  const orderAdjustments = sortedGroups.map((rows, k) => {
    const id = `order:d${k + 1}`;
    adjustmentMeta.set(id, metaOf(rows[0]));
    return adjustmentOf(id, rows);
  });

  // ─── Charges that are not preference extras stay as they are ──────────
  const keptChargeIds = new Map<string, string>();
  const recordedCharges = record.charges
    .filter((c) => c.chargeType !== CHARGE_TYPES.PREFERENCE)
    .map((c) => {
      keptChargeIds.set(keptChargeId(c.id), c.id);
      return { chargeId: keptChargeId(c.id), kind: c.chargeType, amount: c.amount, taxed: c.taxCategoryCode != null };
    });

  return {
    intent: {
      branchId: record.branchId,
      customerId: record.customerId,
      serviceSpeed: projection.serviceSpeed,
      receivedAt: projection.editedAt,
      readyByStartAt: record.readyByStartAt,
      readyByOverride: null,
      lines,
      orderPreferences: prefsAt(PREFS_LEVEL.ORDER, null),
      orderAdjustments,
      recordedCharges,
    },
    recorded: { ...record.snapshot, ...recordedTaxContext(record) },
    adjustmentMeta,
    keptChargeIds,
    recordedOrderDiscounts,
  };
}

/** One Edit quote: the calculated order and what the writer needs to store it. */
export interface EditQuote extends EditIntent {
  quote: CommercialQuote;
  /** Each recorded order discount after the edit (D21); Review lists them, a removal needs acknowledgement. */
  discountChanges: DiscountChange[];
}

/**
 * Re-prices an order after an edit (read-only).
 * @param db the Prisma client or the caller's transaction client
 * @param tenantOrgId the session tenant, resolved server-side by the caller
 * @param record the stored order (`readEditOrderRecord`)
 * @param projection the order after the edit
 * @param deps the order's currency (tax comes from the order's recorded tax lines)
 * @returns the calculated order, its intents, the writer labels and the discount changes (D21)
 * @throws CommercialEditError, CommercialContextError, CommercialRuleError (all 4xx in the routes)
 * @example
 * const edit = await quoteOrderEdit(prisma, tenantOrgId, record, projection, { currency });
 * edit.quote.result.totals.totalAmount.toString();
 */
export async function quoteOrderEdit(
  db: CommercialDb,
  tenantOrgId: string,
  record: EditOrderRecord,
  projection: EditProjection,
  deps: Omit<CommercialLoaderDeps, 'recorded'>,
): Promise<EditQuote> {
  const edit = buildEditIntent(record, projection);
  let removed: ReadonlyMap<string, DiscountRemovalReason> = new Map();
  // D21: the recorded order discounts, applied again on the edited base.
  const quote = await quoteCommercialOrder(db, tenantOrgId, edit.intent, { ...deps, recorded: edit.recorded }, async (context) => {
    const evaluated = reevaluateOrderDiscounts(edit.recordedOrderDiscounts, { rules: record.discountRules, promotions: record.promotions },
      { lineCount: edit.intent.lines.length, serviceCategories: context.serviceCategories }, context);
    removed = evaluated.removed;
    return evaluated.adjustments;
  });
  const applied = new Map(quote.result.document.adjustments.map((a) => [a.id, a.amount] as const));
  return { ...edit, quote, discountChanges: discountChangesOf(edit.recordedOrderDiscounts, applied, removed) };
}
