/**
 * Guards new clock mistakes.
 * Migrations at or after 0832 may not add a naive timestamp unless the file says CIVIL:.
 * Those migrations may not read an organization or branch timezone except inside fn_ops_zone.
 * toISOString().slice(0, 10) may not appear in a file outside the frozen list.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = join(import.meta.dirname, '..');
const failures = [];

const frozenSliceFiles = new Set([
  'web-admin/app/api/v1/ar/invoices/export/route.ts',
  'web-admin/lib/commercial/calendar.ts',
  'web-admin/lib/constants/ar-invoice.ts',
  'web-admin/lib/services/ar-invoice.service.ts',
  'web-admin/lib/services/catalog.service.ts',
  'web-admin/lib/services/catalog/speed-rules.service.ts',
  'web-admin/lib/services/commercial/calendar-facts.ts',
  'web-admin/lib/services/commercial/commercial-context.loader.ts',
  'web-admin/lib/services/customer-open-balance-query.service.ts',
  'web-admin/lib/services/dunning.service.ts',
  'web-admin/lib/services/erp-lite-periods.service.ts',
  'web-admin/lib/services/erp-lite-v2.service.ts',
  'web-admin/lib/services/finance-expiry-jobs.service.ts',
  'web-admin/lib/services/fx/fx-import-validation.ts',
  'web-admin/lib/services/fx/fx-import.service.ts',
  'web-admin/lib/services/fx/fx-rate-resolver.service.ts',
  'web-admin/lib/services/fx/fx-rate.service.ts',
  'web-admin/lib/services/loyalty.service.ts',
  'web-admin/lib/services/pos-session-rollover.service.ts',
  'web-admin/lib/services/pos-session.service.ts',
  'web-admin/lib/services/pos-shift-report.service.ts',
  'web-admin/lib/services/pos-shift-z-archive.service.ts',
  'web-admin/lib/services/settings/business-calendar.service.ts',
  'web-admin/lib/tax/determine.ts',
  'web-admin/lib/utils/operational-time.ts',
  'web-admin/lib/validations/iso-date.ts',
  'web-admin/scripts/audit-tenant-guard.mjs',
  'web-admin/src/features/ar/ui/ar-invoice-create-wizard.tsx',
  'web-admin/src/features/ar/ui/ar-invoice-detail-actions.tsx',
  'web-admin/src/features/catalog/ui/price-history-timeline.tsx',
  'web-admin/src/features/fx/ui/rate-form-dialog.tsx',
  'web-admin/src/features/reports/ui/financial-reports-client.tsx',
  'web-admin/src/features/reports/ui/reconciliation-reports-client.tsx',
  'web-admin/src/features/settings/tax/ui/tax-setup-client.tsx',
  'web-admin/src/features/tax/ui/tax-code-dialog.tsx',
  'web-admin/src/features/tax/ui/tax-explain-dialog.tsx',
  'web-admin/src/features/tax/ui/tax-review-screen.tsx',
  'web-admin/src/features/tax/ui/tax-rule-dialog.tsx',
  'web-admin/src/ui/data-display/cmx-data-grid.tsx',
  'web-admin/__tests__/db-integration/cash-hardening-tenant-isolation.db.test.ts',
  'web-admin/__tests__/db-integration/pos-shift-report.db.test.ts',
  'web-admin/__tests__/utils/order-number-generator.test.ts',
]);

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const path = join(dir, name);
    const info = statSync(path);
    if (info.isDirectory()) walk(path, out);
    else if (/\.(ts|tsx|js|mjs|dart)$/.test(name)) out.push(path);
  }
}

const migrationDir = join(root, 'supabase', 'migrations');
for (const name of readdirSync(migrationDir)) {
  const match = /^(\d+)_/.exec(name);
  if (!match || Number(match[1]) < 832 || !name.endsWith('.sql')) continue;
  const text = readFileSync(join(migrationDir, name), 'utf8');
  if (/timestamp without time zone/i.test(text) && !text.includes('CIVIL:')) {
    failures.push(`${name} adds a naive timestamp without CIVIL:`);
  }
  const readsZone = /org_tenants_mst\.timezone|org_branches_mst\.timezone_code/.test(text);
  const definesDoor = /CREATE(?: OR REPLACE)? FUNCTION public\.fn_ops_zone\b/.test(text);
  if (readsZone && !definesDoor) {
    failures.push(`${name} reads a timezone column outside fn_ops_zone`);
  }
}

const roots = ['web-admin', 'cmx-api', 'cmx_mobile_apps'];
const slice = /toISOString\(\)\.slice\(\s*0\s*,\s*10\s*\)/;
for (const folder of roots) {
  const base = join(root, folder);
  try {
    statSync(base);
  } catch {
    continue;
  }
  const files = [];
  walk(base, files);
  for (const file of files) {
    const rel = relative(root, file).replaceAll('\\', '/');
    if (frozenSliceFiles.has(rel)) continue;
    const text = readFileSync(file, 'utf8');
    if (slice.test(text)) failures.push(`${rel} uses toISOString().slice(0, 10)`);
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('clock contract ok');
