import { resolveTheme, type ResolveThemeInput } from '@/lib/theme/resolve-theme'
import { DEFAULT_UI_RADIUS, UI_THEME_SEEDS } from '@/lib/constants/ui-theme'

const theme = (code: string, primary: string, secondary: string, extra: Partial<ResolveThemeInput['themes'][number]> = {}) => ({
  code,
  brand_color_primary: primary,
  brand_color_secondary: secondary,
  ui_radius_code: 'STANDARD',
  ui_font_pair_code: 'STANDARD',
  is_default: false,
  ...extra,
})

const catalogs: Pick<ResolveThemeInput, 'themes' | 'radii' | 'fonts'> = {
  themes: [
    theme('STANDARD', '#0AB6D8', '#0E2A47', { is_default: true }),
    theme('OCEAN', '#2563EB', '#0F172A', { ui_radius_code: 'SOFT' }),
  ],
  radii: [
    { code: 'STANDARD', radius_sm: '0.375rem', radius_md: '0.5rem', radius_lg: '0.75rem', is_default: true },
    { code: 'SOFT', radius_sm: '0.5rem', radius_md: '0.75rem', radius_lg: '1rem', is_default: false },
    { code: 'SHARP', radius_sm: '0px', radius_md: '0px', radius_lg: '0px', is_default: false },
  ],
  fonts: [{ code: 'STANDARD', is_default: true }],
}

const orgRow = {
  ui_theme_code: 'OCEAN',
  brand_color_primary: '#FACC15',
  brand_color_secondary: null,
  ui_radius_code: 'SHARP',
  ui_font_pair_code: null,
  default_ui_density: 'COMPACT',
  app_display_name: 'Sparkle',
  app_display_name2: 'سباركل',
} as const

const input = (over: Partial<ResolveThemeInput> = {}): ResolveThemeInput => ({
  ...catalogs,
  orgTheme: null,
  customBranding: false,
  whiteLabel: false,
  user: null,
  logoUrl: null,
  logoDarkUrl: null,
  ...over,
})

test('the published logo is passed through on every plan', () => {
  expect(resolveTheme(input({ logoUrl: 'https://x/l.webp' })).logoUrl).toBe('https://x/l.webp')
  expect(resolveTheme(input()).logoUrl).toBeNull()
  expect(resolveTheme(input({ logoDarkUrl: 'https://x/d.webp' })).logoDarkUrl).toBe('https://x/d.webp')
  expect(resolveTheme(input()).logoDarkUrl).toBeNull()
})

test('an Organization with no theme in use gets STANDARD', () => {
  const t = resolveTheme(input())
  expect(t.themeCode).toBe('STANDARD')
  expect(t.seeds).toEqual({ primary: '#0AB6D8', secondary: '#0E2A47' })
  expect(t.radius).toEqual({ sm: '0.375rem', md: '0.5rem', lg: '0.75rem' })
  expect(t.density).toBe('COMFORTABLE')
  expect(t.fontScale).toBe('MD')
  expect(t.appName).toBeNull()
})

test('with no catalog at all (read failed) the built-in STANDARD values are used', () => {
  const t = resolveTheme(input({ themes: [], radii: [], fonts: [] }))
  expect(t.seeds).toEqual(UI_THEME_SEEDS.STANDARD)
  expect(t.radius).toEqual(DEFAULT_UI_RADIUS)
  expect(t.fontCode).toBe('STANDARD')
})

test('without custom_branding the overrides are ignored and the HQ theme applies', () => {
  const t = resolveTheme(input({ orgTheme: orgRow }))
  expect(t.themeCode).toBe('OCEAN')
  expect(t.seeds).toEqual({ primary: '#2563EB', secondary: '#0F172A' })
  expect(t.radius.md).toBe('0.75rem') // OCEAN's own SOFT, not the SHARP override
})

test('with custom_branding each override applies on its own; empty ones keep the HQ value', () => {
  const t = resolveTheme(input({ orgTheme: orgRow, customBranding: true }))
  expect(t.seeds).toEqual({ primary: '#FACC15', secondary: '#0F172A' })
  expect(t.radius).toEqual({ sm: '0px', md: '0px', lg: '0px' })
})

test('the app name needs white_label', () => {
  expect(resolveTheme(input({ orgTheme: orgRow })).appName).toBeNull()
  const t = resolveTheme(input({ orgTheme: orgRow, whiteLabel: true }))
  expect([t.appName, t.appName2]).toEqual(['Sparkle', 'سباركل'])
})

test('density: the user wins, NULL follows the Organization, then COMFORTABLE', () => {
  expect(resolveTheme(input({ orgTheme: orgRow })).density).toBe('COMPACT')
  expect(resolveTheme(input({ orgTheme: orgRow, user: { ui_color_mode: 'SYSTEM', ui_density: null, ui_font_scale: 'LG' } })).density).toBe('COMPACT')
  const t = resolveTheme(input({ orgTheme: orgRow, user: { ui_color_mode: 'SYSTEM', ui_density: 'COMFORTABLE', ui_font_scale: 'LG' } }))
  expect(t.density).toBe('COMFORTABLE')
  expect(t.fontScale).toBe('LG')
})

test('an unknown or removed HQ theme code falls back to the default theme', () => {
  const t = resolveTheme(input({ orgTheme: { ...orgRow, ui_theme_code: 'GONE' } }))
  expect(t.themeCode).toBe('STANDARD')
})

test("the mode is the person's choice; signed out or unknown follows the device", () => {
  const as = (ui_color_mode: string) => resolveTheme(input({ user: { ui_color_mode, ui_density: null, ui_font_scale: 'MD' } })).mode
  expect(as('DARK')).toBe('DARK')
  expect(as('LIGHT')).toBe('LIGHT')
  expect(as('SYSTEM')).toBe('SYSTEM')
  expect(as('dark;}')).toBe('SYSTEM')
  expect(resolveTheme(input({ user: null })).mode).toBe('SYSTEM')
})
