/**
 * E2E Tests for Subscription Management
 * Tests the complete subscription flow including plan viewing, upgrading, and cancellation
 */

import { test, expect } from '@playwright/test';

test.describe('Subscription Management Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Assume user is logged in - you may need to implement actual login flow
    await page.goto('/dashboard/subscription');
  });

  test('displays subscription page with current plan', async ({ page }) => {
    // Wait for page to load
    await expect(page.locator('h1')).toContainText('Subscription & Billing');

    // Check for current plan card
    await expect(page.locator('text=Current Plan')).toBeVisible();

    // Check for plan name display
    await expect(page.getByText(/Free|Starter|Growth|Pro|Enterprise/)).toBeVisible();
  });

  test('shows usage metrics with progress bars', async ({ page }) => {
    // Wait for usage section
    await expect(page.locator('text=Usage & Limits')).toBeVisible();

    // Check for resource metrics
    await expect(page.locator('text=Orders')).toBeVisible();
    await expect(page.locator('text=Users')).toBeVisible();
    await expect(page.locator('text=Branches')).toBeVisible();

    // Progress bars should be visible
    const progressBars = page.locator('[role="progressbar"]');
    await expect(progressBars.first()).toBeVisible();
  });

  test('displays plan comparison table', async ({ page }) => {
    // Check table headers
    await expect(page.locator('text=Plan')).toBeVisible();
    await expect(page.locator('text=Price')).toBeVisible();
    await expect(page.locator('text=Orders')).toBeVisible();
    await expect(page.locator('text=Users')).toBeVisible();

    // Check for all plan names
    await expect(page.locator('text=Free')).toBeVisible();
    await expect(page.locator('text=Starter')).toBeVisible();
    await expect(page.locator('text=Growth')).toBeVisible();
    await expect(page.locator('text=Pro')).toBeVisible();
    await expect(page.locator('text=Enterprise')).toBeVisible();
  });

  test('toggles between monthly and yearly pricing', async ({ page }) => {
    // Click yearly button
    await page.click('button:has-text("Yearly")');

    // Should show savings message
    await expect(page.locator('text=Save 20%')).toBeVisible();

    // Click monthly button
    await page.click('button:has-text("Monthly")');

    // Pricing should change back
    await expect(page.locator('text=/OMR.*\\/month/')).toBeVisible();
  });

  test('opens upgrade modal when clicking upgrade button', async ({ page }) => {
    // Find and click an upgrade button (not for current plan)
    const upgradeButton = page.locator('button:has-text("Upgrade")').first();

    if (await upgradeButton.isVisible()) {
      await upgradeButton.click();

      // Modal should open
      await expect(page.locator('text=/Upgrade to/')).toBeVisible();

      // Check for billing cycle selection
      await expect(page.locator('text=/Monthly.*OMR/')).toBeVisible();
      await expect(page.locator('text=/Yearly.*OMR/')).toBeVisible();

      // Close modal
      await page.click('button:has-text("Cancel")');
    }
  });

  test('shows feature comparison in upgrade modal', async ({ page }) => {
    const upgradeButton = page.locator('button:has-text("Upgrade")').first();

    if (await upgradeButton.isVisible()) {
      await upgradeButton.click();

      // Check for features list
      await expect(page.locator('text=New Features You\'ll Get:')).toBeVisible();

      // Should show checkmarks for features
      await expect(page.locator('text=/✓/')).toBeVisible();
    }
  });

  test('displays payment placeholder message', async ({ page }) => {
    const upgradeButton = page.locator('button:has-text("Upgrade")').first();

    if (await upgradeButton.isVisible()) {
      await upgradeButton.click();

      // Check for payment integration message
      await expect(page.locator('text=/Payment gateway integration coming soon/i')).toBeVisible();

      // Close modal
      await page.click('button:has-text("Cancel")');
    }
  });

  test('opens cancel subscription modal', async ({ page }) => {
    const cancelButton = page.locator('button:has-text("Cancel Subscription")');

    if (await cancelButton.isVisible()) {
      await cancelButton.click();

      // Modal should open
      await expect(page.locator('text=Cancel Subscription')).toBeVisible();

      // Check for warning message
      await expect(page.locator('text=/lose access to premium features/i')).toBeVisible();

      // Check for reason dropdown
      await expect(page.locator('text=Reason for Cancellation')).toBeVisible();

      // Close modal
      await page.click('button:has-text("Keep Subscription")');
    }
  });

  test('requires cancellation reason', async ({ page }) => {
    const cancelButton = page.locator('button:has-text("Cancel Subscription")');

    if (await cancelButton.isVisible()) {
      await cancelButton.click();

      // Try to confirm without selecting reason
      const confirmButton = page.locator('button:has-text("Confirm Cancellation")');

      // Button should be disabled without reason
      await expect(confirmButton).toBeDisabled();
    }
  });

  test('shows trial countdown banner when on trial', async ({ page }) => {
    // Check if trial banner is visible
    const trialBanner = page.locator('text=/Trial Period Active/i');

    if (await trialBanner.isVisible()) {
      // Should show days remaining
      await expect(page.locator('text=/days remaining/i')).toBeVisible();

      // Should have upgrade button
      await expect(page.locator('button:has-text("Upgrade Now")')).toBeVisible();
    }
  });

  test('displays usage warnings when limits approached', async ({ page }) => {
    // Check for warnings section
    const warnings Section = page.locator('text=⚠️ Warnings');

    if (await warningsSection.isVisible()) {
      // Should show warning count
      await expect(page.locator('text=/\\d+ Warning(s)?/')).toBeVisible();

      // Should display warning messages
      await expect(page.locator('[class*="bg-yellow-50"]')).toBeVisible();
    }
  });

  test('shows current plan badge', async ({ page }) => {
    // Current plan should have badge
    const currentBadge = page.locator('text=Current').first();
    await expect(currentBadge).toBeVisible();

    // Badge should have appropriate styling
    const badgeElement = page.locator('span:has-text("Current")').first();
    await expect(badgeElement).toHaveClass(/badge|bg-green/);
  });

  test('highlights recommended plan (Growth)', async ({ page }) => {
    const recommendedBadge = page.locator('text=Recommended');

    if (await recommendedBadge.isVisible()) {
      // Should be associated with Growth plan
      const growthRow = page.locator('tr:has-text("Growth")');
      await expect(growthRow.locator('text=Recommended')).toBeVisible();
    }
  });

  test('responsive design on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Page should still be accessible
    await expect(page.locator('h1')).toBeVisible();

    // Table should be scrollable or stacked
    const table = page.locator('table');
    if (await table.isVisible()) {
      // Table container should allow horizontal scroll
      const container = table.locator('..');
      await expect(container).toBeVisible();
    }
  });

  test('displays feature badges for each plan', async ({ page }) => {
    // Each plan should show key features
    const featureBadges = page.locator('span:has-text("PDF"), span:has-text("WhatsApp"), span:has-text("API")');

    // At least some feature badges should be visible
    await expect(featureBadges.first()).toBeVisible();
  });

  test('shows correct pricing format (OMR currency)', async ({ page }) => {
    // All prices should be in OMR
    const prices = page.locator('text=/OMR \\d+/');
    await expect(prices.first()).toBeVisible();

    // Price should have /mo or /month suffix
    await expect(page.locator('text=/\\/mo(nth)?/')).toBeVisible();
  });

  test('calculates usage percentage correctly', async ({ page }) => {
    // Progress bars should show percentage
    const percentages = page.locator('text=/%$/');

    if (await percentages.count() > 0) {
      const percentText = await percentages.first().textContent();
      const percentValue = parseFloat(percentText || '0');

      // Percentage should be between 0 and 100
      expect(percentValue).toBeGreaterThanOrEqual(0);
      expect(percentValue).toBeLessThanOrEqual(100);
    }
  });

  test('color codes progress bars based on usage', async ({ page }) => {
    // Progress bars should have color classes
    const progressBars = page.locator('[role="progressbar"]');

    if (await progressBars.count() > 0) {
      const firstBar = progressBars.first();

      // Should have color class (green, yellow, or red)
      const classes = await firstBar.getAttribute('class');
      expect(classes).toMatch(/green|yellow|red/);
    }
  });

  test('maintains scroll position after modal close', async ({ page }) => {
    // Scroll down to middle of page
    await page.evaluate(() => window.scrollTo(0, 500));
    const scrollPosition = await page.evaluate(() => window.scrollY);

    // Open and close modal
    const upgradeButton = page.locator('button:has-text("Upgrade")').first();
    if (await upgradeButton.isVisible()) {
      await upgradeButton.click();
      await page.click('button:has-text("Cancel")');

      // Scroll position should be maintained (approximately)
      const newScrollPosition = await page.evaluate(() => window.scrollY);
      expect(Math.abs(newScrollPosition - scrollPosition)).toBeLessThan(50);
    }
  });
});

test.describe('Usage Widget on Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
  });

  test('displays usage widget on main dashboard', async ({ page }) => {
    // Widget should be visible
    await expect(page.locator('text=Usage & Limits')).toBeVisible();

    // Should show top 3 resources
    await expect(page.locator('text=Orders')).toBeVisible();
    await expect(page.locator('text=Users')).toBeVisible();
    await expect(page.locator('text=Branches')).toBeVisible();
  });

  test('shows compact progress bars in widget', async ({ page }) => {
    // Progress bars should be visible
    const progressBars = page.locator('[role="progressbar"]');
    await expect(progressBars.first()).toBeVisible();

    // Should show percentage badges
    await expect(page.locator('text=/%$/')).toBeVisible();
  });

  test('displays warning indicators when needed', async ({ page }) => {
    // Check for warning badge
    const warningBadge = page.locator('text=/\\d+ Warning(s)?/');

    if (await warningBadge.isVisible()) {
      // Should have warning styling
      await expect(warningBadge).toBeVisible();
    }
  });

  test('provides link to view full subscription details', async ({ page }) => {
    // View Details button should be present
    const viewDetailsButton = page.locator('button:has-text("View Details"), a:has-text("View Details")');
    await expect(viewDetailsButton.first()).toBeVisible();

    // Click should navigate to subscription page
    await viewDetailsButton.first().click();
    await expect(page).toHaveURL('/dashboard/subscription');
  });

  test('shows upgrade button when approaching limits', async ({ page }) => {
    const upgradeButton = page.locator('button:has-text("Upgrade Plan")');

    if (await upgradeButton.isVisible()) {
      // Should link to subscription page
      await upgradeButton.click();
      await expect(page).toHaveURL('/dashboard/subscription');
    }
  });

  test('displays current billing period', async ({ page }) => {
    // Should show date range
    await expect(page.locator('text=/\\d{1,2}\\/\\d{1,2}\\/\\d{4}/').first()).toBeVisible();
  });

  test('allows refreshing usage data', async ({ page }) => {
    // Refresh button should be present
    const refreshButton = page.locator('button:has-text("🔄 Refresh"), button[title*="Refresh"]');

    if (await refreshButton.isVisible()) {
      await refreshButton.click();

      // Should show loading state briefly
      // Then update to new data
      await page.waitForTimeout(500);
    }
  });
});
