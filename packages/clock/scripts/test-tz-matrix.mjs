/**
 * Runs the Jest suite once per process time zone (MASTER_PLAN_v2 §7.13): UTC and
 * Pacific/Kiritimati (+14). A result that depends on the machine zone fails one of the runs.
 * Usage: node scripts/test-tz-matrix.mjs [--config <jest config>] [jest args...]
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ZONES = ['UTC', 'Pacific/Kiritimati'];
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const jestBin = require.resolve('jest/bin/jest');
const args = process.argv.slice(2);
const jestArgs = args.length > 0 ? args : ['--config', join(here, '..', 'jest.config.cjs')];

for (const tz of ZONES) {
  console.log(`\n=== jest with TZ=${tz} ===`);
  const run = spawnSync(process.execPath, [jestBin, ...jestArgs], {
    stdio: 'inherit',
    env: { ...process.env, TZ: tz, CMX_EXPECTED_TZ: tz },
  });
  if (run.status !== 0) {
    console.error(`jest failed with TZ=${tz}`);
    process.exit(run.status ?? 1);
  }
}
console.log('\nTZ matrix green:', ZONES.join(', '));
