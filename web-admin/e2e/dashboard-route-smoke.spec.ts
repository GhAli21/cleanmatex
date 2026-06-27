import { test, expect } from '@playwright/test'
import { expectProtectedRouteLoadsOrRedirectsToLogin } from './helpers/auth'

const PROTECTED_DASHBOARD_ROUTES = [
  '/dashboard',
  '/dashboard/orders',
  '/dashboard/processing',
  '/dashboard/internal_fin/invoices',
  '/dashboard/internal_fin/payments',
  '/dashboard/internal_fin/reconciliation',
  '/dashboard/reports',
  '/dashboard/settings',
  '/dashboard/erp-lite',
  '/dashboard/erp-lite/readiness',
] as const

test.describe('Dashboard route smoke', () => {
  for (const path of PROTECTED_DASHBOARD_ROUTES) {
    test(`route ${path} loads or redirects cleanly`, async ({ page }) => {
      const outcome = await expectProtectedRouteLoadsOrRedirectsToLogin(page, path)

      if (outcome === 'loaded') {
        await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 25_000 })
      }
    })
  }
})
