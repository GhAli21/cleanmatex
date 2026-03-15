/**
 * Generate a clean code from a name (uppercase, no spaces, underscores)
 * Used for customer category codes and similar slug/code fields
 */
export function generateCode(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .replace(/\s+/g, '_');
}

/**
 * Generate customer category code.
 * When name produces a valid code (e.g. English), use it.
 * When name is empty or produces no valid code (e.g. Arabic-only), return CUST_CTG_00XX
 * where XX = last display_order + 1 (padded to 4 digits).
 * Useful when user language is Arabic and they type the name first.
 */
export function generateCustomerCategoryCode(
  name: string,
  categories: { display_order?: number | null }[]
): string {
  const fromName = generateCode(name);
  if (fromName && fromName.length > 0) {
    return fromName;
  }
  const maxOrder = categories.reduce(
    (max, c) => Math.max(max, c.display_order ?? 0),
    0
  );
  const nextNum = maxOrder + 1;
  return `CUST_CTG_${String(nextNum).padStart(4, '0')}`;
}
