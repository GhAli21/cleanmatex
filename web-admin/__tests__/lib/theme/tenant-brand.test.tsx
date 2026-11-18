import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

let locale = 'en'
jest.mock('next-intl', () => ({ useLocale: () => locale }))

import { TenantBrandProvider, useTenantBrand } from '@/lib/theme/tenant-brand'

function Probe() {
  const { name, logoUrl } = useTenantBrand()
  return <p>{`${name}|${logoUrl ?? 'none'}`}</p>
}

test('without a white-label name the app is CleanMateX (also with no provider, e.g. Storybook)', () => {
  render(<Probe />)
  expect(screen.getByText('CleanMateX|none')).toBeInTheDocument()
})

test('the white-label name follows the language, falling back to the English name', () => {
  const brand = { appName: 'Sparkle', appName2: 'سباركل', logoUrl: 'https://x/l.webp' }
  const { rerender } = render(<TenantBrandProvider value={brand}><Probe /></TenantBrandProvider>)
  expect(screen.getByText('Sparkle|https://x/l.webp')).toBeInTheDocument()
  locale = 'ar'
  rerender(<TenantBrandProvider value={brand}><Probe /></TenantBrandProvider>)
  expect(screen.getByText('سباركل|https://x/l.webp')).toBeInTheDocument()
  rerender(<TenantBrandProvider value={{ ...brand, appName2: null }}><Probe /></TenantBrandProvider>)
  expect(screen.getByText('Sparkle|https://x/l.webp')).toBeInTheDocument()
  locale = 'en'
})
