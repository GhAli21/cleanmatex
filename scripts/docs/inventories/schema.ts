/**
 * Platform info inventory schema v1.
 * Merged output from ingest adapters — declarative contracts + extracted JSON scans.
 */

export const PLATFORM_INFO_INVENTORY_SCHEMA_VERSION = 1;

export type InventorySurface =
  | 'screen'
  | 'api'
  | 'service'
  | 'server_action'
  | 'navigation'
  | 'hook'
  | 'workflow'
  | 'middleware'
  | 'catalog'
  | 'page_contract'
  | 'unknown';

export type InventoryKind =
  | 'permission_usage'
  | 'feature_flag_usage'
  | 'setting_usage'
  | 'plan_limit_usage'
  | 'access_contract'
  | 'navigation_entry'
  | 'flag_catalog_entry';

export interface InventoryProvenance {
  sourceType: string;
  sourcePath: string;
  extractedAt?: string;
  line?: number;
}

export interface PermissionUsageRecord {
  id: string;
  kind: 'permission_usage';
  permissionCode: string;
  surface: 'screen' | 'api' | 'unknown';
  route?: string;
  file: string;
  line: number;
  component?: string;
  provenance: InventoryProvenance[];
}

export interface FeatureFlagUsageRecord {
  id: string;
  kind: 'feature_flag_usage';
  flagKey: string;
  surface: InventorySurface;
  file: string;
  line: number;
  context?: string;
  provenance: InventoryProvenance[];
}

export interface SettingUsageRecord {
  id: string;
  kind: 'setting_usage';
  settingCode: string;
  surface: InventorySurface;
  file: string;
  line: number;
  context?: string;
  provenance: InventoryProvenance[];
}

export interface PlanLimitUsageRecord {
  id: string;
  kind: 'plan_limit_usage';
  limitKey: string;
  surface: InventorySurface;
  file: string;
  line: number;
  context?: string;
  pattern?: string;
  provenance: InventoryProvenance[];
}

export interface AccessContractActionRecord {
  actionKey: string;
  label: string;
  permissions?: string[];
  permissionPrefixes?: string[];
  featureFlags?: string[];
  workflowRoles?: string[];
  tenantRoles?: string[];
}

export interface AccessContractRecord {
  id: string;
  kind: 'access_contract';
  routePattern: string;
  label: string;
  sourceFile: string;
  page: {
    permissions?: string[];
    permissionPrefixes?: string[];
    featureFlags?: string[];
    workflowRoles?: string[];
    tenantRoles?: string[];
    requireAllPermissions?: boolean;
    requireAllFeatureFlags?: boolean;
  };
  actions?: AccessContractActionRecord[];
  apiDependencyCount?: number;
  provenance: InventoryProvenance[];
}

export interface NavigationEntryRecord {
  id: string;
  kind: 'navigation_entry';
  key: string;
  label: string;
  path: string;
  depth: 'section' | 'child';
  parentKey?: string;
  permissions?: string[];
  featureFlag?: string;
  roles?: string[];
  provenance: InventoryProvenance[];
}

export interface FlagCatalogRecord {
  id: string;
  kind: 'flag_catalog_entry';
  flagKey: string;
  flagName: string;
  planBindingType: string;
  dataType: string;
  governanceCategory?: string;
  uiGroup?: string;
  provenance: InventoryProvenance[];
}

export interface PlatformInfoInventory {
  schemaVersion: number;
  generatedAt: string;
  gitSha?: string;
  sources: string[];
  counts: {
    permissionUsages: number;
    featureFlagUsages: number;
    settingUsages: number;
    planLimitUsages: number;
    accessContracts: number;
    navigationEntries: number;
    flagCatalogEntries: number;
  };
  permissionUsages: PermissionUsageRecord[];
  featureFlagUsages: FeatureFlagUsageRecord[];
  settingUsages: SettingUsageRecord[];
  planLimitUsages: PlanLimitUsageRecord[];
  accessContracts: AccessContractRecord[];
  navigationEntries: NavigationEntryRecord[];
  flagCatalog: FlagCatalogRecord[];
}
