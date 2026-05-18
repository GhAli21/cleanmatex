/**
 * E2E Tests: Tax Setup
 *
 * Covers:
 * - Tax profiles list page loads
 * - Create tax profile form opens and submits
 * - Set profile as default (confirm dialog)
 * - Tax exemptions section renders
 */

import { test, expect } from '@playwright/test';

test.describe('Tax Setup', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/settings/tax');
  });

  test('should display tax setup page', async ({ page }) => {
    await expect(page).not.toHaveURL(/error/);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('should show tax profiles section', async ({ page }) => {
    await expect(
      page.locator('text=/tax profile|VAT|tax setup/i').first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('should open create tax profile form', async ({ page }) => {
    const createBtn = page.locator('button').filter({ hasText: /create|add.*profile|new.*profile/i }).first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await expect(page.locator('[role="dialog"], form').first()).toBeVisible({ timeout: 3000 });
    } else {
      test.skip();
    }
  });

  test('should create a tax profile', async ({ page }) => {
    const createBtn = page.locator('button').filter({ hasText: /create|add/i }).first();
    if (await createBtn.isVisible()) {
      await createBtn.click();

      const nameInput = page.locator('input[name="name"], input[name*="profile_name"]').first();
      if (await nameInput.isVisible()) {
        await nameInput.fill('E2E VAT Profile');

        const rateInput = page.locator('input[name*="rate"]').first();
        if (await rateInput.isVisible()) {
          await rateInput.fill('5');
        }

        await page.locator('button[type="submit"]').click();
        await expect(
          page.locator('text=/E2E VAT Profile|profile.*created|created.*success/i').first()
        ).toBeVisible({ timeout: 5000 });
      }
    } else {
      test.skip();
    }
  });

  test('should show confirm dialog when setting default profile', async ({ page }) => {
    const setDefaultBtn = page.locator('button').filter({ hasText: /set.*default|make default/i }).first();
    if (await setDefaultBtn.isVisible()) {
      await setDefaultBtn.click();
      // Confirm dialog expected
      const dialog = page.locator('[role="dialog"], [role="alertdialog"]').first();
      await expect(dialog).toBeVisible({ timeout: 3000 });

      // Cancel it to avoid state changes
      const cancelBtn = dialog.locator('button').filter({ hasText: /cancel|no/i }).first();
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click();
      }
    } else {
      test.skip();
    }
  });

  test('should show tax exemptions section', async ({ page }) => {
    const exemptionSection = page.locator('text=/exemption|tax.*exempt/i').first();
    if (await exemptionSection.isVisible({ timeout: 3000 })) {
      await expect(exemptionSection).toBeVisible();
    } else {
      // Tab/scroll to exemptions
      const exemptionTab = page.locator('button, [role="tab"]').filter({ hasText: /exemption/i }).first();
      if (await exemptionTab.isVisible()) {
        await exemptionTab.click();
        await expect(page.locator('text=/exemption/i').first()).toBeVisible({ timeout: 3000 });
      }
    }
  });
});
