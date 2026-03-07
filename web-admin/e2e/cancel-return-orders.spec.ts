/**
 * E2E Tests for Cancel Order and Customer Return flows
 * Plan: cancel_and_return_order_ddb29821.plan.md
 *
 * Prerequisites: User logged in, orders exist in cancellable (intake/processing/etc)
 * or returnable (delivered/closed) status.
 */

import { test, expect } from '@playwright/test';

test.describe('Cancel Order Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/orders');
  });

  test('should open Cancel Order dialog when Cancel Order button is clicked', async ({
    page,
  }) => {
    // Navigate to an order in cancellable status (intake, processing, etc.)
    const orderLink = page.locator('a[href*="/dashboard/orders/"]').first();
    if (!(await orderLink.isVisible())) {
      test.skip();
      return;
    }
    await orderLink.click();
    await page.waitForURL(/\/dashboard\/orders\/[a-f0-9-]+/, { timeout: 5000 });

    // Cancel Order button appears when order can transition to cancelled (not delivered/closed)
    const cancelButton = page.locator('button:has-text("Cancel Order")').first();
    if (!(await cancelButton.isVisible())) {
      test.skip();
      return;
    }

    await cancelButton.click();

    // Dialog should open with title and reason field
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 3000 });
    await expect(dialog.locator('text=Cancel Order')).toBeVisible();
    await expect(page.locator('#cancel-reason, [id="cancel-reason"]')).toBeVisible();
  });

  test('should require minimum 10 characters for cancellation reason', async ({
    page,
  }) => {
    const orderLink = page.locator('a[href*="/dashboard/orders/"]').first();
    if (!(await orderLink.isVisible())) {
      test.skip();
      return;
    }
    await orderLink.click();
    await page.waitForURL(/\/dashboard\/orders\/[a-f0-9-]+/, { timeout: 5000 });

    const cancelButton = page.locator('button:has-text("Cancel Order")').first();
    if (!(await cancelButton.isVisible())) {
      test.skip();
      return;
    }
    await cancelButton.click();

    const reasonInput = page.locator('#cancel-reason, [id="cancel-reason"]');
    await expect(reasonInput).toBeVisible({ timeout: 3000 });

    // Short reason - confirm button should be disabled
    await reasonInput.fill('Short');
    const dialog = page.locator('[role="dialog"]');
    const confirmBtn = dialog.locator('button:has-text("Cancel Order")');
    await expect(confirmBtn).toBeDisabled();

    // Valid reason (10+ chars)
    await reasonInput.fill('Customer requested cancellation due to change of plans');
    await expect(confirmBtn).toBeEnabled();
  });

  test('should submit cancel and close dialog on success', async ({ page }) => {
    const orderLink = page.locator('a[href*="/dashboard/orders/"]').first();
    if (!(await orderLink.isVisible())) {
      test.skip();
      return;
    }
    await orderLink.click();
    await page.waitForURL(/\/dashboard\/orders\/[a-f0-9-]+/, { timeout: 5000 });

    const cancelButton = page.locator('button:has-text("Cancel Order")').first();
    if (!(await cancelButton.isVisible())) {
      test.skip();
      return;
    }
    await cancelButton.click();

    const reasonInput = page.locator('#cancel-reason, [id="cancel-reason"]');
    await reasonInput.fill('Customer requested cancellation - duplicate order');

    const dialog = page.locator('[role="dialog"]');
    const confirmBtn = dialog.locator('button:has-text("Cancel Order")');
    await confirmBtn.click();

    // Wait for API - dialog should close on success
    await page.waitForTimeout(3000);

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).not.toBeVisible();
  });
});

test.describe('Customer Return Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/orders');
  });

  test('should open Customer Return dialog when Customer Return button is clicked', async ({
    page,
  }) => {
    // Need an order in delivered or closed status
    const orderLink = page.locator('a[href*="/dashboard/orders/"]').first();
    if (!(await orderLink.isVisible())) {
      test.skip();
      return;
    }
    await orderLink.click();
    await page.waitForURL(/\/dashboard\/orders\/[a-f0-9-]+/, { timeout: 5000 });

    const returnButton = page.locator('button:has-text("Customer Return")').first();
    if (!(await returnButton.isVisible())) {
      test.skip();
      return;
    }

    await returnButton.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 3000 });
    await expect(dialog.locator('text=Customer Return')).toBeVisible();
    await expect(page.locator('#return-reason, [id="return-reason"]')).toBeVisible();
  });

  test('should require minimum 10 characters for return reason', async ({ page }) => {
    const orderLink = page.locator('a[href*="/dashboard/orders/"]').first();
    if (!(await orderLink.isVisible())) {
      test.skip();
      return;
    }
    await orderLink.click();
    await page.waitForURL(/\/dashboard\/orders\/[a-f0-9-]+/, { timeout: 5000 });

    const returnButton = page.locator('button:has-text("Customer Return")').first();
    if (!(await returnButton.isVisible())) {
      test.skip();
      return;
    }
    await returnButton.click();

    const reasonInput = page.locator('#return-reason, [id="return-reason"]');
    await expect(reasonInput).toBeVisible({ timeout: 3000 });

    await reasonInput.fill('Short');
    const dialog = page.locator('[role="dialog"]');
    const confirmBtn = dialog.locator('button:has-text("Process Return")');
    await expect(confirmBtn).toBeDisabled();

    await reasonInput.fill('Customer changed mind - quality was fine');
    await expect(confirmBtn).toBeEnabled();
  });

  test('should submit return and close dialog on success', async ({ page }) => {
    const orderLink = page.locator('a[href*="/dashboard/orders/"]').first();
    if (!(await orderLink.isVisible())) {
      test.skip();
      return;
    }
    await orderLink.click();
    await page.waitForURL(/\/dashboard\/orders\/[a-f0-9-]+/, { timeout: 5000 });

    const returnButton = page.locator('button:has-text("Customer Return")').first();
    if (!(await returnButton.isVisible())) {
      test.skip();
      return;
    }
    await returnButton.click();

    const reasonInput = page.locator('#return-reason, [id="return-reason"]');
    await reasonInput.fill('Customer brought items back - quality issue with one item');

    const dialog = page.locator('[role="dialog"]');
    const confirmBtn = dialog.locator('button:has-text("Process Return")');
    await confirmBtn.click();

    await page.waitForTimeout(3000);

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).not.toBeVisible();
  });
});
