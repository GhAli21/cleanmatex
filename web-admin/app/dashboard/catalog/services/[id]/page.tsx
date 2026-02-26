'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import ProductForm, { type ProductFormValues } from '@features/catalog/ui/product-form'
import { CmxCard } from '@ui/primitives/cmx-card'

export default function EditProductPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const t = useTranslations('catalog')
  const tCommon = useTranslations('common')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<Partial<ProductFormValues> | null>(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/v1/products/${params.id}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || 'Failed to load product')
        if (mounted) {
          const p = json.data
          const values: Partial<ProductFormValues> = {
            id: p.id,
            service_category_code: p.service_category_code,
            product_code: p.product_code,
            product_name: p.product_name,
            product_name2: p.product_name2,
            product_unit: p.product_unit,
            default_sell_price: p.default_sell_price,
            default_express_sell_price: p.default_express_sell_price,
            min_quantity: p.min_quantity,
            turnaround_hh: p.turnaround_hh,
            turnaround_hh_express: p.turnaround_hh_express,
            is_active: p.is_active,
            product_image: p.product_image ?? null,
            product_icon: p.product_icon ?? null,
          }
          setData(values)
        }
      } catch (e: any) {
        if (mounted) setError(e.message || 'Failed to load product')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [params.id])

  if (loading) {
    return (
      <CmxCard className="p-4 text-gray-500">{tCommon('loading')}</CmxCard>
    )
  }

  if (error) {
    return (
      <CmxCard className="p-4 text-red-700">{error}</CmxCard>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('editProduct')}</h1>
      </div>

      {data && (
        <ProductForm
          mode="edit"
          initialValues={data}
          onSuccess={(id) => router.push(`/dashboard/catalog/services/${id}`)}
        />
      )}
    </div>
  )
}
