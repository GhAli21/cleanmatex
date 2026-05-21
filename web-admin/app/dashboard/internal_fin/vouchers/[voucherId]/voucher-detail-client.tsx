'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { CmxButton } from '@ui/primitives/cmx-button';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { VoucherStatusBadge } from '@features/finance/vouchers/ui/voucher-status-badge';
import { VoucherDirectionBadge } from '@features/finance/vouchers/ui/voucher-direction-badge';
import { Plus } from 'lucide-react';
import { VoucherLineTable } from '@features/finance/vouchers/ui/voucher-line-table';
import { VoucherCancelDialog } from '@features/finance/vouchers/ui/voucher-cancel-dialog';
import { VoucherReversalDialog } from '@features/finance/vouchers/ui/voucher-reversal-dialog';
import { AddLineDialog } from '@features/finance/vouchers/ui/add-line-dialog';
import { hasVoucherPermission } from '@features/finance/vouchers/access/vouchers-access';
import { cancelBizVoucherAction, postBizVoucherAction, reverseBizVoucherAction } from '@/app/actions/finance/voucher-actions';
import { addVoucherLineAction, deleteDraftVoucherLineAction } from '@/app/actions/finance/voucher-line-actions';
import { VOUCHER_STATUS } from '@/lib/constants/voucher';
import { useMessage } from '@ui/feedback/useMessage';
import type { BizVoucherDetailData, CreateVoucherLineInput } from '@/lib/types/voucher';

interface VoucherDetailClientProps {
  voucher: BizVoucherDetailData;
  userRole: string;
}

export function VoucherDetailClient({ voucher, userRole }: VoucherDetailClientProps) {
  const t = useTranslations('finance.vouchers');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { showSuccess, showError } = useMessage();
  const [isPending, startTransition] = useTransition();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reversalOpen, setReversalOpen] = useState(false);
  const [addLineOpen, setAddLineOpen] = useState(false);

  const canPost      = hasVoucherPermission(userRole, 'fin_vouchers:post')            && voucher.voucher_status === VOUCHER_STATUS.DRAFT;
  const canCancel    = hasVoucherPermission(userRole, 'fin_vouchers:cancel')          && voucher.voucher_status === VOUCHER_STATUS.DRAFT;
  const canReverse   = hasVoucherPermission(userRole, 'fin_vouchers:reverse')         && voucher.voucher_status === VOUCHER_STATUS.POSTED;
  const canAddLine   = hasVoucherPermission(userRole, 'fin_voucher_lines:create')     && voucher.voucher_status === VOUCHER_STATUS.DRAFT;

  const handlePost = () => {
    startTransition(async () => {
      const result = await postBizVoucherAction(voucher.id);
      if (result.success) {
        showSuccess(t('postSuccess'));
        router.refresh();
      } else {
        showError(result.error ?? tCommon('error'));
      }
    });
  };

  const handleCancel = async (reason: string) => {
    const result = await cancelBizVoucherAction(voucher.id, reason);
    if (result.success) {
      showSuccess(t('cancelSuccess'));
      router.refresh();
    } else {
      showError(result.error ?? tCommon('error'));
    }
  };

  const handleReverse = async (reason: string) => {
    const result = await reverseBizVoucherAction(voucher.id, reason);
    if (result.success) {
      showSuccess(t('reverseSuccess'));
      router.refresh();
    } else {
      showError(result.error ?? tCommon('error'));
    }
  };

  const handleDeleteLine = async (lineId: string) => {
    const result = await deleteDraftVoucherLineAction(lineId, voucher.id);
    if (result.success) {
      showSuccess(t('lineDeleted'));
      router.refresh();
    } else {
      showError(result.error ?? tCommon('error'));
    }
  };

  const handleAddLine = async (input: CreateVoucherLineInput) => {
    const result = await addVoucherLineAction(voucher.id, input);
    if (result.success) {
      showSuccess(t('addLineSuccess'));
      setAddLineOpen(false);
      router.refresh();
    } else {
      showError(result.error ?? tCommon('error'));
    }
  };

  return (
    <>
      <div className="grid gap-6">
        {/* Header card */}
        <CmxCard>
          <CmxCardHeader className="flex flex-row items-center justify-between">
            <CmxCardTitle>{t('voucherSummary')}</CmxCardTitle>
            <div className="flex items-center gap-2 rtl:flex-row-reverse">
              {canPost && (
                <CmxButton onClick={handlePost} disabled={isPending}>
                  {t('actions.post')}
                </CmxButton>
              )}
              {canCancel && (
                <CmxButton variant="outline" onClick={() => setCancelOpen(true)} disabled={isPending}>
                  {t('actions.cancel')}
                </CmxButton>
              )}
              {canReverse && (
                <CmxButton variant="destructive" onClick={() => setReversalOpen(true)} disabled={isPending}>
                  {t('actions.reverse')}
                </CmxButton>
              )}
            </div>
          </CmxCardHeader>
          <CmxCardContent className="space-y-5">

            {/* ── Identity row ── */}
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{t('voucherNo')}</dt>
                <dd className="mt-1 font-mono font-medium text-gray-900">{voucher.voucher_no}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{t('voucherType')}</dt>
                <dd className="mt-1 text-gray-900">{voucher.voucher_type}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{tCommon('status')}</dt>
                <dd className="mt-1"><VoucherStatusBadge status={voucher.voucher_status} /></dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{t('direction')}</dt>
                <dd className="mt-1"><VoucherDirectionBadge direction={voucher.direction} /></dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{t('voucherDate')}</dt>
                <dd className="mt-1 text-gray-900">
                  {voucher.voucher_date ? new Date(voucher.voucher_date).toLocaleDateString() : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{t('postingStatus')}</dt>
                <dd className="mt-1">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    voucher.posting_status === 'POSTED'         ? 'bg-green-100 text-green-800'
                    : voucher.posting_status === 'POSTING_FAILED' ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-600'
                  }`}>
                    {voucher.posting_status}
                  </span>
                </dd>
              </div>
              {voucher.currency_code && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{t('currencyCode')}</dt>
                  <dd className="mt-1 font-mono text-gray-900">{voucher.currency_code}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{t('createdAt')}</dt>
                <dd className="mt-1 text-gray-700">{new Date(voucher.created_at).toLocaleDateString()}</dd>
              </div>
            </dl>

            {/* ── Amount block ── */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">{t('totalAmount')}</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4 text-sm">
                {/* DRAFT: show live lines total; POSTED+: show persisted total */}
                {voucher.voucher_status === VOUCHER_STATUS.DRAFT ? (
                  <div className="col-span-2 sm:col-span-4">
                    <dt className="text-xs font-medium text-gray-500">{t('linesTotal')}</dt>
                    <dd className="mt-0.5 font-mono text-xl font-bold text-gray-900">
                      {voucher.lines.reduce((s, l) => s + l.amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      {voucher.currency_code && <span className="ms-1.5 text-sm font-normal text-gray-500">{voucher.currency_code}</span>}
                    </dd>
                  </div>
                ) : (
                  <>
                    <div>
                      <dt className="text-xs font-medium text-gray-500">{t('totalAmount')}</dt>
                      <dd className="mt-0.5 font-mono text-xl font-bold text-gray-900">
                        {voucher.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        {voucher.currency_code && <span className="ms-1.5 text-sm font-normal text-gray-500">{voucher.currency_code}</span>}
                      </dd>
                    </div>
                    {voucher.paid_amount != null && (
                      <div>
                        <dt className="text-xs font-medium text-gray-500">{t('paidAmount')}</dt>
                        <dd className="mt-0.5 font-mono font-semibold text-green-700">
                          {voucher.paid_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </dd>
                      </div>
                    )}
                    {voucher.outstanding_amount != null && (
                      <div>
                        <dt className="text-xs font-medium text-gray-500">{t('outstandingAmount')}</dt>
                        <dd className={`mt-0.5 font-mono font-semibold ${voucher.outstanding_amount > 0 ? 'text-amber-700' : 'text-gray-700'}`}>
                          {voucher.outstanding_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </dd>
                      </div>
                    )}
                    {voucher.refunded_amount != null && voucher.refunded_amount > 0 && (
                      <div>
                        <dt className="text-xs font-medium text-gray-500">{t('refundedAmount')}</dt>
                        <dd className="mt-0.5 font-mono font-semibold text-red-600">
                          {voucher.refunded_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </dd>
                      </div>
                    )}
                    {voucher.discount_amount != null && voucher.discount_amount > 0 && (
                      <div>
                        <dt className="text-xs font-medium text-gray-500">{t('discountAmount')}</dt>
                        <dd className="mt-0.5 font-mono text-gray-700">
                          {voucher.discount_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </dd>
                      </div>
                    )}
                    {voucher.tax_amount != null && voucher.tax_amount > 0 && (
                      <div>
                        <dt className="text-xs font-medium text-gray-500">{t('taxAmount')}</dt>
                        <dd className="mt-0.5 font-mono text-gray-700">
                          {voucher.tax_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </dd>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* ── Party & notes row ── */}
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              {voucher.party_type && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{t('partyType')}</dt>
                  <dd className="mt-1 text-gray-900">{voucher.party_type}</dd>
                </div>
              )}
              {voucher.party_name && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{t('party')}</dt>
                  <dd className="mt-1 text-gray-900">{voucher.party_name}</dd>
                </div>
              )}
              {voucher.voucher_status === VOUCHER_STATUS.POSTED && voucher.posted_at && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{t('postedAt')}</dt>
                  <dd className="mt-1 text-gray-700">{new Date(voucher.posted_at).toLocaleDateString()}</dd>
                </div>
              )}
              {voucher.description && (
                <div className="col-span-2 sm:col-span-3">
                  <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{t('description')}</dt>
                  <dd className="mt-1 text-gray-700">{voucher.description}</dd>
                </div>
              )}
              {voucher.notes && (
                <div className="col-span-2 sm:col-span-3">
                  <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{t('notes')}</dt>
                  <dd className="mt-1 text-gray-700">{voucher.notes}</dd>
                </div>
              )}
              {voucher.reversal_reason && (
                <div className="col-span-2 sm:col-span-3">
                  <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{t('reversalReason')}</dt>
                  <dd className="mt-1 text-gray-700">{voucher.reversal_reason}</dd>
                </div>
              )}
            </dl>

            {voucher.voucher_status === VOUCHER_STATUS.POSTED && (
              <p className="rounded-md bg-blue-50 px-4 py-3 text-sm text-blue-700">
                {t('postingNote')}
              </p>
            )}
          </CmxCardContent>
        </CmxCard>

        {/* Lines card */}
        <CmxCard>
          <CmxCardHeader className="flex flex-row items-center justify-between rtl:flex-row-reverse">
            <CmxCardTitle>{t('transactionLines')}</CmxCardTitle>
            {canAddLine && (
              <CmxButton
                size="sm"
                onClick={() => setAddLineOpen(true)}
                disabled={isPending}
                className="flex items-center gap-1.5 rtl:flex-row-reverse"
              >
                <Plus className="h-4 w-4" />
                {t('actions.addLine')}
              </CmxButton>
            )}
          </CmxCardHeader>
          <CmxCardContent className="p-0">
            <VoucherLineTable
              lines={voucher.lines}
              voucherStatus={voucher.voucher_status}
              onDeleteLine={voucher.voucher_status === VOUCHER_STATUS.DRAFT ? handleDeleteLine : undefined}
            />
          </CmxCardContent>
        </CmxCard>
      </div>

      <VoucherCancelDialog open={cancelOpen} onClose={() => setCancelOpen(false)} onConfirm={handleCancel} />
      <VoucherReversalDialog open={reversalOpen} onClose={() => setReversalOpen(false)} onConfirm={handleReverse} />
      {canAddLine && (
        <AddLineDialog
          open={addLineOpen}
          onClose={() => setAddLineOpen(false)}
          onAdd={handleAddLine}
          isPending={isPending}
        />
      )}
    </>
  );
}
