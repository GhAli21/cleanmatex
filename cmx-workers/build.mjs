// Bundles the worker into dist/main.js (DESIGN §18.4 I5: no TypeScript loader at runtime).
// npm packages stay external and load from node_modules; workspace TypeScript (@cmx/jobs) and the
// web-admin services the reactions run are bundled.
//   node build.mjs          → dist/main.js
//   node build.mjs --test   → dist-test/*.test.js, same settings, so tests run what ships
import { build } from 'esbuild';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const forTests = process.argv.includes('--test');

const shared = {
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  packages: 'external',
  // web-admin files resolve `@/...` through web-admin/tsconfig.json (esbuild reads the nearest tsconfig).
  alias: {
    '@cmx/jobs': here('../packages/jobs/src/index.ts'),
    // `server-only` guards Next.js client bundles; a plain Node process has no client side.
    'server-only': here('./src/stubs/server-only.ts'),
    // Plain Node's `react` has no `cache` (a React Server export); see the stub.
    react: here('./src/stubs/react.ts'),
    // `next` has no package exports map, so Node's ESM loader needs the file name for its subpaths.
    // Only imported by web-admin modules further down the reaction import chain; never called here.
    'next/headers': 'next/headers.js',
    'next/server': 'next/server.js',
  },
  logLevel: forTests ? 'warning' : 'info',
};

if (forTests) {
  const tests = readdirSync(here('./test')).filter((f) => f.endsWith('.test.ts')).map((f) => here(`./test/${f}`));
  await build({ ...shared, entryPoints: tests, outdir: here('./dist-test') });
} else {
  await build({ ...shared, entryPoints: [here('./src/main.ts')], outfile: here('./dist/main.js') });
}
