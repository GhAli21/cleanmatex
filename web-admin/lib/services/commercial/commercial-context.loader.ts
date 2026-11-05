/**
 * Commercial context loader (ADR-060 §1–§2, PLAN.md §4.1, P5-01).
 *
 * Why: the server is the only price authority. A client sends intents
 * (product, quantity, speed, preference codes, override, discounts); this
 * loader reads every fact behind them and turns them into the pure
 * calculator's input. Nothing here does money math, and no client price is
 * ever used.
 *
 * Two parts, so the mapping can be tested without a database:
 * - `loadCommercialFacts`: the reads. Every `org_*` query filters
 *   `tenant_org_id` explicitly (CRITICAL RULE #4); the global `sys_*` lookups
 *   have no tenant column.
 * - `buildCommercialOrderInput`: intents + facts → `CommercialOrderInput`.
 *
 * Kept from today (not a figure change): the customer list type rule of
 * `PricingService.determinePriceListType`, the preference price rule of
 * `PreferenceCatalogService` (tenant price, else the system default; only
 * codes the tenant enabled).
 *
 * Changed on purpose (L25, PF-19): an order-level preference charge is part
 * of the same laundry service, so it is taxed like a standard line (default
 * profiles, customer exemption applies). Today it was added after tax, untaxed.
 */
import 'server-only';

import type { PrismaClient, org_tax_profiles_cf } from '@prisma/client';
import {
  COMMERCIAL_LEVELS,
  DISC_ALLOC_BASIS,
  DISC_ALLOC_MODES,
  SERVICE_SPEEDS,
  type CommercialLevel,
  type DiscAllocBasis,
  type DiscAllocMode,
} from '@/lib/constants/commercial';
import type { ExtraPricePricingMode, TaxPricingMode } from '@/lib/constants/order-financial';
import {
  isRoundingMode,
  placementForExtraPrice,
  resolveSpeedPricing,
  resolveStandardPrice,
  resolveTaxCategory,
  selectTaxProfiles,
  SPEED_PRICING_OUTCOMES,
  type AdjustmentInput,
  type CommercialChargeInput,
  type CommercialLineInput,
  type CommercialOrderInput,
  type PriceListCandidate,
  type PriceModifier,
  type RoundingMode,
  type RoundingRule,
  type SpeedPricingResult,
  type SpeedRuleCandidate,
  type StandardPriceResult,
  type TaxProfileInput,
  type MoneyInput,
  toMoney,
} from '@/lib/commercial';
import { businessDateForTimezone, isValidTimeZone } from '@/lib/utils/business-date';
import { resolveExtraPricePricingMode, resolveTaxPricingMode } from '../pricing-mode-resolver.service';

/** The Prisma client or a transaction client; the loader only reads. */
export type CommercialDb = Pick<PrismaClient,
  | 'org_tenants_mst' | 'org_branches_mst' | 'org_customers_mst' | 'org_product_data_mst'
  | 'org_price_lists_mst' | 'org_price_list_items_dtl' | 'org_speed_price_rules_cf'
  | 'org_tax_profiles_cf' | 'org_tax_exemptions_cf' | 'org_service_preference_cf'
  | 'org_packing_preference_cf' | 'sys_service_preference_cd' | 'sys_service_category_cd'
  | 'sys_service_speed_cd' | 'sys_currency_rounding_rules_cf'>;

// ─── Intent (what the client may send) ─────────────────────────────────────

/** A preference the client picked; its price is read here, never sent. */
export interface PreferenceIntent {
  code: string;
  /** `SERVICE` = `org_service_preference_cf`, `PACKING` = `org_packing_preference_cf`. */
  kind: typeof PREFERENCE_KINDS[keyof typeof PREFERENCE_KINDS];
  /**
   * Order Edit: the price already on the order's preference row (or the one
   * the Edit review priced). The catalog price is not read for it (L24).
   */
  amount?: string | null;
  /**
   * Order Edit: the `org_order_preferences_dtl` row id. It names the modifier
   * (`<owner>:<kind>:<rowId>`), so a charge finds its row even when one owner
   * holds the same code twice.
   */
  rowId?: string | null;
}

/** The two preference catalogs a choice can come from. */
export const PREFERENCE_KINDS = {
  SERVICE: 'SERVICE',
  PACKING: 'PACKING',
} as const;

/**
 * `org_order_preferences_dtl.preference_sys_kind` values that carry a price,
 * mapped to the catalog they are priced from; other kinds (colour, condition,
 * note) are choices with no money.
 */
export const PRICED_PREFERENCE_SYS_KINDS: Readonly<Record<string, PreferenceIntent['kind']>> = {
  service_prefs: PREFERENCE_KINDS.SERVICE,
  packing_prefs: PREFERENCE_KINDS.PACKING,
};

/** One piece the client describes (its preferences); pieces default to one per unit. */
export interface PieceIntent {
  pieceId: string;
  preferences: readonly PreferenceIntent[];
}

/**
 * A custom item: a line with no catalog product (PLAN §7, P5-03e). Its unit
 * price is entered (`price_source` MANUAL; the caller has checked
 * `pricing:override`); the speed premium still comes from category or tenant
 * rules, with the entered price as the reference; tax is the standard category.
 */
export interface CustomItemIntent {
  unitPrice: string;
  serviceCategoryCode: string | null;
}

/** One order line as the client asks for it. */
export interface LineIntent {
  /** Stable within the request (the cart row key); the writer maps it to the created row. */
  lineId: string;
  /** Null only for a custom item. */
  productId: string | null;
  /** Set for a line with no catalog product. */
  customItem?: CustomItemIntent | null;
  quantity: number;
  /** Null: the order's speed. */
  serviceSpeed: string | null;
  /** A cashier price; the caller has already checked `pricing:override` and the reason (PF-01). */
  overrideUnitPrice: string | null;
  preferences: readonly PreferenceIntent[];
  /** Omitted: `quantity` pieces with no preferences (today's Create). */
  pieces?: readonly PieceIntent[];
  /** ITEM-level discounts; the caller has already checked `orders:discount`. */
  lineDiscounts: readonly AdjustmentInput[];
  /**
   * Order Edit (L24): the stored price facts of a line already on the order.
   * The loader resolves no catalog price for it; it reads the speed rule only
   * when `pinned.speed` is null (the line's speed changed).
   */
  pinned?: PinnedLinePrice | null;
}

/**
 * A line already on the order, as Edit re-prices it (L24): it keeps the list
 * price agreed at drop-off, its product facts and its recorded tax.
 */
export interface PinnedLinePrice {
  /** The product as stored (read without the active filter: the line keeps its product). */
  product: Omit<ProductFacts, 'id'> & { id: string | null };
  /** The stored list price, price list and price-list discount. */
  standard: StandardPriceResult;
  /** The stored premium; null resolves the speed rule in force on the edit date. */
  speed: { unitPremium: string; linePremium: string; ruleId: string | null } | null;
  /** The stored ready-by; null counts it again from the order's received time. */
  readyByAt: Date | null;
  /** The row's recorded tax category (D22); never resolved again. */
  tax: { taxCategoryCode: string; exemptReason: string | null };
}

/** A whole order as the client asks for it. */
export interface CommercialOrderIntent {
  branchId: string | null;
  customerId: string | null;
  /** The order-wide speed; each line may override it. */
  serviceSpeed: string;
  /** When the clock starts and the instant every effective date is read at. */
  receivedAt: Date;
  /**
   * Order Edit: when the ready-by clock starts (the order's received time).
   * Effective dates are still read at `receivedAt` (the edit time). Omitted: `receivedAt`.
   */
  readyByStartAt?: Date | null;
  readyByOverride: Date | null;
  lines: readonly LineIntent[];
  /** Order-level preferences: separate charges, taxed like a standard line (L25). */
  orderPreferences: readonly PreferenceIntent[];
  /**
   * Order Edit: charges already on the order that are not preference extras
   * (e.g. added at settlement). Kept at their amount, and taxed like a
   * standard line when they were taxed, so the total keeps them.
   */
  recordedCharges?: readonly RecordedChargeIntent[];
  /** Resolved order discounts in the order they apply (manual → rule → promo); evaluation stays in discount-service. */
  orderAdjustments: readonly AdjustmentInput[];
  /**
   * The general tax profiles the cashier picked in the payment panel; they
   * replace the tenant defaults. Each must be an active, effective profile of
   * the tenant. Omitted or empty: the defaults. Supply-code profiles still apply.
   */
  taxProfileIds?: readonly string[];
}

/** A stored non-preference charge Edit keeps as it is. */
export interface RecordedChargeIntent {
  chargeId: string;
  kind: string;
  amount: string;
  taxed: boolean;
}

/** Context the caller already holds: the tenant currency. Tax comes from tax profiles only (P6-03). */
export interface CommercialLoaderDeps {
  /** From the currency profile (`getCurrencyConfig`). */
  currency: { code: string; decimalPlaces: number };
  /**
   * Order Edit (§5.3, D22): the order's own snapshots and recorded tax. When
   * set, the tenant settings, the pricing-mode resolvers and the tenant tax
   * profiles are not read: a setting changed after drop-off never re-prices the order.
   */
  recorded?: RecordedCommercialSnapshot | null;
}

/** The commercial facts an order recorded at creation, which Edit reuses as they are. */
export interface RecordedCommercialSnapshot {
  level: CommercialLevel;
  discAllocMode: DiscAllocMode;
  discAllocBasis: DiscAllocBasis;
  pricingMode: TaxPricingMode;
  extraPriceMode: ExtraPricePricingMode;
  /** The profiles on the order's tax lines, at their recorded rates. */
  taxProfiles: readonly RecordedTaxProfile[];
  taxProfileLabels: ReadonlyMap<string, { label: string; label2: string | null }>;
}

/**
 * One profile the order was taxed with: the rate from its tax line, the
 * rounding facts from the profile row. Null rounding facts fall back to the
 * currency rule, as for a tenant profile.
 */
export interface RecordedTaxProfile {
  id: string;
  taxType: string;
  ratePercent: string;
  isCompound: boolean;
  isDefault: boolean;
  appliesTo: readonly string[] | null;
  roundingLevel: string;
  outputDecimalPlaces: number | null;
  roundingMode: string | null;
  incrementMinor: number | null;
  /** The tenant VAT-rate fallback (a tax line with no profile id). */
  isTenantRateFallback?: boolean;
}

// ─── Facts (what the loader reads) ─────────────────────────────────────────

/** One product's commercial facts. */
export interface ProductFacts {
  id: string;
  serviceCategoryCode: string | null;
  priceType: string | null;
  defaultSellPrice: string | null;
  minSellPrice: string | null;
  turnaroundHours: string | null;
  taxCategoryCode: string;
  taxSupplyCode: string | null;
  taxExemptReason: string | null;
}

/** One enabled preference with its tenant price. */
export interface PreferenceFacts {
  amount: string;
  extraMinutes: number;
}

/** Everything `buildCommercialOrderInput` needs. */
export interface CommercialFacts {
  level: CommercialLevel;
  discAllocMode: DiscAllocMode;
  discAllocBasis: DiscAllocBasis;
  pricingMode: TaxPricingMode;
  extraPriceMode: ExtraPricePricingMode;
  businessDate: string;
  rounding: RoundingRule;
  customerListType: string | null;
  customerExempt: boolean;
  /** Service categories holding an active exemption. */
  exemptServiceCategories: ReadonlySet<string>;
  products: ReadonlyMap<string, ProductFacts>;
  priceCandidates: ReadonlyMap<string, PriceListCandidate[]>;
  speedRules: readonly SpeedRuleCandidate[];
  activeSpeeds: ReadonlySet<string>;
  /** Category code → hours at standard and at any other speed. */
  categoryHours: ReadonlyMap<string, { standard: string | null; other: string | null }>;
  taxProfiles: readonly TaxProfileInput[];
  /** Profile id → label for the header tax lines (the fallback included). */
  taxProfileLabels: ReadonlyMap<string, { label: string; label2: string | null }>;
  /** `${kind}:${code}` → price and minutes. */
  preferences: ReadonlyMap<string, PreferenceFacts>;
}

/** Why a request cannot be priced; the route maps each code to an EN/AR message. */
export const COMMERCIAL_CONTEXT_ERRORS = {
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  SERVICE_SPEED_INVALID: 'SERVICE_SPEED_INVALID',
  PREFERENCE_NOT_AVAILABLE: 'PREFERENCE_NOT_AVAILABLE',
  TIMEZONE_NOT_CONFIGURED: 'TIMEZONE_NOT_CONFIGURED',
  /** Same code the payment quote has always returned for a bad selection. */
  INVALID_TAX_PROFILE_SELECTION: 'INVALID_TAX_PROFILE_SELECTION',
} as const;
/** Derived union of the context error codes. */
export type CommercialContextErrorCode = (typeof COMMERCIAL_CONTEXT_ERRORS)[keyof typeof COMMERCIAL_CONTEXT_ERRORS];

/** A request the catalog cannot price (unknown product, disabled preference, …). */
export class CommercialContextError extends Error {
  readonly code: CommercialContextErrorCode;
  readonly details: Readonly<Record<string, string>>;

  constructor(code: CommercialContextErrorCode, message: string, details: Record<string, string> = {}) {
    super(message);
    this.name = 'CommercialContextError';
    this.code = code;
    this.details = details;
  }
}

/** Price list tiers a customer can map to (kept from `determinePriceListType`). */
const CUSTOMER_LIST_TYPES = ['b2b', 'vip'] as const;

/**
 * The customer's price list type: `preferences.pricing_tier` wins over `type`.
 * @param type `org_customers_mst.type`
 * @param preferences `org_customers_mst.preferences`
 * @returns `b2b`, `vip` or null (standard)
 */
export function customerPriceListType(type: string | null, preferences: unknown): string | null {
  const pick = (value: unknown) => {
    const lower = typeof value === 'string' ? value.toLowerCase() : null;
    return CUSTOMER_LIST_TYPES.find((t) => t === lower) ?? null;
  };
  const tier = preferences && typeof preferences === 'object'
    ? pick((preferences as Record<string, unknown>).pricing_tier)
    : null;
  return tier ?? pick(type);
}

const text = (value: { toString(): string } | null | undefined): string | null => (value == null ? null : value.toString());
// DATE columns arrive as UTC midnight.
const dateOnly = (value: Date | null): string | null => (value ? value.toISOString().slice(0, 10) : null);
const preferenceKey = (kind: string, code: string) => `${kind}:${code}`;

/**
 * Id of a recorded tax line with no profile row: orders created before P6-03
 * were taxed from the retired `TENANT_VAT_RATE` setting and stored a NULL
 * profile id. Edit re-uses that recorded rate; no new order gets one.
 */
export const TENANT_RATE_PROFILE_ID = 'tenant-vat-rate';

const lineSpeed = (intent: CommercialOrderIntent, line: LineIntent) => line.serviceSpeed ?? intent.serviceSpeed;

/**
 * Reads every fact the order's intents need, at `intent.receivedAt`.
 * @param db the Prisma client or the caller's transaction client
 * @param tenantOrgId the session tenant (resolved server-side by the caller)
 * @param intent the client's order intents
 * @param deps the tenant currency
 * @returns plain facts for `buildCommercialOrderInput`
 * @throws CommercialContextError TIMEZONE_NOT_CONFIGURED
 * @example
 * const facts = await loadCommercialFacts(prisma, tenantOrgId, intent, { currency });
 */
export async function loadCommercialFacts(
  db: CommercialDb,
  tenantOrgId: string,
  intent: CommercialOrderIntent,
  deps: CommercialLoaderDeps,
): Promise<CommercialFacts> {
  const at = intent.receivedAt;
  // A pinned line (Edit) carries its own product facts and price: no catalog read for it.
  const productIds = [...new Set(intent.lines.filter((l) => !l.pinned).map((l) => l.productId).filter((id): id is string => id != null))];
  const speeds = [...new Set(intent.lines.map((l) => lineSpeed(intent, l)))];
  const otherSpeeds = speeds.filter((s) => s !== SERVICE_SPEEDS.STANDARD);
  const allPreferences = [
    ...intent.orderPreferences,
    ...intent.lines.flatMap((l) => [...l.preferences, ...(l.pieces ?? []).flatMap((p) => p.preferences)]),
  ];
  const codesOf = (kind: string) => [...new Set(allPreferences.filter((p) => p.kind === kind).map((p) => p.code))];
  const serviceCodes = codesOf(PREFERENCE_KINDS.SERVICE);
  const packingCodes = codesOf(PREFERENCE_KINDS.PACKING);

  // ─── Independent reads ─────────────────────────────────────────────────
  const [tenant, branch, customer, products, listItems, speedRules, activeSpeeds, profiles, accounting,
    servicePrefs, packingPrefs, pricingMode, extraPriceMode] = await Promise.all([
    // org_tenants_mst is keyed by the tenant id itself (no tenant_org_id column).
    db.org_tenants_mst.findFirst({
      where: { id: tenantOrgId },
      select: { commercial_level: true, disc_alloc_mode: true, disc_alloc_basis: true, timezone: true },
    }),
    intent.branchId
      ? db.org_branches_mst.findFirst({ where: { id: intent.branchId, tenant_org_id: tenantOrgId }, select: { timezone_code: true } })
      : null,
    intent.customerId
      ? db.org_customers_mst.findFirst({ where: { id: intent.customerId, tenant_org_id: tenantOrgId }, select: { type: true, preferences: true } })
      : null,
    db.org_product_data_mst.findMany({
      where: { tenant_org_id: tenantOrgId, id: { in: productIds }, is_active: true, rec_status: 1 },
      select: {
        id: true, service_category_code: true, price_type: true, default_sell_price: true, min_sell_price: true,
        turnaround_hh: true, tax_category_code: true, tax_supply_code: true, tax_exempt_reason: true,
      },
    }),
    db.org_price_list_items_dtl.findMany({
      where: { tenant_org_id: tenantOrgId, product_id: { in: productIds } },
      select: {
        id: true, price_list_id: true, product_id: true, price: true, discount_percent: true,
        min_quantity: true, max_quantity: true, is_active: true, rec_status: true,
      },
    }),
    otherSpeeds.length > 0
      ? db.org_speed_price_rules_cf.findMany({ where: { tenant_org_id: tenantOrgId, service_speed: { in: otherSpeeds } } })
      : [],
    db.sys_service_speed_cd.findMany({ where: { code: { in: speeds }, is_active: true, rec_status: 1 }, select: { code: true } }),
    // Edit uses the order's recorded profiles (D22), never today's.
    deps.recorded ? Promise.resolve([] as org_tax_profiles_cf[]) : db.org_tax_profiles_cf.findMany({
      where: {
        tenant_org_id: tenantOrgId, is_active: true, rec_status: 1,
        effective_from: { lte: at }, OR: [{ effective_to: null }, { effective_to: { gte: at } }],
      },
      orderBy: { created_at: 'asc' },
    }),
    db.sys_currency_rounding_rules_cf.findFirst({
      where: {
        currency_code: deps.currency.code, rounding_context: 'ACCOUNTING', is_active: true, rec_status: 1,
        effective_from: { lte: at }, OR: [{ effective_to: null }, { effective_to: { gte: at } }],
      },
      orderBy: { effective_from: 'desc' },
      select: { rounding_mode: true },
    }),
    serviceCodes.length > 0
      ? db.org_service_preference_cf.findMany({
        where: {
          tenant_org_id: tenantOrgId, preference_code: { in: serviceCodes }, is_active: true,
          OR: [{ branch_id: null }, ...(intent.branchId ? [{ branch_id: intent.branchId }] : [])],
        },
        select: { preference_code: true, extra_price: true, extra_turnaround_minutes: true, branch_id: true },
      })
      : [],
    packingCodes.length > 0
      ? db.org_packing_preference_cf.findMany({
        where: { tenant_org_id: tenantOrgId, packing_pref_code: { in: packingCodes }, is_active: true },
        select: { packing_pref_code: true, extra_price: true },
      })
      : [],
    deps.recorded ? deps.recorded.pricingMode : resolveTaxPricingMode(db as PrismaClient, tenantOrgId, intent.branchId),
    deps.recorded ? deps.recorded.extraPriceMode : resolveExtraPricePricingMode(db as PrismaClient, tenantOrgId, intent.branchId),
  ]);

  // ─── Reads that depend on the first ones ───────────────────────────────
  const listIds = [...new Set(listItems.map((i) => i.price_list_id))];
  const categoryCodes = [...new Set([
    ...products.map((p) => p.service_category_code),
    ...intent.lines.map((l) => l.customItem?.serviceCategoryCode ?? l.pinned?.product.serviceCategoryCode ?? null),
  ].filter((c): c is string => Boolean(c)))];
  const [lists, categories, sysPrefs, exemptions] = await Promise.all([
    listIds.length > 0
      ? db.org_price_lists_mst.findMany({
        where: { tenant_org_id: tenantOrgId, id: { in: listIds } },
        select: { id: true, price_list_type: true, priority: true, effective_from: true, effective_to: true, is_active: true, rec_status: true },
      })
      : [],
    categoryCodes.length > 0
      ? db.sys_service_category_cd.findMany({
        where: { service_category_code: { in: categoryCodes } },
        select: { service_category_code: true, turnaround_hh: true, turnaround_hh_express: true },
      })
      : [],
    serviceCodes.length > 0
      ? db.sys_service_preference_cd.findMany({
        where: { code: { in: serviceCodes }, is_active: true },
        select: { code: true, default_extra_price: true, extra_turnaround_minutes: true },
      })
      : [],
    intent.customerId || categoryCodes.length > 0
      ? db.org_tax_exemptions_cf.findMany({
        where: {
          tenant_org_id: tenantOrgId, is_active: true, rec_status: 1, valid_from: { lte: at },
          AND: [
            { OR: [{ valid_to: null }, { valid_to: { gte: at } }] },
            { OR: [
              ...(intent.customerId ? [{ customer_id: intent.customerId }] : []),
              ...(categoryCodes.length > 0 ? [{ service_type: { in: categoryCodes } }] : []),
            ] },
          ],
        },
        select: { customer_id: true, service_type: true },
      })
      : [],
  ]);

  // ─── Business date and rounding ────────────────────────────────────────
  const timezone = [branch?.timezone_code, tenant?.timezone].find((tz) => isValidTimeZone(tz));
  if (!timezone) {
    throw new CommercialContextError(COMMERCIAL_CONTEXT_ERRORS.TIMEZONE_NOT_CONFIGURED,
      'Neither the branch nor the tenant has a valid time zone, so effective dates cannot be read.');
  }
  const accountingMode = accounting && isRoundingMode(accounting.rounding_mode) ? accounting.rounding_mode : 'HALF_UP';
  const rounding: RoundingRule = { decimalPlaces: deps.currency.decimalPlaces, mode: accountingMode as RoundingMode };

  // ─── Tax profiles (none applicable: no tax line, never an assumed rate; B15) ─
  const selected = new Set(intent.taxProfileIds ?? []);
  const missing = [...selected].filter((id) => !profiles.some((p) => p.id === id));
  if (missing.length > 0) {
    throw new CommercialContextError(COMMERCIAL_CONTEXT_ERRORS.INVALID_TAX_PROFILE_SELECTION,
      'A selected tax profile is not an active profile of this tenant.', { profileIds: missing.join(',') });
  }
  // A cashier selection replaces the default set; supply-code profiles are untouched.
  const isDefaultProfile = (p: { id: string; is_default: boolean }) => (selected.size > 0 ? selected.has(p.id) : p.is_default);
  const taxProfileLabels = new Map(profiles.map((p) => [p.id, { label: p.name, label2: p.name2 }]));
  let taxProfiles: TaxProfileInput[] = profiles.map((p) => ({
    id: p.id,
    taxType: p.tax_type,
    ratePercent: p.rate.toString(),
    isCompound: p.is_compound,
    isDefault: isDefaultProfile(p),
    appliesTo: p.applies_to,
    roundingLevel: p.rounding_level as TaxProfileInput['roundingLevel'],
    rounding: {
      decimalPlaces: p.output_decimal_places ?? rounding.decimalPlaces,
      mode: isRoundingMode(p.rounding_mode) ? p.rounding_mode : rounding.mode,
      incrementMinor: p.rounding_increment_minor,
    },
  }));
  if (deps.recorded) {
    taxProfiles = deps.recorded.taxProfiles.map((p) => ({
      id: p.id,
      taxType: p.taxType,
      ratePercent: p.ratePercent,
      isCompound: p.isCompound,
      isDefault: p.isDefault,
      appliesTo: p.appliesTo,
      roundingLevel: p.roundingLevel as TaxProfileInput['roundingLevel'],
      rounding: {
        decimalPlaces: p.outputDecimalPlaces ?? rounding.decimalPlaces,
        mode: isRoundingMode(p.roundingMode) ? p.roundingMode : rounding.mode,
        incrementMinor: p.incrementMinor,
      },
      ...(p.isTenantRateFallback ? { isTenantRateFallback: true } : {}),
    }));
    for (const [id, label] of deps.recorded.taxProfileLabels) taxProfileLabels.set(id, label);
  }

  // ─── Price candidates ──────────────────────────────────────────────────
  const listById = new Map(lists.map((l) => [l.id, l] as const));
  const priceCandidates = new Map<string, PriceListCandidate[]>();
  for (const item of listItems) {
    const list = listById.get(item.price_list_id);
    if (!list) continue;
    const candidates = priceCandidates.get(item.product_id) ?? [];
    candidates.push({
      priceListId: list.id,
      priceListItemId: item.id,
      listType: list.price_list_type,
      listPriority: list.priority,
      effectiveFrom: dateOnly(list.effective_from),
      effectiveTo: dateOnly(list.effective_to),
      listActive: list.is_active && (list.rec_status ?? 1) === 1,
      itemActive: item.is_active && (item.rec_status ?? 1) === 1,
      unitPrice: item.price.toString(),
      discountPercent: text(item.discount_percent),
      minQuantity: item.min_quantity,
      maxQuantity: item.max_quantity,
    });
    priceCandidates.set(item.product_id, candidates);
  }

  // ─── Preferences: tenant price, else the system default ────────────────
  const preferences = new Map<string, PreferenceFacts>();
  const sysByCode = new Map(sysPrefs.map((s) => [s.code, s] as const));
  // A branch row wins over the tenant-wide row for the same code.
  const sortedServicePrefs = [...servicePrefs].sort((a, b) => Number(a.branch_id != null) - Number(b.branch_id != null));
  for (const cf of sortedServicePrefs) {
    const sys = sysByCode.get(cf.preference_code);
    if (!sys) continue;
    preferences.set(preferenceKey(PREFERENCE_KINDS.SERVICE, cf.preference_code), {
      amount: (cf.extra_price ?? sys.default_extra_price ?? 0).toString(),
      extraMinutes: cf.extra_turnaround_minutes ?? sys.extra_turnaround_minutes ?? 0,
    });
  }
  for (const cf of packingPrefs) {
    preferences.set(preferenceKey(PREFERENCE_KINDS.PACKING, cf.packing_pref_code), {
      amount: (cf.extra_price ?? 0).toString(),
      extraMinutes: 0,
    });
  }

  return {
    level: deps.recorded?.level ?? (tenant?.commercial_level as CommercialLevel | undefined) ?? COMMERCIAL_LEVELS.ITEM,
    discAllocMode: deps.recorded?.discAllocMode ?? (tenant?.disc_alloc_mode as DiscAllocMode | undefined) ?? DISC_ALLOC_MODES.DOCUMENT_LEVEL,
    discAllocBasis: deps.recorded?.discAllocBasis ?? (tenant?.disc_alloc_basis as DiscAllocBasis | undefined) ?? DISC_ALLOC_BASIS.PROPORTIONAL_NET,
    pricingMode,
    extraPriceMode,
    businessDate: businessDateForTimezone(timezone, at),
    rounding,
    customerListType: customer ? customerPriceListType(customer.type, customer.preferences) : null,
    customerExempt: exemptions.some((e) => intent.customerId != null && e.customer_id === intent.customerId),
    exemptServiceCategories: new Set(exemptions.map((e) => e.service_type).filter((s): s is string => Boolean(s))),
    products: new Map(products.map((p) => [p.id, {
      id: p.id,
      serviceCategoryCode: p.service_category_code,
      priceType: p.price_type,
      defaultSellPrice: text(p.default_sell_price),
      minSellPrice: text(p.min_sell_price),
      turnaroundHours: text(p.turnaround_hh),
      taxCategoryCode: p.tax_category_code,
      taxSupplyCode: p.tax_supply_code,
      taxExemptReason: p.tax_exempt_reason,
    }])),
    priceCandidates,
    speedRules: speedRules.map((r) => ({
      id: r.id,
      serviceSpeed: r.service_speed,
      branchId: r.branch_id,
      serviceCategoryCode: r.service_category_code,
      productId: r.product_id,
      speedPriceType: r.speed_price_type as SpeedRuleCandidate['speedPriceType'],
      defaultSpeedSellPrice: text(r.default_speed_sell_price),
      multiplierSpeed: text(r.multiplier_speed),
      speedExtraAmount: text(r.speed_extra_amount),
      priceBasis: r.price_basis as SpeedRuleCandidate['priceBasis'],
      turnaroundHhSpeed: text(r.turnaround_hh_speed),
      effectiveFrom: dateOnly(r.effective_from) as string,
      effectiveTo: dateOnly(r.effective_to),
      isActive: r.is_active && r.rec_status === 1,
    })),
    activeSpeeds: new Set(activeSpeeds.map((s) => s.code)),
    categoryHours: new Map(categories.map((c) => [c.service_category_code, {
      standard: text(c.turnaround_hh), other: text(c.turnaround_hh_express),
    }] as const)),
    taxProfiles,
    taxProfileLabels,
    preferences,
  };
}

/**
 * A pinned line's stored premium as a speed result (Edit, L24): the rule that
 * priced it stays named, and no rule is read again.
 * @param serviceSpeed the line's (unchanged) speed
 * @param standardUnitPrice the stored list price
 * @param quantity the line quantity after the edit
 * @param stored the stored unit and per-line premium and rule id
 * @returns a speed result with outcome RECORDED
 */
function recordedSpeed(
  serviceSpeed: string,
  standardUnitPrice: MoneyInput,
  quantity: MoneyInput,
  stored: { unitPremium: string; linePremium: string; ruleId: string | null },
): SpeedPricingResult {
  const unitPremium = toMoney(stored.unitPremium);
  const linePremium = toMoney(stored.linePremium);
  return {
    outcome: SPEED_PRICING_OUTCOMES.RECORDED,
    serviceSpeed,
    ruleId: stored.ruleId,
    ruleLevel: null,
    speedPriceType: null,
    unitPremium,
    linePremium,
    unitPrice: toMoney(standardUnitPrice).plus(unitPremium),
    premiumAmount: unitPremium.times(toMoney(quantity)).plus(linePremium),
    turnaroundHours: null,
    warnings: [],
  };
}

/**
 * The product facts a custom item stands on: no catalog id, the entered price
 * as its default, no minimum, the standard tax category and no supply code,
 * and the category's turnaround (no product hours).
 * @param custom - The entered price and category.
 * @returns product-shaped facts for one custom line
 */
function customProductFacts(custom: CustomItemIntent) {
  return {
    id: null,
    serviceCategoryCode: custom.serviceCategoryCode,
    priceType: null,
    defaultSellPrice: custom.unitPrice,
    minSellPrice: null,
    turnaroundHours: null,
    taxCategoryCode: null,
    taxExemptReason: null,
    taxSupplyCode: null,
  };
}

/** One line's resolved prices, kept for the writer and the cart notes. */
export interface ResolvedLinePrice {
  lineId: string;
  /** Null for a custom item, whose price source is MANUAL. */
  productId: string | null;
  serviceSpeed: string;
  standard: StandardPriceResult;
  speed: SpeedPricingResult;
}

/**
 * Turns the intents into the calculator's input, using only server facts.
 * @param intent the client's order intents
 * @param facts what `loadCommercialFacts` read
 * @returns the calculator input, and each line's resolved standard and speed price
 * @throws CommercialContextError PRODUCT_NOT_FOUND, SERVICE_SPEED_INVALID, PREFERENCE_NOT_AVAILABLE
 * @throws CommercialRuleError PRICE_NOT_RESOLVED
 */
export function buildCommercialOrderInput(
  intent: CommercialOrderIntent,
  facts: CommercialFacts,
): { input: CommercialOrderInput; prices: ResolvedLinePrice[] } {
  const placement = placementForExtraPrice(facts.extraPriceMode, 'LINE');
  const preferenceOf = (p: PreferenceIntent): PreferenceFacts => {
    const found = facts.preferences.get(preferenceKey(p.kind, p.code));
    // Edit: a stored price stands even if the preference was disabled since (L24).
    if (p.amount != null) return { amount: p.amount, extraMinutes: found?.extraMinutes ?? 0 };
    if (!found) {
      throw new CommercialContextError(COMMERCIAL_CONTEXT_ERRORS.PREFERENCE_NOT_AVAILABLE,
        `Preference ${p.code} is not enabled for this tenant.`, { code: p.code, kind: p.kind });
    }
    return found;
  };
  // A zero-priced preference is a choice, not money: it gets no modifier row.
  const modifiersOf = (prefs: readonly PreferenceIntent[], idPrefix: string): PriceModifier[] =>
    prefs.map((p) => ({ id: `${idPrefix}:${p.kind}:${p.rowId ?? p.code}`, kind: p.kind, amount: preferenceOf(p).amount, placement }))
      .filter((m) => !toMoney(m.amount).isZero());
  const minutesOf = (prefs: readonly PreferenceIntent[]) => prefs.reduce((sum, p) => sum + preferenceOf(p).extraMinutes, 0);

  const prices: ResolvedLinePrice[] = [];
  const lines: CommercialLineInput[] = intent.lines.map((line) => {
    const product = line.customItem
      ? customProductFacts(line.customItem)
      : line.pinned?.product ?? facts.products.get(line.productId ?? '');
    if (!product) {
      throw new CommercialContextError(COMMERCIAL_CONTEXT_ERRORS.PRODUCT_NOT_FOUND,
        `Product ${line.productId} is not an active product of this tenant.`, { productId: line.productId });
    }
    const serviceSpeed = lineSpeed(intent, line);
    // A pinned line keeping its speed (Edit, L24) is not a new choice: a speed retired since does not block it.
    if (!line.pinned?.speed && !facts.activeSpeeds.has(serviceSpeed)) {
      throw new CommercialContextError(COMMERCIAL_CONTEXT_ERRORS.SERVICE_SPEED_INVALID,
        `Service speed ${serviceSpeed} is not an active speed.`, { serviceSpeed });
    }

    // A custom item has no list rows: its entered price stands as the product default would.
    // A pinned line (Edit) keeps the list price agreed at drop-off (L24).
    const standard = line.pinned?.standard ?? resolveStandardPrice({
      quantity: line.quantity,
      businessDate: facts.businessDate,
      customerListType: facts.customerListType,
      candidates: product.id ? facts.priceCandidates.get(product.id) ?? [] : [],
      productDefaultPrice: product.defaultSellPrice,
    });
    const speed = line.pinned?.speed
      ? recordedSpeed(serviceSpeed, standard.unitPrice, line.quantity, line.pinned.speed)
      : resolveSpeedPricing({
      serviceSpeed,
      branchId: intent.branchId,
      serviceCategoryCode: product.serviceCategoryCode,
      productId: product.id,
      businessDate: facts.businessDate,
      standardUnitPrice: standard.unitPrice,
      // A custom item has no authored reference: the entered price is the reference.
      referenceUnitPrice: line.customItem ? null : product.defaultSellPrice,
      quantity: line.quantity,
      rules: facts.speedRules,
    });
    prices.push({ lineId: line.lineId, productId: product.id, serviceSpeed, standard, speed });

    const pieces = line.pieces ?? Array.from({ length: Math.max(1, Math.ceil(line.quantity)) }, (_, k) => ({
      pieceId: `${line.lineId}-p${k + 1}`, preferences: [],
    }));
    const hours = facts.categoryHours.get(product.serviceCategoryCode ?? '');
    const { category, exemptReason } = line.pinned
      ? { category: line.pinned.tax.taxCategoryCode, exemptReason: line.pinned.tax.exemptReason }
      : resolveTaxCategory({
        productCategory: product.taxCategoryCode,
        productExemptReason: product.taxExemptReason,
        customerExempt: facts.customerExempt,
        serviceExempt: product.serviceCategoryCode != null && facts.exemptServiceCategories.has(product.serviceCategoryCode),
      });

    return {
      lineId: line.lineId,
      quantity: line.quantity,
      priceType: product.priceType,
      pricing: {
        listUnitPrice: standard.unitPrice,
        priceListDiscountPercent: standard.priceListDiscountPercent,
        priceListItemId: standard.priceListItemId,
        speedUnitPremium: speed.unitPremium,
        speedLinePremium: speed.linePremium,
        overrideUnitPrice: line.overrideUnitPrice,
        modifiers: modifiersOf(line.preferences, line.lineId),
        adjustments: line.lineDiscounts,
        // A pinned line's price was accepted at drop-off; a later minimum does not block an edit.
        minUnitPrice: line.pinned ? null : product.minSellPrice,
      },
      tax: {
        taxCategoryCode: category,
        exemptReason,
        profiles: selectTaxProfiles(facts.taxProfiles, product.taxSupplyCode),
      },
      // The calculator puts piece extras on the item or the piece, by the line's basis.
      pieces: pieces.map((p) => ({ pieceId: p.pieceId, modifiers: modifiersOf(p.preferences, p.pieceId) })),
      readyBy: {
        serviceSpeed,
        speedRuleHours: speed.turnaroundHours,
        productHours: product.turnaroundHours,
        categoryHours: serviceSpeed === SERVICE_SPEEDS.STANDARD ? hours?.standard ?? null : hours?.other ?? null,
        extraMinutes: minutesOf(line.preferences) + pieces.reduce((s, p) => s + minutesOf(p.preferences), 0),
        recordedReadyByAt: line.pinned?.readyByAt ?? null,
      },
    };
  });

  // L25: an order preference extra is part of the service supply, so it is
  // taxed like a standard line with no supply code; a customer exemption applies.
  const chargeCategory = resolveTaxCategory({
    productCategory: null, productExemptReason: null, customerExempt: facts.customerExempt, serviceExempt: false,
  });
  const chargeTax = {
    taxCategoryCode: chargeCategory.category,
    exemptReason: chargeCategory.exemptReason,
    profiles: selectTaxProfiles(facts.taxProfiles, null),
  };
  const charges: CommercialChargeInput[] = [
    ...intent.orderPreferences.map((p) => ({
      chargeId: `order:${p.kind}:${p.rowId ?? p.code}`, kind: p.kind, amount: preferenceOf(p).amount, tax: chargeTax,
    })),
    ...(intent.recordedCharges ?? []).map((c) => ({
      chargeId: c.chargeId, kind: c.kind, amount: c.amount, tax: c.taxed ? chargeTax : null,
    })),
  ];

  return {
    prices,
    input: {
      level: facts.level,
      pricingMode: facts.pricingMode,
      discAllocMode: facts.discAllocMode,
      discAllocBasis: facts.discAllocBasis,
      rounding: facts.rounding,
      lines,
      orderAdjustments: intent.orderAdjustments,
      charges,
      readyBy: {
        startAt: intent.readyByStartAt ?? intent.receivedAt,
        orderExtraMinutes: minutesOf(intent.orderPreferences),
        orderOverride: intent.readyByOverride,
      },
    },
  };
}
