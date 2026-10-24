import { expect, test, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

/** Browser fetch preserves production Secure-cookie behavior on the local trustworthy origin. */
async function postQuote(page: Page, data: Record<string, unknown>) {
  return page.evaluate(async (payload) => {
    const csrfResponse = await fetch('/api/auth/csrf-token');
    if (!csrfResponse.ok) throw new Error(`CSRF fixture unavailable: HTTP ${csrfResponse.status}`);
    const { token } = await csrfResponse.json();
    const response = await fetch('/api/v1/orders/payment-quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
      body: JSON.stringify(payload),
    });
    return {
      status: response.status,
      body: await response.json(),
      cacheControl: response.headers.get('cache-control'),
      serverTiming: response.headers.get('server-timing'),
    };
  }, data);
}

/** Uses real authenticated reads against existing catalog data; never submits an order or payment. */
test.describe('Payment quote authenticated integration', () => {
  test.setTimeout(60_000);

  test.beforeEach(async ({ page }) => {
    // Use the same cookie transport as the cashier UI without requiring a POS session to create an order.
    const response = await page.goto('/api/auth/csrf-token');
    expect(response?.status()).toBe(200);
  });

  test('quotes a live catalog item with amount-matched options and bounded stage telemetry', async ({ page }) => {
    const catalogResponse = await page.request.get('/api/v1/products?limit=1&status=active');
    expect(catalogResponse.ok()).toBe(true);
    const catalog = await catalogResponse.json();
    expect(catalog.data?.length).toBeGreaterThan(0);
    const product = catalog.data[0];
    const requestId = randomUUID();
    const response = await postQuote(page, {
        requestId,
        items: [{ productId: product.id, quantity: 1 }],
        isExpress: false,
        percentDiscount: 0,
        amountDiscount: 0,
        ...(typeof product.service_category_code === 'string' ? { serviceCategories: [product.service_category_code] } : {}),
    });
    const body = response.body;
    expect(response.status, JSON.stringify({ errorCode: body.errorCode })).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.requestId).toBe(requestId);
    expect(body.data.currencyCode).toMatch(/^[A-Z]{3}$/);
    expect(Number.isInteger(body.data.decimalPlaces)).toBe(true);
    expect(body.data.saleTotal).toBeGreaterThanOrEqual(0);
    expect(body.data.checkoutOptions.paymentMethods).toBeInstanceOf(Array);
    expect(body.data.taxProfileEntries).toBeInstanceOf(Array);
    expect(body.data.storedValueSummary).toBeNull();
    expect(response.cacheControl).toContain('no-store');
    expect(response.serverTiming).toContain('pricing;dur=');
    expect(response.serverTiming).toContain('tax;dur=');
    console.info('[payment-quote live stage timing]', response.serverTiming);
  });

  test('rejects an unowned branch before calculating financials', async ({ page }) => {
    const response = await postQuote(page, { requestId: randomUUID(), branchId: randomUUID(), items: [{ productId: randomUUID(), quantity: 1 }] });
    expect(response.status).toBe(400);
    expect(response.body.errorCode).toBe('PAYMENT_CONTEXT_NOT_FOUND');
    expect(response.serverTiming).not.toContain('pricing;dur=');
  });
});
