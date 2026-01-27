/**
 * E2E Tests: New Order Page
 * Complete user journey tests for order creation
 */

import { test, expect } from '@playwright/test';

test.describe('New Order Page - E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to new order page
    // This assumes authentication is handled
    await page.goto('/dashboard/orders/new');
  });

  test('should create a complete order', async ({ page }) => {
    // 1. Select customer
    await page.click('button:has-text("Select Customer")');
    await page.fill('input[placeholder*="Search"]', 'John Doe');
    await page.click('text=John Doe');

    // 2. Add items
    await page.click('text=Dry Cleaning'); // Select category
    await page.click('[data-testid="product-card"]:first-child'); // Add first product
    await page.click('button[aria-label*="Increase"]'); // Increase quantity

    // 3. Configure order
    await page.click('input[type="checkbox"][aria-label*="Express"]');
    await page.fill('textarea[placeholder*="notes"]', 'Handle with care');

    // 4. Submit order
    await page.click('button:has-text("Submit Order")');
    
    // 5. Complete payment
    await page.click('input[value="cash"]');
    await page.click('button:has-text("Submit Payment")');

    // 6. Verify success
    await expect(page.locator('text=Order created successfully')).toBeVisible();
  });

  test('should handle customer creation flow', async ({ page }) => {
    await page.click('button:has-text("Select Customer")');
    await page.click('button:has-text("Create New Customer")');
    
    await page.fill('input[name="firstName"]', 'Jane');
    await page.fill('input[name="lastName"]', 'Smith');
    await page.fill('input[name="phone"]', '+1234567890');
    
    await page.click('button:has-text("Create")');
    
    // Verify customer is selected
    await expect(page.locator('text=Jane Smith')).toBeVisible();
  });

  test('should add custom item', async ({ page }) => {
    await page.click('button:has-text("Custom Item")');
    
    await page.fill('input[name="name"]', 'Custom Garment');
    await page.fill('input[name="price"]', '15.000');
    await page.fill('input[name="quantity"]', '2');
    
    await page.click('button:has-text("Add Item")');
    
    // Verify item appears in order summary
    await expect(page.locator('text=Custom Garment')).toBeVisible();
  });

  test('should validate order before submission', async ({ page }) => {
    // Try to submit without customer
    await page.click('button:has-text("Submit Order")');
    
    // Should show validation error
    await expect(page.locator('text=Please select a customer')).toBeVisible();
    
    // Try to submit without items
    await page.click('button:has-text("Select Customer")');
    await page.click('text=John Doe');
    await page.click('button:has-text("Submit Order")');
    
    // Should show validation error
    await expect(page.locator('text=Please add at least one item')).toBeVisible();
  });

  test('should handle keyboard navigation', async ({ page }) => {
    // Tab through elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Press Ctrl+S to submit (if items exist)
    await page.keyboard.press('Control+s');
    
    // Verify keyboard shortcut works
    // (This depends on implementation)
  });

  test('should persist notes on page reload', async ({ page }) => {
    // Add notes
    await page.fill('textarea[placeholder*="notes"]', 'Test notes');
    
    // Reload page
    await page.reload();
    
    // Verify notes are restored
    await expect(page.locator('textarea[placeholder*="notes"]')).toHaveValue('Test notes');
  });

  test('should warn about unsaved changes', async ({ page }) => {
    // Make changes
    await page.click('button:has-text("Select Customer")');
    await page.click('text=John Doe');
    
    // Try to navigate away
    await page.click('a[href="/dashboard"]');
    
    // Should show warning dialog
    await expect(page.locator('text=You have unsaved changes')).toBeVisible();
  });

  test('should handle RTL layout', async ({ page }) => {
    // Switch to Arabic
    await page.selectOption('select[name="language"]', 'ar');
    
    // Verify RTL layout
    const content = await page.locator('main').evaluate((el) => {
      return window.getComputedStyle(el).direction;
    });
    
    expect(content).toBe('rtl');
  });

  test('should handle express pricing toggle', async ({ page }) => {
    // Add item
    await page.click('text=Dry Cleaning');
    await page.click('[data-testid="product-card"]:first-child');
    
    // Get initial price
    const initialPrice = await page.locator('[data-testid="order-total"]').textContent();
    
    // Toggle express
    await page.click('input[type="checkbox"][aria-label*="Express"]');
    
    // Verify price changed
    const expressPrice = await page.locator('[data-testid="order-total"]').textContent();
    expect(expressPrice).not.toBe(initialPrice);
  });

  test('should handle piece tracking when enabled', async ({ page }) => {
    // This test assumes piece tracking is enabled for tenant
    await page.click('text=Dry Cleaning');
    await page.click('[data-testid="product-card"]:first-child');
    
    // Click on item to view pieces
    await page.click('[data-testid="order-item"]:first-child');
    
    // Verify pieces section appears
    await expect(page.locator('text=Pieces')).toBeVisible();
    
    // Add piece details
    await page.fill('input[name="color"]', 'Blue');
    await page.fill('input[name="brand"]', 'Nike');
  });

  test('should handle payment with discount', async ({ page }) => {
    // Complete order setup
    await page.click('button:has-text("Select Customer")');
    await page.click('text=John Doe');
    await page.click('text=Dry Cleaning');
    await page.click('[data-testid="product-card"]:first-child');
    
    // Submit order
    await page.click('button:has-text("Submit Order")');
    
    // Apply discount
    await page.fill('input[name="percentDiscount"]', '10');
    
    // Verify discount applied
    await expect(page.locator('text=10%')).toBeVisible();
    
    // Complete payment
    await page.click('input[value="cash"]');
    await page.click('button:has-text("Submit Payment")');
  });

  test('should handle photo capture', async ({ page, context }) => {
    // Grant camera permission
    await context.grantPermissions(['camera']);
    
    // Click photo button
    await page.click('button:has-text("Photo")');
    
    // Verify camera modal opens
    await expect(page.locator('text=Capture Photo')).toBeVisible();
    
    // Note: Actual photo capture would require more complex setup
  });

  test('should be accessible with screen reader', async ({ page }) => {
    // Check ARIA labels
    const buttons = await page.locator('button[aria-label]').all();
    expect(buttons.length).toBeGreaterThan(0);
    
    // Check role attributes
    const tabs = await page.locator('[role="tablist"]');
    await expect(tabs).toBeVisible();
    
    // Check live regions
    const liveRegion = await page.locator('[aria-live]');
    await expect(liveRegion).toBeVisible();
  });
});

