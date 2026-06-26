'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import ProductForm from '@features/catalog/ui/product-form'
import { CatalogSectionGate } from '@features/catalog/ui/catalog-section-gate'

/**
 *
 */
export default function NewProductPage() {
  const router = useRouter()
  const t = useTranslations('catalog')

  return (
    <CatalogSectionGate>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('newProduct')}</h1>
      </div>

      <ProductForm
        mode="create"
        onSuccess={(id) => router.push(`/dashboard/catalog/services/${id}`)}
      />
    </div>
    </CatalogSectionGate>
  )
}
