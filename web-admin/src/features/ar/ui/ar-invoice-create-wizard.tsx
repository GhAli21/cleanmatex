'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { CmxSummaryMessage } from '@ui/feedback';
import { CmxButton, CmxInput, CmxMoneyField, CmxSelect } from '@ui/primitives';
import { CmxTextarea } from '@ui/primitives';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { parseMoneyDraft } from '@/lib/money/money-draft';

type WizardMode = 'MANUAL' | 'FROM_ORDERS';

interface ManualLineDraft {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  tax: string;
}

function draftToValue(draft: string | undefined): number | null {
  if (draft === '' || draft == null) return null;
  const n = parseMoneyDraft(draft);
  return Number.isFinite(n) ? n : null;
}

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function createLineDraft(index: number): ManualLineDraft {
  return {
    id: `line-${Date.now()}-${index}`,
    description: '',
    quantity: '1',
    unitPrice: '0',
    discount: '0',
    tax: '0',
  };
}

function parseOrderIds(value: string) {
  return value
    .split(/[\n,]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function ArInvoiceCreateWizard() {
  const t = useTranslations('invoices.ar.create');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { decimalPlaces } = useTenantCurrency();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [mode, setMode] = useState<WizardMode>('MANUAL');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [currencyCode, setCurrencyCode] = useState('OMR');
  const [invoiceDate, setInvoiceDate] = useState(todayDateString());
  const [dueDate, setDueDate] = useState(todayDateString());
  const [paymentTerms, setPaymentTerms] = useState('');
  const [paymentMethodCode, setPaymentMethodCode] = useState('');
  const [notes, setNotes] = useState('');
  const [orderIdsDraft, setOrderIdsDraft] = useState('');
  const [lines, setLines] = useState<ManualLineDraft[]>([createLineDraft(0)]);

  const computedLines = useMemo(() => {
    return lines.map((line) => {
      const quantity = Number(line.quantity || 0);
      const unitPrice = Number(line.unitPrice || 0);
      const discount = Number(line.discount || 0);
      const tax = Number(line.tax || 0);
      const subtotal = quantity * unitPrice;
      const taxable = Math.max(0, subtotal - discount);
      const total = taxable + tax;

      return {
        ...line,
        quantityNumber: quantity,
        unitPriceNumber: unitPrice,
        discountNumber: discount,
        taxNumber: tax,
        subtotal,
        taxable,
        total,
      };
    });
  }, [lines]);

  const totals = useMemo(() => {
    return computedLines.reduce(
      (acc, line) => {
        acc.subtotal += line.subtotal;
        acc.discount += line.discountNumber;
        acc.tax += line.taxNumber;
        acc.total += line.total;
        return acc;
      },
      { subtotal: 0, discount: 0, tax: 0, total: 0 }
    );
  }, [computedLines]);

  const orderIds = useMemo(() => parseOrderIds(orderIdsDraft), [orderIdsDraft]);
  const validationItems = useMemo(() => {
    const issues: string[] = [];
    if (!customerId.trim() && mode === 'MANUAL') issues.push(t('errors.customerRequired'));
    if (!currencyCode.trim() || currencyCode.trim().length !== 3) issues.push(t('errors.currencyInvalid'));
    if (mode === 'FROM_ORDERS' && orderIds.length === 0) issues.push(t('errors.orderIdsRequired'));
    if (mode === 'MANUAL' && computedLines.some((line) => !line.description.trim())) issues.push(t('errors.lineDescriptionRequired'));
    if (mode === 'MANUAL' && computedLines.some((line) => line.quantityNumber <= 0)) issues.push(t('errors.quantityInvalid'));
    return issues;
  }, [computedLines, currencyCode, customerId, mode, orderIds.length, t]);

  const canContinueFromStepOne =
    currencyCode.trim().length === 3 &&
    (mode === 'FROM_ORDERS' || customerId.trim().length > 0);
  const canContinueFromStepTwo =
    mode === 'FROM_ORDERS'
      ? orderIds.length > 0
      : computedLines.length > 0 &&
        computedLines.every((line) => line.description.trim().length > 0 && line.quantityNumber > 0);
  const canSubmit = validationItems.length === 0 && totals.total >= 0;

  const addLine = () => {
    setLines((current) => [...current, createLineDraft(current.length)]);
  };

  const updateLine = (lineId: string, field: keyof ManualLineDraft, value: string) => {
    setLines((current) =>
      current.map((line) => (line.id === lineId ? { ...line, [field]: value } : line))
    );
  };

  const removeLine = (lineId: string) => {
    setLines((current) => (current.length === 1 ? current : current.filter((line) => line.id !== lineId)));
  };

  const submit = async () => {
    if (!canSubmit) return;

    setIsSaving(true);
    setError(null);

    try {
      if (mode === 'FROM_ORDERS') {
        const response = await fetch('/api/v1/ar/invoices/from-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_ids: orderIds,
            customer_id: customerId.trim() || undefined,
            invoice_date: invoiceDate,
            due_date: dueDate,
            currency_code: currencyCode.trim().toUpperCase(),
            rec_notes: notes.trim() || undefined,
            idempotency_key: `from-orders:${Date.now()}`,
          }),
        });

        const result = (await response.json()) as {
          success?: boolean;
          error?: string;
          data?: { invoice: { id: string } } | { invoice?: { id: string } };
        };

        const invoiceId = (result.data as { invoice?: { id: string } } | undefined)?.invoice?.id;
        if (!response.ok || !result.success || !invoiceId) {
          throw new Error(result.error ?? t('errors.createFailed'));
        }

        router.push(`/dashboard/internal_fin/invoices/${invoiceId}`);
        return;
      }

      const response = await fetch('/api/v1/ar/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerId.trim(),
          branch_id: branchId.trim() || undefined,
          invoice_type_cd: 'MANUAL_AR',
          invoice_date: invoiceDate,
          due_date: dueDate,
          payment_terms: paymentTerms.trim() || undefined,
          payment_method_code: paymentMethodCode.trim() || undefined,
          currency_code: currencyCode.trim().toUpperCase(),
          currency_ex_rate: 1,
          subtotal: totals.subtotal,
          discount: totals.discount,
          tax: totals.tax,
          total: totals.total,
          rec_notes: notes.trim() || undefined,
          idempotency_key: `manual-ar:${Date.now()}`,
          lines: computedLines.map((line) => ({
            description: line.description.trim(),
            quantity: line.quantityNumber,
            unit_price: line.unitPriceNumber,
            subtotal_amount: line.subtotal,
            discount_amount: line.discountNumber,
            taxable_amount: line.taxable,
            tax_amount: line.taxNumber,
            total_amount: line.total,
            currency_code: currencyCode.trim().toUpperCase(),
            line_type: 'SERVICE',
          })),
        }),
      });

      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        data?: { invoice: { id: string } };
      };

      if (!response.ok || !result.success || !result.data?.invoice?.id) {
        throw new Error(result.error ?? t('errors.createFailed'));
      }

      router.push(`/dashboard/internal_fin/invoices/${result.data.invoice.id}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t('errors.createFailed'));
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
  };

  return (
    <div className="space-y-6">
      {error ? <CmxSummaryMessage type="error" title={t('errors.title')} items={[error]} /> : null}
      {validationItems.length > 0 && step === 3 ? (
        <CmxSummaryMessage type="warning" title={t('validation.title')} items={validationItems} />
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className={`rounded-2xl border p-4 ${
              step === item ? 'border-sky-400 bg-sky-50' : 'border-slate-200 bg-white'
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              {t('steps.stepLabel', { number: item })}
            </p>
            <p className="mt-2 text-sm font-medium text-slate-900">
              {item === 1 ? t('steps.basics') : item === 2 ? t('steps.source') : t('steps.review')}
            </p>
          </div>
        ))}
      </div>

      {step === 1 ? (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <CmxSelect
              label={t('fields.mode')}
              value={mode}
              onChange={(event) => setMode(event.target.value as WizardMode)}
              options={[
                { value: 'MANUAL', label: t('modeOptions.MANUAL') },
                { value: 'FROM_ORDERS', label: t('modeOptions.FROM_ORDERS') },
              ]}
            />
            <CmxInput label={t('fields.customerId')} value={customerId} onChange={(event) => setCustomerId(event.target.value)} required={mode === 'MANUAL'} />
            <CmxInput label={t('fields.branchId')} value={branchId} onChange={(event) => setBranchId(event.target.value)} />
            <CmxInput label={t('fields.currencyCode')} value={currencyCode} onChange={(event) => setCurrencyCode(event.target.value)} maxLength={3} required />
            <CmxInput label={t('fields.paymentTerms')} value={paymentTerms} onChange={(event) => setPaymentTerms(event.target.value)} />
            <CmxInput label={t('fields.paymentMethod')} value={paymentMethodCode} onChange={(event) => setPaymentMethodCode(event.target.value)} />
            <CmxInput label={t('fields.invoiceDate')} type="date" value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} required />
            <CmxInput label={t('fields.dueDate')} type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-900">{t('fields.notes')}</label>
            <CmxTextarea value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>
        </div>
      ) : null}

      {step === 2 && mode === 'MANUAL' ? (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">{t('manualLines.title')}</h2>
              <p className="text-sm text-slate-600">{t('manualLines.subtitle')}</p>
            </div>
            <CmxButton variant="outline" onClick={addLine}>
              {t('actions.addLine')}
            </CmxButton>
          </div>

          <div className="space-y-4">
            {computedLines.map((line, index) => (
              <div key={line.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{t('manualLines.lineLabel', { number: index + 1 })}</p>
                  <CmxButton variant="ghost" size="sm" onClick={() => removeLine(line.id)} disabled={lines.length === 1}>
                    {t('actions.removeLine')}
                  </CmxButton>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  <div className="md:col-span-2 xl:col-span-2">
                    <CmxInput label={t('fields.lineDescription')} value={line.description} onChange={(event) => updateLine(line.id, 'description', event.target.value)} required />
                  </div>
                  <CmxInput label={t('fields.quantity')} type="number" min="0.0001" step="0.0001" value={line.quantity} onChange={(event) => updateLine(line.id, 'quantity', event.target.value)} required />
                  <CmxMoneyField
                    label={t('fields.unitPrice')}
                    value={draftToValue(line.unitPrice)}
                    draftValue={line.unitPrice}
                    decimalPlaces={decimalPlaces}
                    min={0}
                    onValueChange={(_, d) => updateLine(line.id, 'unitPrice', d)}
                  />
                  <CmxMoneyField
                    label={t('fields.discount')}
                    value={draftToValue(line.discount)}
                    draftValue={line.discount}
                    decimalPlaces={decimalPlaces}
                    min={0}
                    onValueChange={(_, d) => updateLine(line.id, 'discount', d)}
                  />
                  <CmxMoneyField
                    label={t('fields.tax')}
                    value={draftToValue(line.tax)}
                    draftValue={line.tax}
                    decimalPlaces={decimalPlaces}
                    min={0}
                    onValueChange={(_, d) => updateLine(line.id, 'tax', d)}
                  />
                </div>
                <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 md:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{t('fields.subtotalPreview')}</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{line.subtotal.toFixed(4)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{t('fields.taxablePreview')}</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{line.taxable.toFixed(4)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{t('fields.totalPreview')}</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{line.total.toFixed(4)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {step === 2 && mode === 'FROM_ORDERS' ? (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">{t('orderBatch.title')}</h2>
            <p className="text-sm text-slate-600">{t('orderBatch.subtitle')}</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-900">{t('fields.orderIds')}</label>
            <CmxTextarea value={orderIdsDraft} onChange={(event) => setOrderIdsDraft(event.target.value)} />
            <p className="mt-2 text-xs text-slate-500">{t('orderBatch.hint')}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
            {t('orderBatch.count', { count: orderIds.length })}
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">{t('review.title')}</h2>
            <p className="text-sm text-slate-600">{t('review.subtitle')}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{t('review.mode')}</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{t(`modeOptions.${mode}`)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{t('review.currency')}</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{currencyCode.toUpperCase()}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{t('review.invoiceDate')}</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{invoiceDate}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{t('review.dueDate')}</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{dueDate}</p>
            </div>
          </div>

          {mode === 'MANUAL' ? (
            <div className="space-y-3">
              {computedLines.map((line, index) => (
                <div key={line.id} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{t('manualLines.lineLabel', { number: index + 1 })}</p>
                    <p className="text-sm text-slate-600">{line.description}</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">{line.total.toFixed(4)}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-600">{t('orderBatch.count', { count: orderIds.length })}</p>
              <p className="mt-2 break-words text-sm font-medium text-slate-900">{orderIds.join(', ')}</p>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{t('review.subtotal')}</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{totals.subtotal.toFixed(4)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{t('review.discount')}</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{totals.discount.toFixed(4)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{t('review.tax')}</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{totals.tax.toFixed(4)}</p>
            </div>
            <div className="rounded-xl bg-sky-50 p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-sky-700">{t('review.total')}</p>
              <p className="mt-2 text-sm font-semibold text-sky-900">{totals.total.toFixed(4)}</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 rtl:flex-row-reverse">
        <CmxButton variant="ghost" onClick={() => (step === 1 ? router.back() : setStep((current) => (current - 1) as 1 | 2 | 3))}>
          {step === 1 ? tCommon('cancel') : tCommon('back')}
        </CmxButton>
        <div className="flex items-center gap-2 rtl:flex-row-reverse">
          {step < 3 ? (
            <CmxButton onClick={() => setStep((current) => (current + 1) as 1 | 2 | 3)} disabled={step === 1 ? !canContinueFromStepOne : !canContinueFromStepTwo}>
              {t('actions.next')}
            </CmxButton>
          ) : (
            <CmxButton onClick={submit} loading={isSaving} disabled={!canSubmit}>
              {mode === 'MANUAL' ? t('actions.create') : t('actions.createFromOrders')}
            </CmxButton>
          )}
        </div>
      </div>
    </div>
  );
}
