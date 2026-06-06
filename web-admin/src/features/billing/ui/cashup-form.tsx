'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { submitCashUp } from '@/app/actions/billing/cashup-actions';
import type { CashUpDayData, CashUpSubmitEntry } from '@/lib/types/payment';
import { CmxMoneyField } from '@ui/primitives';
import { CmxKeypad, KEYPAD_NUMERIC_3COL } from '@ui/utilities';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { applyKeypadInput, parseMoneyDraft } from '@/lib/money/money-draft';

interface CashUpFormProps {
  data: CashUpDayData;
  selectedDate: string;
  currencyCode: string;
  /** Called after a successful save so the parent can refresh history. */
  onSuccess?: () => void;
}

function formatAmount(value: number, decimals: number): string {
  return value.toFixed(decimals);
}

export default function CashUpForm({
  data,
  selectedDate,
  currencyCode,
  onSuccess,
}: CashUpFormProps) {
  const locale = useLocale();
  const t = useTranslations('cashup');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { decimalPlaces: decimals } = useTenantCurrency();
  const [activeMethodCode, setActiveMethodCode] = useState<string | null>(null);

  const reconByMethod = Object.fromEntries(
    data.reconciliation.map((r) => [r.payment_method_code, r])
  );

  const [actualByMethod, setActualByMethod] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const m of data.paymentMethods) {
      const code = m.payment_method_code;
      const existing = reconByMethod[code];
      initial[code] =
        existing != null
          ? formatAmount(existing.actual_amount, decimals)
          : (data.expectedByMethod[code] ?? 0) > 0
            ? formatAmount(data.expectedByMethod[code], decimals)
            : '';
    }
    return initial;
  });

  const [notesByMethod, setNotesByMethod] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const r of data.reconciliation) {
      if (r.notes) initial[r.payment_method_code] = r.notes;
    }
    return initial;
  });

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleActualChange = useCallback((code: string, value: string) => {
    setActualByMethod((prev) => ({ ...prev, [code]: value }));
    setMessage(null);
  }, []);

  const handleNotesChange = useCallback((code: string, value: string) => {
    setNotesByMethod((prev) => ({ ...prev, [code]: value }));
  }, []);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setMessage(null);
    try {
      const entries: CashUpSubmitEntry[] = data.paymentMethods.map((m) => {
        const code = m.payment_method_code;
        const raw = actualByMethod[code] ?? '';
        const actual_amount = Math.max(0, parseMoneyDraft(raw));
        return {
          payment_method_code: code,
          actual_amount,
          notes: notesByMethod[code]?.trim() || undefined,
        };
      });

      const result = await submitCashUp({ date: selectedDate, entries });
      if (result.success === false) {
        setMessage({ type: 'error', text: result.error });
      } else {
        setMessage({ type: 'success', text: t('successMessage') });
        router.refresh();
        onSuccess?.();
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : t('errorMessage'),
      });
    } finally {
      setSubmitting(false);
    }
  }, [data.paymentMethods, actualByMethod, notesByMethod, selectedDate, t, router, onSuccess]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <label className="text-sm font-medium text-gray-700">{t('date')}</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => {
            const v = e.target.value;
            if (v) router.push(`/dashboard/internal_fin/cashup?date=${v}`);
          }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          aria-label={t('selectDate')}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                {t('method')}
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                {t('expectedAmount')}
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                {t('actualAmount')}
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                {t('variance')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                {t('notes')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {data.paymentMethods.map((m) => {
              const code = m.payment_method_code;
              const expected = data.expectedByMethod[code] ?? 0;
              const actualStr = actualByMethod[code] ?? '';
              const actual = parseMoneyDraft(actualStr);
              const variance = actual - expected;
              const methodName =
                locale === 'ar'
                  ? (m.payment_method_name2 ?? m.payment_method_name ?? code)
                  : (m.payment_method_name ?? m.payment_method_name2 ?? code);
              return (
                <tr key={code}>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                    {methodName}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-700">
                    {formatAmount(expected, decimals)} {currencyCode}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <CmxMoneyField
                      value={parseMoneyDraft(actualByMethod[code] ?? '') || null}
                      draftValue={actualByMethod[code] ?? ''}
                      decimalPlaces={decimals}
                      min={0}
                      showZero
                      onFocus={() => setActiveMethodCode(code)}
                      onValueChange={(_, d) => handleActualChange(code, d)}
                      aria-label={`${t('actualAmount')} ${methodName}`}
                      className="w-28 text-right"
                    />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                    <span
                      className={
                        variance === 0
                          ? 'text-gray-700'
                          : variance > 0
                            ? 'text-green-600'
                            : 'text-red-600'
                      }
                    >
                      {formatAmount(variance, decimals)} {currencyCode}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={notesByMethod[code] ?? ''}
                      onChange={(e) => handleNotesChange(code, e.target.value)}
                      placeholder={t('notes')}
                      className="w-full max-w-xs rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                      aria-label={`${t('notes')} ${methodName}`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {activeMethodCode && (
        <div className="mt-4">
          <CmxKeypad
            keys={KEYPAD_NUMERIC_3COL}
            columns={3}
            keyHeight="lg"
            onKeyPress={(key) => {
              const current = actualByMethod[activeMethodCode] ?? '';
              const next = applyKeypadInput(current, key, decimals);
              handleActualChange(activeMethodCode, next);
            }}
            onKeyLongPress={(k) => {
              if (k === 'backspace') handleActualChange(activeMethodCode, '');
            }}
            getKeyClassName={(k) => k === 'backspace' ? undefined : 'bg-white'}
          />
        </div>
      )}

      {message && (
        <div
          className={`mt-4 rounded-md p-3 text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800'
              : 'bg-red-50 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="mt-6">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? tCommon('loading') : t('submit')}
        </button>
      </div>
    </div>
  );
}
