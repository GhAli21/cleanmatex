'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBizVoucherAction } from '@/app/actions/finance/voucher-actions';
import { VOUCHER_TYPE, VOUCHER_DIRECTION, PARTY_TYPE } from '@/lib/constants/voucher';
import type { VoucherType } from '@/lib/types/voucher';

export default function CreateVoucherForm() {
  const t = useTranslations('finance.vouchers');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [voucherType, setVoucherType] = useState<VoucherType>(VOUCHER_TYPE.RECEIPT);
  const [direction, setDirection] = useState(VOUCHER_DIRECTION.IN);
  const [partyType, setPartyType] = useState('');
  const [partyName, setPartyName] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');

  const VOUCHER_TYPE_OPTIONS: { value: VoucherType; labelKey: string }[] = [
    { value: VOUCHER_TYPE.RECEIPT,    labelKey: 'RECEIPT_VOUCHER' },
    { value: VOUCHER_TYPE.PAYMENT,    labelKey: 'PAYMENT_VOUCHER' },
    { value: VOUCHER_TYPE.REFUND,     labelKey: 'REFUND_VOUCHER' },
    { value: VOUCHER_TYPE.ADJUSTMENT, labelKey: 'ADJUSTMENT_VOUCHER' },
    { value: VOUCHER_TYPE.TRANSFER,   labelKey: 'TRANSFER_VOUCHER' },
  ];

  function handleTypeChange(type: VoucherType) {
    setVoucherType(type);
    // Auto-set direction hint
    if (type === VOUCHER_TYPE.RECEIPT)                                       setDirection(VOUCHER_DIRECTION.IN);
    else if (type === VOUCHER_TYPE.PAYMENT || type === VOUCHER_TYPE.REFUND)  setDirection(VOUCHER_DIRECTION.OUT);
    else                                                                      setDirection(VOUCHER_DIRECTION.NEUTRAL);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createBizVoucherAction({
        voucher_type:  voucherType,
        direction:     direction as never,
        party_type:    partyType   as never || undefined,
        party_name:    partyName   || undefined,
        description:   description || undefined,
        notes:         notes       || undefined,
        voucher_date:  new Date().toISOString().split('T')[0],
      });

      if (result.success && result.data) {
        router.push(`/dashboard/internal_fin/vouchers/${result.data.id}`);
      } else {
        setError(result.error ?? tCommon('error'));
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="space-y-5">

          {/* Voucher Type */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('voucherType')} <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {VOUCHER_TYPE_OPTIONS.map(({ value, labelKey }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleTypeChange(value)}
                  className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                    voucherType === value
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {t(`voucherTypeLabels.${labelKey}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Direction */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('direction')}
            </label>
            <div className="flex gap-2">
              {([VOUCHER_DIRECTION.IN, VOUCHER_DIRECTION.OUT, VOUCHER_DIRECTION.NEUTRAL] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDirection(d)}
                  className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                    direction === d
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {t(`directionLabels.${d}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Party Type */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('partyType')} <span className="text-xs text-gray-400">({tCommon('optional')})</span>
            </label>
            <select
              value={partyType}
              onChange={(e) => setPartyType(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">—</option>
              {([PARTY_TYPE.CUSTOMER, PARTY_TYPE.SUPPLIER, PARTY_TYPE.EMPLOYEE, PARTY_TYPE.OTHER] as const).map((pt) => (
                <option key={pt} value={pt}>{pt}</option>
              ))}
            </select>
          </div>

          {/* Party Name */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('party')} <span className="text-xs text-gray-400">({tCommon('optional')})</span>
            </label>
            <input
              type="text"
              value={partyName}
              onChange={(e) => setPartyName(e.target.value)}
              maxLength={250}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('description')} <span className="text-xs text-gray-400">({tCommon('optional')})</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('notes')} <span className="text-xs text-gray-400">({tCommon('optional')})</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

        </div>
      </div>

      {/* Posting note */}
      <p className="text-xs text-gray-400">{t('postingNote')}</p>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Link
          href="/dashboard/internal_fin/vouchers"
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {tCommon('cancel')}
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? tCommon('loading') : tCommon('create')}
        </button>
      </div>
    </form>
  );
}
