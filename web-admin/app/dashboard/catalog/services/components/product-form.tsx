'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

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
    <Card className="p-4">
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
          <Select value={values.service_category_code} onValueChange={(v) => setField('service_category_code', v as any)}>
            <option value="">--</option>
            {categories.map((c) => (
              <option key={c.code} value={c.code}>
                {isRtl ? c.name2 || c.name : c.name}
              </option>
            ))}
          </Select>
        </div>

        {/* Code */}
        <div>
          <label className="mb-1 block text-sm font-medium">{t('productCode')}</label>
          <Input value={values.product_code || ''} onChange={(e) => setField('product_code', e.target.value)} placeholder="PROD-00001" />
        </div>

        {/* Name EN */}
        <div>
          <label className="mb-1 block text-sm font-medium">{t('productName')}</label>
          <Input value={values.product_name} onChange={(e) => setField('product_name', e.target.value)} />
        </div>

        {/* Name AR */}
        <div>
          <label className="mb-1 block text-sm font-medium">{t('productNameAr')}</label>
          <Input value={values.product_name2 || ''} onChange={(e) => setField('product_name2', e.target.value)} />
        </div>

        {/* Unit */}
        <div>
          <label className="mb-1 block text-sm font-medium">{t('unit')}</label>
          <Select value={values.product_unit} onValueChange={(v) => setField('product_unit', v as any)}>
            <option value="piece">{t('unitPiece')}</option>
            <option value="kg">{t('unitKg')}</option>
            <option value="item">Item</option>
          </Select>
        </div>

        {/* Prices */}
        <div>
          <label className="mb-1 block text-sm font-medium">{t('priceRegular')}</label>
          <Input type="number" step="0.001" value={values.default_sell_price} onChange={(e) => setField('default_sell_price', Number(e.target.value))} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t('priceExpress')}</label>
          <Input type="number" step="0.001" value={values.default_express_sell_price ?? ''} onChange={(e) => setField('default_express_sell_price', e.target.value === '' ? undefined : Number(e.target.value))} />
        </div>

        {/* Min Qty */}
        <div>
          <label className="mb-1 block text-sm font-medium">{t('minQuantity')}</label>
          <Input type="number" value={values.min_quantity ?? ''} onChange={(e) => setField('min_quantity', e.target.value === '' ? undefined : Number(e.target.value))} />
        </div>

        {/* Turnaround */}
        <div>
          <label className="mb-1 block text-sm font-medium">{t('turnaround')}</label>
          <div className="grid grid-cols-2 gap-2">
            <Input type="number" step="0.1" placeholder={t('turnaroundHours')} value={values.turnaround_hh ?? ''} onChange={(e) => setField('turnaround_hh', e.target.value === '' ? undefined : Number(e.target.value))} />
            <Input type="number" step="0.1" placeholder={t('priceExpress')} value={values.turnaround_hh_express ?? ''} onChange={(e) => setField('turnaround_hh_express', e.target.value === '' ? undefined : Number(e.target.value))} />
          </div>
        </div>

        {/* Status */}
        <div className="flex items-end gap-2">
          <Button type="submit" disabled={saving}>{saving ? t('loading') : mode === 'create' ? t('create') : tCommon('update')}</Button>
          {values.is_active ? <Badge variant="success">{t('standard')}</Badge> : <Badge variant="secondary">{t('disableCategories')}</Badge>}
          <Button type="button" variant="secondary" onClick={() => setField('is_active', !values.is_active)}>
            {values.is_active ? t('disableCategories') : t('enableCategories')}
          </Button>
        </div>
      </form>
    </Card>
  )
}
