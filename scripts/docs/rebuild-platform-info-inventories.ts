#!/usr/bin/env npx tsx
/**
 * Orchestrator for platform info inventories rebuild pipeline.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { generateInventoryViews } from './generate-inventory-views';
import {
  DRIFT_REPORT,
  GENERATED_GATE_MATRIX,
  INVENTORY_OUTPUT,
  KNOWN_EXCEPTIONS,
  REPO_ROOT,
  WEB_ADMIN_INVENTORY_RUNTIME,
} from './inventories/paths';
import { syncWebAdminInventoryRuntimeCopy } from './inventories/sync-runtime-copy';
import {
  loadKnownExceptions,
  runReconcile,
  validateNewDrift,
} from './reconcile-platform-info-inventories';

type Command = 'ingest' | 'extract-delta' | 'reconcile' | 'generate-views' | 'full' | 'validate';

const EXTRACT_SCRIPTS = [
  'docs:extract-permissions',
  'docs:extract-feature-flags',
  'docs:extract-settings',
  'docs:extract-plan-limits',
];

function runNpmScript(script: string): void {
  console.log(`[rebuild] npm run ${script}`);
  execSync(`npm run ${script}`, { cwd: REPO_ROOT, stdio: 'inherit', encoding: 'utf-8' });
}

function runTsx(relativeScript: string): void {
  const scriptPath = path.join(REPO_ROOT, relativeScript);
  console.log(`[rebuild] tsx ${relativeScript}`);
  execSync(`npx tsx ${scriptPath}`, { cwd: REPO_ROOT, stdio: 'inherit', encoding: 'utf-8' });
}

function cmdExtractDelta(): void {
  for (const script of EXTRACT_SCRIPTS) {
    runNpmScript(script);
  }
}

function cmdSyncRuntimeCopy(): void {
  if (!fs.existsSync(INVENTORY_OUTPUT)) {
    throw new Error(`Cannot sync runtime copy — missing ${INVENTORY_OUTPUT}`);
  }
  const dest = syncWebAdminInventoryRuntimeCopy(INVENTORY_OUTPUT);
  console.log(`[rebuild] web-admin runtime copy: ${dest}`);
}

function cmdIngest(): void {
  runTsx('scripts/docs/ingest/index.ts');
}

function cmdReconcile(): void {
  runReconcile();
}

function cmdGenerateViews(): void {
  const outputs = generateInventoryViews();
  for (const out of outputs) {
    console.log(`[rebuild] views written: ${out}`);
  }
}

function cmdFull(): void {
  cmdExtractDelta();
  cmdIngest();
  cmdReconcile();
  cmdGenerateViews();
  cmdSyncRuntimeCopy();
}

function cmdValidate(): void {
  const errors: string[] = [];
  const warnOnly = process.env.PLATFORM_INVENTORIES_WARN_ONLY === '1';

  if (!fs.existsSync(INVENTORY_OUTPUT)) {
    errors.push(`Missing inventory: ${INVENTORY_OUTPUT}`);
  }
  if (!fs.existsSync(WEB_ADMIN_INVENTORY_RUNTIME)) {
    errors.push(`Missing web-admin runtime copy: ${WEB_ADMIN_INVENTORY_RUNTIME} — run full rebuild`);
  }
  if (!fs.existsSync(GENERATED_GATE_MATRIX)) {
    errors.push(`Missing gate matrix: ${GENERATED_GATE_MATRIX}`);
  }
  if (!fs.existsSync(DRIFT_REPORT)) {
    errors.push(`Missing drift report: ${DRIFT_REPORT} — run reconcile`);
  }
  if (!fs.existsSync(KNOWN_EXCEPTIONS)) {
    errors.push(`Missing known exceptions: ${KNOWN_EXCEPTIONS}`);
  }

  if (fs.existsSync(INVENTORY_OUTPUT)) {
    const inventory = JSON.parse(fs.readFileSync(INVENTORY_OUTPUT, 'utf-8')) as {
      counts?: { accessContracts?: number };
    };
    if ((inventory.counts?.accessContracts ?? 0) === 0) {
      errors.push('Inventory has zero access contracts');
    }
  }

  if (errors.length > 0) {
    console.error('[rebuild] validate failed:');
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  if (fs.existsSync(INVENTORY_OUTPUT)) {
    cmdSyncRuntimeCopy();
    const result = runReconcile(INVENTORY_OUTPUT);
    const known = loadKnownExceptions();
    const { newDrift, passed } = validateNewDrift(result, known);

    if (!passed) {
      const msg = `[rebuild] ${newDrift.length} new drift item(s) not in KNOWN_EXCEPTIONS.json`;
      if (warnOnly) {
        console.warn(`${msg} (warn-only — unset PLATFORM_INVENTORIES_WARN_ONLY to fail)`);
        for (const d of newDrift) {
          console.warn(`  - [${d.severity}] ${d.id}: ${d.message}`);
        }
      } else {
        console.error(msg);
        for (const d of newDrift) {
          console.error(`  - [${d.severity}] ${d.id}: ${d.message}`);
        }
        process.exit(1);
      }
    }
  }

  console.log('[rebuild] validate passed');
}

function printUsage(): void {
  console.log(`Usage: tsx scripts/docs/rebuild-platform-info-inventories.ts <command>

Commands:
  ingest          Merge extracts + declarative TS
  extract-delta   Run code extractors
  reconcile       Compare declarative vs scans → DRIFT_REPORT.md
  generate-views  Write GENERATED_GATE_MATRIX.md
  full            extract-delta → ingest → reconcile → generate-views → web-admin runtime copy
  validate        Assert artifacts exist; sync runtime copy; fail on new drift (warn-only with PLATFORM_INVENTORIES_WARN_ONLY=1)
`);
}

function main(): void {
  const command = (process.argv[2] ?? 'full') as Command;

  switch (command) {
    case 'ingest':
      cmdIngest();
      break;
    case 'extract-delta':
      cmdExtractDelta();
      break;
    case 'reconcile':
      cmdReconcile();
      break;
    case 'generate-views':
      cmdGenerateViews();
      break;
    case 'full':
      cmdFull();
      break;
    case 'validate':
      cmdValidate();
      break;
    default:
      printUsage();
      process.exit(1);
  }
}

main();
