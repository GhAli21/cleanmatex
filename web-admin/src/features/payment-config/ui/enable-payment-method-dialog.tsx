'use client';

import { useState, useTransition, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CmxDialog, CmxDialogContent, CmxDialogHeader, CmxDialogTitle, CmxDialogFooter } from '@ui/overlays';
import { CmxButton } from '@ui/primitives';
import { CmxInput } from '@ui/primitives';
import { CmxSelectDropdown, CmxSelectDropdownTrigger, CmxSelectDropdownValue, CmxSelectDropdownContent, CmxSelectDropdownItem } from '@ui/forms';
import { cmxMessage } from '@ui/feedback';
import { createPaymentMethodConfigSchema, type CreatePaymentMethodConfigFormValues } from '../model/payment-method-config-schema';
import {
  getAvailableHqPaymentMethods,
  createPaymentMethodConfig,
} from '@/app/actions/payment-config/payment-methods-actions';
import { PAYMENT_NATURE } from '@/lib/constants/payment';

interface EnablePaymentMethodDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function EnablePaymentMethodDialog({ open, onClose, onSuccess }: EnablePaymentMethodDialogProps) {
  const t = useTranslations('paymentConfig');
  const [isPending, startTransition] = useTransition();
  const [availableMethods, setAvailableMethods] = useState<{ payment_method_code: string; payment_method_name: string; payment_method_name2: string | null }[]>([]);

  const form = useForm<CreatePaymentMethodConfigFormValues>({
    resolver: zodResolver(createPaymentMethodConfigSchema),
    defaultValues: {
      payment_nature: PAYMENT_NATURE.REAL_PAYMENT,
      allowed_in_pos: true,
      allowed_in_customer_app: false,
      allowed_in_staff_app: true,
      allowed_in_admin_app: true,
    },
  });

  useEffect(() => {
    if (!open) return;
    getAvailableHqPaymentMethods().then((result) => {
      if (result.success && result.data) setAvailableMethods(result.data);
    });
  }, [open]);

  const handleSubmit = (values: CreatePaymentMethodConfigFormValues) => {
    startTransition(async () => {
      const result = await createPaymentMethodConfig(values);
      if (result.success) {
        cmxMessage.success(t('methods.saved'));
        form.reset();
        onSuccess();
      } else {
        cmxMessage.error(result.error ?? t('common.error'));
      }
    });
  };

  return (
    <CmxDialog open={open} onOpenChange={(v) => !v && onClose()}>
      <CmxDialogContent className="max-w-md">
        <CmxDialogHeader>
          <CmxDialogTitle>{t('methods.enable')}</CmxDialogTitle>
        </CmxDialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium">{t('methods.paymentMethod')}</label>
            <CmxSelectDropdown
              value={form.watch('payment_method_code')}
              onValueChange={(v) => {
                form.setValue('payment_method_code', v);
                const method = availableMethods.find((m) => m.payment_method_code === v);
                if (method) {
                  if (!form.getValues('display_name')) {
                    form.setValue('display_name', method.payment_method_name ?? '');
                  }
                  if (!form.getValues('display_name2') && method.payment_method_name2) {
                    form.setValue('display_name2', method.payment_method_name2);
                  }
                }
              }}
            >
              <CmxSelectDropdownTrigger>
                <CmxSelectDropdownValue placeholder={t('methods.selectMethod')} />
              </CmxSelectDropdownTrigger>
              <CmxSelectDropdownContent>
                {availableMethods.map((m) => (
                  <CmxSelectDropdownItem key={m.payment_method_code} value={m.payment_method_code}>
                    {m.payment_method_name}
                  </CmxSelectDropdownItem>
                ))}
              </CmxSelectDropdownContent>
            </CmxSelectDropdown>
            {form.formState.errors.payment_method_code && (
              <p className="text-xs text-destructive mt-1">{form.formState.errors.payment_method_code.message}</p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium">{t('methods.displayName')}</label>
            <CmxInput {...form.register('display_name')} placeholder={t('methods.displayNamePlaceholder')} />
            {form.formState.errors.display_name && (
              <p className="text-xs text-destructive mt-1">{form.formState.errors.display_name.message}</p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium">{t('methods.displayName2')}</label>
            <CmxInput {...form.register('display_name2')} placeholder={t('methods.displayName2Placeholder')} dir="rtl" />
          </div>

          <div>
            <label className="text-sm font-medium">{t('methods.paymentNature')}</label>
            <CmxSelectDropdown
              value={form.watch('payment_nature')}
              onValueChange={(v) => form.setValue('payment_nature', v as never)}
            >
              <CmxSelectDropdownTrigger>
                <CmxSelectDropdownValue />
              </CmxSelectDropdownTrigger>
              <CmxSelectDropdownContent>
                {Object.values(PAYMENT_NATURE).map((n) => (
                  <CmxSelectDropdownItem key={n} value={n}>
                    {t(`methods.nature.${n}` as never)}
                  </CmxSelectDropdownItem>
                ))}
              </CmxSelectDropdownContent>
            </CmxSelectDropdown>
          </div>

          <CmxDialogFooter>
            <CmxButton type="button" variant="outline" onClick={onClose} disabled={isPending}>
              {t('common.cancel')}
            </CmxButton>
            <CmxButton type="submit" disabled={isPending}>
              {isPending ? t('common.saving') : t('methods.enable')}
            </CmxButton>
          </CmxDialogFooter>
        </form>
      </CmxDialogContent>
    </CmxDialog>
  );
}
