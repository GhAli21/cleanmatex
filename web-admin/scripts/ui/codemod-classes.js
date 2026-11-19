#!/usr/bin/env node
/**
 * Rewrites raw Tailwind palette classes to theme tokens and physical-direction
 * classes to logical ones, inside string literals only. v2 (PR-05) also decides
 * the cases v1 left to a person: every colour family, `dark:` classes, `rtl:`/`ltr:`
 * variants and hand-made `isRTL` ternaries. The decision rules are rulings 15 and 16
 * in docs/features/UI_Design_System_Enhace/PLAN_PR-05.md. Anything still unsafe is
 * printed with file:line and left unchanged.
 *
 * Usage: node scripts/ui/codemod-classes.js <dir|file>... [--write]
 * Without --write it only reports.
 */
const fs = require('fs')
const path = require('path')

// ---------------------------------------------------------------- colours

const NEUTRALS = new Set(['gray', 'slate', 'zinc', 'neutral', 'stone'])
const ACCENTS = new Set(['blue', 'sky', 'cyan', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'teal'])
const STATUS = { green: 'success', emerald: 'success', lime: 'success', red: 'danger', rose: 'danger', yellow: 'warning', amber: 'warning', orange: 'warning' }
const SOLID = { success: 'success', warning: 'warning', danger: 'destructive' }
const COLORS = 'white|black|gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'
const KINDS = 'bg|text|border(?:-[xytrblse])?|ring-offset|ring|from|via|to|divide|placeholder|outline|fill|stroke|decoration|shadow|accent|caret'
const PALETTE = new RegExp(`^(${KINDS})-(${COLORS})(?:-(\\d{2,3}))?$`)
const ACCENT_RE = [...ACCENTS].join('|')
const NEUTRAL_RE = [...NEUTRALS].join('|')
// Context in the same literal; only unprefixed classes count, so `hover:bg-x` is not "the fill".
const B = String.raw`(?:^|[\s'"\x60])`
const CTX = {
  primary: new RegExp(`${B}(?:bg-(?:primary|(?:${ACCENT_RE})-(?:[5-9]00|950))|from-(?:${ACCENT_RE})-[4-9]00)(?![\\w-])`),
  red: new RegExp(`${B}bg-(?:destructive|(?:red|rose)-(?:[5-9]00|950))(?![\\w-])`),
  warning: new RegExp(`${B}bg-(?:warning|(?:yellow|amber|orange)-(?:[4-9]00|950))(?![\\w-])`),
  dark: new RegExp(`${B}bg-(?:foreground|black|(?:${NEUTRAL_RE})-(?:[7-9]00|950))(?![\\w-])`),
  solid: new RegExp(`${B}(?:bg|from)-(?:primary|destructive|success|warning|info|foreground|black|[a-z]+-(?:[5-9]00|950))(?![\\w-])`),
  info: new RegExp(`${B}bg-(?:info-bg|(?:${ACCENT_RE})-(?:50|100|200))(?![\\w-])`),
}
/** Tailwind class kind -> rule group. */
function roleOf(kind) {
  if (kind === 'bg' || kind === 'from' || kind === 'via' || kind === 'to') return 'bg'
  if (kind === 'text' || kind === 'placeholder') return 'text'
  if (kind.startsWith('border') || kind === 'divide' || kind === 'outline') return 'line'
  if (kind === 'ring') return 'ring'
  if (kind === 'ring-offset') return 'offset'
  if (kind === 'shadow') return 'shadow'
  return 'glyph'
}

/**
 * Token colour name for a raw palette class (ruling 15), 'KEEP' for allowed black, or null.
 * @param {{kind: string, color: string, n: number, variants: string[], literal: string, opacity: string}} c
 */
function colorFor({ kind, color, n, variants, literal, opacity }) {
  const role = roleOf(kind)
  const hover = variants.some((v) => /(^|-)(hover|active)$/.test(v))
  const focus = variants.some((v) => /(^|-)focus(-within|-visible)?$/.test(v))
  const gradient = kind === 'from' || kind === 'via' || kind === 'to'
  if (kind === 'placeholder' && color !== 'white') return 'muted-foreground'
  if (role === 'offset') return 'background'

  if (color === 'black') return role === 'text' ? 'foreground' : 'KEEP'
  if (color === 'white') {
    if (role === 'text') {
      if (CTX.primary.test(literal)) return 'primary-foreground'
      if (CTX.red.test(literal)) return 'destructive-foreground'
      if (CTX.warning.test(literal)) return 'warning-foreground'
      if (CTX.dark.test(literal)) return 'background'
      return 'on-solid'
    }
    if (role === 'bg') return opacity && Number(opacity.slice(1)) < 60 && !/backdrop-blur/.test(literal) ? 'on-solid' : 'card'
    if (role === 'line') return opacity ? 'on-solid' : 'card'
    if (role === 'ring') return 'card'
    return 'on-solid'
  }

  if (NEUTRALS.has(color)) {
    if (role === 'bg') {
      if (hover) return n <= 100 ? 'muted' : n <= 400 ? 'border' : n <= 600 ? 'muted-foreground' : 'foreground/90'
      return n <= 200 ? 'muted' : n <= 400 ? 'border' : n <= 600 ? 'muted-foreground' : 'foreground'
    }
    if (role === 'text') {
      if (CTX.dark.test(literal) && n <= 500) return n <= 200 ? 'background' : 'background/70'
      return n <= 600 ? 'muted-foreground' : 'foreground'
    }
    if (role === 'line') return n <= 300 ? 'border' : n <= 600 ? 'muted-foreground' : 'foreground'
    if (role === 'ring') return n <= 300 ? 'border' : 'ring'
    if (role === 'shadow') return 'foreground/10'
    return n <= 300 ? 'border' : n <= 700 ? 'muted-foreground' : 'foreground'
  }

  if (ACCENTS.has(color)) {
    if (role === 'bg') {
      if (n <= 200) return hover && n >= 100 ? 'info-border/50' : 'info-bg'
      if (n <= 400) return gradient ? 'primary/70' : 'info-border'
      return hover || n >= 700 ? 'primary-hover' : 'primary'
    }
    if (role === 'text') {
      if (n <= 200) return CTX.solid.test(literal) ? 'primary-foreground/80' : 'info-text'
      return CTX.info.test(literal) ? 'info-text' : 'primary-text'
    }
    if (role === 'line') return n <= 300 ? 'info-border' : focus ? 'ring' : 'primary'
    if (role === 'ring') return 'ring'
    if (role === 'shadow') return 'primary/20'
    return n <= 200 ? 'info-bg' : 'primary'
  }

  const t = STATUS[color]
  if (!t) return null
  const solid = SOLID[t]
  if (role === 'bg') {
    if (n <= 200) return hover && n >= 100 ? `${t}-border/50` : `${t}-bg`
    if (n <= 400) return gradient ? `${solid}/70` : `${t}-border`
    return hover ? `${solid}/90` : solid
  }
  if (role === 'text') return n <= 200 && CTX.solid.test(literal) ? 'on-solid/80' : `${t}-text`
  if (role === 'line') return n <= 300 ? `${t}-border` : solid
  if (role === 'ring') return solid
  if (role === 'shadow') return `${solid}/20`
  return n <= 200 ? `${t}-bg` : solid
}

/** Raw palette class (no variants) -> token class, 'KEEP' (allowed as is), or null. */
function mapPalette(base, variants, literal, opacity) {
  const m = base.match(PALETTE)
  if (!m) return null
  const [, kind, color, shade] = m
  const name = colorFor({ kind, color, n: shade ? Number(shade) : 500, variants, literal, opacity })
  if (!name || name === 'KEEP') return name
  const side = variants.includes('rtl') ? SIDE_RTL : SIDE
  const prefix = kind === 'placeholder' ? 'placeholder:text' : /^border-[lr]$/.test(kind) ? `border-${side[kind.slice(-1)]}` : kind
  // The class's own opacity wins over the rule's default one.
  return `${prefix}-${opacity ? name.replace(/\/\d+$/, '') : name}`
}

// Arbitrary `[rgb(var(--cmx-X-rgb …))]` with an exact @theme twin (app/globals.css).
const ARB_TOKENS = {
  background: 'background', foreground: 'foreground', surface: 'surface', 'surface-muted': 'surface-muted', card: 'card',
  'surface-elevated': 'popover', muted: 'muted', 'muted-foreground': 'muted-foreground', border: 'border', 'focus-ring': 'ring',
  primary: 'primary', 'primary-fg': 'primary-foreground', 'primary-hover': 'primary-hover', 'primary-text': 'primary-text',
  'primary-bg': 'primary-bg', 'secondary-bg': 'secondary', 'secondary-fg': 'secondary-foreground', 'ghost-hover-bg': 'accent',
  destructive: 'destructive', success: 'success', warning: 'warning', info: 'info',
  'brand-secondary': 'brand-secondary', 'brand-secondary-fg': 'brand-secondary-foreground',
}
for (const t of ['success', 'warning', 'info', 'danger']) for (const p of ['bg', 'border', 'text']) ARB_TOKENS[`${t}-${p}`] = `${t}-${p}`
const ARB = new RegExp(String.raw`((?:[\w-]+:)*!?)(${KINDS})-\[rgb\(var\(--cmx-([a-z0-9-]+)-rgb(?:,[\w.]+)*\)(?:_?\/_?(0?\.\d+|1))?\)\](\/\d+)?(?![\w\]-])`, 'g')

/** Arbitrary --cmx colour classes -> theme classes, inside one literal's text. */
function mapArbitrary(text) {
  let n = 0
  const out = text.replace(ARB, (all, pre, kind, name, alpha, op) => {
    const token = ARB_TOKENS[name]
    if (!token) return all
    n++
    const pct = alpha ? Math.round(Number(alpha) * 1000) / 10 : null
    const suffix = op || (pct === null || pct === 100 ? '' : Number.isInteger(pct) ? `/${pct}` : `/[${alpha}]`)
    return `${pre}${kind}-${token}${suffix}`
  })
  return { out, n }
}

// ---------------------------------------------------------------- direction

const SIZE = '(?:\\d+(?:\\.\\d+)?|px|auto|full|\\d+\\/\\d+|\\[[^\\]]+\\])'
const RADIUS = '(?:-(?:none|sm|md|lg|xl|2xl|3xl|full|\\[[^\\]]+\\]))?'
const SIDE = { l: 's', r: 'e', left: 'start', right: 'end', tl: 'ss', tr: 'se', bl: 'es', br: 'ee' }
// Under `rtl:` left is the end side and right the start side.
const SIDE_RTL = { l: 'e', r: 's', left: 'end', right: 'start', tl: 'se', tr: 'ss', bl: 'ee', br: 'es' }

/** Physical-direction class (no variants) -> logical class, or null. */
function mapDirection(base, side = SIDE) {
  let m
  if ((m = base.match(new RegExp(`^(-?)([mp])([lr])-(${SIZE})$`)))) return `${m[1]}${m[2]}${side[m[3]]}-${m[4]}`
  if ((m = base.match(new RegExp(`^(-?)(left|right)-(${SIZE})$`)))) return `${m[1]}${side[m[2]]}-${m[3]}`
  if ((m = base.match(new RegExp(`^rounded-(l|r|tl|tr|bl|br)(${RADIUS})$`)))) return `rounded-${side[m[1]]}${m[2]}`
  if ((m = base.match(/^border-(l|r)(-.+)?$/))) return `border-${side[m[1]]}${m[2] || ''}`
  if ((m = base.match(/^(text|float|clear)-(left|right)$/))) return `${m[1]}-${side[m[2]]}`
  return null
}

// A class whose only job is direction or alignment; branches that differ only in these are mirrors.
const DIRECTIONAL = new RegExp([
  String.raw`^-?[mp][lrse]-`, String.raw`^-?(?:left|right|start|end|inset-x)-`,
  String.raw`^text-(?:left|right|start|end|center|justify)$`, String.raw`^(?:float|clear)-`,
  String.raw`^rounded-(?:l|r|s|e|tl|tr|bl|br|ss|se|es|ee)(?:-|$)`, String.raw`^border-(?:l|r|s|e)(?:-|$)`,
  String.raw`^flex-row(?:-reverse)?$`, String.raw`^(?:space|divide)-x-`,
  String.raw`^justify-(?:start|end|center|between|around|evenly)$`,
  String.raw`^(?:items|self|content|justify-items|justify-self|place-items|place-self)-(?:start|end|center|baseline|stretch|auto)$`,
  String.raw`^-?(?:rotate|scale-x|translate-x|skew-x)-`, String.raw`^origin-`, String.raw`^order-`,
  // Reverse helpers and a forced direction: the page's own dir already does this.
  String.raw`^(?:space|divide)-y-reverse$`, String.raw`^\[direction:(?:rtl|ltr)\]$`,
].join('|'))
// Direction classes with no logical twin: they keep working only as an explicit rtl:/ltr: variant.
const FLIP = /^-?(?:rotate|scale-x|translate-x|skew-x)-|^origin-(?:.*-)?(?:left|right)$/
// Strips variants (`sm:`, `[&>svg]:`) but not the colon inside an arbitrary property like `[direction:rtl]`.
const baseOf = (t) => t.replace(/^(?:(?:\[[^\]]*\]|[^:[\s]+):)*/, '').replace(/^!/, '')
const words = (s) => s.split(/\s+/).filter(Boolean)

/**
 * Collapses an RTL ternary (ruling 16): the English branch is the design.
 * @returns the classes to keep, or null when the branches differ in more than direction.
 */
function collapse(ltr, rtl) {
  const ls = words(ltr), rs = words(rtl)
  const diff = [...ls.filter((t) => !rs.includes(t)), ...rs.filter((t) => !ls.includes(t))]
  if (diff.some((t) => !DIRECTIONAL.test(baseOf(t)))) return null
  const out = ls.map((t) => (FLIP.test(baseOf(t)) && !rs.includes(t) ? `ltr:${t}` : t))
  for (const t of rs) if (!ls.includes(t) && FLIP.test(baseOf(t))) out.push(`rtl:${t}`)
  return out.join(' ')
}

const Q = String.raw`(?:'([^'\n]*)'|"([^"\n]*)")`
// A ternary branch may also be undefined/null (no class).
const QN = String.raw`(?:'([^'\n]*)'|"([^"\n]*)"|\b(undefined|null)\b)`
const TERNARY = new RegExp(String.raw`(\$\{\s*)?(!?)\b(?:isRTL|isRtl)(?:\(\))?\s*\?\s*${QN}\s*:\s*${QN}(\s*\})?`, 'g')
const AND = new RegExp(String.raw`(\$\{\s*)?(!?)\b(?:isRTL|isRtl)(?:\(\))?\s*&&\s*${Q}(\s*\})?`, 'g')

/** True when the code just before `at` cannot bind tighter than a conditional (so replacing it keeps the meaning). */
function safeBefore(src, at) {
  const before = src.slice(Math.max(0, at - 40), at).trimEnd()
  if (!before) return true
  if (/(?:=>|\breturn|\$\{)$/.test(before)) return true
  const c = before[before.length - 1]
  if (c === '=') return !/[=!<>]=$/.test(before)
  return '({[,?:'.includes(c)
}
/** True when what follows cannot extend the conditional's last operand. */
function safeAfter(src, at) {
  const m = src.slice(at).match(/^(\s*)(\S?)/)
  return !m[2] || ',)}];:'.includes(m[2]) || m[1].includes('\n')
}

/** Pre-pass: RTL ternaries and `isRTL && '…'`, CmxCopyableCell's physical align, inline textAlign. */
function collapseRtl(src) {
  let n = 0
  const replace = (re, decide) => {
    src = src.replace(re, (...a) => {
      const all = a[0], at = a[a.length - 2]
      const inline = a[1] && a[a.length - 3]
      const start = at + (a[1] && !inline ? a[1].length : 0)
      if (!inline && (!safeBefore(src, start) || !safeAfter(src, at + all.length - (a[a.length - 3] || '').length))) return all
      const r = decide(a)
      if (r === null) return all
      n++
      const q = all.includes('"') && !all.includes("'") ? '"' : "'"
      if (inline) return r.text
      const lead = a[1] || ''
      const tail = a[a.length - 3] || ''
      return `${lead}${r.text === '' && r.empty ? r.empty : `${q}${r.text}${q}`}${tail}`
    })
  }
  replace(TERNARY, (a) => {
    const yes = a[3] ?? a[4] ?? '', no = a[6] ?? a[7] ?? ''
    const nullish = a[5] || a[8]
    if (a[5] && a[8]) return null
    const [rtl, ltr] = a[2] ? [no, yes] : [yes, no]
    const text = collapse(ltr, rtl)
    return text === null ? null : { text, empty: nullish }
  })
  replace(AND, (a) => {
    const cls = a[3] ?? a[4]
    const text = a[2] ? collapse(cls, '') : collapse('', cls)
    return text === null ? null : { text, empty: '\u0001' }
  })
  // CmxCopyableCell already maps align right/left to text-end/text-start, so this ternary mirrored twice.
  src = src.replace(/\s+align=\{\s*(?:isRTL|isRtl)\s*\?\s*(['"])right\1\s*:\s*\1left\1\s*\}/g, (all, q, at) => {
    // The attribute belongs to the last `<CmxCopyableCell` before it when no tag was closed in between
    // (props may contain `Record<string, unknown>`, so "the last `<`" is not enough).
    const open = src.lastIndexOf('<CmxCopyableCell', at)
    if (open < 0 || /\/>|<\/|<[A-Za-z][\w.]*[\s>][^]*?>\s*</.test(src.slice(open + 16, at).replace(/=\{[^}]*\}/g, ''))) return all
    n++
    return ''
  })
  // Only the CSS property: a `textAlign` variable may feed a component prop whose 'right' already means end.
  src = src.replace(/(textAlign\s*:\s*)(?:isRTL|isRtl)\s*\?\s*(['"])(right|left)\2\s*:\s*\2(left|right)\2/g, (all, lead, q, yes, no) => {
    if (yes === no) return all
    n++
    return `${lead}${q}${no === 'left' ? 'start' : 'end'}${q}`
  })
  // A removed `isRTL && '…'` argument disappears from an argument list; elsewhere it becomes `false`.
  src = src.replace(/,\s*\u0001(?=\s*[,)])/g, '').replace(/\u0001\s*,\s*/g, '').replace(/\u0001/g, 'false')
  return { src, n }
}

// ---------------------------------------------------------------- token pass

// Strings and comments in source order; comments are matched only so they are skipped.
const CHUNK = /\/\/[^\n]*|\/\*[\s\S]*?\*\/|`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/g
const TOKEN = /[^\s"'`{}()$,]+/g
const DELETE = '\u0000'

/** True when the literal at `at` is still a branch of an RTL condition the pre-pass left alone. */
function inRtlBranch(src, at) {
  const before = src.slice(Math.max(0, at - 200), at)
  return /\b(?:isRTL|isRtl)(?:\(\))?\s*(?:\?|&&)\s*$/.test(before) ||
    /\b(?:isRTL|isRtl)(?:\(\))?\s*\?\s*(?:'[^'\n]*'|"[^"\n]*")\s*:\s*$/.test(before) ||
    /['"]rtl['"]\s*\?\s*(?:(?:'[^'\n]*'|"[^"\n]*")\s*:\s*)?$/.test(before)
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
      yield { token: t[0], offset, variants: parts, important, base, opacity: op ? op[0] : '', literal: lit, rtl: () => inRtlBranch(src, chunk.index) }
    }
  }
}

/** Mapped class for a token, DELETE to drop it, '' when it is raw but unsafe, null when it is not raw. */
function mapToken({ variants, important, base, opacity, literal, rtl }) {
  const plain = opacity ? base.slice(0, -opacity.length) : base
  if (PALETTE.test(plain)) {
    if (variants.includes('dark')) return DELETE // the tokens already switch in dark mode
    const to = mapPalette(plain, variants, literal, opacity)
    if (to === 'KEEP') return null
    return to ? [...variants, important + to + opacity].join(':') : ''
  }
  const dirVariant = variants.includes('rtl') ? SIDE_RTL : SIDE
  const to = mapDirection(base, dirVariant)
  if (!to) return null
  return rtl() ? '' : [...variants, important + to].join(':')
}

const lineOf = (src, offset) => src.slice(0, offset).split('\n').length

/** Inside one literal: drop rtl:/ltr: classes that repeat a base class or zero a side nothing sets. */
function simplifyVariants(text) {
  const list = words(text)
  const bases = new Set(list.filter((t) => !t.includes(':')))
  const prop = (c) => (c.match(/^-?(m[se]|p[se]|start|end|rounded-[se]{1,2}|border-[se])-/) || [])[1]
  const setProps = new Set([...bases].map(prop).filter(Boolean))
  const aligned = [...bases].some((b) => /^text-(start|end|center|justify|left|right)$/.test(b))
  const drop = new Set()
  const merge = new Map() // `ltr:X` + `rtl:X` -> X
  for (const t of list) {
    // <html dir="rtl"> already mirrors rows; reversing them again restores the English order
    if (/^([\w-]+:)*rtl:([\w-]+:)*(flex-row|space-x|divide-x)-reverse$/.test(t)) { drop.add(t); continue }
    const m = t.match(/^(rtl|ltr):(.+)$/)
    if (!m || !DIRECTIONAL.test(m[2]) || drop.has(t)) continue
    const twin = `${m[1] === 'rtl' ? 'ltr' : 'rtl'}:${m[2]}`
    if (bases.has(m[2])) drop.add(t)
    else if (/-(0|none)$/.test(m[2]) && prop(m[2]) && !setProps.has(prop(m[2]))) drop.add(t) // zeroes a side nothing sets
    else if (m[2] === 'text-start' && !aligned) drop.add(t) // start is the default alignment
    else if (/^(start|end)-auto$/.test(m[2]) && !setProps.has(prop(m[2]))) drop.add(t) // auto is the default inset
    else if (list.includes(twin)) { merge.set(t, m[2]); drop.add(twin) }
  }
  if (!drop.size && !merge.size) return text
  return text
    .replace(/(^|\s)(\S+)(?=\s|$)/g, (all, sp, t) => (drop.has(t) ? '' : merge.has(t) ? sp + merge.get(t) : all))
    .replace(/^\s+(?=\S)/, (s) => (/^\s/.test(text) ? s : ''))
}

/** One step stronger than a token class, for a hover that would otherwise equal its base. */
function stronger(cls) {
  const m = cls.match(/^(bg|text|border)-(.+)$/)
  if (!m || m[2].includes('/')) return null
  const [, kind, name] = m
  if (kind === 'text') {
    if (name === 'muted-foreground') return 'text-foreground'
    return /^(foreground|primary-text|(success|warning|info|danger)-text)$/.test(name) ? `text-${name}/80` : null
  }
  if (kind === 'bg') {
    const map = { card: 'muted', muted: 'border', primary: 'primary-hover', foreground: 'foreground/90' }
    if (map[name]) return `bg-${map[name]}`
    if (/^(success|warning|destructive|info)$/.test(name)) return `bg-${name}/90`
    const tint = name.match(/^(success|warning|info|danger)-bg$/)
    return tint ? `bg-${tint[1]}-border/50` : null
  }
  if (name === 'border') return 'border-muted-foreground'
  return name === 'primary' ? 'border-primary-hover' : null
}

/** Inside one literal: a hover/active/focus class equal to its base class becomes one step stronger. */
function strengthenStates(text) {
  const list = words(text)
  const bases = new Set(list.filter((t) => !t.includes(':')))
  return text.replace(/(^|\s)((?:group-)?(?:hover|active|focus|focus-visible):)(\S+)(?=\s|$)/g, (all, sp, state, cls) => {
    const to = bases.has(cls) && stronger(cls)
    return to ? `${sp}${state}${to}` : all
  })
}

/** Unused `const isRTL = useRTL()` / `locale` and their imports (ruling 16). */
const DECL = /^[ \t]*const (\w+) = (useRTL\(\)|useLocale\(\)|locale === ['"]ar['"]|locale\.startsWith\(['"]ar['"]\)|useMemo\(\(\) => locale === ['"]ar['"], \[locale\]\));?[ \t]*\r?\n/gm

/** End offset of the block that contains `at` (skips strings, templates and comments). */
function blockEnd(src, at) {
  let depth = 0
  const stack = []
  for (let i = at; i < src.length; i++) {
    const c = src[i]
    const mode = stack[stack.length - 1]
    if (mode === '`') {
      if (c === '\\') i++
      else if (c === '`') stack.pop()
      else if (c === '$' && src[i + 1] === '{') { stack.push('{'); i++ }
      continue
    }
    if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); if (i < 0) return src.length; continue }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2) + 1; if (i <= 0) return src.length; continue }
    if (c === "'" || c === '"') { for (i++; i < src.length && src[i] !== c && src[i] !== '\n'; i++) if (src[i] === '\\') i++; continue }
    if (c === '`') { stack.push('`'); continue }
    if (c === '{') { if (mode === '{') stack.push('{'); else depth++ }
    else if (c === '}') { if (mode === '{') stack.pop(); else if (--depth < 0) return i }
  }
  return src.length
}

function dropUnused(src) {
  for (let again = true; again;) {
    again = false
    for (const m of src.matchAll(DECL)) {
      const end = blockEnd(src, m.index + m[0].length)
      const scope = src.slice(m.index + m[0].length, end)
      if (new RegExp(`\\b${m[1]}\\b`).test(scope)) continue
      src = src.slice(0, m.index) + src.slice(m.index + m[0].length)
      again = true
      break
    }
  }
  for (const name of ['useRTL', 'useLocale']) {
    const imp = new RegExp(String.raw`^import\s*\{([^}]*)\}\s*from\s*(['"][^'"]+['"]);?[ \t]*\r?\n`, 'm')
    const all = [...src.matchAll(new RegExp(imp.source, 'gm'))].find((m) => new RegExp(`\\b${name}\\b`).test(m[1]))
    if (!all) continue
    const rest = src.slice(0, all.index) + src.slice(all.index + all[0].length)
    if (new RegExp(`\\b${name}\\b`).test(rest)) continue
    const names = all[1].split(',').map((s) => s.trim()).filter((s) => s && s !== name)
    const eol = all[0].endsWith('\r\n') ? '\r\n' : '\n'
    const semi = /;[ \t]*\r?\n$/.test(all[0]) ? ';' : ''
    const line = names.length ? `import { ${names.join(', ')} } from ${all[2]}${semi}${eol}` : ''
    src = src.slice(0, all.index) + line + src.slice(all.index + all[0].length)
  }
  return src
}

/** Rewrites what it can; returns the new code, the number of changed classes and the raw classes left. */
// Tailwind v3 `bg-opacity-75` etc. do nothing in v4; the opacity moves onto the colour class.
const LEGACY_OPACITY = /(^|\s)(bg|border|text|ring|divide|placeholder)-opacity-(\d+)(?=\s|$)/g

/** Inside one literal: folds v3 `*-opacity-N` into the colour; a neutral full-screen backdrop becomes black. */
function foldOpacity(text) {
  let n = 0
  const out = text.replace(LEGACY_OPACITY, (all, sp, kind, pct) => {
    const color = new RegExp(String.raw`(^|\s)(${kind}-(?:${COLORS}|current)(?:-\d{2,3})?)(?=\s|$)`)
    const m = text.match(color)
    if (!m) return all
    n++
    const backdrop = kind === 'bg' && /(^|\s)fixed(\s|$)/.test(text) && /(^|\s)inset-0(\s|$)/.test(text) &&
      new RegExp(`^bg-(?:black|${NEUTRAL_RE})`).test(m[2])
    text = text.replace(color, `$1${backdrop ? 'bg-black' : m[2]}/${pct}`)
    return ''
  })
  return { out: n ? text.replace(LEGACY_OPACITY, '') : out, n }
}

/** `className={'x'}` or a template with no `${}` -> `className="x"`, with spaces tidied. */
function tidyClassNames(src) {
  return src.replace(/className=\{(?:'([^'"\n]*)'|"([^"\n]*)"|`([^`$"\n]*)`)\}/g, (all, a, b, c) =>
    `className="${(a ?? b ?? c).trim().replace(/\s+/g, ' ')}"`)
}

function transformSource(input) {
  const pre = collapseRtl(input)
  let folded = 0
  const src = pre.src.replace(CHUNK, (lit) => {
    if (lit.startsWith('//') || lit.startsWith('/*')) return lit
    const f = foldOpacity(lit.slice(1, -1))
    folded += f.n
    return lit[0] + f.out + lit[lit.length - 1]
  })
  let code = '', last = 0, changed = pre.n + folded
  const unmapped = []
  for (const t of tokens(src)) {
    const to = mapToken(t)
    if (to === null) continue
    if (to === '') { unmapped.push({ token: t.token, line: lineOf(src, t.offset) }); continue }
    changed++
    if (to === DELETE) {
      const after = t.offset + t.token.length
      code += src.slice(last, t.offset)
      last = after
      if (src[after] === ' ') last++
      else if (code.endsWith(' ')) code = code.slice(0, -1)
      continue
    }
    code += src.slice(last, t.offset) + to
    last = t.offset + t.token.length
  }
  code += src.slice(last)
  code = code.replace(CHUNK, (lit) => {
    if (lit.startsWith('//') || lit.startsWith('/*')) return lit
    const arb = mapArbitrary(lit)
    changed += arb.n
    return lit[0] + strengthenStates(simplifyVariants(arb.out.slice(1, -1))) + lit[lit.length - 1]
  })
  return { code: tidyClassNames(dropUnused(code)), changed, unmapped }
}

/** Raw classes the guard rejects. Overlay black (`bg-black`, `bg-black/50`) stays black in dark mode on purpose. */
function findRawClasses(src) {
  const out = []
  for (const t of tokens(src)) {
    const to = mapToken({ ...t, rtl: () => false })
    if (to !== null) out.push({ token: t.token, line: lineOf(src, t.offset) })
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
  let total = 0, left = 0, files = 0
  for (const file of args.filter((a) => a !== '--write').flatMap((a) => walk(a))) {
    const src = fs.readFileSync(file, 'utf8')
    const r = transformSource(src)
    if (r.code !== src) files++
    if (write && r.code !== src) fs.writeFileSync(file, r.code)
    total += r.changed
    left += r.unmapped.length
    if (r.changed) console.log(`${file}: ${r.changed} changed`)
    for (const u of r.unmapped) console.log(`  ${file}:${u.line}  ${u.token}  (by hand)`)
  }
  console.log(`${write ? 'Changed' : 'Would change'} ${total} classes in ${files} files; ${left} need a human.`)
}

module.exports = { transformSource, findRawClasses }
