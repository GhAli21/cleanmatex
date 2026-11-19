import { computeBrandPalette, contrastRatio } from '@/lib/theme/brand-palette'

// Seed pairs of sys_ui_theme_cd (migration 0752). Keep in step with the migration.
const SEEDED: Array<[string, string, string]> = [
  ['STANDARD', '#0AB6D8', '#0E2A47'],
  ['OCEAN', '#2563EB', '#0F172A'],
  ['EMERALD', '#059669', '#064E3B'],
  ['TEAL', '#0D9488', '#134E4A'],
  ['ROYAL', '#7C3AED', '#1E1B4B'],
  ['ROSE', '#E11D48', '#4C0519'],
  ['SUNSET', '#EA580C', '#7C2D12'],
  ['GOLD', '#B45309', '#451A03'],
  ['SLATE', '#475569', '#0F172A'],
  ['GRAPHITE', '#18181B', '#52525B'],
]

describe.each(SEEDED)('%s', (_code, primary, secondary) => {
  const palette = computeBrandPalette(primary, secondary)
  test.each(['LIGHT', 'DARK'] as const)('%s: text on brand fills and brand text on the surface reach 4.5:1', (mode) => {
    const p = palette[mode]
    expect(contrastRatio(p['primary-fg'], p.primary)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(p['brand-secondary-fg'], p['brand-secondary'])).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(p['primary-text'], p.surface)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(p['brand-secondary-text'], p.surface)).toBeGreaterThanOrEqual(4.5)
  })
})
