import { expect, test, type Page } from '@playwright/test'

const AUTH_PATH_SEGMENTS = ['/login', '/auth']
const APP_ERROR_TEXT = /Application error: a server-side exception has occurred/i

export function isAuthRedirectUrl(url: string): boolean {
  return AUTH_PATH_SEGMENTS.some((segment) => url.includes(segment))
}

async function openRoute(page: Page, path: string): Promise<string> {
  await page.goto(path, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('body')).toBeVisible({ timeout: 15_000 })
  return page.url()
}

export async function gotoProtectedRoute(page: Page, path: string): Promise<string> {
  const url = await openRoute(page, path)
  if (isAuthRedirectUrl(url)) {
    await expect(page.locator('form')).toBeVisible({ timeout: 15_000 })
    test.skip(
      true,
      'Requires authenticated tenant session. Set E2E_LOGIN_EMAIL and E2E_LOGIN_PASSWORD to run protected dashboard smoke.',
    )
  }

  return url
}

export async function expectProtectedRouteLoadsOrRedirectsToLogin(
  page: Page,
  path: string,
): Promise<'loaded' | 'redirected'> {
  const url = await openRoute(page, path)
  if (isAuthRedirectUrl(url)) {
    const redirectedUrl = new URL(url)
    expect(redirectedUrl.pathname).toBe('/login')
    expect(redirectedUrl.searchParams.get('redirect')).toBe(path)
    await expect(page.locator('form')).toBeVisible({ timeout: 15_000 })
    return 'redirected'
  }

  expect(new URL(url).pathname).not.toMatch(/\/error(?:$|\/)/)
  await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 25_000 })
  await expect(page.locator('body')).not.toContainText(APP_ERROR_TEXT)
  await expect(page.locator('body')).not.toContainText('Internal Server Error')
  return 'loaded'
}
