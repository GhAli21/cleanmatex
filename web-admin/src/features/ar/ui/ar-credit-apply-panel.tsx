'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CmxButton, CmxInput, CmxMoneyField, CmxSelect, CmxTextarea } from '@ui/primitives';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { parseMoneyDraft } from '@/lib/money/money-draft';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';

export function ArCreditApplyPanel() {
  const t = useTranslations('invoices.ar.v2.credits');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { decimalPlaces } = useTenantCurrency();
  const [mode, setMode] = useState<'apply' | 'reverse'>('apply');
  const [invoiceId, setInvoiceId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [sourceLedgerId, setSourceLedgerId] = useState('');
  const [appliedAmount, setAppliedAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [applicationId, setApplicationId] = useState('');
  const [reversalReason, setReversalReason] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = () => {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch(
          mode === 'apply'
            ? '/api/v1/ar/credits/applications'
            : `/api/v1/ar/credits/applications/${applicationId}/reverse`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(
              mode === 'apply'
                ? {
                    invoice_id: invoiceId,
                    customer_id: customerId,
                    source_ledger_id: sourceLedgerId,
                    applied_amount: parseMoneyDraft(appliedAmount),
                    notes,
                  }
                : {
                    reason: reversalReason,
                  }
            ),
          }
        );

        const payload = await response.json();
        if (!response.ok || payload.success === false) {
          throw new Error(payload.error ?? (mode === 'apply' ? t('apply.error') : t('reverse.error')));
        }

        setMessage(mode === 'apply' ? t('apply.success') : t('reverse.success'));
        setInvoiceId('');
        setCustomerId('');
        setSourceLedgerId('');
        setAppliedAmount('');
        setNotes('');
        setApplicationId('');
        setReversalReason('');
        router.refresh();
      } catch (submitError) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : mode === 'apply'
              ? t('apply.error')
              : t('reverse.error')
        );
      }
    });
  };

  return (
    <CmxCard>
      <CmxCardHeader>
        <CmxCardTitle>{mode === 'apply' ? t('apply.title') : t('reverse.title')}</CmxCardTitle>
      </CmxCardHeader>
      <CmxCardContent className="space-y-4">
        <CmxSelect
          label={t('mode')}
          value={mode}
          onChange={(event) => setMode(event.target.value as 'apply' | 'reverse')}
          options={[
            { value: 'apply', label: t('apply.title') },
            { value: 'reverse', label: t('reverse.title') },
          ]}
        />

        {mode === 'apply' ? (
          <div className="grid gap-3 md:grid-cols-2">
            <CmxInput label={t('apply.fields.invoiceId')} value={invoiceId} onChange={(event) => setInvoiceId(event.target.value)} />
            <CmxInput label={t('apply.fields.customerId')} value={customerId} onChange={(event) => setCustomerId(event.target.value)} />
            <CmxInput label={t('apply.fields.sourceLedgerId')} value={sourceLedgerId} onChange={(event) => setSourceLedgerId(event.target.value)} />
            <CmxMoneyField
              label={t('apply.fields.appliedAmount')}
              value={appliedAmount !== '' ? parseMoneyDraft(appliedAmount) : null}
              draftValue={appliedAmount}
              decimalPlaces={decimalPlaces}
              min={0}
              onValueChange={(_, d) => setAppliedAmount(d)}
            />
            <div className="md:col-span-2">
              <p className="mb-1 text-sm font-medium text-slate-900">{t('apply.fields.notes')}</p>
              <CmxTextarea placeholder={t('apply.fields.notesPlaceholder')} value={notes} onChange={(event) => setNotes(event.target.value)} />
            </div>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            <CmxInput label={t('reverse.fields.applicationId')} value={applicationId} onChange={(event) => setApplicationId(event.target.value)} />
            <div className="md:col-span-2">
              <p className="mb-1 text-sm font-medium text-slate-900">{t('reverse.fields.reason')}</p>
              <CmxTextarea placeholder={t('reverse.fields.reasonPlaceholder')} value={reversalReason} onChange={(event) => setReversalReason(event.target.value)} />
            </div>
          </div>
        )}
        {message ? <p className="text-sm text-emerald-700 md:col-span-2">{message}</p> : null}
        {error ? <p className="text-sm text-red-700 md:col-span-2">{error}</p> : null}
        <div className="flex justify-end">
          <CmxButton onClick={onSubmit} loading={isPending}>
            {mode === 'apply' ? t('apply.submit') : t('reverse.submit')}
          </CmxButton>
        </div>
      </CmxCardContent>
    </CmxCard>
  );
}
