/**
 * Cart line → checkout intents: preferences (P5-02) and the line's own speed (P5-03b).
 *
 * The payment quote must see exactly the preferences submit will send, so
 * this mapping applies the same tenant gates as `use-order-submission`:
 * piece data only when pieces are tracked, a piece packing code only when
 * per-piece packing is on. The server prices every code; no amount is sent.
 */
import type { CheckoutLineIntentFields } from '@/lib/types/payment-quote';
import type { OrderItem } from './new-order-types';

/** The tenant settings that decide which preferences submit sends. */
export interface CheckoutIntentGates {
  trackByPiece: boolean;
  packingPerPieceEnabled: boolean;
}

const codes = (prefs: OrderItem['servicePrefs']) =>
  prefs && prefs.length > 0 ? prefs.map((p) => ({ preference_code: p.preference_code })) : undefined;

/**
 * The preference intents of one cart line, as submit sends them.
 * @param item the cart line
 * @param gates the tenant's piece tracking and per-piece packing settings
 * @returns the line's preference codes, its packing code, each piece's own preferences and the line's own speed
 * @example
 * checkoutLineIntentOf(item, { trackByPiece: true, packingPerPieceEnabled: false });
 */
export function checkoutLineIntentOf(item: OrderItem, gates: CheckoutIntentGates): CheckoutLineIntentFields {
  const pieces = gates.trackByPiece && item.pieces && item.pieces.length > 0
    ? item.pieces.map((piece) => ({
      servicePrefs: codes(piece.servicePrefs),
      packingPrefCode: gates.packingPerPieceEnabled && piece.packingPrefCode ? piece.packingPrefCode : undefined,
    }))
    : undefined;
  return {
    servicePrefs: codes(item.servicePrefs),
    packingPrefCode: item.packingPrefCode || undefined,
    pieces,
    // Null follows the order speed; only an explicit line speed is sent.
    serviceSpeed: item.serviceSpeed ?? null,
    // The cashier's line discount (P5-03c); the server prices it and checks `orders:discount`.
    lineDiscount: item.lineDiscount ?? null,
  };
}

/** Cart key prefix of a custom item: its `productId` in the cart is never a catalog id. */
export const CUSTOM_ITEM_KEY_PREFIX = 'custom:';

/**
 * One cart line as every New Order request sends it: the catalog product, or
 * the custom item (P5-03e), plus quantity, cashier price and the intents.
 * @param item the cart line
 * @param gates the tenant's piece tracking and per-piece packing settings
 * @returns the request line (never both `productId` and `customItem`)
 * @example checkoutLineOf(item, { trackByPiece: true, packingPerPieceEnabled: false });
 */
export function checkoutLineOf(item: OrderItem, gates: CheckoutIntentGates) {
  return {
    ...(item.customItem
      ? {
        customItem: {
          name: item.customItem.name,
          name2: item.customItem.name2,
          unitPrice: item.customItem.unitPrice,
          serviceCategoryCode: item.serviceCategoryCode ?? null,
        },
      }
      : { productId: item.productId }),
    quantity: item.quantity,
    priceOverride: item.priceOverride ?? null,
    ...checkoutLineIntentOf(item, gates),
  };
}
