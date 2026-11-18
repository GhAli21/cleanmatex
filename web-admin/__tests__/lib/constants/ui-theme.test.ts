import {
  DEFAULT_UI_THEME_CODE,
  UI_COLOR_MODES,
  UI_DENSITIES,
  UI_FONT_SCALES,
  UI_THEME_SEEDS,
} from '@/lib/constants/ui-theme'
import { orgThemeInputSchema, uiPreferencesSchema } from '@/lib/validations/ui-theme'

test('the default theme is one of the seeded themes', () => {
  expect(UI_THEME_SEEDS[DEFAULT_UI_THEME_CODE]).toEqual({ primary: '#0AB6D8', secondary: '#0E2A47' })
  expect(Object.keys(UI_THEME_SEEDS)).toHaveLength(10)
  for (const s of Object.values(UI_THEME_SEEDS)) {
    expect(s.primary).toMatch(/^#[0-9A-F]{6}$/)
    expect(s.secondary).toMatch(/^#[0-9A-F]{6}$/)
  }
})

test('preference values are the UPPERCASE constants and nothing else', () => {
  expect(uiPreferencesSchema.shape.ui_color_mode.unwrap().options).toEqual([...UI_COLOR_MODES])
  expect(uiPreferencesSchema.shape.ui_font_scale.unwrap().options).toEqual([...UI_FONT_SCALES])
  expect(uiPreferencesSchema.safeParse({ ui_density: null }).success).toBe(true)
  expect(uiPreferencesSchema.safeParse({ ui_density: UI_DENSITIES[1] }).success).toBe(true)
  expect(uiPreferencesSchema.safeParse({ ui_density: 'compact' }).success).toBe(false)
  // Only the three preference columns can be sent.
  expect(uiPreferencesSchema.safeParse({ ui_font_scale: 'MD', email: 'x@y.z' }).success).toBe(false)
})

test('an Organization theme accepts #RRGGBB overrides and rejects anything else', () => {
  const base = { theme_name: 'Main', ui_theme_code: 'STANDARD' }
  expect(orgThemeInputSchema.safeParse(base).success).toBe(true)
  expect(orgThemeInputSchema.safeParse({ ...base, brand_color_primary: '#0ab6d8' }).success).toBe(true)
  expect(orgThemeInputSchema.safeParse({ ...base, brand_color_primary: 'red' }).success).toBe(false)
  expect(orgThemeInputSchema.safeParse({ ...base, ui_theme_code: 'standard' }).success).toBe(false)
  expect(orgThemeInputSchema.safeParse({ ...base, tenant_org_id: 'x' }).success).toBe(false)
})
