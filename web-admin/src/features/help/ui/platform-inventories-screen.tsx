'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  ArrowLeft,
  BookOpen,
  Database,
  Download,
  FilterX,
  Info,
  Loader2,
  Search,
  Shield,
} from 'lucide-react'
import { useDebounce } from '@/lib/hooks/useDebounce'
import { useRTL } from '@/lib/hooks/useRTL'
import { HELP_PERMISSIONS } from '@/lib/constants/help'
import { getPageAccessContractByPath } from '@features/access/page-access-registry'
import { CmxButton } from '@ui/primitives'
import { CmxInput } from '@ui/primitives'
import { Badge } from '@ui/primitives/badge'
import { Alert, AlertDescription } from '@ui/primitives'
import { CmxCard, CmxCardContent } from '@ui/primitives/cmx-card'
import { CmxTabsPanel } from '@ui/navigation'
import { CmxDataTable, type CmxDataTableSimpleColumn } from '@ui/data-display'
import { CmxKpiStatCard } from '@ui/data-display'
import { CmxEmptyState } from '@ui/data-display'
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogFooter,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays'
import { CmxStatusBadge } from '@ui/feedback'
import type {
  PlatformInventoryListResponse,
  PlatformInventoryRow,
  PlatformInventoryTab,
} from '@/lib/platform/platform-inventories-types'

const PAGE_SIZE = 25
const SEARCH_DEBOUNCE_MS = 300

type InventoryRow = Record<string, string | number | string[] | boolean | undefined>

async function fetchInventory(params: {
  tab: PlatformInventoryTab
  search: string
  route?: string
  page: number
}): Promise<PlatformInventoryListResponse> {
  const qs = new URLSearchParams({
    tab: params.tab,
    page: String(params.page),
    pageSize: String(PAGE_SIZE),
  })
  if (params.search) qs.set('search', params.search)
  if (params.route) qs.set('route', params.route)

  const res = await fetch(`/api/dev/platform-inventories?${qs.toString()}`, { credentials: 'include' })
  if (res.status === 403) {
    throw new Error('FORBIDDEN')
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? res.statusText)
  }
  return res.json() as Promise<PlatformInventoryListResponse>
}

function exportRowsCsv(filename: string, rows: InventoryRow[]) {
  if (rows.length === 0) return
  const columns = Object.keys(rows[0] ?? {})
  const escape = (value: unknown) => {
    const text = Array.isArray(value) ? value.join(', ') : String(value ?? '')
    return `"${text.replace(/"/g, '""')}"`
  }
  const lines = [
    columns.join(','),
    ...rows.map((row) => columns.map((col) => escape(row[col])).join(',')),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function ChipList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <span className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">—</span>
  }
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <Badge key={item} variant="secondary" className="font-mono text-[10px]">
          {item}
        </Badge>
      ))}
    </div>
  )
}

function SurfaceBadge({ surface }: { surface: string }) {
  const variant =
    surface === 'api'
      ? 'default'
      : surface === 'screen'
        ? 'secondary'
        : surface === 'hook'
          ? 'outline'
          : 'secondary'
  return (
    <Badge variant={variant} className="text-[10px] uppercase tracking-wide">
      {surface}
    </Badge>
  )
}

function ContractDetailDialog({
  routePattern,
  open,
  onOpenChange,
}: {
  routePattern: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations('help.platformInventories')
  const contract = routePattern ? getPageAccessContractByPath(routePattern) : null

  if (!contract) return null

  return (
    <CmxDialog open={open} onOpenChange={onOpenChange}>
      <CmxDialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <CmxDialogHeader>
          <CmxDialogTitle>{contract.label}</CmxDialogTitle>
        </CmxDialogHeader>
        <div className="space-y-4 text-sm">
          <div className="rounded-lg border border-[rgb(var(--cmx-border-rgb,226_232_240))] bg-[rgb(var(--cmx-muted-rgb,248_250_252))] p-3">
            <p className="font-mono text-xs text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
              {contract.routePattern}
            </p>
          </div>

          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
              {t('contractDialog.pagePermissions')}
            </h4>
            <ChipList items={contract.page.permissions ?? []} />
          </div>

          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
              {t('contractDialog.pageFlags')}
            </h4>
            <ChipList items={contract.page.featureFlags ?? []} />
          </div>

          {contract.actions && Object.keys(contract.actions).length > 0 ? (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                {t('contractDialog.actions')}
              </h4>
              {Object.entries(contract.actions).map(([key, action]) => (
                <div
                  key={key}
                  className="rounded-md border border-[rgb(var(--cmx-border-rgb,226_232_240))] bg-white p-3"
                >
                  <p className="font-medium text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">{action.label}</p>
                  <p className="mt-1 font-mono text-[10px] text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                    {key}
                  </p>
                  <div className="mt-2">
                    <ChipList items={action.requirement.permissions ?? []} />
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {contract.apiDependencies && contract.apiDependencies.length > 0 ? (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                {t('contractDialog.apiDependencies')}
              </h4>
              {contract.apiDependencies.map((dep) => (
                <div
                  key={`${dep.method}-${dep.path}`}
                  className="rounded-md border border-[rgb(var(--cmx-border-rgb,226_232_240))] p-3"
                >
                  <p className="font-medium">{dep.label}</p>
                  <p className="mt-1 font-mono text-xs">
                    {dep.method} {dep.path}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <CmxDialogFooter>
          <CmxButton variant="outline" onClick={() => onOpenChange(false)}>
            {t('contractDialog.close')}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  )
}

/**
 * Platform inventories browser — read-only gating reference for authorized staff.
 */
export function PlatformInventoriesScreen() {
  const t = useTranslations('help.platformInventories')
  const isRTL = useRTL()
  const router = useRouter()
  const searchParams = useSearchParams()

  const routeFilter = searchParams.get('route') ?? undefined
  const initialTab = (searchParams.get('tab') as PlatformInventoryTab | null) ?? (routeFilter ? 'contracts' : 'contracts')
  const initialSearch = searchParams.get('q') ?? ''

  const [activeTab, setActiveTab] = useState<PlatformInventoryTab>(initialTab)
  const [search, setSearch] = useState(initialSearch)
  const debouncedSearch = useDebounce(search, SEARCH_DEBOUNCE_MS)
  const [page, setPage] = useState(1)
  const [data, setData] = useState<PlatformInventoryListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [contractRoute, setContractRoute] = useState<string | null>(null)

  const syncUrl = useCallback(
    (next: { tab?: PlatformInventoryTab; search?: string; route?: string | null }) => {
      const params = new URLSearchParams()
      const tab = next.tab ?? activeTab
      const q = next.search ?? debouncedSearch
      const route = next.route !== undefined ? next.route : routeFilter

      if (tab && tab !== 'contracts') params.set('tab', tab)
      if (q) params.set('q', q)
      if (route) params.set('route', route)

      const qs = params.toString()
      router.replace(qs ? `?${qs}` : '/dashboard/help/platform-inventories', { scroll: false })
    },
    [activeTab, debouncedSearch, routeFilter, router]
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchInventory({
        tab: activeTab,
        search: debouncedSearch,
        route: routeFilter,
        page,
      })
      setData(result)
    } catch (err) {
      if (err instanceof Error && err.message === 'FORBIDDEN') {
        setError(t('errors.forbidden'))
      } else {
        setError(err instanceof Error ? err.message : t('errors.loadFailed'))
      }
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [activeTab, debouncedSearch, routeFilter, page, t])

  useEffect(() => {
    void load()
  }, [load])

  const tabs = useMemo(
    () => [
      { id: 'contracts' as const, label: t('tabs.contracts'), icon: <Shield className="h-4 w-4" /> },
      { id: 'permissions' as const, label: t('tabs.permissions'), icon: <Database className="h-4 w-4" /> },
      { id: 'flags' as const, label: t('tabs.flags') },
      { id: 'navigation' as const, label: t('tabs.navigation') },
      { id: 'settings' as const, label: t('tabs.settings') },
      { id: 'planLimits' as const, label: t('tabs.planLimits') },
      { id: 'flagCatalog' as const, label: t('tabs.flagCatalog') },
      { id: 'drift' as const, label: t('tabs.drift') },
      { id: 'summary' as const, label: t('tabs.summary') },
    ],
    [t]
  )

  const tableRows = useMemo(
    () => (data?.rows ?? []) as InventoryRow[],
    [data?.rows]
  )

  const columns = useMemo((): CmxDataTableSimpleColumn<InventoryRow>[] => {
    switch (activeTab) {
      case 'contracts':
        return [
          {
            key: 'routePattern',
            header: t('columns.routePattern'),
            render: (row) => (
              <button
                type="button"
                className="text-left font-mono text-xs text-[rgb(var(--cmx-primary-rgb,14_165_233))] hover:underline"
                onClick={() => setContractRoute(String(row.routePattern ?? ''))}
              >
                {String(row.routePattern ?? '—')}
              </button>
            ),
          },
          { key: 'label', header: t('columns.label'), render: (row) => String(row.label ?? '—') },
          {
            key: 'permissions',
            header: t('columns.permissions'),
            render: (row) => <ChipList items={(row.permissions as string[]) ?? []} />,
          },
          {
            key: 'featureFlags',
            header: t('columns.featureFlags'),
            render: (row) => <ChipList items={(row.featureFlags as string[]) ?? []} />,
          },
          {
            key: 'actionCount',
            header: t('columns.actions'),
            render: (row) => String(row.actionCount ?? 0),
          },
          {
            key: 'sourceFile',
            header: t('columns.sourceFile'),
            render: (row) => (
              <span className="font-mono text-[10px] text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                {String(row.sourceFile ?? '—')}
              </span>
            ),
          },
        ]
      case 'permissions':
        return [
          {
            key: 'permissionCode',
            header: t('columns.permissionCode'),
            render: (row) => (
              <span className="font-mono text-xs">{String(row.permissionCode ?? '—')}</span>
            ),
          },
          {
            key: 'surface',
            header: t('columns.surface'),
            render: (row) => <SurfaceBadge surface={String(row.surface ?? 'unknown')} />,
          },
          { key: 'file', header: t('columns.file'), render: (row) => <span className="font-mono text-[10px]">{String(row.file ?? '—')}</span> },
          { key: 'line', header: t('columns.line'), render: (row) => String(row.line ?? '—') },
          { key: 'route', header: t('columns.route'), render: (row) => String(row.route ?? '—') },
        ]
      case 'flags':
        return [
          { key: 'flagKey', header: t('columns.flagKey'), render: (row) => <span className="font-mono text-xs">{String(row.flagKey ?? '—')}</span> },
          { key: 'surface', header: t('columns.surface'), render: (row) => <SurfaceBadge surface={String(row.surface ?? 'unknown')} /> },
          { key: 'file', header: t('columns.file'), render: (row) => <span className="font-mono text-[10px]">{String(row.file ?? '—')}</span> },
          { key: 'line', header: t('columns.line'), render: (row) => String(row.line ?? '—') },
          { key: 'context', header: t('columns.context'), render: (row) => String(row.context ?? '—') },
        ]
      case 'navigation':
        return [
          { key: 'path', header: t('columns.path'), render: (row) => <span className="font-mono text-xs">{String(row.path ?? '—')}</span> },
          { key: 'label', header: t('columns.label'), render: (row) => String(row.label ?? '—') },
          { key: 'key', header: t('columns.key'), render: (row) => String(row.key ?? '—') },
          {
            key: 'permissions',
            header: t('columns.permissions'),
            render: (row) => <ChipList items={(row.permissions as string[]) ?? []} />,
          },
          { key: 'featureFlag', header: t('columns.featureFlag'), render: (row) => String(row.featureFlag ?? '—') },
        ]
      case 'settings':
        return [
          { key: 'settingCode', header: t('columns.settingCode'), render: (row) => <span className="font-mono text-xs">{String(row.settingCode ?? '—')}</span> },
          { key: 'surface', header: t('columns.surface'), render: (row) => <SurfaceBadge surface={String(row.surface ?? 'unknown')} /> },
          { key: 'file', header: t('columns.file'), render: (row) => <span className="font-mono text-[10px]">{String(row.file ?? '—')}</span> },
          { key: 'line', header: t('columns.line'), render: (row) => String(row.line ?? '—') },
        ]
      case 'planLimits':
        return [
          { key: 'limitKey', header: t('columns.limitKey'), render: (row) => <span className="font-mono text-xs">{String(row.limitKey ?? '—')}</span> },
          { key: 'surface', header: t('columns.surface'), render: (row) => <SurfaceBadge surface={String(row.surface ?? 'unknown')} /> },
          { key: 'pattern', header: t('columns.pattern'), render: (row) => String(row.pattern ?? '—') },
          { key: 'file', header: t('columns.file'), render: (row) => <span className="font-mono text-[10px]">{String(row.file ?? '—')}</span> },
        ]
      case 'flagCatalog':
        return [
          { key: 'flagKey', header: t('columns.flagKey'), render: (row) => <span className="font-mono text-xs">{String(row.flagKey ?? '—')}</span> },
          { key: 'flagName', header: t('columns.flagName'), render: (row) => String(row.flagName ?? '—') },
          { key: 'planBindingType', header: t('columns.planBindingType'), render: (row) => String(row.planBindingType ?? '—') },
          { key: 'uiGroup', header: t('columns.uiGroup'), render: (row) => String(row.uiGroup ?? '—') },
        ]
      case 'drift':
        return [
          {
            key: 'severity',
            header: t('columns.severity'),
            render: (row) => (
              <CmxStatusBadge
                variant={row.severity === 'error' ? 'error' : 'warning'}
                label={String(row.severity ?? '—')}
              />
            ),
          },
          { key: 'kind', header: t('columns.kind'), render: (row) => String(row.kind ?? '—') },
          { key: 'path', header: t('columns.path'), render: (row) => <span className="font-mono text-xs">{String(row.path ?? '—')}</span> },
          { key: 'message', header: t('columns.message'), render: (row) => String(row.message ?? '—') },
          {
            key: 'isKnownException',
            header: t('columns.knownException'),
            render: (row) =>
              row.isKnownException ? (
                <Badge variant="outline">{t('badges.known')}</Badge>
              ) : (
                <Badge variant="destructive">{t('badges.new')}</Badge>
              ),
          },
        ]
      default:
        return []
    }
  }, [activeTab, t])

  useEffect(() => {
    const tabParam = searchParams.get('tab') as PlatformInventoryTab | null
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam)
    }
  }, [searchParams, activeTab])

  const summaryKpis = useMemo(() => {
    if (!data || activeTab !== 'summary') return []
    return (data.rows as PlatformInventoryRow[]).map((row) => {
      const r = row as { domain: string; count: number; detail: string; tone?: string }
      return r
    })
  }, [activeTab, data])

  const tabContent = (
    <div className="space-y-4">
      {activeTab === 'permissions' ? (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>{t('hints.permissionsTab')}</AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
          <Loader2 className="h-5 w-5 animate-spin text-[rgb(var(--cmx-primary-rgb,14_165_233))]" />
          {t('loading')}
        </div>
      ) : activeTab === 'summary' && summaryKpis.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {summaryKpis.map((item) => (
            <CmxKpiStatCard
              key={item.domain}
              title={item.domain}
              value={item.count > 0 ? item.count : item.detail}
              subtitle={item.count > 0 ? item.detail : undefined}
            />
          ))}
        </div>
      ) : data && tableRows.length > 0 ? (
        <CmxDataTable
          columns={columns}
          data={tableRows}
          currentPage={page}
          pageSize={PAGE_SIZE}
          totalCount={data.total}
          onPageChange={setPage}
          showRowNumbers
          rowNumberOffset={(page - 1) * PAGE_SIZE}
          scrollable
          scrollAreaClassName="max-h-[min(60vh,32rem)]"
          enableZebraStriping
          emptyStateTitle={t('empty.title')}
          emptyStateDescription={t('empty.description')}
        />
      ) : (
        <CmxEmptyState title={t('empty.title')} description={t('empty.description')} />
      )}
    </div>
  )

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className={`mb-6 flex flex-wrap items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <Link
          href="/dashboard/help"
          className="inline-flex items-center gap-1 text-sm text-[rgb(var(--cmx-primary-rgb,14_165_233))] hover:opacity-80"
        >
          <ArrowLeft className={`h-4 w-4 ${isRTL ? 'rotate-180' : ''}`} />
          {t('backToHelp')}
        </Link>
      </div>

      <div className="mb-8 overflow-hidden rounded-2xl border border-[rgb(var(--cmx-border-rgb,226_232_240))] bg-gradient-to-br from-[rgb(var(--cmx-primary-rgb,14_165_233))]/10 via-white to-[rgb(var(--cmx-muted-rgb,248_250_252))] p-6 shadow-sm">
        <div className={`flex flex-wrap items-start justify-between gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className={`flex items-start gap-4 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
            <div className="rounded-xl bg-[rgb(var(--cmx-primary-rgb,14_165_233))]/15 p-3">
              <Database className="h-8 w-8 text-[rgb(var(--cmx-primary-rgb,14_165_233))]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">{t('title')}</h1>
              <p className="mt-1 max-w-2xl text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                {t('subtitle')}
              </p>
              {data?.meta.generatedAt ? (
                <p className="mt-2 text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                  {t('generatedAt')}: {new Date(data.meta.generatedAt).toLocaleString()}
                  {data.meta.gitSha ? ` · ${data.meta.gitSha}` : ''}
                  {data.meta.driftCounts && data.meta.driftCounts.newDrift > 0 ? (
                    <span className="ms-2 text-[rgb(var(--cmx-destructive-rgb,220_38_38))]">
                      · {t('driftBanner', { count: data.meta.driftCounts.newDrift })}
                    </span>
                  ) : null}
                </p>
              ) : null}
            </div>
          </div>
          <div className={`flex flex-wrap gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Link
              href="/dashboard/help"
              className="inline-flex items-center gap-1.5 rounded-md border border-[rgb(var(--cmx-border-rgb,226_232_240))] bg-white px-3 py-1.5 text-xs font-medium hover:bg-[rgb(var(--cmx-muted-rgb,248_250_252))]"
            >
              <BookOpen className="h-4 w-4" />
              {t('userGuide')}
            </Link>
            <CmxButton
              variant="outline"
              size="sm"
              disabled={!data || tableRows.length === 0 || activeTab === 'summary'}
              onClick={() => exportRowsCsv(`platform-inventory-${activeTab}.csv`, tableRows)}
            >
              <Download className="h-4 w-4" />
              {t('exportCsv')}
            </CmxButton>
          </div>
        </div>

        {routeFilter ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-[rgb(var(--cmx-primary-rgb,14_165_233))]/30 bg-white/80 px-3 py-2">
            <FilterX className="h-4 w-4 text-[rgb(var(--cmx-primary-rgb,14_165_233))]" />
            <span className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('routeFilter')}:</span>
            <span className="font-mono text-xs font-medium text-[rgb(var(--cmx-primary-rgb,14_165_233))]">
              {routeFilter}
            </span>
            <CmxButton
              variant="ghost"
              size="sm"
              className="ms-auto h-7 text-xs"
              onClick={() => {
                setPage(1)
                syncUrl({ route: null })
              }}
            >
              {t('clearRouteFilter')}
            </CmxButton>
          </div>
        ) : null}
      </div>

      <CmxCard className="mb-4 border-[rgb(var(--cmx-border-rgb,226_232_240))] shadow-sm">
        <CmxCardContent className="pt-6">
          <div className="relative">
            <Search className={`pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))] ${isRTL ? 'right-3' : 'left-3'}`} />
            <CmxInput
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
                syncUrl({ search: e.target.value })
              }}
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchPlaceholder')}
              className={isRTL ? 'pr-10' : 'pl-10'}
            />
          </div>
        </CmxCardContent>
      </CmxCard>

      <CmxTabsPanel
        tabs={tabs.map((tab) => ({
          ...tab,
          content: tabContent,
        }))}
        value={activeTab}
        onChange={(tabId) => {
          const next = tabId as PlatformInventoryTab
          setActiveTab(next)
          setPage(1)
          syncUrl({ tab: next })
        }}
      />

      <ContractDetailDialog
        routePattern={contractRoute}
        open={contractRoute !== null}
        onOpenChange={(open) => {
          if (!open) setContractRoute(null)
        }}
      />
    </div>
  )
}

export const PLATFORM_INVENTORIES_PERMISSION = HELP_PERMISSIONS.PLATFORM_INVENTORIES
