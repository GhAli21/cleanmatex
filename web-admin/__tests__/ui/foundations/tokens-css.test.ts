/**
 * Guards for the design-token stylesheet: it must match the palette function
 * for the STANDARD theme, define every variable the code reads, and keep its
 * two dark blocks identical.
 */
import fs from 'node:fs'
import path from 'node:path'
import { BRAND_TOKENS, computeBrandPalette, cssVarName } from '@/lib/theme/brand-palette'

const ROOT = path.join(__dirname, '../../..')
const TOKENS_FILE = path.join(ROOT, 'src/ui/foundations/tokens.css')
const css = fs.readFileSync(TOKENS_FILE, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

/** Custom-property declarations of the first rule whose selector contains `marker`. */
function block(marker: string): Record<string, string> {
  const start = css.indexOf(marker)
  if (start === -1) throw new Error(`No rule for ${marker} in tokens.css`)
  const open = css.indexOf('{', start)
  const close = css.indexOf('}', open)
  const declarations: Record<string, string> = {}
  for (const match of css.slice(open + 1, close).matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    declarations[match[1]] = match[2].trim()
  }
  return declarations
}

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) sourceFiles(full, found)
    else if (/\.(ts|tsx|css)$/.test(entry.name) && full !== TOKENS_FILE) found.push(full)
  }
  return found
}

const standard = computeBrandPalette('#0AB6D8', '#0E2A47')

test('light block equals the STANDARD palette', () => {
  const light = block(':root')
  const expected = Object.fromEntries(BRAND_TOKENS.map((t) => [cssVarName(t), standard.LIGHT[t]]))
  expect(Object.fromEntries(BRAND_TOKENS.map((t) => [cssVarName(t), light[cssVarName(t)]]))).toEqual(expected)
})

test('dark block equals the STANDARD palette', () => {
  const dark = block('[data-mode=DARK]')
  const expected = Object.fromEntries(BRAND_TOKENS.map((t) => [cssVarName(t), standard.DARK[t]]))
  expect(Object.fromEntries(BRAND_TOKENS.map((t) => [cssVarName(t), dark[cssVarName(t)]]))).toEqual(expected)
})

test('light is also a selector, so data-mode="LIGHT" forces a light subtree (paper previews)', () => {
  expect(css).toMatch(/^\s*:root,\s*\[data-mode=LIGHT\]\s*\{/)
})

test('dark values apply only on screen, so paper always gets the light ones', () => {
  expect(css).toMatch(/@media screen\s*\{\s*\[data-mode=DARK\]\s*\{/)
  expect(css).toMatch(/@media screen and \(prefers-color-scheme: dark\)\s*\{\s*\[data-mode=SYSTEM\]\s*\{/)
  expect(css.match(/\[data-mode=(DARK|SYSTEM)\]/g)).toHaveLength(2)
})

test('SYSTEM media block repeats the dark block exactly', () => {
  expect(block('[data-mode=SYSTEM]')).toEqual(block('[data-mode=DARK]'))
})

test('every --cmx-* variable used in source is defined', () => {
  const used = new Set<string>()
  for (const dir of ['src', 'app', 'lib']) {
    for (const file of sourceFiles(path.join(ROOT, dir))) {
      for (const match of fs.readFileSync(file, 'utf8').matchAll(/--cmx-[a-z0-9-]*[a-z0-9]/g)) used.add(match[0])
    }
  }
  expect(used.size).toBeGreaterThan(20) // the scan really found the variables
  const defined = new Set([...css.matchAll(/(--cmx-[a-z0-9-]+)\s*:/g)].map((m) => m[1]))
  expect([...used].filter((name) => !defined.has(name)).sort()).toEqual([])
})

test('brand colour as text uses the readable token, never the solid seed', () => {
  const globals = fs.readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8')
  expect(globals).toMatch(/--color-primary-text:\s*rgb\(var\(--cmx-primary-text-rgb\)\)/)
  const offenders: string[] = []
  for (const dir of ['src', 'app']) {
    for (const file of sourceFiles(path.join(ROOT, dir))) {
      const text = fs.readFileSync(file, 'utf8')
      // `text-primary` (solid aqua, ~2.4:1 on white) or the hover shade used as text.
      if (/(^|[\s"'`:])text-primary(?=[\s"'`/]|$)/m.test(text) || /text-\[rgb\(var\(--cmx-primary-(hover-)?rgb/.test(text)) {
        offenders.push(path.relative(ROOT, file))
      }
    }
  }
  expect(offenders).toEqual([])
})
