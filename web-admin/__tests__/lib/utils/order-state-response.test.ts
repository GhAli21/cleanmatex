import {
  getOrderFromStateResponse,
  mapOrderCustomerFromStateRow,
} from '@/lib/utils/order-state-response';

describe('getOrderFromStateResponse', () => {
  it('returns null when not successful', () => {
    expect(getOrderFromStateResponse({ success: false, order: { id: '1' } })).toBeNull();
  });

  it('prefers data.order then order', () => {
    expect(
      getOrderFromStateResponse({
        success: true,
        data: { order: { id: 'a' } },
        order: { id: 'b' },
      }),
    ).toEqual({ id: 'a' });
    expect(getOrderFromStateResponse({ success: true, order: { id: 'only' } })).toEqual({
      id: 'only',
    });
  });
});

describe('mapOrderCustomerFromStateRow', () => {
  it('prefers sys_customers_mst over org row', () => {
    const row = {
      org_customers_mst: {
        name: 'Org',
        phone: '111',
        sys_customers_mst: { name: 'Sys', phone: '222' },
      },
    };
    expect(mapOrderCustomerFromStateRow(row)).toEqual({ name: 'Sys', phone: '222' });
  });

  it('falls back to org customer', () => {
    const row = {
      org_customers_mst: { name: 'Alice', phone: '999' },
    };
    expect(mapOrderCustomerFromStateRow(row)).toEqual({ name: 'Alice', phone: '999' });
  });

  it('uses defaults when missing', () => {
    expect(mapOrderCustomerFromStateRow({})).toEqual({
      name: 'Unknown Customer',
      phone: 'N/A',
    });
  });
});
