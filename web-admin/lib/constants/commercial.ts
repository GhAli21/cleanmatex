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
