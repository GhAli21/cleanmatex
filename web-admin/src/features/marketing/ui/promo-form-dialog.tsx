'use client';

/**
 * Promo Code Create / Edit Dialog
 *
 * Full field set for org_promotions_mst: identity, discount, limits,
 * validity, stacking, and enablement. Empty promo code = auto-apply.
 */

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForm, useWatch, Controller, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
  CmxDialogFooter,
} from '@ui/overlays';
import { CmxButton, CmxMoneyFieldController, CmxTextarea } from '@ui/primitives';
import { CmxInput } from '@ui/primitives';
import { CmxSwitch } from '@ui/primitives';
import { Label } from '@ui/primitives';
import {
  CmxSelectDropdown,
  CmxSelectDropdownTrigger,
  CmxSelectDropdownValue,
  CmxSelectDropdownContent,
  CmxSelectDropdownItem,
} from '@ui/forms';
import { Alert, AlertDescription } from '@ui/primitives';
import { createPromoCode, updatePromoCode } from '@/app/actions/marketing/promo-actions';
import type { PromoCode } from '@/lib/types/payment';

/** Format an ISO timestamp for `<input type="datetime-local">` in local TZ. */
function toLocalDatetimeInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Optional positive number — empty / 0 / NaN → null (unlimited / no cap).
 * Accepts string digits from `<input type="number">` without valueAsNumber.
 */
const optionalPositiveOrNull = z.preprocess((val) => {
  if (val === '' || val === null || val === undefined) return null;
  if (typeof val === 'number' && Number.isNaN(val)) return null;
  const n = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}, z.union([z.number().positive(), z.null()]));

const optionalPositiveIntOrNull = z.preprocess((val) => {
  if (val === '' || val === null || val === undefined) return null;
  if (typeof val === 'number' && Number.isNaN(val)) return null;
  const n = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}, z.union([z.number().int().positive(), z.null()]));

const schema = z.object({
  promo_code: z
    .string()
    .max(50)
    .regex(/^$|^[A-Z0-9_-]+$/, 'Uppercase letters, digits, hyphens, underscores only'),
  promo_name: z.string().min(1, 'Required').max(200),
  promo_name2: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  description2: z.string().max(500).optional(),
  discount_type: z.enum(['percentage', 'fixed_amount']),
  discount_value: z.coerce.number().positive('Must be positive'),
  max_discount_amount: optionalPositiveOrNull,
  min_order_amount: z.coerce.number().nonnegative().default(0),
  max_order_amount: optionalPositiveOrNull,
  applicable_categories: z.string().optional(),
  applicable_customer_grps: z.string().optional(),
  /** null = unlimited */
  max_uses: optionalPositiveIntOrNull,
  max_uses_unlimited: z.boolean().default(true),
  max_uses_per_customer: optionalPositiveIntOrNull,
  valid_from: z.string().min(1, 'Required'),
  valid_to: z.string().optional(),
  is_enabled: z.boolean().default(true),
  stackable: z.boolean().default(false),
  stacking_group: z.string().max(100).optional(),
  max_stacking_discount: optionalPositiveOrNull,
});

type FormValues = z.infer<typeof schema>;

function toOptionalNumber(v: unknown): number | null {
  if (v === '' || v === null || v === undefined) return null;
  if (typeof v === 'number' && Number.isNaN(v)) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

interface PromoFormDialogProps {
  open: boolean;
  promo?: PromoCode;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Create or edit a promotion / promo code.
 */
export function PromoFormDialog({ open, promo, onClose, onSuccess }: PromoFormDialogProps) {
  const t = useTranslations('marketing.promos');
  const tCommon = useTranslations('common');

  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = !!promo;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      promo_code: '',
      promo_name: '',
      promo_name2: '',
      description: '',
      description2: '',
      discount_type: 'percentage',
      discount_value: 10,
      max_discount_amount: null,
      min_order_amount: 0,
      max_order_amount: null,
      applicable_categories: '',
      applicable_customer_grps: '',
      max_uses: null,
      max_uses_unlimited: true,
      max_uses_per_customer: 1,
      valid_from: toLocalDatetimeInput(new Date().toISOString()),
      valid_to: '',
      is_enabled: true,
      stackable: false,
      stacking_group: '',
      max_stacking_discount: null,
    },
  });

  const discountType = useWatch({ control: form.control, name: 'discount_type' });
  const stackable = useWatch({ control: form.control, name: 'stackable' });
  const maxUsesUnlimited = useWatch({ control: form.control, name: 'max_uses_unlimited' });

  const promoSignature = promo?.id ?? 'create';
  const [prevPromoSignature, setPrevPromoSignature] = useState(promoSignature);
  if (prevPromoSignature !== promoSignature) {
    setPrevPromoSignature(promoSignature);
    setServerError(null);
  }

  useEffect(() => {
    if (promo) {
      const unlimited = promo.max_uses == null;
      form.reset({
        promo_code: promo.promo_code ?? '',
        promo_name: promo.promo_name,
        promo_name2: promo.promo_name2 ?? '',
        description: promo.description ?? '',
        description2: promo.description2 ?? '',
        discount_type: promo.discount_type,
        discount_value: promo.discount_value,
        max_discount_amount: promo.max_discount_amount ?? null,
        min_order_amount: promo.min_order_amount,
        max_order_amount: promo.max_order_amount ?? null,
        applicable_categories: promo.applicable_categories?.join(', ') ?? '',
        applicable_customer_grps: promo.applicable_customer_grps?.join(', ') ?? '',
        max_uses: unlimited ? null : promo.max_uses,
        max_uses_unlimited: unlimited,
        max_uses_per_customer: promo.max_uses_per_customer ?? 1,
        valid_from: toLocalDatetimeInput(promo.valid_from),
        valid_to: toLocalDatetimeInput(promo.valid_to),
        is_enabled: promo.is_enabled,
        stackable: promo.stackable ?? false,
        stacking_group: promo.stacking_group ?? '',
        max_stacking_discount: promo.max_stacking_discount ?? null,
      });
    } else {
      form.reset({
        promo_code: '',
        promo_name: '',
        promo_name2: '',
        description: '',
        description2: '',
        discount_type: 'percentage',
        discount_value: 10,
        max_discount_amount: null,
        min_order_amount: 0,
        max_order_amount: null,
        applicable_categories: '',
        applicable_customer_grps: '',
        max_uses: null,
        max_uses_unlimited: true,
        max_uses_per_customer: 1,
        valid_from: toLocalDatetimeInput(new Date().toISOString()),
        valid_to: '',
        is_enabled: true,
        stackable: false,
        stacking_group: '',
        max_stacking_discount: null,
      });
    }
  }, [promo, form]);

  const onSubmit = async (values: FormValues) => {
    setServerError(null);

    // Unlimited switch or empty field both persist as SQL NULL.
    const maxUses = values.max_uses_unlimited
      ? null
      : toOptionalNumber(values.max_uses);

    if (!values.max_uses_unlimited && maxUses == null) {
      form.setError('max_uses', { message: t('errors.maxUsesRequired') });
      return;
    }

    const payload = {
      promo_code: values.promo_code.trim().toUpperCase() || null,
      promo_name: values.promo_name,
      promo_name2: values.promo_name2 || null,
      description: values.description || null,
      description2: values.description2 || null,
      discount_type: values.discount_type,
      discount_value: values.discount_value,
      max_discount_amount: toOptionalNumber(values.max_discount_amount),
      min_order_amount: values.min_order_amount,
      max_order_amount: toOptionalNumber(values.max_order_amount),
      applicable_categories: splitCsv(values.applicable_categories ?? ''),
      applicable_customer_grps: splitCsv(values.applicable_customer_grps ?? ''),
      max_uses: maxUses,
      max_uses_per_customer: toOptionalNumber(values.max_uses_per_customer) ?? 1,
      valid_from: values.valid_from
        ? new Date(values.valid_from).toISOString()
        : new Date().toISOString(),
      valid_to: values.valid_to ? new Date(values.valid_to).toISOString() : null,
      is_enabled: values.is_enabled,
      stackable: values.stackable,
      stacking_group: values.stacking_group || null,
      max_stacking_discount: toOptionalNumber(values.max_stacking_discount),
    };

    const result =
      isEdit && promo
        ? await updatePromoCode(promo.id, payload)
        : await createPromoCode(payload);

    if (result.success === false) {
      setServerError(result.error);
    } else {
      onSuccess();
    }
  };

  const {
    formState: { isSubmitting },
  } = form;

  return (
    <CmxDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <CmxDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <CmxDialogHeader>
          <CmxDialogTitle>{isEdit ? t('edit') : t('create')}</CmxDialogTitle>
        </CmxDialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 py-2">
          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          {/* Identity */}
          <section className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">{t('sections.identity')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>{t('fields.code')}</Label>
                <Controller
                  control={form.control}
                  name="promo_code"
                  render={({ field }) => (
                    <CmxInput
                      className="uppercase"
                      disabled={isEdit && !!promo?.promo_code}
                      placeholder={t('fields.codePlaceholder')}
                      value={field.value}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  )}
                />
                <p className="text-xs text-muted-foreground mt-1">{t('fields.codeHint')}</p>
                {form.formState.errors.promo_code && (
                  <p className="text-destructive text-xs mt-1">
                    {form.formState.errors.promo_code.message}
                  </p>
                )}
              </div>

              <div>
                <Label>{t('fields.name')}</Label>
                <CmxInput {...form.register('promo_name')} />
                {form.formState.errors.promo_name && (
                  <p className="text-destructive text-xs mt-1">
                    {form.formState.errors.promo_name.message}
                  </p>
                )}
              </div>

              <div>
                <Label>{t('fields.name2')}</Label>
                <CmxInput {...form.register('promo_name2')} dir="rtl" />
              </div>

              <div className="sm:col-span-2">
                <Label>{t('fields.description')}</Label>
                <CmxTextarea {...form.register('description')} rows={2} />
              </div>

              <div className="sm:col-span-2">
                <Label>{t('fields.description2')}</Label>
                <CmxTextarea {...form.register('description2')} rows={2} dir="rtl" />
              </div>
            </div>
          </section>

          {/* Discount */}
          <section className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">{t('sections.discount')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>{t('fields.discountType')}</Label>
                <Controller
                  control={form.control}
                  name="discount_type"
                  render={({ field }) => (
                    <CmxSelectDropdown value={field.value} onValueChange={field.onChange}>
                      <CmxSelectDropdownTrigger>
                        <CmxSelectDropdownValue />
                      </CmxSelectDropdownTrigger>
                      <CmxSelectDropdownContent>
                        <CmxSelectDropdownItem value="percentage">
                          {t('discountTypeLabels.percentage')}
                        </CmxSelectDropdownItem>
                        <CmxSelectDropdownItem value="fixed_amount">
                          {t('discountTypeLabels.fixed_amount')}
                        </CmxSelectDropdownItem>
                      </CmxSelectDropdownContent>
                    </CmxSelectDropdown>
                  )}
                />
              </div>

              <div>
                {discountType === 'fixed_amount' ? (
                  <CmxMoneyFieldController
                    name="discount_value"
                    control={form.control}
                    label={t('fields.discountValue')}
                    min={0}
                  />
                ) : (
                  <div>
                    <Label>{t('fields.discountValue')}</Label>
                    <CmxInput
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      {...form.register('discount_value', { valueAsNumber: true })}
                    />
                    {form.formState.errors.discount_value && (
                      <p className="text-destructive text-xs mt-1">
                        {form.formState.errors.discount_value.message}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {discountType === 'percentage' && (
                <div>
                  <CmxMoneyFieldController
                    name="max_discount_amount"
                    control={form.control}
                    label={t('fields.maxDiscountAmount')}
                    min={0}
                  />
                </div>
              )}
            </div>
          </section>

          {/* Limits */}
          <section className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">{t('sections.limits')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2 space-y-2">
                <div className="flex items-center gap-2">
                  <Controller
                    control={form.control}
                    name="max_uses_unlimited"
                    render={({ field }) => (
                      <CmxSwitch
                        id="max_uses_unlimited"
                        checked={field.value}
                        onCheckedChange={(checked) => {
                          field.onChange(checked);
                          if (checked) {
                            form.setValue('max_uses', null, { shouldValidate: true });
                          } else if (form.getValues('max_uses') == null) {
                            form.setValue('max_uses', 1, { shouldValidate: true });
                          }
                        }}
                      />
                    )}
                  />
                  <Label htmlFor="max_uses_unlimited">{t('fields.unlimited')}</Label>
                </div>
                {!maxUsesUnlimited && (
                  <div>
                    <Label>{t('fields.maxUses')}</Label>
                    <Controller
                      control={form.control}
                      name="max_uses"
                      render={({ field }) => (
                        <CmxInput
                          type="number"
                          step="1"
                          min="1"
                          value={field.value == null ? '' : String(field.value)}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw === '') {
                              field.onChange(null);
                              return;
                            }
                            const n = Number(raw);
                            field.onChange(Number.isFinite(n) && n > 0 ? Math.floor(n) : null);
                          }}
                        />
                      )}
                    />
                    {form.formState.errors.max_uses && (
                      <p className="text-destructive text-xs mt-1">
                        {form.formState.errors.max_uses.message}
                      </p>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">{t('fields.maxUsesHint')}</p>
              </div>

              <div>
                <Label>{t('fields.maxUsesPerCustomer')}</Label>
                <Controller
                  control={form.control}
                  name="max_uses_per_customer"
                  render={({ field }) => (
                    <CmxInput
                      type="number"
                      step="1"
                      min="1"
                      value={field.value == null ? '' : String(field.value)}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === '') {
                          field.onChange(null);
                          return;
                        }
                        const n = Number(raw);
                        field.onChange(Number.isFinite(n) && n > 0 ? Math.floor(n) : null);
                      }}
                    />
                  )}
                />
              </div>

              <div>
                <CmxMoneyFieldController
                  name="min_order_amount"
                  control={form.control}
                  label={t('fields.minOrder')}
                  min={0}
                />
              </div>

              <div>
                <CmxMoneyFieldController
                  name="max_order_amount"
                  control={form.control}
                  label={t('fields.maxOrderAmount')}
                  min={0}
                />
              </div>

              <div className="sm:col-span-2">
                <Label>{t('fields.applicableCategories')}</Label>
                <CmxInput
                  {...form.register('applicable_categories')}
                  placeholder={t('fields.categoriesPlaceholder')}
                />
                <p className="text-xs text-muted-foreground mt-1">{t('fields.categoriesHint')}</p>
              </div>

              <div className="sm:col-span-2">
                <Label>{t('fields.applicableCustomerGroups')}</Label>
                <CmxInput
                  {...form.register('applicable_customer_grps')}
                  placeholder={t('fields.customerGroupsPlaceholder')}
                />
              </div>
            </div>
          </section>

          {/* Validity */}
          <section className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">{t('sections.validity')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>{t('fields.validFrom')}</Label>
                <CmxInput type="datetime-local" {...form.register('valid_from')} />
                {form.formState.errors.valid_from && (
                  <p className="text-destructive text-xs mt-1">
                    {form.formState.errors.valid_from.message}
                  </p>
                )}
              </div>

              <div>
                <Label>{t('fields.validTo')}</Label>
                <CmxInput type="datetime-local" {...form.register('valid_to')} />
                <p className="text-xs text-muted-foreground mt-1">{t('fields.validToHint')}</p>
              </div>
            </div>
          </section>

          {/* Stacking */}
          <section className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">{t('sections.stacking')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-2 sm:col-span-2">
                <Controller
                  control={form.control}
                  name="stackable"
                  render={({ field }) => (
                    <CmxSwitch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      id="stackable"
                    />
                  )}
                />
                <Label htmlFor="stackable">{t('fields.stackable')}</Label>
              </div>

              {stackable && (
                <>
                  <div>
                    <Label>{t('fields.stackingGroup')}</Label>
                    <CmxInput {...form.register('stacking_group')} />
                  </div>
                  <div>
                    <CmxMoneyFieldController
                      name="max_stacking_discount"
                      control={form.control}
                      label={t('fields.maxStackingDiscount')}
                      min={0}
                    />
                  </div>
                </>
              )}
            </div>
          </section>

          <div className="flex items-center gap-2">
            <Controller
              control={form.control}
              name="is_enabled"
              render={({ field }) => (
                <CmxSwitch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  id="is_enabled"
                />
              )}
            />
            <Label htmlFor="is_enabled">{tCommon('enabled')}</Label>
          </div>

          <CmxDialogFooter>
            <CmxButton type="button" variant="outline" onClick={onClose}>
              {tCommon('cancel')}
            </CmxButton>
            <CmxButton type="submit" disabled={isSubmitting}>
              {isSubmitting ? tCommon('loading') : tCommon('save')}
            </CmxButton>
          </CmxDialogFooter>
        </form>
      </CmxDialogContent>
    </CmxDialog>
  );
}
