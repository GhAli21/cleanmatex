'use client';

import { useEffect, useRef, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CmxButton, CmxInput, CmxSelect } from '@ui/primitives';
import { AR_INVOICE_TYPES } from '@/lib/constants/ar-invoice';

const INVOICE_TYPE_OPTIONS = [
  AR_INVOICE_TYPES.MANUAL_AR,
  AR_INVOICE_TYPES.ORDER_CREDIT,
  AR_INVOICE_TYPES.B2B_ORDER,
  AR_INVOICE_TYPES.B2B_STATEMENT,
  AR_INVOICE_TYPES.CREDIT_MEMO,
  AR_INVOICE_TYPES.DEBIT_NOTE,
  AR_INVOICE_TYPES.PROFORMA,
] as const;

const STATUS_OPTIONS = [
  'DRAFT',
  'OPEN',
  'PARTIALLY_PAID',
  'PAID',
  'OVERDUE',
  'CANCELLED',
  'VOID',
  'WRITTEN_OFF',
  'DISPUTED',
] as const;

export function ArInvoiceHubFilters() {
  const t = useTranslations('invoices.ar.hub');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const searchValue = searchParams.get('search') ?? '';
  const searchTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (searchTimerRef.current != null) {
        window.clearTimeout(searchTimerRef.current);
      }
    };
  }, []);

  const updateParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value == null || value === '') params.delete(key);
      else params.set(key, value);
    }
    params.set('page', '1');
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 lg:grid-cols-[2fr_repeat(4,minmax(0,1fr))]">
        <CmxInput
          key={searchValue}
          label={t('filters.searchLabel')}
          placeholder={t('filters.searchPlaceholder')}
          defaultValue={searchValue}
          onChange={(event) => {
            if (searchTimerRef.current != null) {
              window.clearTimeout(searchTimerRef.current);
            }

            const nextValue = event.target.value;
            searchTimerRef.current = window.setTimeout(() => {
              updateParams({ search: nextValue || null });
            }, 250);
          }}
          disabled={isPending}
        />
        <CmxSelect
          label={t('filters.status')}
          value={searchParams.get('status') ?? ''}
          onChange={(event) => updateParams({ status: event.target.value || null })}
          options={[
            { value: '', label: t('filters.allStatuses') },
            ...STATUS_OPTIONS.map((status) => ({
              value: status,
              label: t(`statusOptions.${status}`),
            })),
          ]}
          disabled={isPending}
        />
        <CmxSelect
          label={t('filters.invoiceType')}
          value={searchParams.get('invoice_type_cd') ?? ''}
          onChange={(event) => updateParams({ invoice_type_cd: event.target.value || null })}
          options={[
            { value: '', label: t('filters.allTypes') },
            ...INVOICE_TYPE_OPTIONS.map((type) => ({
              value: type,
              label: t(`invoiceTypeOptions.${type}`),
            })),
          ]}
          disabled={isPending}
        />
        <CmxInput
          label={t('filters.dateFrom')}
          type="date"
          value={searchParams.get('date_from') ?? ''}
          onChange={(event) => updateParams({ date_from: event.target.value || null })}
          disabled={isPending}
        />
        <CmxInput
          label={t('filters.dateTo')}
          type="date"
          value={searchParams.get('date_to') ?? ''}
          onChange={(event) => updateParams({ date_to: event.target.value || null })}
          disabled={isPending}
        />
        <div className="flex items-end">
          <CmxButton
            variant="outline"
            className="w-full"
            onClick={() => {
              if (searchTimerRef.current != null) {
                window.clearTimeout(searchTimerRef.current);
              }
              startTransition(() => router.push(pathname));
            }}
            disabled={isPending && searchParams.toString().length === 0}
          >
            {tCommon('clearFilters')}
          </CmxButton>
        </div>
      </div>
    </div>
  );
}
