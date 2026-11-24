'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useRTL } from '@/lib/hooks/useRTL'
import { useAuth } from '@/lib/auth/auth-context'
import { useHasPermissionCode } from '@/lib/hooks/usePermissions'
import { CmxButton, CmxInput, CmxSelect } from '@ui/primitives'
import { CmxCard } from '@ui/primitives/cmx-card'
import {
  CMX_DEFAULT_PAGE_SIZE,
  CmxDataTable,
  type CmxDataTableSimpleColumn,
} from '@ui/data-display'
import { CmxStatusBadge, CmxSummaryMessage } from '@ui/feedback'
import ImportModal from '@features/catalog/ui/import-modal'
import ExportModal from '@features/catalog/ui/export-modal'
import { CatalogSectionGate } from '@features/catalog/ui/catalog-section-gate'

interface ProductListItem {
  id: string
  product_code: string
  product_name: string | null
  product_name2: string | null
  service_category_code: string | null
  category_name: string | null
  category_name2: string | null
  default_sell_price: number | null
  product_unit: string | null
  base_uom_code?: string | null
  is_active: boolean
  created_at: string
}

type StatusFilter = 'all' | 'active' | 'inactive'

interface AppliedFilters {
  search: string
  status: StatusFilter
  category: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

/**
 * Catalog products & services listing page.
 */
export default function ServicesPage() {
  const router = useRouter()
  const t = useTranslations('catalog')
  const tCommon = useTranslations('common')
  const { currentTenant } = useAuth()
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<ProductListItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: CMX_DEFAULT_PAGE_SIZE,
    total: 0,
    totalPages: 0,
  })
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [category, setCategory] = useState('')
  const [appliedFilters, setAppliedFilters] = useState<AppliedFilters>({
    search: '',
    status: 'all',
    category: '',
  })
  const [reloadTick, setReloadTick] = useState(0)
  const [showImport, setShowImport] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const canCreateProducts = useHasPermissionCode('products:create')
  const canExportProducts = useHasPermissionCode('products:export')
  const isRtl = useRTL()

  const load = useCallback(async () => {
    if (!currentTenant) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('page', String(pagination.page))
      params.set('limit', String(pagination.limit))
      if (appliedFilters.search) params.set('search', appliedFilters.search)
      if (appliedFilters.category) params.set('category', appliedFilters.category)
      if (appliedFilters.status !== 'all') params.set('status', appliedFilters.status)
      params.set('sortBy', 'code')
      params.set('sortOrder', 'asc')

      const res = await fetch(`/api/v1/products?${params.toString()}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || tCommon('error'))

      setProducts(json.data || [])
      setPagination((p) => ({
        ...p,
        total: json.pagination?.total ?? 0,
        totalPages: json.pagination?.totalPages ?? 0,
      }))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : tCommon('error'))
    } finally {
      setLoading(false)
    }
  }, [currentTenant, pagination.page, pagination.limit, appliedFilters, tCommon])

  useEffect(() => {
    void load()
  }, [load, reloadTick])

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPagination((p) => ({ ...p, page: 1 }))
    setAppliedFilters({ search, status, category })
  }

  function onClearFilters() {
    setSearch('')
    setStatus('all')
    setCategory('')
    setPagination((p) => ({ ...p, page: 1 }))
    setAppliedFilters({ search: '', status: 'all', category: '' })
  }

  const columns = useMemo<CmxDataTableSimpleColumn<ProductListItem>[]>(
    () => [
      {
        key: 'product_code',
        header: t('productCode'),
        sortable: false,
        render: (p) => (
          <span className="font-mono" dir="ltr">
            {p.product_code}
          </span>
        ),
      },
      {
        key: 'product_name',
        header: t('productName'),
        sortable: false,
        render: (p) => (isRtl ? p.product_name2 || p.product_name : p.product_name),
      },
      {
        key: 'category',
        header: t('category'),
        sortable: false,
        render: (p) => (isRtl ? p.category_name2 || p.category_name : p.category_name),
      },
      {
        key: 'price',
        header: t('price'),
        align: 'end',
        sortable: false,
        render: (p) => (
          <span className="tabular-nums" dir="ltr">
            {p.default_sell_price ?? '-'}
          </span>
        ),
      },
      {
        key: 'unit',
        header: t('unit'),
        sortable: false,
        render: (p) => <span dir="ltr">{p.base_uom_code ?? p.product_unit ?? '-'}</span>,
      },
      {
        key: 'status',
        header: t('status'),
        sortable: false,
        render: (p) =>
          p.is_active ? (
            <CmxStatusBadge size="sm" tone="success">
              {t('standard')}
            </CmxStatusBadge>
          ) : (
            <CmxStatusBadge size="sm" tone="neutral">
              {t('disableCategories')}
            </CmxStatusBadge>
          ),
      },
      {
        key: 'actions',
        header: t('actions'),
        align: 'end',
        sortable: false,
        render: (p) => (
          <div className="flex justify-end gap-2">
            <CmxButton
              size="sm"
              variant="secondary"
              onClick={() => router.push(`/dashboard/catalog/services/${p.id}`)}
            >
              {t('editProduct')}
            </CmxButton>
          </div>
        ),
      },
    ],
    [t, isRtl, router],
  )

  return (
    <CatalogSectionGate>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">{t('products')}</h1>
          <div className="flex flex-wrap items-center gap-2">
            {canCreateProducts && (
              <CmxButton onClick={() => router.push('/dashboard/catalog/services/new')}>
                {t('newProduct')}
              </CmxButton>
            )}
            {canExportProducts && (
              <CmxButton variant="secondary" onClick={() => setShowExport(true)}>
                {t('export')}
              </CmxButton>
            )}
            {canCreateProducts && (
              <CmxButton variant="secondary" onClick={() => setShowImport(true)}>
                {tCommon('import')}
              </CmxButton>
            )}
          </div>
        </div>

        <CmxCard className="p-4">
          <form onSubmit={onSearchSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <CmxInput
              placeholder={t('productName')}
              aria-label={t('productName')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <CmxSelect
              aria-label={t('status')}
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
              options={[
                { value: 'all', label: t('all') },
                { value: 'active', label: t('standard') },
                { value: 'inactive', label: t('disableCategories') },
              ]}
            />
            <CmxInput
              placeholder={t('category')}
              aria-label={t('category')}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
            <div className="flex gap-2">
              <CmxButton type="submit">{t('search')}</CmxButton>
              <CmxButton type="button" variant="secondary" onClick={onClearFilters}>
                {tCommon('clearFilters')}
              </CmxButton>
            </div>
          </form>
        </CmxCard>

        {error && <CmxSummaryMessage type="error" message={error} />}

        <CmxDataTable
          columns={columns}
          data={products}
          loading={loading}
          currentPage={pagination.page}
          pageSize={pagination.limit}
          total={pagination.total}
          onPageChange={(page) => setPagination((p) => ({ ...p, page }))}
          onPageSizeChange={(limit) => setPagination((p) => ({ ...p, page: 1, limit }))}
          paginationFooter="always"
          emptyStateTitle={t('noProducts')}
        />

        {showImport && (
          <ImportModal
            onClose={() => {
              setShowImport(false)
              setReloadTick((n) => n + 1)
            }}
          />
        )}
        {showExport && <ExportModal onClose={() => setShowExport(false)} />}
      </div>
    </CatalogSectionGate>
  )
}
