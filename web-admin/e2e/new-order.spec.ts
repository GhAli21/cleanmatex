import { test, expect, type Page } from '@playwright/test'
import { gotoProtectedRoute } from './helpers/auth'

async function selectDemoCustomer(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Select Customer/i }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15_000 })

  const quickSelectButton = page.getByRole('button', { name: /Quick Select/i })
  if (await quickSelectButton.isVisible().catch(() => false)) {
    await quickSelectButton.click()
    return
  }

  await page.locator('#customer-search-input').fill('Jh')
  const firstCustomerOption = page.locator('[role="option"]').first()
  await expect(firstCustomerOption).toBeVisible({ timeout: 15_000 })
  await firstCustomerOption.click()
}

async function setReadyByTomorrow(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Ready By' }).click()
  await expect(page.getByText(/Select Ready Date/i)).toBeVisible({ timeout: 15_000 })

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)

  const readyByDate = [
    tomorrow.getFullYear(),
    String(tomorrow.getMonth() + 1).padStart(2, '0'),
    String(tomorrow.getDate()).padStart(2, '0'),
  ].join('-')

  await page.locator('input[type="date"]').fill(readyByDate)
  await page.locator('input[type="time"]').fill('17:00')
  await page.getByRole('button', { name: /^Apply$/i }).click()
}

test.describe('New Order Page', () => {
  test('builds a draft order and opens the payment workbench', async ({ page }) => {
    await gotoProtectedRoute(page, '/dashboard/orders/new')

    await expect(page.getByRole('heading', { name: 'New Order' })).toBeVisible({
      timeout: 25_000,
    })

    const firstAddButton = page.getByRole('button', { name: /^Add$/ }).first()
    await expect(firstAddButton).toBeVisible({ timeout: 25_000 })

    await selectDemoCustomer(page)
    await expect(page.locator('body')).toContainText('Jh Test dev21', { timeout: 15_000 })

    await firstAddButton.click()
    await expect(page.getByRole('tab', { name: /Order Items \(1\)/i })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.locator('body')).toContainText('1 total pieces', { timeout: 15_000 })
    await expect(page.locator('body')).toContainText('1.800 OMR', { timeout: 15_000 })

    const openPaymentButton = page.locator('button').filter({ hasText: 'Submit Order' }).first()
    await expect(openPaymentButton).toBeDisabled()

    await setReadyByTomorrow(page)

    await expect(openPaymentButton).toBeEnabled({ timeout: 15_000 })
    await expect(page.locator('body')).toContainText('Ready to submit', { timeout: 15_000 })

    await openPaymentButton.click()

    await expect(page.getByText('Payment Tools')).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('body')).toContainText('Pay on Collection', { timeout: 20_000 })
    await expect(
      page.getByRole('button', { name: /Submit .*Not paid after this payment/i }),
    ).toBeVisible({
      timeout: 20_000,
    })
  })
})
