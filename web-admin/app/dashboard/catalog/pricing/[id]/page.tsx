'use client'

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
import { useTranslations } from 'next-intl'
import { useRTL } from '@/lib/hooks/useRTL'
import { Card, Button, Input } from '@ui/compat'
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
import { BulkImportModal } from '@features/catalog/ui/bulk-import-modal'
import { PriceHistoryTimeline } from '@features/catalog/ui/price-history-timeline'
import { showSuccessToast, showErrorToast } from '@/src/ui/feedback/cmx-toast'

type TabId = 'items' | 'settings' | 'history'

interface Tab {
  id: TabId
  label: string
  icon: string
}

const tabs: Tab[] = [
  { id: 'items', label: 'Items', icon: '📦' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
  { id: 'history', label: 'History', icon: '📜' },
]

export default function PriceListDetailPage() {
  const params = useParams()
  const router = useRouter()
  const t = useTranslations('catalog')
  const isRTL = useRTL()
  const priceListId = params.id as string

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
        if (!res.ok) throw new Error(json?.error || 'Failed to load price list')

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
        setError(err.message || 'Failed to load price list')
        showErrorToast(err.message || 'Failed to load price list')
      } finally {
        setLoading(false)
      }
    }

    if (priceListId) {
      loadPriceList()
    }
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
      if (!res.ok) throw new Error(json?.error || 'Failed to update price list')

      setPriceList({ ...priceList!, ...formData } as PriceListWithItems)
      setEditing(false)
      showSuccessToast('Price list updated successfully')
    } catch (err: any) {
      setError(err.message || 'Failed to update price list')
      showErrorToast(err.message || 'Failed to update price list')
    } finally {
      setSaving(false)
    }
  }

  // Delete item
  async function handleDeleteItem(itemId: string) {
    if (!confirm('Are you sure you want to delete this item?')) return

    try {
      const res = await fetch(`/api/v1/price-lists/${priceListId}/items/${itemId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json?.error || 'Failed to delete item')
      }

      // Reload price list
      const res2 = await fetch(`/api/v1/price-lists/${priceListId}`)
      const json2 = await res2.json()
      if (res2.ok) {
        setPriceList(json2.data)
        showSuccessToast('Item deleted successfully')
      }
    } catch (err: any) {
      showErrorToast(err.message || 'Failed to delete item')
    }
  }

  // Export to CSV
  async function handleExport() {
    try {
      const res = await fetch(`/api/v1/pricing/export?priceListId=${priceListId}`)
      if (!res.ok) throw new Error('Failed to export')

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `price-list-${priceList?.name || 'export'}-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      showSuccessToast('Export completed')
    } catch (err: any) {
      showErrorToast(err.message || 'Failed to export')
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (error && !priceList) {
    return (
      <div className="p-6">
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
        <Button onClick={() => router.push('/dashboard/catalog/pricing')} className="mt-4">
          Back to Price Lists
        </Button>
      </div>
    )
  }

  if (!priceList) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/catalog/pricing')}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">{priceList.name}</h1>
            {priceList.name2 && (
              <p className="text-sm text-gray-500">{priceList.name2}</p>
            )}
          </div>
          <span className={`px-2 py-1 text-xs rounded ${isRTL ? 'text-right' : 'text-left'} ${priceList.is_active
            ? 'bg-green-100 text-green-800'
            : 'bg-gray-100 text-gray-800'
            }`}>
            {priceList.is_active ? 'Active' : 'Inactive'}
          </span>
          <span className={`px-2 py-1 text-xs rounded ${isRTL ? 'text-right' : 'text-left'} bg-blue-100 text-blue-800`}>
            {priceList.price_list_type}
          </span>
        </div>
        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-700">
          {error}
        </div>
      )}

      {/* Tabs */}
      <Card className="p-0 overflow-hidden">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className={`flex ${isRTL ? 'flex-row-reverse' : ''} -mb-px`}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  px-6 py-4 text-sm font-medium border-b-2 transition-colors
                  ${isRTL ? 'text-right' : 'text-left'}
                  ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
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
              onDeleteItem={handleDeleteItem}
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
      </Card>

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
    </div>
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
  const tCommon = useTranslations('common')
  const isRTL = useRTL()
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
      if (!res.ok) throw new Error(json?.error || 'Failed to import products')

      if (json.errors && json.errors.length > 0) {
        showErrorToast(
          `Import completed with ${json.errors.length} errors. ${json.imported} products imported.`
        )
      } else {
        showSuccessToast(`Successfully imported ${json.imported} products with default prices`)
      }

      setShowImportConfirm(false)
      onReload()
    } catch (err: any) {
      showErrorToast(err.message || 'Failed to import products')
    } finally {
      setImportingAll(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Button onClick={onAddItem}>
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowImportConfirm(true)}
            title="Import all active products with their default prices"
          >
            <Package className="w-4 h-4 mr-2" />
            Import All Products
          </Button>
          <Button variant="outline" onClick={onBulkImport}>
            <Upload className="w-4 h-4 mr-2" />
            Import CSV
          </Button>
          <Button variant="outline" onClick={onExport}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
        <div className="text-sm text-gray-500">
          {tCommon('itemCount', { count: items.length })}
        </div>
      </div>

      {/* Import All Products Confirmation Dialog */}
      <Dialog open={showImportConfirm} onOpenChange={setShowImportConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Import All Products with Default Prices</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-gray-700">
                This will import all active products from your catalog into this price list using
                their default {priceListType === 'express' || priceListType === 'vip' ? 'express' : 'standard'} prices.
              </p>
            </div>

            <div className="space-y-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={overwriteExisting}
                  onChange={(e) => setOverwriteExisting(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">
                  Overwrite existing price list items (if unchecked, only new products will be added)
                </span>
              </label>
            </div>

            <div className="text-sm text-gray-600">
              <p className="font-medium mb-1">Note:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Only products with default prices will be imported</li>
                <li>Products without default prices will be skipped</li>
                <li>You can edit prices after import</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowImportConfirm(false)}>
              Cancel
            </Button>
            <Button onClick={handleImportAllProducts} disabled={importingAll}>
              {importingAll ? 'Importing...' : 'Import All Products'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Items Table */}
      {items.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No items in this price list</p>
          <Button onClick={onAddItem} className="mt-4">
            Add First Item
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left border-b">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Price (OMR)</th>
                <th className="px-4 py-3">Discount %</th>
                <th className="px-4 py-3">Quantity Range</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium">{item.product_name || item.product_code}</div>
                      {item.product_name2 && (
                        <div className="text-xs text-gray-500">{item.product_name2}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">{Number(item.price).toFixed(3)}</td>
                  <td className="px-4 py-3">{Number(item.discount_percent || 0).toFixed(2)}%</td>
                  <td className="px-4 py-3">
                    {item.min_quantity}
                    {item.max_quantity ? ` - ${item.max_quantity}` : '+'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded ${item.is_active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                      }`}>
                      {item.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onEditItem(item)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onDeleteItem(item.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
  const isRTL = useRTL()

  return (
    <div className="space-y-6 max-w-2xl">
      <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
        <h2 className="text-lg font-semibold">Price List Settings</h2>
        {!editing ? (
          <Button onClick={() => setEditing(true)}>
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
        ) : (
          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Button onClick={onSave} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button variant="outline" onClick={() => setEditing(false)}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name (EN) *</label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            disabled={!editing}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Name (AR)</label>
          <Input
            value={formData.name2}
            onChange={(e) => setFormData({ ...formData, name2: e.target.value })}
            disabled={!editing}
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Description (EN)</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            disabled={!editing}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            rows={3}
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Description (AR)</label>
          <textarea
            value={formData.description2}
            onChange={(e) => setFormData({ ...formData, description2: e.target.value })}
            disabled={!editing}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            rows={3}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Type</label>
          <select
            value={formData.price_list_type}
            onChange={(e) => setFormData({ ...formData, price_list_type: e.target.value })}
            disabled={!editing || hasItems}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="standard">Standard</option>
            <option value="express">Express</option>
            <option value="vip">VIP</option>
            <option value="seasonal">Seasonal</option>
            <option value="b2b">B2B</option>
            <option value="promotional">Promotional</option>
          </select>
          {hasItems && (
            <p className="text-xs text-gray-500 mt-1">Type cannot be changed when items exist</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Priority</label>
          <Input
            type="number"
            value={formData.priority}
            onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
            disabled={!editing}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Effective From</label>
          <Input
            type="date"
            value={formData.effective_from}
            onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })}
            disabled={!editing}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Effective To</label>
          <Input
            type="date"
            value={formData.effective_to}
            onChange={(e) => setFormData({ ...formData, effective_to: e.target.value })}
            disabled={!editing}
          />
        </div>
        <div className="md:col-span-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.is_default}
              onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
              disabled={!editing}
            />
            <span>Default price list for this type</span>
          </label>
        </div>
        <div className="md:col-span-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              disabled={!editing}
            />
            <span>Active</span>
          </label>
        </div>
      </div>
    </div>
  )
}


