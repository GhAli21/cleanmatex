import { allocateReviewedTax } from '@/lib/services/order-change/order-change-commercial-write';

describe('allocateReviewedTax', () => {
  it('puts the reviewed tax on the only tax line', () => {
    expect(allocateReviewedTax(
      [{ id: 'vat', taxAmount: '3.8700' }],
      '4.3200',
    )).toEqual([{ id: 'vat', taxAmount: '4.3200' }]);
  });

  it('keeps the reviewed total when several lines share the tax', () => {
    const allocated = allocateReviewedTax(
      [
        { id: 'vat', taxAmount: '3.0000' },
        { id: 'municipal', taxAmount: '1.0000' },
      ],
      '8.0000',
    );
    expect(allocated).toEqual([
      { id: 'vat', taxAmount: '6.0000' },
      { id: 'municipal', taxAmount: '2.0000' },
    ]);
  });
});
