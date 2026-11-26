/**
 * Builds @cmx/clock for every consumer:
 *   dist/esm/*.js                  (ESM, one file per module so bundlers tree-shake: web-admin / Next,
 *                                   cmx-workers; temporal-polyfill stays an import, used only by temporal.js)
 *   dist/index.cjs + dist/zod.cjs  (CommonJS bundle with the polyfill inlined: cmx-api / Nest, Jest)
 *   dist/types/*.d.ts              (tsc declarations)
 * temporal-polyfill ships ESM only, so the CommonJS bundle inlines it; Jest and Nest then load it
 * without an ESM transform. zod stays external (peer dependency).
 */
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
rmSync(dist, { recursive: true, force: true });

const common = {
  absWorkingDir: root,
  bundle: true,
  platform: 'neutral',
  target: 'es2020',
  external: ['zod', '@cmx/clock'],
  legalComments: 'inline',
  logLevel: 'warning',
  mainFields: ['module', 'main'],
};

// The zod entry re-uses the main entry at runtime (one polyfill copy, one ClockError class):
// its relative imports resolve to the package itself.
const zodToMain = {
  name: 'zod-entry-uses-main',
  setup(b) {
    b.onResolve({ filter: /^\.\// }, (args) =>
      args.importer.endsWith('zod.ts') ? { path: '@cmx/clock', external: true } : undefined,
    );
  },
};

await build({ ...common, entryPoints: ['src/index.ts'], format: 'cjs', outfile: 'dist/index.cjs' });
await build({ ...common, entryPoints: ['src/zod.ts'], format: 'cjs', outfile: 'dist/zod.cjs', plugins: [zodToMain] });

const sources = readdirSync(join(root, 'src')).filter((f) => f.endsWith('.ts')).map((f) => `src/${f}`);
await build({
  absWorkingDir: root,
  entryPoints: sources,
  bundle: false,
  format: 'esm',
  platform: 'neutral',
  target: 'es2020',
  outdir: 'dist/esm',
  logLevel: 'warning',
});
mkdirSync(join(dist, 'esm'), { recursive: true });
writeFileSync(join(dist, 'esm', 'package.json'), '{ "type": "module", "sideEffects": false }\n');

const require = createRequire(import.meta.url);
const tsc = require.resolve('typescript/bin/tsc');
const result = spawnSync(process.execPath, [tsc, '-p', join(root, 'tsconfig.build.json')], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
console.log('@cmx/clock built');
