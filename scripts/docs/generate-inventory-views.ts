#!/usr/bin/env npx tsx
/**
 * Generate human-readable inventory views from platform-info-inventory.json.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { PlatformInfoInventory } from './inventories/schema';
import {
  GENERATED_FEATURE_FLAGS,
  GENERATED_FEATURE_FLAGS_BY_API,
  GENERATED_FEATURE_FLAGS_BY_SCREEN,
  GENERATED_FEATURE_FLAGS_BY_SERVICE,
  GENERATED_GATE_MATRIX,
  GENERATED_PERMISSIONS,
  INVENTORIES_DIR,
  INVENTORY_OUTPUT,
} from './inventories/paths';

const GENERATED_HEADER =
  '> **Do not edit by hand.** Regenerate with `npm run rebuild:platform-info-inventories`.\n';

function groupCount<T>(items: T[], keyFn: (item: T) => string): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = keyFn(item);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return new Map([...map.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}

function mdTable(headers: string[], rows: string[][]): string {
  if (rows.length === 0) {
    return [`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`, `| ${headers.map(() => '—').join(' | ')} |`].join('\n');
  }
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
}

function writeView(filename: string, body: string): void {
  fs.mkdirSync(INVENTORIES_DIR, { recursive: true });
  fs.writeFileSync(filename, body, 'utf-8');
}

function buildGateMatrix(inventory: PlatformInfoInventory): string {
  const sections: string[] = [
    '# GENERATED Gate Matrix',
    '',
    GENERATED_HEADER,
    '',
    `Generated: ${inventory.generatedAt}`,
    inventory.gitSha ? `Git SHA: ${inventory.gitSha}` : '',
    '',
    '## Summary',
    '',
    mdTable(
      ['Domain', 'Count'],
      [
        ['Access contracts', String(inventory.counts.accessContracts)],
        ['Permission usages', String(inventory.counts.permissionUsages)],
        ['Feature flag usages', String(inventory.counts.featureFlagUsages)],
        ['Setting usages', String(inventory.counts.settingUsages)],
        ['Plan limit usages', String(inventory.counts.planLimitUsages ?? 0)],
        ['Navigation entries', String(inventory.counts.navigationEntries)],
        ['Flag catalog entries', String(inventory.counts.flagCatalogEntries)],
      ]
    ),
    '',
    '## Access contracts',
    '',
    mdTable(
      ['Route', 'Label', 'Page permissions', 'Page flags', 'Actions'],
      inventory.accessContracts
        .slice()
        .sort((a, b) => a.routePattern.localeCompare(b.routePattern))
        .map((c) => [
          c.routePattern,
          c.label,
          (c.page.permissions ?? []).join(', ') || '—',
          (c.page.featureFlags ?? []).join(', ') || '—',
          String(c.actions?.length ?? 0),
        ])
    ),
    '',
  ];
  return sections.filter(Boolean).join('\n');
}

function buildPermissionsView(inventory: PlatformInfoInventory): string {
  const bySurface = groupCount(inventory.permissionUsages, (p) => p.surface);
  const rows = inventory.permissionUsages
    .slice()
    .sort((a, b) => a.permissionCode.localeCompare(b.permissionCode))
    .map((p) => [p.permissionCode, p.surface, p.file, String(p.line), p.route ?? '—']);

  return [
    '# GENERATED Permissions',
    '',
    GENERATED_HEADER,
    '',
    `Generated: ${inventory.generatedAt}`,
    '',
    '## By surface (counts)',
    '',
    mdTable(
      ['Surface', 'Count'],
      [...bySurface.entries()].map(([surface, count]) => [surface, String(count)])
    ),
    '',
    '## All permission usages',
    '',
    mdTable(['Permission', 'Surface', 'File', 'Line', 'Route'], rows),
    '',
  ].join('\n');
}

function buildFeatureFlagsView(inventory: PlatformInfoInventory): string {
  const rows = inventory.featureFlagUsages
    .slice()
    .sort((a, b) => a.flagKey.localeCompare(b.flagKey))
    .map((f) => [f.flagKey, f.surface, f.file, String(f.line), f.context ?? '—']);

  return [
    '# GENERATED Feature Flags',
    '',
    GENERATED_HEADER,
    '',
    `Generated: ${inventory.generatedAt}`,
    '',
    mdTable(['Flag key', 'Surface', 'File', 'Line', 'Context'], rows),
    '',
  ].join('\n');
}

function buildFeatureFlagsBySurface(
  inventory: PlatformInfoInventory,
  surface: string,
  title: string
): string {
  const rows = inventory.featureFlagUsages
    .filter((f) => f.surface === surface)
    .sort((a, b) => a.flagKey.localeCompare(b.flagKey))
    .map((f) => [f.flagKey, f.file, String(f.line), f.context ?? '—']);

  return [
    `# ${title}`,
    '',
    GENERATED_HEADER,
    '',
    `Generated: ${inventory.generatedAt}`,
    '',
    mdTable(['Flag key', 'File', 'Line', 'Context'], rows),
    '',
  ].join('\n');
}

export function generateInventoryViews(inventoryPath = INVENTORY_OUTPUT): string[] {
  if (!fs.existsSync(inventoryPath)) {
    throw new Error(`Inventory not found: ${inventoryPath}. Run ingest first.`);
  }

  const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf-8')) as PlatformInfoInventory;
  const outputs: string[] = [];

  writeView(GENERATED_GATE_MATRIX, buildGateMatrix(inventory));
  outputs.push(GENERATED_GATE_MATRIX);

  writeView(GENERATED_PERMISSIONS, buildPermissionsView(inventory));
  outputs.push(GENERATED_PERMISSIONS);

  writeView(GENERATED_FEATURE_FLAGS, buildFeatureFlagsView(inventory));
  outputs.push(GENERATED_FEATURE_FLAGS);

  writeView(
    GENERATED_FEATURE_FLAGS_BY_SCREEN,
    buildFeatureFlagsBySurface(inventory, 'screen', 'GENERATED Feature Flags — Screen')
  );
  outputs.push(GENERATED_FEATURE_FLAGS_BY_SCREEN);

  writeView(
    GENERATED_FEATURE_FLAGS_BY_API,
    buildFeatureFlagsBySurface(inventory, 'api', 'GENERATED Feature Flags — API')
  );
  outputs.push(GENERATED_FEATURE_FLAGS_BY_API);

  writeView(
    GENERATED_FEATURE_FLAGS_BY_SERVICE,
    buildFeatureFlagsBySurface(inventory, 'service', 'GENERATED Feature Flags — Service')
  );
  outputs.push(GENERATED_FEATURE_FLAGS_BY_SERVICE);

  return outputs;
}

function main() {
  const outputs = generateInventoryViews();
  for (const out of outputs) {
    console.log(`Generated: ${out}`);
  }
}

if (require.main === module) {
  main();
}
