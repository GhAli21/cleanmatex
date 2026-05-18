/**
 * E2E Tests: Cash Drawer
 *
 * Covers:
 * - Open a session with opening float
 * - Record a cash movement (CASH_IN)
 * - Close session with physical count and variance display
 */

import { test, expect } from '@playwright/test';

test.describe('Cash Drawer Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/billing/cash-drawers');
  });

  test('should display cash drawers list', async ({ page }) => {
    await expect(page.locator('h1, h2').first()).toBeVisible();
    // Page loads without error
    await expect(page).not.toHaveURL(/error/);
  });

  test('should open a cash drawer session', async ({ page }) => {
    // Click first available open/activate button
    const openButton = page.locator('button').filter({ hasText: /open session|start session/i }).first();

    if (await openButton.isVisible()) {
      await openButton.click();

      // Fill opening float
      const floatInput = page.locator('input[name*="balance"], input[name*="float"], input[placeholder*="opening"]').first();
      if (await floatInput.isVisible()) {
        await floatInput.fill('100');
        await page.locator('button[type="submit"]').click();
        await expect(page.locator('text=/session.*open|open.*success/i').first()).toBeVisible({ timeout: 5000 });
      }
    } else {
      // No drawers available — skip gracefully
      test.skip();
    }
  });

  test('should record a cash movement', async ({ page }) => {
    // Navigate to a drawer detail page if available
    const drawerLink = page.locator('a[href*="/billing/cash-drawers/"]').first();
    if (await drawerLink.isVisible()) {
      await drawerLink.click();

      const movementBtn = page.locator('button').filter({ hasText: /add movement|cash in|cash out/i }).first();
      if (await movementBtn.isVisible()) {
        await movementBtn.click();
        await page.locator('input[name*="amount"]').first().fill('50');

        const reasonInput = page.locator('input[name*="reason"], textarea[name*="reason"]').first();
        if (await reasonInput.isVisible()) {
          await reasonInput.fill('Change fund replenishment');
        }

        await page.locator('button[type="submit"]').click();
        await expect(page.locator('text=/movement.*recorded|added|success/i').first())
          .toBeVisible({ timeout: 5000 });
      }
    } else {
      test.skip();
    }
  });

  test('should close a session and display variance', async ({ page }) => {
    const drawerLink = page.locator('a[href*="/billing/cash-drawers/"]').first();
    if (await drawerLink.isVisible()) {
      await drawerLink.click();

      const closeButton = page.locator('button').filter({ hasText: /close session/i }).first();
      if (await closeButton.isVisible()) {
        await closeButton.click();

        const countInput = page.locator('input[name*="count"], input[name*="physical"], input[name*="amount"]').first();
        if (await countInput.isVisible()) {
          await countInput.fill('100');
          await page.locator('button[type="submit"]').click();

          // Variance should be shown
          await expect(page.locator('text=/variance|difference/i').first())
            .toBeVisible({ timeout: 5000 });
        }
      }
    } else {
      test.skip();
    }
  });

  test('should navigate to session print page', async ({ page }) => {
    const sessionLink = page.locator('a[href*="/session/"]').first();
    if (await sessionLink.isVisible()) {
      const href = await sessionLink.getAttribute('href');
      if (href) {
        await page.goto(href + '/print');
        await expect(page).not.toHaveURL(/error/);
      }
    } else {
      test.skip();
    }
  });
});
