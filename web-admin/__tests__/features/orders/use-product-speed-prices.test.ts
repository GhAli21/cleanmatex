/**
 * Line-Level P7-04: product cards price through the cart quote. No request at
 * Standard speed or in Edit; retail items are left out; an answer that does not
 * belong to the screen shows nothing rather than an old price.
 */
import { renderHook } from '@testing-library/react';

const useCartQuote = jest.fn();
let orderState: Record<string, unknown>;

jest.mock('@/lib/auth/auth-context', () => ({ useAuth: () => ({ currentTenant: { tenant_id: 't1' } }) }));
jest.mock('@/lib/hooks/use-csrf-token', () => ({ useCSRFToken: () => ({ token: 'x', loading: false }) }));
jest.mock('@features/orders/hooks/use-cart-quote', () => ({ useCartQuote: (p: unknown) => useCartQuote(p) }));
jest.mock('@features/orders/hooks/use-new-order-state', () => ({ useNewOrderStateWithDispatch: () => ({ state: orderState }) }));

import { useProductSpeedPrices } from '@features/orders/hooks/use-product-speed-prices';
import type { Product } from '@features/orders/model/new-order-types';

const product = (id: string, over: Partial<Product> = {}): Product => ({
  id, product_code: id, product_name: id, product_name2: null, default_sell_price: 2, service_category_code: 'DRY', ...over,
});

beforeEach(() => {
  useCartQuote.mockReset();
  useCartQuote.mockReturnValue({ current: false, data: null });
  orderState = { branchId: 'b1', customer: { id: 'c1' }, serviceSpeed: 'EXPRESS', isEditMode: false };
});

describe('useProductSpeedPrices', () => {
  it('quotes one unit of each service product and maps the answer back by position', () => {
    useCartQuote.mockReturnValue({ current: true, data: { lines: [{ index: 0, grossAmount: 3 }, { index: 1, grossAmount: 4.5 }] } });
    const products = [product('a'), product('retail', { is_retail_item: true }), product('b')];
    const { result } = renderHook(() => useProductSpeedPrices(products));

    const params = useCartQuote.mock.calls[0][0];
    expect(params.enabled).toBe(true);
    expect(params.request.items).toEqual([{ productId: 'a', quantity: 1 }, { productId: 'b', quantity: 1 }]);
    expect(params.request).toMatchObject({ branchId: 'b1', customerId: 'c1', serviceSpeed: 'EXPRESS', serviceCategories: ['DRY'] });
    expect(result.current?.get('a')).toBe(3);
    expect(result.current?.get('b')).toBe(4.5);
    expect(result.current?.has('retail')).toBe(false);
  });

  it.each([
    ['Standard speed', { serviceSpeed: 'STANDARD' }],
    ['Order Edit', { isEditMode: true }],
  ])('sends no request at %s', (_name, over) => {
    orderState = { ...orderState, ...over };
    renderHook(() => useProductSpeedPrices([product('a')]));
    expect(useCartQuote.mock.calls[0][0].enabled).toBe(false);
  });

  it('shows nothing while the answer is not for the current screen', () => {
    useCartQuote.mockReturnValue({ current: false, data: { lines: [{ index: 0, grossAmount: 3 }] } });
    const { result } = renderHook(() => useProductSpeedPrices([product('a')]));
    expect(result.current).toBeNull();
  });
});
