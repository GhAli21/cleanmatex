'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { CmxButton, CmxMoneyField } from '@ui/primitives';
import { CmxAuditInfoCard } from '@ui/data-display';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { parseMoneyDraft } from '@/lib/money/money-draft';
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
import { updateBizVoucherSchema } from '@/lib/validators/voucher-validators';
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
  total_amount: string;
  description: string;
  notes: string;
}

const EMPTY_HEADER: HeaderForm = {
  voucher_date: '',
  party_name: '',
  total_amount: '',
  description: '',
  notes: '',
};

// ── Component ──────────────────────────────────────────────────────────────────

/**
 *
 * @param root0
 * @param root0.open
 * @param root0.voucher
 * @param root0.onClose
 */
export function VoucherEditDialog({ open, voucher, onClose }: VoucherEditDialogProps) {
  const t       = useTranslations('finance.vouchers');
  const tCommon = useTranslations('common');
  const locale  = useLocale();
  const { decimalPlaces } = useTenantCurrency();
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
  const [fieldErrors,    setFieldErrors]    = useState<Record<string, string | undefined>>({});
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
        total_amount: d.total_amount > 0 ? String(d.total_amount) : '',
        description:  d.description  ?? '',
        notes:        d.notes        ?? '',
      });
    });

    return () => { cancelled = true; };
   
  }, [open, voucher?.id]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function handleDialogClose() {
    if (hasChanges) router.refresh();
    setDetail(null);
    setLines([]);
    setForm(EMPTY_HEADER);
    setFetchError(null);
    setFieldErrors({});
    setAddLineOpen(false);
    onClose();
  }

  function setField(key: keyof HeaderForm) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
  }

  const formTotalAmount   = parseMoneyDraft(form.total_amount);
  const isHeaderDirty =
    detail !== null &&
    (form.voucher_date !== (detail.voucher_date ?? '')  ||
     form.party_name   !== (detail.party_name   ?? '')  ||
     formTotalAmount   !== detail.total_amount           ||
     form.description  !== (detail.description  ?? '')  ||
     form.notes        !== (detail.notes        ?? ''));

  async function handleSaveHeader() {
    if (!detail || !isHeaderDirty) return;

    // Client-side validation — instant feedback before server round-trip
    const payload = {
      voucher_date: form.voucher_date || undefined,
      party_name:   form.party_name   || undefined,
      total_amount: formTotalAmount > 0 ? formTotalAmount : 0,
      description:  form.description  || undefined,
      notes:        form.notes        || undefined,
    };
    const parse = updateBizVoucherSchema.safeParse(payload);
    if (!parse.success) {
      const flat = parse.error.flatten().fieldErrors;
      const mapped: Record<string, string> = {};
      for (const [key, msgs] of Object.entries(flat)) {
        if (msgs?.[0]) mapped[key] = msgs[0];
      }
      setFieldErrors(mapped);
      return;
    }
    setFieldErrors({});

    setSavingHeader(true);
    try {
      const input: UpdateBizVoucherInput = {
        voucher_date: form.voucher_date || undefined,
        party_name:   form.party_name,
        total_amount: formTotalAmount > 0 ? formTotalAmount : 0,
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
        total_amount: formTotalAmount > 0 ? formTotalAmount : 0,
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
        payment_status:        null,
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
        pos_session_id:        input.pos_session_id ?? null,
        created_at:            new Date(),
        credit_application_type: input.credit_application_type ?? null,
        order_payment_id:        null,
        org_payment_method_id:   input.org_payment_method_id ?? null,
        payment_terminal_id:     input.payment_terminal_id ?? null,
        cash_drawer_session_id:  input.cash_drawer_session_id ?? null,
        card_brand_code:         input.card_brand_code ?? null,
        card_last4:              input.card_last4 ?? null,
        gateway_code:            input.gateway_code ?? null,
        gateway_reference:       input.gateway_reference ?? null,
        bank_reference:          input.bank_reference ?? null,
        check_number:            input.check_number ?? null,
        branch_id:               input.branch_id ?? null,
      };
      setLines((prev) => [...prev, optimisticLine]);
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
      setLines((prev) => prev.filter((l) => l.id !== lineId));
    } finally {
      setDeletingLineId(null);
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────────

  const isDraft      = detail?.voucher_status === VOUCHER_STATUS.DRAFT;
  const linesTotal   = lines.reduce((sum, l) => sum + l.amount, 0);
  const declaredAmt  = detail?.total_amount ?? 0;
  const isBalanced   = declaredAmt === 0 || Math.abs(linesTotal - declaredAmt) <= 0.005;

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
                  <p className="mt-1 font-mono text-sm text-primary-text">{detail.voucher_no}</p>
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
                <div className="rounded-lg border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-text">
                  {fetchError}
                </div>
              </div>
            )}

            {/* Main content */}
            {!loading && detail && (
              <div className="space-y-5 p-6">

                {/* ── Summary strip ── */}
                <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted p-4 text-sm sm:grid-cols-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t('voucherType')}
                    </p>
                    <p className="mt-0.5 font-medium text-foreground">
                      {voucherTypeLabels[detail.voucher_type] ?? detail.voucher_type}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t('direction')}
                    </p>
                    <p className="mt-0.5">
                      <VoucherDirectionBadge direction={detail.direction} />
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t('totalAmount')}
                    </p>
                    <p className="mt-0.5 font-mono font-semibold text-foreground">
                      {detail.total_amount > 0
                        ? detail.total_amount.toLocaleString(isRtl ? 'ar' : 'en', { minimumFractionDigits: 2 })
                        : '—'}
                      {detail.total_amount > 0 && detail.currency_code && (
                        <span className="ms-1 text-xs font-normal text-muted-foreground">
                          {detail.currency_code}
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t('voucherNo')}
                    </p>
                    <p className="mt-0.5 font-mono text-primary-text">{detail.voucher_no}</p>
                  </div>
                </div>

                <CmxAuditInfoCard
                  title={t('audit')}
                  createdAt={detail.created_at}
                  createdBy={detail.created_by}
                  updatedAt={detail.updated_at}
                  updatedBy={detail.updated_by}
                  extras={[
                    {
                      key: 'postedAt',
                      label: t('postedAt'),
                      value: detail.posted_at,
                      hideWhenEmpty: true,
                    },
                    {
                      key: 'postedBy',
                      label: t('postedBy'),
                      value: detail.posted_by,
                      hideWhenEmpty: true,
                    },
                    {
                      key: 'reversedAt',
                      label: t('reversedAt'),
                      value: detail.reversed_at,
                      hideWhenEmpty: true,
                    },
                    {
                      key: 'reversalReason',
                      label: t('reversalReason'),
                      value: detail.reversal_reason,
                      hideWhenEmpty: true,
                    },
                  ]}
                />

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
                            <label className="mb-1.5 block text-sm font-medium text-foreground">
                              {t('voucherDate')}
                            </label>
                            <input
                              type="date"
                              value={form.voucher_date}
                              onChange={setField('voucher_date')}
                              className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-sm font-medium text-foreground">
                              {t('party')}
                            </label>
                            <input
                              type="text"
                              value={form.party_name}
                              onChange={(e) => { setField('party_name')(e); setFieldErrors((p) => ({ ...p, party_name: undefined })); }}
                              maxLength={250}
                              className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${fieldErrors.party_name ? 'border-destructive focus:border-destructive focus:ring-destructive' : 'border-border focus:border-ring focus:ring-ring'}`}
                            />
                            {fieldErrors.party_name && <p className="mt-1 text-xs text-danger-text">{fieldErrors.party_name}</p>}
                          </div>
                          <div>
                            <label className="mb-1.5 block text-sm font-medium text-foreground">
                              {t('declaredTotal')}
                            </label>
                            <CmxMoneyField
                              value={parseMoneyDraft(form.total_amount) || null}
                              draftValue={form.total_amount}
                              decimalPlaces={decimalPlaces}
                              min={0}
                              onValueChange={(_, d) => { setForm((prev) => ({ ...prev, total_amount: d })); setFieldErrors((p) => ({ ...p, total_amount: undefined })); }}
                              placeholder="0.00"
                            />
                            {fieldErrors.total_amount && <p className="mt-1 text-xs text-danger-text">{fieldErrors.total_amount}</p>}
                          </div>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-foreground">
                            {t('description')}
                          </label>
                          <input
                            type="text"
                            value={form.description}
                            onChange={setField('description')}
                            maxLength={500}
                            className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-foreground">
                            {t('notes')}
                          </label>
                          <textarea
                            value={form.notes}
                            onChange={setField('notes')}
                            rows={2}
                            className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
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
                          { label: t('voucherDate'),  value: detail.voucher_date },
                          { label: t('party'),        value: detail.party_name   },
                          { label: t('declaredTotal'), value: detail.total_amount > 0
                              ? detail.total_amount.toLocaleString(isRtl ? 'ar' : 'en', { minimumFractionDigits: 2 })
                              : null },
                          { label: t('description'),  value: detail.description  },
                          { label: t('notes'),        value: detail.notes        },
                        ].map(({ label, value }) => (
                          <div key={label}>
                            <p className="text-xs font-medium text-muted-foreground">{label}</p>
                            <p className="mt-0.5 text-sm text-foreground">{value ?? '—'}</p>
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
                      <div className="py-12 text-center text-sm text-muted-foreground">
                        {t('noLines')}
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-border text-sm">
                          <thead className="bg-muted">
                            <tr>
                              <th className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                #
                              </th>
                              <th className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                {t('lineRole')}
                              </th>
                              <th className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                {t('paymentMethod')}
                              </th>
                              <th className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                {t('direction')}
                              </th>
                              <th className="px-4 py-3 text-end text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                {t('amount')}
                              </th>
                              <th className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                {t('description')}
                              </th>
                              {isDraft && <th className="w-12 px-4 py-3" />}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border bg-card">
                            {lines.map((line) => (
                              <tr key={line.id} className="hover:bg-muted">
                                <td className="px-4 py-3 tabular-nums text-muted-foreground">
                                  {line.line_no}
                                </td>
                                <td className="px-4 py-3 font-medium text-foreground">
                                  {getRoleLabel(line.line_role)}
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">
                                  {line.payment_method_code ?? '—'}
                                </td>
                                <td className="px-4 py-3">
                                  <VoucherDirectionBadge direction={line.direction} />
                                </td>
                                <td
                                  className={`px-4 py-3 text-end font-mono font-medium tabular-nums ${
                                    line.direction === 'OUT'
                                      ? 'text-danger-text'
                                      : 'text-success-text'
                                  }`}
                                >
                                  {line.amount.toLocaleString(isRtl ? 'ar' : 'en', {
                                    minimumFractionDigits: 2,
                                  })}
                                </td>
                                <td className="max-w-[12rem] truncate px-4 py-3 text-muted-foreground">
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
                                          className="text-danger-text hover:bg-danger-bg hover:text-danger-text/80"
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
                          <tfoot className="border-t border-border bg-muted">
                            <tr>
                              <td colSpan={4} className="px-4 py-3" />
                              <td className="px-4 py-3 text-end tabular-nums">
                                <div className="font-mono font-semibold text-foreground">
                                  {linesTotal.toLocaleString(isRtl ? 'ar' : 'en', { minimumFractionDigits: 2 })}
                                </div>
                                {declaredAmt > 0 && (
                                  <div className={`mt-0.5 text-xs font-medium ${isBalanced ? 'text-success-text' : 'text-warning-text'}`}>
                                    {isBalanced
                                      ? `✓ ${t('balanceOk')}`
                                      : `⚠ ${t('balanceOff', { diff: Math.abs(linesTotal - declaredAmt).toLocaleString(isRtl ? 'ar' : 'en', { minimumFractionDigits: 2 }) })}`}
                                  </div>
                                )}
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
