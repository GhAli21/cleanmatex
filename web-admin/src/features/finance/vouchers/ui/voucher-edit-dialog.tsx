'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { CmxButton } from '@ui/primitives/cmx-button';
import { CmxSpinner } from '@ui/primitives/cmx-spinner';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
  CmxDialogFooter,
} from '@ui/overlays';
import { CmxConfirmDialog } from '@ui/feedback';
import { useMessage } from '@ui/feedback';
import { VoucherStatusBadge } from './voucher-status-badge';
import { VoucherDirectionBadge } from './voucher-direction-badge';
import { AddLineDialog } from './add-line-dialog';
import {
  getBizVoucherDetailAction,
  updateBizVoucherAction,
} from '@/app/actions/finance/voucher-actions';
import {
  addVoucherLineAction,
  deleteDraftVoucherLineAction,
} from '@/app/actions/finance/voucher-line-actions';
import { VOUCHER_STATUS } from '@/lib/constants/voucher';
import type {
  BizVoucherDetailData,
  CreateVoucherLineInput,
  VoucherLineData,
  UpdateBizVoucherInput,
  VoucherListItem,
} from '@/lib/types/voucher';

// ── Types ──────────────────────────────────────────────────────────────────────

interface VoucherEditDialogProps {
  open: boolean;
  voucher: VoucherListItem | null;
  onClose: () => void;
}

interface HeaderForm {
  voucher_date: string;
  party_name: string;
  description: string;
  notes: string;
}

const EMPTY_HEADER: HeaderForm = {
  voucher_date: '',
  party_name: '',
  description: '',
  notes: '',
};

// ── Component ──────────────────────────────────────────────────────────────────

export function VoucherEditDialog({ open, voucher, onClose }: VoucherEditDialogProps) {
  const t       = useTranslations('finance.vouchers');
  const tCommon = useTranslations('common');
  const locale  = useLocale();
  const isRtl   = locale === 'ar';
  const router  = useRouter();
  const { showSuccess, showError } = useMessage();

  // ── State ────────────────────────────────────────────────────────────────────

  const [loading,        setLoading]        = useState(false);
  const [fetchError,     setFetchError]     = useState<string | null>(null);
  const [detail,         setDetail]         = useState<BizVoucherDetailData | null>(null);
  const [lines,          setLines]          = useState<VoucherLineData[]>([]);
  const [form,           setForm]           = useState<HeaderForm>(EMPTY_HEADER);
  const [savingHeader,   setSavingHeader]   = useState(false);
  const [addLineOpen,    setAddLineOpen]    = useState(false);
  const [addingLine,     setAddingLine]     = useState(false);
  const [deletingLineId, setDeletingLineId] = useState<string | null>(null);
  const [hasChanges,     setHasChanges]     = useState(false);

  // ── i18n maps ────────────────────────────────────────────────────────────────

  const voucherTypeLabels: Record<string, string> = {
    RECEIPT_VOUCHER:    t('voucherTypeLabels.RECEIPT_VOUCHER'),
    PAYMENT_VOUCHER:    t('voucherTypeLabels.PAYMENT_VOUCHER'),
    REFUND_VOUCHER:     t('voucherTypeLabels.REFUND_VOUCHER'),
    ADJUSTMENT_VOUCHER: t('voucherTypeLabels.ADJUSTMENT_VOUCHER'),
    TRANSFER_VOUCHER:   t('voucherTypeLabels.TRANSFER_VOUCHER'),
  };

  function getRoleLabel(role: string): string {
    try { return t(`lineRoleLabels.${role}` as Parameters<typeof t>[0]); }
    catch { return role; }
  }

  // ── Fetch detail when dialog opens ────────────────────────────────────────────

  useEffect(() => {
    if (!open || !voucher) return;

    let cancelled = false;
    setLoading(true);
    setFetchError(null);
    setDetail(null);
    setLines([]);
    setHasChanges(false);

    getBizVoucherDetailAction(voucher.id).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.success || !result.data) {
        setFetchError(result.error ?? tCommon('error'));
        return;
      }
      const d = result.data;
      setDetail(d);
      setLines(d.lines ?? []);
      setForm({
        voucher_date: d.voucher_date ?? '',
        party_name:   d.party_name   ?? '',
        description:  d.description  ?? '',
        notes:        d.notes        ?? '',
      });
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, voucher?.id]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function handleDialogClose() {
    if (hasChanges) router.refresh();
    setDetail(null);
    setLines([]);
    setForm(EMPTY_HEADER);
    setFetchError(null);
    setAddLineOpen(false);
    onClose();
  }

  function setField(key: keyof HeaderForm) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
  }

  const isHeaderDirty =
    detail !== null &&
    (form.voucher_date !== (detail.voucher_date ?? '') ||
     form.party_name   !== (detail.party_name   ?? '') ||
     form.description  !== (detail.description  ?? '') ||
     form.notes        !== (detail.notes        ?? ''));

  async function handleSaveHeader() {
    if (!detail || !isHeaderDirty) return;
    setSavingHeader(true);
    try {
      const input: UpdateBizVoucherInput = {
        voucher_date: form.voucher_date || undefined,
        party_name:   form.party_name,
        description:  form.description,
        notes:        form.notes,
      };
      const result = await updateBizVoucherAction(detail.id, input);
      if (!result.success) {
        showError(result.error ?? tCommon('error'));
        return;
      }
      showSuccess(t('editSuccess'));
      setHasChanges(true);
      setDetail((prev) => prev ? {
        ...prev,
        voucher_date: form.voucher_date || null,
        party_name:   form.party_name   || null,
        description:  form.description  || null,
        notes:        form.notes        || null,
      } : prev);
    } finally {
      setSavingHeader(false);
    }
  }

  async function handleAddLine(input: CreateVoucherLineInput) {
    if (!detail) return;
    setAddingLine(true);
    try {
      const result = await addVoucherLineAction(detail.id, input);
      if (!result.success) {
        showError(result.error ?? tCommon('error'));
        return;
      }
      showSuccess(t('addLineSuccess'));
      setHasChanges(true);
      setAddLineOpen(false);
      const optimisticLine: VoucherLineData = {
        id:                    result.data?.id   ?? `temp-${Date.now()}`,
        tenant_org_id:         detail.tenant_org_id,
        voucher_id:            detail.id,
        line_no:               result.data?.line_no ?? lines.length + 1,
        line_type:             input.line_type,
        line_role:             input.line_role,
        target_type:           null,
        target_id:             null,
        order_id:              input.order_id              ?? null,
        customer_id:           input.customer_id           ?? null,
        payment_method_code:   input.payment_method_code   ?? null,
        amount:                input.amount,
        currency_code:         input.currency_code         ?? detail.currency_code,
        direction:             input.direction              ?? null,
        tendered_amount:       input.tendered_amount        ?? null,
        change_returned_amount: null,
        expense_category_code: input.expense_category_code ?? null,
        party_name:            input.party_name            ?? null,
        description:           input.description           ?? null,
        line_status:           'DRAFT',
        wiring_status:         'NOT_WIRED',
        reversed_line_id:      null,
        created_at:            new Date(),
      };
      setLines((prev) => [...prev, optimisticLine]);
      setDetail((prev) => prev
        ? { ...prev, total_amount: prev.total_amount + input.amount }
        : prev
      );
    } finally {
      setAddingLine(false);
    }
  }

  async function handleDeleteLine(lineId: string) {
    if (!detail) return;
    setDeletingLineId(lineId);
    try {
      const result = await deleteDraftVoucherLineAction(lineId, detail.id);
      if (!result.success) {
        showError(result.error ?? tCommon('error'));
        return;
      }
      showSuccess(t('lineDeleted'));
      setHasChanges(true);
      const removed = lines.find((l) => l.id === lineId);
      setLines((prev) => prev.filter((l) => l.id !== lineId));
      if (removed) {
        setDetail((prev) => prev
          ? { ...prev, total_amount: prev.total_amount - removed.amount }
          : prev
        );
      }
    } finally {
      setDeletingLineId(null);
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────────

  const isDraft    = detail?.voucher_status === VOUCHER_STATUS.DRAFT;
  const linesTotal = lines.reduce((sum, l) => sum + l.amount, 0);

  if (!voucher) return null;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      <CmxDialog open={open} onOpenChange={(o) => { if (!o) handleDialogClose(); }}>
        {/*
          overflow-hidden overrides the default overflow-y-auto so we can manage
          the scrollable region ourselves (sticky header + footer, scrollable body).
        */}
        <CmxDialogContent className="flex max-w-3xl flex-col overflow-hidden">

          {/* ── Dialog header ── */}
          <CmxDialogHeader className="shrink-0 pe-14">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <CmxDialogTitle>{t('actions.edit')}</CmxDialogTitle>
                {detail && (
                  <p className="mt-1 font-mono text-sm text-blue-700">{detail.voucher_no}</p>
                )}
              </div>
              {detail && (
                <div className="shrink-0 pt-0.5">
                  <VoucherStatusBadge status={detail.voucher_status} />
                </div>
              )}
            </div>
          </CmxDialogHeader>

          {/* ── Scrollable body ── */}
          <div className="min-h-0 flex-1 overflow-y-auto">

            {/* Loading */}
            {loading && (
              <div className="flex items-center justify-center py-20">
                <CmxSpinner size="lg" />
              </div>
            )}

            {/* Error */}
            {!loading && fetchError && (
              <div className="p-6">
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {fetchError}
                </div>
              </div>
            )}

            {/* Main content */}
            {!loading && detail && (
              <div className="space-y-5 p-6">

                {/* ── Summary strip ── */}
                <div className="grid grid-cols-2 gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm sm:grid-cols-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                      {t('voucherType')}
                    </p>
                    <p className="mt-0.5 font-medium text-gray-900">
                      {voucherTypeLabels[detail.voucher_type] ?? detail.voucher_type}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                      {t('direction')}
                    </p>
                    <p className="mt-0.5">
                      <VoucherDirectionBadge direction={detail.direction} />
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                      {t('totalAmount')}
                    </p>
                    <p className="mt-0.5 font-mono font-semibold text-gray-900">
                      {detail.total_amount.toLocaleString(isRtl ? 'ar' : 'en', {
                        minimumFractionDigits: 2,
                      })}
                      {detail.currency_code && (
                        <span className="ms-1 text-xs font-normal text-gray-400">
                          {detail.currency_code}
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                      {t('voucherNo')}
                    </p>
                    <p className="mt-0.5 font-mono text-blue-700">{detail.voucher_no}</p>
                  </div>
                </div>

                {/* ── Header edit / view ── */}
                <CmxCard>
                  <CmxCardHeader>
                    <CmxCardTitle className="text-sm">
                      {t('voucherSummary')}
                    </CmxCardTitle>
                  </CmxCardHeader>
                  <CmxCardContent className="space-y-4 pb-4">
                    {isDraft ? (
                      <>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div>
                            <label className="mb-1.5 block text-sm font-medium text-gray-700">
                              {t('voucherDate')}
                            </label>
                            <input
                              type="date"
                              value={form.voucher_date}
                              onChange={setField('voucher_date')}
                              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-sm font-medium text-gray-700">
                              {t('party')}
                            </label>
                            <input
                              type="text"
                              value={form.party_name}
                              onChange={setField('party_name')}
                              maxLength={250}
                              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-700">
                            {t('description')}
                          </label>
                          <input
                            type="text"
                            value={form.description}
                            onChange={setField('description')}
                            maxLength={500}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-700">
                            {t('notes')}
                          </label>
                          <textarea
                            value={form.notes}
                            onChange={setField('notes')}
                            rows={2}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div className="flex justify-end">
                          <CmxButton
                            variant="primary"
                            size="sm"
                            onClick={handleSaveHeader}
                            loading={savingHeader}
                            disabled={!isHeaderDirty || savingHeader}
                          >
                            {tCommon('save')}
                          </CmxButton>
                        </div>
                      </>
                    ) : (
                      /* Read-only view for non-DRAFT vouchers */
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {[
                          { label: t('voucherDate'), value: detail.voucher_date },
                          { label: t('party'),       value: detail.party_name   },
                          { label: t('description'), value: detail.description  },
                          { label: t('notes'),       value: detail.notes        },
                        ].map(({ label, value }) => (
                          <div key={label}>
                            <p className="text-xs font-medium text-gray-400">{label}</p>
                            <p className="mt-0.5 text-sm text-gray-900">{value ?? '—'}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CmxCardContent>
                </CmxCard>

                {/* ── Transaction lines ── */}
                <CmxCard>
                  <CmxCardHeader>
                    <div className="flex items-center justify-between gap-3">
                      <CmxCardTitle className="text-sm">
                        {t('totalLines', { count: lines.length })}
                      </CmxCardTitle>
                      {isDraft && (
                        <CmxButton
                          variant="outline"
                          size="sm"
                          onClick={() => setAddLineOpen(true)}
                        >
                          <Plus className="me-1.5 h-4 w-4" />
                          {t('actions.addLine')}
                        </CmxButton>
                      )}
                    </div>
                  </CmxCardHeader>

                  <CmxCardContent className="p-0">
                    {lines.length === 0 ? (
                      <div className="py-12 text-center text-sm text-gray-500">
                        {t('noLines')}
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wide text-gray-500">
                                #
                              </th>
                              <th className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wide text-gray-500">
                                {t('lineRole')}
                              </th>
                              <th className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wide text-gray-500">
                                {t('paymentMethod')}
                              </th>
                              <th className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wide text-gray-500">
                                {t('direction')}
                              </th>
                              <th className="px-4 py-3 text-end text-xs font-medium uppercase tracking-wide text-gray-500">
                                {t('amount')}
                              </th>
                              <th className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wide text-gray-500">
                                {t('description')}
                              </th>
                              {isDraft && <th className="w-12 px-4 py-3" />}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 bg-white">
                            {lines.map((line) => (
                              <tr key={line.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 tabular-nums text-gray-500">
                                  {line.line_no}
                                </td>
                                <td className="px-4 py-3 font-medium text-gray-900">
                                  {getRoleLabel(line.line_role)}
                                </td>
                                <td className="px-4 py-3 text-gray-600">
                                  {line.payment_method_code ?? '—'}
                                </td>
                                <td className="px-4 py-3">
                                  <VoucherDirectionBadge direction={line.direction} />
                                </td>
                                <td
                                  className={`px-4 py-3 text-end font-mono font-medium tabular-nums ${
                                    line.direction === 'OUT'
                                      ? 'text-red-600'
                                      : 'text-green-700'
                                  }`}
                                >
                                  {line.amount.toLocaleString(isRtl ? 'ar' : 'en', {
                                    minimumFractionDigits: 2,
                                  })}
                                </td>
                                <td className="max-w-[12rem] truncate px-4 py-3 text-gray-600">
                                  {line.description ?? '—'}
                                </td>
                                {isDraft && (
                                  <td className="px-4 py-3">
                                    <CmxConfirmDialog
                                      title={tCommon('delete')}
                                      description={t('deleteLineConfirm', { no: line.line_no })}
                                      confirmLabel={tCommon('delete')}
                                      cancelLabel={tCommon('cancel')}
                                      onConfirm={() => handleDeleteLine(line.id)}
                                      trigger={
                                        <CmxButton
                                          variant="ghost"
                                          size="sm"
                                          className="text-red-500 hover:bg-red-50 hover:text-red-700"
                                          loading={deletingLineId === line.id}
                                          disabled={deletingLineId !== null}
                                          title={tCommon('delete')}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </CmxButton>
                                      }
                                    />
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="border-t border-gray-200 bg-gray-50">
                            <tr>
                              <td colSpan={4} className="px-4 py-3" />
                              <td className="px-4 py-3 text-end font-mono font-semibold text-gray-900 tabular-nums">
                                {linesTotal.toLocaleString(isRtl ? 'ar' : 'en', {
                                  minimumFractionDigits: 2,
                                })}
                              </td>
                              <td colSpan={isDraft ? 2 : 1} className="px-4 py-3" />
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </CmxCardContent>
                </CmxCard>

              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <CmxDialogFooter className="shrink-0">
            <CmxButton variant="outline" onClick={handleDialogClose}>
              {tCommon('close')}
            </CmxButton>
          </CmxDialogFooter>

        </CmxDialogContent>
      </CmxDialog>

      {/* Add Line Dialog — sibling so it stacks above the edit dialog */}
      {detail && isDraft && (
        <AddLineDialog
          open={addLineOpen}
          onClose={() => setAddLineOpen(false)}
          onAdd={handleAddLine}
          isPending={addingLine}
        />
      )}
    </>
  );
}
