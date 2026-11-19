/**
 * Account → Appearance (PR-07 task 6): the light/dark choice is shown, and saving sends it.
 */
import '@testing-library/jest-dom'
import * as React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const refresh = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
jest.mock('@/lib/utils/csrf-token', () => ({ getCSRFToken: async () => 'csrf' }))
jest.mock('next-intl', () => {
  const catalog: Record<string, unknown> = {
    'authSession.appearance': jest.requireActual('@/messages/en/authSession.json').appearance,
    common: jest.requireActual('@/messages/en/common.json'),
  }
  return {
    useTranslations: (ns: string) => (key: string) => {
      const msg = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], catalog[ns])
      return typeof msg === 'string' ? msg : `${ns}.${key}`
    },
  }
})
jest.mock('@ui/feedback', () => ({ cmxMessage: { success: jest.fn(), error: jest.fn() } }))

import { AccountAppearanceScreen } from '@features/auth-session/ui/account-appearance-screen'

const fetchMock = jest.fn()

beforeAll(() => {
  // jsdom lacks these; the Radix select calls them on open.
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.releasePointerCapture = () => {}
  Element.prototype.scrollIntoView = () => {}
  global.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never
})

beforeEach(() => {
  fetchMock.mockReset()
  global.fetch = fetchMock as never
  fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => ({
    ok: true,
    json: async () => ({
      data: init?.method === 'PUT' ? { ...JSON.parse(String(init.body)), ui_font_scale: 'MD' } : { ui_color_mode: 'SYSTEM', ui_density: null, ui_font_scale: 'MD' },
    }),
  }))
})

test('choosing Dark enables Save and sends ui_color_mode', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <AccountAppearanceScreen />
    </QueryClientProvider>,
  )
  const trigger = await screen.findByRole('combobox', { name: 'Light or dark' })
  expect(trigger).toHaveTextContent('Same as this device')
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()

  fireEvent.keyDown(trigger, { key: 'Enter' })
  fireEvent.click(await screen.findByRole('option', { name: 'Dark' }))
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() => expect(refresh).toHaveBeenCalled())
  const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')
  expect(JSON.parse(put[1].body)).toEqual(expect.objectContaining({ ui_color_mode: 'DARK' }))
})
