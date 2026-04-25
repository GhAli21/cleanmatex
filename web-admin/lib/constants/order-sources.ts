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

export type OrderSourceCode = (typeof ORDER_SOURCE_CODES)[number];

export const DEFAULT_ORDER_SOURCE_CODE = 'legacy_unknown';
