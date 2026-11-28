'use client'

/**
 * Price History Timeline Component
 * Displays price change history for a price list or product
 */

import { useState, useEffect } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { dtTodayOrNull, systemClock, type ClockBlock, type PublicClockBlock } from '@cmx/clock'
import { formatInstantText, useClock } from '@ui/clock/clock-provider'
import { CmxViewZoneToggle, ViewZoneProvider, useViewZone } from '@ui/clock/view-zone'
import { exportFileDay, exportLocalText, toApiInstant } from '@/lib/clock/api-output'
import { useTenantCurrency } from '@/lib/context/tenant-currency-context'
import { formatMoneyAmountWithCode } from '@/lib/money/format-money'
import { CmxCard, CmxButton, CmxInput, CmxSelect, Label } from '@ui/primitives'
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

/**
 *
 * @param root0
 * @param root0.priceListId
 * @param root0.productId
 */
export function PriceHistoryTimeline(props: PriceHistoryTimelineProps) {
  // D20 second list: "Show times in: Branch zone / My device zone" (display only).
  return (
    <ViewZoneProvider screenKey="price-history">
      <PriceHistoryTimelineBody {...props} />
    </ViewZoneProvider>
  )
}

function PriceHistoryTimelineBody({ priceListId, productId }: PriceHistoryTimelineProps) {
  const t = useTranslations('catalog.priceHistory')
  const clock = useClock()
  const { displayZone } = useViewZone()
  const [clockBlock, setClockBlock] = useState<ClockBlock | PublicClockBlock | null>(null)
  // Operations zone from the endpoint `clock` block (S6), else the screen provider; never the device zone.
  const opsZone = clockBlock?.zone ?? clock.zone ?? null
  const zone = displayZone(opsZone)
  const locale = useLocale()
  const { currencyCode, decimalPlaces, formatNumber } = useTenantCurrency()
  const moneyLocale = locale === 'ar' ? 'ar' : 'en'
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
        setClockBlock(json.clock ?? null)
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
      // Instant in UTC (`Z`), local text in the shown zone, and the zone named per row (S7, D20).
      const headers = ['Changed At (UTC)', 'Changed At (Local)', 'Time Zone', 'Entity Type', 'Price List / Product', 'Old Price', 'New Price', 'Old Discount %', 'New Discount %', 'Change Reason', 'Changed By']
      const rows = history.map((entry) => [
        toApiInstant(entry.created_at) ?? '',
        exportLocalText(entry.created_at, zone),
        zone ?? '',
        entry.entity_type,
        entry.entity_type === 'price_list_item' ? entry.price_list_name || 'N/A' : entry.product_name || entry.product_name2 || 'N/A',
        entry.old_price ?? '',
        entry.new_price ?? '',
        entry.old_discount_percent ?? '',
        entry.new_discount_percent ?? '',
        entry.change_reason ?? '',
        (entry.user_name || entry.user_email || entry.created_by) ?? '',
      ])
      const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.map((cell) => {
          const s = String(cell)
          return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s
        }).join(',')),
      ].join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `price-history-${exportFileDay(opsZone ? dtTodayOrNull(systemClock, opsZone) : null)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to export:', err)
    }
  }

  const formatDate = (dateString: string) =>
    formatInstantText(dateString, zone, { ...clock, hourCycle: clockBlock?.hourCycle ?? clock.hourCycle }) ??
    t('notAvailable')

  const formatPrice = (price: number | null) => {
    if (price === null) return '-'
    return formatMoneyAmountWithCode(price, { currencyCode, decimalPlaces, locale: moneyLocale })
  }

  if (loading) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
        {t('loading')}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <CmxCard className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-medium">{t('filtersTitle')}</h3>
          <CmxViewZoneToggle className="ms-auto" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label className="block text-xs mb-1">{t('fromDate')}</Label>
            <CmxInput type="date" value={filters.fromDate} onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })} />
          </div>
          <div>
            <Label className="block text-xs mb-1">{t('toDate')}</Label>
            <CmxInput type="date" value={filters.toDate} onChange={(e) => setFilters({ ...filters, toDate: e.target.value })} />
          </div>
          <div>
            <CmxSelect
              label={t('entityType')}
              value={filters.entityType}
              onChange={(e) => setFilters({ ...filters, entityType: e.target.value })}
              options={[
                { value: '', label: t('allTypes') },
                { value: 'price_list_item', label: t('entityPriceListItem') },
                { value: 'product_default', label: t('entityProductDefault') },
              ]}
            />
          </div>
          <div className="flex items-end">
            <CmxButton variant="outline" onClick={handleExport} className="w-full">
              <Download className="w-4 h-4 me-2" />
              {t('exportCsv')}
            </CmxButton>
          </div>
        </div>
      </CmxCard>

      {history.length === 0 ? (
        <CmxCard className="p-12 text-center">
          <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">{t('emptyTitle')}</p>
          <p className="text-sm text-muted-foreground mt-2">{t('emptyHint')}</p>
        </CmxCard>
      ) : (
        <div className="space-y-4">
          {history.map((entry) => (
            <CmxCard key={entry.id} className="p-4">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-2 h-2 bg-primary rounded-full mt-2" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <DollarSign className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium text-foreground">
                          {entry.entity_type === 'price_list_item'
                            ? t('priceListPrefix', { name: entry.price_list_name || t('notAvailable') })
                            : t('productPrefix', {
                                name: (locale === 'ar' ? entry.product_name2 || entry.product_name : entry.product_name || entry.product_name2) || t('notAvailable'),
                              })}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /><bdi dir="ltr">{formatDate(entry.created_at)}</bdi></span>
                        {entry.created_by && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {entry.user_name || entry.user_email || t('userFallback', { id: entry.created_by.substring(0, 8) })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="bg-muted rounded-lg p-3 mt-3 text-start">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><p className="text-xs text-muted-foreground mb-1">{t('oldPrice')}</p><p className="font-medium tabular-nums"><bdi dir="ltr">{formatPrice(entry.old_price)}</bdi></p></div>
                      <div><p className="text-xs text-muted-foreground mb-1">{t('newPrice')}</p><p className="font-medium text-primary-text tabular-nums"><bdi dir="ltr">{formatPrice(entry.new_price)}</bdi></p></div>
                      {entry.old_discount_percent !== null && entry.new_discount_percent !== null && (
                        <>
                          <div><p className="text-xs text-muted-foreground mb-1">{t('oldDiscount')}</p><p className="font-medium tabular-nums">{formatNumber(entry.old_discount_percent, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</p></div>
                          <div><p className="text-xs text-muted-foreground mb-1">{t('newDiscount')}</p><p className="font-medium text-primary-text tabular-nums">{formatNumber(entry.new_discount_percent, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</p></div>
                        </>
                      )}
                    </div>
                    {entry.change_reason && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-xs text-muted-foreground mb-1">{t('reason')}</p>
                        <p className="text-sm text-foreground">{entry.change_reason}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CmxCard>
          ))}
        </div>
      )}
    </div>
  )
}
