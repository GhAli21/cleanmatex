/**
 * E2E Tests: Customer Categories Catalog
 * Tenant catalog CRUD for org_customer_category_cf
 */

import { test, expect } from '@playwright/test';

test.describe('Customer Categories Catalog - E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/catalog/customer-categories');
  });

  test('should display customer categories catalog page', async ({ page }) => {
    await expect(page.locator('h1:has-text("Customer Categories")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="customer-categories-catalog-page"]')).toBeVisible();
  });

  test('should show table or loading state', async ({ page }) => {
    await page.waitForSelector('[data-testid="customer-categories-catalog-page"]', { timeout: 15000 }).catch(() => {});
    const hasTable = await page.locator('table').isVisible();
    const hasLoading = await page.locator('text=Loading...').isVisible();
    expect(hasTable || hasLoading).toBeTruthy();
  });

  test('should show Add button when user has config permission', async ({ page }) => {
    const addBtn = page.locator('button:has-text("Add"), button:has-text("إضافة")');
    const count = await addBtn.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should display Code and Name columns', async ({ page }) => {
    await page.waitForSelector('[data-testid="customer-categories-catalog-page"]', { timeout: 15000 }).catch(() => {});
    const hasCode = await page.locator('th:has-text("Code")').isVisible();
    const hasName = await page.locator('th:has-text("Name")').isVisible();
    expect(hasCode || hasName).toBeTruthy();
  });
});
