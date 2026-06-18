'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogFooter,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays';
import { CmxButton, CmxInput, CmxTextarea } from '@ui/primitives';
import { cmxMessage } from '@ui/feedback';
import { updateCardBrandConfig } from '@/app/actions/payment-config/card-brands-actions';
import {
  updateCardBrandConfigSchema,
  type UpdateCardBrandConfigFormInput,
  type UpdateCardBrandConfigFormValues,
} from '../model/card-brand-config-schema';
import type { OrgCardBrandConfig } from '@/lib/types/payment';

/**
 * Props for the tenant card brand edit dialog.
 */
interface CardBrandConfigDialogProps {
  brand: OrgCardBrandConfig;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * The dialog allows tenants to override only presentation fields while keeping
 * the HQ card brand code locked for payment data consistency.
 * @param root0
 * @param root0.brand
 * @param root0.open
 * @param root0.onClose
 * @param root0.onSuccess
 */
export function CardBrandConfigDialog({
  brand,
  open,
  onClose,
  onSuccess,
}: CardBrandConfigDialogProps) {
  const t = useTranslations('paymentConfig');
  const [isPending, startTransition] = useTransition();

  const form = useForm<UpdateCardBrandConfigFormInput, unknown, UpdateCardBrandConfigFormValues>({
    resolver: zodResolver(updateCardBrandConfigSchema),
    defaultValues: {
      name: brand.name,
      name2: brand.name2 ?? '',
      description: brand.description ?? '',
      description2: brand.description2 ?? '',
      rec_order: brand.rec_order ?? null,
    },
  });

  /**
   * Saves tenant-visible label and order overrides for the selected card brand.
   * @param values
   */
  const handleSubmit = (values: UpdateCardBrandConfigFormValues) => {
    startTransition(async () => {
      const result = await updateCardBrandConfig(brand.id, values);

      if (result.success) {
        cmxMessage.success(t('cardBrands.saved'));
        onSuccess();
      } else {
        cmxMessage.error(result.error ?? t('common.error'));
      }
    });
  };

  return (
    <CmxDialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <CmxDialogContent className="max-w-2xl">
        <CmxDialogHeader>
          <CmxDialogTitle>{t('cardBrands.editTitle')}</CmxDialogTitle>
        </CmxDialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-2">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('cardBrands.code')}</label>
              <CmxInput value={brand.card_brand_code} disabled />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('cardBrands.recOrder')}</label>
              <CmxInput
                type="number"
                min={0}
                step={1}
                {...form.register('rec_order', {
                  setValueAs: (value) => (value === '' ? null : Number(value)),
                })}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('cardBrands.name')}</label>
              <CmxInput {...form.register('name')} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('cardBrands.name2')}</label>
              <CmxInput {...form.register('name2')} dir="rtl" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('cardBrands.description')}</label>
              <CmxTextarea rows={4} {...form.register('description')} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('cardBrands.description2')}</label>
              <CmxTextarea rows={4} {...form.register('description2')} dir="rtl" />
            </div>
          </div>

          <CmxDialogFooter>
            <CmxButton type="button" variant="outline" onClick={onClose} disabled={isPending}>
              {t('common.cancel')}
            </CmxButton>
            <CmxButton type="submit" disabled={isPending}>
              {isPending ? t('common.saving') : t('common.save')}
            </CmxButton>
          </CmxDialogFooter>
        </form>
      </CmxDialogContent>
    </CmxDialog>
  );
}
