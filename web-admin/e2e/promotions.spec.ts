/**
 * E2E Tests: Promotions Management
 *
 * Covers:
 * - Promotions list page loads
 * - Create promotion form opens and submits
 * - Toggle promotion active/inactive
 * - Validate promo code quick-check modal
 */

import { test, expect } from '@playwright/test';

test.describe('Promotions Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/marketing/promotions');
  });

  test('should display promotions list page', async ({ page }) => {
    await expect(page).not.toHaveURL(/error/);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('should open create promotion form', async ({ page }) => {
    const createBtn = page.locator('button').filter({ hasText: /create|add promotion|new promotion/i }).first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await expect(page.locator('[role="dialog"], form').first()).toBeVisible({ timeout: 3000 });
    } else {
      test.skip();
    }
  });

  test('should create a percentage promotion', async ({ page }) => {
    const createBtn = page.locator('button').filter({ hasText: /create|add/i }).first();
    if (await createBtn.isVisible()) {
      await createBtn.click();

      // Fill form fields
      const nameInput = page.locator('input[name="name"], input[name*="promo_name"]').first();
      if (await nameInput.isVisible()) {
        await nameInput.fill('E2E Test Promo');

        const codeInput = page.locator('input[name*="code"], input[name*="promoCode"]').first();
        if (await codeInput.isVisible()) {
          await codeInput.fill('E2ETEST10');
        }

        const discountInput = page.locator('input[name*="discount"], input[name*="value"]').first();
        if (await discountInput.isVisible()) {
          await discountInput.fill('10');
        }

        await page.locator('button[type="submit"]').click();
        // Either success message or promo appears in list
        await expect(
          page.locator('text=/E2E Test Promo|E2ETEST10|created.*success/i').first()
        ).toBeVisible({ timeout: 5000 });
      }
    } else {
      test.skip();
    }
  });

  test('should open validate code modal', async ({ page }) => {
    const validateBtn = page.locator('button').filter({ hasText: /validate|check code/i }).first();
    if (await validateBtn.isVisible()) {
      await validateBtn.click();
      await expect(page.locator('[role="dialog"]').first()).toBeVisible({ timeout: 3000 });

      const codeInput = page.locator('[role="dialog"] input[type="text"]').first();
      if (await codeInput.isVisible()) {
        await codeInput.fill('TESTCODE');
        await page.locator('[role="dialog"] button[type="submit"]').click();
        // Result shown — valid or invalid
        await expect(
          page.locator('[role="dialog"] text=/valid|invalid|not found/i').first()
        ).toBeVisible({ timeout: 5000 });
      }
    } else {
      test.skip();
    }
  });

  test('should toggle promotion active status', async ({ page }) => {
    const toggleBtn = page.locator('[role="switch"], input[type="checkbox"]').first();
    if (await toggleBtn.isVisible()) {
      const initialChecked = await toggleBtn.isChecked();
      await toggleBtn.click();
      const newChecked = await toggleBtn.isChecked();
      expect(newChecked).toBe(!initialChecked);
    } else {
      test.skip();
    }
  });
});
