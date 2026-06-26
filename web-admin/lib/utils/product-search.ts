import {
  productSearchColumnsForScope,
  type ProductSearchScope,
} from '@/lib/constants/catalog';

/**
 * Strip characters that break PostgREST `.or()` filter strings.
 */
export function sanitizeProductSearchTerm(term: string): string {
  return term.replace(/[%_,()]/g, ' ').trim();
}

/**
 * Build a PostgREST `or` filter matching `term` across the given scope columns.
 */
export function buildProductSearchOrFilter(
  term: string,
  scope: ProductSearchScope = 'all'
): string | null {
  const sanitized = sanitizeProductSearchTerm(term);
  if (!sanitized) {
    return null;
  }

  const pattern = `%${sanitized}%`;
  return productSearchColumnsForScope(scope)
    .map((column) => `${column}.ilike.${pattern}`)
    .join(',');
}
