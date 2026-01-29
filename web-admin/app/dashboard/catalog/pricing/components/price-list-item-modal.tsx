'use client'

/**
 * Price List Item Modal
 * Add or edit a price list item
 */

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRTL } from '@/lib/hooks/useRTL'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { showSuccessToast, showErrorToast } from '@/src/ui/feedback/cmx-toast'
import type { PriceListItem } from '@/lib/types/catalog'

interface PriceListItemModalProps {
  open: boolean
  onClose: () => void
  priceListId: string
  item?: PriceListItem
  onSuccess: () => void
}

interface Product {
  id: string
  product_code: string | null
  product_name: string | null
  product_name2: string | null
}

export function PriceListItemModal({
  open,
  onClose,
  priceListId,
  item,
  onSuccess,
}: PriceListItemModalProps) {
  const t = useTranslations('catalog')
  const isRTL = useRTL()
  const isEditMode = !!item

  // Form state
  const [productId, setProductId] = useState(item?.product_id || '')
  const [productSearch, setProductSearch] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [price, setPrice] = useState(item?.price ? String(item.price) : '')
  const [discountPercent, setDiscountPercent] = useState(
    item?.discount_percent ? String(item.discount_percent) : '0'
  )
  const [minQuantity, setMinQuantity] = useState(item?.min_quantity ? String(item.min_quantity) : '1')
  const [maxQuantity, setMaxQuantity] = useState(item?.max_quantity ? String(item.max_quantity) : '')
  const [isActive, setIsActive] = useState(item?.is_active ?? true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Search products
  useEffect(() => {
    if (!productSearch || productSearch.length < 2) {
      setProducts([])
      return
    }

    const timeoutId = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/v1/products/search?q=${encodeURIComponent(productSearch)}&limit=10`
        )
        const json = await res.json()
        if (res.ok) {
          setProducts(json.data?.products || [])
        }
      } catch (err) {
        console.error('Failed to search products:', err)
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [productSearch])

  // Initialize form when item changes
  useEffect(() => {
    if (item) {
      setProductId(item.product_id)
      setProductSearch(item.product_name || item.product_code || '')
      setPrice(String(item.price))
      setDiscountPercent(String(item.discount_percent || 0))
      setMinQuantity(String(item.min_quantity || 1))
      setMaxQuantity(item.max_quantity ? String(item.max_quantity) : '')
      setIsActive(item.is_active ?? true)
    } else {
      // Reset form
      setProductId('')
      setProductSearch('')
      setPrice('')
      setDiscountPercent('0')
      setMinQuantity('1')
      setMaxQuantity('')
      setIsActive(true)
    }
    setErrors({})
  }, [item, open])

  // Validate form
  function validate(): boolean {
    const newErrors: Record<string, string> = {}

    if (!productId) {
      newErrors.productId = 'Product is required'
    }

    const priceNum = parseFloat(price)
    if (isNaN(priceNum) || priceNum < 0) {
      newErrors.price = 'Price must be >= 0'
    }

    const discountNum = parseFloat(discountPercent)
    if (isNaN(discountNum) || discountNum < 0 || discountNum > 100) {
      newErrors.discountPercent = 'Discount must be between 0 and 100'
    }

    const minQty = parseInt(minQuantity)
    if (isNaN(minQty) || minQty < 1) {
      newErrors.minQuantity = 'Min quantity must be >= 1'
    }

    if (maxQuantity) {
      const maxQty = parseInt(maxQuantity)
      if (isNaN(maxQty) || maxQty < minQty) {
        newErrors.maxQuantity = 'Max quantity must be >= min quantity'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle submit
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!validate()) {
      return
    }

    setSaving(true)
    try {
      const url = item
        ? `/api/v1/price-lists/${priceListId}/items/${item.id}`
        : `/api/v1/price-lists/${priceListId}/items`

      const method = item ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          price: parseFloat(price),
          discount_percent: parseFloat(discountPercent),
          min_quantity: parseInt(minQuantity),
          max_quantity: maxQuantity ? parseInt(maxQuantity) : null,
          is_active: isActive,
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to save item')

      showSuccessToast(isEditMode ? 'Item updated successfully' : 'Item added successfully')
      onSuccess()
    } catch (err: any) {
      showErrorToast(err.message || 'Failed to save item')
    } finally {
      setSaving(false)
    }
  }

  const selectedProduct = products.find((p) => p.id === productId)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? 'Edit Price List Item' : 'Add Price List Item'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Product Search/Select */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Product *
            </label>
            <div className="relative">
              <Input
                value={productSearch}
                onChange={(e) => {
                  setProductSearch(e.target.value)
                  if (!e.target.value) setProductId('')
                }}
                placeholder="Search products by name or code..."
                disabled={isEditMode}
                required
              />
              {productSearch && !productId && products.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {products.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => {
                        setProductId(product.id)
                        setProductSearch(product.product_name || product.product_code || '')
                        setProducts([])
                      }}
                      className={`w-full px-4 py-2 text-left hover:bg-gray-100 ${isRTL ? 'text-right' : 'text-left'}`}
                    >
                      <div className="font-medium">{product.product_name || product.product_code}</div>
                      {product.product_name2 && (
                        <div className="text-xs text-gray-500">{product.product_name2}</div>
                      )}
                      {product.product_code && (
                        <div className="text-xs text-gray-400">Code: {product.product_code}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {errors.productId && (
              <p className="mt-1 text-sm text-red-600">{errors.productId}</p>
            )}
            {selectedProduct && (
              <p className="mt-1 text-sm text-green-600">
                Selected: {selectedProduct.product_name || selectedProduct.product_code}
              </p>
            )}
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Price (OMR) *
            </label>
            <Input
              type="number"
              step="0.001"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
            {errors.price && (
              <p className="mt-1 text-sm text-red-600">{errors.price}</p>
            )}
          </div>

          {/* Discount */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Discount (%)
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={discountPercent}
              onChange={(e) => setDiscountPercent(e.target.value)}
            />
            {errors.discountPercent && (
              <p className="mt-1 text-sm text-red-600">{errors.discountPercent}</p>
            )}
          </div>

          {/* Quantity Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Min Quantity *
              </label>
              <Input
                type="number"
                min="1"
                value={minQuantity}
                onChange={(e) => setMinQuantity(e.target.value)}
                required
              />
              {errors.minQuantity && (
                <p className="mt-1 text-sm text-red-600">{errors.minQuantity}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Max Quantity (leave empty for unlimited)
              </label>
              <Input
                type="number"
                min={minQuantity}
                value={maxQuantity}
                onChange={(e) => setMaxQuantity(e.target.value)}
                placeholder="Unlimited"
              />
              {errors.maxQuantity && (
                <p className="mt-1 text-sm text-red-600">{errors.maxQuantity}</p>
              )}
            </div>
          </div>

          {/* Active Toggle */}
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <span>Active</span>
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : isEditMode ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

