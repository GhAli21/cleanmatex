import { safeOrderEditReturnPath } from '@features/orders/order-change/edit-page-session';

const ORDER_ID = '22222222-2222-4222-8222-222222222222';

describe('safeOrderEditReturnPath', () => {
  it('returns order details when the caller path is missing or off-site', () => {
    expect(safeOrderEditReturnPath(ORDER_ID, null)).toBe(`/dashboard/orders/${ORDER_ID}`);
    expect(safeOrderEditReturnPath(ORDER_ID, 'https://evil.example/dashboard/orders')).toBe(`/dashboard/orders/${ORDER_ID}`);
    expect(safeOrderEditReturnPath(ORDER_ID, '//evil.example/dashboard/orders')).toBe(`/dashboard/orders/${ORDER_ID}`);
    expect(safeOrderEditReturnPath(ORDER_ID, `/dashboard/orders/${ORDER_ID}/edit`)).toBe(`/dashboard/orders/${ORDER_ID}`);
  });

  it('keeps an allowed in-app return path and its safe query', () => {
    expect(safeOrderEditReturnPath(ORDER_ID, `/dashboard/orders/${ORDER_ID}/full?tab=items&returnUrl=/dashboard/orders`))
      .toBe(`/dashboard/orders/${ORDER_ID}/full?tab=items&returnUrl=%2Fdashboard%2Forders`);
    expect(safeOrderEditReturnPath(ORDER_ID, '/dashboard/preparation'))
      .toBe('/dashboard/preparation');
  });

  it('sends collection follow-up back to the payments tab on order details', () => {
    expect(safeOrderEditReturnPath(ORDER_ID, `/dashboard/orders/${ORDER_ID}`, true))
      .toBe(`/dashboard/orders/${ORDER_ID}?tab=payments-credits`);
    expect(safeOrderEditReturnPath(ORDER_ID, `/dashboard/orders/${ORDER_ID}/full`, true))
      .toBe(`/dashboard/orders/${ORDER_ID}/full`);
  });
});
