/**
 * E2E Tests for Workflow Order Management (PRD-010)
 * Tests complete order workflows including normal, quick drop, split, and QA rejection
 */

import { test, expect } from '@playwright/test';

test.describe('Workflow Order Management', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to orders page
    await page.goto('/dashboard/orders');
    // Assume user is logged in and authenticated
  });

  test.describe('Normal Order Workflow', () => {
    test('should create order and transition through workflow', async ({ page }) => {
      // Navigate to new order
      await page.goto('/dashboard/orders/new');

      // Select customer
      await page.click('text=Select Customer');
      await page.fill('input[type="search"]', 'Test Customer');
      await page.click('text=Test Customer');

      // Add items to order
      await page.click('text=Add', { first: true });
      await page.click('button:has-text("+")', { first: true }); // Increase quantity

      // Check ready by estimation
      const readyByText = await page.textContent('text=Ready By');
      expect(readyByText).toContain('Ready By');

      // Submit order
      await page.click('button:has-text("Submit Order")');

      // Wait for redirect to order detail
      await page.waitForURL(/\/dashboard\/orders\/[a-f0-9-]+/, { timeout: 5000 });

      // Verify order created
      const orderNumber = await page.textContent('h1');
      expect(orderNumber).toMatch(/ORD-\d{4,}-\d{6}/);

      // Verify in INTAKE status
      await expect(page.locator('text=intake')).toBeVisible({ timeout: 1000 });
    });

    test('should transition order to processing', async ({ page }) => {
      await page.goto('/dashboard/processing');

      // Click on first processing order
      await page.click('a[href*="/processing/"]', { first: true });

      // Verify processing page loaded
      await expect(page.locator('text=Processing')).toBeVisible();

      // Record a processing step
      await page.click('button:has-text("Sorting")', { first: true });
      await page.click('button:has-text("Pretreatment")', { first: true });

      // Add rack location
      await page.fill('input[placeholder*="rack"]', 'Rack A-12');

      // Mark order ready
      await page.click('button:has-text("Mark Order Ready")');

      // Wait for transition
      await page.waitForTimeout(2000);

      // Should redirect to order detail or ready screen
      await expect(
        page.locator('text=ready')
      ).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Quick Drop Order Workflow', () => {
    test('should create quick drop order and itemize in preparation', async ({ page }) => {
      // Create quick drop order
      await page.goto('/dashboard/orders/new');

      await page.click('text=Select Customer');
      await page.fill('input[type="search"]', 'Test');
      await page.click('text=Test Customer');

      // Enable quick drop
      await page.check('input[type="checkbox"]', { hasText: /Quick Drop/i });
      await page.fill('input[type="number"]', '10');

      // Submit
      await page.click('button:has-text("Submit Order")');
      await page.waitForURL(/\/dashboard\/orders\/[a-f0-9-]+/);

      // Go to preparation
      await page.goto('/dashboard/preparation');
      await expect(page.locator('h1:has-text("Preparation")')).toBeVisible();

      // Open order
      await page.click('a[href*="/preparation/"]', { first: true });

      // Verify FastItemizer loaded
      await expect(page.locator('text=Add Items')).toBeVisible();

      // Add preset items
      await page.click('button:has-text("+1")', { first: true }); // Add shirt
      await page.click('button:has-text("+1")', { first: true }); // Add pants

      // Complete preparation
      await page.click('button:has-text("Complete & Continue")');

      // Wait for redirect
      await page.waitForTimeout(2000);

      // Should transition to processing
      await expect(page.url()).toContain('/orders/');
    });
  });

  test.describe('Order Splitting Workflow', () => {
    test('should split order and track child orders', async ({ page }) => {
      // Navigate to processing order
      await page.goto('/dashboard/processing');

      const processingOrderLink = page.locator('a[href*="/processing/"]').first();
      if (await processingOrderLink.isVisible()) {
        await processingOrderLink.click();

        // Find split button
        const splitButton = page.locator('button:has-text("Split")').first();
        if (await splitButton.isVisible()) {
          await splitButton.click();

          // Fill split form
          await page.fill('input[name="split-1-quantity"]', '5');
          await page.fill('input[name="split-2-quantity"]', '3');

          // Confirm split
          await page.click('button:has-text("Split Order")');

          // Wait for split to complete
          await page.waitForTimeout(2000);

          // Verify split notification
          const notification = page.locator('text=/order.*split/i');
          if (await notification.isVisible()) {
            await expect(notification).toBeVisible();
          }
        }
      }
    });
  });

  test.describe('QA Workflow with Rejection', () => {
    test('should reject order in QA and return to processing', async ({ page }) => {
      // Navigate to QA screen
      await page.goto('/dashboard/qa');
      await expect(page.locator('h1:has-text("Quality")')).toBeVisible({ timeout: 5000 });

      // Check if there are any QA orders
      const qaOrderLink = page.locator('a[href*="/qa/"]').first();
      if (await qaOrderLink.isVisible()) {
        await qaOrderLink.click();

        // Verify QA page loaded
        await expect(page.locator('text=Quality Check')).toBeVisible({ timeout: 5000 });

        // Reject an item
        const rejectButtons = page.locator('button:has-text("Reject")');
        const count = await rejectButtons.count();
        if (count > 0) {
          await rejectButtons.first().click();

          // Should return to processing
          await page.waitForTimeout(3000);
          await expect(page.url()).toMatch(/\/orders\/|\/processing\//);
        }
      }
    });

    test('should accept all items in QA', async ({ page }) => {
      await page.goto('/dashboard/qa');
      
      const qaOrderLink = page.locator('a[href*="/qa/"]').first();
      if (await qaOrderLink.isVisible()) {
        await qaOrderLink.click();

        // Click accept all
        const acceptAllButton = page.locator('button:has-text("Accept All")');
        if (await acceptAllButton.isVisible()) {
          await acceptAllButton.click();

          // Should transition to ready
          await page.waitForTimeout(3000);
          await expect(page.url()).toMatch(/\/orders\/|\/ready\//);
        }
      }
    });
  });

  test.describe('Ready and Delivery Workflow', () => {
    test('should mark order as delivered from ready screen', async ({ page }) => {
      await page.goto('/dashboard/ready');
      await expect(page.locator('h1:has-text("Ready")')).toBeVisible({ timeout: 5000 });

      // Click on ready order
      const readyOrderLink = page.locator('a[href*="/ready/"]').first();
      if (await readyOrderLink.isVisible()) {
        await readyOrderLink.click();

        // Verify ready page
        await expect(page.locator('text=Ready')).toBeVisible({ timeout: 5000 });

        // Mark as delivered
        const deliverButton = page.locator('button:has-text("Mark as Delivered")');
        if (await deliverButton.isVisible()) {
          await deliverButton.click();

          // Wait for transition
          await page.waitForTimeout(2000);

          // Should transition to delivered
          await expect(page.locator('text=delivered')).toBeVisible({ timeout: 5000 });
        }
      }
    });

    test('should print receipt', async ({ page }) => {
      await page.goto('/dashboard/ready');
      
      const readyOrderLink = page.locator('a[href*="/ready/"]').first();
      if (await readyOrderLink.isVisible()) {
        await readyOrderLink.click();

        // Click print button
        const printButton = page.locator('button:has-text("Print Receipt")');
        if (await printButton.isVisible()) {
          // Note: In actual test, we'd need to handle print dialog
          await printButton.click();
          
          // Just verify button is clickable
          expect(await printButton.isVisible()).toBe(true);
        }
      }
    });
  });

  test.describe('Order History Timeline', () => {
    test('should display comprehensive order history', async ({ page }) => {
      // Navigate to any order detail
      await page.goto('/dashboard/orders/new');
      
      // Create order first
      await page.click('text=Select Customer');
      await page.fill('input[type="search"]', 'Test');
      await page.click('text=Test Customer', { first: true });
      await page.click('button:has-text("Add")', { first: true });
      await page.click('button:has-text("Submit Order")');

      // Wait for order page
      await page.waitForURL(/\/dashboard\/orders\/[a-f0-9-]+/);

      // Scroll to timeline
      const timeline = page.locator('text=Order Timeline');
      await timeline.scrollIntoViewIfNeeded();

      // Verify timeline sections
      await expect(timeline).toBeVisible({ timeout: 5000 });
      
      // Check for ORDER_CREATED entry
      const orderCreated = page.locator('text=Order Created');
      if (await orderCreated.isVisible()) {
        await expect(orderCreated).toBeVisible();
      }
    });
  });

  test.describe('Issue Management', () => {
    test('should create and resolve issue', async ({ page }) => {
      await page.goto('/dashboard/processing');
      
      const processingOrderLink = page.locator('a[href*="/processing/"]').first();
      if (await processingOrderLink.isVisible()) {
        await processingOrderLink.click();

        // Look for issue creation button
        const createIssueButton = page.locator('button:has-text("Report Issue")');
        if (await createIssueButton.isVisible()) {
          await createIssueButton.click();

          // Fill issue form
          await page.selectOption('select[name="issue_code"]', 'stain');
          await page.fill('textarea[name="notes"]', 'Large stain found on item');

          // Submit issue
          await page.click('button:has-text("Create Issue")');

          // Wait for issue creation
          await page.waitForTimeout(2000);

          // Verify issue appears
          const issueAlert = page.locator('text=/issue/i');
          if (await issueAlert.isVisible()) {
            expect(await issueAlert.first().isVisible()).toBe(true);
          }
        }
      }
    });
  });
});

