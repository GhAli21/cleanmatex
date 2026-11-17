#!/usr/bin/env node
/**
 * Rewrites raw Tailwind palette classes to theme tokens and physical-direction
 * classes to logical ones, inside string literals only. Anything it cannot map
 * safely is printed with file:line and left unchanged (fixed by hand).
 *
 * Usage: node scripts/ui/codemod-classes.js <dir|file>... [--write]
 * Without --write it only reports. Used by PR-02 on src/ui and by PR-05 per feature folder.
 */
const fs = require('fs')
const path = require('path')

const NEUTRAL = '(?:gray|slate|zinc|neutral|stone)'
const STATUS = { green: 'success', emerald: 'success', red: 'danger', rose: 'danger', yellow: 'warning', amber: 'warning', orange: 'warning' }
const SOLID = { success: 'success', warning: 'warning', danger: 'destructive' }
const COLORS = 'white|black|gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'
const PALETTE = new RegExp(`^(?:bg|text|border(?:-[xytrblse])?|ring(?:-offset)?|from|via|to|divide|placeholder|outline|fill|stroke|decoration|shadow|accent|caret)-(?:${COLORS})(?:-\\d{2,3})?$`)
const SIZE = '(?:\\d+(?:\\.\\d+)?|px|auto|full|\\d+\\/\\d+|\\[[^\\]]+\\])'
const RADIUS = '(?:-(?:none|sm|md|lg|xl|2xl|3xl|full|\\[[^\\]]+\\]))?'
const SIDE = { l: 's', r: 'e', left: 'start', right: 'end', tl: 'ss', tr: 'se', bl: 'es', br: 'ee' }

/** Physical-direction class (no variants) -> logical class, or null. */
function mapDirection(base) {
  let m
  if ((m = base.match(new RegExp(`^(-?)([mp])([lr])-(${SIZE})$`)))) return `${m[1]}${m[2]}${SIDE[m[3]]}-${m[4]}`
  if ((m = base.match(new RegExp(`^(-?)(left|right)-(${SIZE})$`)))) return `${m[1]}${SIDE[m[2]]}-${m[3]}`
  if ((m = base.match(new RegExp(`^rounded-(l|r|tl|tr|bl|br)(${RADIUS})$`)))) return `rounded-${SIDE[m[1]]}${m[2]}`
  if ((m = base.match(/^border-(l|r)(-.+)?$/))) return `border-${SIDE[m[1]]}${m[2] || ''}`
  if ((m = base.match(/^(text|float|clear)-(left|right)$/))) return `${m[1]}-${SIDE[m[2]]}`
  return null
}

/** Raw palette class (no variants, no opacity) -> token class, or null when it needs a human. */
function mapPalette(base, variants, literal) {
  let m
  if (base === 'bg-white') return 'bg-card'
  if ((m = base.match(/^(from|via|to)-white$/))) return `${m[1]}-card`
  if (base === 'ring-offset-white') return 'ring-offset-background'
  if (base === 'text-black') return 'text-foreground'
  if (base === 'text-white') {
    if (/\bbg-(?:primary|(?:blue|cyan)-[5-7]00)\b/.test(literal)) return 'text-primary-foreground'
    if (/\bbg-(?:destructive|(?:red|rose)-[5-7]00)\b/.test(literal)) return 'text-destructive-foreground'
    return null
  }
  if (new RegExp(`^bg-${NEUTRAL}-(50|100|200)$`).test(base)) return 'bg-muted'
  if (new RegExp(`^text-${NEUTRAL}-(800|900|950)$`).test(base)) return 'text-foreground'
  if (new RegExp(`^text-${NEUTRAL}-(400|500|600|700)$`).test(base)) return 'text-muted-foreground'
  if (new RegExp(`^placeholder-${NEUTRAL}-\\d+$`).test(base)) return 'placeholder:text-muted-foreground'
  if (new RegExp(`^border-${NEUTRAL}-(100|200|300)$`).test(base)) return 'border-border'
  if (new RegExp(`^divide-${NEUTRAL}-(100|200|300)$`).test(base)) return 'divide-border'
  if (/^ring-(blue|cyan)-\d+$/.test(base)) return 'ring-ring'
  if (/^border-(blue|cyan)-[4-6]00$/.test(base)) return variants.some((v) => v.startsWith('focus')) ? 'border-ring' : null
  if (/^text-blue-[6-9]00$/.test(base)) return /\bbg-(?:blue-(?:50|100)|info-bg)\b/.test(literal) ? 'text-info-text' : 'text-primary-text'
  if (/^bg-blue-(50|100)$/.test(base)) return 'bg-info-bg'
  if (/^border-blue-[1-3]00$/.test(base)) return 'border-info-border'
  if (/^bg-(blue|cyan)-[56]00$/.test(base)) return 'bg-primary'
  if (/^bg-(blue|cyan)-700$/.test(base)) return 'bg-primary-hover'
  if ((m = base.match(/^(bg|text|border|ring)-(green|emerald|red|rose|yellow|amber|orange)-(\d+)$/))) {
    const [, kind, hue, shade] = m
    const tone = STATUS[hue], n = Number(shade)
    if (kind === 'bg') return n <= 200 ? `bg-${tone}-bg` : n <= 700 ? `bg-${SOLID[tone]}` : null
    if (kind === 'text') return n >= 500 ? `text-${tone}-text` : null
    if (kind === 'border') return n <= 300 ? `border-${tone}-border` : `border-${SOLID[tone]}`
    return `ring-${SOLID[tone]}`
  }
  return null
}

// Strings and comments in source order; comments are matched only so they are skipped.
const CHUNK = /\/\/[^\n]*|\/\*[\s\S]*?\*\/|`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/g
const TOKEN = /[^\s"'`{}()$,]+/g
// A class inside an RTL ternary (`isRTL ? 'pl-2' : 'pr-2'`) already swaps sides by hand; making it logical would swap twice.
const RTL_CONDITION = /\bisRTL\b|\bisRtl\b|['"]rtl['"]/

/** Source text of the token's line and the two lines before it. */
function near(src, offset) {
  let start = offset
  for (let i = 0; i < 3 && start > 0; i++) start = src.lastIndexOf('\n', start - 1)
  const end = src.indexOf('\n', offset)
  return src.slice(Math.max(start, 0), end === -1 ? undefined : end)
}

/** Each class-like token in string literals, with its parts and absolute offset. */
function* tokens(src) {
  for (const chunk of src.matchAll(CHUNK)) {
    const lit = chunk[0]
    if (lit.startsWith('//') || lit.startsWith('/*')) continue
    for (const t of lit.slice(1, -1).matchAll(TOKEN)) {
      const parts = t[0].split(':')
      let base = parts.pop()
      const important = base.startsWith('!') ? '!' : ''
      base = base.slice(important.length)
      const op = base.match(/\/\d+$/)
      const offset = chunk.index + 1 + t.index
      yield { token: t[0], offset, variants: parts, important, base, opacity: op ? op[0] : '', literal: lit, rtl: () => RTL_CONDITION.test(near(src, offset)) }
    }
  }
}

/** Mapped class for a token, '' when it is raw but needs a human, null when it is not raw. */
function mapToken({ variants, important, base, opacity, literal, rtl }) {
  const plain = opacity ? base.slice(0, -opacity.length) : base
  if (PALETTE.test(plain)) {
    if (variants.includes('dark')) return ''
    const to = mapPalette(plain, variants, literal)
    return to ? [...variants, important + to + opacity].join(':') : ''
  }
  const to = mapDirection(base)
  if (!to) return null
  // A class under rtl:/ltr: is a hand-made direction override; flipping it to logical would mirror it twice.
  const dirVariant = variants.includes('rtl') || variants.includes('ltr')
  return dirVariant || rtl() ? '' : [...variants, important + to].join(':')
}

const lineOf = (src, offset) => src.slice(0, offset).split('\n').length

/** Rewrites what it can; returns the new code, the number of changed classes and the raw classes left. */
function transformSource(src) {
  let code = '', last = 0, changed = 0
  const unmapped = []
  for (const t of tokens(src)) {
    const to = mapToken(t)
    if (to === null) continue
    if (to === '') { unmapped.push({ token: t.token, line: lineOf(src, t.offset) }); continue }
    code += src.slice(last, t.offset) + to
    last = t.offset + t.token.length
    changed++
  }
  return { code: code + src.slice(last), changed, unmapped }
}

/** Raw classes the guard rejects. Overlay black (`bg-black`, `bg-black/50`) stays black in dark mode on purpose. */
function findRawClasses(src) {
  const out = []
  for (const t of tokens(src)) {
    if (/^bg-black(\/\d+)?$/.test(t.base)) continue
    if (mapToken(t) !== null) out.push({ token: t.token, line: lineOf(src, t.offset) })
  }
  return out
}

function walk(p, out = []) {
  if (fs.statSync(p).isDirectory()) for (const f of fs.readdirSync(p)) walk(path.join(p, f), out)
  else if (/\.tsx?$/.test(p) && !/\.(stories\.tsx|d\.ts)$/.test(p)) out.push(p)
  return out
}

if (require.main === module) {
  const args = process.argv.slice(2)
  const write = args.includes('--write')
  let total = 0, left = 0
  for (const file of args.filter((a) => a !== '--write').flatMap((a) => walk(a))) {
    const src = fs.readFileSync(file, 'utf8')
    const r = transformSource(src)
    if (write && r.changed) fs.writeFileSync(file, r.code)
    total += r.changed
    left += r.unmapped.length
    if (r.changed) console.log(`${file}: ${r.changed} changed`)
    for (const u of r.unmapped) console.log(`  ${file}:${u.line}  ${u.token}  (by hand)`)
  }
  console.log(`${write ? 'Changed' : 'Would change'} ${total} classes; ${left} need a human.`)
}

module.exports = { transformSource, findRawClasses }
