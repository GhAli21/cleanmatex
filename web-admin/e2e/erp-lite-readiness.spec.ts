/**
 * ERP-Lite: critical path smoke — finance readiness screen (tenant).
 * Skips when unauthenticated (redirect to login), matching other web-admin E2E patterns.
 */

import { test, expect } from '@playwright/test'

test.describe('ERP-Lite readiness', () => {
  test('shows ERP-Lite home title when session allows dashboard', async ({ page }) => {
    await page.goto('/dashboard/erp-lite')
    await page.waitForLoadState('networkidle')

    const url = page.url()
    if (url.includes('/login') || url.includes('/auth')) {
      test.skip(true, 'Requires authenticated tenant session')
    }

    await expect(page.getByRole('heading', { name: 'Finance & Accounting' })).toBeVisible({
      timeout: 25_000,
    })
  })

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

  test('shows Period Management when session allows (flag-dependent)', async ({ page }) => {
    await page.goto('/dashboard/erp-lite/periods')
    await page.waitForLoadState('networkidle')

    const url = page.url()
    if (url.includes('/login') || url.includes('/auth')) {
      test.skip(true, 'Requires authenticated tenant session')
    }

    if (url.includes('/dashboard/erp-lite') && !url.includes('/periods')) {
      test.skip(true, 'Periods route not available (feature flag or redirect)')
    }

    await expect(page.getByRole('heading', { name: 'Period Management' })).toBeVisible({
      timeout: 25_000,
    })
  })

  test('shows Journal register when session allows dashboard', async ({ page }) => {
    await page.goto('/dashboard/erp-lite/journals')
    await page.waitForLoadState('networkidle')

    const url = page.url()
    if (url.includes('/login') || url.includes('/auth')) {
      test.skip(true, 'Requires authenticated tenant session')
    }

    await expect(page.getByRole('heading', { name: 'Journal register' })).toBeVisible({
      timeout: 25_000,
    })
  })
})
