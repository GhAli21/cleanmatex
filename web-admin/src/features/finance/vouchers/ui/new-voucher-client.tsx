'use client';

import { useState, useTransition } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { CmxButton } from '@ui/primitives/cmx-button';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { VoucherStatusBadge } from '@features/finance/vouchers/ui/voucher-status-badge';
import { VoucherDirectionBadge } from '@features/finance/vouchers/ui/voucher-direction-badge';
import { VoucherLineTable } from '@features/finance/vouchers/ui/voucher-line-table';
import { AddLineDialog } from '@features/finance/vouchers/ui/add-line-dialog';
import { VoucherCancelDialog } from '@features/finance/vouchers/ui/voucher-cancel-dialog';
import { createBizVoucherAction, postBizVoucherAction, cancelBizVoucherAction } from '@/app/actions/finance/voucher-actions';
import { addVoucherLineAction, deleteDraftVoucherLineAction } from '@/app/actions/finance/voucher-line-actions';
import { VOUCHER_TYPE, VOUCHER_DIRECTION, PARTY_TYPE, VOUCHER_STATUS } from '@/lib/constants/voucher';
import { createBizVoucherSchema } from '@/lib/validators/voucher-validators';
import { useMessage } from '@ui/feedback/useMessage';
import type {
  CreateVoucherLineInput,
  VoucherDirection,
  VoucherLineData,
  VoucherType,
} from '@/lib/types/voucher';

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase = 'header' | 'lines';

interface VoucherDraft {
  id: string;
  voucher_no: string;
  voucher_type: VoucherType;
  direction: string;
  total_amount?: number;
  party_type?: string;
  party_name?: string;
  description?: string;
}

// ── Voucher type options ───────────────────────────────────────────────────────

const VOUCHER_TYPE_OPTIONS: { value: VoucherType; labelKey: string }[] = [
  { value: VOUCHER_TYPE.RECEIPT,    labelKey: 'RECEIPT_VOUCHER' },
  { value: VOUCHER_TYPE.PAYMENT,    labelKey: 'PAYMENT_VOUCHER' },
  { value: VOUCHER_TYPE.REFUND,     labelKey: 'REFUND_VOUCHER' },
  { value: VOUCHER_TYPE.ADJUSTMENT, labelKey: 'ADJUSTMENT_VOUCHER' },
  { value: VOUCHER_TYPE.TRANSFER,   labelKey: 'TRANSFER_VOUCHER' },
];

// ── Main component ────────────────────────────────────────────────────────────

/**
 * Two-step Business Voucher Module creation screen.
 *
 * Why:
 * The draft-first flow prevents partially specified vouchers from being posted
 * before at least one validated transaction line exists.
 *
 * @returns draft-first voucher creation experience
 */
export function NewVoucherClient() {
  const t = useTranslations('finance.vouchers');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const locale = useLocale();
  const isRtl = locale === 'ar';
  const { showSuccess, showError } = useMessage();

  // ── Phase & draft state ──
  const [phase, setPhase] = useState<Phase>('header');
  const [draft, setDraft] = useState<VoucherDraft | null>(null);
  const [lines, setLines] = useState<VoucherLineData[]>([]);

  // ── Header form state ──
  const [voucherType, setVoucherType] = useState<VoucherType>(VOUCHER_TYPE.RECEIPT);
  const [direction, setDirection] = useState<VoucherDirection>(VOUCHER_DIRECTION.IN);
  const [totalAmountStr, setTotalAmountStr] = useState('');
  const [partyType, setPartyType] = useState('');
  const [partyName, setPartyName] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [headerError,  setHeaderError]  = useState<string | null>(null);
  const [fieldErrors,  setFieldErrors]  = useState<Record<string, string | undefined>>({});

  // ── Dialog state ──
  const [addLineOpen, setAddLineOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  // ── Transitions ──
  const [isHeaderPending, startHeaderTransition] = useTransition();
  const [isLinePending, startLineTransition] = useTransition();
  const [isPostPending, startPostTransition] = useTransition();
  const [isCancelPending, startCancelTransition] = useTransition();

  const anyPending = isHeaderPending || isLinePending || isPostPending || isCancelPending;

  // ── Computed totals ──
  const total         = lines.reduce((sum, l) => sum + l.amount, 0);
  const declaredTotal = draft?.total_amount ?? 0;
  const isBalanced    = declaredTotal === 0 || Math.abs(total - declaredTotal) <= 0.005;

  // ── Header type change ──
  function handleTypeChange(type: VoucherType) {
    setVoucherType(type);
    if (type === VOUCHER_TYPE.RECEIPT)                                        setDirection(VOUCHER_DIRECTION.IN);
    else if (type === VOUCHER_TYPE.PAYMENT || type === VOUCHER_TYPE.REFUND)   setDirection(VOUCHER_DIRECTION.OUT);
    else                                                                       setDirection(VOUCHER_DIRECTION.NEUTRAL);
  }

  // ── Step 1: create header ──
  function handleHeaderSubmit(e: React.FormEvent) {
    e.preventDefault();
    setHeaderError(null);
    setFieldErrors({});

    const parsedTotal = parseFloat(totalAmountStr);
    const payload = {
      voucher_type:  voucherType,
      direction:     direction as never,
      party_type:    (partyType || undefined) as never,
      party_name:    partyName   || undefined,
      description:   description || undefined,
      notes:         notes       || undefined,
      voucher_date:  new Date().toISOString().split('T')[0],
      total_amount:  parsedTotal > 0 ? parsedTotal : undefined,
    };

    // Client-side validation — instant feedback, no server round-trip
    const parse = createBizVoucherSchema.safeParse(payload);
    if (!parse.success) {
      const flat = parse.error.flatten().fieldErrors;
      const mapped: Record<string, string> = {};
      for (const [key, msgs] of Object.entries(flat)) {
        if (msgs?.[0]) mapped[key] = msgs[0];
      }
      setFieldErrors(mapped);
      return;
    }

    startHeaderTransition(async () => {
      const result = await createBizVoucherAction(payload);

      if (result.success && result.data) {
        setDraft({
          id:           result.data.id,
          voucher_no:   result.data.voucher_no,
          voucher_type: voucherType,
          direction,
          total_amount: parsedTotal > 0 ? parsedTotal : undefined,
          party_type:   partyType || undefined,
          party_name:   partyName || undefined,
          description:  description || undefined,
        });
        setPhase('lines');
      } else {
        setHeaderError(result.error ?? tCommon('error'));
      }
    });
  }

  // ── Step 2: add a line ──
  async function handleAddLine(input: CreateVoucherLineInput) {
    if (!draft) return;

    return new Promise<void>((resolve) => {
      startLineTransition(async () => {
        const result = await addVoucherLineAction(draft.id, input);
        if (result.success && result.data) {
          // Optimistically append to lines list (line_no from server)
          const newLine: VoucherLineData = {
            id:                     result.data.id,
            tenant_org_id:          '',
            voucher_id:             draft.id,
            line_no:                result.data.line_no,
            line_type:              input.line_type,
            line_role:              input.line_role,
            target_type:            input.target_type ?? null,
            target_id:              input.target_id ?? null,
            order_id:               input.order_id ?? null,
            customer_id:            input.customer_id ?? null,
            payment_method_code:    input.payment_method_code ?? null,
            amount:                 input.amount,
            currency_code:          input.currency_code ?? null,
            direction:              input.direction ?? null,
            tendered_amount:        input.tendered_amount ?? null,
            change_returned_amount: null,
            expense_category_code:  input.expense_category_code ?? null,
            party_name:             input.party_name ?? null,
            description:            input.description ?? null,
            line_status:            'DRAFT',
            wiring_status:          'NOT_WIRED',
            reversed_line_id:       null,
            created_at:             new Date(),
            credit_application_type: input.credit_application_type ?? null,
            order_payment_id:        null,
            cash_drawer_mvt_id:      null,
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
          setLines((prev) => [...prev, newLine]);
          showSuccess(t('addLineSuccess'));
          setAddLineOpen(false);
        } else {
          showError(result.error ?? tCommon('error'));
        }
        resolve();
      });
    });
  }

  // ── Delete a draft line ──
  function handleDeleteLine(lineId: string) {
    if (!draft) return;
    startLineTransition(async () => {
      const result = await deleteDraftVoucherLineAction(lineId, draft.id);
      if (result.success) {
        setLines((prev) => prev.filter((l) => l.id !== lineId));
        showSuccess(t('lineDeleted'));
      } else {
        showError(result.error ?? tCommon('error'));
      }
    });
  }

  // ── Post voucher ──
  function handlePost() {
    if (!draft) return;
    if (lines.length === 0) {
      showError(t('validation.atLeastOneLine'));
      return;
    }
    startPostTransition(async () => {
      const result = await postBizVoucherAction(draft.id);
      if (result.success) {
        showSuccess(t('postSuccess'));
        router.push(`/dashboard/internal_fin/vouchers/${draft.id}`);
      } else {
        showError(result.error ?? tCommon('error'));
      }
    });
  }

  // ── Cancel voucher ──
  async function handleCancel(reason: string) {
    if (!draft) return;
    startCancelTransition(async () => {
      const result = await cancelBizVoucherAction(draft.id, reason);
      if (result.success) {
        showSuccess(t('cancelSuccess'));
        router.push('/dashboard/internal_fin/vouchers');
      } else {
        showError(result.error ?? tCommon('error'));
      }
    });
  }

  // ── Save as draft (just navigate to detail) ──
  function handleSaveAsDraft() {
    if (draft) {
      router.push(`/dashboard/internal_fin/vouchers/${draft.id}`);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // Render — Phase: header
  // ══════════════════════════════════════════════════════════════════════════════

  if (phase === 'header') {
    return (
      <form onSubmit={handleHeaderSubmit} className="max-w-2xl space-y-6">
        {headerError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {headerError}
          </div>
        )}

        <CmxCard>
          <CmxCardHeader>
            <CmxCardTitle>{t('newVoucher')}</CmxCardTitle>
          </CmxCardHeader>
          <CmxCardContent className="space-y-5">

            {/* Voucher Type */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
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
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
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

            {/* Declared Total */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                {t('declaredTotal')} <span className="text-xs text-gray-400">({tCommon('optional')})</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={totalAmountStr}
                onChange={(e) => { setTotalAmountStr(e.target.value); setFieldErrors((p) => ({ ...p, total_amount: undefined })); }}
                className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${fieldErrors.total_amount ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}`}
                placeholder="0.00"
              />
              {fieldErrors.total_amount
                ? <p className="mt-1 text-xs text-red-600">{fieldErrors.total_amount}</p>
                : <p className="mt-1 text-xs text-gray-400">{t('declaredTotalHint')}</p>
              }
            </div>

            {/* Party Type */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
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
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                {t('party')} <span className="text-xs text-gray-400">({tCommon('optional')})</span>
              </label>
              <input
                type="text"
                value={partyName}
                onChange={(e) => { setPartyName(e.target.value); setFieldErrors((p) => ({ ...p, party_name: undefined })); }}
                maxLength={250}
                className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${fieldErrors.party_name ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}`}
              />
              {fieldErrors.party_name && <p className="mt-1 text-xs text-red-600">{fieldErrors.party_name}</p>}
            </div>

            {/* Description */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
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
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                {t('notes')} <span className="text-xs text-gray-400">({tCommon('optional')})</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </CmxCardContent>
        </CmxCard>

        <p className="text-xs text-gray-400">{t('headerStep.hint')}</p>

        <div className="flex items-center justify-end gap-3 rtl:flex-row-reverse">
          <Link
            href="/dashboard/internal_fin/vouchers"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {tCommon('cancel')}
          </Link>
          <CmxButton type="submit" disabled={isHeaderPending}>
            {isHeaderPending ? tCommon('loading') : t('headerStep.next')}
          </CmxButton>
        </div>
      </form>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // Render — Phase: lines
  // ══════════════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-6">

      {/* ── Success banner ── */}
      <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 rtl:flex-row-reverse">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
        <span>{t('headerStep.created', { voucher_no: draft!.voucher_no })}</span>
      </div>

      {/* ── Header summary card ── */}
      <CmxCard>
        <CmxCardHeader className="flex flex-row items-center justify-between py-3">
          <CmxCardTitle className="text-base">{t('voucherSummary')}</CmxCardTitle>
          <VoucherStatusBadge status={VOUCHER_STATUS.DRAFT} />
        </CmxCardHeader>
        <CmxCardContent className="pb-4">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4 text-sm">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{t('voucherNo')}</dt>
              <dd className="mt-0.5 font-mono font-medium text-gray-900">{draft!.voucher_no}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{t('voucherType')}</dt>
              <dd className="mt-0.5 text-gray-900">{t(`voucherTypeLabels.${draft!.voucher_type}`)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{t('direction')}</dt>
              <dd className="mt-0.5"><VoucherDirectionBadge direction={draft!.direction as never} /></dd>
            </div>
            {draft!.party_name && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{t('party')}</dt>
                <dd className="mt-0.5 text-gray-900">{draft!.party_name}</dd>
              </div>
            )}
            {draft!.description && (
              <div className="col-span-2 sm:col-span-4">
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{t('description')}</dt>
                <dd className="mt-0.5 text-gray-700">{draft!.description}</dd>
              </div>
            )}
          </dl>
        </CmxCardContent>
      </CmxCard>

      {/* ── Lines card ── */}
      <CmxCard>
        <CmxCardHeader className="flex flex-row items-center justify-between rtl:flex-row-reverse">
          <CmxCardTitle>{t('transactionLines')}</CmxCardTitle>
          <CmxButton
            size="sm"
            onClick={() => setAddLineOpen(true)}
            disabled={anyPending}
            className="flex items-center gap-1.5 rtl:flex-row-reverse"
          >
            <Plus className="h-4 w-4" />
            {t('actions.addLine')}
          </CmxButton>
        </CmxCardHeader>
        <CmxCardContent className="p-0">
          <VoucherLineTable
            lines={lines}
            voucherStatus={VOUCHER_STATUS.DRAFT}
            onDeleteLine={handleDeleteLine}
          />
        </CmxCardContent>

        {/* Running total + balance status */}
        {lines.length > 0 && (
          <div className="border-t border-gray-100 px-6 py-3">
            <div className="flex items-center justify-between rtl:flex-row-reverse">
              <span className="text-sm text-gray-500">
                {t('totalLines', { count: lines.length })}
              </span>
              <span className="font-mono text-lg font-semibold text-gray-900">
                {total.toLocaleString(isRtl ? 'ar' : 'en', { minimumFractionDigits: 2 })}
              </span>
            </div>
            {declaredTotal > 0 && (
              <div className="mt-1.5 flex items-center justify-between rtl:flex-row-reverse">
                <span className="text-xs text-gray-400">{t('declaredTotal')}</span>
                <span className={`text-sm font-medium ${isBalanced ? 'text-green-700' : 'text-amber-700'}`}>
                  {declaredTotal.toLocaleString(isRtl ? 'ar' : 'en', { minimumFractionDigits: 2 })}
                  <span className="ms-2">
                    {isBalanced
                      ? `✓ ${t('balanceOk')}`
                      : `⚠ ${t('balanceOff', { diff: Math.abs(total - declaredTotal).toLocaleString(isRtl ? 'ar' : 'en', { minimumFractionDigits: 2 }) })}`}
                  </span>
                </span>
              </div>
            )}
          </div>
        )}
      </CmxCard>

      {/* ── Action bar ── */}
      <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between rtl:sm:flex-row-reverse">
        <div className="flex items-center gap-2 text-sm text-gray-500 rtl:flex-row-reverse">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          <button
            type="button"
            onClick={handleSaveAsDraft}
            disabled={anyPending}
            className="font-medium text-gray-700 hover:text-gray-900 disabled:opacity-50"
          >
            {t('actions.saveAsDraft')}
          </button>
        </div>

        <div className="flex items-center gap-3 rtl:flex-row-reverse">
          <CmxButton
            variant="outline"
            onClick={() => setCancelOpen(true)}
            disabled={anyPending}
          >
            {t('actions.cancelVoucher')}
          </CmxButton>
          <CmxButton
            onClick={handlePost}
            disabled={anyPending || lines.length === 0 || (declaredTotal > 0 && !isBalanced)}
          >
            {isPostPending ? tCommon('loading') : t('actions.post')}
          </CmxButton>
        </div>
      </div>

      {lines.length === 0 && (
        <p className="text-center text-xs text-amber-600">{t('validation.atLeastOneLine')}</p>
      )}
      {lines.length > 0 && declaredTotal > 0 && !isBalanced && (
        <p className="text-center text-xs text-amber-600">{t('validation.totalMismatch')}</p>
      )}

      {/* ── Dialogs ── */}
      <AddLineDialog
        open={addLineOpen}
        onClose={() => setAddLineOpen(false)}
        onAdd={handleAddLine}
        isPending={isLinePending}
      />

      <VoucherCancelDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={handleCancel}
      />
    </div>
  );
}
