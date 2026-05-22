'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  CmxDialog,
  CmxDialogClose,
  CmxDialogContent,
  CmxDialogDescription,
  CmxDialogFooter,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays';
import { CmxSummaryMessage, useMessage } from '@ui/feedback';
import { CmxButton, CmxCheckbox, CmxInput, CmxSelect, CmxTextarea } from '@ui/primitives';
import { useCSRFToken, getCSRFHeader } from '@/lib/hooks/use-csrf-token';
import {
  AR_SENSITIVE_APPROVAL_ACTIONS,
  type ArInvoiceDetail,
} from '@/lib/types/ar-invoice';
import { useHasPermission } from '@/lib/hooks/usePermissions';

type DialogMode =
  | null
  | 'edit'
  | 'issue'
  | 'approve'
  | 'allocate'
  | 'reverse'
  | 'credit'
  | 'debit'
  | 'writeoff'
  | 'void';

interface ArInvoiceDetailActionsProps {
  detail: ArInvoiceDetail;
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function buildIdempotencyKey(action: string, invoiceId: string) {
  return `${action}:${invoiceId}:${Date.now()}`;
}

export function ArInvoiceDetailActions({ detail }: ArInvoiceDetailActionsProps) {
  const t = useTranslations('invoices.ar.detailActions');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { token } = useCSRFToken();
  const { showSuccess, showErrorFrom } = useMessage();
  const invoice = detail.invoice;
  const activeAllocations = useMemo(
    () => detail.allocations.filter((allocation) => !allocation.reversed_at),
    [detail.allocations]
  );

  const canUpdate = useHasPermission('invoices', 'update');
  const canIssue = useHasPermission('invoices', 'issue');
  const canApprove = useHasPermission('invoices', 'approve_sensitive');
  const canAllocate = useHasPermission('invoices', 'allocate_payment');
  const canCredit = useHasPermission('invoices', 'credit_note');
  const canDebit = useHasPermission('invoices', 'debit_note');
  const canWriteOff = useHasPermission('invoices', 'write_off');
  const canVoid = useHasPermission('invoices', 'void');
  const canPrint = useHasPermission('invoices', 'print');

  const [dialog, setDialog] = useState<DialogMode>(null);
  const [submitting, setSubmitting] = useState<DialogMode | null>(null);

  const [editDueDate, setEditDueDate] = useState(invoice.due_date ?? '');
  const [editPaymentTerms, setEditPaymentTerms] = useState(invoice.payment_terms ?? '');
  const [editPaymentMethod, setEditPaymentMethod] = useState(invoice.payment_method_code ?? '');
  const [editNotes, setEditNotes] = useState('');

  const [issueDate, setIssueDate] = useState(todayDate());
  const [issueNotes, setIssueNotes] = useState('');

  const [approvalAction, setApprovalAction] = useState(
    invoice.approval_action_cd ?? AR_SENSITIVE_APPROVAL_ACTIONS.APPROVE_CREDIT_MEMO
  );
  const [approvalNotes, setApprovalNotes] = useState('');

  const [allocatedAmount, setAllocatedAmount] = useState(invoice.outstanding_amount.toFixed(4));
  const [paymentId, setPaymentId] = useState('');
  const [voucherId, setVoucherId] = useState('');
  const [allocationDate, setAllocationDate] = useState(todayDate());
  const [allocationNotes, setAllocationNotes] = useState('');

  const [reverseAllocationId, setReverseAllocationId] = useState(activeAllocations[0]?.id ?? '');
  const [reverseDate, setReverseDate] = useState(todayDate());
  const [reverseReason, setReverseReason] = useState('');

  const [creditAmount, setCreditAmount] = useState(invoice.outstanding_amount.toFixed(4));
  const [creditReason, setCreditReason] = useState('');
  const [creditNeedsApproval, setCreditNeedsApproval] = useState(true);

  const [debitAmount, setDebitAmount] = useState('0.0000');
  const [debitReason, setDebitReason] = useState('');
  const [debitNeedsApproval, setDebitNeedsApproval] = useState(true);

  const [writeOffAmount, setWriteOffAmount] = useState(invoice.outstanding_amount.toFixed(4));
  const [writeOffReason, setWriteOffReason] = useState('');
  const [writeOffNeedsApproval, setWriteOffNeedsApproval] = useState(true);

  const [voidReason, setVoidReason] = useState('');

  const isDraft = invoice.status === 'DRAFT';
  const isVoided = invoice.status === 'VOID' || invoice.status === 'CANCELLED';
  const isSettled = invoice.status === 'PAID' || invoice.status === 'WRITTEN_OFF' || invoice.status === 'REFUNDED';
  const requiresApproval = invoice.approval_required && !invoice.approved_at;

  const submitJson = async (mode: DialogMode, path: string, body: Record<string, unknown>, method = 'POST') => {
    try {
      setSubmitting(mode);
      const response = await fetch(path, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...getCSRFHeader(token),
        },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; success?: boolean };
      if (!response.ok || payload.success === false) {
        throw new Error(payload.error ?? t('errors.actionFailed'));
      }

      showSuccess(t(`success.${mode}`));
      setDialog(null);
      router.refresh();
    } catch (error) {
      showErrorFrom(error);
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="space-y-4">
      {requiresApproval ? (
        <CmxSummaryMessage
          type="warning"
          title={t('approval.title')}
          items={[t('approval.body')]}
        />
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 rtl:flex-row-reverse">
          {canUpdate ? (
            <CmxButton
              variant="outline"
              size="sm"
              onClick={() => setDialog('edit')}
            >
              {t('buttons.edit')}
            </CmxButton>
          ) : null}
          {canIssue ? (
            <CmxButton
              size="sm"
              onClick={() => setDialog('issue')}
              disabled={!isDraft || requiresApproval}
            >
              {t('buttons.issue')}
            </CmxButton>
          ) : null}
          {canApprove ? (
            <CmxButton
              variant="outline"
              size="sm"
              onClick={() => setDialog('approve')}
              disabled={!requiresApproval}
            >
              {t('buttons.approve')}
            </CmxButton>
          ) : null}
          {canAllocate ? (
            <CmxButton
              variant="outline"
              size="sm"
              onClick={() => setDialog('allocate')}
              disabled={isDraft || isVoided || invoice.outstanding_amount <= 0}
            >
              {t('buttons.allocate')}
            </CmxButton>
          ) : null}
          {canAllocate ? (
            <CmxButton
              variant="ghost"
              size="sm"
              onClick={() => setDialog('reverse')}
              disabled={activeAllocations.length === 0}
            >
              {t('buttons.reverseAllocation')}
            </CmxButton>
          ) : null}
          {canCredit ? (
            <CmxButton
              variant="outline"
              size="sm"
              onClick={() => setDialog('credit')}
              disabled={isVoided}
            >
              {t('buttons.credit')}
            </CmxButton>
          ) : null}
          {canDebit ? (
            <CmxButton
              variant="outline"
              size="sm"
              onClick={() => setDialog('debit')}
              disabled={isVoided}
            >
              {t('buttons.debit')}
            </CmxButton>
          ) : null}
          {canWriteOff ? (
            <CmxButton
              variant="outline"
              size="sm"
              onClick={() => setDialog('writeoff')}
              disabled={isVoided || isSettled || invoice.outstanding_amount <= 0}
            >
              {t('buttons.writeOff')}
            </CmxButton>
          ) : null}
          {canVoid ? (
            <CmxButton
              variant="destructive"
              size="sm"
              onClick={() => setDialog('void')}
              disabled={isVoided}
            >
              {t('buttons.void')}
            </CmxButton>
          ) : null}
          {canPrint ? (
            <CmxButton asChild variant="ghost" size="sm">
              <Link href={`/dashboard/internal_fin/invoices/${invoice.id}/print`}>{tCommon('print')}</Link>
            </CmxButton>
          ) : null}
        </div>
      </div>

      <CmxDialog open={dialog === 'edit'} onOpenChange={(open) => !open && setDialog(null)}>
        <CmxDialogContent className="max-w-2xl">
          <CmxDialogHeader>
            <CmxDialogTitle>{t('edit.title')}</CmxDialogTitle>
            <CmxDialogDescription>{t('edit.description')}</CmxDialogDescription>
          </CmxDialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <CmxInput label={t('fields.dueDate')} type="date" value={editDueDate} onChange={(event) => setEditDueDate(event.target.value)} />
            <CmxInput label={t('fields.paymentTerms')} value={editPaymentTerms} onChange={(event) => setEditPaymentTerms(event.target.value)} />
            <CmxInput label={t('fields.paymentMethod')} value={editPaymentMethod} onChange={(event) => setEditPaymentMethod(event.target.value)} />
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-900">{t('fields.notes')}</label>
              <CmxTextarea value={editNotes} onChange={(event) => setEditNotes(event.target.value)} />
            </div>
          </div>
          <CmxDialogFooter>
            <CmxDialogClose asChild>
              <CmxButton variant="outline">{tCommon('cancel')}</CmxButton>
            </CmxDialogClose>
            <CmxButton
              loading={submitting === 'edit'}
              onClick={() =>
                submitJson(
                  'edit',
                  `/api/v1/ar/invoices/${invoice.id}`,
                  {
                    due_date: editDueDate || undefined,
                    payment_terms: editPaymentTerms || undefined,
                    payment_method_code: editPaymentMethod || undefined,
                    rec_notes: editNotes || undefined,
                  },
                  'PATCH'
                )
              }
            >
              {tCommon('save')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>

      <CmxDialog open={dialog === 'issue'} onOpenChange={(open) => !open && setDialog(null)}>
        <CmxDialogContent className="max-w-xl">
          <CmxDialogHeader>
            <CmxDialogTitle>{t('issue.title')}</CmxDialogTitle>
            <CmxDialogDescription>{t('issue.description')}</CmxDialogDescription>
          </CmxDialogHeader>
          <div className="grid gap-4">
            <CmxInput label={t('fields.issueDate')} type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} />
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">{t('fields.notes')}</label>
              <CmxTextarea value={issueNotes} onChange={(event) => setIssueNotes(event.target.value)} />
            </div>
          </div>
          <CmxDialogFooter>
            <CmxDialogClose asChild>
              <CmxButton variant="outline">{tCommon('cancel')}</CmxButton>
            </CmxDialogClose>
            <CmxButton
              loading={submitting === 'issue'}
              onClick={() =>
                submitJson('issue', `/api/v1/ar/invoices/${invoice.id}/issue`, {
                  issue_date: issueDate,
                  notes: issueNotes || undefined,
                  idempotency_key: buildIdempotencyKey('issue', invoice.id),
                })
              }
            >
              {t('buttons.issue')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>

      <CmxDialog open={dialog === 'approve'} onOpenChange={(open) => !open && setDialog(null)}>
        <CmxDialogContent className="max-w-xl">
          <CmxDialogHeader>
            <CmxDialogTitle>{t('approve.title')}</CmxDialogTitle>
            <CmxDialogDescription>{t('approve.description')}</CmxDialogDescription>
          </CmxDialogHeader>
          <div className="grid gap-4">
            <CmxSelect
              label={t('fields.approvalAction')}
              value={approvalAction}
              onChange={(event) => setApprovalAction(event.target.value as typeof approvalAction)}
              options={Object.values(AR_SENSITIVE_APPROVAL_ACTIONS).map((action) => ({
                value: action,
                label: t(`approvalActions.${action}`),
              }))}
            />
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">{t('fields.approvalNotes')}</label>
              <CmxTextarea value={approvalNotes} onChange={(event) => setApprovalNotes(event.target.value)} />
            </div>
          </div>
          <CmxDialogFooter>
            <CmxDialogClose asChild>
              <CmxButton variant="outline">{tCommon('cancel')}</CmxButton>
            </CmxDialogClose>
            <CmxButton
              loading={submitting === 'approve'}
              onClick={() =>
                submitJson('approve', `/api/v1/ar/invoices/${invoice.id}/approve-sensitive`, {
                  approval_action_cd: approvalAction,
                  approval_notes: approvalNotes || undefined,
                  idempotency_key: buildIdempotencyKey('approve', invoice.id),
                })
              }
            >
              {t('buttons.approve')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>

      <CmxDialog open={dialog === 'allocate'} onOpenChange={(open) => !open && setDialog(null)}>
        <CmxDialogContent className="max-w-2xl">
          <CmxDialogHeader>
            <CmxDialogTitle>{t('allocate.title')}</CmxDialogTitle>
            <CmxDialogDescription>{t('allocate.description')}</CmxDialogDescription>
          </CmxDialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <CmxInput label={t('fields.allocatedAmount')} type="number" min="0.0001" step="0.0001" value={allocatedAmount} onChange={(event) => setAllocatedAmount(event.target.value)} />
            <CmxInput label={t('fields.allocationDate')} type="date" value={allocationDate} onChange={(event) => setAllocationDate(event.target.value)} />
            <CmxInput label={t('fields.paymentId')} value={paymentId} onChange={(event) => setPaymentId(event.target.value)} />
            <CmxInput label={t('fields.voucherId')} value={voucherId} onChange={(event) => setVoucherId(event.target.value)} />
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-900">{t('fields.notes')}</label>
              <CmxTextarea value={allocationNotes} onChange={(event) => setAllocationNotes(event.target.value)} />
            </div>
          </div>
          <CmxDialogFooter>
            <CmxDialogClose asChild>
              <CmxButton variant="outline">{tCommon('cancel')}</CmxButton>
            </CmxDialogClose>
            <CmxButton
              loading={submitting === 'allocate'}
              disabled={!paymentId.trim() && !voucherId.trim()}
              onClick={() =>
                submitJson('allocate', `/api/v1/ar/invoices/${invoice.id}/allocations`, {
                  payment_id: paymentId.trim() || undefined,
                  voucher_id: voucherId.trim() || undefined,
                  allocated_amount: Number(allocatedAmount || 0),
                  applied_at: allocationDate,
                  notes: allocationNotes || undefined,
                  idempotency_key: buildIdempotencyKey('allocate', invoice.id),
                })
              }
            >
              {t('buttons.allocate')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>

      <CmxDialog open={dialog === 'reverse'} onOpenChange={(open) => !open && setDialog(null)}>
        <CmxDialogContent className="max-w-xl">
          <CmxDialogHeader>
            <CmxDialogTitle>{t('reverse.title')}</CmxDialogTitle>
            <CmxDialogDescription>{t('reverse.description')}</CmxDialogDescription>
          </CmxDialogHeader>
          <div className="grid gap-4">
            <CmxSelect
              label={t('fields.allocation')}
              value={reverseAllocationId}
              onChange={(event) => setReverseAllocationId(event.target.value)}
              options={activeAllocations.map((allocation) => ({
                value: allocation.id,
                label: `#${allocation.allocation_no} • ${allocation.allocated_amount.toFixed(4)}`,
              }))}
            />
            <CmxInput label={t('fields.reverseDate')} type="date" value={reverseDate} onChange={(event) => setReverseDate(event.target.value)} />
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">{t('fields.reason')}</label>
              <CmxTextarea value={reverseReason} onChange={(event) => setReverseReason(event.target.value)} />
            </div>
          </div>
          <CmxDialogFooter>
            <CmxDialogClose asChild>
              <CmxButton variant="outline">{tCommon('cancel')}</CmxButton>
            </CmxDialogClose>
            <CmxButton
              variant="destructive"
              loading={submitting === 'reverse'}
              disabled={!reverseAllocationId || !reverseReason.trim()}
              onClick={() =>
                submitJson(
                  'reverse',
                  `/api/v1/ar/invoices/${invoice.id}/allocations/${reverseAllocationId}/reverse`,
                  {
                    reason: reverseReason,
                    reversed_at: reverseDate,
                    idempotency_key: buildIdempotencyKey('reverse', invoice.id),
                  }
                )
              }
            >
              {t('buttons.reverseAllocation')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>

      <CmxDialog open={dialog === 'credit'} onOpenChange={(open) => !open && setDialog(null)}>
        <CmxDialogContent className="max-w-xl">
          <CmxDialogHeader>
            <CmxDialogTitle>{t('credit.title')}</CmxDialogTitle>
            <CmxDialogDescription>{t('credit.description')}</CmxDialogDescription>
          </CmxDialogHeader>
          <div className="grid gap-4">
            <CmxInput label={t('fields.adjustmentAmount')} type="number" min="0.0001" step="0.0001" value={creditAmount} onChange={(event) => setCreditAmount(event.target.value)} />
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">{t('fields.reason')}</label>
              <CmxTextarea value={creditReason} onChange={(event) => setCreditReason(event.target.value)} />
            </div>
            <CmxCheckbox label={t('fields.requiresApproval')} checked={creditNeedsApproval} onChange={(event) => setCreditNeedsApproval(event.target.checked)} />
          </div>
          <CmxDialogFooter>
            <CmxDialogClose asChild>
              <CmxButton variant="outline">{tCommon('cancel')}</CmxButton>
            </CmxDialogClose>
            <CmxButton
              loading={submitting === 'credit'}
              disabled={!creditReason.trim()}
              onClick={() =>
                submitJson('credit', `/api/v1/ar/invoices/${invoice.id}/credit-note`, {
                  adjustment_amount: Number(creditAmount || 0),
                  reason: creditReason,
                  approval_required: creditNeedsApproval,
                  idempotency_key: buildIdempotencyKey('credit', invoice.id),
                })
              }
            >
              {t('buttons.credit')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>

      <CmxDialog open={dialog === 'debit'} onOpenChange={(open) => !open && setDialog(null)}>
        <CmxDialogContent className="max-w-xl">
          <CmxDialogHeader>
            <CmxDialogTitle>{t('debit.title')}</CmxDialogTitle>
            <CmxDialogDescription>{t('debit.description')}</CmxDialogDescription>
          </CmxDialogHeader>
          <div className="grid gap-4">
            <CmxInput label={t('fields.adjustmentAmount')} type="number" min="0.0001" step="0.0001" value={debitAmount} onChange={(event) => setDebitAmount(event.target.value)} />
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">{t('fields.reason')}</label>
              <CmxTextarea value={debitReason} onChange={(event) => setDebitReason(event.target.value)} />
            </div>
            <CmxCheckbox label={t('fields.requiresApproval')} checked={debitNeedsApproval} onChange={(event) => setDebitNeedsApproval(event.target.checked)} />
          </div>
          <CmxDialogFooter>
            <CmxDialogClose asChild>
              <CmxButton variant="outline">{tCommon('cancel')}</CmxButton>
            </CmxDialogClose>
            <CmxButton
              loading={submitting === 'debit'}
              disabled={!debitReason.trim()}
              onClick={() =>
                submitJson('debit', `/api/v1/ar/invoices/${invoice.id}/debit-note`, {
                  adjustment_amount: Number(debitAmount || 0),
                  reason: debitReason,
                  approval_required: debitNeedsApproval,
                  idempotency_key: buildIdempotencyKey('debit', invoice.id),
                })
              }
            >
              {t('buttons.debit')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>

      <CmxDialog open={dialog === 'writeoff'} onOpenChange={(open) => !open && setDialog(null)}>
        <CmxDialogContent className="max-w-xl">
          <CmxDialogHeader>
            <CmxDialogTitle>{t('writeoff.title')}</CmxDialogTitle>
            <CmxDialogDescription>{t('writeoff.description')}</CmxDialogDescription>
          </CmxDialogHeader>
          <div className="grid gap-4">
            <CmxInput label={t('fields.adjustmentAmount')} type="number" min="0.0001" step="0.0001" value={writeOffAmount} onChange={(event) => setWriteOffAmount(event.target.value)} />
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">{t('fields.reason')}</label>
              <CmxTextarea value={writeOffReason} onChange={(event) => setWriteOffReason(event.target.value)} />
            </div>
            <CmxCheckbox label={t('fields.requiresApproval')} checked={writeOffNeedsApproval} onChange={(event) => setWriteOffNeedsApproval(event.target.checked)} />
          </div>
          <CmxDialogFooter>
            <CmxDialogClose asChild>
              <CmxButton variant="outline">{tCommon('cancel')}</CmxButton>
            </CmxDialogClose>
            <CmxButton
              loading={submitting === 'writeoff'}
              disabled={!writeOffReason.trim()}
              onClick={() =>
                submitJson('writeoff', `/api/v1/ar/invoices/${invoice.id}/write-off`, {
                  adjustment_amount: Number(writeOffAmount || 0),
                  reason: writeOffReason,
                  adjustment_type_cd: 'WRITE_OFF',
                  approval_required: writeOffNeedsApproval,
                  idempotency_key: buildIdempotencyKey('writeoff', invoice.id),
                })
              }
            >
              {t('buttons.writeOff')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>

      <CmxDialog open={dialog === 'void'} onOpenChange={(open) => !open && setDialog(null)}>
        <CmxDialogContent className="max-w-xl">
          <CmxDialogHeader>
            <CmxDialogTitle>{t('void.title')}</CmxDialogTitle>
            <CmxDialogDescription>{t('void.description')}</CmxDialogDescription>
          </CmxDialogHeader>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-900">{t('fields.reason')}</label>
            <CmxTextarea value={voidReason} onChange={(event) => setVoidReason(event.target.value)} />
          </div>
          <CmxDialogFooter>
            <CmxDialogClose asChild>
              <CmxButton variant="outline">{tCommon('cancel')}</CmxButton>
            </CmxDialogClose>
            <CmxButton
              variant="destructive"
              loading={submitting === 'void'}
              disabled={!voidReason.trim()}
              onClick={() =>
                submitJson('void', `/api/v1/ar/invoices/${invoice.id}/void`, {
                  reason: voidReason,
                  idempotency_key: buildIdempotencyKey('void', invoice.id),
                })
              }
            >
              {t('buttons.void')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>
    </div>
  );
}
