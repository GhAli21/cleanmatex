import {
  isOrderEditFormDirty,
  resolveEditCustomerSnapshot,
  type OrderEditDirtyCurrent,
} from '@/src/features/orders/lib/order-edit-dirty';
import type { OrderItem } from '@/src/features/orders/model/new-order-types';

function item(overrides: Partial<OrderItem> = {}): OrderItem {
  return {
    productId: 'prod-1',
    productName: 'Shirt',
    productName2: null,
    quantity: 1,
    pricePerUnit: 2.5,
    totalPrice: 2.5,
    defaultSellPrice: 2.5,
    defaultExpressSellPrice: null,
    ...overrides,
  };
}

function current(overrides: Partial<OrderEditDirtyCurrent> = {}): OrderEditDirtyCurrent {
  return {
    customerId: 'cust-1',
    branchId: 'branch-1',
    notes: '',
    customerNotes: '',
    paymentNotes: '',
    express: false,
    customerName: 'Ahmed',
    customerMobile: '+96890000000',
    customerEmail: 'a@test.com',
    readyByAt: '2026-09-20T10:00:00.000Z',
    items: [item()],
    orderServicePrefs: [],
    ...overrides,
  };
}

const original = {
  customer_id: 'cust-1',
  branch_id: 'branch-1',
  internal_notes: '',
  customer_notes: '',
  payment_notes: '',
  notes: '',
  is_express: false,
  customer_name: 'Ahmed',
  customer_mobile: '+96890000000',
  customer_email: 'a@test.com',
  ready_by_at: '2026-09-20T10:00:00.000Z',
  order_service_prefs: [],
  items: [
    {
      product_id: 'prod-1',
      quantity: 1,
      price_per_unit: 2.5,
      notes: '',
      pieces: [],
    },
  ],
};

describe('isOrderEditFormDirty', () => {
  it('is clean when form matches the loaded order', () => {
    expect(isOrderEditFormDirty(current(), original)).toBe(false);
  });

  it('detects customer notes even when GET notes is the internal/customer combo', () => {
    expect(
      isOrderEditFormDirty(
        current({ customerNotes: 'please fold' }),
        { ...original, customer_notes: '', notes: '' }
      )
    ).toBe(true);
  });

  it('detects customer name / phone / email from the snapshot override', () => {
    const shown = resolveEditCustomerSnapshot(
      { name: 'Ahmed Ali', phone: '+96891111111', email: 'b@test.com' },
      { name: 'Ahmed', mobile: '+96890000000', email: 'a@test.com' }
    );
    expect(
      isOrderEditFormDirty(
        current({
          customerName: shown.name,
          customerMobile: shown.mobile,
          customerEmail: shown.email,
        }),
        original
      )
    ).toBe(true);
  });

  it('does not treat an override that matches the header as dirty', () => {
    const shown = resolveEditCustomerSnapshot(
      { name: 'Ahmed' },
      { name: 'Ahmed', mobile: '+96890000000', email: 'a@test.com' }
    );
    expect(
      isOrderEditFormDirty(
        current({ customerName: shown.name }),
        original
      )
    ).toBe(false);
  });

  it('compares internal notes to internal_notes, not the GET notes combo', () => {
    expect(
      isOrderEditFormDirty(
        current({ notes: 'staff only' }),
        { ...original, internal_notes: '', notes: 'please fold', customer_notes: 'please fold' }
      )
    ).toBe(true);
    expect(
      isOrderEditFormDirty(
        current({ notes: '', customerNotes: 'please fold' }),
        { ...original, internal_notes: '', notes: 'please fold', customer_notes: 'please fold' }
      )
    ).toBe(false);
  });

  it('detects payment notes, express, ready-by, and order prefs', () => {
    expect(isOrderEditFormDirty(current({ paymentNotes: 'paid later' }), original)).toBe(true);
    expect(isOrderEditFormDirty(current({ express: true }), original)).toBe(true);
    expect(isOrderEditFormDirty(current({ readyByAt: '2026-09-21T10:00:00.000Z' }), original)).toBe(true);
    expect(
      isOrderEditFormDirty(
        current({
          orderServicePrefs: [{ preference_code: 'FRAGILE', source: 'manual', extra_price: 0.5 }],
        }),
        original
      )
    ).toBe(true);
  });

  it('detects item qty, item prefs, packing, and piece prefs', () => {
    expect(isOrderEditFormDirty(current({ items: [item({ quantity: 2 })] }), original)).toBe(true);
    expect(
      isOrderEditFormDirty(
        current({
          items: [item({
            servicePrefs: [{ preference_code: 'STARCH_HEAVY', source: 'manual', extra_price: 0.3 }],
          })],
        }),
        original
      )
    ).toBe(true);
    expect(
      isOrderEditFormDirty(
        current({ items: [item({ packingPrefCode: 'HANG' })] }),
        original
      )
    ).toBe(true);
    expect(
      isOrderEditFormDirty(
        current({
          items: [item({
            pieces: [{
              id: 'temp-1',
              itemId: 'prod-1',
              pieceSeq: 1,
              servicePrefs: [{ preference_code: 'ANTI_BACTERIAL', source: 'manual', extra_price: 0.4 }],
            }],
          })],
        }),
        { ...original, items: [{ ...original.items[0], pieces: [{ piece_seq: 1, service_prefs: [] }] }] }
      )
    ).toBe(true);
  });
});
