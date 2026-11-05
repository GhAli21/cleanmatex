import { expect, test } from '@playwright/test'

import { gotoProtectedRoute, requireAuthenticatedE2EConfig } from './helpers/auth'

/**
 * Reusable Order Fin View P7-07 (PR-17): the order detail statement in EN and
 * AR, the preset switch, the one-request batch reader and the API envelope.
 * Needs an authenticated session (E2E_LOGIN_EMAIL / E2E_LOGIN_PASSWORD) and an
 * order of that tenant: E2E_FIN_ORDER_ID.
 */
const ORDER_ID = process.env.E2E_FIN_ORDER_ID ?? ''

test.describe('Order Financial View', () => {
  test.beforeEach(() => {
    requireAuthenticatedE2EConfig()
    test.skip(!ORDER_ID, 'Set E2E_FIN_ORDER_ID to an order of the signed-in tenant.')
  })

  test('order detail shows the statement, and the preset switch is remembered', async ({ page }) => {
    await gotoProtectedRoute(page, `/dashboard/orders/${ORDER_ID}`)
    const statement = page.getByRole('region', { name: /Financial summary|الملخص المالي/ }).first()
    await expect(statement).toBeVisible({ timeout: 20_000 })
    await expect(statement.getByText(/Order value|قيمة الطلب/)).toBeVisible()
    await expect(statement.getByText(/^Total$|^الإجمالي$/).first()).toBeVisible()

    const full = page.getByRole('tab', { name: /^Full$|^كامل$/ })
    await full.click()
    await expect(full).toHaveAttribute('aria-selected', 'true')
    await page.reload()
    await expect(page.getByRole('tab', { name: /^Full$|^كامل$/ })).toHaveAttribute('aria-selected', 'true', { timeout: 20_000 })
  })

  test('rows are keyboard operable', async ({ page }) => {
    await gotoProtectedRoute(page, `/dashboard/orders/${ORDER_ID}`)
    const row = page.getByRole('button', { name: /Payments|المدفوعات/ }).first()
    await expect(row).toBeVisible({ timeout: 20_000 })
    const before = await row.getAttribute('aria-expanded')
    await row.focus()
    await page.keyboard.press('Enter')
    await expect(row).not.toHaveAttribute('aria-expanded', before ?? '')
  })

  test('the API answers with the envelope and no-store, and refuses unknown presets', async ({ request }) => {
    const ok = await request.get(`/api/v1/orders/${ORDER_ID}/financial-view?preset=detailed`)
    expect(ok.status()).toBe(200)
    expect(ok.headers()['cache-control']).toBe('no-store')
    const body = await ok.json()
    expect(body.success).toBe(true)
    expect(body.data.sourceKind).toBe('saved')

    const bad = await request.get(`/api/v1/orders/${ORDER_ID}/financial-view?preset=everything`)
    expect(bad.status()).toBe(400)
    expect((await bad.json()).error.code).toBe('VALIDATION_FAILED')
  })

  test('a made-up order id is a 404, never another tenant\'s figures', async ({ request }) => {
    const res = await request.get('/api/v1/orders/00000000-0000-4000-8000-000000000000/financial-view')
    expect(res.status()).toBe(404)
    expect((await res.json()).error.code).toBe('ORDER_NOT_FOUND')
  })
})
