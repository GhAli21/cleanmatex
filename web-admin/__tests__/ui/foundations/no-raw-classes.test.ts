import fs from 'node:fs'
import path from 'node:path'

const { findRawClasses } = require('../../../scripts/ui/codemod-classes.js') as {
  findRawClasses: (src: string) => { token: string; line: number }[]
}

const UI = path.join(__dirname, '../../../src/ui')
/** Deliberate raw classes: `file:token` → why. */
const ALLOWED: Record<string, string> = {
  'overlays/cmx-camera-capture-dialog.tsx:text-white': 'status text over the black camera preview',
}

const files = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return files(p)
    return /\.tsx?$/.test(p) && !/\.(stories\.tsx|d\.ts)$/.test(p) ? [p] : []
  })

test('src/ui uses theme tokens and logical direction classes only', () => {
  const found = files(UI).flatMap((f) => {
    const rel = path.relative(UI, f).split(path.sep).join('/')
    return findRawClasses(fs.readFileSync(f, 'utf8'))
      .filter((r) => !ALLOWED[`${rel}:${r.token}`])
      .map((r) => `${rel}:${r.line} ${r.token}`)
  })
  expect(found).toEqual([])
})

test('src/ui has no logical class under rtl:/ltr: (it would mirror twice)', () => {
  const doubled = /\b(rtl|ltr):-?(text-(start|end)|start-|end-|[pm][se]-|rounded-[se]|border-[se]\b)/
  const found = files(UI).flatMap((f) =>
    fs.readFileSync(f, 'utf8').split('\n').flatMap((line, i) =>
      doubled.test(line) ? [`${path.relative(UI, f).split(path.sep).join('/')}:${i + 1}`] : [],
    ),
  )
  expect(found).toEqual([])
})
