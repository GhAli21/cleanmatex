#!/usr/bin/env node
/**
 * Validates Workflow Order Advance seed graph SQL file exists and documents
 * how to run checks. Full DB check requires DATABASE_URL after migration 0427.
 *
 * Usage:
 *   node scripts/workflow/check-sys-wf-graph.mjs
 *   node scripts/workflow/check-sys-wf-graph.mjs --sql
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(__dirname, 'check_sys_wf_graph.sql');

if (!fs.existsSync(sqlPath)) {
  console.error('Missing check_sys_wf_graph.sql');
  process.exit(1);
}

if (process.argv.includes('--sql')) {
  console.log(sqlPath);
  process.exit(0);
}

console.log('Workflow graph check SQL ready:', sqlPath);
console.log('After applying supabase/migrations/0427_*.sql, run that SQL against the DB.');
console.log('Any returned rows = FAIL (see check_code column).');
process.exit(0);
