'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/auth-context';
import { useRTL } from '@/lib/hooks/useRTL';
import { useHasPermissionCode } from '@/lib/hooks/usePermissions';
import { useCSRFToken, getCSRFHeader } from '@/lib/hooks/use-csrf-token';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { PAYMENT_METHODS } from '@/lib/constants/payment';
import { CmxButton } from '@ui/primitives';
import { CmxInput, Label } from '@ui/primitives';
import { LoadingButton } from '@ui/primitives';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { cmxMessage } from '@ui/feedback';
import { useOverpaymentAllocation } from '@features/orders/hooks/use-overpayment-allocation';
import { AutoAllocationPreviewDrawer } from '@features/orders/ui/payment-modal/allocation/auto-allocation-preview-drawer';
import { ManualAllocationDrawer } from '@features/orders/ui/payment-modal/allocation/manual-allocation-drawer';
import {
  StoredValueTenderFields,
  type StoredValueTenderResult,
} from './stored-value-tender-fields';

interface SelectedCustomer {
  id: string;
  name: string;
  phone?: string;
}

const CustomerPickerModal = dynamic(
  () =>
    import('@features/orders/ui/customer-picker-modal').then((mod) => ({
      default: mod.CustomerPickerModal,
    })),
  { ssr: false }
);

/** Account receipts settle an existing balance now — never "pay on collection". */
const RECEIPT_EXCLUDED_METHOD_CODES = [PAYMENT_METHODS.PAY_ON_COLLECTION] as const;

/**
 * Customer account receipt screen (CLF W6). The tender step reuses
 * StoredValueTenderFields, so a drawer-tracked cash method shows the same
 * cash-drawer session picker as the order payment modals, and bank transfer /
 * cheque receipts collect the references the voucher line requires.
 */
export function CustomerAccountReceiptClient() {
  const t = useTranslations('customers.accountReceipt');
  const tLedger = useTranslations('cashControl.ledgerErrors');
  const isRTL = useRTL();
  const { currentTenant, user } = useAuth();
  const { formatMoneyWithCode, currencyCode: tenantCurrency } = useTenantCurrency();
  const { token: csrfToken } = useCSRFToken();
  const canPost = useHasPermissionCode('customers:receipt_allocate');

  const [customer, setCustomer] = useState<SelectedCustomer | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [receiptAmount, setReceiptAmount] = useState(0);
  const [tender, setTender] = useState<StoredValueTenderResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Remounts the tender step after a successful post so references clear.
  const [tenderKey, setTenderKey] = useState(0);

  // No currency fallback: a receipt must never be booked in a guessed currency.
  const currencyCode = tenantCurrency ?? '';

  const formatAmount = useCallback(
    // formatMoneyWithCode takes only the amount; the 2nd currencyCode arg was a
    // no-op at runtime and a tsc error. Strip the code to get a bare number.
    (value: number) => formatMoneyWithCode(value).replace(currencyCode, '').trim(),
    [currencyCode, formatMoneyWithCode]
  );

  const allocation = useOverpaymentAllocation({
    customerId: customer?.id,
    currencyCode,
    excessAmount: receiptAmount,
    receiptAmount,
    currentOrderAllocationAmount: 0,
    sourceType: 'CUSTOMER_RECEIPT',
    paymentMethodCode: tender?.paymentMethodCode ?? PAYMENT_METHODS.CASH,
    confirmedToastMessage: t('allocationConfirmed'),
  });

  // The allocation preview is priced for one payment method, so it must be made
  // after the tender is complete and is discarded when the method changes.
  const { resetAllocationState } = allocation;
  const lastMethodCodeRef = useRef<string | undefined>(undefined);
  const handleTenderChange = useCallback(
    (next: StoredValueTenderResult | null) => {
      const code = next?.paymentMethodCode;
      if (code && lastMethodCodeRef.current && code !== lastMethodCodeRef.current) {
        resetAllocationState();
      }
      if (code) lastMethodCodeRef.current = code;
      setTender(next);
    },
    [resetAllocationState]
  );

  const canSubmit = useMemo(
    () =>
      !!customer?.id &&
      !!currencyCode &&
      receiptAmount > 0 &&
      !!tender &&
      !!allocation.allocationPreviewId,
    [allocation.allocationPreviewId, currencyCode, customer?.id, receiptAmount, tender]
  );

  /** Maps a stable server error code to translated text; falls back to the generic error. */
  const resolveErrorMessage = (code: string | undefined): string => {
    if (code && t.has(`errors.${code}`)) return t(`errors.${code}`);
    if (code && tLedger.has(code)) return tLedger(code);
    return t('postError');
  };

  const handlePost = async () => {
    if (!customer?.id || !allocation.allocationPreviewId) {
      cmxMessage.error(t('allocationRequired'));
      return;
    }
    if (!tender) {
      cmxMessage.error(t('tenderRequired'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/customer-receipts/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getCSRFHeader(csrfToken) },
        body: JSON.stringify({
          customerId: customer.id,
          previewId: allocation.allocationPreviewId,
          paymentMethodId: tender.paymentMethodId,
          receiptAmount,
          currencyCode,
          cashTendered: tender.cashTendered,
          cashDrawerSessionId: tender.cashDrawerSessionId,
          bankReference: tender.bankReference,
          checkNumber: tender.checkNumber,
          checkBank: tender.checkBank,
          checkDate: tender.checkDate,
          // One key per confirmed allocation: a retry of the same receipt is
          // answered from the existing voucher instead of posting twice.
          idempotencyKey: `car_${allocation.allocationPreviewId}`,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        code?: string;
        data?: { voucherNo?: string };
      };
      if (!res.ok || !json.success) {
        cmxMessage.error(resolveErrorMessage(json.code));
        return;
      }
      cmxMessage.success(
        json.data?.voucherNo ? t('postSuccessWithNo', { voucherNo: json.data.voucherNo }) : t('postSuccess')
      );
      setReceiptAmount(0);
      setTender(null);
      lastMethodCodeRef.current = undefined;
      setTenderKey((k) => k + 1);
      allocation.resetAllocationState();
    } catch {
      cmxMessage.error(t('postError'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!canPost) {
    return (
      <p className="text-sm text-muted-foreground">{t('customerRequired')}</p>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
      </div>

      {!currencyCode ? (
        <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {t('currencyMissing')}
        </p>
      ) : null}

      <CmxCard>
        <CmxCardHeader>
          <CmxCardTitle>{t('selectCustomer')}</CmxCardTitle>
        </CmxCardHeader>
        <CmxCardContent className="space-y-4">
          {customer ? (
            <div className={`flex items-center justify-between gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div>
                <p className="font-medium">{customer.name}</p>
                {customer.phone ? (
                  <p className="text-sm text-muted-foreground">{customer.phone}</p>
                ) : null}
              </div>
              <CmxButton variant="outline" onClick={() => setPickerOpen(true)}>
                {t('changeCustomer')}
              </CmxButton>
            </div>
          ) : (
            <CmxButton onClick={() => setPickerOpen(true)}>{t('selectCustomer')}</CmxButton>
          )}

          <div className="space-y-2">
            <Label htmlFor="receipt-amount">{t('receiptAmount')}</Label>
            <CmxInput
              id="receipt-amount"
              type="number"
              min={0}
              step="0.001"
              value={receiptAmount || ''}
              onChange={(e) => {
                setReceiptAmount(Number(e.target.value));
                allocation.resetAllocationState();
              }}
              disabled={!customer || !currencyCode}
            />
          </div>

          {customer && currencyCode && receiptAmount > 0 ? (
            <>
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                <p className="mb-2 text-sm font-medium">{t('tenderTitle')}</p>
                <StoredValueTenderFields
                  key={tenderKey}
                  amount={receiptAmount}
                  currencyCode={currencyCode}
                  tenantOrgId={currentTenant?.tenant_id ?? ''}
                  userId={user?.id}
                  onTenderChange={handleTenderChange}
                  collectReferences
                  excludeMethodCodes={RECEIPT_EXCLUDED_METHOD_CODES}
                />
              </div>

              <div className="rounded-lg border p-4 space-y-3">
                <p className="text-sm font-medium">{t('allocateTitle')}</p>
                <p className="text-xs text-muted-foreground">
                  {tender ? t('allocateHint') : t('tenderRequired')}
                </p>
                <div className={`flex flex-wrap gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <CmxButton variant="outline" disabled={!tender} onClick={allocation.handleOpenAutoAllocate}>
                    {t('autoAllocate')}
                  </CmxButton>
                  <CmxButton variant="outline" disabled={!tender} onClick={allocation.handleOpenManualAllocate}>
                    {t('manualAllocate')}
                  </CmxButton>
                </div>
                {allocation.allocationPreviewId ? (
                  <p className="text-sm text-green-700">{t('allocationConfirmed')}</p>
                ) : null}
              </div>

              <LoadingButton loading={submitting} disabled={!canSubmit} onClick={handlePost}>
                {t('postReceipt')}
              </LoadingButton>
            </>
          ) : null}
        </CmxCardContent>
      </CmxCard>

      <CustomerPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelectCustomer={(selected) => {
          setCustomer({
            id: selected.id,
            name: selected.name ?? selected.displayName ?? 'Customer',
            phone: selected.phone ?? undefined,
          });
          setPickerOpen(false);
          allocation.resetAllocationState();
        }}
        tenantId={currentTenant?.tenant_id}
      />

      <AutoAllocationPreviewDrawer
        open={allocation.autoDrawerOpen}
        onOpenChange={allocation.setAutoDrawerOpen}
        preview={allocation.allocationPreview}
        loading={allocation.previewLoading}
        confirming={allocation.confirmLoading}
        currencyCode={currencyCode}
        formatAmount={formatAmount}
        onConfirm={allocation.handleConfirmAutoAllocation}
        isRTL={isRTL}
      />

      <ManualAllocationDrawer
        open={allocation.manualDrawerOpen}
        onOpenChange={allocation.setManualDrawerOpen}
        targets={allocation.openBalanceTargets}
        loading={allocation.openBalancesLoading}
        submitting={allocation.confirmLoading}
        excessAmount={receiptAmount}
        currencyCode={currencyCode}
        formatAmount={formatAmount}
        onSubmit={allocation.handleSubmitManualAllocation}
        isRTL={isRTL}
      />
    </div>
  );
}
