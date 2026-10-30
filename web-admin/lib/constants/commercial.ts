/**
 * Commercial calculator constants (Line-Level Money Snapshot, ADR-060).
 *
 * Why:
 * These values round-trip to the DB code tables that configure the shared
 * commercial calculator (`lib/commercial/`, landing in Phase 4). Keeping them
 * here, mirrored exactly against the seeded DB rows (CLAUDE.md DB-mirror
 * rule), prevents drift between the config tables and the code that reads
 * them. Grows migration by migration: M1 seeds the service-speed and
 * tax-category sets; M2 adds the speed-pricing method/basis sets; M3 adds
 * the tenant commercial-settings sets below; M4 adds `MONEY_BASIS`,
 * `PRICE_SOURCES`, `TAX_ROUNDING_LEVELS` (PLAN.md P2-01).
 */

/**
 * Service speed codes persisted in `sys_service_speed_cd.code` (M1,
 * `0639_sys_service_speed_tax_cat.sql`). Referenced by
 * `org_speed_price_rules_cf.service_speed` (M2) and, once M5 lands,
 * `org_order_items_dtl.service_speed`. `STANDARD` is the seeded default.
 */
export const SERVICE_SPEEDS = {
  STANDARD: 'STANDARD',
  EXPRESS: 'EXPRESS',
} as const;
/** Derived union for `sys_service_speed_cd.code` values. */
export type ServiceSpeed = (typeof SERVICE_SPEEDS)[keyof typeof SERVICE_SPEEDS];

/**
 * Tax-base category codes persisted in `sys_tax_category_cd.code` (M1,
 * `0639_sys_service_speed_tax_cat.sql`). Referenced by
 * `org_product_data_mst.tax_category_code` once M4 lands. Mapped 1:1 to the
 * UNCL5305 duty/tax/fee category code used on fiscal documents (ADR-060 §6).
 */
export const TAX_CATEGORIES = {
  STANDARD: 'STANDARD',
  ZERO_RATED: 'ZERO_RATED',
  EXEMPT: 'EXEMPT',
  OUT_OF_SCOPE: 'OUT_OF_SCOPE',
} as const;
/** Derived union for `sys_tax_category_cd.code` values. */
export type TaxCategory = (typeof TAX_CATEGORIES)[keyof typeof TAX_CATEGORIES];

/**
 * `sys_tax_category_cd.uncl5305_code` per category (DB-mirror; read-only
 * lookup, never written back — the DB column is the source of truth).
 */
export const TAX_CATEGORY_UNCL5305_CODE: Record<TaxCategory, string> = {
  [TAX_CATEGORIES.STANDARD]: 'S',
  [TAX_CATEGORIES.ZERO_RATED]: 'Z',
  [TAX_CATEGORIES.EXEMPT]: 'E',
  [TAX_CATEGORIES.OUT_OF_SCOPE]: 'O',
};

/**
 * How a speed-price rule's premium is expressed, persisted in
 * `org_speed_price_rules_cf.speed_price_type` (M2,
 * `0640_org_speed_price_rules_cf.sql`). Exactly one of the rule's three value
 * columns is set, matching this type (DB CHECK).
 */
export const SPEED_PRICE_TYPES = {
  /** `default_speed_sell_price`: a full replacement unit price at this speed. */
  SELL_PRICE: 'SELL_PRICE',
  /** `multiplier_speed`: an added fraction over the normal price (L20), e.g. 0.30 = +30%. */
  MULTIPLIER: 'MULTIPLIER',
  /** `speed_extra_amount`: a flat amount added per unit or per line (see `price_basis`). */
  FIXED_AMOUNT: 'FIXED_AMOUNT',
} as const;
/** Derived union for `org_speed_price_rules_cf.speed_price_type` values. */
export type SpeedPriceType = (typeof SPEED_PRICE_TYPES)[keyof typeof SPEED_PRICE_TYPES];

/**
 * How a `FIXED_AMOUNT` speed rule's `speed_extra_amount` is applied,
 * persisted in `org_speed_price_rules_cf.price_basis` (M2). Meaningless (and
 * always `NULL` in the DB) for `SELL_PRICE` / `MULTIPLIER` rules.
 */
export const PRICE_BASIS = {
  PER_UNIT: 'PER_UNIT',
  PER_LINE: 'PER_LINE',
} as const;
/** Derived union for `org_speed_price_rules_cf.price_basis` values. */
export type PriceBasis = (typeof PRICE_BASIS)[keyof typeof PRICE_BASIS];

/**
 * Commercial level persisted in `org_tenants_mst.commercial_level` (M3,
 * `0641_commercial_settings.sql`). Decides which of an item's and its
 * pieces' money rows is `PRICED` vs `ALLOCATED`/`ROLLUP` (PLAN.md §5.1).
 * Tenant-only (L10); snapshotted on `org_orders_mst.commercial_level` at
 * creation (M6) and never changed by Edit (L12). `ITEM` is the seeded
 * default; `PIECE` is available to every tenant (L11, no flag/plan gate).
 */
export const COMMERCIAL_LEVELS = {
  ITEM: 'ITEM',
  PIECE: 'PIECE',
} as const;
/** Derived union for `org_tenants_mst.commercial_level` / `org_orders_mst.commercial_level` values. */
export type CommercialLevel = (typeof COMMERCIAL_LEVELS)[keyof typeof COMMERCIAL_LEVELS];

/**
 * How an ORDER-level discount is spread across lines, persisted in
 * `org_tenants_mst.disc_alloc_mode` (M3). Tenant-only (L21); snapshotted on
 * `org_orders_mst.disc_alloc_mode` at creation (M6). `DOCUMENT_LEVEL` is the
 * seeded default (today's behaviour, PLAN.md §8.4).
 */
export const DISC_ALLOC_MODES = {
  /** Proportional split across lines, with exact line tax. */
  ALLOCATE_TO_LINES: 'ALLOCATE_TO_LINES',
  /** A document allowance split by tax category only; line tax stays on the line's own net. */
  DOCUMENT_LEVEL: 'DOCUMENT_LEVEL',
} as const;
/** Derived union for `org_tenants_mst.disc_alloc_mode` / `org_orders_mst.disc_alloc_mode` values. */
export type DiscAllocMode = (typeof DISC_ALLOC_MODES)[keyof typeof DISC_ALLOC_MODES];

/**
 * Under `ALLOCATE_TO_LINES`, the amount each line's discount share is
 * proportional to, persisted in `org_tenants_mst.disc_alloc_basis` (M3).
 * Ignored under `DOCUMENT_LEVEL`. `PROPORTIONAL_NET` is the seeded default.
 */
export const DISC_ALLOC_BASIS = {
  /** Proportional to each line's net amount after its own line discounts. */
  PROPORTIONAL_NET: 'PROPORTIONAL_NET',
  /** Proportional to each line's gross amount before line discounts. */
  PROPORTIONAL_GROSS: 'PROPORTIONAL_GROSS',
} as const;
/** Derived union for `org_tenants_mst.disc_alloc_basis` values. */
export type DiscAllocBasis = (typeof DISC_ALLOC_BASIS)[keyof typeof DISC_ALLOC_BASIS];

/**
 * Where a line's standard unit price came from, persisted in
 * `org_order_items_dtl.price_source` / `org_order_item_pieces_dtl.price_source`
 * (M5, `0643_line_money_items_pieces.sql`, CHECK `chk_oid_price_source`).
 * The speed rule is recorded separately on `speed_rule_id`, so a line priced
 * from a list plus an express rule still says `PRICE_LIST` (ADR-060 §5).
 */
export const PRICE_SOURCES = {
  /** The tenant's standard price list. */
  PRICE_LIST: 'PRICE_LIST',
  /** The product's own default sell price (no list row matched). */
  PRODUCT_DEFAULT: 'PRODUCT_DEFAULT',
  /** The customer's own list (b2b / vip). */
  CUSTOMER_PRICE: 'CUSTOMER_PRICE',
  /** Reserved by the DB CHECK; not produced, because the speed rule is recorded on `speed_rule_id`. */
  SPEED_RULE: 'SPEED_RULE',
  /** A cashier override (`pricing:override`) or a custom item's entered price. */
  MANUAL: 'MANUAL',
} as const;
/** Derived union for the line `price_source` values. */
export type PriceSourceCode = (typeof PRICE_SOURCES)[keyof typeof PRICE_SOURCES];

/**
 * Tax rounding level persisted in `org_tax_profiles_cf.rounding_level` (M4,
 * `0642_tax_profile_rounding.sql`, CHECK `chk_org_tax_prof_rounding_level`).
 * `DOCUMENT` is the seeded default (today's behaviour, PLAN.md §9).
 */
export const TAX_ROUNDING_LEVELS = {
  /** Round each row's tax; the header is the sum of the rows. */
  LINE: 'LINE',
  /** Round once per profile on the document total, then split it to rows exactly. */
  DOCUMENT: 'DOCUMENT',
} as const;
/** Derived union for `org_tax_profiles_cf.rounding_level` values. */
export type TaxRoundingLevel = (typeof TAX_ROUNDING_LEVELS)[keyof typeof TAX_ROUNDING_LEVELS];

/**
 * Internal reason codes written to the line `tax_exempt_reason` (M5) when the
 * calculator, not the catalog, makes a line non-standard (ADR-060 §6, P0-10).
 * A product's own `tax_exempt_reason` (country codes from
 * `sys_tax_exempt_reason_cd`) is carried through unchanged instead.
 */
export const TAX_EXEMPT_REASONS = {
  /** The customer holds an active exemption: every line is EXEMPT. */
  CUSTOMER_EXEMPTION: 'CUSTOMER_EXEMPTION',
  /** The line's service type holds an active exemption (per line, PF-05). */
  SERVICE_EXEMPTION: 'SERVICE_EXEMPTION',
  /** The product is non-standard in the catalog and names no reason of its own. */
  PRODUCT_EXEMPT: 'PRODUCT_EXEMPT',
} as const;
/** Derived union of the internal exempt reason codes. */
export type TaxExemptReason = (typeof TAX_EXEMPT_REASONS)[keyof typeof TAX_EXEMPT_REASONS];

/**
 * Which row of an item/piece pair carries the real price, persisted in
 * `org_order_items_dtl.money_basis` / `org_order_item_pieces_dtl.money_basis`
 * (M5, CHECK `chk_oid_money_basis`; PLAN.md §5.1).
 */
export const MONEY_BASIS = {
  /** This row is priced by the calculator. */
  PRICED: 'PRICED',
  /** This row is an exact share of the item (ITEM level, or the PIECE fallback). */
  ALLOCATED: 'ALLOCATED',
  /** This row is the exact sum of its pieces (PIECE level). */
  ROLLUP: 'ROLLUP',
} as const;
/** Derived union for the line `money_basis` values. */
export type MoneyBasis = (typeof MONEY_BASIS)[keyof typeof MONEY_BASIS];

/**
 * `org_product_data_mst.price_type` values (M4 CHECK: FIXED / PER_PC / NULL).
 * `FIXED` is a fixed price per unit, where one unit may be several pieces
 * (a suit set), so it cannot be priced per piece (L23, PLAN.md §5.1).
 */
export const PRODUCT_PRICE_TYPES = {
  FIXED: 'FIXED',
  PER_PC: 'PER_PC',
} as const;
/** Derived union for `org_product_data_mst.price_type` values. */
export type ProductPriceType = (typeof PRODUCT_PRICE_TYPES)[keyof typeof PRODUCT_PRICE_TYPES];
