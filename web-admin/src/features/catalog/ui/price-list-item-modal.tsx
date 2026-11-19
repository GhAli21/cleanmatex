'use client'

/**
 * Price List Item Modal
 * Add or edit a price list item
 */

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useTenantCurrency } from '@/lib/context/tenant-currency-context'
import { CmxDialog, CmxDialogContent, CmxDialogHeader, CmxDialogTitle, CmxDialogFooter } from '@ui/overlays'
import { CmxButton, CmxCheckbox, CmxInput, Label } from '@ui/primitives'
import { cmxMessage } from '@ui/feedback'
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

/**
 *
 * @param root0
 * @param root0.open
 * @param root0.onClose
 * @param root0.priceListId
 * @param root0.item
 * @param root0.onSuccess
 */
export function PriceListItemModal({
  open,
  onClose,
  priceListId,
  item,
  onSuccess,
}: PriceListItemModalProps) {
  const _t = useTranslations('catalog')
  const { currencyCode, decimalPlaces } = useTenantCurrency()
  const priceStep = decimalPlaces <= 0 ? 1 : 10 ** -decimalPlaces
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

      cmxMessage.success(isEditMode ? 'Item updated successfully' : 'Item added successfully')
      onSuccess()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save item'
      cmxMessage.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const selectedProduct = products.find((p) => p.id === productId)

  return (
    <CmxDialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <CmxDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <CmxDialogHeader>
          <CmxDialogTitle>
            {isEditMode ? 'Edit Price List Item' : 'Add Price List Item'}
          </CmxDialogTitle>
        </CmxDialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Product Search/Select */}
          <div>
            <Label className="block mb-1">
              Product *
            </Label>
            <div className="relative">
              <CmxInput
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
                <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {products.map((product) => (
                    <CmxButton
                      key={product.id}
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setProductId(product.id)
                        setProductSearch(product.product_name || product.product_code || '')
                        setProducts([])
                      }}
                      className="h-auto w-full justify-start rounded-none px-4 py-2 text-start font-normal hover:bg-muted"
                    >
                      <div className="w-full text-start">
                        <div className="font-medium">{product.product_name || product.product_code}</div>
                        {product.product_name2 && (
                          <div className="text-xs text-muted-foreground">{product.product_name2}</div>
                        )}
                        {product.product_code && (
                          <div className="text-xs text-muted-foreground">Code: {product.product_code}</div>
                        )}
                      </div>
                    </CmxButton>
                  ))}
                </div>
              )}
            </div>
            {errors.productId && (
              <p className="mt-1 text-sm text-danger-text">{errors.productId}</p>
            )}
            {selectedProduct && (
              <p className="mt-1 text-sm text-success-text">
                Selected: {selectedProduct.product_name || selectedProduct.product_code}
              </p>
            )}
          </div>

          {/* Price */}
          <div>
            <Label className="block mb-1">
              Price ({currencyCode}) *
            </Label>
            <CmxInput
              type="number"
              step={priceStep}
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
            {errors.price && (
              <p className="mt-1 text-sm text-danger-text">{errors.price}</p>
            )}
          </div>

          {/* Discount */}
          <div>
            <Label className="block mb-1">
              Discount (%)
            </Label>
            <CmxInput
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={discountPercent}
              onChange={(e) => setDiscountPercent(e.target.value)}
            />
            {errors.discountPercent && (
              <p className="mt-1 text-sm text-danger-text">{errors.discountPercent}</p>
            )}
          </div>

          {/* Quantity Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="block mb-1">
                Min Quantity *
              </Label>
              <CmxInput
                type="number"
                min="1"
                value={minQuantity}
                onChange={(e) => setMinQuantity(e.target.value)}
                required
              />
              {errors.minQuantity && (
                <p className="mt-1 text-sm text-danger-text">{errors.minQuantity}</p>
              )}
            </div>
            <div>
              <Label className="block mb-1">
                Max Quantity (leave empty for unlimited)
              </Label>
              <CmxInput
                type="number"
                min={minQuantity}
                value={maxQuantity}
                onChange={(e) => setMaxQuantity(e.target.value)}
                placeholder="Unlimited"
              />
              {errors.maxQuantity && (
                <p className="mt-1 text-sm text-danger-text">{errors.maxQuantity}</p>
              )}
            </div>
          </div>

          {/* Active Toggle */}
          <div>
            <CmxCheckbox
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              label="Active"
            />
          </div>

          <CmxDialogFooter>
            <CmxButton type="button" variant="outline" onClick={onClose}>
              Cancel
            </CmxButton>
            <CmxButton type="submit" disabled={saving}>
              {saving ? 'Saving...' : isEditMode ? 'Update' : 'Add'}
            </CmxButton>
          </CmxDialogFooter>
        </form>
      </CmxDialogContent>
    </CmxDialog>
  )
}
