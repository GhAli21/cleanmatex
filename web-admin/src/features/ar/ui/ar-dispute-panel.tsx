'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CmxButton, CmxInput, CmxMoneyField, CmxSelect, CmxTextarea } from '@ui/primitives';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { parseMoneyDraft } from '@/lib/money/money-draft';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';

/**
 *
 */
export function ArDisputePanel() {
  const t = useTranslations('invoices.ar.v2.disputes');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { decimalPlaces } = useTenantCurrency();
  const [mode, setMode] = useState<'create' | 'resolve'>('create');
  const [form, setForm] = useState<Record<string, string>>({
    invoiceId: '',
    customerId: '',
    reasonCode: '',
    title: '',
    description: '',
    disputedAmount: '',
    disputeId: '',
    statusCode: 'RESOLVED',
    resolutionSummary: '',
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setValue = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const onSubmit = () => {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        const target = mode === 'create'
          ? '/api/v1/ar/disputes'
          : `/api/v1/ar/disputes/${form.disputeId}/resolve`;
        const body = mode === 'create'
          ? {
              invoice_id: form.invoiceId,
              customer_id: form.customerId,
              reason_cd: form.reasonCode,
              title: form.title,
              description: form.description,
              disputed_amount: parseMoneyDraft(form.disputedAmount),
            }
          : {
              status_cd: form.statusCode,
              resolution_summary: form.resolutionSummary,
            };

        const response = await fetch(target, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const payload = await response.json();
        if (!response.ok || payload.success === false) {
          throw new Error(payload.error ?? t('errors.submit'));
        }

        setMessage(mode === 'create' ? t('create.success') : t('resolve.success'));
        router.refresh();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : t('errors.submit'));
      }
    });
  };

  return (
    <CmxCard>
      <CmxCardHeader>
        <CmxCardTitle>{mode === 'create' ? t('create.title') : t('resolve.title')}</CmxCardTitle>
      </CmxCardHeader>
      <CmxCardContent className="space-y-4">
        <CmxSelect
          label={t('mode')}
          value={mode}
          onChange={(event) => setMode(event.target.value as 'create' | 'resolve')}
          options={[
            { value: 'create', label: t('create.title') },
            { value: 'resolve', label: t('resolve.title') },
          ]}
        />

        {mode === 'create' ? (
          <div className="grid gap-3 md:grid-cols-2">
            <CmxInput label={t('create.fields.invoiceId')} value={form.invoiceId} onChange={(event) => setValue('invoiceId', event.target.value)} />
            <CmxInput label={t('create.fields.customerId')} value={form.customerId} onChange={(event) => setValue('customerId', event.target.value)} />
            <CmxInput label={t('create.fields.reasonCode')} value={form.reasonCode} onChange={(event) => setValue('reasonCode', event.target.value)} />
            <CmxMoneyField
              label={t('create.fields.amount')}
              value={form.disputedAmount !== '' ? parseMoneyDraft(form.disputedAmount) : null}
              draftValue={form.disputedAmount}
              decimalPlaces={decimalPlaces}
              min={0}
              onValueChange={(_, d) => setValue('disputedAmount', d)}
            />
            <div className="md:col-span-2">
              <CmxInput label={t('create.fields.title')} value={form.title} onChange={(event) => setValue('title', event.target.value)} />
            </div>
            <div className="md:col-span-2">
              <CmxTextarea placeholder={t('create.fields.description')} value={form.description} onChange={(event) => setValue('description', event.target.value)} />
            </div>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            <CmxInput label={t('resolve.fields.disputeId')} value={form.disputeId} onChange={(event) => setValue('disputeId', event.target.value)} />
            <CmxSelect
              label={t('resolve.fields.status')}
              value={form.statusCode}
              onChange={(event) => setValue('statusCode', event.target.value)}
              options={[
                { value: 'RESOLVED', label: 'RESOLVED' },
                { value: 'REJECTED', label: 'REJECTED' },
                { value: 'CANCELLED', label: 'CANCELLED' },
              ]}
            />
            <div className="md:col-span-2">
              <CmxTextarea placeholder={t('resolve.fields.summary')} value={form.resolutionSummary} onChange={(event) => setValue('resolutionSummary', event.target.value)} />
            </div>
          </div>
        )}

        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <div className="flex justify-end">
          <CmxButton onClick={onSubmit} loading={isPending}>
            {mode === 'create' ? t('create.submit') : t('resolve.submit')}
          </CmxButton>
        </div>
      </CmxCardContent>
    </CmxCard>
  );
}
