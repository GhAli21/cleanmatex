/**
 * @jest-environment node
 */
import { execFileSync } from 'node:child_process'
import path from 'node:path'

type Msg = { ruleId: string | null; severity: number; message: string }

const FIXTURES: Record<string, { file: string; code: string }> = {
  uiFeatureImport: { file: 'src/ui/x/fixture.tsx', code: "import a from '@features/a'\nexport const A = a\n" },
  uiCompat: { file: 'src/ui/x/fixture.tsx', code: "import a from '@ui/compat'\nexport const A = a\n" },
  uiClasses: { file: 'src/ui/x/fixture.tsx', code: 'export const A = () => <div className="bg-gray-100 ml-2" />\n' },
  uiClean: { file: 'src/ui/x/fixture.tsx', code: 'export const A = () => <div className="bg-black/50 text-foreground ms-2 border-s" />\n' },
  uiStory: { file: 'src/ui/x/fixture.stories.tsx', code: 'export const A = () => <div className="bg-gray-100 ml-2" />\n' },
  featureClasses: { file: 'src/features/x/fixture.tsx', code: 'export const A = () => <div className={`p-2 ${"text-left"} bg-white`} />\n' },
  appClasses: { file: 'app/x/fixture.tsx', code: 'export const A = () => <div className="text-gray-500 pr-4" />\n' },
  libClasses: { file: 'lib/x/fixture.ts', code: "export const TONE = { DRAFT: 'bg-gray-100 text-gray-800' }\n" },
}

// Jest cannot load the ESM eslint.config.mjs in-process, so ESLint runs once in a child process.
const results: Record<string, Msg[]> = JSON.parse(
  execFileSync(
    process.execPath,
    [
      '-e',
      `const { ESLint } = require('eslint');
       (async () => {
         const eslint = new ESLint();
         const fx = JSON.parse(process.argv[1]);
         const out = {};
         for (const [k, { file, code }] of Object.entries(fx)) {
           const [r] = await eslint.lintText(code, { filePath: file });
           out[k] = r.messages.map(({ ruleId, severity, message }) => ({ ruleId, severity, message }));
         }
         process.stdout.write(JSON.stringify(out));
       })().catch((e) => { console.error(e); process.exit(1); });`,
      JSON.stringify(FIXTURES),
    ],
    { cwd: path.join(__dirname, '../..'), encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
  ),
)

const of = (k: string, rule: string) => results[k].filter((m) => m.ruleId === rule)

describe('ESLint guardrails', () => {
  test('src/ui may not import feature code', () => {
    expect(of('uiFeatureImport', 'no-restricted-imports')).toEqual([expect.objectContaining({ severity: 2 })])
  })

  test('src/ui keeps the global import bans (file-scoped rule replaces the global one)', () => {
    expect(of('uiCompat', 'no-restricted-imports')).toEqual([expect.objectContaining({ severity: 2 })])
  })

  test('raw palette and physical classes are errors in src/ui', () => {
    const msgs = of('uiClasses', 'no-restricted-syntax')
    expect(msgs.map((m) => m.severity)).toEqual([2, 2])
    const text = msgs.map((m) => m.message).join(' ')
    expect(text).toContain('theme token')
    expect(text).toContain('logical')
  })

  test('tokens, logical classes and overlay black pass; stories are exempt', () => {
    expect(of('uiClean', 'no-restricted-syntax')).toEqual([])
    expect(of('uiStory', 'no-restricted-syntax')).toEqual([])
  })

  test('PR-05: the same classes are errors in features, app and lib, also inside template literals', () => {
    for (const k of ['featureClasses', 'appClasses', 'libClasses']) {
      const msgs = of(k, 'no-restricted-syntax')
      expect(msgs.length).toBeGreaterThanOrEqual(1)
      expect(msgs.every((m) => m.severity === 2)).toBe(true)
    }
  })
})
