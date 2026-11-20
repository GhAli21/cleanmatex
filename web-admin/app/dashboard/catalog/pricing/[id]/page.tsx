'use client'
/* eslint-disable jsdoc/require-jsdoc, jsdoc/require-param */

/**
 * Price List Detail/Edit Page
 * 
 * Features:
 * - View and edit price list settings
 * - Manage price list items (add, edit, delete)
 * - View price history
 * - Bulk import/export
 */

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { CmxButton, CmxCheckbox, CmxInput, CmxSelect, CmxTextarea, Label } from '@ui/primitives'
import { CmxCard } from '@ui/primitives/cmx-card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ui/primitives/table'
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
  CmxDialogFooter,
} from '@ui/overlays'
import { ArrowLeft, Plus, Download, Upload, Edit, Trash2, Save, X, Package } from 'lucide-react'
import type { PriceListWithItems, PriceListItem, PriceListType } from '@/lib/types/catalog'
import { PriceListItemModal } from '@features/catalog/ui/price-list-item-modal'
import { CatalogSectionGate } from '@features/catalog/ui/catalog-section-gate'
import { BulkImportModal } from '@features/catalog/ui/bulk-import-modal'
import { PriceHistoryTimeline } from '@features/catalog/ui/price-history-timeline'
import { cmxMessage, CmxConfirmDialog } from '@ui/feedback'
import { useTenantCurrency } from '@/lib/context/tenant-currency-context'
import { formatMoneyAmountWithCode } from '@/lib/money/format-money'

type TabId = 'items' | 'settings' | 'history'

interface Tab {
  id: TabId
  label: string
  icon: string
}

export default function PriceListDetailPage() {
  const params = useParams()
  const router = useRouter()
  const t = useTranslations('catalog')
  const tPage = useTranslations('catalog.pricingPage')
  const tCommon = useTranslations('common')
  const { formatNumber } = useTenantCurrency()
  const priceListId = params.id as string

  const tabs: Tab[] = [
    { id: 'items', label: tPage('tabItems'), icon: '📦' },
    { id: 'settings', label: tPage('tabSettings'), icon: '⚙️' },
    { id: 'history', label: tPage('tabHistory'), icon: '📜' },
  ]

  // State
  const [priceList, setPriceList] = useState<PriceListWithItems | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabId>('items')
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  // Modal states
  const [itemModalOpen, setItemModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<PriceListItem | null>(null)
  const [bulkImportOpen, setBulkImportOpen] = useState(false)
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null)
  const [deletingItem, setDeletingItem] = useState(false)

  // Form state (for settings tab)
  const [formData, setFormData] = useState<{
    name: string
    name2: string
    description: string
    description2: string
    price_list_type: PriceListType
    effective_from: string
    effective_to: string
    priority: number
    is_default: boolean
    is_active: boolean
  }>({
    name: '',
    name2: '',
    description: '',
    description2: '',
    price_list_type: 'standard',
    effective_from: '',
    effective_to: '',
    priority: 0,
    is_default: false,
    is_active: true,
  })

  // Fetch price list data
  useEffect(() => {
    async function loadPriceList() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/v1/price-lists/${priceListId}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || tPage('loadError'))

        const data = json.data as PriceListWithItems
        setPriceList(data)

        // Initialize form data
        setFormData({
          name: data.name || '',
          name2: data.name2 || '',
          description: data.description || '',
          description2: data.description2 || '',
          price_list_type: data.price_list_type,
          effective_from: data.effective_from ? data.effective_from.split('T')[0] : '',
          effective_to: data.effective_to ? data.effective_to.split('T')[0] : '',
          priority: data.priority || 0,
          is_default: data.is_default || false,
          is_active: data.is_active ?? true,
        })
      } catch (err: any) {
        setError(err.message || tPage('loadError'))
        cmxMessage.error(err.message || tPage('loadError'))
      } finally {
        setLoading(false)
      }
    }

    if (priceListId) {
      loadPriceList()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceListId])

  // Save settings
  async function handleSaveSettings() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/v1/price-lists/${priceListId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || tPage('updateError'))

      setPriceList({ ...priceList!, ...formData } as PriceListWithItems)
      setEditing(false)
      cmxMessage.success(tPage('updateSuccess'))
    } catch (err: any) {
      setError(err.message || tPage('updateError'))
      cmxMessage.error(err.message || tPage('updateError'))
    } finally {
      setSaving(false)
    }
  }

  // Delete item
  async function handleConfirmDeleteItem() {
    if (!deleteItemId) return
    setDeletingItem(true)
    try {
      const res = await fetch(`/api/v1/price-lists/${priceListId}/items/${deleteItemId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json?.error || tPage('deleteItemError'))
      }

      // Reload price list
      const res2 = await fetch(`/api/v1/price-lists/${priceListId}`)
      const json2 = await res2.json()
      if (res2.ok) {
        setPriceList(json2.data)
        cmxMessage.success(tPage('deleteItemSuccess'))
      }
      setDeleteItemId(null)
    } catch (err: any) {
      cmxMessage.error(err.message || tPage('deleteItemError'))
    } finally {
      setDeletingItem(false)
    }
  }

  // Export to CSV
  async function handleExport() {
    try {
      const res = await fetch(`/api/v1/pricing/export?priceListId=${priceListId}`)
      if (!res.ok) throw new Error(tPage('exportError'))

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `price-list-${priceList?.name || 'export'}-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      cmxMessage.success(tPage('exportSuccess'))
    } catch (err: any) {
      cmxMessage.error(err.message || tPage('exportError'))
    }
  }

  // Reload after item operations
  async function reloadPriceList() {
    try {
      const res = await fetch(`/api/v1/price-lists/${priceListId}`)
      const json = await res.json()
      if (res.ok) {
        setPriceList(json.data)
      }
    } catch (err) {
      console.error('Failed to reload:', err)
    }
  }

  if (loading) {
    return (
      <CatalogSectionGate>
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">{tCommon('loading')}</div>
      </div>
      </CatalogSectionGate>
    )
  }

  if (error && !priceList) {
    return (
      <CatalogSectionGate>
      <div className="p-6">
        <div className="rounded-md border border-danger-border bg-danger-bg p-4 text-danger-text">
          {error}
        </div>
        <CmxButton onClick={() => router.push('/dashboard/catalog/pricing')} className="mt-4">
          {tPage('backToPriceLists')}
        </CmxButton>
      </div>
      </CatalogSectionGate>
    )
  }

  if (!priceList) {
    return (
      <CatalogSectionGate>{null}</CatalogSectionGate>
    )
  }

  return (
    <CatalogSectionGate>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <CmxButton
            variant="ghost"
            size="sm"
            aria-label={tPage('backToPriceLists')}
            onClick={() => router.push('/dashboard/catalog/pricing')}
          >
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
          </CmxButton>
          <div>
            <h1 className="text-2xl font-semibold">{priceList.name}</h1>
            {priceList.name2 && (
              <p className="text-sm text-muted-foreground">{priceList.name2}</p>
            )}
          </div>
          <span className={`px-2 py-1 text-xs rounded text-start ${priceList.is_active
            ? 'bg-success-bg text-success-text'
            : 'bg-muted text-foreground'
            }`}>
            {priceList.is_active ? tCommon('active') : tCommon('inactive')}
          </span>
          <span className="px-2 py-1 text-xs rounded text-start bg-info-bg text-info-text">
            {t(priceList.price_list_type)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <CmxButton variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 me-2" />
            {tCommon('export')}
          </CmxButton>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-danger-border bg-danger-bg p-3 text-danger-text">
          {error}
        </div>
      )}

      {/* Tabs */}
      <CmxCard className="p-0 overflow-hidden">
        {/* Tab Navigation */}
        <div className="border-b border-border">
          <nav className="flex -mb-px" role="tablist">
            {tabs.map((tab) => (
              <CmxButton
                key={tab.id}
                type="button"
                variant="ghost"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  rounded-none px-6 py-4 text-sm font-medium border-b-2 transition-colors
                  text-start hover:bg-transparent
                  ${activeTab === tab.id
                    ? 'border-primary text-primary-text'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                  }
                `}
              >
                <span className="me-2">{tab.icon}</span>
                {tab.label}
              </CmxButton>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'items' && (
            <ItemsTab
              priceListId={priceListId}
              priceListType={priceList.price_list_type}
              items={priceList.items || []}
              onAddItem={() => {
                setEditingItem(null)
                setItemModalOpen(true)
              }}
              onEditItem={(item) => {
                setEditingItem(item)
                setItemModalOpen(true)
              }}
              onDeleteItem={(itemId) => setDeleteItemId(itemId)}
              onBulkImport={() => setBulkImportOpen(true)}
              onImportAllProducts={async () => {
                // This will be handled in ItemsTab
              }}
              onExport={handleExport}
              onReload={reloadPriceList}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsTab
              formData={formData}
              setFormData={setFormData}
              editing={editing}
              setEditing={setEditing}
              saving={saving}
              onSave={handleSaveSettings}
              hasItems={(priceList.items || []).length > 0}
            />
          )}

          {activeTab === 'history' && (
            <PriceHistoryTimeline priceListId={priceListId} />
          )}
        </div>
      </CmxCard>

      {/* Modals */}
      {itemModalOpen && (
        <PriceListItemModal
          open={itemModalOpen}
          onClose={() => {
            setItemModalOpen(false)
            setEditingItem(null)
          }}
          priceListId={priceListId}
          item={editingItem || undefined}
          onSuccess={() => {
            setItemModalOpen(false)
            setEditingItem(null)
            reloadPriceList()
          }}
        />
      )}

      {bulkImportOpen && (
        <BulkImportModal
          open={bulkImportOpen}
          onClose={() => setBulkImportOpen(false)}
          priceListId={priceListId}
          onSuccess={() => {
            setBulkImportOpen(false)
            reloadPriceList()
          }}
        />
      )}

      <CmxConfirmDialog
        open={Boolean(deleteItemId)}
        title={tPage('deleteItemConfirmTitle')}
        description={tPage('deleteItemConfirmDesc')}
        confirmLabel={tCommon('delete')}
        cancelLabel={tCommon('cancel')}
        confirmDisabled={deletingItem}
        onConfirm={handleConfirmDeleteItem}
        onCancel={() => { if (!deletingItem) setDeleteItemId(null) }}
      />
    </div>
    </CatalogSectionGate>
  )
}

// ==================================================================
// TAB COMPONENTS
// ==================================================================

/**
 * Items Tab - Manage price list items
 */
function ItemsTab({
  priceListId,
  priceListType,
  items,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onBulkImport,
  onImportAllProducts,
  onExport,
  onReload,
}: {
  priceListId: string
  priceListType: string
  items: PriceListItem[]
  onAddItem: () => void
  onEditItem: (item: PriceListItem) => void
  onDeleteItem: (itemId: string) => void
  onBulkImport: () => void
  onImportAllProducts?: () => void
  onExport: () => void
  onReload: () => void
}) {
  const t = useTranslations('catalog')
  const tPage = useTranslations('catalog.pricingPage')
  const tCommon = useTranslations('common')
  const intlLocale = useLocale()
  const { currencyCode, decimalPlaces, formatNumber } = useTenantCurrency()
  const moneyLocale = intlLocale === 'ar' ? 'ar' : 'en'
  const fmtPrice = (n: number) =>
    formatMoneyAmountWithCode(n, { currencyCode, decimalPlaces, locale: moneyLocale })
  const [importingAll, setImportingAll] = useState(false)
  const [showImportConfirm, setShowImportConfirm] = useState(false)
  const [overwriteExisting, setOverwriteExisting] = useState(false)

  // Handle import all products with default prices
  async function handleImportAllProducts() {
    setImportingAll(true)
    try {
      const res = await fetch('/api/v1/pricing/import-all-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceListId,
          priceListType,
          overwriteExisting,
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || tPage('importProductsError'))

      if (json.errors && json.errors.length > 0) {
        cmxMessage.error(
          tPage('importProductsPartial', {
            errors: formatNumber(json.errors.length),
            imported: formatNumber(json.imported),
          })
        )
      } else {
        cmxMessage.success(tPage('importProductsSuccess', { imported: formatNumber(json.imported) }))
      }

      setShowImportConfirm(false)
      onReload()
    } catch (err: any) {
      cmxMessage.error(err.message || tPage('importProductsError'))
    } finally {
      setImportingAll(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CmxButton onClick={onAddItem}>
            <Plus className="w-4 h-4 me-2" />
            {tPage('addItem')}
          </CmxButton>
          <CmxButton
            variant="outline"
            onClick={() => setShowImportConfirm(true)}
            title={tPage('importAllTitleAttr')}
          >
            <Package className="w-4 h-4 me-2" />
            {tPage('importAllProducts')}
          </CmxButton>
          <CmxButton variant="outline" onClick={onBulkImport}>
            <Upload className="w-4 h-4 me-2" />
            {tPage('importCsv')}
          </CmxButton>
          <CmxButton variant="outline" onClick={onExport}>
            <Download className="w-4 h-4 me-2" />
            {t('priceHistory.exportCsv')}
          </CmxButton>
        </div>
        <div className="text-sm text-muted-foreground tabular-nums">
          {tCommon('itemCount', { count: items.length })}
        </div>
      </div>

      {/* Import All Products Confirmation Dialog */}
      <CmxDialog open={showImportConfirm} onOpenChange={setShowImportConfirm}>
        <CmxDialogContent className="max-w-md">
          <CmxDialogHeader>
            <CmxDialogTitle>{tPage('importAllDialogTitle')}</CmxDialogTitle>
          </CmxDialogHeader>

          <div className="space-y-4">
            <div className="bg-info-bg border border-info-border rounded-lg p-4">
              <p className="text-sm text-foreground">
                {priceListType === 'express' || priceListType === 'vip'
                  ? tPage('importAllDescriptionExpress')
                  : tPage('importAllDescriptionStandard')}
              </p>
            </div>

            <div className="space-y-2">
              <CmxCheckbox
                checked={overwriteExisting}
                onChange={(e) => setOverwriteExisting(e.target.checked)}
                label={tPage('overwriteExistingLabel')}
              />
            </div>

            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-1">{tPage('noteLabel')}</p>
              <ul className="list-disc list-inside space-y-1">
                <li>{tPage('noteOnlyWithDefault')}</li>
                <li>{tPage('noteSkipWithoutDefault')}</li>
                <li>{tPage('noteEditAfterImport')}</li>
              </ul>
            </div>
          </div>

          <CmxDialogFooter>
            <CmxButton type="button" variant="outline" onClick={() => setShowImportConfirm(false)}>
              {tCommon('cancel')}
            </CmxButton>
            <CmxButton onClick={handleImportAllProducts} disabled={importingAll}>
              {importingAll ? tPage('importing') : tPage('importAllProducts')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>

      {/* Items Table */}
      {items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>{tPage('emptyItems')}</p>
          <CmxButton onClick={onAddItem} className="mt-4">
            {tPage('addFirstItem')}
          </CmxButton>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table className="min-w-full text-sm">
            <TableHeader>
              <TableRow className="bg-muted text-start border-b">
                <TableHead className="px-4 py-3">{tPage('colProduct')}</TableHead>
                <TableHead className="px-4 py-3">{tPage('colPriceWithCurrency', { currency: currencyCode })}</TableHead>
                <TableHead className="px-4 py-3">{tPage('colDiscountPct')}</TableHead>
                <TableHead className="px-4 py-3">{tPage('colQuantityRange')}</TableHead>
                <TableHead className="px-4 py-3">{t('status')}</TableHead>
                <TableHead className="px-4 py-3">{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} className="border-b hover:bg-muted">
                  <TableCell className="px-4 py-3">
                    <div>
                      <div className="font-medium">{item.product_name || item.product_code}</div>
                      {item.product_name2 && (
                        <div className="text-xs text-muted-foreground">{item.product_name2}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 tabular-nums"><bdi dir="ltr">{fmtPrice(Number(item.price))}</bdi></TableCell>
                  <TableCell className="px-4 py-3 tabular-nums"><bdi dir="ltr">{formatNumber(Number(item.discount_percent || 0), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</bdi></TableCell>
                  <TableCell className="px-4 py-3 tabular-nums">
                    <bdi dir="ltr">
                      {formatNumber(item.min_quantity)}
                      {item.max_quantity ? ` - ${formatNumber(item.max_quantity)}` : '+'}
                    </bdi>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded ${item.is_active
                      ? 'bg-success-bg text-success-text'
                      : 'bg-muted text-foreground'
                      }`}>
                      {item.is_active ? tCommon('active') : tCommon('inactive')}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <CmxButton
                        size="sm"
                        variant="ghost"
                        aria-label={tCommon('edit')}
                        onClick={() => onEditItem(item)}
                      >
                        <Edit className="w-4 h-4" />
                      </CmxButton>
                      <CmxButton
                        size="sm"
                        variant="ghost"
                        aria-label={tCommon('delete')}
                        onClick={() => onDeleteItem(item.id)}
                      >
                        <Trash2 className="w-4 h-4 text-danger-text" />
                      </CmxButton>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

/**
 * Settings Tab - Edit price list settings
 */
function SettingsTab({
  formData,
  setFormData,
  editing,
  setEditing,
  saving,
  onSave,
  hasItems,
}: {
  formData: any
  setFormData: (data: any) => void
  editing: boolean
  setEditing: (editing: boolean) => void
  saving: boolean
  onSave: () => void
  hasItems: boolean
}) {
  const t = useTranslations('catalog')
  const tPage = useTranslations('catalog.pricingPage')
  const tCommon = useTranslations('common')

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{tPage('settingsTitle')}</h2>
        {!editing ? (
          <CmxButton onClick={() => setEditing(true)}>
            <Edit className="w-4 h-4 me-2" />
            {tCommon('edit')}
          </CmxButton>
        ) : (
          <div className="flex items-center gap-2">
            <CmxButton onClick={onSave} disabled={saving}>
              <Save className="w-4 h-4 me-2" />
              {saving ? tCommon('loading') : tCommon('save')}
            </CmxButton>
            <CmxButton variant="outline" onClick={() => setEditing(false)}>
              <X className="w-4 h-4 me-2" />
              {tCommon('cancel')}
            </CmxButton>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="block mb-1">{tPage('nameEnLabel')} *</Label>
          <CmxInput
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            disabled={!editing}
            required
          />
        </div>
        <div>
          <Label className="block mb-1">{tPage('nameArLabel')}</Label>
          <CmxInput
            value={formData.name2}
            onChange={(e) => setFormData({ ...formData, name2: e.target.value })}
            disabled={!editing}
          />
        </div>
        <div className="md:col-span-2">
          <Label className="block mb-1">{tPage('descriptionEnLabel')}</Label>
          <CmxTextarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            disabled={!editing}
            rows={3}
          />
        </div>
        <div className="md:col-span-2">
          <Label className="block mb-1">{tPage('descriptionArLabel')}</Label>
          <CmxTextarea
            value={formData.description2}
            onChange={(e) => setFormData({ ...formData, description2: e.target.value })}
            disabled={!editing}
            rows={3}
          />
        </div>
        <div>
          <CmxSelect
            label={t('priceListType')}
            value={formData.price_list_type}
            onChange={(e) => setFormData({ ...formData, price_list_type: e.target.value as PriceListType })}
            disabled={!editing || hasItems}
            helpText={hasItems ? tPage('typeCannotChangeHint') : undefined}
            options={[
              { value: 'standard', label: t('standard') },
              { value: 'express', label: t('express') },
              { value: 'vip', label: t('vip') },
              { value: 'seasonal', label: t('seasonal') },
              { value: 'b2b', label: t('b2b') },
              { value: 'promotional', label: t('promotional') },
            ]}
          />
        </div>
        <div>
          <Label className="block mb-1">{tPage('priority')}</Label>
          <CmxInput
            type="number"
            value={formData.priority}
            onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
            disabled={!editing}
          />
        </div>
        <div>
          <Label className="block mb-1">{t('effectiveFrom')}</Label>
          <CmxInput
            type="date"
            value={formData.effective_from}
            onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })}
            disabled={!editing}
          />
        </div>
        <div>
          <Label className="block mb-1">{t('effectiveTo')}</Label>
          <CmxInput
            type="date"
            value={formData.effective_to}
            onChange={(e) => setFormData({ ...formData, effective_to: e.target.value })}
            disabled={!editing}
          />
        </div>
        <div className="md:col-span-2">
          <CmxCheckbox
            checked={formData.is_default}
            onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
            disabled={!editing}
            label={tPage('defaultForTypeLabel')}
          />
        </div>
        <div className="md:col-span-2">
          <CmxCheckbox
            checked={formData.is_active}
            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
            disabled={!editing}
            label={tCommon('active')}
          />
        </div>
      </div>
    </div>
  )
}


