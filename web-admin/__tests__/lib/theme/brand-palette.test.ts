import { BRAND_TOKENS, computeBrandPalette, contrastRatio, cssVarName } from '@/lib/theme/brand-palette'

const SEEDS: Array<[string, string]> = [
  ['#0AB6D8', '#0E2A47'],
  ['#2563EB', '#0F172A'],
  ['#059669', '#064E3B'],
  ['#0D9488', '#134E4A'],
  ['#7C3AED', '#1E1B4B'],
  ['#E11D48', '#4C0519'],
  ['#EA580C', '#7C2D12'],
  ['#B45309', '#451A03'],
  ['#475569', '#0F172A'],
  ['#18181B', '#52525B'],
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
