import fs from 'node:fs'
import path from 'node:path'
import { test as setup, expect } from '@playwright/test'

const authFile = path.join(__dirname, '..', 'playwright', '.auth', 'tenant-user.json')

setup('bootstrap tenant session for protected E2E smoke', async ({ page }) => {
  fs.mkdirSync(path.dirname(authFile), { recursive: true })

  const email = process.env.E2E_LOGIN_EMAIL
  const password = process.env.E2E_LOGIN_PASSWORD

  if (!email || !password) {
    console.warn(
      '[playwright auth] E2E_LOGIN_EMAIL / E2E_LOGIN_PASSWORD not set; protected dashboard smoke will validate login redirects instead of authenticated screens.',
    )
    await page.context().storageState({ path: authFile })
    return
  }

  await page.goto('/login')
  await page.locator('input[name="email"]').fill(email)
  await page.locator('input[name="password"]').fill(password)

  await Promise.all([
    page.waitForURL(/\/dashboard(?:\/|$)/, { timeout: 30_000 }),
    page.locator('button[type="submit"]').click(),
  ])

  await expect(page).toHaveURL(/\/dashboard(?:\/|$)/)
  await page.context().storageState({ path: authFile })
})
