'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useForm, useWatch, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CmxDialog, CmxDialogContent, CmxDialogHeader, CmxDialogTitle, CmxDialogFooter } from '@ui/overlays';
import { CmxButton, CmxInput, CmxSwitch, CmxTextarea, Label } from '@ui/primitives';
import { CmxSelectDropdown, CmxSelectDropdownContent, CmxSelectDropdownItem, CmxSelectDropdownTrigger, CmxSelectDropdownValue } from '@ui/forms';
import { cmxMessage, CmxSummaryMessage } from '@ui/feedback';
import { useOperationalZones } from '@/lib/hooks/use-operational-zones';
import { civilDateInZone } from '@/lib/utils/operational-time';
import { useHasPermissionCode } from '@/lib/hooks/usePermissions';
import { CURRENCY_FX_PERMISSIONS } from '@/lib/constants/permissions/currency-fx-perm';
import { createRateFormSchema, type CreateRateFormValues } from '../model/rate-schema';
import { createRateAction } from '@/app/actions/fx/rate-actions';
import { getFxRateTypesAction, getFxSourcesAction } from '@/app/actions/fx/lookup-actions';
import { getCurrencyPortfolio } from '@/app/actions/fx/currency-actions';
import { resolveFxErrorMessage } from '../lib/resolve-error-message';
import type { FxRateSourceOption, FxRateTypeOption, SelectableCurrency } from '@/lib/types/currency-fx';

interface RateFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function RateFormDialog({ open, onClose, onSuccess }: RateFormDialogProps) {
  const t = useTranslations('currencyFx');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('currencyFx.errors');
  const [isPending, startTransition] = useTransition();
  const canManualOverride = useHasPermissionCode(CURRENCY_FX_PERMISSIONS.FX_RATES_MANUAL_OVERRIDE);
  const { organization, isPending: zonePending } = useOperationalZones('invoice', []);

  const [portfolioCurrencies, setPortfolioCurrencies] = useState<SelectableCurrency[]>([]);
  const [rateTypes, setRateTypes] = useState<FxRateTypeOption[]>([]);
  const [sources, setSources] = useState<FxRateSourceOption[]>([]);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const [portfolioResult, rateTypesResult, sourcesResult] = await Promise.all([
        getCurrencyPortfolio(),
        getFxRateTypesAction(),
        getFxSourcesAction(),
      ]);
      // The rate-pair dropdowns offer the tenant's whole portfolio (base/reporting + foreign) —
      // a rate can only ever pair one of these currencies with another (C3).
      if (portfolioResult.success && portfolioResult.data) {
        const portfolioCodes = portfolioResult.data.map((c) => ({ code: c.currencyCode, name: c.currencyCode, name2: null, minorUnit: 0 }));
        setPortfolioCurrencies(portfolioCodes);
      }
      if (rateTypesResult.success && rateTypesResult.data) setRateTypes(rateTypesResult.data);
      if (sourcesResult.success && sourcesResult.data) setSources(sourcesResult.data);
    })();
  }, [open]);

  const form = useForm<CreateRateFormValues>({
    resolver: zodResolver(createRateFormSchema) as Resolver<CreateRateFormValues>,
    defaultValues: { rateDate: '', approveNow: false },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({ rateDate: civilDateInZone(new Date(), organization), approveNow: false });
  }, [open, organization, form]);

  const fromCurrencyCode = useWatch({ control: form.control, name: 'fromCurrencyCode' });
  const toCurrencyCode = useWatch({ control: form.control, name: 'toCurrencyCode' });
  const rateTypeCode = useWatch({ control: form.control, name: 'rateTypeCode' });
  const sourceCode = useWatch({ control: form.control, name: 'sourceCode' });
  const approveNow = useWatch({ control: form.control, name: 'approveNow' });

  const handleSubmit = (values: CreateRateFormValues) => {
    startTransition(async () => {
      const result = await createRateAction(values);
      if (result.success) {
        cmxMessage.success(t('rates.saved'));
        form.reset();
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
          <CmxDialogTitle>{t('rates.add')}</CmxDialogTitle>
        </CmxDialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-3 p-4">
          {!zonePending && !organization ? (
            <CmxSummaryMessage type="warning" message={tErrors('timezoneNotConfigured')} />
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('rates.form.fromCurrency')}</Label>
              <CmxSelectDropdown value={fromCurrencyCode} onValueChange={(v) => form.setValue('fromCurrencyCode', v)}>
                <CmxSelectDropdownTrigger><CmxSelectDropdownValue /></CmxSelectDropdownTrigger>
                <CmxSelectDropdownContent>
                  {portfolioCurrencies.map((c) => (
                    <CmxSelectDropdownItem key={c.code} value={c.code}>{c.code}</CmxSelectDropdownItem>
                  ))}
                </CmxSelectDropdownContent>
              </CmxSelectDropdown>
            </div>
            <div>
              <Label>{t('rates.form.toCurrency')}</Label>
              <CmxSelectDropdown value={toCurrencyCode} onValueChange={(v) => form.setValue('toCurrencyCode', v)}>
                <CmxSelectDropdownTrigger><CmxSelectDropdownValue /></CmxSelectDropdownTrigger>
                <CmxSelectDropdownContent>
                  {portfolioCurrencies.map((c) => (
                    <CmxSelectDropdownItem key={c.code} value={c.code}>{c.code}</CmxSelectDropdownItem>
                  ))}
                </CmxSelectDropdownContent>
              </CmxSelectDropdown>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('rates.form.rateType')}</Label>
              <CmxSelectDropdown value={rateTypeCode} onValueChange={(v) => form.setValue('rateTypeCode', v)}>
                <CmxSelectDropdownTrigger><CmxSelectDropdownValue /></CmxSelectDropdownTrigger>
                <CmxSelectDropdownContent>
                  {rateTypes.map((rt) => (
                    <CmxSelectDropdownItem key={rt.code} value={rt.code}>{rt.name}</CmxSelectDropdownItem>
                  ))}
                </CmxSelectDropdownContent>
              </CmxSelectDropdown>
            </div>
            <div>
              <Label>{t('rates.form.source')}</Label>
              <CmxSelectDropdown value={sourceCode} onValueChange={(v) => form.setValue('sourceCode', v)}>
                <CmxSelectDropdownTrigger><CmxSelectDropdownValue /></CmxSelectDropdownTrigger>
                <CmxSelectDropdownContent>
                  {sources.map((s) => (
                    <CmxSelectDropdownItem key={s.code} value={s.code}>{s.name}</CmxSelectDropdownItem>
                  ))}
                </CmxSelectDropdownContent>
              </CmxSelectDropdown>
            </div>
          </div>

          <div>
            <Label>{t('rates.rateDate')}</Label>
            <CmxInput type="date" {...form.register('rateDate')} />
          </div>

          <div>
            <Label>{t('rates.form.rateValue')}</Label>
            <CmxInput {...form.register('rate')} placeholder="0.3850000000" className="font-mono" />
            <p className="mt-1 text-xs text-muted-foreground">{t('rates.form.rateHint')}</p>
            {form.formState.errors.rate && <p className="mt-1 text-xs text-destructive">{form.formState.errors.rate.message}</p>}
          </div>

          <div>
            <Label>{t('rates.form.sourceReference')}</Label>
            <CmxInput {...form.register('sourceReference')} />
          </div>

          <div>
            <Label>{t('rates.form.notes')}</Label>
            <CmxTextarea rows={2} {...form.register('notes')} />
          </div>

          {canManualOverride && (
            <div className="flex items-center justify-between">
              <span className="text-sm">{t('rates.form.approveNow')}</span>
              <CmxSwitch checked={!!approveNow} onCheckedChange={(v) => form.setValue('approveNow', v)} />
            </div>
          )}

          <CmxDialogFooter>
            <CmxButton type="button" variant="outline" onClick={onClose} disabled={isPending}>
              {tCommon('cancel')}
            </CmxButton>
            <CmxButton type="submit" disabled={isPending}>
              {isPending ? tCommon('saving') : tCommon('save')}
            </CmxButton>
          </CmxDialogFooter>
        </form>
      </CmxDialogContent>
    </CmxDialog>
  );
}
