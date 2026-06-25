'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import {
  CmxSelectDropdown,
  CmxSelectDropdownContent,
  CmxSelectDropdownItem,
  CmxSelectDropdownTrigger,
  CmxSelectDropdownValue,
} from '@ui/forms';
import { showErrorToast, showSuccessToast } from '@ui/components/cmx-toast';
import { useOverpaymentAllocation } from '@features/orders/hooks/use-overpayment-allocation';
import { AutoAllocationPreviewDrawer } from '@features/orders/ui/payment-modal/allocation/auto-allocation-preview-drawer';
import { ManualAllocationDrawer } from '@features/orders/ui/payment-modal/allocation/manual-allocation-drawer';

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

interface CheckoutMethodOption {
  id: string;
  payment_method_code: string;
  display_name: string;
  display_name2?: string | null;
  requires_cash_drawer: boolean;
}

/**
 *
 */
export function CustomerAccountReceiptClient() {
  const t = useTranslations('customers.accountReceipt');
  const isRTL = useRTL();
  const { currentTenant } = useAuth();
  const { formatMoneyWithCode, currencyCode: tenantCurrency } = useTenantCurrency();
  const { token: csrfToken } = useCSRFToken();
  const canPost = useHasPermissionCode('customers:receipt_allocate');

  const [customer, setCustomer] = useState<SelectedCustomer | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [receiptAmount, setReceiptAmount] = useState(0);
  const [methods, setMethods] = useState<CheckoutMethodOption[]>([]);
  const [methodsLoading, setMethodsLoading] = useState(false);
  const [selectedMethodId, setSelectedMethodId] = useState('');
  const [cashTendered, setCashTendered] = useState<number | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const currencyCode = tenantCurrency ?? 'OMR';
  const selectedMethod = methods.find((m) => m.id === selectedMethodId);
  const isCash = selectedMethod?.payment_method_code === PAYMENT_METHODS.CASH;

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
    paymentMethodCode: selectedMethod?.payment_method_code ?? PAYMENT_METHODS.CASH,
    confirmedToastMessage: t('allocationConfirmed'),
  });

  useEffect(() => {
    if (!customer?.id || receiptAmount <= 0 || !canPost) {
      setMethods([]);
      return;
    }
    setMethodsLoading(true);
    const params = new URLSearchParams();
    params.set('amount', String(receiptAmount));
    params.set('customerId', customer.id);
    fetch(`/api/v1/orders/checkout-options?${params.toString()}`, {
      headers: { ...getCSRFHeader(csrfToken) },
    })
      .then(async (res) => {
        const json = await res.json();
        if (!json.success) throw new Error(json.error ?? 'Failed');
        const list = (json.data?.paymentMethods ?? []) as CheckoutMethodOption[];
        const eligible = list.filter(
          (m) => m.payment_method_code !== PAYMENT_METHODS.PAY_ON_COLLECTION
        );
        setMethods(eligible);
        if (eligible[0]) setSelectedMethodId(eligible[0].id);
      })
      .catch(() => setMethods([]))
      .finally(() => setMethodsLoading(false));
  }, [canPost, csrfToken, customer?.id, receiptAmount]);

  const canSubmit = useMemo(
    () =>
      !!customer?.id &&
      receiptAmount > 0 &&
      !!selectedMethod &&
      !!allocation.allocationPreviewId,
    [allocation.allocationPreviewId, customer?.id, receiptAmount, selectedMethod]
  );

  const handlePost = async () => {
    if (!customer?.id || !selectedMethod || !allocation.allocationPreviewId) {
      showErrorToast(t('allocationRequired'));
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
          paymentMethodId: selectedMethod.id,
          receiptAmount,
          currencyCode,
          ...(isCash && cashTendered != null ? { cashTendered } : {}),
          idempotencyKey: `car_${customer.id}_${Date.now()}`,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? t('postError'));
      }
      showSuccessToast(t('postSuccess'));
      setReceiptAmount(0);
      setCashTendered(undefined);
      allocation.resetAllocationState();
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : t('postError'));
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
              disabled={!customer}
            />
          </div>

          {customer && receiptAmount > 0 ? (
            <>
              {methodsLoading ? (
                <p className="text-sm text-muted-foreground">{t('loadingMethods')}</p>
              ) : (
                <div className="space-y-2">
                  <Label>{t('paymentMethod')}</Label>
                  <CmxSelectDropdown value={selectedMethodId} onValueChange={setSelectedMethodId}>
                    <CmxSelectDropdownTrigger className="w-full">
                      <CmxSelectDropdownValue placeholder={t('paymentMethod')} />
                    </CmxSelectDropdownTrigger>
                    <CmxSelectDropdownContent>
                      {methods.map((method) => (
                        <CmxSelectDropdownItem key={method.id} value={method.id}>
                          {isRTL && method.display_name2 ? method.display_name2 : method.display_name}
                        </CmxSelectDropdownItem>
                      ))}
                    </CmxSelectDropdownContent>
                  </CmxSelectDropdown>
                </div>
              )}

              {isCash ? (
                <div className="space-y-2">
                  <Label htmlFor="receipt-tendered">{t('cashTendered')}</Label>
                  <CmxInput
                    id="receipt-tendered"
                    type="number"
                    min={receiptAmount}
                    step="0.001"
                    value={cashTendered ?? receiptAmount}
                    onChange={(e) => setCashTendered(Number(e.target.value))}
                  />
                </div>
              ) : null}

              <div className="rounded-lg border p-4 space-y-3">
                <p className="text-sm font-medium">{t('allocateTitle')}</p>
                <p className="text-xs text-muted-foreground">{t('allocateHint')}</p>
                <div className={`flex flex-wrap gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <CmxButton variant="outline" onClick={allocation.handleOpenAutoAllocate}>
                    {t('autoAllocate')}
                  </CmxButton>
                  <CmxButton variant="outline" onClick={allocation.handleOpenManualAllocate}>
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
