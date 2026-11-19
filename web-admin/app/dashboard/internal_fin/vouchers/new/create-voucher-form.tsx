'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CmxButton, CmxInput, CmxSelect, CmxTextarea, Label } from '@ui/primitives';
import { createBizVoucherAction } from '@/app/actions/finance/voucher-actions';
import { VOUCHER_TYPE, VOUCHER_DIRECTION, PARTY_TYPE } from '@/lib/constants/voucher';
import type { VoucherDirection, VoucherType } from '@/lib/types/voucher';

/**
 * Legacy voucher creation form kept for the existing internal-finance flow.
 *
 * Why:
 * This screen still supports the simpler header-only voucher flow while the
 * richer Business Voucher Module continues to expand alongside it.
 *
 * @returns legacy voucher creation form UI
 */
export default function CreateVoucherForm() {
  const t = useTranslations('finance.vouchers');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [voucherType, setVoucherType] = useState<VoucherType>(VOUCHER_TYPE.RECEIPT);
  const [direction, setDirection] = useState<VoucherDirection>(VOUCHER_DIRECTION.IN);
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
        <div className="rounded-lg border border-danger-border bg-danger-bg p-4 text-sm text-danger-text">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="space-y-5">

          {/* Voucher Type */}
          <div>
            <Label className="mb-1 block">
              {t('voucherType')} <span className="text-danger-text">*</span>
            </Label>
            <div className="flex flex-wrap gap-2">
              {VOUCHER_TYPE_OPTIONS.map(({ value, labelKey }) => (
                <CmxButton
                  key={value}
                  type="button"
                  size="sm"
                  variant={voucherType === value ? 'primary' : 'outline'}
                  onClick={() => handleTypeChange(value)}
                >
                  {t(`voucherTypeLabels.${labelKey}`)}
                </CmxButton>
              ))}
            </div>
          </div>

          {/* Direction */}
          <div>
            <Label className="mb-1 block">
              {t('direction')}
            </Label>
            <div className="flex gap-2">
              {([VOUCHER_DIRECTION.IN, VOUCHER_DIRECTION.OUT, VOUCHER_DIRECTION.NEUTRAL] as const).map((d) => (
                <CmxButton
                  key={d}
                  type="button"
                  size="sm"
                  variant={direction === d ? 'primary' : 'outline'}
                  onClick={() => setDirection(d)}
                >
                  {t(`directionLabels.${d}`)}
                </CmxButton>
              ))}
            </div>
          </div>

          {/* Party Type */}
          <div>
            <Label className="mb-1 block">
              {t('partyType')} <span className="text-xs text-muted-foreground">({tCommon('optional')})</span>
            </Label>
            <CmxSelect
              value={partyType}
              onChange={(e) => setPartyType(e.target.value)}
              options={[
                { value: '', label: '—' },
                ...([PARTY_TYPE.CUSTOMER, PARTY_TYPE.SUPPLIER, PARTY_TYPE.EMPLOYEE, PARTY_TYPE.OTHER] as const).map((pt) => ({ value: pt, label: pt })),
              ]}
            />
          </div>

          {/* Party Name */}
          <div>
            <Label className="mb-1 block">
              {t('party')} <span className="text-xs text-muted-foreground">({tCommon('optional')})</span>
            </Label>
            <CmxInput
              type="text"
              value={partyName}
              onChange={(e) => setPartyName(e.target.value)}
              maxLength={250}
            />
          </div>

          {/* Description */}
          <div>
            <Label className="mb-1 block">
              {t('description')} <span className="text-xs text-muted-foreground">({tCommon('optional')})</span>
            </Label>
            <CmxInput
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div>
            <Label className="mb-1 block">
              {t('notes')} <span className="text-xs text-muted-foreground">({tCommon('optional')})</span>
            </Label>
            <CmxTextarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

        </div>
      </div>

      {/* Posting note */}
      <p className="text-xs text-muted-foreground">{t('postingNote')}</p>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <CmxButton type="button" variant="outline" asChild>
          <Link href="/dashboard/internal_fin/vouchers">
            {tCommon('cancel')}
          </Link>
        </CmxButton>
        <CmxButton type="submit" variant="primary" loading={isPending} disabled={isPending}>
          {isPending ? tCommon('loading') : tCommon('create')}
        </CmxButton>
      </div>
    </form>
  );
}
