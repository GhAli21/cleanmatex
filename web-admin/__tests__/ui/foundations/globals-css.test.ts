import fs from 'node:fs'
import path from 'node:path'

const css = fs.readFileSync(path.join(__dirname, '../../../app/globals.css'), 'utf8')

describe('app/globals.css (PR-05)', () => {
  test('no [dir] rule flips classes, aligns text, sets direction or places the sidebar', () => {
    const rules = css.match(/\[dir="?(?:rtl|ltr)"?\][^{]*\{[^}]*\}/g) ?? []
    for (const rule of rules) {
      expect(rule).not.toMatch(/\[dir="?(?:rtl|ltr)"?\]\s*(?:\.|aside)/) // class or sidebar selector
      expect(rule).not.toMatch(/text-align|direction\s*:|flex-direction|justify-content|align-items|margin|padding|left\s*:|right\s*:/)
    }
  })

  test('the Arabic typography rules sit in a layer, so utilities still win', () => {
    const firstRtl = css.indexOf('[dir="rtl"]')
    expect(firstRtl).toBeGreaterThan(-1)
    expect(css.lastIndexOf('@layer base', firstRtl)).toBeGreaterThan(-1)
  })

  test('the old :root aliases are gone; rules read the tokens', () => {
    expect(css).not.toMatch(/--(?:background|foreground|muted|border|ring|input-bg|input-text|input-placeholder|focus-ring)\s*:/)
    expect(css).not.toMatch(/var\(--(?:background|foreground|muted|border|input-bg|input-text|input-placeholder|focus-ring)\)/)
  })

  test('on-solid exists for text and lines on saturated fills', () => {
    expect(css).toMatch(/--color-on-solid:\s*rgb\(255 255 255\)/)
  })

  test('the dark logo shows only in dark mode, chosen or followed from the device (PR-07 task 6)', () => {
    expect(css).toMatch(/\.cmx-logo-dark\s*\{\s*display:\s*none/)
    expect(css).toMatch(/@media screen \{\s*\[data-mode=DARK\] \.cmx-logo-light\s*\{\s*display:\s*none;?\s*\}\s*\[data-mode=DARK\] \.cmx-logo-dark\s*\{\s*display:\s*block/)
    expect(css).toMatch(/@media screen and \(prefers-color-scheme: dark\) \{\s*\[data-mode=SYSTEM\] \.cmx-logo-light\s*\{\s*display:\s*none;?\s*\}\s*\[data-mode=SYSTEM\] \.cmx-logo-dark\s*\{\s*display:\s*block/)
  })

  test('charts read the tokens, so tooltips, grid and axis text work in dark mode (PR-07 task 6)', () => {
    for (const sel of ['.recharts-default-tooltip', '.recharts-cartesian-grid line', '.recharts-cartesian-axis-tick-value', '.recharts-legend-item-text']) {
      const at = css.indexOf(sel)
      expect(at).toBeGreaterThan(-1)
      expect(css.slice(at, css.indexOf('}', at))).toContain('var(--cmx-')
    }
  })

  test('warning-foreground is dark, so text on solid amber stays readable in both modes', () => {
    expect(css).toMatch(/--color-warning-foreground:\s*rgb\(28 25 23\)/)
  })
})
