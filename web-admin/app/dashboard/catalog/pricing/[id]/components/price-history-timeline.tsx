'use client'

/**
 * Price History Timeline Component
 * Displays price change history for a price list or product
 */

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRTL } from '@/lib/hooks/useRTL'
import { Card, Button, Input } from '@ui/compat'
import { Calendar, Filter, Download, Clock, User, DollarSign } from 'lucide-react'

interface PriceHistoryEntry {
  id: string
  created_at: string
  created_by: string | null
  user_name?: string | null
  user_email?: string | null
  entity_type: 'price_list_item' | 'product_default'
  old_price: number | null
  new_price: number | null
  old_discount_percent: number | null
  new_discount_percent: number | null
  change_reason: string | null
  price_list_name?: string
  product_name?: string
  product_name2?: string
}

interface PriceHistoryTimelineProps {
  priceListId?: string
  productId?: string
}

export function PriceHistoryTimeline({ priceListId, productId }: PriceHistoryTimelineProps) {
  const t = useTranslations('catalog')
  const isRTL = useRTL()
  const [history, setHistory] = useState<PriceHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    fromDate: '',
    toDate: '',
    userId: '',
    entityType: '',
  })

  useEffect(() => {
    loadHistory()
  }, [priceListId, productId, filters])

  async function loadHistory() {
    setLoading(true)
    try {
      // Build query params
      const params = new URLSearchParams()
      if (priceListId) params.append('priceListId', priceListId)
      if (productId) params.append('productId', productId)
      if (filters.fromDate) params.append('fromDate', filters.fromDate)
      if (filters.toDate) params.append('toDate', filters.toDate)
      if (filters.userId) params.append('userId', filters.userId)
      if (filters.entityType) params.append('entityType', filters.entityType)

      const res = await fetch(`/api/v1/pricing/history?${params.toString()}`)
      const json = await res.json()
      if (res.ok) {
        setHistory(json.data || [])
      } else {
        console.error('Failed to load price history:', json.error)
        setHistory([])
      }
    } catch (err) {
      console.error('Failed to load price history:', err)
      setHistory([])
    } finally {
      setLoading(false)
    }
  }

  async function handleExport() {
    try {
      if (history.length === 0) return
      const headers = [
        'Date',
        'Entity Type',
        'Price List / Product',
        'Old Price',
        'New Price',
        'Old Discount %',
        'New Discount %',
        'Change Reason',
        'Changed By',
      ]
      const rows = history.map((entry) => [
        formatDate(entry.created_at),
        entry.entity_type,
        entry.entity_type === 'price_list_item'
          ? entry.price_list_name || 'N/A'
          : entry.product_name || entry.product_name2 || 'N/A',
        entry.old_price ?? '',
        entry.new_price ?? '',
        entry.old_discount_percent ?? '',
        entry.new_discount_percent ?? '',
        entry.change_reason ?? '',
        (entry.user_name || entry.user_email || entry.created_by) ?? '',
      ])
      const csvContent = [
        headers.join(','),
        ...rows.map((row) =>
          row.map((cell) => {
            const s = String(cell)
            return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s
          }).join(',')
        ),
      ].join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `price-history-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to export:', err)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString(isRTL ? 'ar-OM' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatPrice = (price: number | null) => {
    if (price === null) return '-'
    return `${price.toFixed(3)} OMR`
  }

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
        Loading price history...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="p-4">
        <div className={`flex items-center gap-2 mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Filter className="w-5 h-5 text-gray-600" />
          <h3 className="font-medium">Filters</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">From Date</label>
            <Input
              type="date"
              value={filters.fromDate}
              onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">To Date</label>
            <Input
              type="date"
              value={filters.toDate}
              onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Entity Type</label>
            <select
              value={filters.entityType}
              onChange={(e) => setFilters({ ...filters, entityType: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">All Types</option>
              <option value="price_list_item">Price List Item</option>
              <option value="product_default">Product Default</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={handleExport} className="w-full">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </Card>

      {/* History Timeline */}
      {history.length === 0 ? (
        <Card className="p-12 text-center">
          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No price history available</p>
          <p className="text-sm text-gray-400 mt-2">
            Price changes will be tracked here automatically
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {history.map((entry) => (
            <Card key={entry.id} className="p-4">
              <div className={`flex items-start gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                {/* Timeline Dot */}
                <div className="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full mt-2" />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className={`flex items-start justify-between gap-4 mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className="flex-1">
                      <div className={`flex items-center gap-2 mb-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <DollarSign className="w-4 h-4 text-gray-500" />
                        <span className="font-medium text-gray-900">
                          {entry.entity_type === 'price_list_item'
                            ? `Price List: ${entry.price_list_name || 'N/A'}`
                            : `Product: ${entry.product_name || 'N/A'}`}
                        </span>
                      </div>
                      <div className={`flex items-center gap-4 text-sm text-gray-600 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(entry.created_at)}
                        </span>
                        {entry.created_by && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {entry.user_name || entry.user_email || `User ID: ${entry.created_by.substring(0, 8)}...`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Price Change */}
                  <div className={`bg-gray-50 rounded-lg p-3 mt-3 ${isRTL ? 'text-right' : 'text-left'}`}>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Old Price</p>
                        <p className="font-medium">{formatPrice(entry.old_price)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">New Price</p>
                        <p className="font-medium text-blue-600">{formatPrice(entry.new_price)}</p>
                      </div>
                      {entry.old_discount_percent !== null && entry.new_discount_percent !== null && (
                        <>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Old Discount</p>
                            <p className="font-medium">
                              {entry.old_discount_percent.toFixed(2)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">New Discount</p>
                            <p className="font-medium text-blue-600">
                              {entry.new_discount_percent.toFixed(2)}%
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                    {entry.change_reason && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs text-gray-500 mb-1">Reason</p>
                        <p className="text-sm text-gray-700">{entry.change_reason}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

