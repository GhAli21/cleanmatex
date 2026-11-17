'use client'

/**
 * Product form is the first real feature screen wired to the refreshed
 * `@ui/forms` layer so the new hierarchy, spacing, and recovery states can
 * be reviewed in an actual business workflow.
 */

import { useEffect, useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  CmxForm,
  CmxFormActions,
  CmxFormField,
  CmxFormSection,
  CmxFormStatusBanner,
} from '@ui/forms'
import { CmxButton, CmxCard, CmxCardContent, CmxCardDescription, CmxCardHeader, CmxCardTitle, CmxInput, CmxMoneyField, CmxSelect, CmxSwitch } from '@ui/primitives';
import { useRTL } from '@/lib/hooks/useRTL'
import { useTenantCurrency } from '@/lib/context/tenant-currency-context'
import { useTaxItemClassOptions } from '../hooks/use-tax-item-class-options'
import { ProductSpeedPricingSection } from './product-speed-pricing-section'

import { CmxStatusBadge } from '@ui/feedback';
import { FileAttachments, useFileAttachments } from '@features/file-util'
import { FILE_CATEGORIES, FILE_SOURCES } from '@/lib/constants/file-util'
import { useHasPermission } from '@/lib/hooks/use-has-permission'
interface CategoryOption {
  code: string
  name: string
  name2: string | null
}

interface CategoryApiItem {
  service_category_code: string
  ctg_name: string
  ctg_name2: string | null
}

interface CategoriesApiResponse {
  data?: CategoryApiItem[]
  error?: string
}

interface ProductSaveResponse {
  data?: { id?: string }
  error?: string
  message?: string
}

/** Form value shape used by the catalog product editor. */
export interface ProductFormValues {
  id?: string
  service_category_code: string
  product_code?: string
  product_name: string
  product_name2?: string
  product_unit: 'piece' | 'kg' | 'item'
  default_sell_price: number
  min_quantity?: number
  turnaround_hh?: number
  tax_item_class_code?: string | null
  is_active?: boolean
  product_image?: string | null
  product_icon?: string | null
}

interface ProductFormProps {
  initialValues?: Partial<ProductFormValues>
  mode: 'create' | 'edit'
  onSuccess?: (id: string) => void
}

/**
 * Product form connects the refreshed form primitives to the catalog product
 * workflow; product images are managed by File Util (PRODUCT_IMAGE).
 *
 * @param root0 Component props.
 * @param root0.initialValues Optional starting values for edit mode.
 * @param root0.mode Whether the form is creating or editing a product.
 * @param root0.onSuccess Optional callback fired after a successful save.
 * @returns Product editor form.
 */
export default function ProductForm({ initialValues, mode, onSuccess }: ProductFormProps) {
  const t = useTranslations('catalog')
  const tCommon = useTranslations('common')
  const isRtl = useRTL()
  const { decimalPlaces } = useTenantCurrency()
  const taxItemClassOptions = useTaxItemClassOptions()

  const [loadingCategories, setLoadingCategories] = useState(false)
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)
  const canUpdateProduct = useHasPermission('products', 'update')

  /** Validation schema mirrors the persisted product payload used by the API. */
  const productFormSchema = useMemo(
    () =>
      z.object({
        id: z.string().optional(),
        service_category_code: z.string().trim().min(1, tCommon('required')),
        product_code: z.string().trim().optional(),
        product_name: z.string().trim().min(1, tCommon('required')),
        product_name2: z.string().trim().optional(),
        product_unit: z.enum(['piece', 'kg', 'item']),
        default_sell_price: z.number().min(0, tCommon('required')),
        min_quantity: z.number().min(0).optional(),
        turnaround_hh: z.number().min(0).optional(),
        tax_item_class_code: z.string().nullable().optional(),
        is_active: z.boolean().default(true),
        product_image: z.string().nullable().optional(),
        product_icon: z.string().nullable().optional(),
      }),
    [tCommon]
  )

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      service_category_code: initialValues?.service_category_code ?? '',
      product_code: initialValues?.product_code ?? '',
      product_name: initialValues?.product_name ?? '',
      product_name2: initialValues?.product_name2 ?? '',
      product_unit: initialValues?.product_unit ?? 'piece',
      default_sell_price: Number(initialValues?.default_sell_price ?? 0),
      min_quantity:
        initialValues?.min_quantity !== undefined ? Number(initialValues.min_quantity) : undefined,
      turnaround_hh:
        initialValues?.turnaround_hh !== undefined ? Number(initialValues.turnaround_hh) : undefined,
      tax_item_class_code: initialValues?.tax_item_class_code ?? '',
      is_active: initialValues?.is_active ?? true,
      id: initialValues?.id,
      product_image: initialValues?.product_image ?? null,
      product_icon: initialValues?.product_icon ?? null,
    },
  })

  const currentValues = form.watch()
  // The MAIN image is managed by File Util; this read shares its cache, so the preview follows uploads.
  const mainImage = useFileAttachments({
    category: FILE_CATEGORIES.PRODUCT_IMAGE,
    entityId: currentValues.id ?? '',
    purposes: ['MAIN'],
    source: FILE_SOURCES.PRODUCT_SETUP,
    enabled: mode === 'edit',
  })
  const mainImageUrl = mainImage.files[0]?.thumbUrl ?? mainImage.files[0]?.url ?? currentValues.product_image ?? null
  const categoryOptions = categories.map((category) => ({
    value: category.code,
    label: isRtl ? category.name2 || category.name : category.name,
  }))

  const unitOptions = [
    { value: 'piece', label: t('unitPiece') },
    { value: 'kg', label: t('unitKg') },
    { value: 'item', label: isRtl ? 'لكل عنصر' : 'Per Item' },
  ]

  useEffect(() => {
    let mounted = true

    async function loadCategories() {
      setLoadingCategories(true)
      setSubmitError(null)

      try {
        const response = await fetch('/api/v1/categories?enabled=true')
        const payload = (await response.json()) as CategoriesApiResponse

        if (!response.ok) {
          throw new Error(payload.error || tCommon('error'))
        }

        if (!mounted) {
          return
        }

        setCategories(
          (payload.data ?? []).map((category) => ({
            code: category.service_category_code,
            name: category.ctg_name,
            name2: category.ctg_name2,
          }))
        )
      } catch (error) {
        if (mounted) {
          setSubmitError(error instanceof Error ? error.message : tCommon('error'))
        }
      } finally {
        if (mounted) {
          setLoadingCategories(false)
        }
      }
    }

    void loadCategories()

    return () => {
      mounted = false
    }
  }, [tCommon])

  async function handleSubmit(values: ProductFormValues) {
    setSubmitError(null)
    setSubmitSuccess(null)

    const payload = {
      service_category_code: values.service_category_code,
      product_code: values.product_code || undefined,
      product_name: values.product_name,
      product_name2: values.product_name2 || undefined,
      product_unit: values.product_unit,
      default_sell_price: Number(values.default_sell_price),
      min_quantity: values.min_quantity !== undefined ? Number(values.min_quantity) : undefined,
      turnaround_hh: values.turnaround_hh !== undefined ? Number(values.turnaround_hh) : undefined,
      tax_item_class_code: values.tax_item_class_code || null,
      is_active: values.is_active ?? true,
      product_icon: values.product_icon ?? undefined,
    }

    try {
      const response = await fetch(mode === 'create' ? '/api/v1/products' : `/api/v1/products/${values.id}`, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = (await response.json()) as ProductSaveResponse

      if (!response.ok) {
        throw new Error(result.error || tCommon('error'))
      }

      const savedId = result.data?.id || values.id || ''
      form.reset({
        ...values,
        id: savedId,
      })
      setSubmitSuccess(result.message || tCommon('success'))
      onSuccess?.(savedId)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : tCommon('error'))
    }
  }

  return (
    <CmxCard className="overflow-hidden">
      <CmxCardHeader className="border-b border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] bg-[rgb(var(--cmx-surface-muted-rgb,236_242_248))]">
        <CmxCardTitle className="cmx-type-page-title text-[rgb(var(--cmx-text-primary-rgb,15_23_42))]">
          {mode === 'create' ? t('newProduct') : t('editProduct')}
        </CmxCardTitle>
        <CmxCardDescription className="text-sm text-[rgb(var(--cmx-text-secondary-rgb,51_65_85))]">
          {t('products')}
        </CmxCardDescription>
      </CmxCardHeader>

      <CmxCardContent className="p-4 md:p-6">
        <CmxForm
          form={form}
          onSubmit={handleSubmit}
          isPending={form.formState.isSubmitting}
          isDirty={form.formState.isDirty}
          showErrorSummary
          errorSummaryTitle={tCommon('error')}
          className="space-y-5"
        >
          {submitError ? (
            <CmxFormStatusBanner type="error" title={tCommon('error')} items={[submitError]} />
          ) : null}
          {submitSuccess ? (
            <CmxFormStatusBanner type="success" title={tCommon('success')} items={[submitSuccess]} />
          ) : null}

          <CmxFormSection
            title={mode === 'create' ? t('newProduct') : t('editProduct')}
            description={t('category')}
            layout="twoColumn"
            badge={loadingCategories ? <CmxStatusBadge size="sm" tone="neutral">{tCommon('loading')}</CmxStatusBadge> : null}
          >
            <CmxFormField name="service_category_code" label={t('category')} required>
              {({ id, describedBy, invalid, value, onChange, onBlur, name, ref }) => (
                <CmxSelect
                  id={id}
                  name={name}
                  ref={ref}
                  value={String(value ?? '')}
                  onChange={(event) => onChange(event.target.value)}
                  onBlur={onBlur}
                  options={categoryOptions}
                  placeholder={loadingCategories ? tCommon('loading') : '--'}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  disabled={loadingCategories}
                />
              )}
            </CmxFormField>

            <CmxFormField
              name="product_code"
              label={t('productCode')}
              optionalLabel={tCommon('optional')}
            >
              {({ id, describedBy, invalid, ...field }) => (
                <CmxInput
                  {...field}
                  id={id}
                  value={String(field.value ?? '')}
                  placeholder="PROD-00001"
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                />
              )}
            </CmxFormField>

            <CmxFormField name="product_name" label={t('productName')} required>
              {({ id, describedBy, invalid, ...field }) => (
                <CmxInput
                  {...field}
                  id={id}
                  value={String(field.value ?? '')}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                />
              )}
            </CmxFormField>

            <CmxFormField
              name="product_name2"
              label={t('productNameAr')}
              optionalLabel={tCommon('optional')}
            >
              {({ id, describedBy, invalid, ...field }) => (
                <CmxInput
                  {...field}
                  id={id}
                  value={String(field.value ?? '')}
                  dir="rtl"
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                />
              )}
            </CmxFormField>

            <CmxFormField name="product_unit" label={t('unit')} required>
              {({ id, describedBy, invalid, value, onChange, onBlur, name, ref }) => (
                <CmxSelect
                  id={id}
                  name={name}
                  ref={ref}
                  value={String(value ?? '')}
                  onChange={(event) => onChange(event.target.value)}
                  onBlur={onBlur}
                  options={unitOptions}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                />
              )}
            </CmxFormField>

            <CmxFormField
              name="is_active"
              label={t('status')}
              description={currentValues.is_active ? tCommon('active') : tCommon('inactive')}
              layout="inline"
            >
              {({ id, value, onChange }) => (
                <div className="flex items-center justify-between gap-3 rounded-[var(--cmx-radius-md,0.875rem)] border border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] bg-[rgb(var(--cmx-surface-muted-rgb,236_242_248))] px-4 py-3">
                  <CmxStatusBadge size="sm" tone={value ? 'success' : 'neutral'}>
                    {value ? tCommon('active') : tCommon('inactive')}
                  </CmxStatusBadge>
                  <CmxSwitch
                    id={id}
                    checked={Boolean(value)}
                    onCheckedChange={(checked) => onChange(checked)}
                  />
                </div>
              )}
            </CmxFormField>
          </CmxFormSection>

          <CmxFormSection title={t('pricing')} description={t('priceRegular')} layout="twoColumn">
            <CmxFormField name="default_sell_price" label={t('priceRegular')} required>
              {({ id, describedBy, invalid, value, onChange, onBlur, ref }) => (
                <CmxMoneyField
                  id={id}
                  ref={ref}
                  value={typeof value === 'number' ? value : null}
                  decimalPlaces={decimalPlaces}
                  min={0}
                  onValueChange={(v, _, isComplete) => {
                    if (isComplete) onChange(v)
                  }}
                  onBlur={onBlur}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                />
              )}
            </CmxFormField>


            <CmxFormField
              name="min_quantity"
              label={t('minQuantity')}
              optionalLabel={tCommon('optional')}
            >
              {({ id, describedBy, invalid, value, onChange, onBlur, name, ref }) => (
                <CmxInput
                  id={id}
                  name={name}
                  ref={ref}
                  type="number"
                  value={value ?? ''}
                  onChange={(event) =>
                    onChange(event.target.value === '' ? undefined : Number(event.target.value))
                  }
                  onBlur={onBlur}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                />
              )}
            </CmxFormField>

            <CmxFormField
              name="turnaround_hh"
              label={t('turnaround')}
              optionalLabel={tCommon('optional')}
              hint={t('turnaroundHours')}
            >
              {({ id, describedBy, invalid, value, onChange, onBlur, name, ref }) => (
                <CmxInput
                  id={id}
                  name={name}
                  ref={ref}
                  type="number"
                  step="0.1"
                  value={value ?? ''}
                  onChange={(event) =>
                    onChange(event.target.value === '' ? undefined : Number(event.target.value))
                  }
                  onBlur={onBlur}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                />
              )}
            </CmxFormField>


            <CmxFormField
              name="tax_item_class_code"
              label={t('taxItemClass.label')}
              hint={t('taxItemClass.hint')}
            >
              {({ id, describedBy, invalid, value, onChange, onBlur, name, ref }) => (
                <CmxSelect
                  id={id}
                  name={name}
                  ref={ref}
                  value={String(value ?? '')}
                  onChange={(event) => onChange(event.target.value)}
                  onBlur={onBlur}
                  options={taxItemClassOptions}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                />
              )}
            </CmxFormField>
          </CmxFormSection>

          <CmxFormSection
            title={t('productImageIconTitle')}
            description={t('imageHint')}
            layout="single"
            aside={
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-[var(--cmx-radius-lg,1.125rem)] border border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] bg-white text-3xl shadow-inner">
                    {mainImageUrl ? (
                      <img
                        src={mainImageUrl}
                        alt={currentValues.product_name || t('productName')}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      currentValues.product_icon || '👔'
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-[rgb(var(--cmx-text-primary-rgb,15_23_42))]">
                      {currentValues.product_name || t('productName')}
                    </p>
                    <p className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                      {currentValues.product_name2 || t('productNameAr')}
                    </p>
                  </div>
                </div>
              </div>
            }
          >
            <div className="grid gap-4 md:grid-cols-2">
              <CmxFormField
                name="product_icon"
                label={t('productIcon')}
                optionalLabel={tCommon('optional')}
                hint={t('iconHint')}
              >
                {({ id, describedBy, invalid, ...field }) => (
                  <CmxInput
                    {...field}
                    id={id}
                    value={String(field.value ?? '')}
                    maxLength={8}
                    onChange={(event) => field.onChange(event.target.value || null)}
                    placeholder="e.g. 👔"
                    aria-describedby={describedBy}
                    aria-invalid={invalid}
                  />
                )}
              </CmxFormField>
            </div>
          </CmxFormSection>

          {mode === 'edit' && currentValues.id ? (
            <FileAttachments
              title={t('productImage')}
              category={FILE_CATEGORIES.PRODUCT_IMAGE}
              entityId={currentValues.id}
              source={FILE_SOURCES.PRODUCT_SETUP}
              readOnly={!canUpdateProduct}
            />
          ) : null}

          <CmxFormActions
            primaryLabel={mode === 'create' ? tCommon('create') : tCommon('update')}
            loading={form.formState.isSubmitting}
            isDirty={form.formState.isDirty}
            dirtyLabel={tCommon('unsavedChanges')}
            sticky
          />
        </CmxForm>

        {mode === 'edit' && currentValues.id ? (
          <ProductSpeedPricingSection
            productId={currentValues.id}
            productLabel={(isRtl ? currentValues.product_name2 || currentValues.product_name : currentValues.product_name) || currentValues.id}
          />
        ) : (
          <p className="mt-5 text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('speedPricing.product.saveFirst')}</p>
        )}
      </CmxCardContent>
    </CmxCard>
  )
}
