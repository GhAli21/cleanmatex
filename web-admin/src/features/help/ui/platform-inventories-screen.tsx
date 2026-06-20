'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Database, Loader2 } from 'lucide-react'
import { CmxInput } from '@ui/primitives'
import { CmxTabsPanel } from '@ui/navigation'
import { CmxPagination } from '@ui/navigation'
import { CmxEmptyState } from '@ui/data-display'
import { Alert, AlertDescription } from '@ui/primitives'
import type { PlatformInventoryListResponse, PlatformInventoryTab } from '@/lib/platform/platform-inventories-types'

const PAGE_SIZE = 25

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
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? res.statusText)
  }
  return res.json() as Promise<PlatformInventoryListResponse>
}

function InventoryTable({ data }: { data: PlatformInventoryListResponse }) {
  if (data.rows.length === 0) {
    return <CmxEmptyState title="No rows" description="Try a different search or tab." />
  }

  const columns = Object.keys(data.rows[0] ?? {})

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col) => (
              <th key={col} className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {data.rows.map((row, idx) => (
            <tr key={idx} className="hover:bg-gray-50">
              {columns.map((col) => (
                <td key={col} className="px-4 py-2 align-top text-gray-800">
                  {Array.isArray(row[col]) ? (row[col] as string[]).join(', ') || '—' : String(row[col] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 *
 */
export function PlatformInventoriesScreen() {
  const t = useTranslations('help.platformInventories')
  const searchParams = useSearchParams()
  const routeFilter = searchParams.get('route') ?? undefined

  const [activeTab, setActiveTab] = useState<PlatformInventoryTab>('contracts')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<PlatformInventoryListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchInventory({ tab: activeTab, search, route: routeFilter, page })
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [activeTab, search, routeFilter, page])

  useEffect(() => {
    void load()
  }, [load])

  const tabs = useMemo(
    () => [
      { id: 'contracts', label: t('tabs.contracts') },
      { id: 'permissions', label: t('tabs.permissions') },
      { id: 'flags', label: t('tabs.flags') },
      { id: 'navigation', label: t('tabs.navigation') },
      { id: 'summary', label: t('tabs.summary') },
    ],
    [t]
  )

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link href="/dashboard/help" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
          <ArrowLeft className="h-4 w-4" />
          {t('backToHelp')}
        </Link>
      </div>

      <div className="mb-6 flex items-start gap-3">
        <Database className="mt-1 h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-sm text-gray-600">{t('subtitle')}</p>
          {routeFilter ? (
            <p className="mt-1 text-xs text-blue-700">
              {t('routeFilter')}: <span className="font-mono">{routeFilter}</span>
            </p>
          ) : null}
          {data?.meta.generatedAt ? (
            <p className="mt-1 text-xs text-gray-500">
              {t('generatedAt')}: {new Date(data.meta.generatedAt).toLocaleString()}
              {data.meta.gitSha ? ` · ${data.meta.gitSha}` : ''}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mb-4">
        <CmxInput
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchPlaceholder')}
        />
      </div>

      <CmxTabsPanel
        tabs={tabs.map((tab) => ({
          ...tab,
          content: (
            <div className="space-y-4">
              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('loading')}
                </div>
              ) : data ? (
                <>
                  <InventoryTable data={data} />
                  {activeTab !== 'summary' && data.total > PAGE_SIZE ? (
                    <CmxPagination
                      currentPage={page}
                      totalPages={totalPages}
                      pageSize={PAGE_SIZE}
                      totalItems={data.total}
                      onPageChange={setPage}
                      onPageSizeChange={() => undefined}
                      showPageSizeSelector={false}
                    />
                  ) : null}
                </>
              ) : null}
            </div>
          ),
        }))}
        value={activeTab}
        onChange={(tabId) => {
          setActiveTab(tabId as PlatformInventoryTab)
          setPage(1)
        }}
      />
    </div>
  )
}
