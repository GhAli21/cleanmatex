'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Banknote, Loader2, Plus, RefreshCw } from 'lucide-react';
import { useRTL } from '@/lib/hooks/useRTL';
import { useHasPermissionCode } from '@/lib/hooks/usePermissions';
import { useCSRFToken, getCSRFHeader } from '@/lib/hooks/use-csrf-token';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { useAuth } from '@/lib/auth/auth-context';
import { computeCollectionOverpaymentMetrics } from '@/lib/payments/collection-overpayment';
import { PAYMENT_METHODS } from '@/lib/constants/payment';
import {
  OVERPAYMENT_RESOLUTION_PERMISSIONS,
  SETTLEMENT_MONEY_EPSILON,
} from '@/lib/constants/settlement-catalog';
import { CmxButton } from '@ui/primitives';
import { CmxInput, Label } from '@ui/primitives';
import { CmxMoneyField } from '@ui/primitives';
import { CmxSkeleton } from '@ui/primitives';
import { LoadingButton } from '@ui/primitives';
import { Badge } from '@ui/primitives/badge';
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
import { useCashDrawer } from '@features/orders/hooks/use-cash-drawer';
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

/**
 *
 */
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

/**
 *
 * @param root0
 * @param root0.open
 * @param root0.onOpenChange
 * @param root0.orderId
 * @param root0.customerId
 * @param root0.branchId
 * @param root0.outstandingAmount
 * @param root0.currencyCode
 * @param root0.onCollected
 */
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
  const { formatMoneyWithCode, decimalPlaces } = useTenantCurrency();
  const { currentTenant, user } = useAuth();
  const tenantOrgId = currentTenant?.tenant_id ?? '';
  const userId = user?.id;
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
  const cashDrawerRequired = !!selectedMethod?.requires_cash_drawer;

  // Inline cash-drawer session management (shared with the new-order payment modal).
  // The selected cash method must be bound to an open drawer session before the API
  // will accept the collection; this lets the cashier select/open one in place.
  const cashDrawer = useCashDrawer({
    open,
    tenantOrgId,
    branchId: branchId ?? undefined,
    userId,
    isRTL,
    csrfToken,
    t: tPayment,
    cashDrawerRequired,
  });
  const {
    cashDrawers,
    cashDrawersLoading,
    cashDrawersFetching,
    refetchCashDrawers,
    selectedCashDrawerSessionId,
    setSelectedCashDrawerSessionId,
    cashDrawerDialogOpen,
    setCashDrawerDialogOpen,
    cashDrawerToOpenId,
    setCashDrawerToOpenId,
    openingBalanceValue,
    setOpeningBalanceValue,
    openingDrawerSession,
    cashDrawerRequestError,
    setCashDrawerRequestError,
    cashDrawerSessionChoices,
    selectedCashDrawerChoice,
    canOpenNewCashDrawerSession,
    cashDrawerBlockingMessage,
    getDrawerDisplayName,
    persistPreferredCashDrawerId,
    handleOpenCashDrawerDialog,
    handleCreateCashDrawerSession,
  } = cashDrawer;

  const cashDrawerBlocksSubmit = cashDrawerRequired && !!cashDrawerBlockingMessage;

  // Change to return to the customer when cash tendered exceeds the collected amount.
  const changeDue = isCash ? Math.max(0, (cashTendered ?? amount) - amount) : 0;

  // formatMoneyWithCode takes only the amount (tenant currency); the modal
  // strips the code to render a bare number. Passing currencyCode as a 2nd arg
  // was a no-op (ignored at runtime) and a tsc error — drop it.
  const formatAmount = useCallback(
    (value: number) => formatMoneyWithCode(value).replace(currencyCode, '').trim(),
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
    // Later collection of an order receivable is an order-scoped payment (sourceOrderId
    // is set), so it posts under the order-payment voucher source — the only order-scoped
    // value the auto-allocation schema accepts (CUSTOMER_RECEIPT is account-level).
    sourceType: 'ORDER_PAYMENT_MODAL',
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

  const allocationExcessAmount = payExtraIntent
    ? payExtra.extraReceiptDialogExcessAmount
    : unresolvedExcess;

  const overpaymentResolution = payExtra.overpaymentResolutionPayload;

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
    if (cashDrawerBlocksSubmit) {
      showErrorToast(cashDrawerBlockingMessage ?? tPayment('cashDrawer.errors.noOpenSession'));
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
      const submitResolution =
        payExtra.overpaymentResolutionPayload ??
        buildOverpaymentResolutionPayload(
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
          ...(cashDrawerRequired && selectedCashDrawerSessionId
            ? { cashDrawerSessionId: selectedCashDrawerSessionId }
            : {}),
          ...(submitResolution ? { overpaymentResolution: submitResolution } : {}),
          // F-10: per-event idempotency key. Random suffix guards against two
          // distinct rapid collections landing in the same millisecond (which
          // would otherwise dedupe a legitimate second partial collection).
          idempotencyKey: `collect_${orderId}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        // Match on errorCode, falling back to a raw `error` that is itself a code
        // (the API sometimes returns the code in `error` with no `errorCode`).
        const errorCode =
          (typeof json.errorCode === 'string' && json.errorCode) ||
          (typeof json.error === 'string' ? json.error : '');
        const mapped =
          errorCode === 'OVERPAYMENT_RESOLUTION_REQUIRED'
            ? tPayment('validatePayment.requiredBeforeSubmit')
            : errorCode === 'OVERPAYMENT_RESOLUTION_NOT_ALLOWED'
              ? tPayment('extraReceipt.allocation.manualBlockedReturn')
              : errorCode === 'CASH_DRAWER_SESSION_REQUIRED'
                ? tPayment('cashDrawer.errors.noOpenSession')
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

  const requiredMark = (
    <span className="text-red-500" aria-hidden="true">
      {' '}
      *
    </span>
  );

  return (
    <>
      <CmxDialog open={open} onOpenChange={onOpenChange}>
        <CmxDialogContent className="max-w-lg">
          <CmxDialogHeader>
            <CmxDialogTitle>{t('title')}</CmxDialogTitle>
          </CmxDialogHeader>

          <div className="space-y-4 py-2">
            <div className={`rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>
              <div className={`flex items-baseline justify-between gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className="text-sm text-muted-foreground">{t('outstandingLabel')}</span>
                <span className="text-lg font-bold tabular-nums text-slate-900">
                  {formatMoneyWithCode(outstandingAmount)}
                </span>
              </div>
            </div>

            {methodsLoading ? (
              <div className="space-y-3">
                <CmxSkeleton className="h-10 w-full" />
                <CmxSkeleton className="h-10 w-full" />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>
                    {t('paymentMethod')}
                    {requiredMark}
                  </Label>
                  <CmxSelectDropdown value={selectedMethodId} onValueChange={setSelectedMethodId}>
                    <CmxSelectDropdownTrigger className="w-full" aria-required="true">
                      <CmxSelectDropdownValue
                        displayValue={
                          selectedMethod
                            ? (isRTL && selectedMethod.display_name2
                                ? selectedMethod.display_name2
                                : selectedMethod.display_name)
                            : undefined
                        }
                        placeholder={t('paymentMethod')}
                      />
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
                  <div className={`flex items-center justify-between gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <Label htmlFor="collect-amount" className="m-0">
                      {t('amount')}
                      {requiredMark}
                    </Label>
                    <CmxButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto px-2 py-0.5 text-xs font-medium text-cyan-700"
                      onClick={() => setAmount(outstandingAmount)}
                    >
                      {t('fullOutstanding')}
                    </CmxButton>
                  </div>
                  <CmxInput
                    id="collect-amount"
                    type="number"
                    min={0}
                    step="0.001"
                    value={amount}
                    aria-required="true"
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

                {isCash && changeDue > SETTLEMENT_MONEY_EPSILON ? (
                  <div
                    role="status"
                    aria-live="polite"
                    className={`flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-sm ${isRTL ? 'flex-row-reverse' : ''}`}
                  >
                    <span className="text-emerald-700">{t('changeDue')}</span>
                    <span className="font-semibold tabular-nums text-emerald-800">
                      {formatMoneyWithCode(changeDue)}
                    </span>
                  </div>
                ) : null}

                {cashDrawerRequired ? (
                  <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                    <div className={`flex items-center justify-between gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <Label className="m-0 flex items-center gap-1.5">
                        <Banknote className="h-4 w-4 text-cyan-700" />
                        {tPayment('cashDrawer.title')}
                      </Label>
                      <Badge variant="secondary" className="text-xs">
                        {selectedCashDrawerChoice
                          ? tPayment('cashDrawer.boundBadge')
                          : tPayment('cashDrawer.pendingBadge')}
                      </Badge>
                    </div>
                    <p className={`text-xs text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
                      {tPayment('cashDrawer.subtitle')}
                    </p>

                    {cashDrawersLoading ? (
                      <CmxSkeleton className="h-16 w-full" />
                    ) : (
                      <>
                        {cashDrawerSessionChoices.length > 1 ? (
                          <CmxSelectDropdown
                            value={selectedCashDrawerSessionId}
                            onValueChange={(value) => {
                              setSelectedCashDrawerSessionId(value);
                              const selectedChoice = cashDrawerSessionChoices.find(
                                ({ session }) => session.id === value
                              );
                              persistPreferredCashDrawerId(selectedChoice?.drawer.id);
                              setCashDrawerRequestError(null);
                            }}
                            emptyLabel={tPayment('cashDrawer.selectPlaceholder')}
                          >
                            <CmxSelectDropdownTrigger className="w-full" dir={isRTL ? 'rtl' : 'ltr'}>
                              <CmxSelectDropdownValue
                                displayValue={
                                  selectedCashDrawerChoice
                                    ? `${getDrawerDisplayName(selectedCashDrawerChoice.drawer)} • ${selectedCashDrawerChoice.session.session_no}`
                                    : tPayment('cashDrawer.selectPlaceholder')
                                }
                                placeholder={tPayment('cashDrawer.selectPlaceholder')}
                              />
                            </CmxSelectDropdownTrigger>
                            <CmxSelectDropdownContent>
                              {cashDrawerSessionChoices.map(({ drawer, session }) => (
                                <CmxSelectDropdownItem key={session.id} value={session.id}>
                                  {`${getDrawerDisplayName(drawer)} • ${session.session_no}`}
                                </CmxSelectDropdownItem>
                              ))}
                            </CmxSelectDropdownContent>
                          </CmxSelectDropdown>
                        ) : selectedCashDrawerChoice ? (
                          <div className={`rounded-lg border border-cyan-200 bg-cyan-50/70 px-3 py-2 text-xs text-slate-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                            <span className="font-medium text-slate-900">
                              {getDrawerDisplayName(selectedCashDrawerChoice.drawer)}
                            </span>
                            {` • ${selectedCashDrawerChoice.session.session_no}`}
                          </div>
                        ) : null}

                        {cashDrawerBlockingMessage ? (
                          <div
                            role="alert"
                            aria-live="polite"
                            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
                          >
                            {cashDrawerBlockingMessage}
                          </div>
                        ) : null}

                        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <CmxButton
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void refetchCashDrawers()}
                            disabled={cashDrawersFetching}
                            className="rounded-lg"
                          >
                            {cashDrawersFetching ? (
                              <Loader2 className="me-1 h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="me-1 h-4 w-4" />
                            )}
                            {tPayment('cashDrawer.refresh')}
                          </CmxButton>
                          <CmxButton
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleOpenCashDrawerDialog}
                            disabled={!canOpenNewCashDrawerSession}
                            className="rounded-lg"
                          >
                            <Plus className="me-1 h-4 w-4" />
                            {tPayment('cashDrawer.openSession')}
                          </CmxButton>
                        </div>
                      </>
                    )}
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
              disabled={methodsLoading || !selectedMethod || needsResolution || cashDrawerBlocksSubmit}
              onClick={handleSubmit}
            >
              {t('submit')}
            </LoadingButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>

      <CmxDialog open={cashDrawerDialogOpen} onOpenChange={setCashDrawerDialogOpen}>
        <CmxDialogContent className="max-w-md">
          <CmxDialogHeader>
            <CmxDialogTitle>{tPayment('cashDrawer.dialogTitle')}</CmxDialogTitle>
          </CmxDialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{tPayment('cashDrawer.dialogDescription')}</p>

            {cashDrawerRequestError ? (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {cashDrawerRequestError}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>{tPayment('cashDrawer.drawerLabel')}</Label>
              <CmxSelectDropdown
                value={cashDrawerToOpenId}
                onValueChange={(value) => {
                  setCashDrawerToOpenId(value);
                  setCashDrawerRequestError(null);
                }}
                emptyLabel={tPayment('cashDrawer.drawerPlaceholder')}
              >
                <CmxSelectDropdownTrigger className="w-full" dir={isRTL ? 'rtl' : 'ltr'}>
                  <CmxSelectDropdownValue
                    displayValue={(() => {
                      const selectedDrawer = cashDrawers.find((drawer) => drawer.id === cashDrawerToOpenId);
                      return selectedDrawer
                        ? getDrawerDisplayName(selectedDrawer)
                        : tPayment('cashDrawer.drawerPlaceholder');
                    })()}
                    placeholder={tPayment('cashDrawer.drawerPlaceholder')}
                  />
                </CmxSelectDropdownTrigger>
                <CmxSelectDropdownContent>
                  {cashDrawers
                    .filter((drawer) => !drawer.currentSession)
                    .map((drawer) => (
                      <CmxSelectDropdownItem key={drawer.id} value={drawer.id}>
                        {getDrawerDisplayName(drawer)}
                      </CmxSelectDropdownItem>
                    ))}
                </CmxSelectDropdownContent>
              </CmxSelectDropdown>
            </div>

            <div className="space-y-2">
              <Label>{tPayment('cashDrawer.openingBalanceLabel')}</Label>
              <CmxMoneyField
                value={openingBalanceValue}
                decimalPlaces={decimalPlaces}
                showZero
                aria-label={tPayment('cashDrawer.openingBalanceLabel')}
                placeholder={formatAmount(0)}
                onValueChange={(value) => {
                  setOpeningBalanceValue(value);
                  setCashDrawerRequestError(null);
                }}
              />
            </div>
          </div>
          <CmxDialogFooter className={`flex gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <CmxButton type="button" variant="outline" onClick={() => setCashDrawerDialogOpen(false)}>
              {t('cancel')}
            </CmxButton>
            <LoadingButton
              loading={openingDrawerSession}
              disabled={openingDrawerSession || !cashDrawerToOpenId}
              onClick={() => void handleCreateCashDrawerSession()}
            >
              {tPayment('cashDrawer.openSession')}
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
        excessAmount={allocationExcessAmount}
        currencyCode={currencyCode}
        formatAmount={formatAmount}
        onSubmit={allocation.handleSubmitManualAllocation}
        isRTL={isRTL}
      />

      <PaymentExtraReceiptDialog
        open={extraReceiptDialogOpen}
        onOpenChange={setExtraReceiptDialogOpen}
        excessAmount={allocationExcessAmount}
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
