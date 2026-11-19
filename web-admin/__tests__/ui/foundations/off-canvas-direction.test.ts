/**
 * Off-canvas panels (sidebar, payment receipt rail) slide off with
 * `ltr:-translate-x-full rtl:translate-x-full`. Tailwind emits the ltr:/rtl:
 * rules after the breakpoint rules, so a `lg:translate-x-0` meant to keep the
 * panel on screen loses and the panel disappears on desktop. The slide must sit
 * under `max-<bp>:` instead (bug found 2026-11-19: sidebar missing on desktop).
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.join(__dirname, '../../..')

function tsxFiles(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) tsxFiles(full, found)
    else if (entry.name.endsWith('.tsx') && !entry.name.endsWith('.stories.tsx')) found.push(full)
  }
  return found
}

test('a direction-based off-canvas slide is never paired with a breakpoint reset', () => {
  const offenders: string[] = []
  for (const dir of ['src', 'app']) {
    for (const file of tsxFiles(path.join(ROOT, dir))) {
      const text = fs.readFileSync(file, 'utf8')
      const bareSlide = /(^|[\s'"`])(ltr|rtl):-?translate-x-full/m.test(text)
      const breakpointReset = /(^|[\s'"`])(sm|md|lg|xl|2xl):translate-x-0/m.test(text)
      if (bareSlide && breakpointReset) offenders.push(path.relative(ROOT, file))
    }
  }
  expect(offenders).toEqual([])
})
