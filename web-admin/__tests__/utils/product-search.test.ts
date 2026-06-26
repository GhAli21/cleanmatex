import { describe, it, expect } from '@jest/globals';
import { buildProductSearchOrFilter } from '@/lib/utils/product-search';

describe('buildProductSearchOrFilter', () => {
  it('matches bilingual name columns and hint for name scope', () => {
    const filter = buildProductSearchOrFilter('shirt', 'name');
    expect(filter).toBe(
      'product_name.ilike.%shirt%,product_name2.ilike.%shirt%,hint_text.ilike.%shirt%'
    );
  });

  it('includes code columns for all scope', () => {
    const filter = buildProductSearchOrFilter('SKU-1', 'all');
    expect(filter).toContain('product_code.ilike.%SKU-1%');
    expect(filter).toContain('product_name.ilike.%SKU-1%');
    expect(filter).toContain('id_sku.ilike.%SKU-1%');
  });

  it('returns null for blank search', () => {
    expect(buildProductSearchOrFilter('   ', 'name')).toBeNull();
  });
});
