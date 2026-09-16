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
import type { BizVoucherDetailData, CreateVoucherLineInput, VoucherRelatedRef } from '@/lib/types/voucher';
import type { LinkedEffectsResult } from '@/lib/types/voucher-wiring';
import { VoucherDetailCopyValue } from '@features/finance/vouchers/ui/voucher-detail-data-table';
import { VOUCHER_RELATED_HREFS } from '@/lib/constants/voucher-related-hrefs';

interface VoucherDetailClientProps {
  voucher: BizVoucherDetailData;
  userRole: string;
  linkedEffects?: LinkedEffectsResult | null;
  /** B02 order outstanding when this voucher is linked to an order. */
  orderOutstandingAmount?: number | null;
  /** B13 — operational unwind runs on Reverse when this flag is on. */
  unwindEnabled?: boolean;
}

function formatDate(value?: string | Date | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

const VOUCHER_UNWIND_ERROR_CODES = [
  'VOUCHER_UNWIND_PAYMENT_NOT_FOUND',
  'VOUCHER_UNWIND_DRAWER_SESSION_REQUIRED',
  'VOUCHER_UNWIND_UNSUPPORTED_PAYMENT_STATUS',
  'VOUCHER_UNWIND_CREDIT_APP_NOT_FOUND',
  'VOUCHER_UNWIND_WALLET_TXN_NOT_FOUND',
  'VOUCHER_UNWIND_WALLET_NOT_FOUND',
  'VOUCHER_UNWIND_WALLET_INSUFFICIENT',
  'VOUCHER_UNWIND_GIFT_CARD_TXN_NOT_FOUND',
  'VOUCHER_UNWIND_GIFT_CARD_NOT_FOUND',
  'VOUCHER_UNWIND_GIFT_CARD_ALREADY_USED',
  'VOUCHER_UNWIND_ADVANCE_TXN_NOT_FOUND',
  'VOUCHER_UNWIND_ADVANCE_NOT_FOUND',
  'VOUCHER_UNWIND_ADVANCE_INSUFFICIENT',
  'VOUCHER_UNWIND_CREDIT_NOTE_TXN_NOT_FOUND',
  'VOUCHER_UNWIND_CREDIT_NOTE_NOT_FOUND',
  'VOUCHER_UNWIND_CREDIT_NOTE_ALREADY_USED',
] as const;

function mapReverseError(
  raw: string | undefined,
  t: (key: `reverseErrors.${(typeof VOUCHER_UNWIND_ERROR_CODES)[number]}`) => string,
  fallback: string,
): string {
  if (!raw) return fallback;
  const code = VOUCHER_UNWIND_ERROR_CODES.find((c) => raw === c || raw.startsWith(`${c}:`));
  if (code) return t(`reverseErrors.${code}`);
  return raw;
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
      <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
        {copyValue !== undefined ? (
          <VoucherDetailCopyValue
            value={copyValue}
            displayValue={typeof value === 'string' ? value : undefined}
            maxLength={maxLength}
            className="font-medium"
          />
        ) : (
          <div className="text-sm font-medium text-foreground">{value}</div>
        )}
        {href ? (
          <Link
            href={href}
            className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-muted"
          >
            {linkLabel ?? viewLabel}
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/**
 * @param root0
 * @param root0.voucher
 * @param root0.userRole
 * @param root0.linkedEffects
 * @param root0.orderOutstandingAmount B02 order outstanding when the voucher is linked
 * @param root0.unwindEnabled B13 operational unwind flag
 */
export function VoucherDetailClient({
  voucher,
  userRole,
  linkedEffects,
  orderOutstandingAmount = null,
  unwindEnabled = false,
}: VoucherDetailClientProps) {
  const t = useTranslations('finance.vouchers');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { showSuccess, showError } = useMessage();
  const [isPending] = useTransition();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reversalOpen, setReversalOpen] = useState(false);
  const [addLineOpen, setAddLineOpen] = useState(false);
  const [postPreviewOpen, setPostPreviewOpen] = useState(false);

  const related = voucher.related;
  const sourceRefLink =
    voucher.source_module === 'ORDERS' && voucher.source_ref_id
      ? VOUCHER_RELATED_HREFS.order(voucher.source_ref_id)
      : voucher.source_module === 'INVOICES' && voucher.source_ref_id
        ? VOUCHER_RELATED_HREFS.invoice(voucher.source_ref_id)
        : related?.order?.href ?? null;

  const relatedLinks: Array<{ key: string; ref: VoucherRelatedRef; label: string }> = [
    related?.originalVoucher ? { key: 'originalVoucher', ref: related.originalVoucher, label: t('relatedOriginalVoucher') } : null,
    related?.reversalVoucher ? { key: 'reversalVoucher', ref: related.reversalVoucher, label: t('relatedReversalVoucher') } : null,
    related?.order ? { key: 'order', ref: related.order, label: t('relatedOrder') } : null,
    related?.customer ? { key: 'customer', ref: related.customer, label: t('relatedCustomer') } : null,
    related?.invoice ? { key: 'invoice', ref: related.invoice, label: t('relatedInvoice') } : null,
    related?.branch ? { key: 'branch', ref: related.branch, label: t('relatedBranch') } : null,
    related?.cashDrawerSession ? { key: 'session', ref: related.cashDrawerSession, label: t('relatedCashDrawerSession') } : null,
  ].filter((item): item is { key: string; ref: VoucherRelatedRef; label: string } => item !== null);

  const sessionHrefById: Record<string, string> = {};
  if (related?.cashDrawerSession) {
    sessionHrefById[related.cashDrawerSession.id] = related.cashDrawerSession.href;
  }
  for (const movement of linkedEffects?.cashDrawerMovements ?? []) {
    if (movement.session_id && movement.cash_drawer_id) {
      sessionHrefById[movement.session_id] = VOUCHER_RELATED_HREFS.cashDrawerSession(
        movement.cash_drawer_id,
        movement.session_id,
      );
    }
  }

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
      showError(mapReverseError(result.error, t, tCommon('error')));
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
              <VoucherDetailField label={t('id')} value={voucher.id} copyValue={voucher.id} maxLength={12} viewLabel={tCommon('view')} />
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
              <VoucherDetailField
                label={t('createdBy')}
                value={related?.createdByName ?? voucher.created_by ?? '—'}
                copyValue={voucher.created_by}
                viewLabel={tCommon('view')}
              />
              <VoucherDetailField label={t('createdAt')} value={formatDate(voucher.created_at)} copyValue={formatDate(voucher.created_at)} viewLabel={tCommon('view')} />
              <VoucherDetailField
                label={t('updatedBy')}
                value={voucher.updated_by ?? '—'}
                copyValue={voucher.updated_by}
                viewLabel={tCommon('view')}
              />
              <VoucherDetailField label={t('updatedAt')} value={formatDate(voucher.updated_at)} copyValue={formatDate(voucher.updated_at)} viewLabel={tCommon('view')} />
            </div>

            {relatedLinks.length > 0 && (
              <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('relatedRecords')}</p>
                <div className="flex flex-wrap gap-2">
                  {relatedLinks.map((item) => (
                    <Link
                      key={item.key}
                      href={item.ref.href}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-muted"
                    >
                      <span className="text-muted-foreground">{item.label}:</span>
                      {item.ref.label}
                      <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

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
                        <p className="mt-0.5 text-[11px] leading-snug text-gray-500">{t('outstandingAmountHint')}</p>
                      </div>
                    )}
                    {orderOutstandingAmount != null && (
                      <div>
                        <dt className="text-xs font-medium text-gray-500">{t('orderOutstandingAmount')}</dt>
                        <dd className={`mt-0.5 font-mono font-semibold ${orderOutstandingAmount > 0 ? 'text-amber-700' : 'text-gray-700'}`}>
                          {orderOutstandingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
              <VoucherDetailField label={t('party')} value={voucher.party_name ?? related?.customer?.label ?? '—'} copyValue={voucher.party_name ?? related?.customer?.label} viewLabel={tCommon('view')} />
              <VoucherDetailField
                label={t('orderId')}
                value={related?.order?.label ?? voucher.order_id ?? '—'}
                copyValue={related?.order?.id ?? voucher.order_id}
                href={related?.order?.href}
                linkLabel={t('relatedOrder')}
                viewLabel={tCommon('view')}
              />
              <VoucherDetailField
                label={t('invoiceId')}
                value={related?.invoice?.label ?? voucher.invoice_id ?? '—'}
                copyValue={related?.invoice?.id ?? voucher.invoice_id}
                href={related?.invoice?.href}
                linkLabel={t('relatedInvoice')}
                viewLabel={tCommon('view')}
              />
              <VoucherDetailField
                label={t('customerId')}
                value={related?.customer?.label ?? voucher.customer_id ?? '—'}
                copyValue={related?.customer?.id ?? voucher.customer_id}
                href={related?.customer?.href}
                linkLabel={t('relatedCustomer')}
                viewLabel={tCommon('view')}
              />
              <VoucherDetailField
                label={t('branchId')}
                value={related?.branch?.label ?? voucher.branch_id ?? '—'}
                copyValue={related?.branch?.id ?? voucher.branch_id}
                href={related?.branch?.href}
                linkLabel={t('relatedBranch')}
                viewLabel={tCommon('view')}
              />
              <VoucherDetailField label={t('supplierId')} value={voucher.supplier_id ?? '—'} copyValue={voucher.supplier_id} viewLabel={tCommon('view')} />
              <VoucherDetailField label={t('employeeId')} value={voucher.employee_id ?? '—'} copyValue={voucher.employee_id} viewLabel={tCommon('view')} />
              <VoucherDetailField
                label={t('relatedOriginalVoucher')}
                value={related?.originalVoucher?.label ?? voucher.ref_voucher_id ?? '—'}
                copyValue={related?.originalVoucher?.id ?? voucher.ref_voucher_id}
                href={related?.originalVoucher?.href ?? (voucher.ref_voucher_id ? VOUCHER_RELATED_HREFS.voucher(voucher.ref_voucher_id) : undefined)}
                linkLabel={t('viewVoucher')}
                viewLabel={tCommon('view')}
              />
              <VoucherDetailField
                label={t('relatedReversalVoucher')}
                value={related?.reversalVoucher?.label ?? '—'}
                copyValue={related?.reversalVoucher?.id ?? voucher.reversed_by_voucher_id}
                href={related?.reversalVoucher?.href}
                linkLabel={t('viewVoucher')}
                viewLabel={tCommon('view')}
              />
              <VoucherDetailField
                label={t('relatedCashDrawerSession')}
                value={related?.cashDrawerSession?.label ?? '—'}
                copyValue={related?.cashDrawerSession?.id}
                href={related?.cashDrawerSession?.href}
                linkLabel={t('viewSession')}
                viewLabel={tCommon('view')}
              />
              <VoucherDetailField label={t('sourceModule')} value={voucher.source_module ?? '—'} copyValue={voucher.source_module} viewLabel={tCommon('view')} />
              <VoucherDetailField label={t('sourceRefType')} value={voucher.source_ref_type ?? '—'} copyValue={voucher.source_ref_type} viewLabel={tCommon('view')} />
              <VoucherDetailField
                label={t('sourceRefId')}
                value={voucher.source_ref_id ?? related?.order?.id ?? '—'}
                copyValue={voucher.source_ref_id ?? related?.order?.id}
                href={sourceRefLink}
                linkLabel={t('openSource')}
                viewLabel={tCommon('view')}
              />
              <VoucherDetailField
                label={t('postedBy')}
                value={related?.postedByName ?? voucher.posted_by ?? '—'}
                copyValue={voucher.posted_by}
                viewLabel={tCommon('view')}
              />
              <VoucherDetailField label={t('postedAt')} value={formatDate(voucher.posted_at)} copyValue={formatDate(voucher.posted_at)} viewLabel={tCommon('view')} />
              <VoucherDetailField
                label={t('reversedBy')}
                value={related?.reversedByName ?? voucher.reversed_by ?? '—'}
                copyValue={voucher.reversed_by}
                viewLabel={tCommon('view')}
              />
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
              originalVoucherHref={related?.originalVoucher?.href}
              sessionHrefById={sessionHrefById}
              viewLabel={tCommon('view')}
            />
          </CmxCardContent>
        </CmxCard>

        {/* Linked effects panel — shown once voucher is posted and wired */}
        {(voucher.voucher_status === VOUCHER_STATUS.POSTED
          || voucher.voucher_status === VOUCHER_STATUS.REVERSED
          || voucher.voucher_status === VOUCHER_STATUS.PARTIALLY_REVERSED) && linkedEffects && (
          <div className="min-w-0">
            <h2 className="mb-3 text-base font-semibold text-gray-800">
              {t('linkedEffects.title')}
            </h2>
            <VoucherLinkedEffectsPanel effects={linkedEffects} />
          </div>
        )}
      </div>

      <VoucherCancelDialog open={cancelOpen} onClose={() => setCancelOpen(false)} onConfirm={handleCancel} />
      <VoucherReversalDialog
        open={reversalOpen}
        onClose={() => setReversalOpen(false)}
        onConfirm={handleReverse}
        linkedEffects={linkedEffects}
        unwindEnabled={unwindEnabled}
      />
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
