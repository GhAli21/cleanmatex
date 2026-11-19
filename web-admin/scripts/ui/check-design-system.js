#!/usr/bin/env node
/**
 * Design system checks that ESLint does not cover (rules in docs/dev/rules/cmx-design-system.md).
 * ESLint already blocks raw palette and physical-direction classes and banned imports.
 *
 * Usage (from web-admin):
 *   node scripts/ui/check-design-system.js            changed + untracked files (git)
 *   node scripts/ui/check-design-system.js <path>...  those files or folders
 *   node scripts/ui/check-design-system.js --all      src/ui, src/features, app (debt report)
 * Exit 1 when an error-level finding exists. Warnings never fail.
 * Ignore one line: `cmx-ds-ignore UI00N: <reason>` on that line or the line above (reason required).
 */
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const isFeature = (f) => /^(src\/features|app)\//.test(f)
const isPrint = (f) => /-rprt\.tsx$|\/print\//.test(f)

// [id, level, regex, applies(file), message]
const RULES = [
  ['UI001', 'error', /<(button|input|select|textarea|label)[\s>/]/, isFeature,
    'Raw form element: use CmxButton / CmxInput / CmxSelect(Dropdown) / CmxTextarea / CmxFormField, CmxFieldShell or Label from @ui/primitives.'],
  ['UI001', 'error', /<table[\s>]/, (f) => isFeature(f) && !isPrint(f),
    'Raw <table>: use CmxDataTable / CmxDataGrid (print and -rprt files may use <table>).'],
  ['UI002', 'error', /(^|[^.\w])alert\(|window\.confirm\(|\bshow(Success|Error|Warning|Info)Toast\(|from ['"](sonner|react-hot-toast)['"]/, (f) => !f.startsWith('src/ui/feedback/'),
    'Legacy feedback: use cmxMessage / useMessage() from @ui/feedback, or CmxConfirmDialog.'],
  ['UI003', 'error', /['"`]#[0-9a-fA-F]{3,8}\b/, isFeature,
    'Hex colour: use a theme token class or rgb(var(--cmx-*-rgb)). Data colours (garment colour) need cmx-ds-ignore with a reason.'],
  ['UI004', 'error', /(^|[\s'"`:])dark:/, () => true,
    '`dark:` variant: it follows the device, not the chosen mode. Tokens switch by themselves; else use a [data-mode] selector.'],
  ['UI005', 'error', /(^|[\s'"`:])z-\[([5-9]\d|\d{3,})\]|zIndex:\s*([5-9]\d|\d{3,})\b/, (f) => !f.startsWith('src/ui/'),
    'Page-level arbitrary z-index (50 or more): use the z-index scale (src/ui/foundations/zindex.ts) or a Cmx overlay that already layers itself.'],
  ['UI006', 'error', /-\[(#|(rgb|hsl)a?\((?!\s*var\())/, () => true,
    'Arbitrary colour class: use the token class (bg-card, text-primary-text, ...).'],
  ['UI007', 'error', /\[pageSize,[^\]]*\]\s*=\s*useState\(\s*\d/, isFeature,
    'Hardcoded page size: start from CMX_DEFAULT_PAGE_SIZE (src/ui/data-display/cmx-table-defaults.ts).'],
  ['UI008', 'warn', /[\w"'}]>\s*[^<>{}\n]*[A-Za-z]{2,}[^<>{}\n]*<\//, (f) => f.endsWith('.tsx') && !f.includes('/jhtestui/'),
    'English text in JSX: use a next-intl key in messages/en and messages/ar.'],
]

/** Returns findings for one file's source. `file` is relative to web-admin with forward slashes. */
function scanSource(src, file) {
  const lines = src.split(/\r?\n/)
  const out = []
  lines.forEach((text, i) => {
    const trimmed = text.trim()
    if (/^(\/\/|\*|\/\*)/.test(trimmed)) return
    for (const [rule, level, re, applies, message] of RULES) {
      if (!applies(file) || !re.test(text)) continue
      const ignore = new RegExp(`cmx-ds-ignore ${rule}:\\s*\\S`)
      if (ignore.test(text) || ignore.test(lines[i - 1] || '')) continue
      if (!out.some((f) => f.line === i + 1 && f.rule === rule)) out.push({ rule, level, line: i + 1, message })
    }
  })
  return out
}

const SCOPE = /^(src\/ui|src\/features|app)\/.*\.tsx?$/
const SKIP = /\.(stories|test)\.tsx?$/

function walk(p) {
  if (!fs.existsSync(p)) return []
  if (fs.statSync(p).isFile()) return [p]
  return fs.readdirSync(p).flatMap((n) => walk(path.join(p, n)))
}

function changedFiles() {
  const run = (c) => execSync(c, { encoding: 'utf8' }).split('\n').filter(Boolean)
  return [...run('git diff --name-only --relative HEAD'), ...run('git ls-files --others --exclude-standard')]
}

if (require.main === module) {
  const args = process.argv.slice(2)
  const raw = args.includes('--all') ? ['src/ui', 'src/features', 'app'].flatMap(walk)
    : args.length ? args.flatMap(walk) : changedFiles()
  const files = [...new Set(raw.map((f) => f.split(path.sep).join('/')))]
    .filter((f) => SCOPE.test(f) && !SKIP.test(f) && fs.existsSync(f))
  let errors = 0
  let warns = 0
  for (const f of files) {
    for (const x of scanSource(fs.readFileSync(f, 'utf8'), f)) {
      x.level === 'error' ? errors++ : warns++
      console.log(`${f}:${x.line}  ${x.rule} ${x.level}  ${x.message}`)
    }
  }
  console.log(`\n${files.length} files checked: ${errors} errors, ${warns} warnings.`)
  process.exit(errors ? 1 : 0)
}

module.exports = { scanSource }
