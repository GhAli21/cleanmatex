export interface PlatformInventoryMeta {
  schemaVersion: number
  generatedAt: string
  gitSha?: string
  counts: {
    accessContracts: number
    permissionUsages: number
    featureFlagUsages: number
    settingUsages: number
    planLimitUsages: number
    navigationEntries: number
    flagCatalogEntries: number
  }
  driftCounts?: {
    errors: number
    warnings: number
    total: number
    newDrift: number
  }
}

export interface PlatformInventoryAccessContract {
  routePattern: string
  label: string
  sourceFile: string
  page: {
    permissions?: string[]
    featureFlags?: string[]
    requireAllPermissions?: boolean
    requireAllFeatureFlags?: boolean
  }
  actions?: { actionKey: string; label: string; permissions?: string[]; featureFlags?: string[] }[]
  apiDependencyCount?: number
}

export interface PlatformInventoryPermissionUsage {
  permissionCode: string
  surface: string
  file: string
  line: number
  route?: string
}

export interface PlatformInventoryFeatureFlagUsage {
  flagKey: string
  surface: string
  file: string
  line: number
  context?: string
}

export interface PlatformInventoryNavigationEntry {
  key: string
  label: string
  path: string
  permissions?: string[]
  featureFlag?: string
}

export interface PlatformInventorySettingUsage {
  settingCode: string
  surface: string
  file: string
  line: number
  context?: string
}

export interface PlatformInventoryPlanLimitUsage {
  limitKey: string
  surface: string
  file: string
  line: number
  pattern?: string
}

export interface PlatformInventoryFlagCatalogEntry {
  flagKey: string
  flagName: string
  planBindingType: string
  dataType: string
  governanceCategory?: string
  uiGroup?: string
}

export interface PlatformInventoryDriftItem {
  id: string
  kind: string
  severity: 'error' | 'warn'
  message: string
  path?: string
  isKnownException?: boolean
}

export interface PlatformInventoryFile extends PlatformInventoryMeta {
  accessContracts: PlatformInventoryAccessContract[]
  permissionUsages: PlatformInventoryPermissionUsage[]
  featureFlagUsages: PlatformInventoryFeatureFlagUsage[]
  navigationEntries: PlatformInventoryNavigationEntry[]
  settingUsages?: PlatformInventorySettingUsage[]
  planLimitUsages?: PlatformInventoryPlanLimitUsage[]
  flagCatalog?: PlatformInventoryFlagCatalogEntry[]
  driftItems?: PlatformInventoryDriftItem[]
}

export type PlatformInventoryTab =
  | 'contracts'
  | 'permissions'
  | 'flags'
  | 'navigation'
  | 'settings'
  | 'planLimits'
  | 'flagCatalog'
  | 'drift'
  | 'summary'

export interface PlatformInventoryQuery {
  tab: PlatformInventoryTab
  search?: string
  route?: string
  page?: number
  pageSize?: number
}

export interface PlatformInventorySummaryRow {
  domain: string
  count: number
  detail: string
  tone?: 'default' | 'success' | 'warning' | 'danger'
}

export type PlatformInventoryRow =
  | Record<string, string | number | string[] | boolean | undefined>
  | PlatformInventorySummaryRow

export interface PlatformInventoryListResponse {
  meta: PlatformInventoryMeta
  tab: PlatformInventoryTab
  page: number
  pageSize: number
  total: number
  rows: PlatformInventoryRow[]
}
