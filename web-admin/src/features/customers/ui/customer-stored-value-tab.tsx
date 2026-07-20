'use client';
/* eslint-disable react-hooks/set-state-in-effect */

/**
 * Customer Stored Value Tab
 *
 * Shows wallet balance, advance balance, and credit notes for a single customer.
 * Provides dialogs for top-up, advance issuance, and credit note issuance.
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { PlusCircle } from 'lucide-react';
import { CmxButton, CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle, CmxMoneyField } from '@ui/primitives';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { parseMoneyDraft } from '@/lib/money/money-draft';
import { Badge } from '@ui/primitives/badge';
import { CmxDataTable } from '@ui/data-display';
import { cmxMessage } from '@ui/feedback';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
  CmxDialogFooter,
} from '@ui/overlays';
import {
  getCustomerStoredValueDetail,
  topUpWallet,
  issueAdvance,
  issueCreditNoteAction,
  topUpWalletWithTenderAction,
  issueAdvanceWithTenderAction,
} from '@/app/actions/customers/stored-value-actions';
import { useFeature } from '@features/auth/ui/RequireFeature';
import { useAuth } from '@/lib/auth/auth-context';
import { StoredValueTenderFields, type StoredValueTenderResult } from './stored-value-tender-fields';

interface CreditNoteRow {
  id:                string;
  credit_note_no:    string;
  original_amount:   number;
  remaining_balance: number;
  currency_code:     string;
  status:            string;
  expires_at:        Date | null;
  reason:            string;
}

interface StoredValueDetail {
  wallet:      { walletId: string | null; balance: number; currencyCode: string | null };
  advance:     { advanceId: string | null; balance: number; currencyCode: string | null };
  creditNotes: CreditNoteRow[];
}

interface Props {
  customerId: string;
  tenantId:   string;
}

// ── Dialogs ───────────────────────────────────────────────────────────────────

type DialogType = 'topUp' | 'advance' | 'creditNote' | null;

/**
 *
 * @param root0
 * @param root0.customerId
 */
export function CustomerStoredValueTab({ customerId }: Props) {
  const t       = useTranslations('customers.storedValue');
  const tCommon = useTranslations('common');
  const { decimalPlaces, currencyCode: tenantCurrency } = useTenantCurrency();
  // B3 — governed DIRECT_TENDER top-up/advance (tender step) once enabled;
  // falls back to the existing no-tender topUpWallet/issueAdvance actions
  // while the flag is off.
  const fundingCaptureEnabled = useFeature('order_fin_sv_funding_capture');
  const { currentTenant, user } = useAuth();
  const tenantOrgId = currentTenant?.tenant_id ?? '';
  const userId = user?.id;

  const [detail, setDetail]       = useState<StoredValueDetail | null>(null);
  const [isLoading, setLoading]   = useState(true);
  const [dialog, setDialog]       = useState<DialogType>(null);
  const [isSaving, setSaving]     = useState(false);

  // Form fields
  const [amount, setAmount]       = useState('');
  const [notes, setNotes]         = useState('');
  const [reason, setReason]       = useState('');
  const [currency, setCurrency]   = useState('OMR');
  const [tender, setTender]       = useState<StoredValueTenderResult | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => crypto.randomUUID());

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getCustomerStoredValueDetail(customerId);
    if (result.success) {
      setDetail(result.data);
    } else {
      const errorMsg = (result as { success: false; error: string }).error;
      cmxMessage.error(errorMsg);
    }
    setLoading(false);
  }, [customerId]);

  useEffect(() => { void load(); }, [load]);

  function openDialog(type: DialogType) {
    setAmount('');
    setNotes('');
    setReason('');
    setCurrency('OMR');
    setTender(null);
    setIdempotencyKey(crypto.randomUUID());
    setDialog(type);
  }

  async function handleSubmit() {
    const numAmount = parseMoneyDraft(amount);
    if (numAmount <= 0) {
      cmxMessage.error('Amount must be greater than zero');
      return;
    }

    if (fundingCaptureEnabled && (dialog === 'topUp' || dialog === 'advance')) {
      if (!tender) {
        cmxMessage.error(t('funding.tenderRequired'));
        return;
      }
      setSaving(true);
      const payload = {
        customerId,
        amount: numAmount,
        currencyCode: tenantCurrency || 'OMR',
        paymentMethodId: tender.paymentMethodId,
        cashTendered: tender.cashTendered,
        cashDrawerSessionId: tender.cashDrawerSessionId,
        idempotencyKey,
      };
      const tenderResult = dialog === 'topUp'
        ? await topUpWalletWithTenderAction(payload)
        : await issueAdvanceWithTenderAction(payload);

      if (tenderResult.success === false) {
        cmxMessage.error(tenderResult.error);
        setSaving(false);
        return;
      }
      cmxMessage.success(dialog === 'topUp' ? t('topUpSuccess') : t('issueAdvanceSuccess'));
      setSaving(false);
      setDialog(null);
      void load();
      return;
    }

    setSaving(true);
    let result: { success: boolean; error?: string } = { success: false };

    if (dialog === 'topUp') {
      result = await topUpWallet(customerId, numAmount, notes || undefined);
      if (result.success) cmxMessage.success(t('topUpSuccess'));
    } else if (dialog === 'advance') {
      result = await issueAdvance(customerId, numAmount, notes || undefined);
      if (result.success) cmxMessage.success(t('issueAdvanceSuccess'));
    } else if (dialog === 'creditNote') {
      if (!reason.trim()) { cmxMessage.error(t('reasonRequired')); setSaving(false); return; }
      result = await issueCreditNoteAction(customerId, numAmount, reason, currency);
      if (result.success) cmxMessage.success(t('issueCreditNoteSuccess'));
    }

    if (!result.success && result.error) {
      cmxMessage.error(result.error);
    }

    setSaving(false);
    if (result.success) {
      setDialog(null);
      void load();
    }
  }

  const statusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (status === 'ACTIVE')    return 'default';
    if (status === 'EXHAUSTED') return 'secondary';
    if (status === 'EXPIRED')   return 'destructive';
    return 'outline';
  };

  if (isLoading) {
    return <div className="animate-pulse h-64 rounded-lg bg-muted" />;
  }

  const wallet  = detail?.wallet;
  const advance = detail?.advance;
  const cns     = detail?.creditNotes ?? [];

  return (
    <div className="flex flex-col gap-6">

      {/* Wallet & Advance cards */}
      <div className="grid gap-4 sm:grid-cols-2">

        {/* Wallet */}
        <CmxCard>
          <CmxCardHeader className="flex flex-row items-center justify-between pb-2">
            <CmxCardTitle className="text-base">{t('wallet')}</CmxCardTitle>
            <CmxButton variant="outline" size="sm" onClick={() => openDialog('topUp')}>
              <PlusCircle className="me-1.5 h-4 w-4" />
              {t('topUp')}
            </CmxButton>
          </CmxCardHeader>
          <CmxCardContent>
            {wallet && (wallet.walletId || wallet.balance > 0) ? (
              <p className="text-2xl font-semibold tabular-nums">
                {wallet.currencyCode ?? ''} {wallet.balance.toFixed(3)}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">{t('noWallet')}</p>
            )}
          </CmxCardContent>
        </CmxCard>

        {/* Advance */}
        <CmxCard>
          <CmxCardHeader className="flex flex-row items-center justify-between pb-2">
            <CmxCardTitle className="text-base">{t('advance')}</CmxCardTitle>
            <CmxButton variant="outline" size="sm" onClick={() => openDialog('advance')}>
              <PlusCircle className="me-1.5 h-4 w-4" />
              {t('issueAdvance')}
            </CmxButton>
          </CmxCardHeader>
          <CmxCardContent>
            {advance && (advance.advanceId || advance.balance > 0) ? (
              <p className="text-2xl font-semibold tabular-nums">
                {advance.currencyCode ?? ''} {advance.balance.toFixed(3)}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">{t('noAdvance')}</p>
            )}
          </CmxCardContent>
        </CmxCard>
      </div>

      {/* Credit Notes */}
      <CmxCard>
        <CmxCardHeader className="flex flex-row items-center justify-between pb-2">
          <CmxCardTitle className="text-base">{t('creditNotes')}</CmxCardTitle>
          <CmxButton variant="outline" size="sm" onClick={() => openDialog('creditNote')}>
            <PlusCircle className="me-1.5 h-4 w-4" />
            {t('issueCreditNote')}
          </CmxButton>
        </CmxCardHeader>
        <CmxCardContent className="p-0">
          <CmxDataTable
            isLoading={false}
            columns={[
              {
                key: 'credit_note_no',
                header: t('creditNoteNo'),
                render: (row: CreditNoteRow) => (
                  <span className="font-mono text-xs font-medium">{row.credit_note_no}</span>
                ),
              },
              {
                key: 'original_amount',
                header: t('originalAmount'),
                render: (row: CreditNoteRow) => (
                  <span className="tabular-nums">
                    {row.currency_code} {row.original_amount.toFixed(3)}
                  </span>
                ),
              },
              {
                key: 'remaining_balance',
                header: t('remainingBalance'),
                render: (row: CreditNoteRow) => (
                  <span className="tabular-nums font-semibold">
                    {row.currency_code} {row.remaining_balance.toFixed(3)}
                  </span>
                ),
              },
              {
                key: 'status',
                header: tCommon('status'),
                render: (row: CreditNoteRow) => (
                  <Badge variant={statusVariant(row.status)}>
                    {t(`creditNoteStatus.${row.status as 'ACTIVE' | 'EXHAUSTED' | 'EXPIRED' | 'CANCELLED'}`) as string}
                  </Badge>
                ),
              },
              {
                key: 'expires_at',
                header: t('expiresAt'),
                render: (row: CreditNoteRow) =>
                  row.expires_at
                    ? new Date(row.expires_at).toLocaleDateString()
                    : t('noExpiry'),
              },
            ]}
            data={cns}
            totalCount={cns.length}
            currentPage={1}
            pageSize={cns.length || 1}
            onPageChange={() => undefined}
          />
          {cns.length === 0 && !isLoading && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">{t('noCreditNotes')}</p>
          )}
        </CmxCardContent>
      </CmxCard>

      {/* Top-Up / Advance / Credit Note dialog */}
      <CmxDialog open={dialog !== null} onOpenChange={(open) => { if (!open) setDialog(null); }}>
        <CmxDialogContent>
          <CmxDialogHeader>
            <CmxDialogTitle>
              {dialog === 'topUp'      && t('topUp')}
              {dialog === 'advance'    && t('issueAdvance')}
              {dialog === 'creditNote' && t('issueCreditNote')}
            </CmxDialogTitle>
          </CmxDialogHeader>

          <div className="flex flex-col gap-4 py-2">
            {/* Amount */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">{t('amount')}</label>
              <CmxMoneyField
                value={parseMoneyDraft(amount) || null}
                draftValue={amount}
                decimalPlaces={decimalPlaces}
                min={0.001}
                showZero={false}
                onValueChange={(_, d) => setAmount(d)}
                placeholder="0.000"
              />
            </div>

            {/* B3 — tender step, governed DIRECT_TENDER funding only */}
            {fundingCaptureEnabled && (dialog === 'topUp' || dialog === 'advance') && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                <p className="mb-2 text-sm font-medium">{t('funding.tenderSectionTitle')}</p>
                <StoredValueTenderFields
                  amount={parseMoneyDraft(amount) || 0}
                  currencyCode={tenantCurrency || 'OMR'}
                  tenantOrgId={tenantOrgId}
                  userId={userId}
                  onTenderChange={setTender}
                />
              </div>
            )}

            {/* Currency — only for credit note */}
            {dialog === 'creditNote' && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">{t('currency')}</label>
                <input
                  type="text"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="OMR"
                  maxLength={3}
                />
              </div>
            )}

            {/* Reason — required for credit note */}
            {dialog === 'creditNote' && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">{t('reason')} *</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  rows={3}
                  placeholder={t('reason')}
                />
              </div>
            )}

            {/* Notes — optional for top-up / advance (no-tender path only; the
                tendered path has no notes field on fundStoredValue) */}
            {dialog !== 'creditNote' && !(fundingCaptureEnabled && (dialog === 'topUp' || dialog === 'advance')) && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">{t('notesOptional')}</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  rows={3}
                />
              </div>
            )}
          </div>

          <CmxDialogFooter>
            <CmxButton variant="outline" onClick={() => setDialog(null)} disabled={isSaving}>
              {tCommon('cancel')}
            </CmxButton>
            <CmxButton
              variant="primary"
              onClick={handleSubmit}
              disabled={
                isSaving ||
                (fundingCaptureEnabled && (dialog === 'topUp' || dialog === 'advance') && !tender)
              }
            >
              {isSaving ? tCommon('saving') : tCommon('save')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>
    </div>
  );
}
