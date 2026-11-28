/**
 * Measured pricing smoke test: custom unit → product priced per kg → product pack → order with a
 * weighed line billed at the minimum.
 *
 * It WRITES data (a unit and a product it switches off afterwards), so it runs only against a
 * disposable Organization: set E2E_ALLOW_WRITES=1 together with the E2E login variables.
 */
import { test, expect, type Page } from '@playwright/test'
import { gotoProtectedRoute, requireAuthenticatedE2EConfig } from './helpers/auth'

const stamp = Date.now().toString(36).toUpperCase()
const unitCode = `E2E_${stamp}`.slice(0, 20)
const productName = `E2E weighed wash ${stamp}`

async function selectAnyCustomer(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Select Customer/i }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15_000 })
  const quickSelect = page.getByRole('button', { name: /Quick Select/i })
  if (await quickSelect.isVisible().catch(() => false)) {
    await quickSelect.click()
    return
  }
  await page.locator('#customer-search-input').fill('Jh')
  await page.locator('[role="option"]').first().click()
}

test.describe.serial('Measured pricing', () => {
  test.skip(process.env.E2E_ALLOW_WRITES !== '1', 'Writes data; set E2E_ALLOW_WRITES=1 on a disposable Organization.')

  test('a custom weight unit gets its base conversion and is found by search', async ({ page }) => {
    requireAuthenticatedE2EConfig()
    await gotoProtectedRoute(page, '/dashboard/catalog/units')

    await page.getByRole('button', { name: 'New custom unit' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel(/^Code/).fill(unitCode)
    await dialog.getByLabel(/^Measures/).selectOption('MASS')
    await dialog.getByLabel(/^Name \(English\)/).fill('E2E sack')
    await dialog.getByLabel(/^Symbol \(English\)/).fill('sack')
    await expect(dialog.getByRole('button', { name: 'Save' })).toBeDisabled()
    await dialog.getByLabel(/^Size of one unit in/).fill('25')
    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(dialog).toBeHidden({ timeout: 15_000 })

    await page.getByLabel('Search units').fill(unitCode)
    await expect(page.getByRole('cell', { name: unitCode })).toBeVisible()
    await page.getByRole('tab', { name: 'Conversions' }).click()
    await expect(page.getByRole('cell', { name: unitCode })).toBeVisible()
  })

  test('a product priced per kg shows what will be charged and takes its own conversion', async ({ page }) => {
    requireAuthenticatedE2EConfig()
    await gotoProtectedRoute(page, '/dashboard/catalog/services/new')

    await page.getByLabel(/^Category/).first().selectOption({ index: 1 })
    await page.getByLabel(/^Product Name/).first().fill(productName)
    const unit = page.getByRole('combobox', { name: /^Unit/ })
    await unit.fill('Kilogram')
    await unit.press('Enter')
    await page.getByLabel(/^Minimum billable/).fill('3')
    await page.getByLabel(/^Billing step/).fill('0.5')
    await page.getByLabel(/^Price per kg/).fill('1.2')
    await expect(page.getByText(/billed 3 kg \(minimum\)/)).toBeVisible()
    await page.getByRole('button', { name: /^Create$/ }).click()

    await expect(page.getByTestId('product-units-section')).toBeVisible({ timeout: 25_000 })
    const section = page.getByTestId('product-units-section')
    await section.getByRole('button', { name: 'New conversion' }).first().click()
    const dialog = page.getByRole('dialog')
    const from = dialog.getByRole('combobox', { name: /^From unit/ })
    await from.fill(unitCode)
    await from.press('Enter')
    const to = dialog.getByRole('combobox', { name: /^To unit/ })
    await to.fill('Kilogram')
    await to.press('Enter')
    await dialog.getByLabel(/^Multiply rate/).fill('20')
    await expect(dialog.getByText(`1 ${unitCode} = 20 KG`)).toBeVisible()
    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(section.getByRole('cell', { name: unitCode })).toBeVisible({ timeout: 15_000 })
  })

  test('an order weighs the item, in the product pack or in kg, and bills the minimum', async ({ page }) => {
    requireAuthenticatedE2EConfig()
    await gotoProtectedRoute(page, '/dashboard/orders/new')
    await selectAnyCustomer(page)

    const search = page.getByRole('search', { name: 'Search products by name' })
    await search.getByRole('switch').click()
    await search.getByPlaceholder('English or Arabic name…').fill(productName)
    await expect(page.getByText(productName).first()).toBeVisible({ timeout: 25_000 })
    await page.getByRole('button', { name: /^Add$/ }).first().click()

    const dialog = page.getByTestId('measure-line-dialog')
    // The product's own pack is offered next to kg.
    await dialog.getByLabel('Enter in').selectOption(unitCode)
    await expect(dialog.getByRole('button', { name: /^Add$/ })).toBeDisabled()
    await dialog.getByLabel('Enter in').selectOption('KG')
    await dialog.getByLabel('Measure (kg)').fill('1.8')
    await expect(dialog.getByText('Billed: 3 kg')).toBeVisible()
    await dialog.getByRole('button', { name: /^Add$/ }).click()

    await expect(page.getByTestId('cart-measure-note')).toContainText('billed 3 kg', { timeout: 25_000 })
  })
})
