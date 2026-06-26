import assert from 'node:assert/strict';
import {
  extractResolvedPermissionArray,
  loadGlobalPermissionRegistry,
  parsePermissionObjectsFromSource,
  registryForSource,
  resolvePermissionRef,
} from './resolve-permission-constants';

function testParsePermissionObjects(): void {
  const registry = parsePermissionObjectsFromSource(`
    export const ADMIN_PERMISSIONS = {
      MANAGE: 'admin:manage',
    } as const
  `);
  assert.equal(resolvePermissionRef(registry, 'ADMIN_PERMISSIONS', 'MANAGE'), 'admin:manage');
}

function testExtractResolvedPermissionArray(): void {
  const registry = parsePermissionObjectsFromSource(`
    export const HELP_PERMISSIONS = {
      PLATFORM_INVENTORIES: 'help:platform_inventories',
    } as const
  `);

  const mixed = extractResolvedPermissionArray(
    `permissions: ['orders:read', HELP_PERMISSIONS.PLATFORM_INVENTORIES]`,
    'permissions',
    registry
  );
  assert.deepEqual(mixed.sort(), ['help:platform_inventories', 'orders:read']);
}

function testGlobalRegistryIncludesAdminAndHelp(): void {
  const registry = loadGlobalPermissionRegistry();
  assert.equal(resolvePermissionRef(registry, 'ADMIN_PERMISSIONS', 'MANAGE'), 'admin:manage');
  assert.equal(
    resolvePermissionRef(registry, 'HELP_PERMISSIONS', 'PLATFORM_INVENTORIES'),
    'help:platform_inventories'
  );
  assert.equal(
    resolvePermissionRef(registry, 'PAYMENT_CONFIG_PERMISSIONS', 'VIEW'),
    'payment_config:view'
  );
}

function testNavigationRegistryFromImports(): void {
  const navSnippet = `
    import { ADMIN_PERMISSIONS } from '@/lib/constants/permissions/admin-perm'
    permissions: [ADMIN_PERMISSIONS.MANAGE],
  `;
  const registry = registryForSource(loadGlobalPermissionRegistry(), navSnippet);
  const permissions = extractResolvedPermissionArray(navSnippet, 'permissions', registry);
  assert.deepEqual(permissions, ['admin:manage']);
}

function run(): void {
  testParsePermissionObjects();
  testExtractResolvedPermissionArray();
  testGlobalRegistryIncludesAdminAndHelp();
  testNavigationRegistryFromImports();
  console.log('resolve-permission-constants.test.ts: all passed');
}

run();
