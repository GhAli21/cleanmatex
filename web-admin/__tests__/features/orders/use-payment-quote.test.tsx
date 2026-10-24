import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { isPaymentQuoteReviewCurrent, usePaymentQuote, type UsePaymentQuoteParams } from '@features/orders/hooks/use-payment-quote';
import { fetchOrderPaymentQuote, PaymentQuoteError } from '@features/orders/api/payment-quote-api';
import type { PaymentQuoteData } from '@/lib/types/payment-quote';

jest.mock('@features/orders/api/payment-quote-api', () => ({
  ...jest.requireActual('@features/orders/api/payment-quote-api'),
  fetchOrderPaymentQuote: jest.fn(),
}));

const fetchQuote = jest.mocked(fetchOrderPaymentQuote);
const snapshot = (saleTotal = 100): PaymentQuoteData => ({
  requestId: 'request', currencyCode: 'SAR', decimalPlaces: 2, currencyExRate: 1,
  subtotal: saleTotal, manualDiscount: 0, autoRuleDiscount: 0, promoDiscount: 0,
  afterDiscounts: saleTotal, additionalTaxAmount: 0, vatValue: 0, giftCardApplied: 0,
  saleTotal, vatTaxPercent: 0, taxBreakdown: [], taxProfileEntries: [],
  checkoutOptions: { paymentMethods: [], customerCredits: [] }, storedValueSummary: null,
});
const params = (): UsePaymentQuoteParams => ({
  open: true, sessionKey: 'open-1', tenantOrgId: 'tenant-1', userId: 'cashier-1',
  request: { items: [{ productId: 'product-1', quantity: 1 }], amountDiscount: 0 },
  csrfReady: true, csrfToken: 'csrf',
});
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
};
const createWrapper = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
};

describe('coordinated payment quote lifecycle', () => {
  beforeEach(() => {
    fetchQuote.mockReset();
    if (!crypto.randomUUID) Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: () => 'quote-request' });
  });
  afterEach(() => { jest.useRealTimers(); });

  it('shares the opening request between shell and engine and waits for CSRF', async () => {
    const pending = deferred<PaymentQuoteData>();
    fetchQuote.mockReturnValue(pending.promise);
    const first = params();
    const { result, rerender } = renderHook((p: UsePaymentQuoteParams) => {
      const shell = usePaymentQuote(p);
      // Engine object construction order differs from the bootstrap shell.
      const engine = usePaymentQuote({ ...p, request: { amountDiscount: p.request.amountDiscount, items: p.request.items } });
      return { shell, engine };
    }, { initialProps: { ...first, csrfReady: false }, wrapper: createWrapper() });
    expect(fetchQuote).not.toHaveBeenCalled();
    rerender(first);
    await waitFor(() => expect(fetchQuote).toHaveBeenCalledTimes(1));
    await act(async () => pending.resolve(snapshot()));
    await waitFor(() => expect(result.current.engine.ready).toBe(true));
    expect(result.current.shell.snapshot).toBe(result.current.engine.snapshot);
  });

  it('locks immediately during debounce and ignores a superseded late response', async () => {
    fetchQuote.mockResolvedValueOnce(snapshot());
    const initial = params();
    const { result, rerender } = renderHook(usePaymentQuote, { initialProps: initial, wrapper: createWrapper() });
    await waitFor(() => expect(result.current.ready).toBe(true));
    jest.useFakeTimers();
    const older = deferred<PaymentQuoteData>();
    const latest = deferred<PaymentQuoteData>();
    fetchQuote.mockReturnValueOnce(older.promise).mockReturnValueOnce(latest.promise);
    rerender({ ...initial, request: { ...initial.request, amountDiscount: 10 } });
    expect(result.current.ready).toBe(false);
    expect(result.current.snapshot?.saleTotal).toBe(100);
    expect(fetchQuote).toHaveBeenCalledTimes(1);
    await act(async () => { jest.advanceTimersByTime(300); });
    expect(fetchQuote).toHaveBeenCalledTimes(2);
    const oldSignal = fetchQuote.mock.calls[1][2];
    rerender({ ...initial, request: { ...initial.request, amountDiscount: 20 } });
    expect(oldSignal.aborted).toBe(true);
    await act(async () => { jest.advanceTimersByTime(300); });
    await act(async () => { latest.resolve(snapshot(80)); await jest.advanceTimersByTimeAsync(1); });
    expect(result.current.snapshot?.saleTotal).toBe(80);
    await act(async () => { older.resolve(snapshot(90)); await jest.advanceTimersByTimeAsync(1); });
    expect(result.current.snapshot?.saleTotal).toBe(80);
    expect(result.current.ready).toBe(true);
  });

  it('never carries a financial snapshot across cashier, tenant, branch, customer, or reopening identity', async () => {
    fetchQuote.mockResolvedValue(snapshot());
    const first = params();
    const { result, rerender } = renderHook(usePaymentQuote, { initialProps: first, wrapper: createWrapper() });
    await waitFor(() => expect(result.current.ready).toBe(true));
    for (const update of [
      { ...first, userId: 'cashier-2' },
      { ...first, tenantOrgId: 'tenant-2' },
      { ...first, request: { ...first.request, branchId: 'branch-2' } },
      { ...first, request: { ...first.request, customerId: 'customer-2' } },
      { ...first, sessionKey: 'open-2' },
    ]) {
      const pending = deferred<PaymentQuoteData>();
      fetchQuote.mockReturnValueOnce(pending.promise);
      rerender(update);
      expect(result.current.snapshot).toBeNull();
      expect(result.current.ready).toBe(false);
      await act(async () => pending.resolve(snapshot()));
      await waitFor(() => expect(result.current.ready).toBe(true));
    }
    expect(fetchQuote).toHaveBeenCalledTimes(6);
  });

  it('retains confirmed money on refresh failure, blocks submit, and retries the same inputs', async () => {
    fetchQuote.mockResolvedValueOnce(snapshot());
    const first = params();
    const { result, rerender } = renderHook(usePaymentQuote, { initialProps: first, wrapper: createWrapper() });
    await waitFor(() => expect(result.current.ready).toBe(true));
    fetchQuote.mockRejectedValueOnce(new PaymentQuoteError('PAYMENT_QUOTE_TIMEOUT'));
    rerender({ ...first, request: { ...first.request, amountDiscount: 5 } });
    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(result.current.snapshot?.saleTotal).toBe(100);
    expect(result.current.errorCode).toBe('PAYMENT_QUOTE_TIMEOUT');
    expect(result.current.ready).toBe(false);
    fetchQuote.mockResolvedValueOnce(snapshot(95));
    await act(async () => { await result.current.refetch(); });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.snapshot?.saleTotal).toBe(95);
    expect(fetchQuote.mock.calls[2][0].amountDiscount).toBe(5);
  });

  it('fails closed when authenticated identity disappears instead of spinning forever', () => {
    const { result } = renderHook(usePaymentQuote, { initialProps: { ...params(), userId: undefined }, wrapper: createWrapper() });
    expect(result.current.failed).toBe(true);
    expect(result.current.pending).toBe(false);
    expect(result.current.errorCode).toBe('PAYMENT_CONTEXT_UNAVAILABLE');
    expect(fetchQuote).not.toHaveBeenCalled();
  });

  it('invalidates a reviewed quote for same-total item changes and a same-total tax refresh', async () => {
    fetchQuote.mockResolvedValueOnce({ ...snapshot(), requestId: 'reviewed' });
    const first = params();
    const { result, rerender } = renderHook(usePaymentQuote, { initialProps: first, wrapper: createWrapper() });
    await waitFor(() => expect(result.current.ready).toBe(true));
    const reviewed = result.current.authorityKey;
    expect(isPaymentQuoteReviewCurrent(reviewed, result.current.authorityKey, result.current.ready)).toBe(true);
    const replacement = deferred<PaymentQuoteData>(); fetchQuote.mockReturnValueOnce(replacement.promise);
    rerender({ ...first, request: { ...first.request, items: [{ productId: 'different-same-price', quantity: 1 }] } });
    expect(isPaymentQuoteReviewCurrent(reviewed, result.current.authorityKey, result.current.ready)).toBe(false);
    await waitFor(() => expect(fetchQuote).toHaveBeenCalledTimes(2));
    await act(async () => replacement.resolve({ ...snapshot(), requestId: 'replacement' }));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.snapshot?.saleTotal).toBe(100);
    expect(isPaymentQuoteReviewCurrent(reviewed, result.current.authorityKey, result.current.ready)).toBe(false);
    const secondReview = result.current.authorityKey;
    const taxRefresh = deferred<PaymentQuoteData>(); fetchQuote.mockReturnValueOnce(taxRefresh.promise);
    act(() => { void result.current.refetch(); });
    await waitFor(() => expect(result.current.pending).toBe(true));
    expect(isPaymentQuoteReviewCurrent(secondReview, result.current.authorityKey, result.current.ready)).toBe(false);
    await act(async () => taxRefresh.resolve({ ...snapshot(), requestId: 'new-tax', taxProfileEntries: [{ id: 'changed-tax', name: 'VAT', name2: null, rate: 0, tax_type: 'VAT', is_compound: false, enabled: true }] }));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(isPaymentQuoteReviewCurrent(secondReview, result.current.authorityKey, result.current.ready)).toBe(false);
  });

  it('never relabels entered money when a refresh changes currency rules', async () => {
    fetchQuote.mockResolvedValueOnce(snapshot());
    const first = params();
    const { result } = renderHook(usePaymentQuote, { initialProps: first, wrapper: createWrapper() });
    await waitFor(() => expect(result.current.ready).toBe(true));
    fetchQuote.mockResolvedValueOnce({ ...snapshot(), currencyCode: 'OMR', decimalPlaces: 3 });
    await act(async () => { await result.current.refetch(); });
    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(result.current.errorCode).toBe('PAYMENT_CURRENCY_CHANGED');
    expect(result.current.snapshot?.currencyCode).toBe('SAR');
    expect(result.current.snapshot?.decimalPlaces).toBe(2);
    expect(result.current.ready).toBe(false);
  });
});
