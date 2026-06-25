import fs from 'fs'
import path from 'path'
import bundledInventory from '../../data/platform/platform-info-inventory.json'
import { matchesRoutePattern } from '@/lib/auth/access-contracts'
import type {
  PlatformInventoryFile,
  PlatformInventoryListResponse,
  PlatformInventoryQuery,
  PlatformInventoryRow,
  PlatformInventoryTab,
} from './platform-inventories-types'

const DEFAULT_PAGE_SIZE = 25

/** Paths tried in dev — production uses webpack-bundled JSON (fs paths missing in serverless). */
function resolveInventoryPath(): string | null {
  const cwd = process.cwd()
  const candidates = [
    path.join(cwd, 'data/platform/platform-info-inventory.json'),
    path.join(cwd, '..', 'docs/platform/inventories/platform-info-inventory.json'),
    path.join(cwd, 'docs/platform/inventories/platform-info-inventory.json'),
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  return null
}

let cached: { mtimeMs: number; data: PlatformInventoryFile; filePath: string } | null = null

function loadBundledInventory(): PlatformInventoryFile {
  return bundledInventory as PlatformInventoryFile
}

export function loadPlatformInventory(): PlatformInventoryFile {
  if (process.env.VERCEL === '1' || process.env.NODE_ENV === 'production') {
    return loadBundledInventory()
  }

  const filePath = resolveInventoryPath()
  if (!filePath) {
    return loadBundledInventory()
  }

  const stat = fs.statSync(filePath)
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.filePath === filePath) {
    return cached.data
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as PlatformInventoryFile
  cached = { mtimeMs: stat.mtimeMs, data, filePath }
  return data
}

function matchesSearch(values: (string | undefined)[], search: string): boolean {
  const q = search.trim().toLowerCase()
  if (!q) return true
  return values.some((v) => v?.toLowerCase().includes(q))
}

/** Strict contract route filter (exact pattern or concrete pathname match). */
function contractMatchesRouteFilter(routePattern: string, filter: string): boolean {
  if (routePattern === filter) return true
  return matchesRoutePattern(routePattern, filter)
}

/** Cross-tab route filter for nav paths, file paths, and optional route fields. */
function recordMatchesRouteFilter(
  filter: string,
  record: { route?: string; file: string; path?: string }
): boolean {
  if (record.path) {
    if (record.path === filter || matchesRoutePattern(filter, record.path)) return true
  }
  if (record.route) {
    if (record.route === filter || matchesRoutePattern(filter, record.route)) return true
  }

  const staticSegments = filter
    .split('/')
    .filter(Boolean)
    .filter((seg) => !seg.startsWith('['))

  if (staticSegments.length === 0) return false

  const haystack = `${record.file} ${record.path ?? ''} ${record.route ?? ''}`.toLowerCase()
  return staticSegments.every((seg) => haystack.includes(seg.toLowerCase()))
}

function paginateRows(
  rows: PlatformInventoryRow[],
  page: number,
  pageSize: number
): { total: number; pagedRows: PlatformInventoryRow[] } {
  const total = rows.length
  const start = (page - 1) * pageSize
  return { total, pagedRows: rows.slice(start, start + pageSize) }
}

const VALID_TABS = new Set<PlatformInventoryTab>([
  'contracts',
  'permissions',
  'flags',
  'navigation',
  'settings',
  'planLimits',
  'flagCatalog',
  'drift',
  'summary',
])

export function normalizePlatformInventoryTab(tab: string | undefined): PlatformInventoryTab {
  if (tab && VALID_TABS.has(tab as PlatformInventoryTab)) {
    return tab as PlatformInventoryTab
  }
  return 'contracts'
}

export function queryPlatformInventory(query: PlatformInventoryQuery): PlatformInventoryListResponse {
  const inventory = loadPlatformInventory()
  const page = Math.max(1, query.page ?? 1)
  const pageSize = Math.min(100, Math.max(5, query.pageSize ?? DEFAULT_PAGE_SIZE))
  const search = query.search ?? ''
  const routeFilter = query.route?.trim()

  let rows: PlatformInventoryRow[] = []

  switch (query.tab) {
    case 'contracts': {
      rows = inventory.accessContracts
        .filter((c) => {
          if (routeFilter && !contractMatchesRouteFilter(c.routePattern, routeFilter)) {
            return false
          }
          return matchesSearch(
            [
              c.routePattern,
              c.label,
              ...(c.page.permissions ?? []),
              ...(c.page.featureFlags ?? []),
              c.sourceFile,
            ],
            search
          )
        })
        .map((c) => ({
          routePattern: c.routePattern,
          label: c.label,
          permissions: c.page.permissions ?? [],
          featureFlags: c.page.featureFlags ?? [],
          actionCount: c.actions?.length ?? 0,
          apiDependencyCount: c.apiDependencyCount ?? 0,
          sourceFile: c.sourceFile,
          actionsJson: JSON.stringify(c.actions ?? []),
        }))
      break
    }
    case 'permissions': {
      rows = inventory.permissionUsages
        .filter((p) => {
          if (routeFilter && !recordMatchesRouteFilter(routeFilter, p)) return false
          return matchesSearch(
            [p.permissionCode, p.surface, p.file, p.route, String(p.line)],
            search
          )
        })
        .map((p) => ({
          permissionCode: p.permissionCode,
          surface: p.surface,
          file: p.file,
          line: p.line,
          route: p.route ?? '—',
        }))
      break
    }
    case 'flags': {
      rows = inventory.featureFlagUsages
        .filter((f) => {
          if (routeFilter && !recordMatchesRouteFilter(routeFilter, f)) return false
          return matchesSearch([f.flagKey, f.surface, f.file, f.context, String(f.line)], search)
        })
        .map((f) => ({
          flagKey: f.flagKey,
          surface: f.surface,
          file: f.file,
          line: f.line,
          context: f.context ?? '—',
        }))
      break
    }
    case 'navigation': {
      rows = inventory.navigationEntries
        .filter((n) => {
          if (
            routeFilter &&
            n.path !== routeFilter &&
            !matchesRoutePattern(routeFilter, n.path) &&
            !recordMatchesRouteFilter(routeFilter, { file: n.path, path: n.path })
          ) {
            return false
          }
          return matchesSearch([n.path, n.label, n.key, n.featureFlag, ...(n.permissions ?? [])], search)
        })
        .map((n) => ({
          path: n.path,
          label: n.label,
          key: n.key,
          permissions: n.permissions ?? [],
          featureFlag: n.featureFlag ?? '—',
        }))
      break
    }
    case 'settings': {
      rows = (inventory.settingUsages ?? [])
        .filter((s) => {
          if (routeFilter && !recordMatchesRouteFilter(routeFilter, s)) return false
          return matchesSearch([s.settingCode, s.surface, s.file, s.context, String(s.line)], search)
        })
        .map((s) => ({
          settingCode: s.settingCode,
          surface: s.surface,
          file: s.file,
          line: s.line,
          context: s.context ?? '—',
        }))
      break
    }
    case 'planLimits': {
      rows = (inventory.planLimitUsages ?? [])
        .filter((p) => {
          if (routeFilter && !recordMatchesRouteFilter(routeFilter, p)) return false
          return matchesSearch([p.limitKey, p.surface, p.file, p.pattern, String(p.line)], search)
        })
        .map((p) => ({
          limitKey: p.limitKey,
          surface: p.surface,
          file: p.file,
          line: p.line,
          pattern: p.pattern ?? '—',
        }))
      break
    }
    case 'flagCatalog': {
      rows = (inventory.flagCatalog ?? [])
        .filter((f) =>
          matchesSearch(
            [f.flagKey, f.flagName, f.planBindingType, f.dataType, f.governanceCategory, f.uiGroup],
            search
          )
        )
        .map((f) => ({
          flagKey: f.flagKey,
          flagName: f.flagName,
          planBindingType: f.planBindingType,
          dataType: f.dataType,
          governanceCategory: f.governanceCategory ?? '—',
          uiGroup: f.uiGroup ?? '—',
        }))
      break
    }
    case 'drift': {
      rows = (inventory.driftItems ?? [])
        .filter((d) => matchesSearch([d.id, d.kind, d.severity, d.message, d.path], search))
        .map((d) => ({
          id: d.id,
          kind: d.kind,
          severity: d.severity,
          path: d.path ?? '—',
          message: d.message,
          isKnownException: d.isKnownException ?? false,
        }))
      break
    }
    case 'summary':
    default: {
      const drift = inventory.driftCounts
      rows = [
        { domain: 'Access contracts', count: inventory.counts.accessContracts, detail: '—', tone: 'default' },
        { domain: 'Permission usages', count: inventory.counts.permissionUsages, detail: '—', tone: 'default' },
        { domain: 'Feature flag usages', count: inventory.counts.featureFlagUsages, detail: '—', tone: 'default' },
        { domain: 'Setting usages', count: inventory.counts.settingUsages, detail: '—', tone: 'default' },
        { domain: 'Plan limit usages', count: inventory.counts.planLimitUsages, detail: '—', tone: 'default' },
        { domain: 'Navigation entries', count: inventory.counts.navigationEntries, detail: '—', tone: 'default' },
        { domain: 'Flag catalog entries', count: inventory.counts.flagCatalogEntries, detail: '—', tone: 'default' },
        {
          domain: 'Drift items',
          count: drift?.total ?? inventory.driftItems?.length ?? 0,
          detail: drift ? `${drift.newDrift} new · ${drift.errors} errors` : '—',
          tone: (drift?.newDrift ?? 0) > 0 ? 'danger' : 'success',
        },
        { domain: 'Generated at', count: 0, detail: inventory.generatedAt, tone: 'default' },
        { domain: 'Git SHA', count: 0, detail: inventory.gitSha ?? '—', tone: 'default' },
      ]
      break
    }
  }

  const { total, pagedRows } =
    query.tab === 'summary' ? { total: rows.length, pagedRows: rows } : paginateRows(rows, page, pageSize)

  return {
    meta: {
      schemaVersion: inventory.schemaVersion,
      generatedAt: inventory.generatedAt,
      gitSha: inventory.gitSha,
      counts: inventory.counts,
      driftCounts: inventory.driftCounts,
    },
    tab: query.tab,
    page,
    pageSize,
    total,
    rows: pagedRows,
  }
}

export function getAccessContractFromInventory(routePattern: string) {
  const inventory = loadPlatformInventory()
  return inventory.accessContracts.find((c) => c.routePattern === routePattern) ?? null
}
