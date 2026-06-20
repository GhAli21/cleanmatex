#!/usr/bin/env npx tsx
/**
 * Phase 1 ingest — merge extracted JSON + declarative TS sources into platform-info-inventory.json.
 * Run: npm run docs:ingest-platform-info
 */

import * as fs from 'fs';
import { bootstrapMissingExtracts } from './bootstrap-extracts';
import { ingestAccessContractsTs } from './ingest-access-contracts-ts';
import { ingestCatalogConstants } from './ingest-catalog-constants';
import { ingestExtractedJson } from './ingest-extracted-json';
import { ingestNavigationTs } from './ingest-navigation-ts';
import { PLATFORM_INFO_INVENTORY_SCHEMA_VERSION, type PlatformInfoInventory } from '../inventories/schema';
import { INVENTORIES_DIR, INVENTORY_OUTPUT } from '../inventories/paths';
import { syncWebAdminInventoryRuntimeCopy } from '../inventories/sync-runtime-copy';
import { resolveGitSha } from './normalize';

function main() {
  const bootstrapped = bootstrapMissingExtracts();
  if (bootstrapped.length > 0) {
    console.log(`[ingest] Bootstrapped extracts: ${bootstrapped.join(', ')}`);
  }

  const extracted = ingestExtractedJson();
  const access = ingestAccessContractsTs();
  const navigation = ingestNavigationTs();
  const catalog = ingestCatalogConstants();

  const sources = [
    ...new Set([
      ...extracted.sources,
      ...access.sources,
      ...navigation.sources,
      ...catalog.sources,
    ]),
  ].sort();

  const inventory: PlatformInfoInventory = {
    schemaVersion: PLATFORM_INFO_INVENTORY_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    gitSha: resolveGitSha(),
    sources,
    counts: {
      permissionUsages: extracted.permissionUsages.length,
      featureFlagUsages: extracted.featureFlagUsages.length,
      settingUsages: extracted.settingUsages.length,
      planLimitUsages: extracted.planLimitUsages.length,
      accessContracts: access.accessContracts.length,
      navigationEntries: navigation.navigationEntries.length,
      flagCatalogEntries: catalog.flagCatalog.length,
    },
    permissionUsages: extracted.permissionUsages,
    featureFlagUsages: extracted.featureFlagUsages,
    settingUsages: extracted.settingUsages,
    planLimitUsages: extracted.planLimitUsages,
    accessContracts: access.accessContracts,
    navigationEntries: navigation.navigationEntries,
    flagCatalog: catalog.flagCatalog,
  };

  fs.mkdirSync(INVENTORIES_DIR, { recursive: true });
  fs.writeFileSync(INVENTORY_OUTPUT, JSON.stringify(inventory, null, 2), 'utf-8');
  const runtimeCopy = syncWebAdminInventoryRuntimeCopy(INVENTORY_OUTPUT);

  console.log('[ingest] Platform info inventory written:');
  console.log(`  path: ${INVENTORY_OUTPUT}`);
  console.log(`  runtime copy: ${runtimeCopy}`);
  console.log(`  accessContracts: ${inventory.counts.accessContracts}`);
  console.log(`  permissionUsages: ${inventory.counts.permissionUsages}`);
  console.log(`  featureFlagUsages: ${inventory.counts.featureFlagUsages}`);
  console.log(`  settingUsages: ${inventory.counts.settingUsages}`);
  console.log(`  planLimitUsages: ${inventory.counts.planLimitUsages}`);
  console.log(`  navigationEntries: ${inventory.counts.navigationEntries}`);
  console.log(`  flagCatalogEntries: ${inventory.counts.flagCatalogEntries}`);

  if (inventory.counts.accessContracts === 0) {
    throw new Error('Ingest produced zero access contracts — check *-access.ts parsing');
  }
  if (inventory.counts.permissionUsages === 0 && inventory.counts.featureFlagUsages === 0) {
    throw new Error('Ingest produced zero permission/flag usages — run extract scripts first');
  }
}

main();
