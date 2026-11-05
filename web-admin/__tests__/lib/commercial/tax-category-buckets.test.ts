/**
 * Line-Level P8-01: the header buckets, built from stored rows, must equal what the
 * calculator computed, including a DOCUMENT_LEVEL discount taken off its category.
 */
import { calculateTax } from '@/lib/commercial/tax';
import { orderTaxCategoryBuckets } from '@/lib/commercial/tax-category-buckets';

const row = (rowId: string, netAmount: string, taxCategoryCode: string) => ({
  rowId, netAmount, taxCategoryCode, exemptReason: null, profiles: [],
});

describe('orderTaxCategoryBuckets', () => {
  it('sums lines and charges per category and takes document discounts off', () => {
    const buckets = orderTaxCategoryBuckets(
      [
        { taxCategoryCode: 'EXEMPT', amount: '10' },
        { taxCategoryCode: 'EXEMPT', amount: '5.5' },
        { taxCategoryCode: 'ZERO_RATED', amount: '3' },
        { taxCategoryCode: 'STANDARD', amount: '20' },
      ],
      [{ taxCategoryCode: 'OUT_OF_SCOPE', amount: '2' }],
      [{ taxCategoryCode: 'EXEMPT', amount: '1.5' }],
    );
    expect(buckets.exempt.toString()).toBe('14');
    expect(buckets.zeroRated.toString()).toBe('3');
    expect(buckets.outOfScope.toString()).toBe('2');
    expect(buckets.standard.toString()).toBe('20');
  });

  it('ignores an older row with no category or no amount', () => {
    const buckets = orderTaxCategoryBuckets(
      [{ taxCategoryCode: null, amount: '10' }, { taxCategoryCode: 'EXEMPT', amount: null }],
      [],
      [],
    );
    expect(buckets.exempt.toString()).toBe('0');
    expect(buckets.standard.toString()).toBe('0');
  });

  it('matches the calculator for rows it stores', () => {
    const allowances = new Map([['EXEMPT', '1.5']]);
    const result = calculateTax({
      rows: [row('a', '10', 'EXEMPT'), row('b', '5.5', 'EXEMPT'), row('c', '3', 'ZERO_RATED')],
      pricingMode: 'TAX_EXCLUSIVE',
      documentAllowances: allowances,
      currencyDecimalPlaces: 3,
    });
    const stored = [...result.rows.values()].map((r) => ({ taxCategoryCode: r.taxCategoryCode, amount: r.taxableAmount }));

    const buckets = orderTaxCategoryBuckets(stored, [], [{ taxCategoryCode: 'EXEMPT', amount: '1.5' }]);

    expect(buckets.exempt.toString()).toBe(result.categoryTaxable.get('EXEMPT')?.toString());
    expect(buckets.zeroRated.toString()).toBe(result.categoryTaxable.get('ZERO_RATED')?.toString());
  });
});
