/**
 * Stable order channel codes (mirror {@link sys_order_sources_cd} seeds).
 * Add new codes in the database first, then extend this list for autocomplete and validation UX.
 */
export const ORDER_SOURCE_CODES = [
  'legacy_unknown',
  'pos',
  'web_admin',
  'customer_mobile_app',
  'staff_mobile_app',
  'driver_mobile_app',
  'kiosk',
  'whatsapp_bot',
  'b2b_portal',
  'api_partner',
] as const;

/**
 * Union of database-mirrored order source codes.
 *
 * Use this type at API boundaries so a user-editable source cannot drift from
 * the persisted channel catalog.
 */
export type OrderSourceCode = (typeof ORDER_SOURCE_CODES)[number];

/**
 * Source applied when staff create an order from the tenant New Order workspace.
 * This remains distinct from the legacy fallback used by older import paths.
 */
export const NEW_ORDER_DEFAULT_SOURCE_CODE = 'pos' satisfies OrderSourceCode;

/**
 * Sources staff may intentionally select for a new order.
 *
 * Historical fallback rows remain readable, but cannot be created accidentally
 * from the staff workspace.
 */
export type SelectableNewOrderSourceCode = Exclude<OrderSourceCode, 'legacy_unknown'>;

/**
 * Reusable New Order source choices derived from the DB-mirror catalog.
 * `legacy_unknown` is retained for historical rows but excluded from fresh entry.
 */
export const SELECTABLE_NEW_ORDER_SOURCE_CODES = ORDER_SOURCE_CODES.filter(
  (code): code is SelectableNewOrderSourceCode => code !== 'legacy_unknown'
);

/**
 * Compatibility fallback for legacy import paths that predate explicit source capture.
 * New Order must use {@link NEW_ORDER_DEFAULT_SOURCE_CODE} instead.
 */
export const DEFAULT_ORDER_SOURCE_CODE = 'legacy_unknown';
