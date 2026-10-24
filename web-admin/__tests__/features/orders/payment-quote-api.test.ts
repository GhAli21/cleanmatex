import { fetchOrderPaymentQuote, fetchPaymentMetadata, PaymentQuoteError } from '@features/orders/api/payment-quote-api';
import type { PaymentQuoteRequest } from '@/lib/types/payment-quote';

const request: PaymentQuoteRequest = { requestId: 'quote-1', items: [{ productId: 'product-1', quantity: 1 }] };
const validData = () => ({ requestId: request.requestId, currencyCode: 'SAR', decimalPlaces: 2, currencyExRate: 1,
  subtotal: 100, manualDiscount: 0, autoRuleDiscount: 0, promoDiscount: 0, afterDiscounts: 100,
  additionalTaxAmount: 0, vatValue: 0, giftCardApplied: 0, saleTotal: 100, vatTaxPercent: 0,
  roundingAdjustmentAmount: -0.01, taxBreakdown: [], taxProfileEntries: [], storedValueSummary: null,
  checkoutOptions: { paymentMethods: [{ id: 'method', payment_method_code: 'CUSTOM_CARD_RAIL', payment_nature: 'REAL_PAYMENT',
    gateway_code: null, display_name: 'Custom payment', display_name2: null, description: null, description2: null,
    requires_cash_drawer: false, requires_terminal: false, supports_overpayment: false, supports_change_return: false,
    requires_reference: false, allowed_in_pos: true }], customerCredits: [] } });

describe('payment quote request boundary', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; jest.useRealTimers(); });

  it('preserves structured currency errors instead of labelling every failure as currency missing', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({ success: false, errorCode: 'MISSING_TENANT_CURRENCY' }) });
    await expect(fetchOrderPaymentQuote(request, 'csrf', new AbortController().signal)).rejects.toMatchObject({ code: 'MISSING_TENANT_CURRENCY' });
  });

  it('rejects a mismatched response correlation token', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: { requestId: 'old-request' } }) });
    await expect(fetchOrderPaymentQuote(request, 'csrf', new AbortController().signal)).rejects.toMatchObject({ code: 'PAYMENT_QUOTE_INVALID' });
  });

  it('distinguishes unavailable metadata from a successfully empty catalog', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: false, json: async () => ({ success: false }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: [] }) });
    await expect(fetchPaymentMetadata('/api/v1/settings/payments/terminals', new AbortController().signal)).rejects.toMatchObject({ code: 'PAYMENT_METADATA_UNAVAILABLE' });
    await expect(fetchPaymentMetadata('/api/v1/settings/payments/terminals', new AbortController().signal)).resolves.toEqual([]);
  });

  it.each([
    ['missing subtotal', { subtotal: undefined }],
    ['nonfinite VAT', { vatValue: Number.NaN }],
    ['negative payable', { saleTotal: -1 }],
    ['fractional precision', { decimalPlaces: 2.5 }],
    ['malformed tax amount', { taxBreakdown: [{ taxType: 'VAT', label: 'VAT', label2: null, rate: 15, baseAmount: 100, taxAmount: null, isCompound: false }] }],
    ['malformed selected tax', { taxProfileEntries: [{ id: 'tax', enabled: 'yes' }] }],
    ['malformed method', { checkoutOptions: { paymentMethods: [{ payment_method_code: 'CUSTOM_CARD_RAIL' }], customerCredits: [] } }],
  ])('rejects %s before values reach money fields', async (_label, invalid) => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: { ...validData(), ...invalid } }) });
    await expect(fetchOrderPaymentQuote(request, 'csrf', new AbortController().signal)).rejects.toMatchObject({ code: 'PAYMENT_QUOTE_INVALID' });
  });

  it('accepts dynamic method codes and signed rounding in a complete quote', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: validData() }) });
    await expect(fetchOrderPaymentQuote(request, 'csrf', new AbortController().signal)).resolves.toMatchObject({ roundingAdjustmentAmount: -0.01,
      checkoutOptions: { paymentMethods: [expect.objectContaining({ payment_method_code: 'CUSTOM_CARD_RAIL' })] } });
  });

  it('ends a hung read at the deadline and propagates query cancellation', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn((_url, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    })) as jest.MockedFunction<typeof fetch>;
    const timeoutRequest = fetchOrderPaymentQuote(request, 'csrf', new AbortController().signal);
    const timeoutAssertion = expect(timeoutRequest).rejects.toEqual(new PaymentQuoteError('PAYMENT_QUOTE_TIMEOUT'));
    await jest.advanceTimersByTimeAsync(30_000);
    await timeoutAssertion;
    const controller = new AbortController();
    const cancelled = fetchOrderPaymentQuote(request, 'csrf', controller.signal);
    controller.abort();
    await expect(cancelled).rejects.toMatchObject({ name: 'AbortError' });
  });
});
