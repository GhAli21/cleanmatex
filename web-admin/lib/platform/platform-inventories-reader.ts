import fs from 'fs'
import path from 'path'
import bundledInventory from '../../data/platform/platform-info-inventory.json'
import type {
  PlatformInventoryFile,
  PlatformInventoryListResponse,
  PlatformInventoryQuery,
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
  // Serverless (Vercel): bundled JSON — build-time copy is not on disk at runtime cwd.
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

export function queryPlatformInventory(query: PlatformInventoryQuery): PlatformInventoryListResponse {
  const inventory = loadPlatformInventory()
  const page = Math.max(1, query.page ?? 1)
  const pageSize = Math.min(100, Math.max(5, query.pageSize ?? DEFAULT_PAGE_SIZE))
  const search = query.search ?? ''

  let rows: Record<string, string | number | string[] | undefined>[] = []

  switch (query.tab) {
    case 'contracts': {
      rows = inventory.accessContracts
        .filter((c) => {
          if (query.route && c.routePattern !== query.route && !c.routePattern.includes(query.route)) {
            return false
          }
          return matchesSearch(
            [c.routePattern, c.label, ...(c.page.permissions ?? []), ...(c.page.featureFlags ?? []), c.sourceFile],
            search
          )
        })
        .map((c) => ({
          routePattern: c.routePattern,
          label: c.label,
          permissions: c.page.permissions ?? [],
          featureFlags: c.page.featureFlags ?? [],
          actions: String(c.actions?.length ?? 0),
          sourceFile: c.sourceFile,
        }))
      break
    }
    case 'permissions': {
      rows = inventory.permissionUsages
        .filter((p) =>
          matchesSearch([p.permissionCode, p.surface, p.file, p.route, String(p.line)], search)
        )
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
        .filter((f) => matchesSearch([f.flagKey, f.surface, f.file, f.context, String(f.line)], search))
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
        .filter((n) =>
          matchesSearch([n.path, n.label, n.key, n.featureFlag, ...(n.permissions ?? [])], search)
        )
        .map((n) => ({
          path: n.path,
          label: n.label,
          key: n.key,
          permissions: n.permissions ?? [],
          featureFlag: n.featureFlag ?? '—',
        }))
      break
    }
    case 'summary':
    default: {
      rows = [
        { domain: 'Access contracts', count: inventory.counts.accessContracts, detail: '—' },
        { domain: 'Permission usages', count: inventory.counts.permissionUsages, detail: '—' },
        { domain: 'Feature flag usages', count: inventory.counts.featureFlagUsages, detail: '—' },
        { domain: 'Setting usages', count: inventory.counts.settingUsages, detail: '—' },
        { domain: 'Plan limit usages', count: inventory.counts.planLimitUsages, detail: '—' },
        { domain: 'Navigation entries', count: inventory.counts.navigationEntries, detail: '—' },
        { domain: 'Flag catalog entries', count: inventory.counts.flagCatalogEntries, detail: '—' },
        { domain: 'Generated at', count: 0, detail: inventory.generatedAt },
        { domain: 'Git SHA', count: 0, detail: inventory.gitSha ?? '—' },
      ]
      break
    }
  }

  const total = rows.length
  const start = (page - 1) * pageSize
  const pagedRows = rows.slice(start, start + pageSize)

  return {
    meta: {
      schemaVersion: inventory.schemaVersion,
      generatedAt: inventory.generatedAt,
      gitSha: inventory.gitSha,
      counts: inventory.counts,
    },
    tab: query.tab,
    page,
    pageSize,
    total,
    rows: pagedRows,
  }
}

export function getRouteInventorySlice(routePattern: string) {
  const inventory = loadPlatformInventory()
  const contract = inventory.accessContracts.find((c) => c.routePattern === routePattern)
  const nav = inventory.navigationEntries.filter((n) => n.path === routePattern)
  const permissions = inventory.permissionUsages.filter((p) => p.route === routePattern).slice(0, 10)
  const flags = inventory.featureFlagUsages.filter((f) => f.file.includes('dashboard')).slice(0, 5)

  return { contract, nav, permissions, flags, generatedAt: inventory.generatedAt }
}