'use client';

import { useEffect, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CmxDialog, CmxDialogContent, CmxDialogHeader, CmxDialogTitle, CmxDialogFooter } from '@ui/overlays';
import { CmxButton } from '@ui/primitives';
import { CmxInput } from '@ui/primitives';
import { CmxSwitch } from '@ui/primitives';
import { CmxSelectDropdown, CmxSelectDropdownTrigger, CmxSelectDropdownValue, CmxSelectDropdownContent, CmxSelectDropdownItem } from '@ui/forms';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { cmxMessage } from '@ui/feedback';
import { updatePaymentMethodConfigSchema, type UpdatePaymentMethodConfigFormValues } from '../model/payment-method-config-schema';
import { updatePaymentMethodConfig } from '@/app/actions/payment-config/payment-methods-actions';
import { PAYMENT_NATURE, FEE_TYPES } from '@/lib/constants/payment';
import type { OrgPaymentMethodConfig } from '@/lib/types/payment';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';

interface PaymentMethodConfigDialogProps {
  method: OrgPaymentMethodConfig;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function PaymentMethodConfigDialog({ method, open, onClose, onSuccess }: PaymentMethodConfigDialogProps) {
  const t = useTranslations('paymentConfig');
  const [isPending, startTransition] = useTransition();
  const { currencyCode: tenantCurrencyCode } = useTenantCurrency();

  const form = useForm<UpdatePaymentMethodConfigFormValues>({
    resolver: zodResolver(updatePaymentMethodConfigSchema),
    defaultValues: {
      display_name:                  method.display_name,
      display_name2:                 method.display_name2 ?? '',
      description:                   method.description ?? '',
      description2:                  method.description2 ?? '',
      payment_nature:                method.payment_nature,
      allowed_in_pos:                method.allowed_in_pos,
      allowed_in_customer_app:       method.allowed_in_customer_app,
      allowed_in_staff_app:          method.allowed_in_staff_app,
      allowed_in_admin_app:          method.allowed_in_admin_app,
      allowed_for_pay_now:           method.allowed_for_pay_now,
      allowed_for_pay_on_collection: method.allowed_for_pay_on_collection,
      allowed_for_invoice_payment:   method.allowed_for_invoice_payment,
      allowed_for_refund:            method.allowed_for_refund,
      supports_partial_payment:      method.supports_partial_payment,
      supports_overpayment:          method.supports_overpayment,
      supports_change_return:        method.supports_change_return,
      requires_reference:            method.requires_reference,
      requires_approval:             method.requires_approval,
      requires_cash_drawer:          method.requires_cash_drawer,
      requires_terminal:             method.requires_terminal,
      min_amount:                    method.min_amount ?? undefined,
      max_amount:                    method.max_amount ?? undefined,
      currency_code:                 method.currency_code ?? '',
      fee_type:                      method.fee_type,
      fee_amount:                    method.fee_amount,
      fee_rate:                      method.fee_rate,
      display_order:                 method.display_order,
    },
  });

  useEffect(() => {
    form.setValue('currency_code', tenantCurrencyCode);
  }, [form, tenantCurrencyCode]);

  const handleSubmit = (values: UpdatePaymentMethodConfigFormValues) => {
    startTransition(async () => {
      const result = await updatePaymentMethodConfig(method.id, {
        ...values,
        currency_code: tenantCurrencyCode,
      });
      if (result.success) {
        cmxMessage.success(t('methods.saved'));
        onSuccess();
      } else {
        cmxMessage.error(result.error ?? t('common.error'));
      }
    });
  };

  const feeType = form.watch('fee_type');

  const boolField = (field: keyof UpdatePaymentMethodConfigFormValues) => ({
    checked: !!form.watch(field),
    onCheckedChange: (v: boolean) => form.setValue(field, v as never),
  });

  return (
    <CmxDialog open={open} onOpenChange={(v) => !v && onClose()}>
      <CmxDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <CmxDialogHeader>
          <CmxDialogTitle>{t('methods.configure')}: {method.display_name}</CmxDialogTitle>
        </CmxDialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-2">

          {/* General */}
          <CmxCard>
            <CmxCardHeader><CmxCardTitle className="text-base">{t('methods.sections.general')}</CmxCardTitle></CmxCardHeader>
            <CmxCardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">{t('methods.displayName')}</label>
                  <CmxInput {...form.register('display_name')} />
                </div>
                <div>
                  <label className="text-sm font-medium">{t('methods.displayName2')}</label>
                  <CmxInput {...form.register('display_name2')} dir="rtl" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">{t('methods.description')}</label>
                  <CmxInput {...form.register('description')} />
                </div>
                <div>
                  <label className="text-sm font-medium">{t('methods.description2')}</label>
                  <CmxInput {...form.register('description2')} dir="rtl" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">{t('methods.paymentNature')}</label>
                  <CmxSelectDropdown value={form.watch('payment_nature')} onValueChange={(v) => form.setValue('payment_nature', v as never)}>
                    <CmxSelectDropdownTrigger><CmxSelectDropdownValue /></CmxSelectDropdownTrigger>
                    <CmxSelectDropdownContent>
                      {Object.values(PAYMENT_NATURE).map((n) => (
                        <CmxSelectDropdownItem key={n} value={n}>{t(`methods.nature.${n}` as never)}</CmxSelectDropdownItem>
                      ))}
                    </CmxSelectDropdownContent>
                  </CmxSelectDropdown>
                </div>
                <div>
                  <label className="text-sm font-medium">{t('methods.displayOrder')}</label>
                  <CmxInput
                    type="number"
                    min={0}
                    step={1}
                    {...form.register('display_order', { setValueAs: (v) => v === '' ? undefined : Number(v) })}
                  />
                </div>
              </div>
            </CmxCardContent>
          </CmxCard>

          {/* Channels & Purposes */}
          <CmxCard>
            <CmxCardHeader><CmxCardTitle className="text-base">{t('methods.sections.channels')}</CmxCardTitle></CmxCardHeader>
            <CmxCardContent>
              <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                {([
                  ['allowed_in_pos',                t('methods.channels.pos')],
                  ['allowed_in_customer_app',        t('methods.channels.app')],
                  ['allowed_in_staff_app',           t('methods.channels.staff')],
                  ['allowed_in_admin_app',           t('methods.channels.admin')],
                  ['allowed_for_pay_now',            t('methods.purposes.payNow')],
                  ['allowed_for_pay_on_collection',  t('methods.purposes.payOnCollection')],
                  ['allowed_for_invoice_payment',    t('methods.purposes.invoicePayment')],
                  ['allowed_for_refund',             t('methods.purposes.refund')],
                ] as [keyof UpdatePaymentMethodConfigFormValues, string][]).map(([field, label]) => (
                  <div key={field} className="flex items-center justify-between">
                    <span className="text-sm">{label}</span>
                    <CmxSwitch {...boolField(field)} />
                  </div>
                ))}
              </div>
            </CmxCardContent>
          </CmxCard>

          {/* Behavior */}
          <CmxCard>
            <CmxCardHeader><CmxCardTitle className="text-base">{t('methods.sections.behavior')}</CmxCardTitle></CmxCardHeader>
            <CmxCardContent>
              <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                {([
                  ['supports_partial_payment', t('methods.supportsPartialPayment')],
                  ['supports_overpayment',     t('methods.supportsOverpayment')],
                  ['supports_change_return',   t('methods.supportsChangeReturn')],
                  ['requires_reference',       t('methods.requiresReference')],
                  ['requires_approval',        t('methods.requiresApproval')],
                  ['requires_cash_drawer',     t('methods.requiresCashDrawer')],
                  ['requires_terminal',        t('methods.requiresTerminal')],
                ] as [keyof UpdatePaymentMethodConfigFormValues, string][]).map(([field, label]) => (
                  <div key={field} className="flex items-center justify-between">
                    <span className="text-sm">{label}</span>
                    <CmxSwitch {...boolField(field)} />
                  </div>
                ))}
              </div>
            </CmxCardContent>
          </CmxCard>

          {/* Limits & Fees */}
          <CmxCard>
            <CmxCardHeader><CmxCardTitle className="text-base">{t('methods.sections.limitsAndFees')}</CmxCardTitle></CmxCardHeader>
            <CmxCardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium">{t('methods.minAmount')}</label>
                  <CmxInput type="number" step="0.001" {...form.register('min_amount', { setValueAs: (v) => v === '' ? undefined : Number(v) })} />
                </div>
                <div>
                  <label className="text-sm font-medium">{t('methods.maxAmount')}</label>
                  <CmxInput type="number" step="0.001" {...form.register('max_amount', { setValueAs: (v) => v === '' ? undefined : Number(v) })} />
                </div>
                <div>
                  <label className="text-sm font-medium">{t('methods.currencyCode')}</label>
                  <CmxInput value={tenantCurrencyCode} disabled className="font-mono" />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('methods.currencyLockedHint')}
                  </p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">{t('methods.feeType')}</label>
                <CmxSelectDropdown value={form.watch('fee_type')} onValueChange={(v) => form.setValue('fee_type', v as never)}>
                  <CmxSelectDropdownTrigger><CmxSelectDropdownValue /></CmxSelectDropdownTrigger>
                  <CmxSelectDropdownContent>
                    {Object.values(FEE_TYPES).map((f) => (
                      <CmxSelectDropdownItem key={f} value={f}>{t(`methods.feeTypes.${f}` as never)}</CmxSelectDropdownItem>
                    ))}
                  </CmxSelectDropdownContent>
                </CmxSelectDropdown>
              </div>
              {feeType === FEE_TYPES.FIXED && (
                <div>
                  <label className="text-sm font-medium">{t('methods.feeAmount')}</label>
                  <CmxInput type="number" step="0.001" {...form.register('fee_amount', { setValueAs: (v) => v === '' ? undefined : Number(v) })} />
                </div>
              )}
              {feeType === FEE_TYPES.PERCENTAGE && (
                <div>
                  <label className="text-sm font-medium">{t('methods.feeRate')} (%)</label>
                  <CmxInput type="number" step="0.01" {...form.register('fee_rate', { setValueAs: (v) => v === '' ? undefined : Number(v) })} />
                </div>
              )}
            </CmxCardContent>
          </CmxCard>

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
