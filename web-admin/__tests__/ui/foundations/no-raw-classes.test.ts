import fs from 'node:fs'
import path from 'node:path'

const { findRawClasses } = require('../../../scripts/ui/codemod-classes.js') as {
  findRawClasses: (src: string) => { token: string; line: number }[]
}

const ROOT = path.join(__dirname, '../../..')
/** PR-02 cleaned src/ui; PR-05 cleaned features, pages and lib. All four stay clean. */
const DIRS = ['src/ui', 'src/features', 'app', 'lib']

const files = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return files(p)
    return /\.tsx?$/.test(p) && !/\.(stories\.tsx|d\.ts)$/.test(p) ? [p] : []
  })

const all = DIRS.flatMap((d) => files(path.join(ROOT, d)))
const rel = (f: string) => path.relative(ROOT, f).split(path.sep).join('/')

test('src/ui, src/features, app and lib use theme tokens and logical direction classes only', () => {
  const found = all.flatMap((f) =>
    findRawClasses(fs.readFileSync(f, 'utf8')).map((r) => `${rel(f)}:${r.line} ${r.token}`),
  )
  expect(found).toEqual([])
})

test('no class is chosen by hand on isRTL (the page dir mirrors logical classes)', () => {
  // Class branches only; dir values, locale codes, arrows and Latin-only casing are allowed.
  const handMirror = /\b(?:isRTL|isRtl)(?:\(\))?\s*(?:\?|&&)\s*['"][^'"\n]*\b(?:flex-row-reverse|space-x-reverse|text-(?:left|right|start|end)|[mp][lrse]-\d|rounded-[lrse]|border-[lrse])\b/
  const found = all.flatMap((f) =>
    fs.readFileSync(f, 'utf8').split('\n').flatMap((line, i) => (handMirror.test(line) ? [`${rel(f)}:${i + 1}`] : [])),
  )
  expect(found).toEqual([])
})

test('no logical class under rtl:/ltr: is left that the page dir already handles', () => {
  const doubled = /\b(rtl|ltr):-?(text-(start|end)|start-|end-|[pm][se]-|rounded-[se]|border-[se]\b)/
  const found = all.flatMap((f) =>
    fs.readFileSync(f, 'utf8').split('\n').flatMap((line, i) => (doubled.test(line) ? [`${rel(f)}:${i + 1}`] : [])),
  )
  expect(found).toEqual([])
})
