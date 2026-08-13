import { expect, test } from '@playwright/test';

const TOKEN = '85d4c02b74176b3e25c84e0211f55c46';
const LOOKUP_PATH = `**/api/v1/public/track/${TOKEN}`;
const CONFIRM_PATH = `**/api/v1/public/track/${TOKEN}/confirm-received`;

function trackingPayload(status: string) {
  return {
    success: true,
    data: {
      order: {
        id: 'order-1',
        orderNo: 'ORD-20260813-0002',
        status,
        priority: 'normal',
        paymentTypeCode: 'PAY_ON_COLLECTION',
        receivedAt: '2026-08-13T09:21:56.000Z',
        readyBy: null,
        totals: {
          subtotal: 2.354,
          total: 2.354,
          paidAmount: 1,
          paymentStatus: 'PENDING',
          outstandingAmount: 1.354,
          payOnCollectionAmount: 1.354,
        },
        customer: { name: 'Test Customer', name2: null, phone: null, email: null },
        items: [],
      },
      timeline: [],
      moneyConfig: { currencyCode: 'OMR', decimalPlaces: 3 },
    },
  };
}

test.describe('public order tracking', () => {
  test('opens anonymously, shows collection balance, and disables confirmation after delivery', async ({
    page,
  }) => {
    await page.route(LOOKUP_PATH, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(trackingPayload('ready')),
      });
    });
    await page.route(CONFIRM_PATH, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { orderId: 'order-1', status: 'delivered' },
        }),
      });
    });

    await page.goto(`/track/${TOKEN}`);

    expect(new URL(page.url()).pathname).toBe(`/track/${TOKEN}`);
    await expect(page.getByRole('heading', { name: 'Track Your Order' })).toBeVisible();
    await expect(page.getByText('Payment due on collection')).toBeVisible();
    await expect(page.getByText(/1\.354 OMR/)).toBeVisible();

    const confirmButton = page.getByRole('button', {
      name: 'I have received my clothes',
    });
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();

    await expect(
      page.getByText('Thank you! Your order has been marked as received.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Order received' })).toBeDisabled();
  });

  test('keeps confirmation disabled when the order is already delivered', async ({ page }) => {
    await page.route(LOOKUP_PATH, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(trackingPayload('delivered')),
      });
    });

    await page.goto(`/track/${TOKEN}`);

    expect(new URL(page.url()).pathname).toBe(`/track/${TOKEN}`);
    await expect(page.getByRole('button', { name: 'Order received' })).toBeDisabled();
  });
});
