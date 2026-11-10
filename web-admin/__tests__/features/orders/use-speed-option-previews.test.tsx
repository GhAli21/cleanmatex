/**
 * Service Speeds S4: each speed in the menu is priced by the server; a speed with
 * no rule for the cart is reported, and nothing is requested until the menu opens.
 */
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';

jest.mock('next-intl', () => ({ useLocale: () => 'en' }));
jest.mock('@/lib/auth/auth-context', () => ({ useAuth: () => ({ currentTenant: { tenant_id: 't1' } }) }));
jest.mock('@/lib/hooks/use-csrf-token', () => ({ useCSRFToken: () => ({ token: 'csrf', loading: false }), getCSRFHeader: () => ({}) }));
jest.mock('@features/orders/api/cart-quote-api', () => {
  class CartQuoteError extends Error {
    constructor(public readonly code: string) { super(code); }
  }
  return { CartQuoteError, fetchCartQuote: jest.fn() };
});

import { CartQuoteError, fetchCartQuote } from '@features/orders/api/cart-quote-api';
import { useSpeedOptionPreviews } from '@features/orders/hooks/use-speed-option-previews';

const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
const source = { requestFor: (serviceSpeed: string) => ({ items: [{ productId: 'p', quantity: 1 }], serviceSpeed }) } as never;
const quote = { currencyCode: 'OMR', decimalPlaces: 3, totals: { saleTotal: 12.5 }, lines: [], readyByAt: '2026-11-10T14:00:00.000Z', timezone: 'Asia/Muscat' };

beforeAll(() => {
  // jsdom has no crypto.randomUUID.
  Object.defineProperty(globalThis, 'crypto', { value: { randomUUID: () => 'req-1' }, configurable: true });
});

beforeEach(() => {
  client.clear();
  (fetchCartQuote as jest.Mock).mockReset();
});

describe('useSpeedOptionPreviews', () => {
  it('requests nothing while the menu is closed', () => {
    renderHook(() => useSpeedOptionPreviews(['EXPRESS'], source, false), { wrapper });
    expect(fetchCartQuote).not.toHaveBeenCalled();
  });

  it('shows the server total and ready time in the organization zone, and flags a speed with no rule', async () => {
    (fetchCartQuote as jest.Mock).mockImplementation(async (request: { serviceSpeed: string }) => {
      if (request.serviceSpeed === 'URGENT') throw new CartQuoteError('SPEED_NOT_OFFERED');
      return quote;
    });
    const { result } = renderHook(() => useSpeedOptionPreviews(['EXPRESS', 'URGENT'], source, true), { wrapper });
    await waitFor(() => expect(result.current.get('URGENT')?.notOffered).toBe(true));
    await waitFor(() => expect(result.current.get('EXPRESS')?.total).toContain('12.500'));
    expect(result.current.get('EXPRESS')?.ready).toMatch(/6:00/);
  });
});
