import { expect, test, type Locator, type Page } from '@playwright/test'

import { gotoProtectedRoute, requireAuthenticatedE2EConfig } from './helpers/auth'

const PAYMENT_MODAL_TEST_ID = 'payment-modal-v4'
const SUBMIT_ORDER_ROUTE = '**/api/v1/orders/submit-order'
const CUSTOMER_SEARCH_QUERY = process.env.E2E_PAYMENT_CUSTOMER_QUERY ?? '96662624'
const PROMO_CODE = process.env.E2E_PAYMENT_PROMO_CODE ?? 'SMRPROMO1'
const GIFT_CARD_CODE = process.env.E2E_PAYMENT_GIFT_CARD_CODE ?? 'CMX-71C9-6B00-E43A'
const GIFT_CARD_PIN = process.env.E2E_PAYMENT_GIFT_CARD_PIN ?? '1234'

function isoDateDaysFromToday(daysFromToday: number): string {
  const date = new Date()
  date.setDate(date.getDate() + daysFromToday)

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function extractNumbers(text: string): number[] {
  const matches = text.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/g)
  return matches ? matches.map(Number) : []
}

async function readMoney(locator: Locator): Promise<number> {
  const text = (await locator.textContent()) ?? ''
  const values = extractNumbers(text)

  if (values.length === 0) {
    throw new Error(`Could not read money value from: ${text}`)
  }

  return values[values.length - 1]
}

async function readDecimalPlaces(locator: Locator): Promise<number> {
  const text = (await locator.textContent()) ?? ''
  const match = text.replace(/,/g, '').match(/-?\d+\.(\d+)/)
  return match ? match[1].length : 0
}

function expectMoneyClose(actual: number, expected: number, precision: number): void {
  const tolerance = Math.pow(10, -Math.max(precision, 2))
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance)
}

async function selectDemoCustomer(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Select Customer/i }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15_000 })

  const quickSelectButton = page.getByRole('button', { name: /Quick Select/i })
  if (await quickSelectButton.isVisible().catch(() => false)) {
    await quickSelectButton.click()
    return
  }

  await page.locator('#customer-search-input').fill(CUSTOMER_SEARCH_QUERY)
  const firstCustomerOption = page.locator('[role="option"]').first()
  await expect(firstCustomerOption).toBeVisible({ timeout: 15_000 })
  await firstCustomerOption.click()
}

async function setReadyByTomorrow(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Ready By' }).click()
  await expect(page.getByText(/Select Ready Date/i)).toBeVisible({ timeout: 15_000 })

  await page.locator('input[type="date"]').fill(isoDateDaysFromToday(1))
  await page.locator('input[type="time"]').fill('17:00')
  await page.getByRole('button', { name: /^Apply$/i }).click()
}

async function openPaymentModal(page: Page): Promise<void> {
  requireAuthenticatedE2EConfig()

  await gotoProtectedRoute(page, '/dashboard/orders/new')

  if (
    /\/login(?:\/|$)/i.test(page.url()) ||
    await page.locator('body').getByText(/Redirecting to login/i).isVisible().catch(() => false) ||
    await page.locator('form').first().isVisible().catch(() => false)
  ) {
    test.skip(true, 'Authenticated dashboard session was not available in this environment.')
  }

  await expect(page.getByRole('heading', { name: 'New Order' })).toBeVisible({
    timeout: 25_000,
  })

  const firstAddButton = page.getByRole('button', { name: /^Add$/ }).first()
  await expect(firstAddButton).toBeVisible({ timeout: 25_000 })

  await selectDemoCustomer(page)
  await firstAddButton.click()
  await setReadyByTomorrow(page)

  const openPaymentButton = page.locator('button').filter({ hasText: 'Submit Order' }).first()
  await expect(openPaymentButton).toBeEnabled({ timeout: 15_000 })
  await openPaymentButton.click()

  const paymentModal = page.getByTestId(PAYMENT_MODAL_TEST_ID)
  if (!(await paymentModal.isVisible().catch(() => false))) {
    if (await page.locator('body').getByText(/Payment Tools/i).isVisible().catch(() => false)) {
      test.skip(true, 'The target tenant is still running a build older than the new payment-modal E2E anchors.')
    }
  }

  await expect(paymentModal).toBeVisible({ timeout: 25_000 })
  await expect(page.getByTestId('payment-legs-panel')).toBeVisible({ timeout: 15_000 })
}

async function choosePaymentMethod(page: Page, methodCode: 'cash' | 'card' | 'check'): Promise<void> {
  const button = page.getByTestId(`payment-method-${methodCode}`)
  await expect(button).toBeVisible({ timeout: 20_000 })
  await button.click()
  await expect(page.locator('[data-testid^="payment-leg-summary-"]')).toHaveCount(1, {
    timeout: 10_000,
  })
}

async function setAmount(page: Page, amount: number, decimalPlaces: number): Promise<void> {
  await page.getByTestId('payment-amount-editor').fill(amount.toFixed(decimalPlaces))
}

async function getTotalDue(page: Page): Promise<{ amount: number; decimalPlaces: number }> {
  const locator = page.getByTestId('payment-balance-total-due')
  const amount = await readMoney(locator)
  const decimalPlaces = await readDecimalPlaces(locator)

  return { amount, decimalPlaces }
}

async function readLegAmount(page: Page, index: number): Promise<number> {
  return readMoney(page.getByTestId(`payment-leg-summary-${index}`))
}

async function closeAndDiscardPaymentModal(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^Cancel$/i }).click()

  const confirmCloseButton = page.getByRole('button', { name: /^Close$/i }).last()
  await expect(confirmCloseButton).toBeVisible({ timeout: 10_000 })
  await confirmCloseButton.click()

  await expect(page.getByTestId(PAYMENT_MODAL_TEST_ID)).toBeHidden({ timeout: 15_000 })
}

async function reopenPaymentModal(page: Page): Promise<void> {
  const openPaymentButton = page.locator('button').filter({ hasText: 'Submit Order' }).first()
  await expect(openPaymentButton).toBeEnabled({ timeout: 15_000 })
  await openPaymentButton.click()
  await expect(page.getByTestId(PAYMENT_MODAL_TEST_ID)).toBeVisible({ timeout: 20_000 })
}

async function fillVisibleCardMetadata(page: Page): Promise<void> {
  const terminalTrigger = page.getByRole('combobox').filter({ hasText: /Select terminal/i }).first()
  if (await terminalTrigger.isVisible().catch(() => false)) {
    await terminalTrigger.click()
    const terminalOptions = page.locator('[role="option"]')
    const optionCount = await terminalOptions.count()

    if (optionCount <= 1) {
      test.skip(true, 'No payment terminal options are available in this environment.')
    }

    await terminalOptions.nth(1).click()
  }

  const last4Input = page.getByLabel(/Last 4 Digits/i)
  if (await last4Input.isVisible().catch(() => false)) {
    await last4Input.fill('4242')
  }

  const authCodeInput = page.getByLabel(/Auth Code/i)
  if (await authCodeInput.isVisible().catch(() => false)) {
    await authCodeInput.fill('PW-E2E-AUTH')
  }
}

async function submitAndCaptureOrderRequest(page: Page): Promise<Record<string, unknown>> {
  let requestBody: Record<string, unknown> | null = null

  await page.route(SUBMIT_ORDER_ROUTE, async (route) => {
    requestBody = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          order: {
            id: '00000000-0000-4000-8000-000000000001',
            orderNo: 'PW-E2E-ORDER',
            currentStatus: 'OPEN',
          },
          warnings: [],
        },
      }),
    })
  })

  await page.getByTestId('payment-submit-button').click()

  const confirmDialog = page.getByTestId('payment-submit-confirm')
  if (!(await confirmDialog.isVisible().catch(() => false))) {
    if (
      await page
        .locator('body')
        .getByText(/cash drawer|payment terminal|required|select an open cash drawer session/i)
        .isVisible()
        .catch(() => false)
    ) {
      test.skip(true, 'This environment requires extra cash-drawer or terminal setup before the modal can submit.')
    }

    throw new Error('Payment submit confirmation did not open.')
  }

  await page.getByTestId('payment-submit-confirm-button').click()

  await expect
    .poll(() => requestBody, { timeout: 15_000 })
    .not.toBeNull()

  return requestBody as Record<string, unknown>
}

test.describe('Payment Modal V4', () => {
  test.beforeEach(async ({ page }) => {
    await openPaymentModal(page)
  })

  test('resets split legs and draft state after close and reopen', async ({ page }) => {
    const { amount: totalDue, decimalPlaces } = await getTotalDue(page)

    await choosePaymentMethod(page, 'cash')
    await setAmount(page, totalDue + 1, decimalPlaces)
    await expect(page.getByTestId('payment-active-cash-tendered')).toContainText(
      (totalDue + 1).toFixed(decimalPlaces),
    )

    await closeAndDiscardPaymentModal(page)
    await reopenPaymentModal(page)

    await expect(page.locator('[data-testid^="payment-leg-summary-"]')).toHaveCount(0)
    await expect(page.getByTestId('payment-legs-panel')).toContainText(
      /Select an immediate method to start collecting payment/i,
    )
    await expect(page.getByTestId('payment-legs-panel')).not.toContainText(
      new RegExp((totalDue + 1).toFixed(decimalPlaces).replace('.', '\\.')),
    )
  })

  test('builds an exact-cash payload with matching amount and cashTendered', async ({ page }) => {
    const { amount: totalDue, decimalPlaces } = await getTotalDue(page)

    await choosePaymentMethod(page, 'cash')

    expectMoneyClose(await readMoney(page.getByTestId('payment-balance-remaining')), 0, decimalPlaces)
    expectMoneyClose(await readMoney(page.getByTestId('payment-balance-change')), 0, decimalPlaces)

    const requestBody = await submitAndCaptureOrderRequest(page)
    const paymentLegs = requestBody.paymentLegs as Array<Record<string, unknown>>

    expect(paymentLegs).toHaveLength(1)
    expect(paymentLegs[0]?.method).toBe('CASH')
    expect(typeof paymentLegs[0]?.legRef).toBe('string')
    expectMoneyClose(Number(paymentLegs[0]?.amount), totalDue, decimalPlaces)
    expectMoneyClose(Number(paymentLegs[0]?.cashTendered), totalDue, decimalPlaces)
  })

  test('keeps cash tendered draft while capping applied cash at the order remaining', async ({ page }) => {
    const { amount: totalDue, decimalPlaces } = await getTotalDue(page)
    const overTenderAmount = totalDue + 1
    const partialAmount = totalDue / 2

    await choosePaymentMethod(page, 'cash')
    await setAmount(page, overTenderAmount, decimalPlaces)

    await expect(page.getByTestId('payment-amount-editor')).toHaveValue(
      overTenderAmount.toFixed(decimalPlaces),
    )
    expectMoneyClose(
      await readMoney(page.getByTestId('payment-active-applied-amount')),
      totalDue,
      decimalPlaces,
    )
    expectMoneyClose(
      await readMoney(page.getByTestId('payment-active-cash-tendered')),
      overTenderAmount,
      decimalPlaces,
    )
    expectMoneyClose(await readMoney(page.getByTestId('payment-balance-change')), 1, decimalPlaces)

    await setAmount(page, partialAmount, decimalPlaces)

    await expect(page.getByTestId('payment-amount-editor')).toHaveValue(
      partialAmount.toFixed(decimalPlaces),
    )
    expectMoneyClose(
      await readMoney(page.getByTestId('payment-active-applied-amount')),
      partialAmount,
      decimalPlaces,
    )
    expectMoneyClose(
      await readMoney(page.getByTestId('payment-active-cash-tendered')),
      partialAmount,
      decimalPlaces,
    )
    expectMoneyClose(await readMoney(page.getByTestId('payment-balance-change')), 0, decimalPlaces)
    expectMoneyClose(
      await readMoney(page.getByTestId('payment-balance-remaining')),
      totalDue - partialAmount,
      decimalPlaces,
    )
  })

  test('creates a split cash and card payload with capped remaining amount and distinct leg refs', async ({ page }) => {
    const { amount: totalDue, decimalPlaces } = await getTotalDue(page)
    const cashPortion = totalDue / 2
    const cardPortion = totalDue - cashPortion

    await choosePaymentMethod(page, 'cash')
    await setAmount(page, cashPortion, decimalPlaces)

    await page.getByTestId('payment-method-card').click()
    await expect(page.locator('[data-testid^="payment-leg-summary-"]')).toHaveCount(2)
    await expect(page.getByTestId('payment-leg-summary-1')).toContainText(/Card/i)

    expectMoneyClose(await readLegAmount(page, 1), cardPortion, decimalPlaces)

    await setAmount(page, totalDue, decimalPlaces)
    expectMoneyClose(await readLegAmount(page, 1), cardPortion, decimalPlaces)
    expectMoneyClose(await readMoney(page.getByTestId('payment-balance-remaining')), 0, decimalPlaces)

    await fillVisibleCardMetadata(page)

    const requestBody = await submitAndCaptureOrderRequest(page)
    const paymentLegs = requestBody.paymentLegs as Array<Record<string, unknown>>

    expect(paymentLegs).toHaveLength(2)
    expect(paymentLegs[0]?.method).toBe('CASH')
    expect(paymentLegs[1]?.method).toBe('CARD')
    expect(paymentLegs[0]?.legRef).not.toBe(paymentLegs[1]?.legRef)
    expectMoneyClose(Number(paymentLegs[0]?.amount), cashPortion, decimalPlaces)
    expectMoneyClose(Number(paymentLegs[1]?.amount), cardPortion, decimalPlaces)
  })

  test('shows the totals-adjusted toast and re-caps leg amounts after a discount changes the order total', async ({ page }) => {
    const { amount: totalDue, decimalPlaces } = await getTotalDue(page)
    const cashPortion = totalDue / 2
    const discountAmount = Number((totalDue / 3).toFixed(decimalPlaces))

    await choosePaymentMethod(page, 'cash')
    await setAmount(page, cashPortion, decimalPlaces)
    await page.getByTestId('payment-method-card').click()
    await expect(page.locator('[data-testid^="payment-leg-summary-"]')).toHaveCount(2)

    const previousTotal = await readMoney(page.getByTestId('payment-balance-total-due'))

    const discountInput = page.getByTestId('payment-discount-amount')
    await discountInput.fill(discountAmount.toFixed(decimalPlaces))
    await discountInput.blur()

    await expect(page.locator('body')).toContainText(/Order total changed\. Payment leg amounts were adjusted to match\./i)

    const newTotal = await readMoney(page.getByTestId('payment-balance-total-due'))
    const firstLegAmount = await readLegAmount(page, 0)
    const secondLegAmount = await readLegAmount(page, 1)

    expect(newTotal).toBeLessThan(previousTotal)
    expect(firstLegAmount + secondLegAmount).toBeLessThanOrEqual(newTotal + Math.pow(10, -decimalPlaces))
  })

  test('applies a promo code and re-caps an existing cash leg against the lower sale total', async ({ page }) => {
    const { amount: totalDue, decimalPlaces } = await getTotalDue(page)

    await choosePaymentMethod(page, 'cash')
    const previousCashAmount = await readLegAmount(page, 0)

    await page.getByPlaceholder(/ENTER CODE/i).fill(PROMO_CODE)
    await page.getByRole('button', { name: /^Apply$/i }).first().click()

    await expect(page.locator('body')).toContainText(new RegExp(PROMO_CODE, 'i'))
    await expect(page.locator('body')).toContainText(/Order total changed\. Payment leg amounts were adjusted to match\./i)

    const newTotal = await readMoney(page.getByTestId('payment-balance-total-due'))
    const newCashAmount = await readLegAmount(page, 0)

    expect(newTotal).toBeLessThan(totalDue)
    expect(newCashAmount).toBeLessThan(previousCashAmount)
    expectMoneyClose(newCashAmount, newTotal, decimalPlaces)
  })

  test('applies a PIN-protected gift card and re-caps the active cash leg while reducing the remaining balance', async ({ page }) => {
    const { decimalPlaces } = await getTotalDue(page)

    await choosePaymentMethod(page, 'cash')
    const previousCashAmount = await readLegAmount(page, 0)
    const previousRemaining = await readMoney(page.getByTestId('payment-balance-remaining'))

    await page.getByPlaceholder(/GIFT CARD NUMBER OR PIN/i).fill(GIFT_CARD_CODE)
    await page.getByRole('button', { name: /^Fetch$/i }).click()

    const pinInput = page.getByLabel(/Card PIN/i)
    if (await pinInput.isVisible().catch(() => false)) {
      await pinInput.fill(GIFT_CARD_PIN)
      await page.getByRole('button', { name: /^Fetch$/i }).click()
    }

    const applyAmountInput = page.getByLabel(/Apply Amount/i)
    await expect(applyAmountInput).toBeVisible({ timeout: 20_000 })

    const suggestedAmount = Number(await applyAmountInput.inputValue())
    expect(suggestedAmount).toBeGreaterThan(0)

    await page.getByRole('button', { name: /^Apply Amount$/i }).click()

    await expect(page.locator('body')).toContainText(/Order total changed\. Payment leg amounts were adjusted to match\./i)
    await expect(page.locator('body')).toContainText(new RegExp(GIFT_CARD_CODE, 'i'))

    const newCashAmount = await readLegAmount(page, 0)
    const newRemaining = await readMoney(page.getByTestId('payment-balance-remaining'))

    expect(newCashAmount).toBeLessThan(previousCashAmount)
    expect(newRemaining).toBeLessThanOrEqual(previousRemaining + Math.pow(10, -decimalPlaces))
  })

  test('restores check details after switching away from and back to the active check leg', async ({ page }) => {
    const { amount: totalDue, decimalPlaces } = await getTotalDue(page)
    const checkPortion = totalDue / 2
    const futureDate = isoDateDaysFromToday(2)

    await choosePaymentMethod(page, 'check')
    await setAmount(page, checkPortion, decimalPlaces)

    const checkNumberInput = page.getByLabel(/Check Number/i)
    const checkBankInput = page.getByLabel(/Bank Name/i)
    const checkDateInput = page.getByLabel(/Due Date/i)

    await checkNumberInput.fill('CHK-2026-001')
    await checkBankInput.fill('Muscat Test Bank')
    await checkDateInput.fill(futureDate)

    await page.getByTestId('payment-method-cash').click()
    await expect(page.locator('[data-testid^="payment-leg-summary-"]')).toHaveCount(2)
    await expect(checkNumberInput).toHaveCount(0)

    await page.getByTestId('payment-leg-summary-0').click()

    await expect(page.getByLabel(/Check Number/i)).toHaveValue('CHK-2026-001')
    await expect(page.getByLabel(/Bank Name/i)).toHaveValue('Muscat Test Bank')
    await expect(page.getByLabel(/Due Date/i)).toHaveValue(futureDate)
  })
})
