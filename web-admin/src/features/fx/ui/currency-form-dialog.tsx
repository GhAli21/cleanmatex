'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useForm, useWatch, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CmxDialog, CmxDialogContent, CmxDialogHeader, CmxDialogTitle, CmxDialogFooter } from '@ui/overlays';
import { CmxButton, CmxInput, CmxSwitch } from '@ui/primitives';
import { CmxSelectDropdown, CmxSelectDropdownContent, CmxSelectDropdownItem, CmxSelectDropdownTrigger, CmxSelectDropdownValue } from '@ui/forms';
import { cmxMessage } from '@ui/feedback';
import {
  addCurrencyFormSchema,
  editCurrencyFormSchema,
  NONE_VALUE,
  type AddCurrencyFormValues,
  type EditCurrencyFormValues,
} from '../model/currency-schema';
import { addCurrencyAction, updateCurrencyAction } from '@/app/actions/fx/currency-actions';
import { getAddableCurrenciesAction, getFxRateTypesAction, getFxSourcesAction } from '@/app/actions/fx/lookup-actions';
import type { CurrencyPortfolioRow, FxRateSourceOption, FxRateTypeOption, SelectableCurrency } from '@/lib/types/currency-fx';
import { resolveFxErrorMessage } from '../lib/resolve-error-message';

interface CurrencyFormDialogProps {
  currency?: CurrencyPortfolioRow;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CurrencyFormDialog({ currency, open, onClose, onSuccess }: CurrencyFormDialogProps) {
  const t = useTranslations('currencyFx');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('currencyFx.errors');
  const [isPending, startTransition] = useTransition();
  const isEdit = !!currency;

  const [addableCurrencies, setAddableCurrencies] = useState<SelectableCurrency[]>([]);
  const [rateTypes, setRateTypes] = useState<FxRateTypeOption[]>([]);
  const [sources, setSources] = useState<FxRateSourceOption[]>([]);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const [currenciesResult, rateTypesResult, sourcesResult] = await Promise.all([
        isEdit ? Promise.resolve(null) : getAddableCurrenciesAction(),
        getFxRateTypesAction(),
        getFxSourcesAction(),
      ]);
      if (currenciesResult?.success && currenciesResult.data) setAddableCurrencies(currenciesResult.data);
      if (rateTypesResult.success && rateTypesResult.data) setRateTypes(rateTypesResult.data);
      if (sourcesResult.success && sourcesResult.data) setSources(sourcesResult.data);
    })();
  }, [open, isEdit]);

  const schema = isEdit ? editCurrencyFormSchema : addCurrencyFormSchema;
  const form = useForm<AddCurrencyFormValues>({
    resolver: zodResolver(schema) as unknown as Resolver<AddCurrencyFormValues>,
    defaultValues: currency
      ? {
          allowSales: currency.allowSales,
          allowPayments: currency.allowPayments,
          allowCash: currency.allowCash,
          allowAr: currency.allowAr,
          defaultRateTypeCode: currency.defaultRateTypeCode ?? undefined,
          defaultRateSourceCode: currency.defaultRateSourceCode ?? undefined,
          rateMaxAgeDays: currency.rateMaxAgeDays,
          allowManualFxRate: currency.allowManualFxRate,
          manualFxRequiresApproval: currency.manualFxRequiresApproval,
          manualRateTolerancePct: currency.manualRateTolerancePct,
          taxRateSourceCode: currency.taxRateSourceCode ?? undefined,
        }
      : {
          currencyCode: '',
          allowSales: false,
          allowPayments: false,
          allowCash: false,
          allowAr: false,
          allowManualFxRate: false,
          manualFxRequiresApproval: true,
        },
  });

  useEffect(() => {
    if (!open) return;
    form.reset(
      currency
        ? {
            allowSales: currency.allowSales,
            allowPayments: currency.allowPayments,
            allowCash: currency.allowCash,
            allowAr: currency.allowAr,
            defaultRateTypeCode: currency.defaultRateTypeCode ?? undefined,
            defaultRateSourceCode: currency.defaultRateSourceCode ?? undefined,
            rateMaxAgeDays: currency.rateMaxAgeDays,
            allowManualFxRate: currency.allowManualFxRate,
            manualFxRequiresApproval: currency.manualFxRequiresApproval,
            manualRateTolerancePct: currency.manualRateTolerancePct,
            taxRateSourceCode: currency.taxRateSourceCode ?? undefined,
          }
        : {
            currencyCode: '',
            allowSales: false,
            allowPayments: false,
            allowCash: false,
            allowAr: false,
            allowManualFxRate: false,
            manualFxRequiresApproval: true,
          }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currency?.currencyCode]);

  const currencyCode = useWatch({ control: form.control, name: 'currencyCode' });
  const allowSales = useWatch({ control: form.control, name: 'allowSales' });
  const allowPayments = useWatch({ control: form.control, name: 'allowPayments' });
  const allowCash = useWatch({ control: form.control, name: 'allowCash' });
  const allowAr = useWatch({ control: form.control, name: 'allowAr' });
  const allowManualFxRate = useWatch({ control: form.control, name: 'allowManualFxRate' });
  const manualFxRequiresApproval = useWatch({ control: form.control, name: 'manualFxRequiresApproval' });
  const defaultRateTypeCode = useWatch({ control: form.control, name: 'defaultRateTypeCode' });
  const defaultRateSourceCode = useWatch({ control: form.control, name: 'defaultRateSourceCode' });
  const taxRateSourceCode = useWatch({ control: form.control, name: 'taxRateSourceCode' });

  const handleSubmit = (values: AddCurrencyFormValues) => {
    startTransition(async () => {
      const result = isEdit
        ? await updateCurrencyAction(currency!.currencyCode, values as EditCurrencyFormValues)
        : await addCurrencyAction(values.currencyCode, values);
      if (result.success) {
        cmxMessage.success(t('currencies.saved'));
        onSuccess();
      } else {
        cmxMessage.error(resolveFxErrorMessage(tErrors, result.errorCode, result.error ?? tCommon('error')));
      }
    });
  };

  return (
    <CmxDialog open={open} onOpenChange={(v) => !v && onClose()}>
      <CmxDialogContent className="max-w-lg">
        <CmxDialogHeader>
          <CmxDialogTitle>{isEdit ? t('currencies.edit') : t('currencies.add')}</CmxDialogTitle>
        </CmxDialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="max-h-[70vh] space-y-4 overflow-y-auto p-4">
          {!isEdit && (
            <div>
              <label className="text-sm font-medium">{t('currencies.form.currencyCode')}</label>
              <CmxSelectDropdown value={currencyCode} onValueChange={(v) => form.setValue('currencyCode', v)}>
                <CmxSelectDropdownTrigger>
                  <CmxSelectDropdownValue placeholder={t('currencies.form.selectCurrency')} />
                </CmxSelectDropdownTrigger>
                <CmxSelectDropdownContent>
                  {addableCurrencies.map((c) => (
                    <CmxSelectDropdownItem key={c.code} value={c.code}>
                      {c.code} — {c.name}
                    </CmxSelectDropdownItem>
                  ))}
                </CmxSelectDropdownContent>
              </CmxSelectDropdown>
              {form.formState.errors.currencyCode && (
                <p className="mt-1 text-xs text-destructive">{form.formState.errors.currencyCode.message}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">{t('currencies.context.allowSales')}</span>
              <CmxSwitch checked={!!allowSales} onCheckedChange={(v) => form.setValue('allowSales', v)} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">{t('currencies.context.allowPayments')}</span>
              <CmxSwitch checked={!!allowPayments} onCheckedChange={(v) => form.setValue('allowPayments', v)} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">{t('currencies.context.allowCash')}</span>
              <CmxSwitch checked={!!allowCash} onCheckedChange={(v) => form.setValue('allowCash', v)} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">{t('currencies.context.allowAr')}</span>
              <CmxSwitch checked={!!allowAr} onCheckedChange={(v) => form.setValue('allowAr', v)} />
            </div>
          </div>

          <div className="space-y-3 border-t pt-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">{t('currencies.form.advanced')}</p>

            <div>
              <label className="text-sm font-medium">{t('currencies.form.defaultRateTypeCode')}</label>
              <CmxSelectDropdown
                value={defaultRateTypeCode ?? NONE_VALUE}
                onValueChange={(v) => form.setValue('defaultRateTypeCode', v === NONE_VALUE ? undefined : v)}
              >
                <CmxSelectDropdownTrigger><CmxSelectDropdownValue /></CmxSelectDropdownTrigger>
                <CmxSelectDropdownContent>
                  <CmxSelectDropdownItem value={NONE_VALUE}>{t('currencies.form.none')}</CmxSelectDropdownItem>
                  {rateTypes.map((rt) => (
                    <CmxSelectDropdownItem key={rt.code} value={rt.code}>{rt.name}</CmxSelectDropdownItem>
                  ))}
                </CmxSelectDropdownContent>
              </CmxSelectDropdown>
            </div>

            <div>
              <label className="text-sm font-medium">{t('currencies.form.defaultRateSourceCode')}</label>
              <CmxSelectDropdown
                value={defaultRateSourceCode ?? NONE_VALUE}
                onValueChange={(v) => form.setValue('defaultRateSourceCode', v === NONE_VALUE ? undefined : v)}
              >
                <CmxSelectDropdownTrigger><CmxSelectDropdownValue /></CmxSelectDropdownTrigger>
                <CmxSelectDropdownContent>
                  <CmxSelectDropdownItem value={NONE_VALUE}>{t('currencies.form.none')}</CmxSelectDropdownItem>
                  {sources.map((s) => (
                    <CmxSelectDropdownItem key={s.code} value={s.code}>{s.name}</CmxSelectDropdownItem>
                  ))}
                </CmxSelectDropdownContent>
              </CmxSelectDropdown>
            </div>

            <div>
              <label className="text-sm font-medium">{t('currencies.form.rateMaxAgeDays')}</label>
              <CmxInput type="number" min={1} {...form.register('rateMaxAgeDays')} />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm">{t('currencies.form.allowManualFxRate')}</span>
              <CmxSwitch checked={!!allowManualFxRate} onCheckedChange={(v) => form.setValue('allowManualFxRate', v)} />
            </div>

            {allowManualFxRate && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm">{t('currencies.form.manualFxRequiresApproval')}</span>
                  <CmxSwitch
                    checked={!!manualFxRequiresApproval}
                    onCheckedChange={(v) => form.setValue('manualFxRequiresApproval', v)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">{t('currencies.form.manualRateTolerancePct')}</label>
                  <CmxInput type="number" min={0} max={100} step="0.01" {...form.register('manualRateTolerancePct')} />
                </div>
              </>
            )}

            <div>
              <label className="text-sm font-medium">{t('currencies.form.taxRateSourceCode')}</label>
              <CmxSelectDropdown
                value={taxRateSourceCode ?? NONE_VALUE}
                onValueChange={(v) => form.setValue('taxRateSourceCode', v === NONE_VALUE ? undefined : v)}
              >
                <CmxSelectDropdownTrigger><CmxSelectDropdownValue /></CmxSelectDropdownTrigger>
                <CmxSelectDropdownContent>
                  <CmxSelectDropdownItem value={NONE_VALUE}>{t('currencies.form.none')}</CmxSelectDropdownItem>
                  {sources.map((s) => (
                    <CmxSelectDropdownItem key={s.code} value={s.code}>{s.name}</CmxSelectDropdownItem>
                  ))}
                </CmxSelectDropdownContent>
              </CmxSelectDropdown>
            </div>
          </div>

          <CmxDialogFooter>
            <CmxButton type="button" variant="outline" onClick={onClose} disabled={isPending}>
              {tCommon('cancel')}
            </CmxButton>
            <CmxButton type="submit" disabled={isPending || (!isEdit && !currencyCode)}>
              {isPending ? tCommon('saving') : tCommon('save')}
            </CmxButton>
          </CmxDialogFooter>
        </form>
      </CmxDialogContent>
    </CmxDialog>
  );
}
