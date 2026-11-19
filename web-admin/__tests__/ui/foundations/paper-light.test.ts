/**
 * PR-07 task 6: every print preview marks its paper `data-mode="LIGHT"`, so it
 * stays light on a dark screen (tokens.css answers to that attribute).
 */
import fs from 'node:fs'
import path from 'node:path'

const FEATURES = path.join(__dirname, '../../../src/features')

function printFiles(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) printFiles(full, found)
    // Paper previews: *-print-rprt.tsx, *-print.tsx, *-print-screen.tsx (not buttons or settings screens).
    else if (/-print(-rprt|-screen)?\.tsx$/.test(entry.name)) found.push(full)
  }
  return found
}

test('every print preview marks its paper light', () => {
  const files = printFiles(FEATURES)
  expect(files.length).toBeGreaterThanOrEqual(11) // the scan really found them
  const missing = files.filter((f) => !fs.readFileSync(f, 'utf8').includes('data-mode="LIGHT"'))
  expect(missing.map((f) => path.relative(FEATURES, f))).toEqual([])
})

test('every app print page marks its paper light', () => {
  const app = path.join(__dirname, '../../../app')
  const pages: string[] = []
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name === 'page.tsx' && path.basename(dir) === 'print') pages.push(full)
    }
  }
  walk(app)
  expect(pages.length).toBeGreaterThanOrEqual(2)
  // A page either marks its own paper or renders a feature print component (guarded by the test above).
  const delegates = /from '@features\/[^']*-print(-rprt|-screen)?'/
  const missing = pages.filter((f) => {
    const text = fs.readFileSync(f, 'utf8')
    return !text.includes('data-mode="LIGHT"') && !delegates.test(text)
  })
  expect(missing.map((f) => path.relative(app, f))).toEqual([])
})

test('light paper sets its own text colour (color inherits as a computed value from a dark body)', () => {
  const css = fs.readFileSync(path.join(__dirname, '../../../app/globals.css'), 'utf8')
  expect(css).toMatch(/\[data-mode=LIGHT\]\s*\{\s*color:\s*rgb\(var\(--cmx-foreground-rgb\)\)/)
})

test('the sign-in page has no fixed white wash or white borders (unreadable in dark mode)', () => {
  const login = fs.readFileSync(path.join(__dirname, '../../../app/(auth)/login/page.tsx'), 'utf8')
  expect(login).not.toMatch(/rgba\(255,\s*255,\s*255/)
  expect(login).not.toMatch(/border-on-solid/)
})
