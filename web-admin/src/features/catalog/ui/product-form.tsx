'use client'

/**
 * Product form is the first real feature screen wired to the refreshed
 * `@ui/forms` layer so the new hierarchy, spacing, and recovery states can
 * be reviewed in an actual business workflow.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
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
import {
  Badge,
  CmxButton,
  CmxCard,
  CmxCardContent,
  CmxCardDescription,
  CmxCardHeader,
  CmxCardTitle,
  CmxInput,
  CmxSelect,
  CmxSwitch,
} from '@ui/primitives'
import { useRTL } from '@/lib/hooks/useRTL'

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

/**
 * Product form connects the refreshed form primitives to the catalog product
 * workflow while preserving the existing create, edit, and image-upload APIs.
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
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [loadingCategories, setLoadingCategories] = useState(false)
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)
  const [imageUploading, setImageUploading] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)

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
        default_express_sell_price: z.number().min(0).optional(),
        min_quantity: z.number().min(0).optional(),
        turnaround_hh: z.number().min(0).optional(),
        turnaround_hh_express: z.number().min(0).optional(),
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
      default_express_sell_price:
        initialValues?.default_express_sell_price !== undefined
          ? Number(initialValues.default_express_sell_price)
          : undefined,
      min_quantity:
        initialValues?.min_quantity !== undefined ? Number(initialValues.min_quantity) : undefined,
      turnaround_hh:
        initialValues?.turnaround_hh !== undefined ? Number(initialValues.turnaround_hh) : undefined,
      turnaround_hh_express:
        initialValues?.turnaround_hh_express !== undefined
          ? Number(initialValues.turnaround_hh_express)
          : undefined,
      is_active: initialValues?.is_active ?? true,
      id: initialValues?.id,
      product_image: initialValues?.product_image ?? null,
      product_icon: initialValues?.product_icon ?? null,
    },
  })

  const currentValues = form.watch()
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

  async function handleImageUpload(file: File) {
    const productId = form.getValues('id')
    if (!productId) {
      return
    }

    setImageUploading(true)
    setImageError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`/api/v1/products/${productId}/image`, {
        method: 'POST',
        body: formData,
      })
      const payload = (await response.json()) as { error?: string; url?: string }

      if (!response.ok || !payload.url) {
        throw new Error(payload.error || tCommon('error'))
      }

      form.setValue('product_image', payload.url, { shouldDirty: true })
    } catch (error) {
      setImageError(error instanceof Error ? error.message : tCommon('error'))
    } finally {
      setImageUploading(false)
    }
  }

  async function handleImageRemove() {
    const productId = form.getValues('id')
    if (!productId) {
      return
    }

    setImageUploading(true)
    setImageError(null)

    try {
      const response = await fetch(`/api/v1/products/${productId}/image`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string }
        throw new Error(payload.error || tCommon('error'))
      }

      form.setValue('product_image', null, { shouldDirty: true })
    } catch (error) {
      setImageError(error instanceof Error ? error.message : tCommon('error'))
    } finally {
      setImageUploading(false)
    }
  }

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
      default_express_sell_price:
        values.default_express_sell_price !== undefined
          ? Number(values.default_express_sell_price)
          : undefined,
      min_quantity: values.min_quantity !== undefined ? Number(values.min_quantity) : undefined,
      turnaround_hh: values.turnaround_hh !== undefined ? Number(values.turnaround_hh) : undefined,
      turnaround_hh_express:
        values.turnaround_hh_express !== undefined ? Number(values.turnaround_hh_express) : undefined,
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
          {imageError ? (
            <CmxFormStatusBanner type="warning" title={tCommon('error')} items={[imageError]} />
          ) : null}

          <CmxFormSection
            title={mode === 'create' ? t('newProduct') : t('editProduct')}
            description={t('category')}
            layout="twoColumn"
            badge={loadingCategories ? <Badge variant="secondary">{tCommon('loading')}</Badge> : null}
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
                  <Badge variant={value ? 'success' : 'secondary'}>
                    {value ? tCommon('active') : tCommon('inactive')}
                  </Badge>
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
              {({ id, describedBy, invalid, value, onChange, onBlur, name, ref }) => (
                <CmxInput
                  id={id}
                  name={name}
                  ref={ref}
                  type="number"
                  step="0.001"
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
              name="default_express_sell_price"
              label={t('priceExpress')}
              optionalLabel={tCommon('optional')}
            >
              {({ id, describedBy, invalid, value, onChange, onBlur, name, ref }) => (
                <CmxInput
                  id={id}
                  name={name}
                  ref={ref}
                  type="number"
                  step="0.001"
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
              name="turnaround_hh_express"
              label={t('express')}
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
          </CmxFormSection>

          <CmxFormSection
            title={t('productImageIconTitle')}
            description={t('imageHint')}
            layout="single"
            aside={
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-[var(--cmx-radius-lg,1.125rem)] border border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] bg-white text-3xl shadow-inner">
                    {currentValues.product_image ? (
                      <img
                        src={currentValues.product_image}
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
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => {
                const nextFile = event.target.files?.[0]
                if (nextFile) {
                  void handleImageUpload(nextFile)
                }
                event.target.value = ''
              }}
            />

            <div className="grid gap-4 md:grid-cols-2">
              {mode === 'edit' ? (
                <div className="rounded-[var(--cmx-radius-md,0.875rem)] border border-dashed border-[rgb(var(--cmx-border-rgb,203_213_225))] bg-[rgb(var(--cmx-surface-muted-rgb,236_242_248))] p-4">
                  <p className="cmx-type-field-label text-[rgb(var(--cmx-text-primary-rgb,15_23_42))]">
                    {t('productImage')}
                  </p>
                  <p className="mt-1 text-sm text-[rgb(var(--cmx-text-secondary-rgb,51_65_85))]">
                    {t('imageHint')}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <CmxButton
                      type="button"
                      variant="outline"
                      disabled={imageUploading}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {imageUploading ? tCommon('loading') : t('uploadImage')}
                    </CmxButton>
                    {currentValues.product_image ? (
                      <CmxButton
                        type="button"
                        variant="outline"
                        disabled={imageUploading}
                        onClick={() => {
                          void handleImageRemove()
                        }}
                      >
                        {t('removeImage')}
                      </CmxButton>
                    ) : null}
                  </div>
                </div>
              ) : null}

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

          <CmxFormActions
            primaryLabel={mode === 'create' ? tCommon('create') : tCommon('update')}
            loading={form.formState.isSubmitting}
            isDirty={form.formState.isDirty}
            dirtyLabel={tCommon('unsavedChanges')}
            sticky
          />
        </CmxForm>
      </CmxCardContent>
    </CmxCard>
  )
}
