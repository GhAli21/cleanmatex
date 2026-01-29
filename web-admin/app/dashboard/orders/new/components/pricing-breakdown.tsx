'use client'

/**
 * Pricing Breakdown Component
 * Displays detailed pricing breakdown with tax, discounts, and price source
 */

import { useTranslations } from 'next-intl'
import { useRTL } from '@/lib/hooks/useRTL'
import { ChevronDown, ChevronUp, Info } from 'lucide-react'
import { useState } from 'react'

interface PricingBreakdownProps {
  subtotal: number
  discount: number
  tax: number
  total: number
  taxRate?: number
  priceListType?: string
  items?: Array<{
    productName: string
    quantity: number
    pricePerUnit: number
    totalPrice: number
    priceSource?: 'price_list' | 'product_default'
    priceListName?: string
    discount?: number
    tax?: number
  }>
}

export function PricingBreakdown({
  subtotal,
  discount,
  tax,
  total,
  taxRate,
  priceListType,
  items = [],
}: PricingBreakdownProps) {
  const t = useTranslations('newOrder.orderSummary')
  const isRTL = useRTL()
  const [expanded, setExpanded] = useState(false)

  const getPriceSourceBadge = (source?: string) => {
    if (!source) return null

    const badges: Record<string, { label: string; color: string }> = {
      price_list: { label: 'Price List', color: 'bg-blue-100 text-blue-800' },
      product_default: { label: 'Default', color: 'bg-gray-100 text-gray-800' },
      b2b: { label: 'B2B', color: 'bg-purple-100 text-purple-800' },
      vip: { label: 'VIP', color: 'bg-yellow-100 text-yellow-800' },
      express: { label: 'Express', color: 'bg-orange-100 text-orange-800' },
    }

    const badge = badges[source] || badges.product_default
    return (
      <span className={`px-2 py-0.5 text-xs rounded ${badge.color}`}>
        {badge.label}
      </span>
    )
  }

  return (
    <div className="space-y-2">
      {/* Summary (Always Visible) */}
      <div className="space-y-1">
        <div className={`flex items-center justify-between text-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
          <span className="text-gray-600">Subtotal</span>
          <span className="font-medium">OMR {subtotal.toFixed(3)}</span>
        </div>
        {discount > 0 && (
          <div className={`flex items-center justify-between text-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
            <span className="text-gray-600">Discount</span>
            <span className="font-medium text-green-600">-OMR {discount.toFixed(3)}</span>
          </div>
        )}
        <div className={`flex items-center justify-between text-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
          <span className="text-gray-600">
            Tax {taxRate !== undefined ? `(${(taxRate * 100).toFixed(1)}%)` : ''}
          </span>
          <span className="font-medium">OMR {tax.toFixed(3)}</span>
        </div>
        <div className={`flex items-center justify-between text-base font-bold pt-2 border-t ${isRTL ? 'flex-row-reverse' : ''}`}>
          <span>Total</span>
          <span>OMR {total.toFixed(3)}</span>
        </div>
      </div>

      {/* Price List Type Indicator */}
      {priceListType && priceListType !== 'standard' && (
        <div className={`flex items-center gap-2 text-xs text-gray-500 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Info className="w-3 h-3" />
          <span>Using {priceListType} pricing</span>
        </div>
      )}

      {/* Expandable Details */}
      {items.length > 0 && (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className={`w-full flex items-center justify-between text-xs text-gray-600 hover:text-gray-900 py-1 ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <span>View item details</span>
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {expanded && (
            <div className="mt-2 space-y-2 pt-2 border-t">
              {items.map((item, index) => (
                <div key={index} className="text-xs">
                  <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{item.productName}</div>
                      <div className="text-gray-500">
                        {item.quantity}x @ {item.pricePerUnit.toFixed(3)} OMR
                      </div>
                    </div>
                    <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      {getPriceSourceBadge(item.priceSource)}
                      <span className="font-medium">{item.totalPrice.toFixed(3)} OMR</span>
                    </div>
                  </div>
                  {item.priceListName && (
                    <div className="text-gray-400 text-xs mt-1">
                      From: {item.priceListName}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

