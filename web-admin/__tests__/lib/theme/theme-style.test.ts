import { themeStyleCss } from '@/lib/theme/theme-style'
import { BRAND_TOKENS, computeBrandPalette, cssVarName } from '@/lib/theme/brand-palette'
import { DEFAULT_THEME_FOR_TEST } from './theme-fixture'

const ocean = { ...DEFAULT_THEME_FOR_TEST, seeds: { primary: '#2563EB', secondary: '#0F172A' } }

test('the plain STANDARD theme adds nothing: tokens.css already holds those values', () => {
  expect(themeStyleCss(DEFAULT_THEME_FOR_TEST)).toBe('')
})

test('another theme writes every brand variable for light, dark and system-dark, plus the radius', () => {
  const css = themeStyleCss({ ...ocean, radius: { sm: '0px', md: '0px', lg: '0px' } })
  const p = computeBrandPalette('#2563EB', '#0F172A')
  const blocks = [
    css.slice(css.indexOf(':root{'), css.indexOf('}')),
    css.slice(css.indexOf('[data-mode=DARK]{')),
    css.slice(css.indexOf('@media (prefers-color-scheme: dark){[data-mode=SYSTEM]{')),
  ]
  for (const token of BRAND_TOKENS) {
    expect(blocks[0]).toContain(`${cssVarName(token)}:${p.LIGHT[token]};`)
    expect(blocks[1]).toContain(`${cssVarName(token)}:${p.DARK[token]};`)
    expect(blocks[2]).toContain(`${cssVarName(token)}:${p.DARK[token]};`)
  }
  expect(blocks[0]).toContain('--cmx-radius-md:0px;')
})

test('a radius-only change writes only the radius', () => {
  const css = themeStyleCss({ ...DEFAULT_THEME_FOR_TEST, radius: { sm: '0px', md: '0px', lg: '0px' } })
  expect(css).toBe(':root{--cmx-radius-sm:0px;--cmx-radius-md:0px;--cmx-radius-lg:0px;}')
})

test('values that are not a colour or a length are never written into the page', () => {
  const css = themeStyleCss({
    ...DEFAULT_THEME_FOR_TEST,
    seeds: { primary: '#2563EB;}</style><script>', secondary: 'red' },
    radius: { sm: '1px;}body{display:none', md: '0.5rem', lg: '0.75rem' },
  })
  expect(css).not.toMatch(/<|script|display/)
  // Bad seeds fall back to STANDARD and a bad radius to the default, so nothing differs from tokens.css.
  expect(css).toBe('')
})
