/**
 * Catalog constants — DB column names and search scopes for product list APIs.
 */

/** Bilingual display-name columns on org_product_data_mst (name / name2 convention). */
export const PRODUCT_NAME_SEARCH_COLUMNS = [
  'product_name',
  'product_name2',
] as const;

/** Short hint shown under the product title in catalog UI. */
export const PRODUCT_HINT_SEARCH_COLUMNS = ['hint_text'] as const;

/** Identifier columns (not display names). */
export const PRODUCT_CODE_SEARCH_COLUMNS = ['product_code', 'id_sku'] as const;

export type ProductSearchScope = 'name' | 'code' | 'all';

export const PRODUCT_SEARCH_SCOPES: readonly ProductSearchScope[] = [
  'name',
  'code',
  'all',
] as const;

/**
 * Columns included per search scope when building PostgREST `or` ilike filters.
 */
export function productSearchColumnsForScope(
  scope: ProductSearchScope = 'all'
): readonly string[] {
  switch (scope) {
    case 'name':
      return [...PRODUCT_NAME_SEARCH_COLUMNS, ...PRODUCT_HINT_SEARCH_COLUMNS];
    case 'code':
      return [...PRODUCT_CODE_SEARCH_COLUMNS];
    case 'all':
    default:
      return [
        ...PRODUCT_NAME_SEARCH_COLUMNS,
        ...PRODUCT_HINT_SEARCH_COLUMNS,
        ...PRODUCT_CODE_SEARCH_COLUMNS,
      ];
  }
}
