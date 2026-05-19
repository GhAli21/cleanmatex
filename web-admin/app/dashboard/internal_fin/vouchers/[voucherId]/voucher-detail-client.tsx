'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { CmxButton } from '@ui/primitives/cmx-button';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { VoucherStatusBadge } from '@features/finance/vouchers/ui/voucher-status-badge';
import { VoucherDirectionBadge } from '@features/finance/vouchers/ui/voucher-direction-badge';
import { VoucherLineTable } from '@features/finance/vouchers/ui/voucher-line-table';
import { VoucherCancelDialog } from '@features/finance/vouchers/ui/voucher-cancel-dialog';
import { VoucherReversalDialog } from '@features/finance/vouchers/ui/voucher-reversal-dialog';
import { hasVoucherPermission } from '@features/finance/vouchers/access/vouchers-access';
import { cancelBizVoucherAction, postBizVoucherAction, reverseBizVoucherAction } from '@/app/actions/finance/voucher-actions';
import { deleteDraftVoucherLineAction } from '@/app/actions/finance/voucher-line-actions';
import { VOUCHER_STATUS } from '@/lib/constants/voucher';
import { useMessage } from '@ui/feedback/useMessage';
import type { BizVoucherDetailData } from '@/lib/types/voucher';

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

  const canPost    = hasVoucherPermission(userRole, 'fin_vouchers:post')    && voucher.voucher_status === VOUCHER_STATUS.DRAFT;
  const canCancel  = hasVoucherPermission(userRole, 'fin_vouchers:cancel')  && voucher.voucher_status === VOUCHER_STATUS.DRAFT;
  const canReverse = hasVoucherPermission(userRole, 'fin_vouchers:reverse') && voucher.voucher_status === VOUCHER_STATUS.POSTED;

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
          <CmxCardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
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
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{t('totalAmount')}</dt>
                <dd className="mt-1 font-mono font-semibold text-gray-900">
                  {voucher.total_amount.toLocaleString()} {voucher.currency_code}
                </dd>
              </div>
              {voucher.party_name && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{t('party')}</dt>
                  <dd className="mt-1 text-gray-900">{voucher.party_name}</dd>
                </div>
              )}
              {voucher.description && (
                <div className="col-span-2 sm:col-span-3">
                  <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{t('description')}</dt>
                  <dd className="mt-1 text-gray-700">{voucher.description}</dd>
                </div>
              )}
              {voucher.voucher_status === VOUCHER_STATUS.POSTED && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{t('postedAt')}</dt>
                  <dd className="mt-1 text-gray-700">
                    {voucher.posted_at ? new Date(voucher.posted_at).toLocaleDateString() : '—'}
                  </dd>
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
              <p className="mt-4 rounded-md bg-blue-50 px-4 py-3 text-sm text-blue-700">
                {t('postingNote')}
              </p>
            )}
          </CmxCardContent>
        </CmxCard>

        {/* Lines card */}
        <CmxCard>
          <CmxCardHeader>
            <CmxCardTitle>{t('transactionLines')}</CmxCardTitle>
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
    </>
  );
}
