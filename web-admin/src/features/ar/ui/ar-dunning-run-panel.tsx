'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CmxButton, CmxInput, CmxSelect, CmxTextarea } from '@ui/primitives';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';

export function ArDunningRunPanel() {
  const t = useTranslations('invoices.ar.v2.dunning');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [customerId, setCustomerId] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [stageCode, setStageCode] = useState('REMINDER_1');
  const [actionCode, setActionCode] = useState('EMAIL');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = () => {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch('/api/v1/ar/dunning/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_id: customerId,
            invoice_id: invoiceId || undefined,
            stage_cd: stageCode,
            action_cd: actionCode,
            notes: notes || undefined,
          }),
        });

        const payload = await response.json();
        if (!response.ok || payload.success === false) {
          throw new Error(payload.error ?? t('run.error'));
        }

        setMessage(t('run.success'));
        setCustomerId('');
        setInvoiceId('');
        setStageCode('REMINDER_1');
        setActionCode('EMAIL');
        setNotes('');
        router.refresh();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : t('run.error'));
      }
    });
  };

  return (
    <CmxCard>
      <CmxCardHeader>
        <CmxCardTitle>{t('run.title')}</CmxCardTitle>
      </CmxCardHeader>
      <CmxCardContent className="grid gap-3 md:grid-cols-2">
        <CmxInput label={t('run.fields.customerId')} value={customerId} onChange={(event) => setCustomerId(event.target.value)} />
        <CmxInput label={t('run.fields.invoiceId')} value={invoiceId} onChange={(event) => setInvoiceId(event.target.value)} />
        <CmxSelect
          label={t('run.fields.stage')}
          value={stageCode}
          onChange={(event) => setStageCode(event.target.value)}
          options={[
            { value: 'REMINDER_1', label: 'REMINDER_1' },
            { value: 'REMINDER_2', label: 'REMINDER_2' },
            { value: 'FINAL_NOTICE', label: 'FINAL_NOTICE' },
            { value: 'CREDIT_HOLD', label: 'CREDIT_HOLD' },
          ]}
        />
        <CmxSelect
          label={t('run.fields.action')}
          value={actionCode}
          onChange={(event) => setActionCode(event.target.value)}
          options={[
            { value: 'EMAIL', label: 'EMAIL' },
            { value: 'SMS', label: 'SMS' },
            { value: 'HOLD', label: 'HOLD' },
            { value: 'NOTE', label: 'NOTE' },
          ]}
        />
        <div className="md:col-span-2">
          <p className="mb-1 text-sm font-medium text-slate-900">{t('run.fields.notes')}</p>
          <CmxTextarea placeholder={t('run.fields.notesPlaceholder')} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>
        {message ? <p className="text-sm text-emerald-700 md:col-span-2">{message}</p> : null}
        {error ? <p className="text-sm text-red-700 md:col-span-2">{error}</p> : null}
        <div className="md:col-span-2 flex justify-end">
          <CmxButton onClick={onSubmit} loading={isPending}>
            {t('run.submit')}
          </CmxButton>
        </div>
      </CmxCardContent>
    </CmxCard>
  );
}
