import { BRAND_TOKENS, computeBrandPalette, contrastRatio, cssVarName, readableTextOn, seedAdjustments } from '@/lib/theme/brand-palette'
import { UI_THEME_SEEDS } from '@/lib/constants/ui-theme'

const SEEDS: Array<[string, string]> = [
  // the HQ themes seeded by the catalog migration
  ...Object.values(UI_THEME_SEEDS).map((s): [string, string] => [s.primary, s.secondary]),
  // hard cases
  ['#FACC15', '#0F172A'],
  ['#FFFFFF', '#000000'],
  ['#000000', '#FFFFFF'],
  ['#808080', '#808080'],
]
const MODES = ['LIGHT', 'DARK'] as const

test('contrastRatio matches WCAG endpoints', () => {
  expect(contrastRatio('255 255 255', '0 0 0')).toBeCloseTo(21, 1)
  expect(contrastRatio('10 182 216', '10 182 216')).toBeCloseTo(1, 5)
})

test('cssVarName builds the migration variable name', () => {
  expect(cssVarName('primary')).toBe('--cmx-primary-rgb')
})

describe.each(SEEDS)('seeds %s / %s', (primary, secondary) => {
  const palette = computeBrandPalette(primary, secondary)

  test.each(MODES)('%s has every token as an integer triplet', (mode) => {
    for (const token of BRAND_TOKENS) {
      expect(palette[mode][token]).toMatch(/^\d{1,3} \d{1,3} \d{1,3}$/)
      for (const channel of palette[mode][token].split(' ')) expect(Number(channel)).toBeLessThanOrEqual(255)
    }
  })

  test.each(MODES)('%s text on solids and surfaces reaches 4.5:1', (mode) => {
    const p = palette[mode]
    expect(contrastRatio(p['primary-fg'], p.primary)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(p['brand-secondary-fg'], p['brand-secondary'])).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(p['primary-text'], p.surface)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(p['brand-secondary-text'], p.surface)).toBeGreaterThanOrEqual(4.5)
    for (const bg of ['background', 'surface', 'surface-muted', 'muted', 'table-header-bg'] as const) {
      expect(contrastRatio(p.foreground, p[bg])).toBeGreaterThanOrEqual(7)
      expect(contrastRatio(p['muted-foreground'], p[bg])).toBeGreaterThanOrEqual(4.5)
    }
  })
})

test('seedAdjustments flags a seed whose readable text shade differs from it', () => {
  // Bright yellow is unreadable as text on white, so a darker shade is used.
  expect(seedAdjustments('#FACC15', '#0E2A47')).toEqual({ primary: true, secondary: false })
  expect(seedAdjustments('#0E2A47', '#FACC15')).toEqual({ primary: false, secondary: true })
})

test('seeds are kept unchanged as the solid colours', () => {
  const p = computeBrandPalette('#0AB6D8', '#0E2A47')
  expect(p.LIGHT.primary).toBe('10 182 216')
  expect(p.DARK['brand-secondary']).toBe('14 42 71')
})

test('a grey seed does not tint the neutrals', () => {
  const [r, g, b] = computeBrandPalette('#808080', '#808080').LIGHT.background.split(' ')
  expect(r).toBe(g)
  expect(g).toBe(b)
})

test('rejects a malformed colour', () => {
  expect(() => computeBrandPalette('blue', '#000000')).toThrow('Invalid colour: blue')
})

test('readableTextOn picks readable text for an Organization colour (reject badge)', () => {
  expect(readableTextOn('#B91C1C')).toBe('rgb(255 255 255)') // dark red: white
  for (const hex of ['#10B981', '#FBBF24', '#FFFFFF']) {
    const fg = readableTextOn(hex).slice(4, -1)
    const bg = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ')
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5)
  }
  expect(readableTextOn('green')).toBe('rgb(255 255 255)') // not #RRGGBB: old behaviour, never throws
})
