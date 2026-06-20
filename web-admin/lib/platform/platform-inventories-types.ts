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
}

export interface PlatformInventoryAccessContract {
  routePattern: string
  label: string
  sourceFile: string
  page: {
    permissions?: string[]
    featureFlags?: string[]
  }
  actions?: { actionKey: string; label: string }[]
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

export interface PlatformInventoryFile extends PlatformInventoryMeta {
  accessContracts: PlatformInventoryAccessContract[]
  permissionUsages: PlatformInventoryPermissionUsage[]
  featureFlagUsages: PlatformInventoryFeatureFlagUsage[]
  navigationEntries: PlatformInventoryNavigationEntry[]
}

export type PlatformInventoryTab = 'contracts' | 'permissions' | 'flags' | 'navigation' | 'summary'

export interface PlatformInventoryQuery {
  tab: PlatformInventoryTab
  search?: string
  route?: string
  page?: number
  pageSize?: number
}

export interface PlatformInventoryListResponse {
  meta: PlatformInventoryMeta
  tab: PlatformInventoryTab
  page: number
  pageSize: number
  total: number
  rows: Record<string, string | number | string[] | undefined>[]
}
