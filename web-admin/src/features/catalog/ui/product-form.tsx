'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { CmxInput, CmxSelect, CmxButton, CmxCard, Badge } from '@ui/primitives'

interface CategoryOption {
  code: string
  name: string
  name2: string | null
}

export interface ProductFormValues {
  id?: string
  service_category_code: string
  product_code?: string
  product_name: string
  product_name2?: string
  product_unit: 'piece' | 'kg' | 'item'
  default_sell_price: number
  default_express_sell_price?: number
  min_quantity?: number
  turnaround_hh?: number
  turnaround_hh_express?: number
  is_active?: boolean
  product_image?: string | null
  product_icon?: string | null
}

interface ProductFormProps {
  initialValues?: Partial<ProductFormValues>
  mode: 'create' | 'edit'
  onSuccess?: (id: string) => void
}

export default function ProductForm({ initialValues, mode, onSuccess }: ProductFormProps) {
  const t = useTranslations('catalog')
  const tCommon = useTranslations('common')  // for common keys

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [imageUploading, setImageUploading] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [values, setValues] = useState<ProductFormValues>({
    service_category_code: initialValues?.service_category_code || '',
    product_code: initialValues?.product_code || '',
    product_name: initialValues?.product_name || '',
    product_name2: initialValues?.product_name2 || '',
    product_unit: (initialValues?.product_unit as any) || 'piece',
    default_sell_price: Number(initialValues?.default_sell_price || 0),
    default_express_sell_price: initialValues?.default_express_sell_price ? Number(initialValues.default_express_sell_price) : undefined,
    min_quantity: initialValues?.min_quantity ? Number(initialValues.min_quantity) : undefined,
    turnaround_hh: initialValues?.turnaround_hh ? Number(initialValues.turnaround_hh) : undefined,
    turnaround_hh_express: initialValues?.turnaround_hh_express ? Number(initialValues.turnaround_hh_express) : undefined,
    is_active: initialValues?.is_active ?? true,
    id: initialValues?.id,
    product_image: initialValues?.product_image ?? null,
    product_icon: initialValues?.product_icon ?? null,
  })

  const isRtl = useMemo(() => typeof document !== 'undefined' && document.dir === 'rtl', [])

  useEffect(() => {
    let mounted = true
    async function loadCategories() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/v1/categories?enabled=true')
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || 'Failed to load categories')
        const options: CategoryOption[] = (json.data || []).map((c: any) => ({
          code: c.service_category_code,
          name: c.ctg_name,
          name2: c.ctg_name2,
        }))
        if (mounted) setCategories(options)
      } catch (e: any) {
        if (mounted) setError(e.message || 'Failed to load categories')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    loadCategories()
    return () => {
      mounted = false
    }
  }, [])

  function setField<K extends keyof ProductFormValues>(key: K, val: ProductFormValues[K]) {
    setValues((v) => ({ ...v, [key]: val }))
  }

  function validate(): string[] {
    const errs: string[] = []
    if (!values.product_name || values.product_name.trim().length === 0) errs.push(t('productName') + ' ' + t('required'))
    if (!values.service_category_code) errs.push(t('category') + ' ' + t('required'))
    if (!values.product_unit) errs.push(t('unit') + ' ' + t('required'))
    if (values.default_sell_price === undefined || values.default_sell_price < 0) errs.push(t('priceRegular') + ' ' + t('required'))
    return errs
  }

  async function handleImageUpload(file: File) {
    if (!values.id) return
    setImageUploading(true)
    setImageError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/v1/products/${values.id}/image`, { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Upload failed')
      setField('product_image', json.url)
    } catch (e: unknown) {
      setImageError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setImageUploading(false)
    }
  }

  async function handleImageRemove() {
    if (!values.id) return
    setImageUploading(true)
    setImageError(null)
    try {
      const res = await fetch(`/api/v1/products/${values.id}/image`, { method: 'DELETE' })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j?.error || 'Remove failed')
      }
      setField('product_image', null)
    } catch (e: unknown) {
      setImageError(e instanceof Error ? e.message : 'Remove failed')
    } finally {
      setImageUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    const errs = validate()
    if (errs.length > 0) {
      setSaving(false)
      setError(errs.join(' • '))
      return
    }

    try {
      const payload: any = {
        service_category_code: values.service_category_code,
        product_code: values.product_code || undefined,
        product_name: values.product_name,
        product_name2: values.product_name2 || undefined,
        product_unit: values.product_unit,
        default_sell_price: Number(values.default_sell_price),
        default_express_sell_price: values.default_express_sell_price !== undefined ? Number(values.default_express_sell_price) : undefined,
        min_quantity: values.min_quantity !== undefined ? Number(values.min_quantity) : undefined,
        turnaround_hh: values.turnaround_hh !== undefined ? Number(values.turnaround_hh) : undefined,
        turnaround_hh_express: values.turnaround_hh_express !== undefined ? Number(values.turnaround_hh_express) : undefined,
        is_active: values.is_active,
        product_icon: values.product_icon ?? undefined,
        // NOTE: product_image is managed exclusively by the upload API route
      }

      let res: Response
      if (mode === 'create') {
        res = await fetch('/api/v1/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch(`/api/v1/products/${values.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to save')

      setSuccess(json?.message || 'Saved')
      onSuccess?.(json?.data?.id || values.id || '')
    } catch (e: any) {
      setError(e.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <CmxCard className="p-4">
      {error && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-red-700">{error}</div>
      )}
      {success && (
        <div className="mb-3 rounded-md border border-green-200 bg-green-50 p-3 text-green-700">{success}</div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Category */}
        <div>
          <label className="mb-1 block text-sm font-medium">{t('category')}</label>
          <select value={values.service_category_code} onChange={(e) => setField('service_category_code', e.target.value)}>
            <option value="">--</option>
            {categories.map((c) => (
              <option key={c.code} value={c.code}>
                {isRtl ? c.name2 || c.name : c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Code */}
        <div>
          <label className="mb-1 block text-sm font-medium">{t('productCode')}</label>
          <CmxInput value={values.product_code || ''} onChange={(e) => setField('product_code', e.target.value)} placeholder="PROD-00001" />
        </div>

        {/* Name EN */}
        <div>
          <label className="mb-1 block text-sm font-medium">{t('productName')}</label>
          <CmxInput value={values.product_name} onChange={(e) => setField('product_name', e.target.value)} />
        </div>

        {/* Name AR */}
        <div>
          <label className="mb-1 block text-sm font-medium">{t('productNameAr')}</label>
          <CmxInput value={values.product_name2 || ''} onChange={(e) => setField('product_name2', e.target.value)} />
        </div>

        {/* Image & Icon */}
        <div className="col-span-1 md:col-span-2 rounded-lg border border-dashed border-gray-200 p-4">
          <p className="mb-3 text-sm font-semibold text-gray-700">{t('productImageIconTitle')}</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

            {/* Image upload — edit mode only (product ID required for storage path) */}
            {mode === 'edit' && (
              <div>
                <label className="mb-1 block text-sm font-medium">{t('productImage')}</label>
                {values.product_image ? (
                  <div className="relative mb-2 h-32 w-32 overflow-hidden rounded-lg border border-gray-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={values.product_image} alt={values.product_name} className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <div className="mb-2 flex h-32 w-32 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-4xl">
                    {values.product_icon || '📷'}
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleImageUpload(f)
                    e.target.value = ''
                  }}
                />
                <div className="flex flex-wrap gap-2">
                  <CmxButton
                    type="button"
                    variant="outline"
                    disabled={imageUploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {imageUploading ? tCommon('loading') : t('uploadImage')}
                  </CmxButton>
                  {values.product_image && (
                    <CmxButton
                      type="button"
                      variant="outline"
                      disabled={imageUploading}
                      onClick={handleImageRemove}
                    >
                      {t('removeImage')}
                    </CmxButton>
                  )}
                </div>
                {imageError && <p className="mt-1 text-xs text-red-600">{imageError}</p>}
                <p className="mt-1 text-xs text-gray-500">{t('imageHint')}</p>
              </div>
            )}

            {/* Emoji icon — always visible (create and edit) */}
            <div>
              <label className="mb-1 block text-sm font-medium">{t('productIcon')}</label>
              <CmxInput
                value={values.product_icon || ''}
                maxLength={8}
                onChange={(e) => setField('product_icon', e.target.value || null)}
                placeholder="e.g. 👔"
              />
              <p className="mt-1 text-xs text-gray-500">{t('iconHint')}</p>
            </div>
          </div>
        </div>

        {/* Unit */}
        <div>
          <label className="mb-1 block text-sm font-medium">{t('unit')}</label>
          <select value={values.product_unit} onChange={(e) => setField('product_unit', e.target.value as any)}>
            <option value="piece">{t('unitPiece')}</option>
            <option value="kg">{t('unitKg')}</option>
            <option value="item">Item</option>
          </select>
        </div>

        {/* Prices */}
        <div>
          <label className="mb-1 block text-sm font-medium">{t('priceRegular')}</label>
          <CmxInput type="number" step="0.001" value={values.default_sell_price} onChange={(e) => setField('default_sell_price', Number(e.target.value))} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t('priceExpress')}</label>
          <CmxInput type="number" step="0.001" value={values.default_express_sell_price ?? ''} onChange={(e) => setField('default_express_sell_price', e.target.value === '' ? undefined : Number(e.target.value))} />
        </div>

        {/* Min Qty */}
        <div>
          <label className="mb-1 block text-sm font-medium">{t('minQuantity')}</label>
          <CmxInput type="number" value={values.min_quantity ?? ''} onChange={(e) => setField('min_quantity', e.target.value === '' ? undefined : Number(e.target.value))} />
        </div>

        {/* Turnaround */}
        <div>
          <label className="mb-1 block text-sm font-medium">{t('turnaround')}</label>
          <div className="grid grid-cols-2 gap-2">
            <CmxInput type="number" step="0.1" placeholder={t('turnaroundHours')} value={values.turnaround_hh ?? ''} onChange={(e) => setField('turnaround_hh', e.target.value === '' ? undefined : Number(e.target.value))} />
            <CmxInput type="number" step="0.1" placeholder={t('priceExpress')} value={values.turnaround_hh_express ?? ''} onChange={(e) => setField('turnaround_hh_express', e.target.value === '' ? undefined : Number(e.target.value))} />
          </div>
        </div>

        {/* Status */}
        <div className="flex items-end gap-2">
          <CmxButton type="submit" disabled={saving}>{saving ? tCommon('loading') : mode === 'create' ? tCommon('create') : tCommon('update')}</CmxButton>
          {values.is_active ? <Badge variant="success">{t('standard')}</Badge> : <Badge variant="default">{t('disableCategories')}</Badge>}
          <CmxButton type="button" variant="outline" onClick={() => setField('is_active', !values.is_active)}>
            {values.is_active ? t('disableCategories') : t('enableCategories')}
          </CmxButton>
        </div>
      </form>
    </CmxCard>
  )
}
