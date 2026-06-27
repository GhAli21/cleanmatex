/**
 * ERP-Lite: critical path smoke — finance readiness screen (tenant).
 * Skips when unauthenticated (redirect to login), matching other web-admin E2E patterns.
 */

import { test, expect } from '@playwright/test'
import { gotoProtectedRoute } from './helpers/auth'

test.describe('ERP-Lite readiness', () => {
  test('shows ERP-Lite home title when session allows dashboard', async ({ page }) => {
    await gotoProtectedRoute(page, '/dashboard/erp-lite')

    await expect(page.getByRole('heading', { name: 'Finance & Accounting' })).toBeVisible({
      timeout: 25_000,
    })
  })

  test('shows Finance Readiness heading when session allows dashboard', async ({ page }) => {
    await gotoProtectedRoute(page, '/dashboard/erp-lite/readiness')

    await expect(page.getByRole('heading', { name: 'Finance Readiness' })).toBeVisible({
      timeout: 25_000,
    })
  })

  test('shows Period Management when session allows (flag-dependent)', async ({ page }) => {
    const url = await gotoProtectedRoute(page, '/dashboard/erp-lite/periods')

    if (url.includes('/dashboard/erp-lite') && !url.includes('/periods')) {
      test.skip(true, 'Periods route not available (feature flag or redirect)')
    }

    await expect(page.getByRole('heading', { name: 'Period Management' })).toBeVisible({
      timeout: 25_000,
    })
  })

  test('shows Journal register when session allows dashboard', async ({ page }) => {
    await gotoProtectedRoute(page, '/dashboard/erp-lite/journals')

    await expect(page.getByRole('heading', { name: 'Journal register' })).toBeVisible({
      timeout: 25_000,
    })
  })
})
