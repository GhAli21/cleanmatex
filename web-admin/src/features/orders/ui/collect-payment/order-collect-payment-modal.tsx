'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { useHasPermission } from '@/lib/hooks/usePermissions';
import { useCSRFToken, getCSRFHeader } from '@/lib/hooks/use-csrf-token';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { computeCollectionOverpaymentMetrics } from '@/lib/payments/collection-overpayment';
import { PAYMENT_METHODS } from '@/lib/constants/payment';
import { SETTLEMENT_MONEY_EPSILON } from '@/lib/constants/settlement-catalog';
import { CmxButton } from '@ui/primitives';
import { CmxInput, Label } from '@ui/primitives';
import { LoadingButton } from '@ui/primitives';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogFooter,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays';
import { CmxSelectDropdown, CmxSelectDropdownContent, CmxSelectDropdownItem, CmxSelectDropdownTrigger, CmxSelectDropdownValue } from '@ui/forms';
import { showErrorToast, showSuccessToast } from '@ui/components/cmx-toast';
import { useOverpaymentAllocation } from '@features/orders/hooks/use-overpayment-allocation';
import { ExtraReceiptHandlingCard } from '@features/orders/ui/payment-modal/allocation/extra-receipt-handling-card';
import { AutoAllocationPreviewDrawer } from '@features/orders/ui/payment-modal/allocation/auto-allocation-preview-drawer';
import { ManualAllocationDrawer } from '@features/orders/ui/payment-modal/allocation/manual-allocation-drawer';
import { buildOverpaymentResolutionPayload } from '@features/orders/ui/payment-modal/allocation/build-overpayment-resolution';

interface CheckoutMethodOption {
  id: string;
  payment_method_code: string;
  display_name: string;
  display_name2?: string | null;
  requires_cash_drawer: boolean;
  supports_overpayment: boolean;
  supports_change_return: boolean;
  allowed_for_pay_on_collection?: boolean;
}

export interface OrderCollectPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  customerId?: string | null;
  branchId?: string | null;
  outstandingAmount: number;
  currencyCode: string;
  onCollected?: () => void;
}

export function OrderCollectPaymentModal({
  open,
  onOpenChange,
  orderId,
  customerId,
  branchId,
  outstandingAmount,
  currencyCode,
  onCollected,
}: OrderCollectPaymentModalProps) {
  const t = useTranslations('orders.collectPayment');
  const tExtra = useTranslations('newOrder.payment.extraReceipt');
  const isRTL = useRTL();
  const { formatMoneyWithCode } = useTenantCurrency();
  const { token: csrfToken } = useCSRFToken();
  const canCollect = useHasPermission('orders:collect_payment');
  const canAllocate = useHasPermission('orders:overpayment_allocate');
  const canDispose = useHasPermission('orders:overpayment_dispose');

  const [methods, setMethods] = useState<CheckoutMethodOption[]>([]);
  const [methodsLoading, setMethodsLoading] = useState(false);
  const [selectedMethodId, setSelectedMethodId] = useState('');
  const [amount, setAmount] = useState(outstandingAmount);
  const [cashTendered, setCashTendered] = useState<number | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const selectedMethod = methods.find((m) => m.id === selectedMethodId);
  const isCash = selectedMethod?.payment_method_code === PAYMENT_METHODS.CASH;

  const formatAmount = useCallback(
    (value: number) => formatMoneyWithCode(value, currencyCode).replace(currencyCode, '').trim(),
    [currencyCode, formatMoneyWithCode]
  );

  const overpaymentMetrics = useMemo(() => {
    if (!selectedMethod) {
      return { unresolvedExcessAmount: 0, excessAmount: 0 };
    }
    return computeCollectionOverpaymentMetrics(outstandingAmount, [
      {
        legIndex: 0,
        orgPaymentMethodId: selectedMethod.id,
        paymentMethodCode: selectedMethod.payment_method_code,
        amount,
        cashTendered: isCash ? (cashTendered ?? amount) : undefined,
        supportsChangeReturn: selectedMethod.supports_change_return,
        supportsOverpayment: selectedMethod.supports_overpayment,
        requiresCashDrawer: selectedMethod.requires_cash_drawer,
      },
    ]);
  }, [amount, cashTendered, isCash, outstandingAmount, selectedMethod]);

  const allocation = useOverpaymentAllocation({
    customerId,
    branchId,
    currencyCode,
    excessAmount: overpaymentMetrics.unresolvedExcessAmount,
    receiptAmount: amount,
    currentOrderAllocationAmount: Math.min(amount, outstandingAmount),
    sourceType: 'LATER_COLLECTION',
    sourceOrderId: orderId,
    paymentMethodCode: selectedMethod?.payment_method_code ?? PAYMENT_METHODS.CASH,
    confirmedToastMessage: tExtra('allocation.confirmedToast'),
  });

  const overpaymentResolution = useMemo(
    () =>
      buildOverpaymentResolutionPayload(
        allocation.extraReceiptMode,
        overpaymentMetrics.unresolvedExcessAmount,
        { allocationPreviewId: allocation.allocationPreviewId }
      ),
    [allocation.allocationPreviewId, allocation.extraReceiptMode, overpaymentMetrics.unresolvedExcessAmount]
  );

  const needsResolution =
    overpaymentMetrics.unresolvedExcessAmount > SETTLEMENT_MONEY_EPSILON && !overpaymentResolution;

  useEffect(() => {
    if (!open) return;
    setAmount(outstandingAmount);
    setCashTendered(undefined);
    allocation.resetAllocationState();
    allocation.setExtraReceiptMode('adjust_legs');
  }, [open, outstandingAmount]);

  useEffect(() => {
    if (!open || !canCollect) return;
    setMethodsLoading(true);
    const params = new URLSearchParams();
    params.set('amount', String(outstandingAmount));
    if (branchId) params.set('branchId', branchId);
    if (customerId) params.set('customerId', customerId);
    fetch(`/api/v1/orders/checkout-options?${params.toString()}`, {
      headers: { ...getCSRFHeader(csrfToken) },
    })
      .then(async (res) => {
        const json = await res.json();
        if (!json.success) throw new Error(json.error ?? 'Failed to load methods');
        const list = (json.data?.paymentMethods ?? []) as CheckoutMethodOption[];
        const eligible = list.filter(
          (m) => m.allowed_for_pay_on_collection !== false && m.payment_method_code !== PAYMENT_METHODS.PAY_ON_COLLECTION
        );
        setMethods(eligible);
        if (eligible[0]) setSelectedMethodId(eligible[0].id);
      })
      .catch((err) => {
        showErrorToast(err instanceof Error ? err.message : t('loadMethodsError'));
        setMethods([]);
      })
      .finally(() => setMethodsLoading(false));
  }, [open, canCollect, outstandingAmount, branchId, customerId, csrfToken, t]);

  const handleSubmit = async () => {
    if (!selectedMethod || amount <= 0) return;
    if (needsResolution) {
      showErrorToast(t('resolutionRequired'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/orders/${orderId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getCSRFHeader(csrfToken) },
        body: JSON.stringify({
          paymentLegs: [
            {
              paymentMethodId: selectedMethod.id,
              amount,
              ...(isCash && cashTendered != null ? { cashTendered } : {}),
            },
          ],
          customerId: customerId ?? undefined,
          ...(overpaymentResolution ? { overpaymentResolution } : {}),
          idempotencyKey: `collect_${orderId}_${Date.now()}`,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? t('submitError'));
      }
      showSuccessToast(t('success'));
      onOpenChange(false);
      onCollected?.();
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : t('submitError'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!canCollect) {
    return null;
  }

  return (
    <>
      <CmxDialog open={open} onOpenChange={onOpenChange}>
        <CmxDialogContent className="max-w-lg">
          <CmxDialogHeader>
            <CmxDialogTitle>{t('title')}</CmxDialogTitle>
          </CmxDialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              {t('outstanding', { amount: formatMoneyWithCode(outstandingAmount, currencyCode) })}
            </p>

            {methodsLoading ? (
              <p className="text-sm text-muted-foreground">{t('loadingMethods')}</p>
            ) : (
              <>
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

                <div className="space-y-2">
                  <Label htmlFor="collect-amount">{t('amount')}</Label>
                  <CmxInput
                    id="collect-amount"
                    type="number"
                    min={0}
                    step="0.001"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                  />
                </div>

                {isCash ? (
                  <div className="space-y-2">
                    <Label htmlFor="collect-tendered">{t('cashTendered')}</Label>
                    <CmxInput
                      id="collect-tendered"
                      type="number"
                      min={amount}
                      step="0.001"
                      value={cashTendered ?? amount}
                      onChange={(e) => setCashTendered(Number(e.target.value))}
                    />
                  </div>
                ) : null}

                <ExtraReceiptHandlingCard
                  excessAmount={overpaymentMetrics.unresolvedExcessAmount}
                  currencyCode={currencyCode}
                  formatAmount={formatAmount}
                  hasLinkedCustomer={!!customerId?.trim()}
                  selectedMode={allocation.extraReceiptMode}
                  onModeChange={allocation.setExtraReceiptMode}
                  onOpenAutoAllocate={canAllocate ? allocation.handleOpenAutoAllocate : undefined}
                  onOpenManualAllocate={canAllocate ? allocation.handleOpenManualAllocate : undefined}
                  allocationConfirmed={!!allocation.allocationPreviewId}
                  isRTL={isRTL}
                  canAllocate={canAllocate}
                  canSaveAdvance={canDispose}
                  canSaveCredit={canDispose}
                />
              </>
            )}
          </div>

          <CmxDialogFooter className={isRTL ? 'flex-row-reverse' : ''}>
            <CmxButton variant="outline" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </CmxButton>
            <LoadingButton
              loading={submitting}
              disabled={methodsLoading || !selectedMethod || needsResolution}
              onClick={handleSubmit}
            >
              {t('submit')}
            </LoadingButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>

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
        excessAmount={overpaymentMetrics.unresolvedExcessAmount}
        currencyCode={currencyCode}
        formatAmount={formatAmount}
        onSubmit={allocation.handleSubmitManualAllocation}
        isRTL={isRTL}
      />
    </>
  );
}
