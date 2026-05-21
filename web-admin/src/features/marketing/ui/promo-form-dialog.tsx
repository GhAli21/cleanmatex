'use client';
/* eslint-disable react-hooks/set-state-in-effect */

/**
 * Promo Code Create / Edit Dialog
 *
 * Used for both create and edit flows. When `promo` is supplied the dialog
 * operates in edit mode.
 */

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForm, Controller, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
  CmxDialogFooter,
} from '@ui/overlays';
import { CmxButton } from '@ui/primitives';
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

// ---------------------------------------------------------------------------
// Schema (mirrors server-side schema — client-side for instant validation)
// ---------------------------------------------------------------------------

const schema = z.object({
  promo_code: z
    .string()
    .min(1, 'Required')
    .max(50)
    .regex(/^[A-Z0-9_-]+$/, 'Uppercase letters, digits, hyphens, underscores only'),
  promo_name: z.string().min(1, 'Required').max(200),
  promo_name2: z.string().max(200).optional(),
  discount_type: z.enum(['percentage', 'fixed_amount']),
  discount_value: z.coerce.number().positive('Must be positive'),
  max_discount_amount: z.coerce.number().positive().optional(),
  min_order_amount: z.coerce.number().nonnegative().default(0),
  max_uses: z.coerce.number().int().positive().optional(),
  max_uses_per_customer: z.coerce.number().int().positive().optional(),
  valid_from: z.string().min(1, 'Required'),
  valid_to: z.string().optional(),
  is_enabled: z.boolean().default(true),
});

type FormValues = z.infer<typeof schema>;

interface PromoFormDialogProps {
  open: boolean;
  promo?: PromoCode;
  onClose: () => void;
  onSuccess: () => void;
}

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
      discount_type: 'percentage',
      discount_value: 0,
      min_order_amount: 0,
      valid_from: new Date().toISOString().slice(0, 16),
      valid_to: '',
      is_enabled: true,
    },
  });

  // Reset form when editing different promo.
  useEffect(() => {
    if (promo) {
      form.reset({
        promo_code: promo.promo_code,
        promo_name: promo.promo_name,
        promo_name2: promo.promo_name2 ?? '',
        discount_type: promo.discount_type,
        discount_value: promo.discount_value,
        max_discount_amount: promo.max_discount_amount,
        min_order_amount: promo.min_order_amount,
        max_uses: promo.max_uses,
        max_uses_per_customer: promo.max_uses_per_customer ?? undefined,
        valid_from: promo.valid_from?.slice(0, 16) ?? '',
        valid_to: promo.valid_to?.slice(0, 16) ?? '',
        is_enabled: promo.is_enabled,
      });
    } else {
      form.reset({
        promo_code: '',
        promo_name: '',
        promo_name2: '',
        discount_type: 'percentage',
        discount_value: 0,
        min_order_amount: 0,
        valid_from: new Date().toISOString().slice(0, 16),
        valid_to: '',
        is_enabled: true,
      });
    }
    setServerError(null);
  }, [promo, form]);

  const onSubmit = async (values: FormValues) => {
    setServerError(null);

    const payload = {
      ...values,
      valid_from: values.valid_from ? new Date(values.valid_from).toISOString() : new Date().toISOString(),
      valid_to: values.valid_to ? new Date(values.valid_to).toISOString() : undefined,
    };

    let result;
    if (isEdit && promo) {
      result = await updatePromoCode(promo.id, payload);
    } else {
      result = await createPromoCode(payload);
    }

    if (result.success === false) {
      setServerError(result.error);
    } else {
      onSuccess();
    }
  };

  const { formState: { isSubmitting } } = form;

  return (
    <CmxDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <CmxDialogContent className="max-w-lg">
        <CmxDialogHeader>
          <CmxDialogTitle>
            {isEdit ? t('edit') : t('create')}
          </CmxDialogTitle>
        </CmxDialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <Label>{t('fields.code')}</Label>
              <CmxInput
                {...form.register('promo_code')}
                className="uppercase"
                disabled={isEdit}
                placeholder="SUMMER20"
              />
              {form.formState.errors.promo_code && (
                <p className="text-destructive text-xs mt-1">{form.formState.errors.promo_code.message}</p>
              )}
            </div>

            <div className="col-span-2 sm:col-span-1">
              <Label>{t('fields.name')}</Label>
              <CmxInput {...form.register('promo_name')} placeholder="Summer Discount" />
              {form.formState.errors.promo_name && (
                <p className="text-destructive text-xs mt-1">{form.formState.errors.promo_name.message}</p>
              )}
            </div>

            <div className="col-span-2 sm:col-span-1">
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
                      <CmxSelectDropdownItem value="percentage">%</CmxSelectDropdownItem>
                      <CmxSelectDropdownItem value="fixed_amount">Fixed amount</CmxSelectDropdownItem>
                    </CmxSelectDropdownContent>
                  </CmxSelectDropdown>
                )}
              />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <Label>{t('fields.discountValue')}</Label>
              <CmxInput type="number" step="0.01" {...form.register('discount_value')} />
              {form.formState.errors.discount_value && (
                <p className="text-destructive text-xs mt-1">{form.formState.errors.discount_value.message}</p>
              )}
            </div>

            <div>
              <Label>{t('fields.maxUses')}</Label>
              <CmxInput type="number" step="1" {...form.register('max_uses')} placeholder="Unlimited" />
            </div>

            <div>
              <Label>{t('fields.minOrder')}</Label>
              <CmxInput type="number" step="0.01" {...form.register('min_order_amount')} />
            </div>

            <div>
              <Label>{t('fields.validFrom')}</Label>
              <CmxInput type="datetime-local" {...form.register('valid_from')} />
              {form.formState.errors.valid_from && (
                <p className="text-destructive text-xs mt-1">{form.formState.errors.valid_from.message}</p>
              )}
            </div>

            <div>
              <Label>{t('fields.validTo')}</Label>
              <CmxInput type="datetime-local" {...form.register('valid_to')} />
            </div>
          </div>

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
