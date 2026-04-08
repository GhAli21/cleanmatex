/**
 * ERP-Lite: critical path smoke — finance readiness screen (tenant).
 * Skips when unauthenticated (redirect to login), matching other web-admin E2E patterns.
 */

import { test, expect } from '@playwright/test'

test.describe('ERP-Lite readiness', () => {
  test('shows Finance Readiness heading when session allows dashboard', async ({ page }) => {
    await page.goto('/dashboard/erp-lite/readiness')
    await page.waitForLoadState('networkidle')

    const url = page.url()
    if (url.includes('/login') || url.includes('/auth')) {
      test.skip(true, 'Requires authenticated tenant session')
    }

    await expect(page.getByRole('heading', { name: 'Finance Readiness' })).toBeVisible({
      timeout: 25_000,
    })
  })
})
