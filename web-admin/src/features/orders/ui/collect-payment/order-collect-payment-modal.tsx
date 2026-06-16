'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { useHasPermissionCode } from '@/lib/hooks/usePermissions';
import { useCSRFToken, getCSRFHeader } from '@/lib/hooks/use-csrf-token';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { computeCollectionOverpaymentMetrics } from '@/lib/payments/collection-overpayment';
import { PAYMENT_METHODS } from '@/lib/constants/payment';
import {
  OVERPAYMENT_RESOLUTION_PERMISSIONS,
  SETTLEMENT_MONEY_EPSILON,
} from '@/lib/constants/settlement-catalog';
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
import { usePayExtraCheckout } from '@features/orders/hooks/use-pay-extra-checkout';
import { ExtraReceiptHandlingCard } from '@features/orders/ui/payment-modal/allocation/extra-receipt-handling-card';
import { AutoAllocationPreviewDrawer } from '@features/orders/ui/payment-modal/allocation/auto-allocation-preview-drawer';
import { ManualAllocationDrawer } from '@features/orders/ui/payment-modal/allocation/manual-allocation-drawer';
import { buildOverpaymentResolutionPayload } from '@features/orders/ui/payment-modal/allocation/build-overpayment-resolution';
import { PayExtraIntentToggle } from '@features/orders/ui/payment-modal/pay-extra/pay-extra-intent-toggle';
import { PaymentValidateButton } from '@features/orders/ui/payment-modal/pay-extra/payment-validate-button';
import { PaymentExtraReceiptDialog } from '@features/orders/ui/payment-modal/pay-extra/payment-extra-receipt-dialog';
import { ensurePaymentLegRefs } from '@/lib/payments/ensure-payment-leg-refs';

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
  const tPayment = useTranslations('newOrder.payment');
  const tExtra = useTranslations('newOrder.payment.extraReceipt');
  const isRTL = useRTL();
  const { formatMoneyWithCode } = useTenantCurrency();
  const { token: csrfToken } = useCSRFToken();
  const canCollect = useHasPermissionCode('orders:collect_payment');
  const canAllocate = useHasPermissionCode(OVERPAYMENT_RESOLUTION_PERMISSIONS.ALLOCATE);
  const canDispose = useHasPermissionCode(OVERPAYMENT_RESOLUTION_PERMISSIONS.DISPOSE);
  const canWallet = useHasPermissionCode(OVERPAYMENT_RESOLUTION_PERMISSIONS.TO_WALLET);
  const canAdvance = useHasPermissionCode(OVERPAYMENT_RESOLUTION_PERMISSIONS.TO_ADVANCE);
  const canCredit = useHasPermissionCode(OVERPAYMENT_RESOLUTION_PERMISSIONS.TO_CREDIT);
  const canCreditNote = useHasPermissionCode(OVERPAYMENT_RESOLUTION_PERMISSIONS.TO_CREDIT_NOTE);
  const canSaveAdvance = canDispose || canAdvance;
  const canSaveCredit = canDispose || canCredit || canCreditNote;

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

  const legacyOverpaymentMetrics = useMemo(() => {
    if (!selectedMethod) {
      return { unresolvedExcessAmount: 0, excessAmount: 0, canReturnChangeFromCash: false };
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

  const canEnablePayExtra = useMemo(() => {
    if (!selectedMethod) return false;
    return (
      selectedMethod.supports_overpayment ||
      (selectedMethod.payment_method_code === PAYMENT_METHODS.CASH &&
        selectedMethod.supports_change_return)
    );
  }, [selectedMethod]);

  const checkoutLegs = useMemo(() => {
    if (!selectedMethod) return [];
    return [
      {
        paymentMethodCode: selectedMethod.payment_method_code,
        amount,
        tenderedAmount: isCash ? (cashTendered ?? amount) : undefined,
        supportsChangeReturn: selectedMethod.supports_change_return,
      },
    ];
  }, [amount, cashTendered, isCash, selectedMethod]);

  const payExtra = usePayExtraCheckout({
    customerId,
    branchId,
    currencyCode,
    excessAmount: legacyOverpaymentMetrics.unresolvedExcessAmount,
    legacyUnresolvedExcess: legacyOverpaymentMetrics.unresolvedExcessAmount,
    saleTotal: outstandingAmount,
    immediateSettlementAmount: amount,
    legs: checkoutLegs,
    receiptAmount: amount,
    currentOrderAllocationAmount: Math.min(amount, outstandingAmount),
    sourceType: 'LATER_COLLECTION',
    sourceOrderId: orderId,
    paymentMethodCode: selectedMethod?.payment_method_code ?? PAYMENT_METHODS.CASH,
    confirmedToastMessage: tExtra('allocation.confirmedToast'),
    remainingUnallocatedErrorMessage: tExtra('allocation.remainingUnallocatedError'),
    resetDeps: [amount, cashTendered, selectedMethodId],
  });

  const allocation = payExtra;
  const {
    payExtraIntent,
    setPayExtraIntent,
    extraReceiptDialogOpen,
    setExtraReceiptDialogOpen,
    runValidatePayment,
    confirmExtraReceiptSelection,
    validationPhase,
  } = payExtra;

  const overpaymentMetrics = useMemo(() => {
    if (!selectedMethod) {
      return { unresolvedExcessAmount: 0, excessAmount: 0, canReturnChangeFromCash: false };
    }
    return computeCollectionOverpaymentMetrics(
      outstandingAmount,
      [
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
      ],
      { payExtraIntent }
    );
  }, [amount, cashTendered, isCash, outstandingAmount, payExtraIntent, selectedMethod]);

  const unresolvedExcess = payExtraIntent
    ? payExtra.unresolvedExcessAmount
    : overpaymentMetrics.unresolvedExcessAmount;

  const overpaymentResolution = useMemo(
    () =>
      buildOverpaymentResolutionPayload(allocation.extraReceiptMode, unresolvedExcess, {
        allocationPreviewId: allocation.allocationPreviewId,
      }),
    [allocation.allocationPreviewId, allocation.extraReceiptMode, unresolvedExcess]
  );

  const needsResolution = payExtra.overpaymentBlocksSubmit;

  useEffect(() => {
    if (!open) return;
    setAmount(outstandingAmount);
    setCashTendered(undefined);
    payExtra.resetPayExtraState();
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
      showErrorToast(
        payExtraIntent && validationPhase !== 'ready'
          ? tPayment('validatePayment.requiredBeforeSubmit')
          : t('resolutionRequired')
      );
      return;
    }
    setSubmitting(true);
    try {
      const legsWithRefs = ensurePaymentLegRefs([
        {
          method: selectedMethod.payment_method_code as 'CASH',
          amount,
          ...(isCash && cashTendered != null ? { cashTendered } : {}),
        },
      ]);
      const cashLegRef = legsWithRefs.find((leg) => leg.method === PAYMENT_METHODS.CASH)?.legRef;
      const submitResolution = buildOverpaymentResolutionPayload(
        allocation.extraReceiptMode,
        unresolvedExcess,
        {
          allocationPreviewId: allocation.allocationPreviewId,
          cashLegRef,
        }
      );

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
          ...(submitResolution ? { overpaymentResolution: submitResolution } : {}),
          idempotencyKey: `collect_${orderId}_${Date.now()}`,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        const errorCode = typeof json.errorCode === 'string' ? json.errorCode : '';
        const mapped =
          errorCode === 'OVERPAYMENT_RESOLUTION_REQUIRED'
            ? tPayment('validatePayment.requiredBeforeSubmit')
            : errorCode === 'OVERPAYMENT_RESOLUTION_NOT_ALLOWED'
              ? tPayment('extraReceipt.allocation.manualBlockedReturn')
              : null;
        throw new Error(mapped ?? json.error ?? t('submitError'));
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

                <PayExtraIntentToggle
                  checked={payExtraIntent}
                  onCheckedChange={setPayExtraIntent}
                  disabled={!canEnablePayExtra}
                  disabledReason={
                    !canEnablePayExtra ? tPayment('payExtraIntent.disabledNoMethods') : undefined
                  }
                  isRTL={isRTL}
                />

                {payExtraIntent ? (
                  <PaymentValidateButton
                    onClick={runValidatePayment}
                    disabled={!canEnablePayExtra}
                  />
                ) : null}

                {unresolvedExcess > SETTLEMENT_MONEY_EPSILON && !payExtraIntent ? (
                  <ExtraReceiptHandlingCard
                    excessAmount={unresolvedExcess}
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
                    canSaveAdvance={canSaveAdvance}
                    canSaveCredit={canSaveCredit}
                    canSaveWallet={canWallet}
                    canReturnCashChange={overpaymentMetrics.canReturnChangeFromCash}
                  />
                ) : null}
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
        excessAmount={unresolvedExcess}
        currencyCode={currencyCode}
        formatAmount={formatAmount}
        onSubmit={allocation.handleSubmitManualAllocation}
        isRTL={isRTL}
      />

      <PaymentExtraReceiptDialog
        open={extraReceiptDialogOpen}
        onOpenChange={setExtraReceiptDialogOpen}
        excessAmount={unresolvedExcess}
        currencyCode={currencyCode}
        formatAmount={formatAmount}
        hasLinkedCustomer={!!customerId?.trim()}
        selectedMode={allocation.extraReceiptMode}
        onModeChange={allocation.setExtraReceiptMode}
        onOpenAutoAllocate={canAllocate ? allocation.handleOpenAutoAllocate : undefined}
        onOpenManualAllocate={canAllocate ? allocation.handleOpenManualAllocate : undefined}
        allocationConfirmed={!!allocation.allocationPreviewId}
        canReturnCashChange={overpaymentMetrics.canReturnChangeFromCash}
        canAllocate={canAllocate}
        canSaveAdvance={canSaveAdvance}
        canSaveCredit={canSaveCredit}
        canSaveWallet={canWallet}
        onConfirm={() => {
          if (!confirmExtraReceiptSelection()) {
            showErrorToast(tPayment('validatePayment.requiredBeforeSubmit'));
          }
        }}
        onBack={() => setExtraReceiptDialogOpen(false)}
        confirmDisabled={!overpaymentResolution}
        isRTL={isRTL}
      />
    </>
  );
}
