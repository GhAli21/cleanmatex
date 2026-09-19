import {
  customerSnapshotFieldChanged,
  pickChangedCustomerSnapshot,
  serializeOrderCustomerSnapshot,
} from '@/lib/utils/order-customer-snapshot';

describe('order-customer-snapshot', () => {
  it('keeps the order snapshot instead of the live customer master name', () => {
    expect(
      serializeOrderCustomerSnapshot({
        customer_name: 'Jh Test dev21',
        customer_mobile_number: '+96896662624',
        customer_email: 'jhtest.dev21@gmail.com',
      })
    ).toEqual({
      customer_name: 'Jh Test dev21',
      customer_mobile: '+96896662624',
      customer_email: 'jhtest.dev21@gmail.com',
    });
  });

  it('does not emit customer fields when the user did not change them', () => {
    expect(
      pickChangedCustomerSnapshot({
        nextName: 'Test Customer2 Mohammed Ahmed',
        originalName: 'Test Customer2 Mohammed Ahmed',
        nextMobile: '+96896662624',
        originalMobile: '+96896662624',
      })
    ).toEqual({});
  });

  it('emits customer name only when it actually changed', () => {
    expect(
      pickChangedCustomerSnapshot({
        nextName: 'Test Customer2 Mohammed Ahmed',
        originalName: 'Jh Test dev21',
      })
    ).toEqual({ customerName: 'Test Customer2 Mohammed Ahmed' });
  });

  it('treats trimmed strings as unchanged', () => {
    expect(customerSnapshotFieldChanged('  Ahmed  ', 'Ahmed')).toBe(false);
  });
});
