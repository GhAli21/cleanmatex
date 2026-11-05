/**
 * Which Edit operations change money (EC-08). Pure and browser-safe: the
 * Preview prices only these, and the live card (P5-11) skips the server for
 * an edit that has none of them, so both decide the same way.
 */

/** Operation codes that change money; any other edit (notes, ready-by, priority) is not re-priced (EC-08). */
export const ORDER_CHANGE_PRICED_CODES: ReadonlySet<string> = new Set([
  'ADD_ITEM', 'REMOVE_ITEM', 'CHANGE_ITEM_QUANTITY', 'ADD_PIECE', 'REMOVE_PIECE',
  'ADD_PREFERENCE', 'CHANGE_PREFERENCE', 'REMOVE_PREFERENCE', 'CHANGE_SERVICE_SPEED',
  'CHANGE_ITEM_PRICE', 'CHANGE_DISCOUNT',
]);

/** The fields of an operation this rule reads. */
interface PricedOperationShape {
  code: string;
  target?: { kind: string };
  payload?: unknown;
}

/**
 * True when the request changes money (structure, preferences or a real speed change).
 * @param operations the reviewed operations
 * @param currentSpeed the order's stored speed
 * @returns whether the order must be re-priced
 */
export function orderChangeNeedsPricing(operations: readonly PricedOperationShape[], currentSpeed: string | null): boolean {
  return operations.some((operation) => ORDER_CHANGE_PRICED_CODES.has(operation.code)
    && !(operation.code === 'CHANGE_SERVICE_SPEED' && operation.target?.kind === 'ORDER'
      && (operation.payload as { serviceSpeed?: string } | undefined)?.serviceSpeed === currentSpeed));
}
