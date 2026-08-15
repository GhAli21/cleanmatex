'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Banknote, Loader2, Plus, RefreshCw } from 'lucide-react';
import { useRTL } from '@/lib/hooks/useRTL';
import { useHasPermissionCode } from '@/lib/hooks/usePermissions';
import { useCSRFToken, getCSRFHeader } from '@/lib/hooks/use-csrf-token';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { useAuth } from '@/lib/auth/auth-context';
import { computeCollectionOverpaymentMetrics } from '@/lib/payments/collection-overpayment';
import {
  capCollectPaymentAmount,
  resolvePaymentAmountCapReason,
  resolvePaymentOverpaymentPolicy,
} from '@/lib/payments/overpayment-policy';
import { PAYMENT_METHODS } from '@/lib/constants/payment';
import {
  OVERPAYMENT_RESOLUTION_PERMISSIONS,
  SETTLEMENT_MONEY_EPSILON,
} from '@/lib/constants/settlement-catalog';
import { CmxButton } from '@ui/primitives';
import { CmxInput, CmxTextarea, Label } from '@ui/primitives';
import { CmxMoneyField } from '@ui/primitives';
import { CmxSkeleton } from '@ui/primitives';
import { LoadingButton } from '@ui/primitives';
import { Badge } from '@ui/primitives/badge';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogDescription,
  CmxDialogFooter,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays';
import { CmxSelectDropdown, CmxSelectDropdownContent, CmxSelectDropdownItem, CmxSelectDropdownTrigger, CmxSelectDropdownValue } from '@ui/forms';
import { CmxChangeDueRow } from '@ui/data-display';
import { cmxMessage, CmxSummaryMessage } from '@ui/feedback';
import { usePayExtraCheckout } from '@features/orders/hooks/use-pay-extra-checkout';
import { useCashDrawer } from '@features/orders/hooks/use-cash-drawer';
import { ExtraReceiptHandlingCard } from '@features/orders/ui/payment-modal/allocation/extra-receipt-handling-card';
import { AutoAllocationPreviewDrawer } from '@features/orders/ui/payment-modal/allocation/auto-allocation-preview-drawer';
import { ManualAllocationDrawer } from '@features/orders/ui/payment-modal/allocation/manual-allocation-drawer';
import { buildOverpaymentResolutionPayload } from '@features/orders/ui/payment-modal/allocation/build-overpayment-resolution';
import { PayExtraTopStrip } from '@features/orders/ui/payment-modal/pay-extra/pay-extra-top-strip';
import { attemptPayExtraIntentChange } from '@features/orders/ui/payment-modal/pay-extra/attempt-pay-extra-intent-change';
import { PaymentValidateButton } from '@features/orders/ui/payment-modal/pay-extra/payment-validate-button';
import { PaymentExtraReceiptDialog } from '@features/orders/ui/payment-modal/pay-extra/payment-extra-receipt-dialog';
import { getExtraReceiptDestinationLabel } from '@features/orders/ui/payment-modal/allocation/extra-receipt-resolution-summary';
import {
  PaymentQuickTenderChips,
  type PaymentQuickTenderChipItem,
} from '@features/orders/ui/payment-modal/quick-tender-chips';
import { deriveQuickTenderChips } from '@features/orders/ui/payment-modal-v4.utils';
import type { CheckoutSettlementOption } from '@features/orders/hooks/use-payment-catalog';
import { ensurePaymentLegRefs } from '@/lib/payments/ensure-payment-leg-refs';
import { POS_SESSION_STATUS } from '@/lib/constants/pos-session';
import type { GetMyActivePosSessionResult } from '@/lib/types/pos-session';

/**
 * Collect-payment view of a checkout settlement option.
 *
 * Built on the shared {@link CheckoutSettlementOption} rather than a local
 * hand-listed subset. The old local interface omitted `requires_reference` and
 * `requires_terminal`, which is precisely why this modal could post a CHECK or
 * BANK_TRANSFER collection with no reference — the fields were never in the
 * client's type, so nothing could render or validate them.
 *
 * The *type* is reused without adopting `usePaymentCatalog`'s fetching: that
 * hook maps a non-ok response to an empty option list, which would silently
 * undo this modal's load-error + Retry surface. See the Phase 4 note in
 * `docs/features/Order_Fin/Collect_Payment_Enhancement/STATUS.md`.
 */
type CheckoutMethodOption = CheckoutSettlementOption & {
  /** B31: D9-configured creation status — an *explicit* override only, often null. */
  default_creation_status?: string | null;
  /**
   * The status the payment will actually be created with, resolved server-side
   * through the full D9 fallback chain. Drives the "pending until verified"
   * notice — see `willBePending`.
   */
  resolved_creation_status?: string | null;
};

type PosSessionApiEnvelope = {
  success?: boolean;
  data?: GetMyActivePosSessionResult;
  error?: string;
};

async function fetchActivePosSessionForBranch(branchId: string): Promise<GetMyActivePosSessionResult | null> {
  const params = new URLSearchParams({ branchId });
  const response = await fetch(`/api/v1/pos-sessions/my-active?${params.toString()}`, {
    credentials: 'include',
  });
  const payload = (await response.json().catch(() => ({}))) as PosSessionApiEnvelope;
  if (response.status === 404 || payload.data?.type === 'NONE') {
    return null;
  }
  if (!response.ok || payload.success === false) {
    return null;
  }
  return payload.data ?? null;
}

/**
 * Reads the order's current outstanding balance from the canonical financial
 * snapshot.
 *
 * Returns `null` rather than throwing when the read fails: a stale prefill is a
 * usability problem, not a reason to block a collection the server would still
 * accept and validate on its own.
 *
 * @param orderId Order whose outstanding balance to read.
 * @returns The authoritative outstanding amount, or `null` when unavailable.
 */
async function fetchAuthoritativeOutstanding(orderId: string): Promise<number | null> {
  const response = await fetch(`/api/v1/orders/${orderId}/state`, { credentials: 'include' });
  if (!response.ok) return null;
  const payload = (await response.json().catch(() => null)) as
    | { success?: boolean; paymentSummary?: { remaining?: number } }
    | null;
  if (!payload?.success) return null;
  const remaining = payload.paymentSummary?.remaining;
  return typeof remaining === 'number' && Number.isFinite(remaining) ? remaining : null;
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
  /**
   * Opens a receipt for the collection just recorded.
   *
   * Optional by design: only the Ready detail screen has print infrastructure
   * (`openPrintPreview` + its preview iframe). The Delivery list and the order
   * Financial tab omit it and the control simply does not render — the modal
   * never infers which surface it is on.
   */
  onPrintReceipt?: () => void;
  /**
   * Set when the dialog was opened to unblock a customer handover, so the CTA
   * can say so. Ready-only; the other surfaces have no handover step.
   */
  handoverIntent?: boolean;
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
  onPrintReceipt,
  handoverIntent = false,
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
  const activePosSessionQuery = useQuery({
    queryKey: ['pos-sessions', 'collect-payment', branchId ?? 'none'],
    enabled: open && canCollect && !!branchId,
    queryFn: () => fetchActivePosSessionForBranch(branchId!),
    staleTime: 30_000,
  });

  // The `outstandingAmount` prop is whatever the *parent* last read, and the
  // three mount surfaces differ in how fresh that is — the Delivery list passes
  // a row value that can be minutes old, so another till collecting meanwhile
  // leaves this dialog prefilled with a balance that no longer exists. The
  // server is safe either way (`collectPaymentTx` locks the order FOR UPDATE and
  // re-checks outstanding), but the cashier would see a wrong number and then an
  // opaque rejection. Re-read the authoritative figure on open; `/state` is
  // tenant-scoped and needs no permission beyond the session, unlike
  // `financial-summary` which requires `orders:view_financial_breakdown` that a
  // till user may legitimately lack.
  const outstandingQuery = useQuery({
    queryKey: ['order-outstanding', 'collect-payment', orderId],
    enabled: open && canCollect && !!orderId,
    queryFn: () => fetchAuthoritativeOutstanding(orderId),
    staleTime: 0,
    gcTime: 0,
  });
  const authoritativeOutstanding = outstandingQuery.data ?? null;
  /** Server truth once loaded; the parent's value until then. */
  const effectiveOutstanding = authoritativeOutstanding ?? outstandingAmount;

  const [methods, setMethods] = useState<CheckoutMethodOption[]>([]);
  const [methodsLoading, setMethodsLoading] = useState(false);
  const [methodsError, setMethodsError] = useState<string | null>(null);
  /** Bumped by Retry to re-run the catalog fetch without closing the dialog. */
  const [methodsReloadToken, setMethodsReloadToken] = useState(0);
  const [selectedMethodId, setSelectedMethodId] = useState('');
  const [amount, setAmount] = useState(outstandingAmount);
  const [cashTendered, setCashTendered] = useState<number | undefined>(undefined);
  const [amountCapHint, setAmountCapHint] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /**
   * Per-method proof-of-receipt fields. The service and voucher wiring have
   * always persisted these; until now there was no UI (and no route contract)
   * to supply them, so non-cash collections were unreconcilable.
   */
  const [reference, setReference] = useState('');
  const [checkNumber, setCheckNumber] = useState('');
  const [checkBank, setCheckBank] = useState('');
  const [checkDate, setCheckDate] = useState('');
  /** Free-text note persisted to `org_order_payments_dtl.rec_notes`. */
  const [notes, setNotes] = useState('');
  /**
   * Submit failure kept on screen. A toast alone is wrong for a money action —
   * it disappears before the cashier can read, let alone act on, the reason.
   */
  const [submitError, setSubmitError] = useState<string | null>(null);
  /**
   * True once the cashier edits the amount. Gates whether a late authoritative
   * balance may re-prefill the field: overwriting typed money would be a silent
   * mutation (CRITICAL RULE #15), so once dirty we only *tell* them it moved.
   */
  const [amountDirty, setAmountDirty] = useState(false);
  // Stable UUID for the cash leg — threaded into RETURN_CASH_CHANGE resolution
  // payloads. Regenerated per dialog-open alongside `idempotencyKey` below: one
  // dialog session is one logical cash leg.
  const [cashLegRef, setCashLegRef] = useState<string>(() => crypto.randomUUID());
  // B5/D010: generated once per dialog-open (reset alongside amount/cashTendered
  // below) so a network retry of THIS attempt reuses the same key — the server
  // then replays the original result instead of double-collecting — while a
  // genuinely new collection (dialog reopened) gets a fresh key.
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => crypto.randomUUID());

  const selectedMethod = methods.find((m) => m.id === selectedMethodId);
  const isCash = selectedMethod?.payment_method_code === PAYMENT_METHODS.CASH;
  const cashDrawerRequired = !!selectedMethod?.requires_cash_drawer;
  // B31: now driven by the SERVER-resolved status, so a method that reaches
  // PENDING through the D9 fallback chain (rather than an explicit override) is
  // surfaced too. The previous check read `default_creation_status` — an explicit
  // override only — so e.g. a BANK_TRANSFER inheriting PENDING silently told the
  // cashier the order would be fully paid. Falls back to the old field for
  // resilience if an older API response lacks the resolved value.
  const willBePending =
    (selectedMethod?.resolved_creation_status ?? selectedMethod?.default_creation_status) ===
    'PENDING';

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

  // Mirrors the server's CASH_TENDERED_LESS_THAN_AMOUNT guard so the cashier is
  // told at entry time instead of on a rejected submit. Replaces the old
  // `min={amount}` attribute on the tendered input, which only drove native form
  // validation this dialog never invoked — it blocked nothing in practice.
  const cashTenderedBelowAmount =
    isCash && cashTendered != null && cashTendered + SETTLEMENT_MONEY_EPSILON < amount;

  const isCheck = selectedMethod?.payment_method_code === PAYMENT_METHODS.CHECK;
  /**
   * `requires_reference` comes from the method's D9 config. A CHECK satisfies it
   * with its check number, everything else with the generic reference field.
   */
  const referenceMissing =
    !!selectedMethod?.requires_reference &&
    (isCheck ? checkNumber.trim().length === 0 : reference.trim().length === 0);

  // Balance left on the order if this collection goes through as entered.
  // Partial later collection is allowed (ADR-022), so the cashier taking part of
  // a balance previously had to work the remainder out in their head.
  const remainingAfterPayment = Math.max(0, effectiveOutstanding - amount);

  // formatMoneyWithCode takes only the amount (tenant currency); the modal
  // strips the code to render a bare number. Passing currencyCode as a 2nd arg
  // was a no-op (ignored at runtime) and a tsc error — drop it.
  const formatAmount = useCallback(
    (value: number) => formatMoneyWithCode(value).replace(currencyCode, '').trim(),
    [currencyCode, formatMoneyWithCode]
  );

  // One-tap cash denominations for the tendered field. Same pure deriver the
  // new-order POS faces use, so the chip policy (round-ups + notes, deduped
  // against exact, currency-aware) stays in one place.
  const quickTenderItems = useMemo<PaymentQuickTenderChipItem[]>(() => {
    if (!isCash) return [];
    return deriveQuickTenderChips({
      remaining: amount,
      currencyCode,
      decimalPlaces,
      isCash: true,
      epsilon: SETTLEMENT_MONEY_EPSILON,
      includeExact: false,
    }).map((chip) => ({
      ...chip,
      label: formatAmount(chip.tenderAmount ?? 0),
      ariaLabel: tPayment('quickTender.tenderAria', {
        amount: `${currencyCode} ${formatAmount(chip.tenderAmount ?? 0)}`,
      }),
    }));
  }, [amount, currencyCode, decimalPlaces, formatAmount, isCash, tPayment]);

  const legacyOverpaymentMetrics = useMemo(() => {
    if (!selectedMethod) {
      return { unresolvedExcessAmount: 0, excessAmount: 0, canReturnChangeFromCash: false };
    }
    return computeCollectionOverpaymentMetrics(effectiveOutstanding, [
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
  }, [amount, cashTendered, isCash, effectiveOutstanding, selectedMethod]);

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
    saleTotal: effectiveOutstanding,
    immediateSettlementAmount: amount,
    legs: checkoutLegs,
    primaryCashLegRef: isCash ? cashLegRef : null,
    receiptAmount: amount,
    currentOrderAllocationAmount: Math.min(amount, effectiveOutstanding),
    // Later collection of an order receivable is an order-scoped payment (sourceOrderId
    // is set), so it posts under the order-payment voucher source — the only order-scoped
    // value the auto-allocation schema accepts (CUSTOMER_RECEIPT is account-level).
    sourceType: 'ORDER_PAYMENT_MODAL',
    sourceOrderId: orderId,
    paymentMethodCode: selectedMethod?.payment_method_code ?? PAYMENT_METHODS.CASH,
    moneyEpsilon: SETTLEMENT_MONEY_EPSILON,
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

  const handleCollectAmountChange = useCallback(
    (raw: number) => {
      if (!selectedMethod) {
        setAmount(raw);
        setAmountCapHint(null);
        return;
      }
      const capped = capCollectPaymentAmount({
        rawAmount: raw,
        outstandingAmount: effectiveOutstanding,
        payExtraIntent,
        paymentMethodCode: selectedMethod.payment_method_code,
        supportsChangeReturn: selectedMethod.supports_change_return,
        supportsOverpayment: selectedMethod.supports_overpayment,
        decimalPlaces,
      });
      setAmount(capped);
      if (capped + SETTLEMENT_MONEY_EPSILON < raw) {
        const policy = resolvePaymentOverpaymentPolicy({
          paymentMethodCode: selectedMethod.payment_method_code,
          supportsChangeReturn: selectedMethod.supports_change_return,
          supportsOverpayment: selectedMethod.supports_overpayment,
        });
        const reason = resolvePaymentAmountCapReason({
          wasCapped: true,
          payExtraIntent,
          policy,
        });
        const max = formatMoneyWithCode(capped);
        if (reason === 'cash_no_change') {
          setAmountCapHint(
            tPayment('splitPayment.validation.cashOverRemainingNotAllowed', { max })
          );
        } else if (reason === 'method_no_overpayment') {
          setAmountCapHint(tPayment('payExtraIntent.cappedMethodNoOverpayment', { max }));
        } else {
          setAmountCapHint(tPayment('payExtraIntent.cappedAtRemaining', { max }));
        }
      } else {
        setAmountCapHint(null);
      }
    },
    [
      decimalPlaces,
      formatMoneyWithCode,
      effectiveOutstanding,
      payExtraIntent,
      selectedMethod,
      tPayment,
    ]
  );

  const overpaymentMetrics = useMemo(() => {
    if (!selectedMethod) {
      return { unresolvedExcessAmount: 0, excessAmount: 0, canReturnChangeFromCash: false };
    }
    return computeCollectionOverpaymentMetrics(
      effectiveOutstanding,
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
  }, [amount, cashTendered, isCash, effectiveOutstanding, payExtraIntent, selectedMethod]);

  const unresolvedExcess = payExtraIntent
    ? payExtra.unresolvedExcessAmount
    : overpaymentMetrics.unresolvedExcessAmount;

  const allocationExcessAmount = payExtraIntent
    ? payExtra.extraReceiptDialogExcessAmount
    : unresolvedExcess;

  const overpaymentResolution = payExtra.overpaymentResolutionPayload;

  const needsResolution = payExtra.overpaymentBlocksSubmit;

  // Strip mirror displays off the PRE-resolution excess (persists after
  // routing); `unresolvedExcess` zeroes on resolution, which hid the emerald
  // "resolved" state (QA §6.7). Destination label appears once routed.
  const stripExtraAmount = allocationExcessAmount;
  const stripDestinationLabel = useMemo(() => {
    if (!overpaymentResolution || stripExtraAmount <= SETTLEMENT_MONEY_EPSILON) {
      return null;
    }
    return getExtraReceiptDestinationLabel(allocation.extraReceiptMode, tPayment);
  }, [
    allocation.extraReceiptMode,
    overpaymentResolution,
    stripExtraAmount,
    tPayment,
  ]);

  const handlePayExtraIntentAttempt = useCallback(
    (next: boolean) => {
      attemptPayExtraIntentChange({
        next,
        current: payExtraIntent,
        canEnablePayExtra,
        canAllocateOverpayment: canAllocate,
        excessAmount: unresolvedExcess,
        moneyEpsilon: SETTLEMENT_MONEY_EPSILON,
        setPayExtraIntent,
        messages: {
          permissionRequired: tPayment('payExtraIntent.permissionRequired', {
            permissionName: tPayment('payExtraIntent.permissionNameAllocate'),
            permissionCode: tPayment('payExtraIntent.permissionCodeAllocate'),
          }),
          cannotDisableWhileExtra: tPayment('payExtraIntent.cannotDisableWhileExtra'),
          disabledNoMethods: tPayment('payExtraIntent.disabledNoMethods'),
        },
      });
    },
    [
      canAllocate,
      canEnablePayExtra,
      payExtraIntent,
      setPayExtraIntent,
      tPayment,
      unresolvedExcess,
    ]
  );

  const payExtraStripAriaDisabled =
    canEnablePayExtra &&
    ((!canAllocate && !payExtraIntent) ||
      (payExtraIntent && unresolvedExcess > SETTLEMENT_MONEY_EPSILON));

  // Open-transition reset — done at render time (react-effects-patterns.md §2,
  // Pattern A) rather than in an effect, so it neither trips
  // `react-hooks/set-state-in-effect` nor needs a dep array to stay honest.
  //
  // Narrowing this to the open transition (the effect it replaces ran on
  // `[open, outstandingAmount]`) also closes a no-silent-money-mutation gap
  // (CRITICAL RULE #15): a parent refetch that moved `outstandingAmount` while
  // the dialog was open used to overwrite an amount the cashier had already
  // typed, with no explanation.
  //
  // The mount surfaces differ — Ready and the Orders Financial tab keep this
  // component mounted and toggle `open`, while the Delivery list renders it
  // per row and unmounts on close — so a Delivery "reopen" is a fresh mount
  // that takes these values from the useState initialisers instead. Both
  // shapes must land on the same state; keep that true for any state added here.
  // Declared before the reset block below, which assigns it — a `const` binding
  // referenced above its declaration would be a temporal-dead-zone throw.
  const [reconciledOutstanding, setReconciledOutstanding] = useState<number | null>(null);

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setAmount(outstandingAmount);
      setCashTendered(undefined);
      setIdempotencyKey(crypto.randomUUID());
      setCashLegRef(crypto.randomUUID());
      setAmountDirty(false);
      setSubmitError(null);
      setMethodsError(null);
      setReference('');
      setCheckNumber('');
      setCheckBank('');
      setCheckDate('');
      setNotes('');
      // Cleared so the reconcile below re-applies for this session even when the
      // authoritative figure is unchanged from the previous open.
      setReconciledOutstanding(null);
      payExtra.resetPayExtraState();
    }
  }

  // Late-arriving server truth. Re-prefill only while the field is untouched;
  // once the cashier has typed, the figure is theirs and we merely surface that
  // the balance moved (CRITICAL RULE #15 — never rewrite entered money silently).
  if (
    open &&
    authoritativeOutstanding != null &&
    reconciledOutstanding !== authoritativeOutstanding
  ) {
    setReconciledOutstanding(authoritativeOutstanding);
    if (!amountDirty) {
      setAmount(authoritativeOutstanding);
    }
  }

  /**
   * True when the parent's figure was stale — drives the visible explanation.
   * Compared against the prop (what the cashier was shown before opening).
   */
  const outstandingWasStale =
    authoritativeOutstanding != null &&
    Math.abs(authoritativeOutstanding - outstandingAmount) > SETTLEMENT_MONEY_EPSILON;

  useEffect(() => {
    if (!open || !canCollect) return;
    let cancelled = false;
    setMethodsLoading(true);
    setMethodsError(null);
    const params = new URLSearchParams();
    // Fee/limit-eligible methods can depend on the amount, so ask against the
    // authoritative balance rather than the parent's possibly-stale figure.
    params.set('amount', String(effectiveOutstanding));
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
        if (cancelled) return;
        setMethods(eligible);
        setMethodsError(null);
        if (eligible[0]) setSelectedMethodId(eligible[0].id);
      })
      .catch((err) => {
        if (cancelled) return;
        // Kept on screen (with Retry) instead of toast-only: a vanished toast
        // left the cashier with an empty method list and no way back.
        setMethodsError(err instanceof Error ? err.message : t('loadMethodsError'));
        setMethods([]);
      })
      .finally(() => {
        if (!cancelled) setMethodsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    open,
    canCollect,
    effectiveOutstanding,
    branchId,
    customerId,
    csrfToken,
    methodsReloadToken,
    t,
  ]);

  const handleSubmit = async () => {
    if (!selectedMethod || amount <= 0) return;
    if (needsResolution) {
      cmxMessage.error(
        payExtraIntent && validationPhase !== 'ready'
          ? tPayment('validatePayment.requiredBeforeSubmit')
          : t('resolutionRequired')
      );
      return;
    }
    if (cashDrawerBlocksSubmit) {
      cmxMessage.error(cashDrawerBlockingMessage ?? tPayment('cashDrawer.messages.noOpenSession'));
      return;
    }
    if (cashTenderedBelowAmount) {
      cmxMessage.error(t('cashTenderedBelowAmount', { amount: formatMoneyWithCode(amount) }));
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const legsWithRefs = ensurePaymentLegRefs([
        {
          method: selectedMethod.payment_method_code as 'CASH',
          amount,
          ...(isCash && cashTendered != null ? { cashTendered } : {}),
          // Seed the stable per-dialog-open ref (`cashLegRef`, declared above) so
          // `ensurePaymentLegRefs` preserves it instead of minting a new one. The
          // pay-extra path already resolves RETURN_CASH_CHANGE against that same
          // ref via `primaryCashLegRef`; previously this block generated a fresh
          // UUID into a shadowing local, so the two paths named different legs.
          ...(isCash ? { legRef: cashLegRef } : {}),
        },
      ]);
      const submitCashLegRef = legsWithRefs.find(
        (leg) => leg.method === PAYMENT_METHODS.CASH
      )?.legRef;
      const submitResolution =
        payExtra.overpaymentResolutionPayload ??
        buildOverpaymentResolutionPayload(
          allocation.extraReceiptMode,
          unresolvedExcess,
          {
            allocationPreviewId: allocation.allocationPreviewId,
            cashLegRef: submitCashLegRef,
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
              // Only send what the selected method actually collects, so a
              // method switch cannot smuggle a stale reference from a previous
              // selection onto the payment record.
              ...(!isCash && !isCheck && reference.trim() ? { reference: reference.trim() } : {}),
              ...(isCheck && checkNumber.trim() ? { checkNumber: checkNumber.trim() } : {}),
              ...(isCheck && checkBank.trim() ? { checkBank: checkBank.trim() } : {}),
              ...(isCheck && checkDate ? { checkDate } : {}),
            },
          ],
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          customerId: customerId ?? undefined,
          ...(cashDrawerRequired && selectedCashDrawerSessionId
            ? { cashDrawerSessionId: selectedCashDrawerSessionId }
            : {}),
          ...(activePosSessionQuery.data?.type === 'ACTIVE' &&
          activePosSessionQuery.data.session.status === POS_SESSION_STATUS.OPEN
            ? { posSessionId: activePosSessionQuery.data.session.id }
            : {}),
          ...(submitResolution ? { overpaymentResolution: submitResolution } : {}),
          // B5/D010: stable per-attempt key (generated at dialog-open, see the
          // reset effect above) — a network retry of this same attempt reuses
          // it so the server replays the original result instead of double-collecting.
          idempotencyKey,
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
                ? tPayment('cashDrawer.messages.noOpenSession')
                : errorCode === 'IDEMPOTENCY_CONFLICT'
                  ? t('idempotencyConflict')
                  : null;
        throw new Error(mapped ?? json.error ?? t('submitError'));
      }
      cmxMessage.success(t('success'));
      onOpenChange(false);
      onCollected?.();
      // Closes B04's deferred receipt gap. Fired after `onCollected` so the
      // parent has already refreshed and the receipt reflects this payment.
      onPrintReceipt?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('submitError');
      // Both surfaces: the toast for immediacy, the inline banner so the reason
      // survives long enough to be read and acted on.
      setSubmitError(message);
      cmxMessage.error(message);
      // The balance is the most common reason a collection is refused, so pull
      // server truth again — this is what turns an opaque 422 into "it moved to X".
      void outstandingQuery.refetch();
    } finally {
      setSubmitting(false);
    }
  };

  if (!canCollect) {
    return null;
  }

  /** Single source for the footer button and the Enter-to-submit shortcut. */
  const submitDisabled =
    methodsLoading ||
    !!methodsError ||
    !selectedMethod ||
    needsResolution ||
    cashDrawerBlocksSubmit ||
    cashTenderedBelowAmount ||
    referenceMissing;

  const requiredMark = (
    <span className="text-red-500" aria-hidden="true">
      {' '}
      *
    </span>
  );

  return (
    <>
      <CmxDialog
        open={open}
        onOpenChange={(next) => {
          // Ignore close attempts mid-request: the collection is already in
          // flight and unmounting here would strand the cashier with no result.
          if (submitting && !next) return;
          onOpenChange(next);
        }}
      >
        <CmxDialogContent
          className="max-w-lg"
          // Enter submits from anywhere in the form, matching till expectations.
          // Guarded by the same disable conditions as the footer button, and
          // skipped inside textareas / on the method dropdown so it never
          // hijacks a component's own Enter handling.
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.defaultPrevented) return;
            const target = event.target as HTMLElement | null;
            if (target?.tagName === 'TEXTAREA' || target?.getAttribute('role') === 'combobox') {
              return;
            }
            if (submitDisabled || submitting) return;
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <CmxDialogHeader>
            <CmxDialogTitle>{t('title')}</CmxDialogTitle>
            {/* Gives the dialog an aria-describedby target; previously it had a
                title only, so assistive tech announced no purpose. */}
            <CmxDialogDescription>{t('dialogDescription')}</CmxDialogDescription>
          </CmxDialogHeader>

          <PayExtraTopStrip
            checked={payExtraIntent}
            onAttemptChange={handlePayExtraIntentAttempt}
            disabled={!canEnablePayExtra}
            disabledReason={
              !canEnablePayExtra ? tPayment('payExtraIntent.disabledNoMethods') : undefined
            }
            ariaDisabled={payExtraStripAriaDisabled}
            isRTL={isRTL}
            extraAmountLabel={
              stripExtraAmount > SETTLEMENT_MONEY_EPSILON
                ? formatMoneyWithCode(stripExtraAmount)
                : null
            }
            extraDestinationLabel={stripDestinationLabel}
            extraUnresolved={
              stripExtraAmount > SETTLEMENT_MONEY_EPSILON && !overpaymentResolution
            }
            extraResolved={
              stripExtraAmount > SETTLEMENT_MONEY_EPSILON && Boolean(overpaymentResolution)
            }
          />

          <div className="space-y-4 py-2">
            <div className={`rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>
              <div className={`flex items-baseline justify-between gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className="text-sm text-muted-foreground">{t('outstandingLabel')}</span>
                <span className="text-lg font-bold tabular-nums text-slate-900">
                  {formatMoneyWithCode(effectiveOutstanding)}
                </span>
              </div>
            </div>

            {/* The balance moved between the parent's read and this dialog. Never
                a silent correction (CRITICAL RULE #15): say what it is now, and
                say whether the amount field was touched. */}
            {outstandingWasStale ? (
              <CmxSummaryMessage
                type="warning"
                title={t('balanceChangedTitle')}
                items={[
                  amountDirty
                    ? t('balanceChangedKeepEntry', {
                        amount: formatMoneyWithCode(effectiveOutstanding),
                      })
                    : t('balanceRefreshed', {
                        amount: formatMoneyWithCode(effectiveOutstanding),
                      }),
                ]}
              />
            ) : null}

            {handoverIntent ? (
              <p className={`text-xs text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('handoverHint')}
              </p>
            ) : null}

            {submitError ? (
              <CmxSummaryMessage type="error" title={t('submitError')} items={[submitError]} />
            ) : null}

            {methodsLoading ? (
              <div className="space-y-3">
                <CmxSkeleton className="h-10 w-full" />
                <CmxSkeleton className="h-10 w-full" />
              </div>
            ) : methodsError ? (
              /* Recoverable in place — the old behaviour toasted and left an
                 empty dropdown with no way back short of closing the dialog. */
              <div className="space-y-2">
                <CmxSummaryMessage
                  type="error"
                  title={t('loadMethodsError')}
                  items={[methodsError]}
                />
                <CmxButton
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMethodsReloadToken((token) => token + 1)}
                >
                  <RefreshCw className="me-1 h-4 w-4" />
                  {t('loadMethodsRetry')}
                </CmxButton>
              </div>
            ) : methods.length === 0 ? (
              <CmxSummaryMessage
                type="info"
                title={t('noMethodsTitle')}
                items={[t('noMethodsDescription')]}
              />
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
                      onClick={() => {
                        setAmountDirty(true);
                        setAmount(effectiveOutstanding);
                      }}
                    >
                      {t('fullOutstanding')}
                    </CmxButton>
                  </div>
                  {/* CmxMoneyField (not a raw number input): it sanitises the draft
                      to the tenant's decimal places, so a 2-decimal tenant can no
                      longer enter a third decimal the server would silently round,
                      and it avoids `type="number"`'s scroll-wheel mutation of a
                      focused money field. */}
                  <CmxMoneyField
                    id="collect-amount"
                    value={amount}
                    decimalPlaces={decimalPlaces}
                    showZero
                    min={0}
                    autoFocus
                    aria-required="true"
                    onValueChange={(value) => {
                      setAmountDirty(true);
                      handleCollectAmountChange(value);
                    }}
                  />
                  {amountCapHint ? (
                    <p className="text-xs text-amber-700" role="status">
                      {amountCapHint}
                    </p>
                  ) : null}
                </div>

                {isCash ? (
                  <div className="space-y-2">
                    <Label htmlFor="collect-tendered">{t('cashTendered')}</Label>
                    {/* No `min` clamp here: tendered below the amount must stay
                        *enterable* so the existing validation can explain it —
                        silently snapping it up to `amount` would be a money value
                        rewritten behind the cashier's back (CRITICAL RULE #15). */}
                    <CmxMoneyField
                      id="collect-tendered"
                      value={cashTendered ?? amount}
                      decimalPlaces={decimalPlaces}
                      showZero
                      onValueChange={(value) => setCashTendered(value)}
                      aria-invalid={cashTenderedBelowAmount || undefined}
                      aria-describedby={
                        cashTenderedBelowAmount ? 'collect-tendered-error' : undefined
                      }
                    />
                    {/* One tap instead of typing the note the customer handed
                        over. Sets tendered only — never the amount — so this is
                        an explicit user action, not a money side effect (#15). */}
                    <PaymentQuickTenderChips
                      items={quickTenderItems}
                      onSelect={(item) => setCashTendered(item.tenderAmount ?? amount)}
                      disabled={submitting}
                      isRTL={isRTL}
                    />
                    {cashTenderedBelowAmount ? (
                      <p
                        id="collect-tendered-error"
                        role="alert"
                        className="text-xs text-red-600"
                      >
                        {t('cashTenderedBelowAmount', {
                          amount: formatMoneyWithCode(amount),
                        })}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {/* Proof-of-receipt fields. Rendered per method: a check gets its
                    own number/bank/date, anything non-cash gets the generic
                    reference. Without these the collection posts with no trace
                    the back office can reconcile against a bank statement. */}
                {isCheck ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 space-y-2">
                      <Label htmlFor="collect-check-number">
                        {t('checkNumber')}
                        {selectedMethod?.requires_reference ? requiredMark : null}
                      </Label>
                      <CmxInput
                        id="collect-check-number"
                        value={checkNumber}
                        aria-required={selectedMethod?.requires_reference || undefined}
                        aria-invalid={referenceMissing || undefined}
                        onChange={(event) => setCheckNumber(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="collect-check-bank">{t('checkBank')}</Label>
                      <CmxInput
                        id="collect-check-bank"
                        value={checkBank}
                        onChange={(event) => setCheckBank(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="collect-check-date">{t('checkDate')}</Label>
                      <CmxInput
                        id="collect-check-date"
                        type="date"
                        value={checkDate}
                        onChange={(event) => setCheckDate(event.target.value)}
                      />
                    </div>
                  </div>
                ) : !isCash ? (
                  <div className="space-y-2">
                    <Label htmlFor="collect-reference">
                      {t('reference')}
                      {selectedMethod?.requires_reference ? requiredMark : null}
                    </Label>
                    <CmxInput
                      id="collect-reference"
                      value={reference}
                      placeholder={t('referencePlaceholder')}
                      aria-required={selectedMethod?.requires_reference || undefined}
                      aria-invalid={referenceMissing || undefined}
                      onChange={(event) => setReference(event.target.value)}
                    />
                  </div>
                ) : null}

                {referenceMissing ? (
                  <p className="text-xs text-red-600" role="alert">
                    {t('referenceRequired')}
                  </p>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor="collect-notes">{t('notes')}</Label>
                  <CmxTextarea
                    id="collect-notes"
                    value={notes}
                    rows={2}
                    maxLength={500}
                    placeholder={t('notesPlaceholder')}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                </div>

                {willBePending ? (
                  <div
                    role="status"
                    aria-live="polite"
                    className={`rounded-lg border border-cyan-200 bg-cyan-50/70 px-3 py-2 text-xs text-cyan-800 ${isRTL ? 'text-right' : 'text-left'}`}
                  >
                    {t('pendingUntilVerified')}
                  </div>
                ) : null}

                {/* Partial collection is allowed (ADR-022), so show what the
                    order still owes rather than making the cashier subtract. */}
                {remainingAfterPayment > SETTLEMENT_MONEY_EPSILON ? (
                  <div
                    role="status"
                    aria-live="polite"
                    className={`flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-sm ${isRTL ? 'flex-row-reverse' : ''}`}
                  >
                    <span className="text-amber-700">{t('remainingAfterPayment')}</span>
                    <span className="font-semibold tabular-nums text-amber-800">
                      {formatMoneyWithCode(remainingAfterPayment)}
                    </span>
                  </div>
                ) : null}

                {isCash ? (
                  <CmxChangeDueRow
                    label={t('changeDue')}
                    amount={changeDue}
                    formattedAmount={formatMoneyWithCode(changeDue)}
                    epsilon={SETTLEMENT_MONEY_EPSILON}
                    isRTL={isRTL}
                    size="lg"
                    amountTestId="collect-change-due"
                  />
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

                {payExtraIntent &&
                stripExtraAmount > SETTLEMENT_MONEY_EPSILON &&
                !overpaymentResolution ? (
                  <PaymentValidateButton
                    onClick={runValidatePayment}
                    disabled={!canEnablePayExtra}
                    isRTL={isRTL}
                    className="w-full"
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
              disabled={submitDisabled}
              onClick={handleSubmit}
            >
              {handoverIntent ? t('submitAndRelease') : t('submit')}
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
            cmxMessage.error(tPayment('validatePayment.requiredBeforeSubmit'));
          }
        }}
        onBack={() => setExtraReceiptDialogOpen(false)}
        confirmDisabled={!overpaymentResolution}
        isRTL={isRTL}
      />
    </>
  );
}
