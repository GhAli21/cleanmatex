/**
 * Status tones (badges, banners): each tone's text must be readable on its own
 * background in both modes, and Tailwind must expose bg/border/text classes.
 */
import fs from 'node:fs'
import path from 'node:path'
import { contrastRatio } from '@/lib/theme/brand-palette'

const ROOT = path.join(__dirname, '../../..')
const css = fs.readFileSync(path.join(ROOT, 'src/ui/foundations/tokens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const globals = fs.readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8')

const TONES = ['success', 'warning', 'info', 'danger'] as const

function block(marker: string): Record<string, string> {
  const open = css.indexOf('{', css.indexOf(marker))
  const body = css.slice(open + 1, css.indexOf('}', open))
  return Object.fromEntries([...body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]))
}

describe.each([
  ['light', ':root'],
  ['dark', '[data-mode=DARK]'],
])('%s mode', (_mode, marker) => {
  const vars = block(marker)
  test.each(TONES)('%s text is readable on its background', (tone) => {
    const bg = vars[`--cmx-${tone}-bg-rgb`]
    const text = vars[`--cmx-${tone}-text-rgb`]
    const border = vars[`--cmx-${tone}-border-rgb`]
    expect(bg).toBeDefined()
    expect(text).toBeDefined()
    expect(border).toBeDefined()
    expect(contrastRatio(text, bg)).toBeGreaterThanOrEqual(4.5)
  })
})

test('every colour class the badge uses is registered with Tailwind', () => {
  const badge = fs.readFileSync(path.join(ROOT, 'src/ui/feedback/cmx-status-badge.tsx'), 'utf8')
  const colours = [...badge.matchAll(/\b(?:bg|text|border)-([a-z]+(?:-[a-z]+)*)(?:\/\d+)?(?=[\s'"])/g)]
    .map((m) => m[1])
    .filter((c) => !['transparent', 'xs', 'sm', 'base'].includes(c))
  const missing = [...new Set(colours)].filter((c) => !new RegExp(`--color-${c}:`).test(globals))
  expect(missing).toEqual([])
})

test.each(TONES)('Tailwind exposes %s bg, border and text', (tone) => {
  for (const part of ['bg', 'border', 'text']) {
    expect(globals).toMatch(new RegExp(`--color-${tone}-${part}:\\s*rgb\\(var\\(--cmx-${tone}-${part}-rgb\\)\\)`))
  }
})
