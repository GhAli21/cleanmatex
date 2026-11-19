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
