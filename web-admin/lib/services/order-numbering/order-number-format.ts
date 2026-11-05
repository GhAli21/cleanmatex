/**
 * Order number format helpers (pure, no DB).
 *
 * Root order:  ORD-YYYYMMDD-NNNN    (4 digits minimum; grows to 5+ after 9999/day)
 * Sub-order:   <root>-S<n>          (n = 1, 2, ... per root order; A-19)
 *
 * The number itself is produced by the DB (fn_doc_seq_next via
 * generate_order_number / trg_ord_no_assign). These helpers only read it.
 * Plan: docs/features/Human_Friendly_Codes — P2.
 */

/** Matches a root or sub-order number. Groups: 1 = date, 2 = sequence, 3 = sub-order index. */
export const ORDER_NUMBER_PATTERN = /^ORD-(\d{8})-(\d{4,})(?:-S([1-9]\d*))?$/;

/** Matches a root order number only. */
export const ROOT_ORDER_NUMBER_PATTERN = /^ORD-(\d{8})-(\d{4,})$/;

/** Parsed parts of an order number. */
export interface OrderNumberResult {
  orderNumber: string;
  /** YYYYMMDD day of the root order. */
  date: string;
  /** Daily sequence of the root order. */
  sequence: number;
  /** Sub-order index (`-S<n>`), or null for a root order. */
  subOrderIndex: number | null;
  /** Root order number (equals orderNumber for a root order). */
  rootOrderNumber: string;
}

/**
 * Checks the order number format (root or sub-order).
 * @param orderNumber value to check
 * @returns true when the value is a valid order number
 */
export function isValidOrderNumber(orderNumber: string | null | undefined): boolean {
  return typeof orderNumber === 'string' && ORDER_NUMBER_PATTERN.test(orderNumber);
}

/**
 * Checks that the value is a root order number (no `-S<n>` suffix).
 * @param orderNumber value to check
 * @returns true for a valid root order number
 */
export function isRootOrderNumber(orderNumber: string | null | undefined): boolean {
  return typeof orderNumber === 'string' && ROOT_ORDER_NUMBER_PATTERN.test(orderNumber);
}

/**
 * Splits an order number into its parts.
 * @param orderNumber order number
 * @returns parsed parts, or null when the format is not valid
 */
export function parseOrderNumber(orderNumber: string | null | undefined): OrderNumberResult | null {
  if (typeof orderNumber !== 'string') return null;
  const match = ORDER_NUMBER_PATTERN.exec(orderNumber);
  if (!match) return null;
  const sequence = Number(match[2]);
  if (!Number.isSafeInteger(sequence)) return null;
  const subOrderIndex = match[3] ? Number(match[3]) : null;
  return {
    orderNumber,
    date: match[1],
    sequence,
    subOrderIndex,
    rootOrderNumber: subOrderIndex === null ? orderNumber : orderNumber.slice(0, orderNumber.lastIndexOf('-S')),
  };
}

/**
 * Reads the daily sequence of an order number.
 * @param orderNumber order number
 * @returns the sequence, or null when the format is not valid
 */
export function extractSequence(orderNumber: string | null | undefined): number | null {
  return parseOrderNumber(orderNumber)?.sequence ?? null;
}

/**
 * Pads a sequence to the 4-digit minimum width. Values above 9999 keep all digits.
 * @param sequence positive integer
 * @returns padded sequence (e.g. "0001", "10000")
 */
export function formatSequence(sequence: number): string {
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    throw new Error('Sequence must be a positive integer');
  }
  return String(sequence).padStart(4, '0');
}

/**
 * Display-only prefix for a day. The real day comes from the DB (tenant timezone).
 * @param date day to format (defaults to now, server local time)
 * @returns prefix such as "ORD-20261030-"
 */
export function getOrderNumberPrefix(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `ORD-${year}${month}${day}-`;
}
