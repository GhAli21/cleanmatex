import '@testing-library/jest-dom'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import CmxTopBar from '@ui/navigation/cmx-top-bar'

const push = jest.fn()
const signOut = jest.fn().mockResolvedValue(undefined)

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key, useLocale: () => 'en' }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }), usePathname: () => '/dashboard' }))
jest.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({ user: { email: 'sara@example.com', user_metadata: { display_name: 'Sara' } }, currentTenant: null, signOut }),
}))
jest.mock('@ui/navigation/cmx-language-switcher', () => ({ CmxLanguageSwitcher: () => null }))

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.releasePointerCapture = () => {}
  Element.prototype.scrollIntoView = () => {}
  global.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never
})

const openMenu = () =>
  act(() => { fireEvent.keyDown(screen.getByRole('button', { name: /Sara/ }), { key: 'Enter' }) })

test('renders the title and the caller actions', () => {
  render(<CmxTopBar title="Orders" actions={<button type="button">Scan</button>} />)
  expect(screen.getByRole('heading', { name: 'Orders' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Scan' })).toBeInTheDocument()
})

test('the user menu opens by keyboard and closes on Escape', async () => {
  render(<CmxTopBar title="Orders" />)
  openMenu()
  expect(screen.getByRole('menu')).toBeInTheDocument()
  expect(screen.getAllByRole('menuitem')).toHaveLength(5)
  act(() => { fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' }) })
  await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
})

test('in Arabic the user menu is laid out right to left', () => {
  document.documentElement.dir = 'rtl'
  try {
    render(<CmxTopBar title="Orders" />)
    openMenu()
    expect(screen.getByRole('menu')).toHaveAttribute('dir', 'rtl')
  } finally {
    document.documentElement.dir = ''
  }
})

test('menu items navigate, and sign out calls signOut', () => {
  render(<CmxTopBar title="Orders" />)
  openMenu()
  fireEvent.click(screen.getByRole('menuitem', { name: 'accountSecurity' }))
  expect(push).toHaveBeenCalledWith('/dashboard/account/security')
  openMenu()
  fireEvent.click(screen.getByRole('menuitem', { name: 'signOut' }))
  expect(signOut).toHaveBeenCalled()
})
