'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { TaxDocumentPrintDetail } from '@/lib/services/tax-document-read.service';

interface TaxDocumentPrintRprtProps {
  detail: TaxDocumentPrintDetail;
}

// Region-neutral locale (FN-11 precedent): the currency code drives the
// symbol, never a hardcoded region.
function formatCurrency(amount: number, currencyCode: string | null, locale: string) {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar' : 'en', {
    style: 'currency',
    currency: currencyCode || 'OMR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount);
}

function formatDateTime(value: string | null, locale: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

/**
 * Bilingual, printable fiscal tax document — B14 follow-up. Mirrors the
 * established `ar-invoice-print-rprt.tsx` layout/structure (the identified
 * template per B14's own doc) with a verification QR code in place of an
 * itemized line table, since a tax document models tax facts, not order
 * item lines.
 * @param root0
 * @param root0.detail
 */
export function TaxDocumentPrintRprt({ detail }: TaxDocumentPrintRprtProps) {
  const t = useTranslations('taxDocuments');
  const locale = useLocale();
  const subtotal = detail.totalAmount - detail.taxAmount;

  const tRaw = t as unknown as (key: string) => string;
  const typeLabel =
    tRaw(`type.${detail.documentType}`) !== `type.${detail.documentType}`
      ? tRaw(`type.${detail.documentType}`)
      : detail.documentType;
  const statusLabel =
    tRaw(`status.${detail.status}`) !== `status.${detail.status}`
      ? tRaw(`status.${detail.status}`)
      : detail.status;

  return (
    <div className="rounded-xl bg-white p-8 shadow-sm print:rounded-none print:p-0 print:shadow-none">
      <div className="border-b border-slate-200 pb-6">
        <div className="flex items-start justify-between gap-6">
          <div className="space-y-2">
            {detail.seller.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- tenant-supplied external URL, not in next/image's configured domains
              <img src={detail.seller.logoUrl} alt="" className="h-10 w-auto object-contain" />
            ) : null}
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{t('print.documentLabel')}</p>
            <h1 className="text-3xl font-semibold text-slate-950">{detail.documentNo ?? '—'}</h1>
            <p className="text-sm text-slate-600">{typeLabel}</p>
          </div>
          <div className="grid gap-2 text-sm text-slate-600">
            <div className="flex gap-3">
              <span className="min-w-28 font-medium text-slate-900">{t('print.fields.status')}</span>
              <span>{statusLabel}</span>
            </div>
            <div className="flex gap-3">
              <span className="min-w-28 font-medium text-slate-900">{t('print.fields.issuedAt')}</span>
              <span>{formatDateTime(detail.issuedAt, locale)}</span>
            </div>
            <div className="flex gap-3">
              <span className="min-w-28 font-medium text-slate-900">{t('sequenceNo')}</span>
              <span>{detail.fiscalYear} / {String(detail.sequenceNumber).padStart(6, '0')}</span>
            </div>
            <div className="flex gap-3">
              <span className="min-w-28 font-medium text-slate-900">{t('print.orderRef')}</span>
              <span>{detail.order.orderNo ?? '—'}</span>
            </div>
          </div>
        </div>
        {detail.supersedesId ? (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            {t('print.supersedesNote')}
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 py-6 md:grid-cols-3">
        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">{t('print.seller')}</h2>
          <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-700">
            <p className="font-medium text-slate-900">{detail.seller.name || '—'}</p>
            {detail.seller.name2 ? <p>{detail.seller.name2}</p> : null}
            <p>{detail.seller.address ?? '—'}</p>
            <p className="mt-2">
              <span className="font-medium text-slate-900">{t('print.taxRegistrationNo')}: </span>
              {detail.seller.taxRegistrationNo ?? '—'}
            </p>
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">{t('print.customer')}</h2>
          <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-700">
            {detail.customer ? (
              <>
                <p className="font-medium text-slate-900">{detail.customer.name ?? detail.customer.name2 ?? '—'}</p>
                <p>{detail.customer.phone ?? '—'}</p>
              </>
            ) : (
              <p>{t('print.noCustomer')}</p>
            )}
          </div>
        </div>
        <div className="space-y-2 print:hidden">
          {detail.qrCodeDataUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- data: URL, next/image cannot optimize it */}
              <img src={detail.qrCodeDataUrl} alt={t('print.qrHint')} className="h-28 w-28" />
              <p className="max-w-36 text-xs text-slate-500">{t('print.qrHint')}</p>
            </>
          ) : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">{t('print.columns.taxType')}</th>
              <th className="px-4 py-3 text-left">{t('print.columns.label')}</th>
              <th className="px-4 py-3 text-right">{t('print.columns.rate')}</th>
              <th className="px-4 py-3 text-right">{t('print.columns.baseAmount')}</th>
              <th className="px-4 py-3 text-right">{t('print.columns.taxAmount')}</th>
            </tr>
          </thead>
          <tbody>
            {detail.lines.length === 0 ? (
              <tr className="border-t border-slate-200">
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  {t('print.noLines')}
                </td>
              </tr>
            ) : (
              detail.lines.map((line) => (
                <tr key={line.id} className="border-t border-slate-200">
                  <td className="px-4 py-3 text-slate-800">{line.taxType}</td>
                  <td className="px-4 py-3 text-slate-800">{line.label}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{line.rate != null ? `${line.rate}%` : '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {formatCurrency(line.baseAmount, detail.currencyCode, locale)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">
                    {formatCurrency(line.taxAmount, detail.currencyCode, locale)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 ms-auto w-full max-w-md space-y-2 rounded-xl border border-slate-200 p-4 text-sm">
        <div className="flex items-center justify-between">
          <span>{t('print.totals.subtotal')}</span>
          <span>{formatCurrency(subtotal, detail.currencyCode, locale)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>{t('print.totals.tax')}</span>
          <span>{formatCurrency(detail.taxAmount, detail.currencyCode, locale)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-950">
          <span>{t('print.totals.total')}</span>
          <span>{formatCurrency(detail.totalAmount, detail.currencyCode, locale)}</span>
        </div>
      </div>
    </div>
  );
}
