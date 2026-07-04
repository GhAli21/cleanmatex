'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CmxButton } from '@ui/primitives/cmx-button';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { VoucherStatusBadge } from '@features/finance/vouchers/ui/voucher-status-badge';
import { VoucherDirectionBadge } from '@features/finance/vouchers/ui/voucher-direction-badge';
import { ArrowUpRight, Plus } from 'lucide-react';
import { VoucherLineTable } from '@features/finance/vouchers/ui/voucher-line-table';
import { VoucherCancelDialog } from '@features/finance/vouchers/ui/voucher-cancel-dialog';
import { VoucherReversalDialog } from '@features/finance/vouchers/ui/voucher-reversal-dialog';
import { AddLineDialog } from '@features/finance/vouchers/ui/add-line-dialog';
import { VoucherPostPreviewDialog } from '@features/finance/vouchers/ui/voucher-post-preview-dialog';
import { VoucherLinkedEffectsPanel } from '@features/finance/vouchers/ui/voucher-linked-effects-panel';
import { hasVoucherPermission } from '@features/finance/vouchers/access/vouchers-access';
import { cancelBizVoucherAction, reverseBizVoucherAction } from '@/app/actions/finance/voucher-actions';
import { addVoucherLineAction, deleteDraftVoucherLineAction } from '@/app/actions/finance/voucher-line-actions';
import { VOUCHER_STATUS } from '@/lib/constants/voucher';
import { useMessage } from '@ui/feedback/useMessage';
import type { BizVoucherDetailData, CreateVoucherLineInput } from '@/lib/types/voucher';
import type { LinkedEffectsResult } from '@/lib/types/voucher-wiring';
import { VoucherDetailCopyValue } from '@features/finance/vouchers/ui/voucher-detail-data-table';

interface VoucherDetailClientProps {
  voucher: BizVoucherDetailData;
  userRole: string;
  linkedEffects?: LinkedEffectsResult | null;
}

function formatDate(value?: string | Date | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function VoucherDetailField({
  label,
  value,
  copyValue,
  maxLength,
  href,
  linkLabel,
  viewLabel,
}: {
  label: string;
  value: ReactNode;
  copyValue?: string | number | null;
  maxLength?: number;
  href?: string | null;
  linkLabel?: string;
  viewLabel: string;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-background p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {copyValue !== undefined ? (
          <VoucherDetailCopyValue value={copyValue} maxLength={maxLength} className="font-medium" />
        ) : (
          <div className="text-sm font-medium text-foreground">{value}</div>
        )}
        {copyValue === undefined && value}
        {href && (
          <Link
            href={href}
            className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-muted"
          >
            {linkLabel ?? viewLabel}
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  );
}

/**
 *
 * @param root0
 * @param root0.voucher
 * @param root0.userRole
 * @param root0.linkedEffects
 */
export function VoucherDetailClient({ voucher, userRole, linkedEffects }: VoucherDetailClientProps) {
  const t = useTranslations('finance.vouchers');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { showSuccess, showError } = useMessage();
  const [isPending] = useTransition();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reversalOpen, setReversalOpen] = useState(false);
  const [addLineOpen, setAddLineOpen] = useState(false);
  const [postPreviewOpen, setPostPreviewOpen] = useState(false);

  // PAYMENTS source refs pointed at the retired internal_fin/payments screens
  // (legacy payments ledger (dropped by migration 0395), ADR-002) — shown unlinked now.
  const sourceRefLink =
    voucher.source_module === 'ORDERS' && voucher.source_ref_id
      ? `/dashboard/orders/${voucher.source_ref_id}/full`
      : voucher.source_module === 'INVOICES' && voucher.source_ref_id
        ? `/dashboard/internal_fin/invoices/${voucher.source_ref_id}`
        : null;

  const canPost      = hasVoucherPermission(userRole, 'fin_vouchers:post')            && voucher.voucher_status === VOUCHER_STATUS.DRAFT;
  const canCancel    = hasVoucherPermission(userRole, 'fin_vouchers:cancel')          && voucher.voucher_status === VOUCHER_STATUS.DRAFT;
  const canReverse   = hasVoucherPermission(userRole, 'fin_vouchers:reverse')         && voucher.voucher_status === VOUCHER_STATUS.POSTED;
  const canAddLine   = hasVoucherPermission(userRole, 'fin_voucher_lines:create')     && voucher.voucher_status === VOUCHER_STATUS.DRAFT;

  const handlePostSuccess = () => {
    showSuccess(t('postAndWireSuccess'));
    router.refresh();
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
      <div className="grid min-w-0 gap-6">
        {/* Header card */}
        <CmxCard className="min-w-0">
          <CmxCardHeader className="flex flex-row items-center justify-between">
            <CmxCardTitle>{t('voucherSummary')}</CmxCardTitle>
            <div className="flex items-center gap-2 rtl:flex-row-reverse">
              {canPost && (
                <CmxButton onClick={() => setPostPreviewOpen(true)} disabled={isPending}>
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
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <VoucherDetailField label={t('voucherNo')} value={voucher.voucher_no} copyValue={voucher.voucher_no} viewLabel={tCommon('view')} />
              <VoucherDetailField label={t('voucherType')} value={voucher.voucher_type} copyValue={voucher.voucher_type} viewLabel={tCommon('view')} />
              <VoucherDetailField
                label={tCommon('status')}
                value={<VoucherStatusBadge status={voucher.voucher_status} />}
                viewLabel={tCommon('view')}
              />
              <VoucherDetailField
                label={t('direction')}
                value={<VoucherDirectionBadge direction={voucher.direction} />}
                viewLabel={tCommon('view')}
              />
              <VoucherDetailField label={t('voucherDate')} value={formatDate(voucher.voucher_date)} copyValue={formatDate(voucher.voucher_date)} viewLabel={tCommon('view')} />
              <VoucherDetailField
                label={t('voucherDateTime')}
                value={formatDate(voucher.voucher_datetime)}
                copyValue={formatDate(voucher.voucher_datetime)}
                viewLabel={tCommon('view')}
              />
              <VoucherDetailField label={t('postingStatus')} value={voucher.posting_status} copyValue={voucher.posting_status} viewLabel={tCommon('view')} />
              <VoucherDetailField label={t('currencyCode')} value={voucher.currency_code ?? '—'} copyValue={voucher.currency_code} viewLabel={tCommon('view')} />
              <VoucherDetailField label={t('currencyExRate')} value={voucher.currency_ex_rate ?? '—'} copyValue={voucher.currency_ex_rate ?? null} viewLabel={tCommon('view')} />
              <VoucherDetailField label={t('createdAt')} value={formatDate(voucher.created_at)} copyValue={formatDate(voucher.created_at)} viewLabel={tCommon('view')} />
              <VoucherDetailField label={t('createdBy')} value={voucher.created_by ?? '—'} copyValue={voucher.created_by} viewLabel={tCommon('view')} />
              <VoucherDetailField label={t('updatedAt')} value={formatDate(voucher.updated_at)} copyValue={formatDate(voucher.updated_at)} viewLabel={tCommon('view')} />
              <VoucherDetailField label={t('updatedBy')} value={voucher.updated_by ?? '—'} copyValue={voucher.updated_by} viewLabel={tCommon('view')} />
            </div>

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

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <VoucherDetailField label={t('partyType')} value={voucher.party_type ?? '—'} copyValue={voucher.party_type} viewLabel={tCommon('view')} />
              <VoucherDetailField label={t('party')} value={voucher.party_name ?? '—'} copyValue={voucher.party_name} viewLabel={tCommon('view')} />
              <VoucherDetailField
                label={t('orderId')}
                value={voucher.order_id ?? '—'}
                copyValue={voucher.order_id}
                href={voucher.order_id ? `/dashboard/orders/${voucher.order_id}/full` : null}
                linkLabel={t('relatedOrder')}
                viewLabel={tCommon('view')}
              />
              <VoucherDetailField
                label={t('invoiceId')}
                value={voucher.invoice_id ?? '—'}
                copyValue={voucher.invoice_id}
                href={voucher.invoice_id ? `/dashboard/internal_fin/invoices/${voucher.invoice_id}` : null}
                linkLabel={t('relatedInvoice')}
                viewLabel={tCommon('view')}
              />
              <VoucherDetailField
                label={t('customerId')}
                value={voucher.customer_id ?? '—'}
                copyValue={voucher.customer_id}
                href={voucher.customer_id ? `/dashboard/customers/${voucher.customer_id}` : null}
                linkLabel={t('relatedCustomer')}
                viewLabel={tCommon('view')}
              />
              <VoucherDetailField label={t('supplierId')} value={voucher.supplier_id ?? '—'} copyValue={voucher.supplier_id} viewLabel={tCommon('view')} />
              <VoucherDetailField label={t('employeeId')} value={voucher.employee_id ?? '—'} copyValue={voucher.employee_id} viewLabel={tCommon('view')} />
              <VoucherDetailField label={t('sourceModule')} value={voucher.source_module ?? '—'} copyValue={voucher.source_module} viewLabel={tCommon('view')} />
              <VoucherDetailField label={t('sourceRefType')} value={voucher.source_ref_type ?? '—'} copyValue={voucher.source_ref_type} viewLabel={tCommon('view')} />
              <VoucherDetailField
                label={t('sourceRefId')}
                value={voucher.source_ref_id ?? '—'}
                copyValue={voucher.source_ref_id}
                href={sourceRefLink}
                linkLabel={t('openSource')}
                viewLabel={tCommon('view')}
              />
              <VoucherDetailField label={t('postedAt')} value={formatDate(voucher.posted_at)} copyValue={formatDate(voucher.posted_at)} viewLabel={tCommon('view')} />
              <VoucherDetailField label={t('postedBy')} value={voucher.posted_by ?? '—'} copyValue={voucher.posted_by} viewLabel={tCommon('view')} />
              <VoucherDetailField label={t('reversedAt')} value={formatDate(voucher.reversed_at)} copyValue={formatDate(voucher.reversed_at)} viewLabel={tCommon('view')} />
              <VoucherDetailField label={t('reversalReason')} value={voucher.reversal_reason ?? '—'} copyValue={voucher.reversal_reason} viewLabel={tCommon('view')} />
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <VoucherDetailField label={t('description')} value={voucher.description ?? '—'} copyValue={voucher.description} viewLabel={tCommon('view')} />
              <VoucherDetailField label={t('notes')} value={voucher.notes ?? '—'} copyValue={voucher.notes} viewLabel={tCommon('view')} />
            </div>

            {voucher.voucher_status === VOUCHER_STATUS.POSTED && (
              <p className="rounded-md bg-blue-50 px-4 py-3 text-sm text-blue-700">
                {t('postingNote')}
              </p>
            )}
          </CmxCardContent>
        </CmxCard>

        {/* Lines card */}
        <CmxCard className="min-w-0">
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

        {/* Linked effects panel — shown once voucher is posted and wired */}
        {voucher.voucher_status === VOUCHER_STATUS.POSTED && linkedEffects && (
          <div className="min-w-0">
            <h2 className="mb-3 text-base font-semibold text-gray-800">
              {t('linkedEffects.title')}
            </h2>
            <VoucherLinkedEffectsPanel effects={linkedEffects} />
          </div>
        )}
      </div>

      <VoucherCancelDialog open={cancelOpen} onClose={() => setCancelOpen(false)} onConfirm={handleCancel} />
      <VoucherReversalDialog open={reversalOpen} onClose={() => setReversalOpen(false)} onConfirm={handleReverse} />
      <VoucherPostPreviewDialog
        open={postPreviewOpen}
        onClose={() => setPostPreviewOpen(false)}
        onSuccess={handlePostSuccess}
        voucherId={voucher.id}
        lines={voucher.lines}
      />
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
