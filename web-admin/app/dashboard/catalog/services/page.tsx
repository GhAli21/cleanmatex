'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/lib/auth/auth-context'
import { Card, Button, Input, Select, Badge } from '@ui/compat'
import ImportModal from '@features/catalog/ui/import-modal'
import ExportModal from '@features/catalog/ui/export-modal'

interface ProductListItem {
  id: string
  product_code: string
  product_name: string | null
  product_name2: string | null
  service_category_code: string | null
  category_name: string | null
  category_name2: string | null
  default_sell_price: number | null
  default_express_sell_price: number | null
  product_unit: string | null
  is_active: boolean
  created_at: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function ServicesPage() {
  const t = useTranslations('catalog')
  const tCommon = useTranslations('common')
  const { currentTenant } = useAuth()
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<ProductListItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [category, setCategory] = useState<string>('')
  const [showImport, setShowImport] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const isRtl = useMemo(() => typeof document !== 'undefined' && document.dir === 'rtl', [])

  async function load() {
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
      if (search) params.set('search', search)
      if (category) params.set('category', category)
      if (status !== 'all') params.set('status', status)
      params.set('sortBy', 'code')
      params.set('sortOrder', 'asc')

      const res = await fetch(`/api/v1/products?${params.toString()}`)
      const json = await res.json()
      console.log('Products API response:', json)
      if (!res.ok) throw new Error(json?.error || 'Failed to load products')

      console.log('Setting products:', json.data)
      setProducts(json.data || [])
      setPagination((p) => ({ ...p, total: json.pagination.total, totalPages: json.pagination.totalPages }))
    } catch (e: any) {
      setError(e.message || 'Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTenant, pagination.page, pagination.limit])

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPagination((p) => ({ ...p, page: 1 }))
    load()
  }

  function onClearFilters() {
    setSearch('')
    setStatus('all')
    setCategory('')
    setPagination((p) => ({ ...p, page: 1 }))
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('products')}</h1>
        <div className="flex items-center gap-2">
          <Button onClick={() => window.location.assign('/dashboard/catalog/services/new')}>{t('newProduct')}</Button>
          <Button variant="secondary" onClick={() => setShowExport(true)}>
            {t('export')}
          </Button>
          <Button variant="secondary" onClick={() => setShowImport(true)}>
            {tCommon('import')}
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <form onSubmit={onSearchSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Input
            placeholder={t('productName')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            options={[
              { value: 'all', label: t('all') },
              { value: 'active', label: t('standard') },
              { value: 'inactive', label: t('disableCategories') }
            ]}
          />
          <Input
            placeholder={t('category')}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          <div className="flex gap-2">
            <Button type="submit">{t('search')}</Button>
            <Button type="button" variant="secondary" onClick={onClearFilters}>
              {tCommon('clearFilters')}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-4 text-gray-500">{tCommon('loading')}</div>
        ) : products.length === 0 ? (
          <div className="p-4 text-gray-500">{t('noProducts')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-2">{t('productCode')}</th>
                  <th className="px-4 py-2">{t('productName')}</th>
                  <th className="px-4 py-2">{t('category')}</th>
                  <th className="px-4 py-2">{t('price')}</th>
                  <th className="px-4 py-2">{t('unit')}</th>
                  <th className="px-4 py-2">{t('status')}</th>
                  <th className="px-4 py-2">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-4 py-2">{p.product_code}</td>
                    <td className="px-4 py-2">{isRtl ? p.product_name2 || p.product_name : p.product_name}</td>
                    <td className="px-4 py-2">{isRtl ? p.category_name2 || p.category_name : p.category_name}</td>
                    <td className="px-4 py-2">{p.default_sell_price ?? '-'}</td>
                    <td className="px-4 py-2">{p.product_unit ?? '-'}</td>
                    <td className="px-4 py-2">{p.is_active ? <Badge variant="success">{t('standard')}</Badge> : <Badge variant="default">{t('disableCategories')}</Badge>}</td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => window.location.assign(`/dashboard/catalog/services/${p.id}`)}>
                          {t('editProduct')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between p-4">
          <div className="text-sm text-gray-600">
            {pagination.total} / {pagination.totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={pagination.page <= 1}
              onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
            >
              {t('previous')}
            </Button>
            <Button
              variant="secondary"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
            >
              {t('next')}
            </Button>
          </div>
        </div>
      </Card>

      {showImport && <ImportModal onClose={() => { setShowImport(false); load() }} />}
      {showExport && <ExportModal onClose={() => setShowExport(false)} />}
    </div>
  )
}
