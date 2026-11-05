/**
 * Equality of a line's cashier price and discount (Line-Level P6-02c), shared by
 * the Edit screen (which sends only what changed) and Preview (which reports no
 * change for the same entry). No imports, so the client bundle stays free of the
 * server money library: money text has at most 4 decimals, which a Number holds exactly.
 */

/** A line discount as both sides carry it. */
export interface LineDiscountLike {
  type: string;
  value: string;
  reason?: string | null;
}

/**
 * True when two optional money values are the same amount (both absent counts as the same).
 * @param left money text or null
 * @param right money text or null
 * @returns whether they are equal
 * @example sameOptionalMoney('5', '5.0000'); // true
 */
export function sameOptionalMoney(left: string | null, right: string | null): boolean {
  if (left == null || right == null) return left == null && right == null;
  return Number(left) === Number(right);
}

/**
 * True when two line discounts are the same entry (type, value and reason).
 * @param left a discount or null
 * @param right a discount or null
 * @returns whether they are equal
 * @example sameLineDiscount({ type: 'PERCENTAGE', value: '10', reason: 'Stain' }, { type: 'PERCENTAGE', value: '10.00', reason: 'Stain' }); // true
 */
export function sameLineDiscount(left: LineDiscountLike | null, right: LineDiscountLike | null): boolean {
  if (!left || !right) return !left && !right;
  return left.type === right.type && sameOptionalMoney(left.value, right.value) && (left.reason ?? null) === (right.reason ?? null);
}
