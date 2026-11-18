import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('next-intl', () => ({ useTranslations: () => (k: string) => k, useLocale: () => 'en' }))

import { ThemeEditorForm, type BrandingCatalog } from '@features/settings/ui/branding/theme-editor-form'

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.releasePointerCapture = () => {}
  Element.prototype.scrollIntoView = () => {}
  global.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never
})

const catalog: BrandingCatalog = {
  themes: [
    { code: 'STANDARD', name: 'CleanMateX', name2: null, description: null, description2: null, brand_color_primary: '#0AB6D8', brand_color_secondary: '#0E2A47', ui_radius_code: 'STANDARD', ui_font_pair_code: 'STANDARD', is_default: true },
    { code: 'OCEAN', name: 'Ocean', name2: null, description: null, description2: null, brand_color_primary: '#2563EB', brand_color_secondary: '#0F172A', ui_radius_code: 'STANDARD', ui_font_pair_code: 'STANDARD', is_default: false },
  ],
  radii: [{ code: 'STANDARD', name: 'Standard', name2: null, radius_sm: '0.375rem', radius_md: '0.5rem', radius_lg: '0.75rem', is_default: true }],
  fonts: [{ code: 'STANDARD', name: 'Standard', name2: null, font_family_en: 'System UI', font_family_ar: 'Noto Sans Arabic', is_default: true }],
}

const renderForm = (plan: { customBranding: boolean; whiteLabel: boolean }, onSubmit = jest.fn()) =>
  render(<ThemeEditorForm catalog={catalog} plan={plan} initial={null} saving={false} onSubmit={onSubmit} onCancel={jest.fn()} />)

test('without the plan flags the override and app-name fields are disabled and say why', () => {
  renderForm({ customBranding: false, whiteLabel: false })
  expect(screen.getByLabelText('primaryColor')).toBeDisabled()
  expect(screen.getByLabelText('brandingScreen.appName')).toBeDisabled()
  expect(screen.getByText('brandingScreen.notInPlanBranding')).toBeInTheDocument()
  expect(screen.getByText('brandingScreen.notInPlanWhiteLabel')).toBeInTheDocument()
})

test('a colour unreadable as text gets the notice beside the field as it is typed', () => {
  renderForm({ customBranding: true, whiteLabel: true })
  expect(screen.queryByText('brandingScreen.colorAdjusted')).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('primaryColor'), { target: { value: '#FACC15' } })
  expect(screen.getByText('brandingScreen.colorAdjusted')).toBeInTheDocument()
})

test('save sends the name, the starting theme and NULL for overrides left empty', () => {
  const onSubmit = jest.fn()
  renderForm({ customBranding: true, whiteLabel: true }, onSubmit)
  fireEvent.change(screen.getByLabelText('brandingScreen.themeName'), { target: { value: 'Main' } })
  fireEvent.click(screen.getByRole('button', { name: 'save' }))
  expect(onSubmit).toHaveBeenCalledWith({
    theme_name: 'Main',
    theme_name2: null,
    ui_theme_code: 'STANDARD',
    brand_color_primary: null,
    brand_color_secondary: null,
    ui_radius_code: null,
    ui_font_pair_code: null,
    default_ui_density: null,
    app_display_name: null,
    app_display_name2: null,
  })
})

test('save is refused without a name', () => {
  const onSubmit = jest.fn()
  renderForm({ customBranding: true, whiteLabel: true }, onSubmit)
  fireEvent.click(screen.getByRole('button', { name: 'save' }))
  expect(onSubmit).not.toHaveBeenCalled()
})

// PR-07 review I2: without the plan, save leaves out the overrides so the stored ones are kept for an upgrade.
test('save leaves out the fields the plan does not include', () => {
  const onSubmit = jest.fn()
  renderForm({ customBranding: false, whiteLabel: false }, onSubmit)
  fireEvent.change(screen.getByLabelText('brandingScreen.themeName'), { target: { value: 'Main' } })
  fireEvent.click(screen.getByRole('button', { name: 'save' }))
  const body = onSubmit.mock.calls[0][0]
  expect(body).toMatchObject({ theme_name: 'Main', ui_theme_code: 'STANDARD' })
  for (const k of ['brand_color_primary', 'brand_color_secondary', 'ui_radius_code', 'ui_font_pair_code', 'app_display_name', 'app_display_name2']) {
    expect(body).not.toHaveProperty(k)
  }
})
