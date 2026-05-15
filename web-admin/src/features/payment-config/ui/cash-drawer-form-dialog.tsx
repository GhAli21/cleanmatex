'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CmxDialog, CmxDialogContent, CmxDialogHeader, CmxDialogTitle, CmxDialogFooter } from '@ui/overlays';
import { CmxButton } from '@ui/primitives';
import { CmxInput } from '@ui/primitives';
import { CmxSwitch } from '@ui/primitives';
import { CmxSelectDropdown, CmxSelectDropdownTrigger, CmxSelectDropdownValue, CmxSelectDropdownContent, CmxSelectDropdownItem } from '@ui/forms';
import { cmxMessage } from '@ui/feedback';
import { createCashDrawerSchema, type CreateCashDrawerFormValues } from '../model/cash-drawer-schema';
import { createCashDrawer, updateCashDrawer } from '@/app/actions/payment-config/cash-drawers-actions';
import { DRAWER_TYPES } from '@/lib/constants/payment';
import type { OrgCashDrawer } from '@/lib/types/payment';

interface CashDrawerFormDialogProps {
  drawer?: OrgCashDrawer;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const COMMON_CURRENCIES = ['OMR', 'SAR', 'AED', 'KWD', 'BHD', 'QAR', 'USD'];

export function CashDrawerFormDialog({ drawer, open, onClose, onSuccess }: CashDrawerFormDialogProps) {
  const t = useTranslations('paymentConfig');
  const [isPending, startTransition] = useTransition();
  const isEdit = !!drawer;

  const form = useForm<CreateCashDrawerFormValues>({
    resolver: zodResolver(createCashDrawerSchema),
    defaultValues: drawer ? {
      drawer_name: drawer.drawer_name,
      drawer_name2: drawer.drawer_name2 ?? '',
      drawer_type: drawer.drawer_type,
      branch_id: drawer.branch_id,
      currency_code: drawer.currency_code,
      requires_session: drawer.requires_session,
      opening_float_required: drawer.opening_float_required,
      max_cash_limit: drawer.max_cash_limit ?? undefined,
    } : {
      drawer_type: DRAWER_TYPES.COUNTER,
      requires_session: true,
      opening_float_required: true,
    },
  });

  const handleSubmit = (values: CreateCashDrawerFormValues) => {
    startTransition(async () => {
      const result = isEdit
        ? await updateCashDrawer(drawer!.id, values)
        : await createCashDrawer(values);
      if (result.success) {
        cmxMessage.success(t('cashDrawers.saved'));
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
          <CmxDialogTitle>{isEdit ? t('cashDrawers.edit') : t('cashDrawers.add')}</CmxDialogTitle>
        </CmxDialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-3 py-2">
          {!isEdit && (
            <div>
              <label className="text-sm font-medium">{t('cashDrawers.code')}</label>
              <CmxInput {...form.register('drawer_code')} placeholder="DRW-001" className="font-mono" />
            </div>
          )}
          <div>
            <label className="text-sm font-medium">{t('cashDrawers.name')}</label>
            <CmxInput {...form.register('drawer_name')} />
          </div>
          <div>
            <label className="text-sm font-medium">{t('cashDrawers.name2')}</label>
            <CmxInput {...form.register('drawer_name2')} dir="rtl" />
          </div>
          <div>
            <label className="text-sm font-medium">{t('cashDrawers.drawerType')}</label>
            <CmxSelectDropdown value={form.watch('drawer_type')} onValueChange={(v) => form.setValue('drawer_type', v as never)}>
              <CmxSelectDropdownTrigger><CmxSelectDropdownValue /></CmxSelectDropdownTrigger>
              <CmxSelectDropdownContent>
                {Object.values(DRAWER_TYPES).map((dt) => (
                  <CmxSelectDropdownItem key={dt} value={dt}>{t(`cashDrawers.drawerTypeLabel.${dt}` as never)}</CmxSelectDropdownItem>
                ))}
              </CmxSelectDropdownContent>
            </CmxSelectDropdown>
          </div>
          {!isEdit && (
            <div>
              <label className="text-sm font-medium">{t('cashDrawers.currency')}</label>
              <CmxSelectDropdown value={form.watch('currency_code') ?? ''} onValueChange={(v) => form.setValue('currency_code', v)}>
                <CmxSelectDropdownTrigger><CmxSelectDropdownValue placeholder={t('cashDrawers.selectCurrency')} /></CmxSelectDropdownTrigger>
                <CmxSelectDropdownContent>
                  {COMMON_CURRENCIES.map((c) => (
                    <CmxSelectDropdownItem key={c} value={c}>{c}</CmxSelectDropdownItem>
                  ))}
                </CmxSelectDropdownContent>
              </CmxSelectDropdown>
              {form.formState.errors.currency_code && (
                <p className="text-xs text-destructive mt-1">{form.formState.errors.currency_code.message}</p>
              )}
            </div>
          )}
          <div>
            <label className="text-sm font-medium">{t('cashDrawers.maxCashLimit')}</label>
            <CmxInput type="number" step="0.001" {...form.register('max_cash_limit', { valueAsNumber: true })} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">{t('cashDrawers.requiresSession')}</span>
            <CmxSwitch checked={!!form.watch('requires_session')} onCheckedChange={(v) => form.setValue('requires_session', v)} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">{t('cashDrawers.openingFloatRequired')}</span>
            <CmxSwitch checked={!!form.watch('opening_float_required')} onCheckedChange={(v) => form.setValue('opening_float_required', v)} />
          </div>
          <CmxDialogFooter>
            <CmxButton type="button" variant="outline" onClick={onClose} disabled={isPending}>{t('common.cancel')}</CmxButton>
            <CmxButton type="submit" disabled={isPending}>{isPending ? t('common.saving') : t('common.save')}</CmxButton>
          </CmxDialogFooter>
        </form>
      </CmxDialogContent>
    </CmxDialog>
  );
}
