import { ORDER_TYPE_IDS, type OrderTypeId } from '@/lib/constants/order-types';

/** next-intl keys under `orders.orderTypes.*` — one label per sys_order_type_cd code. */
export const ORDER_TYPE_I18N_KEYS = {
  [ORDER_TYPE_IDS.POS]: 'orderTypes.POS',
  [ORDER_TYPE_IDS.WALK_IN]: 'orderTypes.WALK_IN',
  [ORDER_TYPE_IDS.PICKUP]: 'orderTypes.PICKUP',
  [ORDER_TYPE_IDS.HOME_COLLECTION]: 'orderTypes.HOME_COLLECTION',
  [ORDER_TYPE_IDS.COLLECTION_AND_DELIVERY]: 'orderTypes.COLLECTION_AND_DELIVERY',
  [ORDER_TYPE_IDS.DELIVERY]: 'orderTypes.DELIVERY',
  [ORDER_TYPE_IDS.EXPRESS]: 'orderTypes.EXPRESS',
  [ORDER_TYPE_IDS.ONLINE]: 'orderTypes.ONLINE',
  [ORDER_TYPE_IDS.PHONE]: 'orderTypes.PHONE',
} as const satisfies Record<OrderTypeId, string>;

/**
 * Resolves a catalog order_type_id to a localized label when a translator is available.
 */
export function formatOrderTypeLabel(
  orderTypeId: string | null | undefined,
  translate: (key: string) => string,
): string {
  const code = orderTypeId?.trim();
  if (!code) return '—';
  const i18nKey = ORDER_TYPE_I18N_KEYS[code as OrderTypeId];
  return i18nKey ? translate(i18nKey) : code;
}
