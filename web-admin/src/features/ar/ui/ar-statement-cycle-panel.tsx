'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { CmxButton, CmxInput, CmxSelect, CmxTextarea } from '@ui/primitives';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';

interface PreviewState {
  cycle_code: string;
  cycle_name: string;
  customerCount: number;
  sampleCustomers: string[];
}

export function ArStatementCyclePanel() {
  const t = useTranslations('invoices.ar.v2.cycles');
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<'create' | 'preview'>('create');
  const [form, setForm] = useState<Record<string, string>>({
    cycleCode: '',
    cycleName: '',
    cycleName2: '',
    cadenceCode: 'MONTHLY',
    customerScopeCode: 'ALL_B2B',
    dayOfMonth: '1',
    dayOfWeek: '0',
    issueDayOffset: '0',
    dueTermsDays: '30',
    customerIds: '',
    cycleId: '',
    asOfDate: '',
  });
  const [isActive, setIsActive] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);

  const setValue = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const onSubmit = () => {
    setMessage(null);
    setError(null);
    if (mode === 'preview') {
      setPreview(null);
    }

    startTransition(async () => {
      try {
        const response = await fetch(
          mode === 'create'
            ? '/api/v1/ar/statement-cycles'
            : `/api/v1/ar/statement-cycles/${form.cycleId}/preview${form.asOfDate ? `?as_of_date=${encodeURIComponent(form.asOfDate)}` : ''}`,
          {
            method: mode === 'create' ? 'POST' : 'GET',
            headers: mode === 'create' ? { 'Content-Type': 'application/json' } : undefined,
            body:
              mode === 'create'
                ? JSON.stringify({
                    cycle_code: form.cycleCode,
                    cycle_name: form.cycleName,
                    cycle_name2: form.cycleName2 || undefined,
                    cadence_cd: form.cadenceCode,
                    customer_scope_cd: form.customerScopeCode,
                    day_of_month: form.dayOfMonth ? Number(form.dayOfMonth) : undefined,
                    day_of_week: form.dayOfWeek ? Number(form.dayOfWeek) : undefined,
                    issue_day_offset: Number(form.issueDayOffset),
                    due_terms_days: Number(form.dueTermsDays),
                    customer_ids: form.customerIds
                      .split(/[,\n]/)
                      .map((value) => value.trim())
                      .filter(Boolean),
                    is_active: isActive,
                  })
                : undefined,
          }
        );

        const payload = await response.json();
        if (!response.ok || payload.success === false) {
          throw new Error(payload.error ?? (mode === 'create' ? t('create.error') : t('preview.error')));
        }

        if (mode === 'create') {
          setMessage(t('create.success'));
          setForm({
            cycleCode: '',
            cycleName: '',
            cycleName2: '',
            cadenceCode: 'MONTHLY',
            customerScopeCode: 'ALL_B2B',
            dayOfMonth: '1',
            dayOfWeek: '0',
            issueDayOffset: '0',
            dueTermsDays: '30',
            customerIds: '',
            cycleId: '',
            asOfDate: '',
          });
          setIsActive(true);
        } else {
          const previewPayload = payload.data as { cycle: { cycle_code: string; cycle_name: string }; customers: Array<{ customer_name?: string; customer_name2?: string; customer_id: string }> };
          setPreview({
            cycle_code: previewPayload.cycle.cycle_code,
            cycle_name: previewPayload.cycle.cycle_name,
            customerCount: previewPayload.customers.length,
            sampleCustomers: previewPayload.customers.slice(0, 5).map((customer) => customer.customer_name ?? customer.customer_name2 ?? customer.customer_id),
          });
          setMessage(t('preview.success'));
        }
      } catch (submitError) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : mode === 'create'
              ? t('create.error')
              : t('preview.error')
        );
      }
    });
  };

  return (
    <CmxCard>
      <CmxCardHeader>
        <CmxCardTitle>{mode === 'create' ? t('create.title') : t('preview.title')}</CmxCardTitle>
      </CmxCardHeader>
      <CmxCardContent className="space-y-4">
        <CmxSelect
          label={t('mode')}
          value={mode}
          onChange={(event) => setMode(event.target.value as 'create' | 'preview')}
          options={[
            { value: 'create', label: t('create.title') },
            { value: 'preview', label: t('preview.title') },
          ]}
        />

        {mode === 'create' ? (
          <div className="grid gap-3 md:grid-cols-2">
            <CmxInput label={t('create.fields.cycleCode')} value={form.cycleCode} onChange={(event) => setValue('cycleCode', event.target.value)} />
            <CmxInput label={t('create.fields.cycleName')} value={form.cycleName} onChange={(event) => setValue('cycleName', event.target.value)} />
            <CmxInput label={t('create.fields.cycleName2')} value={form.cycleName2} onChange={(event) => setValue('cycleName2', event.target.value)} />
            <CmxSelect
              label={t('create.fields.cadence')}
              value={form.cadenceCode}
              onChange={(event) => setValue('cadenceCode', event.target.value)}
              options={[
                { value: 'WEEKLY', label: 'WEEKLY' },
                { value: 'BIWEEKLY', label: 'BIWEEKLY' },
                { value: 'MONTHLY', label: 'MONTHLY' },
                { value: 'CUSTOM', label: 'CUSTOM' },
              ]}
            />
            <CmxSelect
              label={t('create.fields.scope')}
              value={form.customerScopeCode}
              onChange={(event) => setValue('customerScopeCode', event.target.value)}
              options={[
                { value: 'ALL_B2B', label: 'ALL_B2B' },
                { value: 'CUSTOM_LIST', label: 'CUSTOM_LIST' },
              ]}
            />
            <CmxInput label={t('create.fields.dayOfMonth')} type="number" min="1" max="31" value={form.dayOfMonth} onChange={(event) => setValue('dayOfMonth', event.target.value)} />
            <CmxInput label={t('create.fields.dayOfWeek')} type="number" min="0" max="6" value={form.dayOfWeek} onChange={(event) => setValue('dayOfWeek', event.target.value)} />
            <CmxInput label={t('create.fields.issueDayOffset')} type="number" min="0" max="31" value={form.issueDayOffset} onChange={(event) => setValue('issueDayOffset', event.target.value)} />
            <CmxInput label={t('create.fields.dueTermsDays')} type="number" min="0" max="365" value={form.dueTermsDays} onChange={(event) => setValue('dueTermsDays', event.target.value)} />
            <CmxSelect
              label={t('create.fields.isActive')}
              value={isActive ? 'true' : 'false'}
              onChange={(event) => setIsActive(event.target.value === 'true')}
              options={[
                { value: 'true', label: t('yes') },
                { value: 'false', label: t('no') },
              ]}
            />
            <div className="md:col-span-2">
              <p className="mb-1 text-sm font-medium text-slate-900">{t('create.fields.customerIds')}</p>
              <CmxTextarea placeholder={t('create.fields.customerIdsPlaceholder')} value={form.customerIds} onChange={(event) => setValue('customerIds', event.target.value)} />
            </div>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            <CmxInput label={t('preview.fields.cycleId')} value={form.cycleId} onChange={(event) => setValue('cycleId', event.target.value)} />
            <CmxInput label={t('preview.fields.asOfDate')} type="date" value={form.asOfDate} onChange={(event) => setValue('asOfDate', event.target.value)} />
          </div>
        )}

        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}

        {preview ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-900">{preview.cycle_code} · {preview.cycle_name}</p>
            <p className="mt-1 text-sm text-slate-600">{t('preview.resultCount', { count: preview.customerCount })}</p>
            {preview.sampleCustomers.length ? (
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                {preview.sampleCustomers.map((customer) => (
                  <li key={customer}>• {customer}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="flex justify-end">
          <CmxButton onClick={onSubmit} loading={isPending}>
            {mode === 'create' ? t('create.submit') : t('preview.submit')}
          </CmxButton>
        </div>
      </CmxCardContent>
    </CmxCard>
  );
}
