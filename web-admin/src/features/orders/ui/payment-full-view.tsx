'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useFocusTrap } from '@/lib/hooks/use-focus-trap';
import { Controller, type FieldErrors, type UseFormReturn } from 'react-hook-form';
import type { Control } from 'react-hook-form';
import {
  X, CreditCard, Banknote, Package, FileText, CheckSquare,
  Loader2,
  Eye, EyeOff, Maximize2, Trash2, Wallet, UserRound,
  ArrowRightLeft, ShieldCheck, CircleAlert, EllipsisVertical, Plus, Info, RefreshCw,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRTL } from '@/lib/hooks/useRTL';
import { getPaymentFormSchema, type PaymentFormData } from '@features/orders/model/payment-form-schema';
import {
  newOrderPaymentPayloadSchema, 
  type NewOrderPaymentPayload,
  type OutstandingPolicy,
  type PaymentLeg,
} from '@/lib/validations/new-order-payment-schemas';
import { CmxConfirmDialog, CmxSummaryMessage, cmxMessage } from '@ui/feedback';
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';
import { NEW_ORDER_PROMO_GIFT_DISABLED } from '@/lib/constants/order-checkout-flags';
import { PAYMENT_METHODS } from '@/lib/constants/order-types';
import type { PaymentMethodCode } from '@/lib/constants/order-types';
import {
  applyKeypadInput,
  deriveOutstandingPolicy,
  formatDecimalDraft,
  getDisplayChangeAmount,
  getRemainingToAllocate,
  getSuggestedDefaultLegAmount,
  getSuggestedStoredValueAmount,
  todayYyyyMmDd,
  validateCheckDueDate,
  legHasRequiredPaymentReference,
  deriveLegAppliedAmount,
  deriveQuickTenderChips,
  PAYMENT_MODAL_MODE,
  isLegOnSimpleFace,
  resolveSimpleFaceActiveLegIndex,
  isB2BCreditLimitBlocking,
  type PaymentModalMode,
  type PaymentKeypadKey,
} from './payment-modal-v4.utils';
import {
  PaymentQuickTenderChips,
  type PaymentQuickTenderChipItem,
} from './payment-modal/quick-tender-chips';
import { PaymentModeToggle } from './payment-modal/payment-mode-toggle';
import { SummaryRow } from './payment-modal/summary-row';
import {
  OrderValueBreakdownPanel,
  type OrderValueBreakdownModel,
  type OrderValueBreakdownRow,
} from './payment-modal/order-value-breakdown-panel';
import { PaymentDockedSummaryBar } from './payment-modal/docked-summary-bar';
import { PaymentSimpleView } from './payment-simple-view';
import { PaymentModalV4CreditNotePicker } from './payment-modal-v4-credit-note-picker';
import {
  ExtraReceiptHandlingCard,
} from './payment-modal/allocation/extra-receipt-handling-card';
import { getExtraReceiptResolutionSummary, getExtraReceiptDestinationLabel } from './payment-modal/allocation/extra-receipt-resolution-summary';
import { AutoAllocationPreviewDrawer } from './payment-modal/allocation/auto-allocation-preview-drawer';
import { ManualAllocationDrawer } from './payment-modal/allocation/manual-allocation-drawer';
import { OVERPAYMENT_RESOLUTIONS } from '@/lib/constants/settlement-catalog';
import { PayExtraTopStrip } from './payment-modal/pay-extra/pay-extra-top-strip';
import { attemptPayExtraIntentChange } from './payment-modal/pay-extra/attempt-pay-extra-intent-change';
import { PaymentValidateButton } from './payment-modal/pay-extra/payment-validate-button';
import { PayExtraWorkbenchHint } from './payment-modal/pay-extra/pay-extra-workbench-hint';
import { useHasPermissionCode } from '@/lib/hooks/usePermissions';
// Composable payment system (Phase 4 strangler — capability renderer wired in
// section by section; oracle green each step).
import { resolvePaymentModalConfig } from '@features/orders/payment/config/payment-modal-config';
import { PAYMENT_CAPABILITY } from '@features/orders/payment/capabilities/capability-keys';
import { evaluateCapabilities } from '@features/orders/payment/capabilities/registry';
import {
  projectCapabilityContext,
  type CapabilityContextSource,
} from '@features/orders/payment/domain/project-capability-context';
import { PAYMENT_PRESET } from '@features/orders/payment/presets/preset-keys';
import { resolvePreset } from '@features/orders/payment/presets/presets';
import { SIMPLE_PRESET } from '@features/orders/payment/presets/simple.preset';
import { applyMethodChipPolicy } from '@features/orders/payment/view/method-chips';
import {
  planCapabilityView,
  selectDialogSlots,
} from '@features/orders/payment/view/capability-view-plan';
import { CapabilityViewRenderer } from '@features/orders/payment/view/capability-view-renderer';
import { getCapabilityActionIcon } from '@features/orders/payment/view/capability-action-icons';
import {
  SERVER_GUARD_AFFORDANCE,
  resolveServerGuardAffordance,
} from '@features/orders/payment/view/server-guard-affordance';
import { PaymentSubmitGuard } from '@features/orders/payment/primitives/payment-submit-guard';
import type { PaymentServerGuard } from '@features/orders/hooks/use-order-submission';
import { FxRoundingLine } from '@features/orders/payment/capabilities/fx-rounding/fx-rounding-line';
import { SplitTenderDialog } from '@features/orders/payment/capabilities/split-tender/split-tender-dialog';
import { CustomerCreditDialog } from '@features/orders/payment/capabilities/customer-credit/customer-credit-dialog';
import { GiftCardDialog } from '@features/orders/payment/capabilities/gift-card/gift-card-dialog';
import { PromoCodeDialog } from '@features/orders/payment/capabilities/promo-code/promo-code-dialog';
import { PayLaterDialog } from '@features/orders/payment/capabilities/pay-later/pay-later-dialog';
import { B2BAccountBillingDialog } from '@features/orders/payment/capabilities/b2b-account-billing/b2b-account-billing-dialog';
import { OverpaymentRoutingDialog } from '@features/orders/payment/capabilities/overpayment-routing/overpayment-routing-dialog';
import { useB2bContracts } from '@features/orders/hooks/use-b2b-contracts';
import { PaymentModeSuggestion } from '@features/orders/payment/primitives/payment-mode-suggestion';
import { PaymentLegDetailFields } from '@features/orders/payment/primitives/payment-leg-detail-fields';
import { PaymentDiscountFields } from '@features/orders/payment/primitives/payment-discount-fields';
import { OVERPAYMENT_RESOLUTION_PERMISSIONS } from '@/lib/constants/settlement-catalog';
import { buildPaymentPayload } from '@features/orders/hooks/use-payment-submit';
import { usePaymentShortcuts } from '@features/orders/hooks/use-payment-shortcuts';
import {
  usePaymentEngine,
  type PaymentEngineItem,
  type PaymentEngineCurrencyConfig,
} from '@features/orders/hooks/use-payment-engine';
import {
  resolvePaymentOverpaymentPolicy,
  resolveSupportsRetainedOverpayment,
} from '@/lib/payments/overpayment-policy';
import {
  deriveBalanceStatusLabel,
  deriveRequiredActionCopy,
  RIGHT_RAIL_BALANCE_STATUS,
  RIGHT_RAIL_REQUIRED_ACTION,
} from './payment-modal-v4.right-rail';
import {
  deriveAutoExpandPaymentSections,
  derivePaymentInspectorTabs,
  deriveVisiblePaymentSections,
  PAYMENT_MODAL_INSPECTOR_TAB_IDS,
  PAYMENT_MODAL_SECTION_IDS,
  PAYMENT_MODAL_V04_PIN_FINAL_ORDER_TOTAL,
  PAYMENT_MODAL_V04_SHOW_LIVE_EFFECT,
  type PaymentModalSectionId,
} from './payment-modal-v04-sections-definition';
import { PaymentWorkbenchSection } from './payment-workbench-section';
import { usePaymentWorkbenchSectionState } from './use-payment-workbench-section-state';
import {
  GATEWAY_METHOD_CODES,
  type CheckoutSettlementOption,
} from '@features/orders/hooks/use-payment-catalog';

// Cmx component imports
import { CmxDialog, CmxDialogContent, CmxDialogHeader, CmxDialogTitle, CmxDialogFooter } from '@ui/overlays';
import { CmxCard, CmxCardHeader, CmxCardTitle, CmxCardContent } from '@ui/primitives/cmx-card';
import { CmxButton } from '@ui/primitives';
import { CmxInput } from '@ui/primitives';
import { CmxMoneyField } from '@ui/primitives';
import { CmxTextarea } from '@ui/primitives';
import { CmxSkeleton } from '@ui/primitives';
import { Badge } from '@ui/primitives/badge';
import { CmxKeypad, KEYPAD_PAYMENT_4COL, PAYMENT_KEY_VARIANT, PAYMENT_KEY_CLASS } from '@ui/utilities';
import {
  CmxSelectDropdown,
  CmxSelectDropdownTrigger,
  CmxSelectDropdownValue,
  CmxSelectDropdownContent,
  CmxSelectDropdownItem,
} from '@ui/forms';
import { CmxTabsPanel, type CmxTabItem } from '@ui/navigation';
import { CmxEmptyState } from '@ui/data-display';
import { showErrorToast } from '@ui/components/cmx-toast';

// SummaryRow extracted to './payment-modal/summary-row' in Phase 4 — shared by
// the Full right rail, the submit-confirm summary, and the Simple receipt card.
// OrderValueBreakdownRow/Model/Panel extracted to
// './payment-modal/order-value-breakdown-panel' in the same phase — the Full
// financial inspector and the Simple full-story receipt render one shared
// model computed once by this container.

type RightRailSummaryItem = {
  label: string;
  value: string;
  negative?: boolean;
};

function FinalOrderTotalPanel({
  value,
  title,
  help,
  isRTL,
}: {
  value: string;
  title: string;
  help: string;
  isRTL: boolean;
}) {
  return (
    <div className="rounded-2xl border border-cyan-200 bg-cyan-50/60 p-4 shadow-sm">
      <p className={`text-xs font-semibold ${isRTL ? "" : "uppercase tracking-[0.14em]"} text-cyan-700 ${isRTL ? 'text-right' : 'text-left'}`}>
        {title}
      </p>
      <p className={`mt-3 text-2xl font-bold tabular-nums text-slate-950 ${isRTL ? 'text-right' : 'text-left'}`}>
        {value}
      </p>
      <p className={`mt-2 text-xs text-slate-500 ${isRTL ? 'text-right' : 'text-left'}`}>
        {help}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
function B2BContractsSelect({
  customerId,
  control,
  isRTL,
}: {
  customerId: string;
  control: Control<PaymentFormData>;
  isRTL: boolean;
}) {
  const t = useTranslations('newOrder.payment');
  // Shared query (use-b2b-contracts) — same key as the B2B capability dialog's
  // fetch in the container, so the two surfaces dedupe to one request.
  const { data: contracts = [], isLoading } = useB2bContracts(customerId);

  const noneLabel = t('b2b.contractOptional');

  return (
    <div>
      <label className={`block text-sm font-medium text-slate-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
        {t('b2b.contract')}
      </label>
      <Controller
        name="b2bContractId"
        control={control}
        render={({ field }) => {
          const selectedLabel =
            contracts.find((c) => c.id === field.value)?.contractNo ?? noneLabel;
          return (
            <CmxSelectDropdown
              value={field.value || ''}
              onValueChange={(v) => field.onChange(v || undefined)}
              isLoading={isLoading}
              emptyLabel={t('b2b.contractOptional')}
            >
              <CmxSelectDropdownTrigger dir={isRTL ? 'rtl' : 'ltr'}>
                <CmxSelectDropdownValue
                  displayValue={selectedLabel}
                  placeholder={noneLabel}
                />
              </CmxSelectDropdownTrigger>
              <CmxSelectDropdownContent>
                <CmxSelectDropdownItem value="">
                  {noneLabel}
                </CmxSelectDropdownItem>
                {contracts.map((c) => (
                  <CmxSelectDropdownItem key={c.id} value={c.id}>
                    {c.contractNo}
                  </CmxSelectDropdownItem>
                ))}
              </CmxSelectDropdownContent>
            </CmxSelectDropdown>
          );
        }}
      />
    </div>
  );
}


// ---------------------------------------------------------------------------
// PaymentFullView props
// ---------------------------------------------------------------------------
interface PaymentFullViewProps {
  /** RHF form owned by the thin shell. */
  form: UseFormReturn<PaymentFormData>;
  /** Shell-computed payment-method default (depends on customer type). */
  defaultPaymentMethod: PaymentFormData['paymentMethod'];
  /** Shell-computed outstanding-policy default. */
  defaultOutstandingPolicy: OutstandingPolicy;
  /** Derived by shell: customerType === 'b2b'. */
  isB2BCustomer: boolean;
  /** Currency config loaded by the shell on open. */
  currencyConfig: PaymentEngineCurrencyConfig | null;
  /** CSRF token obtained by the shell's useCSRFToken. */
  csrfToken: string | null | undefined;
  // ---- order context ----
  open: boolean;
  items: PaymentEngineItem[];
  total: number;
  checkoutAmount?: number;
  isExpress: boolean;
  tenantOrgId: string;
  customerId?: string;
  customerType?: string;
  customerDisplayName?: string;
  customerPhone?: string;
  serviceCategories?: string[];
  branchId?: string;
  userId?: string;
  isRetailOnlyOrder: boolean;
  loading: boolean;
  initialPaymentNotes?: string;
  /**
   * Face the modal opens with (Phase 4). Defaults to Simple per the locked
   * program decision; the engine's `needsAdvanced` auto-escalates to Full.
   */
  initialMode?: PaymentModalMode;
  /**
   * Phase 5 — a server submit rejection routed to its owning capability.
   * Rendered as an in-view `PaymentSubmitGuard` in the shared footer with a
   * corrective action that opens the owning capability surface.
   */
  serverGuard?: PaymentServerGuard | null;
  /** Clears the routed server guard (called on modal open reset). */
  onServerGuardClear?: () => void;
  // ---- callbacks ----
  onClose: () => void;
  onSubmit: (paymentData: PaymentFormData, payload: NewOrderPaymentPayload) => void;
}

// ---------------------------------------------------------------------------
// PaymentFullView — owns refs, focus/scroll helpers, section state,
// the engine call, and the full JSX. The thin shell (payment-modal-v4.tsx)
// owns the RHF form, currencyConfig loading, and the open-reset form effect.
// ---------------------------------------------------------------------------
export function PaymentFullView({
  form,
  defaultPaymentMethod,
  defaultOutstandingPolicy,
  isB2BCustomer,
  currencyConfig,
  csrfToken,
  open,
  items,
  total,
  checkoutAmount,
  isExpress = false,
  tenantOrgId,
  customerId,
  customerType,
  customerDisplayName,
  customerPhone,
  serviceCategories,
  branchId,
  userId,
  isRetailOnlyOrder = false,
  loading = false,
  initialPaymentNotes = '',
  initialMode = PAYMENT_MODAL_MODE.SIMPLE,
  serverGuard = null,
  onServerGuardClear,
  onClose,
  onSubmit,
}: PaymentFullViewProps) {
  const t = useTranslations('newOrder.payment');
  const tCommon = useTranslations('common');
  const tTopBar = useTranslations('newOrder.topBar');
  const tGiftCardErrors = useTranslations('marketing.giftCards.errors');
  const isRTL = useRTL();
  // Uppercase/letter-spacing is meaningless (and harmful) for Arabic script —
  // gate the micro-label treatment behind LTR (UX review polish item).
  const labelCase = isRTL ? '' : 'uppercase tracking-[0.14em]';
  const labelCaseWide = isRTL ? '' : 'uppercase tracking-[0.18em]';

  // Destructure RHF methods from the shell-owned form.
  const { control, handleSubmit, formState: { errors }, setValue, watch } = form;

  const {
    isSectionExpanded,
    isSectionCollapsible,
    expandSection,
    toggleSection,
  } = usePaymentWorkbenchSectionState(open);
  const workbenchSectionToggleLabels = useMemo(
    () => ({
      expandLabel: t('sections.expandSection'),
      collapseLabel: t('sections.collapseSection'),
    }),
    [t]
  );

  const paymentMethod  = watch('paymentMethod');
  const percentDiscount = watch('percentDiscount');
  const amountDiscount  = watch('amountDiscount');
  const promoCode       = watch('promoCode');
  const giftCardNumber  = watch('giftCardNumber');
  const giftCardAmount  = watch('giftCardAmount');
  const outstandingPolicy = watch('outstandingPolicy');
  // B2B account-billing fields — watched so the RHF-free capability dialog can
  // receive value + setter pairs (same convention as gift card / promo code).
  const b2bContractId = watch('b2bContractId');
  const costCenterCode = watch('costCenterCode');
  const poNumber = watch('poNumber');

  const [creditLimitOverride, setCreditLimitOverride] = useState(false);
  const [isDirtySinceOpen, setIsDirtySinceOpen] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [pendingSubmission, setPendingSubmission] = useState<{
    paymentData: PaymentFormData;
    payload: NewOrderPaymentPayload;
  } | null>(null);
  const [creditNotePickerOpen, setCreditNotePickerOpen] = useState(false);
  const [pendingCreditNoteOption, setPendingCreditNoteOption] = useState<CheckoutSettlementOption | null>(null);

  // Phase 4 — Simple/Full face state. One engine, two faces: the mode only
  // swaps the dialog body; header, footer CTA, and confirm dialogs are shared,
  // and every slice keeps its state across flips (it lives in the engine).
  const [mode, setMode] = useState<PaymentModalMode>(initialMode);
  // Composable-payment mode control (amended ADR): the cashier always controls
  // Simple/Full. The modal never auto-escalates and never locks Simple;
  // complexity surfaces as a dismissible suggestion.
  const paymentModalConfig = useMemo(() => resolvePaymentModalConfig(), []);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  // Capability dialogs openable in-place from the Simple fast lane (ADR: a
  // complication is a focused dialog, never a mode change).
  const [splitDialogOpen, setSplitDialogOpen] = useState(false);
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [giftDialogOpen, setGiftDialogOpen] = useState(false);
  const [promoDialogOpen, setPromoDialogOpen] = useState(false);
  const [payLaterDialogOpen, setPayLaterDialogOpen] = useState(false);
  const [b2bDialogOpen, setB2bDialogOpen] = useState(false);
  // Phase 6 — below `xl` the receipt rail becomes a slide-over panel.
  const [railOpen, setRailOpen] = useState(false);

  const pinInputRef  = useRef<HTMLInputElement | null>(null);
  const giftCardDetailsRef = useRef<HTMLDivElement | null>(null);
  const giftCardAmountInputRef = useRef<HTMLInputElement | null>(null);
  const amountInputRef = useRef<HTMLInputElement | null>(null);
  const amountDiscountInputRef = useRef<HTMLInputElement | null>(null);
  const percentDiscountInputRef = useRef<HTMLInputElement | null>(null);
  const checkNumberInputRef = useRef<HTMLInputElement | null>(null);
  const checkDateInputRef = useRef<HTMLInputElement | null>(null);
  const payOnCollectionPolicyButtonRef = useRef<HTMLButtonElement | null>(null);
  const creditLimitCardRef = useRef<HTMLDivElement | null>(null);
  const couponCardRef = useRef<HTMLDivElement | null>(null);
  const cashDrawerCardRef = useRef<HTMLDivElement | null>(null);
  const cashDrawerSelectorCardRef = useRef<HTMLDivElement | null>(null);
  const balanceSnapshotSectionRef = useRef<HTMLDivElement | null>(null);
  const amountEditorSectionRef = useRef<HTMLDivElement | null>(null);
  const extraReceiptCardRef = useRef<HTMLDivElement | null>(null);
  const paymentWorkspaceSectionRef = useRef<HTMLDivElement | null>(null);
  const financialInspectorSectionRef = useRef<HTMLDivElement | null>(null);
  const balancePolicySectionRef = useRef<HTMLDivElement | null>(null);
  const legsCardRef  = useRef<HTMLDivElement | null>(null);
  const focusTrapRef = useFocusTrap(open, { returnFocus: true });

  const currencyCode  = currencyConfig?.currencyCode ?? ORDER_DEFAULTS.CURRENCY;
  const decimalPlaces = currencyConfig?.decimalPlaces ?? 3;
  const formatAmount  = (n: number) => n.toFixed(decimalPlaces);
  // Amount-editor focus helper (view-owned ref/scroll/focus). Threaded into the
  // engine so leg/credit-note handlers can refocus the amount editor.
  const focusAmountEditor = useCallback(() => {
    // A capability dialog (split, gift card, store credit, …) owns its own amount
    // fields. While one is open, do NOT yank focus/scroll to the background editor
    // behind it (otherwise selecting a method in the dialog jumps the cursor to
    // the hidden Simple/Full amount field — QA 1.1).
    if (
      splitDialogOpen ||
      creditDialogOpen ||
      giftDialogOpen ||
      promoDialogOpen ||
      payLaterDialogOpen ||
      b2bDialogOpen
    ) {
      return;
    }
    expandSection(PAYMENT_MODAL_SECTION_IDS.AMOUNT_EDITOR);
    window.setTimeout(() => {
      amountEditorSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      amountInputRef.current?.focus();
      amountInputRef.current?.select();
    }, 50);
  }, [
    expandSection,
    splitDialogOpen,
    creditDialogOpen,
    giftDialogOpen,
    promoDialogOpen,
    payLaterDialogOpen,
    b2bDialogOpen,
  ]);

  // Reset view-local state on open. (form.reset is in the shell's open-reset effect.)
  useEffect(() => {
    if (open) {
      setCreditLimitOverride(false);
      setIsDirtySinceOpen(false);
      setConfirmCloseOpen(false);
      setSubmitConfirmOpen(false);
      setPendingSubmission(null);
      setMode(initialMode);
      setSuggestionDismissed(false);
      setSplitDialogOpen(false);
      setCreditDialogOpen(false);
      setGiftDialogOpen(false);
      setPromoDialogOpen(false);
      setPayLaterDialogOpen(false);
      setB2bDialogOpen(false);
      setRailOpen(false);
      // A routed server guard from a previous session must not survive reopen.
      onServerGuardClear?.();
    }
  }, [open, initialMode, onServerGuardClear]);

  // Composition engine (Phase 2G-1): the 7 concern slices + every cross-slice
  // derivation + the non-DOM handlers + the payExtraIntentRef bridge. Behavior-frozen.
  const engine = usePaymentEngine({
    open,
    items,
    tenantOrgId,
    branchId,
    customerId,
    customerType,
    isExpress,
    isRetailOnlyOrder,
    isB2BCustomer,
    total,
    checkoutAmount,
    userId,
    serviceCategories,
    loading,
    defaultPaymentMethod,
    defaultOutstandingPolicy,
    isRTL,
    csrfToken,
    setValue,
    errors,
    paymentMethod,
    percentDiscount,
    amountDiscount,
    promoCode,
    giftCardNumber,
    giftCardAmount,
    outstandingPolicy,
    currencyConfig,
    currencyCode,
    decimalPlaces,
    formatAmount,
    focusAmountEditor,
    pinInputRef,
    giftCardDetailsRef,
    giftCardAmountInputRef,
    creditLimitOverride,
    isDirtySinceOpen,
    setIsDirtySinceOpen,
    pendingCreditNoteOption,
    setPendingCreditNoteOption,
    setCreditNotePickerOpen,
    t,
    tGiftCardErrors,
  });
  const {
    catalog,
    giftPromo,
    totals: totalsSlice,
    legs,
    derivations,
    payExtra,
    cashDrawer,
    walletCreditOption,
    storedValueSummary,
    storedValueLoading,
    storedValueFetching,
    refetchStoredValueSummary,
    giftCardSettlementAmount,
    liveWalletBalance,
    liveWalletCurrencyCode,
    walletBalanceLoaded,
    walletHasAvailableBalance,
    liveWalletBalanceDisplay,
    liveAdvanceBalance,
    getLegStoredValueCap,
    notifyIfLegAmountCapped,
    amountCapNotice,
    newLegRejectAlert,
    clearNewLegRejectAlert,
    canAllocateOverpayment,
    canDisposeOverpayment,
    canWalletOverpayment,
    canAdvanceOverpayment,
    canCreditOverpayment,
    canCreditNoteOverpayment,
    canSaveAdvanceOverpayment,
    canSaveCreditOverpayment,
    checkoutExcessLegs,
    canEnablePayExtra,
    primaryCashLegRef,
    payExtraResetFingerprint,
    allocation,
    payExtraIntent,
    setPayExtraIntent,
    validationPhase,
    extraReceiptDialogOpen,
    setExtraReceiptDialogOpen,
    runValidatePayment,
    confirmExtraReceiptSelection,
    unresolvedOverpaymentAmount,
    extraReceiptDialogExcessAmount,
    overpaymentNeedsResolution,
    overpaymentResolutionPayload,
    overpaymentBlocksSubmit,
    editableLegEntries,
    legacyDisplayChangeAmount,
    displayChangeAmount,
    netCashRetainedAmount,
    primaryMethodOption,
    cashDrawerRequired,
    effectiveOutstandingPolicy,
    activeLegRemainingCap,
    showDeferredExplanation,
    showGiftCardWorkspace,
    hasCheckLegWithoutNumber,
    hasCheckLegWithInvalidDate,
    creditNoteLegsMissingReference,
    terminalRequiredLegs,
    legsMissingRequiredReference,
    activeLegOption,
    activeLegChangeReturned,
    paymentLegsTotal,
    splitSidebarSettledTotal,
    invalidImmediateAmount,
    appliedBadgeCount,
    validationItems,
    submitBusy,
    submitHasBlockingIssues,
    rightRailState,
    needsAdvanced,
    needsAdvancedReasons,
    handleCreditNoteSelect,
    handleMethodSelect,
    handleCustomerCreditSelect,
    handleValidatePromoCode,
    handleClearPromoCode,
    handleClearPromoCodeError,
    handleFetchGiftCardDetails,
    handleApplyGiftCard,
    handleClearGiftCard,
    handleOutstandingPolicyChange,
    handleKeypadPress,
    cycleActiveLeg,
    fillLegRemaining,
  } = engine;

  // Re-destructure the grouped slices into the modal's local names (JSX unchanged).
  const {
    cardBrands,
    branchPaymentTerminals,
    checkoutMethods,
    customerCreditOptions,
    checkoutMethodsLoading,
    checkoutOptionsIsError,
    refetchCheckoutOptions,
    realPaymentOptions,
    creditMethodCodes,
    getMethodOption,
    getOptionDisplayName: getCheckoutOptionDisplayName,
    getMethodHint,
  } = catalog;
  const {
    promoCodeValidating,
    setPromoCodeValidating,
    promoCodeResult,
    setPromoCodeResult,
    appliedPromoCode,
    setAppliedPromoCode,
    giftCardValidating,
    setGiftCardValidating,
    giftCardResult,
    setGiftCardResult,
    giftCardDetails,
    setGiftCardDetails,
    appliedGiftCard,
    setAppliedGiftCard,
    giftCardPin,
    setGiftCardPin,
    pinRequired,
    setPinRequired,
    pinVisible,
    setPinVisible,
    pinFieldError,
    setPinFieldError,
    resolveGiftCardError,
  } = giftPromo;
  const {
    serverTotals,
    totalsLoading,
    totals,
    saleTotal,
    taxProfileEntries,
    displayTaxBreakdown,
    profilesTaxAmount,
    checkoutEligibilityAmount,
  } = totalsSlice;
  const {
    paymentLegs,
    setPaymentLegs,
    activeLegIndex,
    setActiveLegIndex,
    activeAmountDraft,
    setActiveAmountDraft,
    activeLeg,
    removeLegAt,
    updateLeg,
    upsertSettlementLeg,
    payExtraIntentRef,
  } = legs;
  const {
    settlementLegEntries,
    realPaymentEntries,
    customerCreditEntries,
    payNowAmount,
    customerCreditAmount,
    settledNowAmount,
    cashLegAmount,
    cashTenderedAmount,
    totalSettledNowAmount,
    walletLegEntry,
    storedValueLegExceedance,
    walletLegExceedsLiveBalance,
    storedValueLegExceedsBalance,
    moneyEpsilon,
    remainingBalance,
    changeAmount,
    canReturnChangeFromCash,
    cashChangeAmount,
    cashChangeCapacity,
    legacyUnresolvedOverpaymentAmount,
    amountAppliedToOrder,
  } = derivations;
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
    formatCashDrawerOpenedAt,
    persistPreferredCashDrawerId,
    handleOpenCashDrawerDialog,
    handleCreateCashDrawerSession,
  } = cashDrawer;

  /**
   * Manual Simple ⇄ Advanced switch. The cashier may always return to Simple
   * (engine state survives) — the modal never refuses the return or locks Simple.
   */
  const handleModeChange = useCallback((nextMode: PaymentModalMode) => {
    setMode(nextMode);
  }, []);

  // Preserve focus across face switches: when the previously-focused control
  // unmounted with the old face, land on the shared amount editor (both faces
  // attach `amountInputRef`; only one is mounted at a time).
  const prevModeRef = useRef(mode);
  useEffect(() => {
    if (prevModeRef.current === mode) return;
    prevModeRef.current = mode;
    const timer = window.setTimeout(() => {
      const activeElement = document.activeElement;
      if (!activeElement || activeElement === document.body) {
        if (amountInputRef.current && !amountInputRef.current.disabled) {
          amountInputRef.current.focus();
          amountInputRef.current.select();
        }
      }
    }, 120);
    return () => window.clearTimeout(timer);
  }, [mode]);

  // Payment icon helper
  const getPaymentIcon = (id: string) => {
    const cls = 'w-5 h-5';
    switch (id) {
      case PAYMENT_METHODS.CASH:              return <Banknote className={cls} />;
      case PAYMENT_METHODS.CARD:              return <CreditCard className={cls} />;
      case PAYMENT_METHODS.PAY_ON_COLLECTION: return <Package className={cls} />;
      case PAYMENT_METHODS.CHECK:             return <CheckSquare className={cls} />;
      case PAYMENT_METHODS.INVOICE:           return <FileText className={cls} />;
      case PAYMENT_METHODS.BANK_TRANSFER:     return <FileText className={cls} />;
      case PAYMENT_METHODS.MOBILE_PAYMENT:    return <CreditCard className={cls} />;
      case PAYMENT_METHODS.PAYMENT_GATEWAY:   return <CreditCard className={cls} />;
      case PAYMENT_METHODS.HYPERPAY:          return <CreditCard className={cls} />;
      case PAYMENT_METHODS.PAYTABS:           return <CreditCard className={cls} />;
      case PAYMENT_METHODS.STRIPE:            return <CreditCard className={cls} />;
      case 'WALLET':                          return <Wallet className={cls} />;
      case 'ADVANCE':                         return <Wallet className={cls} />;
      case 'CREDIT_NOTE':                     return <Wallet className={cls} />;
      case 'LOYALTY_POINTS':                  return <Wallet className={cls} />;
      case 'CUSTOMER_ADVANCE':                return <Wallet className={cls} />;
      case 'CUSTOMER_CREDIT':                 return <Wallet className={cls} />;
      case 'LOYALTY_CREDIT':                  return <Wallet className={cls} />;
      default:                                return <Banknote className={cls} />;
    }
  };

  const getPaymentLabel = (id: string) => {
    switch (id) {
      case PAYMENT_METHODS.CASH:              return t('methods.cash');
      case PAYMENT_METHODS.CARD:              return t('methods.card');
      case PAYMENT_METHODS.PAY_ON_COLLECTION: return t('methods.payOnCollection');
      case PAYMENT_METHODS.CHECK:             return t('methods.check');
      case PAYMENT_METHODS.INVOICE:           return t('methods.invoice');
      case PAYMENT_METHODS.BANK_TRANSFER:     return t('methods.bankTransfer');
      case PAYMENT_METHODS.MOBILE_PAYMENT:    return t('methods.mobilePayment');
      case PAYMENT_METHODS.PAYMENT_GATEWAY:   return t('methods.paymentGateway');
      case PAYMENT_METHODS.HYPERPAY:          return t('methods.hyperpay');
      case PAYMENT_METHODS.PAYTABS:           return t('methods.paytabs');
      case PAYMENT_METHODS.STRIPE:            return t('methods.stripe');
      case 'WALLET':                          return t('customerCredits.wallet');
      case 'ADVANCE':                         return t('customerCredits.customerAdvance');
      case 'CREDIT_NOTE':                     return t('customerCredits.customerCredit');
      case 'LOYALTY_POINTS':                  return t('customerCredits.loyaltyCredit');
      case 'CUSTOMER_ADVANCE':                return t('customerCredits.customerAdvance');
      case 'CUSTOMER_CREDIT':                 return t('customerCredits.customerCredit');
      case 'LOYALTY_CREDIT':                  return t('customerCredits.loyaltyCredit');
      default:                                return id;
    }
  };

  const getMethodToneClasses = (id: string) => {
    switch (id) {
      case PAYMENT_METHODS.PAY_ON_COLLECTION:
        return {
          iconWrap: 'bg-teal-100 text-teal-700 border-teal-200',
          selected: 'border-teal-500 bg-teal-50 text-slate-900 shadow-sm',
        };
      case PAYMENT_METHODS.CASH:
        return {
          iconWrap: 'bg-emerald-100 text-emerald-700 border-emerald-200',
          selected: 'border-emerald-500 bg-emerald-50/70 text-slate-900 shadow-sm',
        };
      case PAYMENT_METHODS.CARD:
        return {
          iconWrap: 'bg-blue-100 text-blue-700 border-blue-200',
          selected: 'border-sky-500 bg-sky-50 text-slate-900 shadow-sm',
        };
      case PAYMENT_METHODS.CHECK:
        return {
          iconWrap: 'bg-amber-100 text-amber-700 border-amber-200',
          selected: 'border-amber-500 bg-amber-50/70 text-slate-900 shadow-sm',
        };
      case PAYMENT_METHODS.BANK_TRANSFER:
        return {
          iconWrap: 'bg-indigo-100 text-indigo-700 border-indigo-200',
          selected: 'border-indigo-500 bg-indigo-50/70 text-slate-900 shadow-sm',
        };
      case PAYMENT_METHODS.MOBILE_PAYMENT:
        return {
          iconWrap: 'bg-violet-100 text-violet-700 border-violet-200',
          selected: 'border-violet-500 bg-violet-50/70 text-slate-900 shadow-sm',
        };
      case PAYMENT_METHODS.INVOICE:
        return {
          iconWrap: 'bg-cyan-100 text-cyan-700 border-cyan-200',
          selected: 'border-cyan-500 bg-cyan-50/70 text-slate-900 shadow-sm',
        };
      default:
        return {
          iconWrap: 'bg-slate-100 text-slate-700 border-slate-200',
          selected: 'border-slate-400 bg-slate-50 text-slate-900 shadow-sm',
        };
    }
  };

  const summaryMethodLabel =
    paymentLegs.length > 1
      ? t('submitConfirm.splitPayment')
      : activeLeg
        ? getCheckoutOptionDisplayName(activeLegOption, activeLeg.method)
        : getPaymentLabel(paymentMethod || defaultPaymentMethod);
  const allocationStatusLabel =
    unresolvedOverpaymentAmount > moneyEpsilon
      ? t('splitPayment.over')
      : remainingBalance > moneyEpsilon
        ? t('splitPayment.outstanding')
        : t('splitPayment.allocated');
  const customerHeaderName = customerDisplayName?.trim() || t('customerCard.walkInCustomer');
  const customerHeaderMeta = customerPhone?.trim() || customerId || t('customerCard.noReference');

  const promoErrorMessage = useMemo(() => {
    if (!promoCodeResult || promoCodeResult.isValid) return null;
    const { errorCode, thresholdAmount } = promoCodeResult;
    if (errorCode === 'MIN_ORDER_NOT_MET' && thresholdAmount != null) {
      return t('promoCode.errors.minOrderNotMet', { amount: `${currencyCode} ${formatAmount(thresholdAmount)}` });
    }
    if (errorCode === 'MAX_ORDER_EXCEEDED' && thresholdAmount != null) {
      return t('promoCode.errors.maxOrderExceeded', { amount: `${currencyCode} ${formatAmount(thresholdAmount)}` });
    }
    const codeMap: Partial<Record<string, string>> = {
      NOT_FOUND:               t('promoCode.errors.notFound'),
      EXPIRED:                 t('promoCode.errors.expired'),
      MAX_USES_EXCEEDED:       t('promoCode.errors.maxUsesExceeded'),
      CATEGORY_NOT_APPLICABLE: t('promoCode.errors.categoryNotApplicable'),
      CUSTOMER_GROUP_NOT_APPLICABLE: t('promoCode.errors.customerGroupNotApplicable'),
      CUSTOMER_LIMIT_EXCEEDED: t('promoCode.errors.customerLimitExceeded'),
    };
    return (errorCode && codeMap[errorCode]) ?? promoCodeResult.error ?? t('promoCode.errors.validationFailed');
  }, [promoCodeResult, currencyCode, formatAmount, t]);



  const scrollAndFocusTarget = useCallback(
    (
      target: HTMLElement | null,
      options?: {
        selectText?: boolean;
      }
    ) => {
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      window.setTimeout(() => {
        target.focus();
        if (options?.selectText && (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
          target.select();
        }
      }, 90);
    },
    []
  );

  const scrollToWorkbenchSection = useCallback(
    (sectionId: PaymentModalSectionId) => {
      expandSection(sectionId);
      const target =
        sectionId === PAYMENT_MODAL_SECTION_IDS.BALANCE_SNAPSHOT
          ? balanceSnapshotSectionRef.current
          : sectionId === PAYMENT_MODAL_SECTION_IDS.AMOUNT_EDITOR
            ? amountEditorSectionRef.current
          : sectionId === PAYMENT_MODAL_SECTION_IDS.PAYMENT_WORKSPACE
            ? paymentWorkspaceSectionRef.current
            : sectionId === PAYMENT_MODAL_SECTION_IDS.DISCOUNTS_CREDITS
              ? couponCardRef.current
              : sectionId === PAYMENT_MODAL_SECTION_IDS.CASH_DRAWER
                ? cashDrawerCardRef.current
                : sectionId === PAYMENT_MODAL_SECTION_IDS.FINANCIAL_INSPECTOR
                  ? financialInspectorSectionRef.current
                  : sectionId === PAYMENT_MODAL_SECTION_IDS.BALANCE_POLICY
                    ? balancePolicySectionRef.current
                    : null;

      scrollAndFocusTarget(target);
    },
    [expandSection, scrollAndFocusTarget]
  );

  const focusFirstBlockingIssue = useCallback(() => {
    if (promoCodeValidating || giftCardValidating || pinRequired) {
      scrollToWorkbenchSection(PAYMENT_MODAL_SECTION_IDS.DISCOUNTS_CREDITS);
      if (pinRequired && !giftCardPin.trim()) {
        setPinFieldError(t('giftCard.pinPendingError'));
      }
      window.setTimeout(() => {
        if (pinRequired && !giftCardPin.trim()) {
          scrollAndFocusTarget(pinInputRef.current, { selectText: true });
          return;
        }
        scrollAndFocusTarget(couponCardRef.current);
      }, 90);
      return;
    }

    if (errors.amountDiscount?.message) {
      scrollToWorkbenchSection(PAYMENT_MODAL_SECTION_IDS.DISCOUNTS_CREDITS);
      window.setTimeout(() => {
        scrollAndFocusTarget(amountDiscountInputRef.current, { selectText: true });
      }, 90);
      return;
    }

    if (errors.percentDiscount?.message) {
      scrollToWorkbenchSection(PAYMENT_MODAL_SECTION_IDS.DISCOUNTS_CREDITS);
      window.setTimeout(() => {
        scrollAndFocusTarget(percentDiscountInputRef.current, { selectText: true });
      }, 90);
      return;
    }

    if (invalidImmediateAmount) {
      focusAmountEditor();
      window.setTimeout(() => {
        scrollAndFocusTarget(amountInputRef.current, { selectText: true });
      }, 90);
      return;
    }

    if (overpaymentBlocksSubmit) {
      expandSection(PAYMENT_MODAL_SECTION_IDS.BALANCE_SNAPSHOT);
      scrollAndFocusTarget(extraReceiptCardRef.current);
      return;
    }

    if (legsMissingRequiredReference.length > 0) {
      const missingRefLeg = legsMissingRequiredReference[0];
      const refLegIndex = paymentLegs.findIndex(
        (leg) =>
          leg.method === missingRefLeg.method &&
          (leg.gateway_code ?? '') === (missingRefLeg.gateway_code ?? '')
      );
      if (refLegIndex >= 0) {
        setActiveLegIndex(refLegIndex);
      }
      scrollToWorkbenchSection(PAYMENT_MODAL_SECTION_IDS.PAYMENT_WORKSPACE);
      window.setTimeout(() => {
        scrollAndFocusTarget(amountInputRef.current, { selectText: true });
      }, 90);
      return;
    }

    if (hasCheckLegWithoutNumber) {
      const checkLegIndex = paymentLegs.findIndex(
        (leg) => leg.method === PAYMENT_METHODS.CHECK && !leg.checkNumber?.trim()
      );
      if (checkLegIndex >= 0) {
        setActiveLegIndex(checkLegIndex);
        setValue('paymentMethod', PAYMENT_METHODS.CHECK, { shouldDirty: true });
      }
      scrollToWorkbenchSection(PAYMENT_MODAL_SECTION_IDS.PAYMENT_WORKSPACE);
      window.setTimeout(() => {
        scrollAndFocusTarget(checkNumberInputRef.current, { selectText: true });
      }, 90);
      return;
    }

    if (hasCheckLegWithInvalidDate) {
      const checkLegIndex = paymentLegs.findIndex(
        (leg) =>
          leg.method === PAYMENT_METHODS.CHECK &&
          (leg.amount ?? 0) > 0 &&
          validateCheckDueDate(leg.checkDate)
      );
      if (checkLegIndex >= 0) {
        setActiveLegIndex(checkLegIndex);
        setValue('paymentMethod', PAYMENT_METHODS.CHECK, { shouldDirty: true });
      }
      scrollToWorkbenchSection(PAYMENT_MODAL_SECTION_IDS.PAYMENT_WORKSPACE);
      window.setTimeout(() => {
        scrollAndFocusTarget(checkDateInputRef.current, { selectText: true });
      }, 90);
      return;
    }

    if (terminalRequiredLegs.length > 0) {
      setActiveLegIndex(terminalRequiredLegs[0].index);
      scrollToWorkbenchSection(PAYMENT_MODAL_SECTION_IDS.PAYMENT_WORKSPACE);
      window.setTimeout(() => {
        scrollAndFocusTarget(amountInputRef.current);
      }, 90);
      return;
    }

    if (creditNoteLegsMissingReference.length > 0) {
      setActiveLegIndex(creditNoteLegsMissingReference[0].index);
      scrollToWorkbenchSection(PAYMENT_MODAL_SECTION_IDS.PAYMENT_WORKSPACE);
      setPendingCreditNoteOption(
        customerCreditOptions.find((option) => option.payment_method_code === 'CREDIT_NOTE') ?? null
      );
      setCreditNotePickerOpen(true);
      return;
    }

    if (storedValueLegExceedsBalance) {
      const exceedLegIndex =
        storedValueLegExceedance?.index ??
        paymentLegs.findIndex((leg) => leg.method === 'WALLET');
      if (exceedLegIndex >= 0) {
        setActiveLegIndex(exceedLegIndex);
      }
      scrollToWorkbenchSection(PAYMENT_MODAL_SECTION_IDS.PAYMENT_WORKSPACE);
      window.setTimeout(() => {
        scrollAndFocusTarget(amountInputRef.current, { selectText: true });
      }, 90);
      return;
    }

    if (cashDrawerBlockingMessage) {
      scrollToWorkbenchSection(PAYMENT_MODAL_SECTION_IDS.CASH_DRAWER);
      return;
    }

    if (remainingBalance > 0.001 && effectiveOutstandingPolicy === 'NONE') {
      scrollToWorkbenchSection(PAYMENT_MODAL_SECTION_IDS.BALANCE_POLICY);
      window.setTimeout(() => {
        scrollAndFocusTarget(payOnCollectionPolicyButtonRef.current);
      }, 90);
      return;
    }

    if (
      isB2BCreditLimitBlocking({
        creditLimit: serverTotals?.creditLimit?.creditLimit ?? 0,
        available: serverTotals?.creditLimit?.available ?? 0,
        remainingBalance,
        outstandingPolicy: effectiveOutstandingPolicy,
        epsilon: moneyEpsilon,
      })
    ) {
      scrollAndFocusTarget(creditLimitCardRef.current);
    }
  }, [
    creditNoteLegsMissingReference,
    customerCreditOptions,
    errors.amountDiscount?.message,
    errors.percentDiscount?.message,
    effectiveOutstandingPolicy,
    focusAmountEditor,
    giftCardPin,
    giftCardValidating,
    hasCheckLegWithoutNumber,
    hasCheckLegWithInvalidDate,
    legsMissingRequiredReference,
    moneyEpsilon,
    storedValueLegExceedance,
    storedValueLegExceedsBalance,
    cashDrawerBlockingMessage,
    paymentLegs,
    pinRequired,
    promoCodeValidating,
    remainingBalance,
    scrollAndFocusTarget,
    scrollToWorkbenchSection,
    serverTotals?.creditLimit?.creditLimit,
    serverTotals?.creditLimit?.available,
    setValue,
    t,
    terminalRequiredLegs,
    invalidImmediateAmount,
    overpaymentBlocksSubmit,
    expandSection,
  ]);

  const handleBlockedSubmitAttempt = useCallback(() => {
    focusFirstBlockingIssue();
    const firstIssue = validationItems.find((item) => item.trim().length > 0);
    cmxMessage.error(firstIssue ?? t('messages.validationErrors'));
  }, [focusFirstBlockingIssue, t, validationItems]);

  const handleRequiredAction = useCallback(() => {
    if (rightRailState.requiredAction === RIGHT_RAIL_REQUIRED_ACTION.CREDIT_LIMIT) {
      setB2bDialogOpen(true);
      return;
    }

    handleBlockedSubmitAttempt();
  }, [handleBlockedSubmitAttempt, rightRailState.requiredAction]);

  const onInvalidForm = useCallback((formErrors: FieldErrors<PaymentFormData>) => {
    focusFirstBlockingIssue();

    const firstFieldError = Object.values(formErrors).find((value) => value?.message);
    if (firstFieldError?.message) {
      cmxMessage.error(String(firstFieldError.message));
      return;
    }

    const firstValidationIssue = validationItems.find((item) => item.trim().length > 0);
    if (firstValidationIssue) {
      cmxMessage.error(firstValidationIssue);
      return;
    }

    if (paymentMethod === PAYMENT_METHODS.CHECK) {
      cmxMessage.error(t('checkNumber.required'));
      return;
    }

    cmxMessage.error(t('messages.validationErrors'));
  }, [focusFirstBlockingIssue, paymentMethod, t, validationItems]);

  const balanceStatusLabel = useMemo(
    () => deriveBalanceStatusLabel(rightRailState.balanceStatus, t),
    [rightRailState.balanceStatus, t]
  );
  const requiredActionCopy = useMemo(
    () =>
      deriveRequiredActionCopy({
        t,
        requiredAction: rightRailState.requiredAction,
        overpaymentBlocksSubmit,
        payExtraIntent,
        validationPhase,
        currencyCode,
        formatAmount,
        unresolvedOverpaymentAmount,
        cashDrawerBlockingMessage,
        liveWalletBalanceDisplay,
        firstValidationItem: validationItems[0],
      }),
    [
      overpaymentBlocksSubmit,
      payExtraIntent,
      validationPhase,
      rightRailState.requiredAction,
      t,
      currencyCode,
      formatAmount,
      unresolvedOverpaymentAmount,
      cashDrawerBlockingMessage,
      liveWalletBalanceDisplay,
      validationItems,
    ]
  );
  const realPaymentSummaryItems = useMemo<RightRailSummaryItem[]>(
    () =>
      realPaymentEntries.map(({ leg }) => ({
        label: getCheckoutOptionDisplayName(getMethodOption(leg.method, leg.gateway_code), leg.method),
        value: `${currencyCode} ${formatAmount(leg.amount || 0)}`,
      })),
    [realPaymentEntries, getCheckoutOptionDisplayName, getMethodOption, currencyCode, formatAmount]
  );
  const storedValueSummaryItems = useMemo<RightRailSummaryItem[]>(
    () =>
      customerCreditEntries.map(({ leg }) => ({
        label: getCheckoutOptionDisplayName(getMethodOption(leg.method, leg.gateway_code), leg.method),
        value: `${currencyCode} ${formatAmount(leg.amount || 0)}`,
      })),
    [customerCreditEntries, getCheckoutOptionDisplayName, getMethodOption, currencyCode, formatAmount]
  );
  const orderValueBreakdownModel = useMemo<OrderValueBreakdownModel>(
    () => {
      const grossRows: OrderValueBreakdownRow[] = [
        {
          id: 'subtotal',
          label: t('summary.subtotal'),
          value: `${currencyCode} ${formatAmount(totals.subtotal)}`,
        },
      ];
      const discountRows: OrderValueBreakdownRow[] = [];
      const taxRows: OrderValueBreakdownRow[] = [];

      if ((totals.autoRuleDiscount ?? 0) > moneyEpsilon) {
        discountRows.push({
          id: 'rules-discount',
          label: t('summary.rulesDiscount'),
          value: `-${currencyCode} ${formatAmount(totals.autoRuleDiscount ?? 0)}`,
          negative: true,
        });
      }

      if (totals.manualDiscount > moneyEpsilon) {
        discountRows.push({
          id: 'manual-discount',
          label: t('summary.manualDiscount'),
          value: `-${currencyCode} ${formatAmount(totals.manualDiscount)}`,
          negative: true,
        });
      }

      if (totals.promoDiscount > moneyEpsilon) {
        discountRows.push({
          id: 'promo-discount',
          label: t('summary.promoDiscount'),
          value: `-${currencyCode} ${formatAmount(totals.promoDiscount)}`,
          negative: true,
        });
      }

      displayTaxBreakdown.forEach((entry, index) => {
        if (entry.taxAmount <= moneyEpsilon) {
          return;
        }
        const entryLabel = isRTL ? (entry.label2 || entry.label) : entry.label;
        taxRows.push({
          id: `tax-${entry.profileId ?? entry.taxType}-${index}`,
          label: `${entryLabel} (${entry.rate.toFixed(2)}%)`,
          value: `${currencyCode} ${formatAmount(entry.taxAmount)}`,
        });
      });

      if (displayTaxBreakdown.length > 1 && profilesTaxAmount > moneyEpsilon) {
        taxRows.push({
          id: 'tax-total',
          label: t('tax.totalTax'),
          value: `${currencyCode} ${formatAmount(profilesTaxAmount)}`,
        });
      }

      const totalRow: OrderValueBreakdownRow = {
        id: 'order-total',
        label: t('rightRail.orderTotal'),
        value: `${currencyCode} ${formatAmount(saleTotal)}`,
      };

      return {
        grossRows,
        discountRows,
        taxRows,
        totalRow,
      };
    },
    [currencyCode, displayTaxBreakdown, formatAmount, isRTL, moneyEpsilon, profilesTaxAmount, saleTotal, t, totals]
  );

  const hasDiscountBreakdown =
    totals.manualDiscount > moneyEpsilon ||
    totals.promoDiscount > moneyEpsilon ||
    (totals.autoRuleDiscount ?? 0) > moneyEpsilon ||
    !!appliedPromoCode ||
    !!appliedGiftCard;
  const visiblePaymentSectionIds = useMemo(
    () =>
      new Set(
        deriveVisiblePaymentSections({
          hasActivePaymentLeg: !!activeLeg,
          showDeferredExplanation,
          discountsEnabled: true,
          hasDiscountsApplied: hasDiscountBreakdown,
          hasPromoActivity: !!promoCode?.trim() || !!appliedPromoCode,
          hasGiftCardActivity:
            !!giftCardNumber?.trim() ||
            !!giftCardDetails ||
            !!appliedGiftCard ||
            pinRequired,
          hasCashLeg: cashDrawerRequired,
          showBalancePolicy: rightRailState.showBalancePolicy,
        }).map((section) => section.id)
      ),
    [
      activeLeg,
      appliedGiftCard,
      appliedPromoCode,
      cashDrawerRequired,
      giftCardDetails,
      giftCardNumber,
      hasDiscountBreakdown,
      pinRequired,
      promoCode,
      rightRailState.showBalancePolicy,
      showDeferredExplanation,
    ]
  );
  const inspectorTabIds = useMemo(
    () =>
      derivePaymentInspectorTabs({
        hasTaxBreakdown: displayTaxBreakdown.length > 0,
        hasDiscountBreakdown,
        isB2B: customerType === 'b2b' && !!customerId,
      }),
    [
      customerId,
      customerType,
      displayTaxBreakdown.length,
      hasDiscountBreakdown,
    ]
  );
  const showAmountEditorSection = visiblePaymentSectionIds.has(
    PAYMENT_MODAL_SECTION_IDS.AMOUNT_EDITOR
  );
  const showDiscountsCreditsSection = visiblePaymentSectionIds.has(
    PAYMENT_MODAL_SECTION_IDS.DISCOUNTS_CREDITS
  );
  const showCashDrawerWorkbenchSection = visiblePaymentSectionIds.has(
    PAYMENT_MODAL_SECTION_IDS.CASH_DRAWER
  );
  const showBalancePolicySection = visiblePaymentSectionIds.has(
    PAYMENT_MODAL_SECTION_IDS.BALANCE_POLICY
  );

  // ---- Composable capability system (Phase 4 strangler) ----
  // Server still enforces `orders:apply_credit`; this only gates the UI affordance.
  const canApplyCustomerCredit = useHasPermissionCode('orders:apply_credit');
  // Project the live engine into the pure capability-context facts, classify via
  // the registry, and plan the view. Only the capabilities migrated to the
  // renderer so far are rendered through it (strangler); the rest keep their
  // existing full-view UI until their section is routed. See the STATUS doc.
  const capabilityContextSource = useMemo<CapabilityContextSource>(
    () => ({
      promoGiftDisabled: NEW_ORDER_PROMO_GIFT_DISABLED,
      availableMethodCodes: realPaymentOptions.map((option) => option.payment_method_code),
      isB2BCustomer,
      effectiveOutstandingPolicy,
      customerCreditAvailable: customerCreditOptions.length > 0,
      canApplyCustomerCredit,
      // TODO(Phase 4e — B2B section): define the exact required-field rule (the
      // contract is optional per `b2b.contractOptional`); conservative false until
      // then — B2B_ACCOUNT_BILLING is not yet routed through the renderer, and the
      // server still enforces credit limits, so this has no runtime effect today.
      b2bRequiredFieldsMissing: false,
      payLaterAvailable: showBalancePolicySection,
      settlementLegCount: settlementLegEntries.length,
      customerCreditApplied: customerCreditEntries.length > 0,
      giftCardApplied: !!appliedGiftCard,
      promoApplied: !!appliedPromoCode,
      giftCardPinRequired: pinRequired,
      overpaymentNeedsResolution,
      cashDrawerRequired,
      cashDrawerSessionChoiceCount: cashDrawerSessionChoices.length,
      cashDrawerBlocked: !!cashDrawerBlockingMessage,
      currencyExRate: currencyConfig?.currencyExRate,
      submitHasBlockingIssues,
    }),
    [
      realPaymentOptions,
      isB2BCustomer,
      effectiveOutstandingPolicy,
      customerCreditOptions,
      canApplyCustomerCredit,
      showBalancePolicySection,
      settlementLegEntries.length,
      customerCreditEntries.length,
      appliedGiftCard,
      appliedPromoCode,
      pinRequired,
      overpaymentNeedsResolution,
      cashDrawerRequired,
      cashDrawerSessionChoices.length,
      cashDrawerBlockingMessage,
      currencyConfig?.currencyExRate,
      submitHasBlockingIssues,
    ]
  );
  // Single registry evaluation shared by every capability plan (and the B2B
  // dialog's required flag) so all surfaces classify from the SAME facts.
  const evaluatedCapabilities = useMemo(
    () =>
      evaluateCapabilities(
        projectCapabilityContext(capabilityContextSource),
        paymentModalConfig
      ),
    [capabilityContextSource, paymentModalConfig]
  );
  const migratedCapabilityPlan = useMemo(
    () =>
      planCapabilityView(
        evaluatedCapabilities,
        resolvePreset(PAYMENT_PRESET.FULL)
        // Sections routed through the renderer so far (strangler): FX/rounding.
      ).filter((slot) => slot.key === PAYMENT_CAPABILITY.FX_ROUNDING),
    [evaluatedCapabilities]
  );
  // Simple fast-lane quick-action buttons: every advanced capability the SIMPLE
  // preset surfaces as a dialog, filtered to the ones available this session.
  const simpleQuickActionsPlan = useMemo(
    () =>
      selectDialogSlots(
        planCapabilityView(evaluatedCapabilities, resolvePreset(PAYMENT_PRESET.SIMPLE))
      ),
    [evaluatedCapabilities]
  );
  // ---- B2B account-billing capability dialog inputs ----
  // Required badge comes from the registry evaluation (single source; today
  // `b2bRequiredFieldsMissing` is conservatively false — see the TODO above).
  const b2bBillingRequired =
    evaluatedCapabilities.find(
      (capability) => capability.key === PAYMENT_CAPABILITY.B2B_ACCOUNT_BILLING
    )?.required ?? false;
  // Contract list shared with the Full-view inspector tab (same query key —
  // deduped). Gated to B2B customers so retail sessions never fetch.
  const { data: b2bContracts = [], isLoading: b2bContractsLoading } = useB2bContracts(
    customerId,
    isB2BCustomer
  );
  // Read-only credit snapshot for the dialog, mapped off the server preview
  // totals (server remains the enforcement point — Phase 0B hard-deny).
  const b2bCreditLimitInfo = useMemo(() => {
    const creditLimit = serverTotals?.creditLimit;
    if (!creditLimit) return null;
    // Exceedance is judged on the RECEIVABLE being created (the unpaid
    // CREDIT_INVOICE portion = remainingBalance), not the full sale total — so
    // paying part now reduces exposure and can clear the block. Mirrors the
    // server rule (2026-07-11 fix).
    const exceeds = isB2BCreditLimitBlocking({
      creditLimit: creditLimit.creditLimit,
      available: creditLimit.available,
      remainingBalance,
      outstandingPolicy: effectiveOutstandingPolicy,
      epsilon: moneyEpsilon,
    });
    const creditPortion =
      effectiveOutstandingPolicy === 'CREDIT_INVOICE' ? remainingBalance : 0;
    return {
      creditLimit: creditLimit.creditLimit,
      currentBalance: creditLimit.currentBalance,
      available: creditLimit.available,
      wouldExceed: exceeds,
      exceedsBy: exceeds ? Math.max(0, creditPortion - creditLimit.available) : 0,
    };
  }, [serverTotals?.creditLimit, effectiveOutstandingPolicy, remainingBalance, moneyEpsilon]);
  // Typed actions the split-tender dialog may call (leg editing only).
  const splitTenderActions = useMemo(
    () => ({
      updateLeg: legs.updateLeg,
      addLeg: legs.addLeg,
      removeLegAt: legs.removeLegAt,
      setActiveLegIndex: legs.setActiveLegIndex,
    }),
    [legs]
  );
  // Typed actions for the customer-credit + gift-card dialogs.
  const customerCreditActions = useMemo(
    () => ({ selectCustomerCredit: handleCustomerCreditSelect }),
    [handleCustomerCreditSelect]
  );
  const giftCardActions = useMemo(
    () => ({
      fetchGiftCardDetails: handleFetchGiftCardDetails,
      applyGiftCard: handleApplyGiftCard,
      clearGiftCard: handleClearGiftCard,
      setGiftCardPin,
      setGiftCardPinVisible: setPinVisible,
      setGiftCardPinError: setPinFieldError,
    }),
    [
      handleFetchGiftCardDetails,
      handleApplyGiftCard,
      handleClearGiftCard,
      setGiftCardPin,
      setPinVisible,
      setPinFieldError,
    ]
  );
  const promoCodeActions = useMemo(
    () => ({
      validatePromoCode: handleValidatePromoCode,
      clearPromoCode: handleClearPromoCode,
      clearPromoCodeError: handleClearPromoCodeError,
    }),
    [handleValidatePromoCode, handleClearPromoCode, handleClearPromoCodeError]
  );
  const payLaterActions = useMemo(
    () => ({ changeOutstandingPolicy: handleOutstandingPolicyChange }),
    [handleOutstandingPolicyChange]
  );
  // Typed actions for the overpayment-routing capability adapter (wraps the
  // existing extra-receipt dialog with a capability identity — ADR #5).
  const overpaymentRoutingActions = useMemo(
    () => ({
      setExtraReceiptDialogOpen,
      confirmExtraReceiptSelection,
    }),
    [setExtraReceiptDialogOpen, confirmExtraReceiptSelection]
  );

  const submitButtonLabel = useMemo(() => {
    const epsilon = Math.pow(10, -(decimalPlaces + 1));
    // QA §4.4: label the amount that actually SETTLES the order
    // (`amountAppliedToOrder`, matching the rail's "Total Settled Now"), not the
    // raw leg sum — which in an unresolved-overpay state overstates what is paid
    // toward the order (the excess is returned/routed, or blocks submit).
    if (remainingBalance > epsilon) {
      return t('actions.submitWithUnpaid', {
        submit: t('actions.submit'),
        currency: currencyCode,
        payNow: formatAmount(amountAppliedToOrder),
        unpaid: t('summary.notPaidBalance'),
        remaining: formatAmount(remainingBalance),
      });
    }
    return t('actions.submitChargeOnly', {
      submit: t('actions.submit'),
      currency: currencyCode,
      amount: formatAmount(amountAppliedToOrder > 0 ? amountAppliedToOrder : saleTotal),
    });
  }, [t, currencyCode, decimalPlaces, remainingBalance, saleTotal, amountAppliedToOrder]);

  // Quick-tender fast lane (finding 1.2): chip values come from the pure
  // deriver; selection routes through the SAME capped `updateLeg` write path as
  // the keypad (never bypasses overpayment / pay-extra gates). Exact reuses
  // `fillLegRemaining` — the existing remaining-cap action for every method.
  const quickTenderChipItems = useMemo<PaymentQuickTenderChipItem[]>(() => {
    if (!activeLeg) return [];
    return deriveQuickTenderChips({
      remaining: activeLegRemainingCap,
      currencyCode,
      decimalPlaces,
      isCash: activeLeg.method === PAYMENT_METHODS.CASH,
      epsilon: moneyEpsilon,
    }).map((chip) =>
      chip.kind === 'exact'
        ? {
            ...chip,
            label: t('quickTender.exact'),
            ariaLabel: t('quickTender.exactAria', {
              amount: `${currencyCode} ${formatAmount(activeLegRemainingCap)}`,
            }),
          }
        : {
            ...chip,
            label: formatAmount(chip.tenderAmount ?? 0),
            ariaLabel: t('quickTender.tenderAria', {
              amount: `${currencyCode} ${formatAmount(chip.tenderAmount ?? 0)}`,
            }),
          }
    );
  }, [activeLeg, activeLegRemainingCap, currencyCode, decimalPlaces, formatAmount, moneyEpsilon, t]);

  const handleQuickTenderSelect = useCallback(
    (item: PaymentQuickTenderChipItem) => {
      if (!activeLeg) return;
      if (item.kind === 'exact') {
        fillLegRemaining(activeLegIndex);
        return;
      }
      if (typeof item.tenderAmount !== 'number') return;
      updateLeg(activeLegIndex, 'amount', item.tenderAmount);
      setActiveAmountDraft(formatDecimalDraft(item.tenderAmount, decimalPlaces));
      focusAmountEditor();
    },
    [
      activeLeg,
      activeLegIndex,
      decimalPlaces,
      fillLegRemaining,
      focusAmountEditor,
      setActiveAmountDraft,
      updateLeg,
    ]
  );

  // Shared amount-editor write path (Phase 4): one capped `updateLeg` handler
  // for both faces — behavior identical to the previous inline Full-view
  // lambda, so Simple can never introduce a second money path.
  const handleAmountValueChange = useCallback(
    (value: number | null, draft: string) => {
      if (!activeLeg) return;
      setActiveAmountDraft(draft);
      const option = getMethodOption(activeLeg.method, activeLeg.gateway_code);
      const policy = resolvePaymentOverpaymentPolicy({
        paymentMethodCode: activeLeg.method,
        supportsChangeReturn: option?.supports_change_return,
        supportsOverpayment: option?.supports_overpayment,
        requiresCashDrawer: option?.requires_cash_drawer,
      });
      const cappedAmount = deriveLegAppliedAmount({
        rawAmount: value,
        paymentLegs,
        legIndex: activeLegIndex,
        saleTotal,
        giftCardAmount: giftCardSettlementAmount,
        decimalPlaces,
        walletBalance: activeLeg ? getLegStoredValueCap(activeLeg) : undefined,
        supportsOverpayment: resolveSupportsRetainedOverpayment({
          payExtraIntent: payExtraIntentRef.current,
          policy,
        }),
      });
      notifyIfLegAmountCapped(activeLeg, value, cappedAmount);
      updateLeg(activeLegIndex, 'amount', value);
    },
    [
      activeLeg,
      activeLegIndex,
      decimalPlaces,
      getLegStoredValueCap,
      getMethodOption,
      giftCardSettlementAmount,
      notifyIfLegAmountCapped,
      paymentLegs,
      payExtraIntentRef,
      saleTotal,
      setActiveAmountDraft,
      updateLeg,
    ]
  );

  // ---- Simple-face derivations + handlers (Phase 4) ----
  // Preset-metadata-driven (hardening #5): the SIMPLE preset's chip policy decides
  // which methods surface inline — provably identical to the legacy
  // deriveSimpleModeMethodOptions call (see method-chips.test.ts parity).
  const simpleMethodOptions = useMemo(
    () => applyMethodChipPolicy(realPaymentOptions, SIMPLE_PRESET.methodChips),
    [realPaymentOptions]
  );

  // Advanced → Simple: retarget active leg to a chip-visible tender so the
  // Simple amount/detail editor does not keep showing Stripe/gateway (or other
  // off-chip) legs. Index only — never rewrite amounts (no silent money mutation).
  useEffect(() => {
    if (mode !== PAYMENT_MODAL_MODE.SIMPLE) return;
    const nextIndex = resolveSimpleFaceActiveLegIndex({
      paymentLegs,
      simpleOptions: simpleMethodOptions,
      currentIndex: activeLegIndex,
    });
    if (nextIndex !== activeLegIndex) {
      setActiveLegIndex(nextIndex);
    }
  }, [
    mode,
    paymentLegs,
    simpleMethodOptions,
    activeLegIndex,
    setActiveLegIndex,
  ]);

  const simpleFaceActiveLeg =
    activeLeg && isLegOnSimpleFace(activeLeg, simpleMethodOptions) ? activeLeg : undefined;
  const simpleAmountValue =
    simpleFaceActiveLeg?.method === PAYMENT_METHODS.CASH
      ? simpleFaceActiveLeg.cashTendered ?? simpleFaceActiveLeg.amount ?? null
      : simpleFaceActiveLeg?.amount ?? null;
  const cashDrawerDisplay = selectedCashDrawerChoice
    ? `${getDrawerDisplayName(selectedCashDrawerChoice.drawer)} • ${selectedCashDrawerChoice.session.session_no}`
    : null;
  const simplePolicyLabel =
    effectiveOutstandingPolicy === 'PAY_ON_COLLECTION'
      ? t('remainder.payOnCollection')
      : effectiveOutstandingPolicy === 'CREDIT_INVOICE'
        ? t('remainder.invoiceOutstanding')
        : t('remainder.fullPayment');
  const remainingPolicyDetail =
    effectiveOutstandingPolicy === 'PAY_ON_COLLECTION'
      ? t('rightRail.payOnCollectionHelp')
      : effectiveOutstandingPolicy === 'CREDIT_INVOICE'
        ? t('rightRail.invoiceOutstandingHelp')
        : null;

  const handleSimpleMoreOptions = useCallback(() => {
    setMode(PAYMENT_MODAL_MODE.FULL);
  }, []);
  const handleSimpleManageDrawer = useCallback(() => {
    setMode(PAYMENT_MODAL_MODE.FULL);
    window.setTimeout(() => {
      expandSection(PAYMENT_MODAL_SECTION_IDS.CASH_DRAWER);
      cashDrawerCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
  }, [expandSection]);
  const handleSimpleChangePolicy = useCallback(() => {
    setMode(PAYMENT_MODAL_MODE.FULL);
    window.setTimeout(() => {
      expandSection(PAYMENT_MODAL_SECTION_IDS.BALANCE_POLICY);
      balancePolicySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
  }, [expandSection]);
  // A blocked submit in Simple opens Full so the cashier can see and fix the
  // blocker (the workbench owns the focus-first-issue flow). This is a
  // user-initiated action, not auto-escalation.
  const handleSimpleBlockedSubmitAttempt = useCallback(() => {
    setMode(PAYMENT_MODAL_MODE.FULL);
    window.setTimeout(() => {
      handleBlockedSubmitAttempt();
    }, 150);
  }, [handleBlockedSubmitAttempt]);

  const displayAmountCapNotice = amountCapNotice;
  const displayAmountCapTitle =
    displayAmountCapNotice?.reason === 'cash_no_change'
      ? t('splitPayment.validation.cashOverRemainingTitle')
      : t('payExtraIntent.amountLimitedTitle');

  const handlePayExtraIntentAttempt = useCallback(
    (next: boolean) => {
      attemptPayExtraIntentChange({
        next,
        current: payExtraIntent,
        canEnablePayExtra,
        canAllocateOverpayment,
        excessAmount: unresolvedOverpaymentAmount,
        moneyEpsilon,
        setPayExtraIntent,
        messages: {
          permissionRequired: t('payExtraIntent.permissionRequired', {
            permissionName: t('payExtraIntent.permissionNameAllocate'),
            permissionCode: t('payExtraIntent.permissionCodeAllocate'),
          }),
          cannotDisableWhileExtra: t('payExtraIntent.cannotDisableWhileExtra'),
          disabledNoMethods: t('payExtraIntent.disabledNoMethods'),
        },
      });
    },
    [
      canAllocateOverpayment,
      canEnablePayExtra,
      moneyEpsilon,
      payExtraIntent,
      setPayExtraIntent,
      t,
      unresolvedOverpaymentAmount,
    ]
  );

  const payExtraStripAriaDisabled =
    canEnablePayExtra &&
    ((!canAllocateOverpayment && !payExtraIntent) ||
      (payExtraIntent && unresolvedOverpaymentAmount > moneyEpsilon));

  // The strip mirror displays off the PRE-resolution excess, which persists
  // after routing — `unresolvedOverpaymentAmount` zeroes the moment a payload
  // resolves, so keying the mirror to it made the emerald "resolved" state
  // (amount + destination) vanish instead of showing (QA §6.7).
  const stripExtraAmount = extraReceiptDialogExcessAmount;
  const extraDestinationLabel = useMemo(() => {
    if (!overpaymentResolutionPayload || stripExtraAmount <= moneyEpsilon) {
      return null;
    }
    return getExtraReceiptDestinationLabel(allocation.extraReceiptMode, t);
  }, [
    allocation.extraReceiptMode,
    moneyEpsilon,
    overpaymentResolutionPayload,
    t,
    stripExtraAmount,
  ]);

  // ---- Server-error → capability guard (Phase 5, hardening #2) ----
  // A routed server rejection renders as an in-view guard in the shared footer
  // (both faces); its corrective action opens the owning capability surface in
  // place — every routable capability now has an in-place dialog (no mode hop).
  const serverGuardAffordance = serverGuard
    ? resolveServerGuardAffordance(serverGuard.capability)
    : null;
  const showServerGuardAction =
    !!serverGuardAffordance && serverGuardAffordance !== SERVER_GUARD_AFFORDANCE.NONE;
  // Resolved only when shown — message-only guards (SUBMIT_GUARDS) have no
  // `capabilities.*.action` catalog entry to resolve.
  const serverGuardActionLabel =
    serverGuard && showServerGuardAction
      ? t(`capabilities.${serverGuard.capability}.action`)
      : undefined;
  // QA §4.2: when the CLIENT preview already blocks submit on B2B credit,
  // the server 422 guard can never fire (submit is refused pre-flight) — so
  // the cashier saw only validation text with no corrective button. Surface
  // the same footer guard + "Account billing" action pre-submit. Display/UX
  // only — the server hard-deny (Phase 0B) stays the enforcement point.
  const b2bCreditClientGuard =
    !serverGuard &&
    isB2BCreditLimitBlocking({
      creditLimit: serverTotals?.creditLimit?.creditLimit ?? 0,
      available: serverTotals?.creditLimit?.available ?? 0,
      remainingBalance,
      outstandingPolicy: effectiveOutstandingPolicy,
      epsilon: moneyEpsilon,
    });

  const handleServerGuardAction = useCallback(() => {
    switch (serverGuardAffordance) {
      case SERVER_GUARD_AFFORDANCE.SPLIT_DIALOG:
        setSplitDialogOpen(true);
        break;
      case SERVER_GUARD_AFFORDANCE.GIFT_DIALOG:
        setGiftDialogOpen(true);
        break;
      case SERVER_GUARD_AFFORDANCE.PROMO_DIALOG:
        setPromoDialogOpen(true);
        break;
      case SERVER_GUARD_AFFORDANCE.CREDIT_DIALOG:
        setCreditDialogOpen(true);
        break;
      case SERVER_GUARD_AFFORDANCE.PAY_LATER_DIALOG:
        setPayLaterDialogOpen(true);
        break;
      case SERVER_GUARD_AFFORDANCE.CASH_DRAWER_DIALOG:
        setCashDrawerDialogOpen(true);
        break;
      case SERVER_GUARD_AFFORDANCE.OVERPAYMENT_DIALOG:
        setExtraReceiptDialogOpen(true);
        break;
      case SERVER_GUARD_AFFORDANCE.B2B_DIALOG:
        setB2bDialogOpen(true);
        break;
      default:
        break;
    }
  }, [serverGuardAffordance, setCashDrawerDialogOpen, setExtraReceiptDialogOpen]);

  // Contextual auto-expand (finding 1.8): sections default-collapsed now, but
  // re-open the moment they become operationally relevant. Render-time guarded
  // (Pattern A) — `expandSection` no-ops when already open, and a section the
  // operator collapsed stays collapsed until its signal changes again.
  const activeLegNeedsDetails = Boolean(
    activeLeg &&
      (activeLegOption?.requires_terminal ||
        activeLegOption?.requires_reference ||
        activeLeg.method === PAYMENT_METHODS.CHECK ||
        activeLeg.method === 'CREDIT_NOTE')
  );
  const autoExpandSectionIds = deriveAutoExpandPaymentSections({
    workspaceNeedsAttention: Boolean(requiredActionCopy) || activeLegNeedsDetails,
    cashDrawerBlocking: Boolean(cashDrawerRequired && cashDrawerBlockingMessage),
    balancePolicyRelevant: showBalancePolicySection && remainingBalance > moneyEpsilon,
    discountsCreditsActive:
      pinRequired || !!appliedGiftCard || !!appliedPromoCode || !!giftCardDetails,
  });
  const autoExpandSignature = autoExpandSectionIds.join('|');
  const [prevAutoExpandSignature, setPrevAutoExpandSignature] = useState('');
  if (autoExpandSignature !== prevAutoExpandSignature) {
    setPrevAutoExpandSignature(autoExpandSignature);
    for (const sectionId of autoExpandSectionIds) {
      expandSection(sectionId);
    }
  }

  // Balance-status transition announcer (finding 1.4): a polite live region
  // driven by the right-rail status machine, so screen readers hear
  // "Fully settled — change X" the moment the state flips.
  const balanceStatusAnnouncement =
    rightRailState.balanceStatus === RIGHT_RAIL_BALANCE_STATUS.FULLY_SETTLED &&
    displayChangeAmount > moneyEpsilon
      ? t('a11y.settledWithChange', {
          amount: `${currencyCode} ${formatAmount(displayChangeAmount)}`,
        })
      : balanceStatusLabel;

  // Initial focus (polish): place focus on the amount editor when the modal
  // opens with an editable leg, instead of the focus trap's first tabbable.
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      if (amountInputRef.current && !amountInputRef.current.disabled) {
        amountInputRef.current.focus();
        amountInputRef.current.select();
      }
    }, 150);
    return () => window.clearTimeout(timer);
  }, [open]);

  const onSubmitForm = (data: PaymentFormData) => {
    if (totalsLoading) {
      cmxMessage.info(t('calculating'));
      return;
    }

    if (!serverTotals && items.length > 0) {
      cmxMessage.error(t('errors.invalidAmount'));
      return;
    }

    if (pinRequired) {
      setPinFieldError(t('giftCard.pinPendingError'));
      pinInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      pinInputRef.current?.focus();
      return;
    }

    const submissionData: PaymentFormData = {
      ...data,
      giftCardNumber: appliedGiftCard ? appliedGiftCard.number : undefined,
      giftCardAmount: appliedGiftCard ? appliedGiftCard.amount : undefined,
      giftCardId: appliedGiftCard ? giftCardDetails?.id : undefined,
    } as PaymentFormData;

    for (const { leg } of settlementLegEntries) {
      if (!leg.amount || leg.amount <= 0) {
        cmxMessage.error(t('splitPayment.validation.amountMustBePositive'));
        return;
      }
      if (leg.method === PAYMENT_METHODS.CHECK && !leg.checkNumber?.trim()) {
        cmxMessage.error(t('splitPayment.validation.checkNumberRequired'));
        return;
      }
      if (leg.method === PAYMENT_METHODS.CHECK && (leg.amount ?? 0) > 0) {
        const checkDateIssue = validateCheckDueDate(leg.checkDate);
        if (checkDateIssue) {
          cmxMessage.error(t(`splitPayment.${checkDateIssue}`));
          return;
        }
      }
      if (leg.method === 'CREDIT_NOTE' && !leg.creditReferenceId?.trim()) {
        cmxMessage.error(t('customerCredits.creditNoteRequired'));
        return;
      }
      const legOption = getMethodOption(leg.method, leg.gateway_code);
      if (legOption?.requires_terminal && !leg.terminalId?.trim()) {
        cmxMessage.error(
          t('splitPayment.validation.terminalRequired', {
            method: getCheckoutOptionDisplayName(legOption, leg.method),
          })
        );
        return;
      }
    }

    if (settlementLegEntries.length > 1) {
      const legSum = settlementLegEntries.reduce((sum, { leg }) => sum + (leg.amount || 0), 0);
      if (Math.abs(legSum - settledNowAmount) > 0.001) {
        cmxMessage.error(t('splitPayment.validation.sumMismatch'));
        return;
      }
    }

    if (overpaymentBlocksSubmit) {
      cmxMessage.error(
        payExtraIntent && validationPhase !== 'ready'
          ? t('validatePayment.requiredBeforeSubmit')
          : t('rightRail.requiredAction.overpaymentMessage', {
              amount: `${currencyCode} ${formatAmount(unresolvedOverpaymentAmount)}`,
            })
      );
      return;
    }

    if (walletLegExceedsLiveBalance) {
      cmxMessage.error(
        t('customerCredits.walletBalanceExceeded', {
          amount: liveWalletBalanceDisplay,
        })
      );
      return;
    }

    if (storedValueLegExceedsBalance && storedValueLegExceedance && !walletLegExceedsLiveBalance) {
      cmxMessage.error(
        t('customerCredits.storedValueBalanceExceeded', {
          method: getCheckoutOptionDisplayName(
            getMethodOption(storedValueLegExceedance.leg.method, storedValueLegExceedance.leg.gateway_code),
            storedValueLegExceedance.leg.method
          ),
          amount: `${currencyCode} ${formatAmount(storedValueLegExceedance.cap)}`,
        })
      );
      return;
    }

    if (remainingBalance > 0.001 && effectiveOutstandingPolicy === 'NONE') {
      cmxMessage.error(t('remainder.validation.required'));
      return;
    }

    if (cashDrawerRequired && cashDrawerBlockingMessage) {
      scrollAndFocusTarget(cashDrawerCardRef.current);
      cmxMessage.error(cashDrawerBlockingMessage);
      return;
    }

    // Pure payload assembly (Phase 2F — use-payment-submit). The validation guards
    // above, the safeParse below, and the confirm/onSubmit flow stay in the view.
    const payload = buildPaymentPayload({
      settledNowAmount,
      totals,
      saleTotal,
      currencyConfig,
      effectiveOutstandingPolicy,
      creditLimitOverride,
      cashDrawerRequired,
      selectedCashDrawerSessionId,
      taxProfileEntries,
      settlementLegEntries,
      paymentLegs,
      overpaymentResolutionPayload,
      extraReceiptMode: allocation.extraReceiptMode,
      unresolvedOverpaymentAmount,
      allocationPreviewId: allocation.allocationPreviewId,
    });
    const parsed = newOrderPaymentPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      cmxMessage.error(first ? `${first.path.join('.')}: ${first.message}` : t('errors.invalidAmount'));
      return;
    }
    if (invalidImmediateAmount) {
      cmxMessage.error(t('partialPayment.validation.amountMustBePositive'));
      return;
    }
    setPendingSubmission({
      paymentData: submissionData,
      payload: {
      ...parsed.data,
      creditLimitOverride: creditLimitOverride || undefined,
      ...(cashDrawerRequired && selectedCashDrawerSessionId && {
        cashDrawerSessionId: selectedCashDrawerSessionId,
      }),
      },
    });
    setSubmitConfirmOpen(true);
  };

  const closeWithGuard = useCallback(() => {
    if (!isDirtySinceOpen) {
      onClose();
      return;
    }
    setConfirmCloseOpen(true);
  }, [isDirtySinceOpen, onClose]);

  const handleConfirmPaymentSubmit = useCallback(() => {
    if (!pendingSubmission) return;
    const { paymentData, payload } = pendingSubmission;
    setSubmitConfirmOpen(false);
    setPendingSubmission(null);
    onSubmit(paymentData, payload);
  }, [onSubmit, pendingSubmission]);

  // Phase 5 — guardrailed shortcuts (Enter/F2/Ctrl+Enter). Fires the SAME CTA
  // gate; disabled while busy / blocked / any nested dialog is open / focus is
  // in an editable control (see use-payment-shortcuts.ts for the locked matrix).
  usePaymentShortcuts({
    enabled: open,
    submitBusy,
    blocked: submitHasBlockingIssues,
    dialogOpen:
      confirmCloseOpen ||
      submitConfirmOpen ||
      cashDrawerDialogOpen ||
      creditNotePickerOpen ||
      extraReceiptDialogOpen ||
      allocation.autoDrawerOpen ||
      allocation.manualDrawerOpen ||
      // Capability dialogs (in-place surfaces) equally suppress the submit
      // shortcuts — Enter must never submit the order behind an open dialog.
      splitDialogOpen ||
      creditDialogOpen ||
      giftDialogOpen ||
      promoDialogOpen ||
      payLaterDialogOpen ||
      b2bDialogOpen,
    onSubmit: () => {
      handleSubmit(onSubmitForm, onInvalidForm)();
    },
  });

  if (!open) return null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <>
      <CmxDialog open={open} onOpenChange={(nextOpen) => !nextOpen && closeWithGuard()}>
        <CmxDialogContent
          data-testid="payment-modal-v4"
          className="mx-4 h-[94vh] w-[calc(100vw-2rem)] max-w-[1900px] overflow-hidden rounded-2xl border border-slate-200/80 p-0 shadow-2xl"
          bodyPadding="none"
        >
          <div
            ref={focusTrapRef}
            className="relative flex h-full flex-col bg-[rgb(var(--cmx-background-rgb,255_255_255))]"
          >
            <CmxDialogHeader className="flex items-center justify-between border-b bg-white">
              <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <CmxDialogTitle>{t('title')}</CmxDialogTitle>
                {isExpress && <Badge variant="secondary" className="text-xs">{tTopBar('expressLabel')}</Badge>}
                <Badge variant="secondary" className="text-xs">{currencyCode}</Badge>
              </div>
              <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <PaymentModeToggle
                  mode={mode}
                  onModeChange={handleModeChange}
                  simpleLabel={t('mode.simple')}
                  fullLabel={t('mode.advanced')}
                  groupLabel={t('mode.toggleLabel')}
                  isRTL={isRTL}
                />
                <CmxButton type="button" variant="ghost" size="sm" onClick={closeWithGuard} aria-label={tCommon('close')}>
                  <X className="h-5 w-5" />
                </CmxButton>
              </div>
            </CmxDialogHeader>

            <PayExtraTopStrip
              checked={payExtraIntent}
              onAttemptChange={handlePayExtraIntentAttempt}
              disabled={!canEnablePayExtra}
              disabledReason={
                !checkoutMethodsLoading && !canEnablePayExtra
                  ? t('payExtraIntent.disabledNoMethods')
                  : undefined
              }
              ariaDisabled={payExtraStripAriaDisabled}
              isRTL={isRTL}
              extraAmountLabel={
                stripExtraAmount > moneyEpsilon
                  ? `${currencyCode} ${formatAmount(stripExtraAmount)}`
                  : null
              }
              extraDestinationLabel={extraDestinationLabel}
              extraUnresolved={
                stripExtraAmount > moneyEpsilon && !overpaymentResolutionPayload
              }
              extraResolved={
                stripExtraAmount > moneyEpsilon && Boolean(overpaymentResolutionPayload)
              }
            />

            {newLegRejectAlert ? (
              <CmxSummaryMessage
                type="warning"
                title={t('payExtraIntent.newLegRejectedAlertTitle')}
                items={[newLegRejectAlert]}
                onDismiss={clearNewLegRejectAlert}
              />
            ) : null}

            {/* Mode feedback (amended ADR): a dismissible suggestion while Simple
                is selected and advanced conditions are present — never a forced
                switch. Polite live region. */}
            {mode === PAYMENT_MODAL_MODE.SIMPLE &&
            needsAdvanced &&
            !suggestionDismissed &&
            needsAdvancedReasons.length > 0 ? (
              <PaymentModeSuggestion
                title={t('mode.suggestTitle')}
                reasons={needsAdvancedReasons
                  .slice(0, 3)
                  .map((reason) => t(`mode.reasons.${reason}`))}
                actionLabel={t('mode.suggestAction')}
                onAccept={() => handleModeChange(PAYMENT_MODAL_MODE.FULL)}
                dismissLabel={t('mode.suggestDismiss')}
                onDismiss={() => setSuggestionDismissed(true)}
                isRTL={isRTL}
              />
            ) : null}

            {/* Split-tender capability dialog — opened in-place from the Simple
                fast-lane quick action (portal overlay; engine owns leg state). */}
            <SplitTenderDialog
              open={splitDialogOpen}
              onOpenChange={setSplitDialogOpen}
              actions={splitTenderActions}
              paymentLegs={paymentLegs}
              activeLegIndex={activeLegIndex}
              methodOptions={realPaymentOptions}
              getOptionDisplayName={getCheckoutOptionDisplayName}
              amountDue={saleTotal}
              legsTotal={paymentLegsTotal}
              remainingBalance={remainingBalance}
              moneyEpsilon={moneyEpsilon}
              currencyCode={currencyCode}
              formatAmount={formatAmount}
              decimalPlaces={decimalPlaces}
              branchPaymentTerminals={branchPaymentTerminals}
              cardBrands={cardBrands}
              creditMethodCodes={creditMethodCodes}
              payExtraIntent={payExtraIntent}
            />

            <CustomerCreditDialog
              open={creditDialogOpen}
              onOpenChange={setCreditDialogOpen}
              actions={customerCreditActions}
              creditOptions={customerCreditOptions}
              paymentLegs={paymentLegs}
              getOptionDisplayName={getCheckoutOptionDisplayName}
              storedValueSummary={storedValueSummary}
              storedValueLoading={storedValueLoading}
              storedValueFetching={storedValueFetching}
              refetchStoredValueSummary={refetchStoredValueSummary}
              walletBalanceLoaded={walletBalanceLoaded}
              walletHasAvailableBalance={walletHasAvailableBalance}
              liveWalletBalanceDisplay={liveWalletBalanceDisplay}
              walletLegExceedsLiveBalance={walletLegExceedsLiveBalance}
              currencyCode={currencyCode}
              formatAmount={formatAmount}
            />

            <GiftCardDialog
              open={giftDialogOpen}
              onOpenChange={setGiftDialogOpen}
              actions={giftCardActions}
              giftCardNumber={giftCardNumber ?? ''}
              onGiftCardNumberChange={(value) =>
                setValue('giftCardNumber', value.toUpperCase())
              }
              giftCardAmount={giftCardAmount}
              onGiftCardAmountChange={(value) => setValue('giftCardAmount', value)}
              giftCardValidating={giftCardValidating}
              giftCardResult={giftCardResult}
              giftCardDetails={giftCardDetails}
              appliedGiftCard={appliedGiftCard}
              giftCardPin={giftCardPin}
              pinRequired={pinRequired}
              pinVisible={pinVisible}
              pinFieldError={pinFieldError}
              resolveGiftCardError={resolveGiftCardError}
              remainingBalance={remainingBalance}
              moneyEpsilon={moneyEpsilon}
              currencyCode={currencyCode}
              formatAmount={formatAmount}
              pinInputRef={pinInputRef}
              giftCardAmountInputRef={giftCardAmountInputRef}
            />

            <PromoCodeDialog
              open={promoDialogOpen}
              onOpenChange={setPromoDialogOpen}
              actions={promoCodeActions}
              promoCode={promoCode ?? ''}
              onPromoCodeChange={(value) => setValue('promoCode', value.toUpperCase())}
              promoCodeValidating={promoCodeValidating}
              promoCodeResult={promoCodeResult}
              appliedPromoCode={appliedPromoCode}
              promoErrorMessage={promoErrorMessage}
              currencyCode={currencyCode}
              formatAmount={formatAmount}
            />

            <PayLaterDialog
              open={payLaterDialogOpen}
              onOpenChange={setPayLaterDialogOpen}
              actions={payLaterActions}
              selectedPolicy={effectiveOutstandingPolicy}
            />

            {/* B2B account-billing capability dialog — opened in-place from the
                Simple quick action or a routed server guard (ADR #3: a required
                gate, never a mode change). Fields mirror the Full-view inspector
                tab through the shared RHF form. */}
            <B2BAccountBillingDialog
              open={b2bDialogOpen}
              onOpenChange={setB2bDialogOpen}
              required={b2bBillingRequired}
              b2bContractId={b2bContractId}
              onB2bContractIdChange={(value) => setValue('b2bContractId', value)}
              contracts={b2bContracts}
              contractsLoading={b2bContractsLoading}
              costCenterCode={costCenterCode}
              onCostCenterCodeChange={(value) => setValue('costCenterCode', value)}
              poNumber={poNumber}
              onPoNumberChange={(value) => setValue('poNumber', value)}
              creditLimit={b2bCreditLimitInfo}
              currencyCode={currencyCode}
              formatAmount={formatAmount}
            />

            <form
              onSubmit={(event) => event.preventDefault()}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="flex-1 overflow-auto bg-[rgb(var(--cmx-background-rgb,248_250_252))] p-4">
              {mode === PAYMENT_MODAL_MODE.SIMPLE ? (
                <PaymentSimpleView
                  currencyCode={currencyCode}
                  decimalPlaces={decimalPlaces}
                  formatAmount={formatAmount}
                  moneyEpsilon={moneyEpsilon}
                  totalsLoading={totalsLoading}
                  submitBusy={submitBusy}
                  methodsLoading={checkoutMethodsLoading}
                  methodOptions={simpleMethodOptions}
                  paymentLegs={paymentLegs}
                  activeLeg={simpleFaceActiveLeg}
                  activeLegIndex={activeLegIndex}
                  getOptionDisplayName={getCheckoutOptionDisplayName}
                  onMethodSelect={handleMethodSelect}
                  onMoreOptions={handleSimpleMoreOptions}
                  showDiscounts={showDiscountsCreditsSection}
                  discountControl={control}
                  discountSetValue={setValue}
                  discountErrors={errors}
                  discountTotal={total}
                  amountInputRef={amountInputRef}
                  activeAmountDraft={
                    simpleFaceActiveLeg ? activeAmountDraft : ''
                  }
                  amountValue={simpleAmountValue}
                  onAmountValueChange={(value, draft) => {
                    if (!simpleFaceActiveLeg) return;
                    handleAmountValueChange(value, draft);
                  }}
                  amountCapHint={
                    simpleFaceActiveLeg
                      ? (displayAmountCapNotice?.message ?? null)
                      : null
                  }
                  payExtraIntent={payExtraIntent}
                  quickTenderItems={
                    simpleFaceActiveLeg ? quickTenderChipItems : []
                  }
                  onQuickTenderSelect={(item) => {
                    if (!simpleFaceActiveLeg) return;
                    handleQuickTenderSelect(item);
                  }}
                  onKeypadPress={(key) => {
                    if (!simpleFaceActiveLeg) return;
                    handleKeypadPress(key);
                  }}
                  activeLegOption={
                    simpleFaceActiveLeg ? activeLegOption : undefined
                  }
                  updateLeg={updateLeg}
                  branchPaymentTerminals={branchPaymentTerminals}
                  cardBrands={cardBrands}
                  creditMethodCodes={creditMethodCodes}
                  cashDrawerRequired={cashDrawerRequired}
                  cashDrawerDisplay={cashDrawerDisplay}
                  onManageCashDrawer={handleSimpleManageDrawer}
                  orderValueBreakdown={orderValueBreakdownModel}
                  orderValueBreakdownLabels={{
                    grossValue: t('orderValue.grossValue'),
                    grossValueHelp: t('orderValue.grossValueHelp'),
                    discounts: t('orderValue.discounts'),
                    discountsHelp: t('orderValue.discountsHelp'),
                    taxes: t('orderValue.taxes'),
                    taxesHelp: t('orderValue.taxesHelp'),
                  }}
                  orderValueBreakdownTaxLoading={totalsLoading && items.length > 0 && !serverTotals}
                  saleTotal={saleTotal}
                  amountAppliedToOrder={amountAppliedToOrder}
                  displayChangeAmount={displayChangeAmount}
                  remainingBalance={remainingBalance}
                  settled={rightRailState.balanceStatus === RIGHT_RAIL_BALANCE_STATUS.FULLY_SETTLED}
                  balanceStatusLabel={balanceStatusLabel}
                  balanceStatusAnnouncement={balanceStatusAnnouncement}
                  policyLabel={simplePolicyLabel}
                  onChangeBalancePolicy={handleSimpleChangePolicy}
                  quickActions={
                    simpleQuickActionsPlan.length > 0 ? (
                      <CmxCard className="h-full border-slate-200 bg-white shadow-sm md:sticky md:top-0">
                        <CmxCardContent className="flex h-full flex-col gap-2.5 pt-4 pb-4">
                          <p
                            className={`text-[11px] font-semibold uppercase tracking-wide text-slate-500 ${isRTL ? 'text-right' : 'text-left'}`}
                          >
                            {t('mode.simpleView.quickActionsTitle')}
                          </p>
                          {/* Tile rail: fills the left column with no dead gap;
                              2-col grid on narrow screens when stacked below pay. */}
                          <CapabilityViewRenderer
                            plan={simpleQuickActionsPlan}
                            isRTL={isRTL}
                            actionVariant="tile"
                            actionLayout="stack"
                            className="min-h-0 flex-1"
                            renderInline={() => null}
                            dialogButtonLabel={(slot) => t(`capabilities.${slot.key}.action`)}
                            dialogButtonIcon={(slot) => {
                              const Icon = getCapabilityActionIcon(slot.key);
                              return <Icon />;
                            }}
                            requiredBadgeLabel={t('capabilities.dialog.required')}
                            onOpenCapability={(slot) => {
                              // Every quick-action opens its capability dialog
                              // in-place (Simple stays selected — ADR). CASH_CARD_SPLIT
                              // reuses the split dialog; OVERPAYMENT_ROUTING reuses the
                              // extra-receipt dialog. The Advanced fallback remains only
                              // as defense for a future capability without a dialog.
                              if (
                                slot.key === PAYMENT_CAPABILITY.SPLIT_TENDER ||
                                slot.key === PAYMENT_CAPABILITY.CASH_CARD_SPLIT
                              ) {
                                setSplitDialogOpen(true);
                              } else if (slot.key === PAYMENT_CAPABILITY.GIFT_CARD) {
                                setGiftDialogOpen(true);
                              } else if (slot.key === PAYMENT_CAPABILITY.CUSTOMER_CREDIT) {
                                setCreditDialogOpen(true);
                              } else if (slot.key === PAYMENT_CAPABILITY.PROMO_CODE) {
                                setPromoDialogOpen(true);
                              } else if (slot.key === PAYMENT_CAPABILITY.PAY_LATER) {
                                setPayLaterDialogOpen(true);
                              } else if (
                                slot.key === PAYMENT_CAPABILITY.B2B_ACCOUNT_BILLING
                              ) {
                                setB2bDialogOpen(true);
                              } else if (
                                slot.key === PAYMENT_CAPABILITY.OVERPAYMENT_ROUTING
                              ) {
                                setExtraReceiptDialogOpen(true);
                              } else {
                                handleSimpleMoreOptions();
                              }
                            }}
                            resolveGuard={() => null}
                          />
                        </CmxCardContent>
                      </CmxCard>
                    ) : null
                  }
                />
              ) : (
              <div className="mx-auto grid min-h-full max-w-[1880px] items-start gap-4 md:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(720px,1fr)_360px]">
                {/* Phase 6: on md–xl the tools column scrolls internally so the
                    workbench (keypad, chips, CTA) stays above the fold. */}
                <aside className="min-w-0 md:sticky md:top-0 md:max-h-[calc(94vh-16rem)] md:self-start md:overflow-y-auto xl:static xl:max-h-none xl:overflow-visible">
                  <CmxCard className="overflow-hidden border-cyan-100 bg-white/95 shadow-sm">
                    <CmxCardHeader className="border-b border-cyan-100 pb-3">
                      <CmxCardTitle className={`flex items-center gap-2 text-base font-semibold text-cyan-900 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                        <CreditCard className="h-4 w-4 text-cyan-700" />
                        {t('sections.paymentTools')}
                      </CmxCardTitle>
                      <p className={`mt-1 text-xs text-slate-500 ${isRTL ? 'text-right' : 'text-left'}`}>
                        {t('sections.paymentToolsHelp')}
                      </p>
                    </CmxCardHeader>
                    <CmxCardContent className="space-y-3 pt-3">
                {/* Phase 4 strangler: FX/rounding reference line routed through the
                    capability renderer (additive — this line was never rendered
                    before). Double-gated: registry availability + the line's own
                    epsilon null-guard. */}
                <CapabilityViewRenderer
                  plan={migratedCapabilityPlan}
                  isRTL={isRTL}
                  renderInline={(slot) =>
                    slot.key === PAYMENT_CAPABILITY.FX_ROUNDING ? (
                      <FxRoundingLine
                        exchangeRate={currencyConfig?.currencyExRate ?? 1}
                        roundingAmount={0}
                        moneyEpsilon={moneyEpsilon}
                        currencyCode={currencyCode}
                        formatAmount={formatAmount}
                      />
                    ) : null
                  }
                  dialogButtonLabel={() => ''}
                  onOpenCapability={() => undefined}
                  resolveGuard={() => null}
                />
                <div className="space-y-3">
                  <div>
                  <CmxCard className="overflow-hidden border-slate-200 bg-white/95 shadow-sm">
                    <CmxCardHeader className="border-b border-slate-100 pb-3">
                      <CmxCardTitle className={`flex items-center gap-2 text-xs font-semibold ${labelCaseWide} text-slate-500 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        {t('methods.title')}
                        <Info className="h-3.5 w-3.5 text-slate-400" />
                      </CmxCardTitle>
                    </CmxCardHeader>
                    <CmxCardContent className="space-y-3">
                      {/* Finding 1.9: three distinct states — loading (skeletons),
                          API failure (retry), genuinely-empty (guidance + settings link). */}
                      {checkoutMethodsLoading ? (
                        <div className="space-y-2">
                          <CmxSkeleton className="h-14 w-full" />
                          <CmxSkeleton className="h-14 w-full" />
                          <CmxSkeleton className="h-14 w-full" />
                        </div>
                      ) : checkoutOptionsIsError ? (
                        <CmxEmptyState
                          icon={<CircleAlert className="h-8 w-8 text-rose-500" />}
                          title={t('methods.loadFailedTitle')}
                          description={t('methods.loadFailedDescription')}
                          action={
                            <CmxButton
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => void refetchCheckoutOptions()}
                              className="min-h-[44px] rounded-xl"
                            >
                              <RefreshCw className="me-2 h-4 w-4" />
                              {tCommon('retry')}
                            </CmxButton>
                          }
                        />
                      ) : realPaymentOptions.length === 0 ? (
                        <CmxEmptyState
                          icon={<CreditCard className="h-8 w-8 text-slate-400" />}
                          title={t('methods.noMethods')}
                          description={t('methods.noMethodsGuidance')}
                          action={
                            <CmxButton asChild type="button" variant="outline" size="sm" className="min-h-[44px] rounded-xl">
                              <Link href="/dashboard/settings/payments">
                                {t('methods.configureLink')}
                              </Link>
                            </CmxButton>
                          }
                        />
                      ) : (
                        realPaymentOptions.map((option) => {
                          const optionLabel = getCheckoutOptionDisplayName(option, option.payment_method_code);
                          const methodKey = `${option.payment_method_code}::${option.gateway_code ?? ''}`;
                          const isActive =
                            activeLeg != null &&
                            `${activeLeg.method}::${activeLeg.gateway_code ?? ''}` === methodKey;
                          const hasLeg = paymentLegs.some(
                            (leg) =>
                              `${leg.method}::${leg.gateway_code ?? ''}` === methodKey
                          );
                          const tone = getMethodToneClasses(option.payment_method_code);
                          const description = isRTL
                            ? (option.description2 || option.description)
                            : (option.description || option.description2);
                          return (
                            <CmxButton
                              key={methodKey}
                              type="button"
                              data-testid={`payment-method-${methodKey
                                .toLowerCase()
                                .replace(/[^a-z0-9]+/g, '-')
                                .replace(/^-|-$/g, '')}`}
                              variant="outline"
                              size="lg"
                              aria-pressed={isActive}
                              onClick={() => handleMethodSelect(option)}
                              className={`h-auto w-full justify-start rounded-2xl border px-4 py-4 ${
                                isActive
                                  ? tone.selected
                                  : hasLeg
                                    ? 'border-slate-300 bg-slate-50 text-slate-900 hover:border-slate-400'
                                    : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300'
                              } ${isRTL ? 'flex-row-reverse' : ''}`}
                            >
                              <span className={`flex w-full items-start gap-3 ${isRTL ? 'flex-row-reverse text-right' : 'text-left'}`}>
                                <span className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${tone.iconWrap}`}>
                                  {getPaymentIcon(option.payment_method_code)}
                                </span>
                                <span className="flex min-w-0 flex-1 flex-col">
                                  <span className="flex items-start justify-between gap-2">
                                    <span className="text-[15px] font-semibold leading-5 text-slate-900">{optionLabel}</span>
                                    {option.payment_method_code === defaultPaymentMethod && (
                                      <Badge variant="secondary" className="rounded-full bg-teal-600 px-2.5 py-1 text-[11px] font-semibold text-white">
                                        {t('methods.defaultBadge')}
                                      </Badge>
                                    )}
                                  </span>
                                  <span className="mt-1 text-sm text-slate-600">
                                    {description || (option.requires_cash_drawer
                                      ? t('methods.touchHintCashDrawer')
                                      : t('methods.touchHintImmediate'))}
                                  </span>
                                  <span className="mt-1 text-xs font-medium text-slate-500">
                                    {getMethodHint(option)}
                                  </span>
                                </span>
                              </span>
                            </CmxButton>
                          );
                        })
                      )}
                    </CmxCardContent>
                  </CmxCard>
                  </div>

                  <CmxCard className="overflow-hidden border-slate-200 bg-white/95 shadow-sm">
                    <CmxCardHeader className="border-b border-slate-100 pb-2">
                      <CmxCardTitle className={`text-xs font-semibold ${labelCaseWide} text-slate-500 flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <Wallet className="h-4 w-4" />
                        {t('customerCredits.title')}
                      </CmxCardTitle>
                    </CmxCardHeader>
                    <CmxCardContent className="space-y-2">
                      {customerCreditOptions.length === 0 ? (
                        <p className="text-xs text-slate-500">{t('customerCredits.empty')}</p>
                      ) : (
                        customerCreditOptions.map((option) => {
                          const optionLabel = getCheckoutOptionDisplayName(option, option.payment_method_code);
                          const methodKey = `${option.payment_method_code}::${option.gateway_code ?? ''}`;
                          const isActive =
                            activeLeg != null &&
                            `${activeLeg.method}::${activeLeg.gateway_code ?? ''}` === methodKey;
                          const hasLeg = paymentLegs.some(
                            (leg) =>
                              `${leg.method}::${leg.gateway_code ?? ''}` === methodKey
                          );
                          const isWalletOption =
                            option.credit_application_type === 'WALLET' ||
                            option.payment_method_code === 'WALLET';
                          const isCreditNoteOption = option.payment_method_code === 'CREDIT_NOTE';
                          const creditNotesAvailable = (storedValueSummary?.creditNotes.length ?? 0) > 0;
                          const disabled =
                            (isCreditNoteOption
                              ? storedValueLoading || !creditNotesAvailable
                              : option.requires_credit_reference_selection) ||
                            (isWalletOption && (storedValueLoading || (walletBalanceLoaded && !walletHasAvailableBalance)));
                          const balanceLabel = isWalletOption
                            ? storedValueLoading
                              ? t('customerCredits.loadingBalance')
                              : walletHasAvailableBalance
                                ? t('customerCredits.available', {
                                    amount: liveWalletBalanceDisplay,
                                  })
                                : t('customerCredits.noWalletBalance')
                            : isCreditNoteOption
                              ? storedValueLoading
                                ? t('customerCredits.loadingBalance')
                                : creditNotesAvailable
                                  ? t('customerCredits.creditNoteSelectHint')
                                  : t('customerCredits.creditNotePickerEmpty')
                            : disabled
                              ? t('customerCredits.referenceSelectionHint')
                              : t('customerCredits.available', {
                                  amount: `${currencyCode} ${formatAmount(option.available_balance ?? 0)}`,
                                });
                          return (
                            <div key={option.id} className="space-y-2">
                              {isWalletOption && (
                                <div className={`flex items-center justify-between gap-2 px-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                  <Badge variant="secondary" className="rounded-full bg-cyan-50 text-cyan-700">
                                    {t('customerCredits.liveBadge')}
                                  </Badge>
                                  <CmxButton
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => void refetchStoredValueSummary()}
                                    disabled={storedValueFetching}
                                    aria-label={t('customerCredits.refreshBalance')}
                                    className="h-8 rounded-xl px-2 text-slate-500"
                                  >
                                    {storedValueFetching ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <RefreshCw className="h-4 w-4" />
                                    )}
                                  </CmxButton>
                                </div>
                              )}
                              <CmxButton
                                type="button"
                                data-testid={`payment-credit-method-${option.payment_method_code.toLowerCase()}`}
                                variant="outline"
                                size="lg"
                                disabled={disabled}
                                aria-pressed={isActive}
                                onClick={() => handleCustomerCreditSelect(option)}
                                className={`h-auto w-full justify-start rounded-2xl border px-4 py-4 ${
                                  isActive
                                    ? 'border-cyan-500 bg-cyan-50/70 text-slate-900 shadow-sm'
                                    : hasLeg
                                      ? 'border-slate-300 bg-slate-50 text-slate-900 hover:border-slate-400'
                                      : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300'
                                } ${disabled ? 'opacity-75' : ''} ${isRTL ? 'flex-row-reverse' : ''}`}
                              >
                                <span className={`flex w-full items-start gap-3 ${isRTL ? 'flex-row-reverse text-right' : 'text-left'}`}>
                                  <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-200 bg-cyan-50 text-cyan-700">
                                    <Wallet className="h-5 w-5" />
                                  </span>
                                  <span className="flex min-w-0 flex-1 flex-col">
                                    <span className="text-sm font-semibold">{optionLabel}</span>
                                    {isWalletOption && storedValueLoading ? (
                                      <CmxSkeleton className="mt-2 h-4 w-40" />
                                    ) : (
                                      <span
                                        className={`mt-1 text-xs font-medium ${
                                          isWalletOption && !walletHasAvailableBalance && walletBalanceLoaded
                                            ? 'text-amber-700'
                                            : 'text-slate-500'
                                        }`}
                                      >
                                        {balanceLabel}
                                      </span>
                                    )}
                                    {isWalletOption && hasLeg && !walletLegExceedsLiveBalance && (
                                      <span className="mt-1 text-xs font-medium text-cyan-700">
                                        {t('customerCredits.applied')}
                                      </span>
                                    )}
                                    {isWalletOption && walletLegExceedsLiveBalance && (
                                      <span className="mt-1 text-xs font-medium text-rose-600">
                                        {t('customerCredits.walletBalanceExceeded', {
                                          amount: liveWalletBalanceDisplay,
                                        })}
                                      </span>
                                    )}
                                  </span>
                                </span>
                              </CmxButton>
                            </div>
                          );
                        })
                      )}
                    </CmxCardContent>
                  </CmxCard>

                  <CmxCard
                    ref={legsCardRef}
                    data-testid="payment-legs-panel"
                    className="overflow-hidden border-slate-200 bg-white/95 shadow-sm"
                  >
                    <CmxCardHeader className="border-b border-slate-100 pb-2">
                      <div className={`flex items-center justify-between gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <CmxCardTitle className={`text-xs font-semibold ${labelCaseWide} text-slate-500`}>
                          {t('splitPayment.title')}
                          {editableLegEntries.length > 0 && (
                            <Badge variant="secondary" className="ms-2 rounded-full bg-slate-100 text-slate-600">
                              {editableLegEntries.length}
                            </Badge>
                          )}
                        </CmxCardTitle>
                        {editableLegEntries.length > 0 && (
                          <span className="text-xs font-semibold text-cyan-700">
                            {t('splitPayment.settledTotal')}: {currencyCode} {formatAmount(splitSidebarSettledTotal)}
                          </span>
                        )}
                      </div>
                    </CmxCardHeader>
                    <CmxCardContent className="space-y-2">
                      {editableLegEntries.length === 0 ? (
                        <p className="text-xs text-slate-500">{t('workspace.addSplitHint')}</p>
                      ) : (
                        editableLegEntries.map(({ leg, index }) => {
                          const option = getMethodOption(leg.method, leg.gateway_code);
                          const label = getCheckoutOptionDisplayName(option, leg.method);
                          const legRemainingCap = getRemainingToAllocate(
                            saleTotal,
                            paymentLegs,
                            giftCardSettlementAmount,
                            index,
                            decimalPlaces
                          );
                          const canFillLeg = legRemainingCap > moneyEpsilon;
                          return (
                          <div
                            key={`payment-leg-summary-${index}`}
                            data-testid={`payment-leg-summary-${index}`}
                            data-active={activeLegIndex === index ? 'true' : 'false'}
                            className={`flex items-stretch gap-2 rounded-2xl border transition ${
                              activeLegIndex === index
                                ? 'border-cyan-500 bg-cyan-50/70 shadow-sm'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <CmxButton
                              type="button"
                              variant="ghost"
                              onClick={() => {
                                setActiveLegIndex(index);
                                focusAmountEditor();
                              }}
                              className={`h-auto min-h-0 flex-1 justify-between rounded-2xl border-0 px-3 py-3 text-sm shadow-none ${
                                activeLegIndex === index
                                  ? 'text-cyan-900 hover:bg-transparent'
                                  : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-xs font-bold text-slate-500">
                                  {index + 1}
                                </span>
                                <span className={`flex h-8 w-8 items-center justify-center rounded-lg border ${getMethodToneClasses(leg.method).iconWrap}`}>
                                  {getPaymentIcon(leg.method)}
                                </span>
                                <span className="font-medium">{label}</span>
                              </span>
                              <span className="flex items-center gap-2">
                                <span className="tabular-nums font-semibold">{currencyCode} {formatAmount(leg.amount || 0)}</span>
                                <EllipsisVertical className="h-4 w-4 text-slate-300" />
                              </span>
                            </CmxButton>
                            <CmxButton
                              type="button"
                              variant="outline"
                              size="xs"
                              data-testid={`payment-leg-fill-${index}`}
                              disabled={!canFillLeg}
                              aria-label={t('splitPayment.fillRemaining')}
                              onClick={() => fillLegRemaining(index)}
                              className="my-2 me-2 min-h-[44px] shrink-0 rounded-xl border-cyan-200 px-2.5 text-cyan-700"
                            >
                              {t('splitPayment.fillRemaining')}
                            </CmxButton>
                          </div>
                        );
                        })
                      )}
                      {/* Polish: inline method picker next to the legs list — replaces
                          the old scroll-to-top context jump. Selection routes through
                          the same handleMethodSelect as the method cards. */}
                      <CmxSelectDropdown
                        value=""
                        onValueChange={(methodKey) => {
                          if (!methodKey) return;
                          const option = realPaymentOptions.find(
                            (candidate) =>
                              `${candidate.payment_method_code}::${candidate.gateway_code ?? ''}` === methodKey
                          );
                          if (option) handleMethodSelect(option);
                        }}
                        emptyLabel={t('methods.noMethods')}
                      >
                        <CmxSelectDropdownTrigger
                          dir={isRTL ? 'rtl' : 'ltr'}
                          aria-label={t('splitPayment.addMethod')}
                          className="min-h-[44px] w-full justify-center rounded-2xl border-dashed border-slate-300 bg-white text-slate-600 hover:border-cyan-400 hover:text-cyan-700"
                        >
                          <span className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <Plus className="h-4 w-4" />
                            {t('splitPayment.addMethod')}
                          </span>
                        </CmxSelectDropdownTrigger>
                        <CmxSelectDropdownContent>
                          {realPaymentOptions.map((option) => {
                            const methodKey = `${option.payment_method_code}::${option.gateway_code ?? ''}`;
                            return (
                              <CmxSelectDropdownItem key={methodKey} value={methodKey}>
                                {getCheckoutOptionDisplayName(option, option.payment_method_code)}
                              </CmxSelectDropdownItem>
                            );
                          })}
                        </CmxSelectDropdownContent>
                      </CmxSelectDropdown>
                      {activeLeg && (
                        <CmxButton
                          type="button"
                          variant="ghost"
                          size="sm"
                          data-testid="payment-remove-active-leg"
                          onClick={() => removeLegAt(activeLegIndex)}
                          className="w-full justify-center text-rose-600"
                        >
                          <Trash2 className="mr-1 h-4 w-4" />
                          {t('splitPayment.remove')}
                        </CmxButton>
                      )}
                    </CmxCardContent>
                  </CmxCard>
                </div>
                    </CmxCardContent>
                  </CmxCard>
                </aside>

                <section className="min-w-0">
                  <CmxCard className="overflow-hidden border-cyan-100 bg-white/95 shadow-sm">
                    <CmxCardHeader className="border-b border-cyan-100 pb-3">
                      <div className={`flex items-start justify-between gap-3 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                        <div>
                          <CmxCardTitle className={`flex items-center gap-2 text-base font-semibold text-cyan-900 ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <Maximize2 className="h-4 w-4 text-cyan-700" />
                            {t('sections.paymentWorkbench')}
                          </CmxCardTitle>
                          <p className="mt-1 text-xs text-slate-500">{t('sections.paymentWorkbenchHelp')}</p>
                        </div>
                        <Badge variant="secondary" className="rounded-full bg-cyan-50 px-3 py-1 text-cyan-700">
                          {visiblePaymentSectionIds.size}
                        </Badge>
                      </div>
                    </CmxCardHeader>
                    <CmxCardContent className="space-y-3 pt-3">
                <div className="space-y-3">
                  <PaymentWorkbenchSection
                    sectionRef={balanceSnapshotSectionRef}
                    sectionId={PAYMENT_MODAL_SECTION_IDS.BALANCE_SNAPSHOT}
                    expanded={isSectionExpanded(PAYMENT_MODAL_SECTION_IDS.BALANCE_SNAPSHOT)}
                    collapsible={isSectionCollapsible(PAYMENT_MODAL_SECTION_IDS.BALANCE_SNAPSHOT)}
                    onToggle={toggleSection}
                    cardClassName="border-cyan-100 bg-white"
                    headerClassName="border-cyan-100"
                    titleClassName="text-sm text-cyan-900"
                    isRTL={isRTL}
                    expandLabel={workbenchSectionToggleLabels.expandLabel}
                    collapseLabel={workbenchSectionToggleLabels.collapseLabel}
                    title={`${t('sections.sectionA')} · ${t('sections.balanceSnapshot')}`}
                    description={t('sections.balanceSnapshotHelp')}
                    headerAside={(
                      <Badge variant="secondary" className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        unresolvedOverpaymentAmount > moneyEpsilon
                          ? 'bg-rose-50 text-rose-700'
                          : remainingBalance > moneyEpsilon
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        {allocationStatusLabel}
                      </Badge>
                    )}
                    contentClassName="pt-4"
                  >
                      {/* Finding 1.1: one hero metric (Remaining) + compact companions.
                          The right-rail Balance Result stays the source of truth. */}
                      <div className={`flex flex-wrap items-end justify-between gap-x-6 gap-y-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <div data-testid="payment-balance-remaining" className={isRTL ? 'text-right' : 'text-left'}>
                          <p className="text-xs font-semibold text-slate-500">{t('workspace.remaining')}</p>
                          <p className={`mt-1 text-3xl font-bold tabular-nums transition-colors duration-300 motion-reduce:transition-none ${remainingBalance > moneyEpsilon ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {currencyCode} {formatAmount(remainingBalance)}
                          </p>
                        </div>
                        <div className={`flex flex-wrap items-end gap-x-6 gap-y-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <div data-testid="payment-balance-total-due" className={isRTL ? 'text-right' : 'text-left'}>
                            <p className="text-xs font-semibold text-slate-500">{t('workspace.totalDue')}</p>
                            <p className="mt-1 text-sm font-semibold tabular-nums text-slate-900">{currencyCode} {formatAmount(saleTotal)}</p>
                          </div>
                          <div data-testid="payment-balance-change" className={isRTL ? 'text-right' : 'text-left'}>
                            <p className="text-xs font-semibold text-slate-500">{t('workspace.change')}</p>
                            <p className={`mt-1 text-sm font-semibold tabular-nums ${displayChangeAmount > moneyEpsilon ? 'text-emerald-600' : 'text-slate-900'}`}>
                              {currencyCode} {formatAmount(displayChangeAmount)}
                            </p>
                          </div>
                          {unresolvedOverpaymentAmount > moneyEpsilon ? (
                            <div data-testid="payment-balance-overpaid" className={isRTL ? 'text-right' : 'text-left'}>
                              <p className="text-xs font-semibold text-rose-600">{t('rightRail.overpaidAmount')}</p>
                              <p className="mt-1 text-sm font-semibold tabular-nums text-rose-600">
                                {currencyCode} {formatAmount(unresolvedOverpaymentAmount)}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      </div>
                  </PaymentWorkbenchSection>

                  {unresolvedOverpaymentAmount > moneyEpsilon && !payExtraIntent ? (
                    <div ref={extraReceiptCardRef} tabIndex={-1} className="outline-none">
                      <ExtraReceiptHandlingCard
                        excessAmount={unresolvedOverpaymentAmount}
                        currencyCode={currencyCode}
                        formatAmount={formatAmount}
                        hasLinkedCustomer={Boolean(customerId?.trim())}
                        selectedMode={allocation.extraReceiptMode}
                        onModeChange={(mode) => {
                          allocation.setExtraReceiptMode(mode);
                          if (
                            mode !== OVERPAYMENT_RESOLUTIONS.AUTO_ALLOCATE_TO_CUSTOMER_BALANCES &&
                            mode !== OVERPAYMENT_RESOLUTIONS.ALLOCATE_TO_CUSTOMER_BALANCES
                          ) {
                            allocation.resetAllocationState();
                          }
                        }}
                        onOpenAutoAllocate={
                          canAllocateOverpayment
                            ? () => void allocation.handleOpenAutoAllocate()
                            : undefined
                        }
                        onOpenManualAllocate={
                          canAllocateOverpayment
                            ? () => void allocation.handleOpenManualAllocate()
                            : undefined
                        }
                        allocationConfirmed={Boolean(allocation.allocationPreviewId)}
                        isRTL={isRTL}
                        canAllocate={canAllocateOverpayment}
                        canSaveAdvance={canSaveAdvanceOverpayment}
                        canSaveCredit={canSaveCreditOverpayment}
                        canSaveWallet={canWalletOverpayment}
                        canReturnCashChange={canReturnChangeFromCash}
                      />
                    </div>
                  ) : null}

                  {payExtraIntent ? (
                    <PayExtraWorkbenchHint
                      visible={
                        allocation.extraReceiptMode === 'adjust_legs' &&
                        validationPhase !== 'ready'
                      }
                      isRTL={isRTL}
                    />
                  ) : null}

                  {showDeferredExplanation ? (
                    <CmxCard>
                      <CmxCardContent className="pt-5">
                        <p className="text-lg font-semibold text-slate-900">{t('workspace.noImmediateTitle')}</p>
                        <p className="mt-2 text-sm text-slate-600">{t('workspace.noImmediateDescription')}</p>
                      </CmxCardContent>
                    </CmxCard>
                  ) : (
                    <>
                      {showAmountEditorSection ? (
                      <PaymentWorkbenchSection
                        sectionRef={amountEditorSectionRef}
                        sectionId={PAYMENT_MODAL_SECTION_IDS.AMOUNT_EDITOR}
                        expanded={isSectionExpanded(PAYMENT_MODAL_SECTION_IDS.AMOUNT_EDITOR)}
                        collapsible={isSectionCollapsible(PAYMENT_MODAL_SECTION_IDS.AMOUNT_EDITOR)}
                        onToggle={toggleSection}
                        cardClassName="border-slate-200 bg-white"
                        headerClassName="border-slate-100"
                        titleClassName="text-sm text-slate-700"
                        isRTL={isRTL}
                        expandLabel={workbenchSectionToggleLabels.expandLabel}
                        collapseLabel={workbenchSectionToggleLabels.collapseLabel}
                        title={`${t('sections.sectionB')} · ${t('sections.amountEditor')} · ${activeLeg ? getCheckoutOptionDisplayName(activeLegOption, activeLeg.method) : t('workspace.editingAmount')}`}
                        headerAside={settlementLegEntries.length > 1 ? (
                          <CmxButton
                            type="button"
                            variant="outline"
                            size="sm"
                            data-testid="payment-cycle-active-leg"
                            onClick={cycleActiveLeg}
                            className="rounded-xl border-slate-200 text-slate-700"
                          >
                            <ArrowRightLeft className="me-1 h-4 w-4" />
                            {t('splitPayment.switchLeg')}
                          </CmxButton>
                        ) : undefined}
                        contentClassName="grid gap-4 pt-4 xl:grid-cols-[minmax(260px,0.9fr)_minmax(360px,1.1fr)]"
                      >
                          <div className="space-y-3">
                            <div className="flex items-stretch rounded-2xl border border-slate-200 bg-white shadow-inner">
                              <div className="flex min-w-[88px] items-center justify-center rounded-s-2xl border-e border-slate-200 bg-slate-100 px-4 text-lg font-semibold text-cyan-700">
                                {currencyCode}
                              </div>
                              <div className="min-w-0 flex-1 px-3">
                                <CmxMoneyField
                                  ref={amountInputRef}
                                  data-testid="payment-amount-editor"
                                  draftValue={activeAmountDraft}
                                  value={
                                    activeLeg?.method === PAYMENT_METHODS.CASH
                                      ? activeLeg.cashTendered ?? activeLeg.amount ?? null
                                      : activeLeg?.amount ?? null
                                  }
                                  decimalPlaces={decimalPlaces}
                                  showZero
                                  aria-label={t('workspace.editingAmount')}
                                  onValueChange={handleAmountValueChange}
                                  placeholder={formatAmount(0)}
                                  disabled={!activeLeg}
                                  className="h-16 border-0 bg-transparent px-0 text-[2.2rem] font-bold tracking-tight text-slate-900 shadow-none focus-visible:ring-0"
                                />
                              </div>
                            </div>
                            {activeLeg?.method === 'WALLET' && (
                              <div className={`rounded-xl border px-3 py-2 text-xs ${
                                walletLegExceedsLiveBalance
                                  ? 'border-rose-200 bg-rose-50 text-rose-700'
                                  : 'border-cyan-200 bg-cyan-50 text-cyan-800'
                              }`}>
                                {walletLegExceedsLiveBalance
                                  ? t('customerCredits.walletBalanceExceeded', {
                                      amount: liveWalletBalanceDisplay,
                                    })
                                  : t('customerCredits.available', {
                                      amount: liveWalletBalanceDisplay,
                                    })}
                              </div>
                            )}
                            {activeLeg?.method === PAYMENT_METHODS.CASH ? (
                              <div className="grid gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 sm:grid-cols-3">
                                <span>
                                  <span data-testid="payment-active-applied-amount">
                                    {t('rightRail.appliedAmount')}: {currencyCode} {formatAmount(activeLeg.amount ?? 0)}
                                  </span>
                                </span>
                                <span>
                                  <span data-testid="payment-active-cash-tendered">
                                    {t('rightRail.cashTendered')}: {currencyCode} {formatAmount(activeLeg.cashTendered ?? activeLeg.amount ?? 0)}
                                  </span>
                                </span>
                                <span>
                                  <span data-testid="payment-active-change-returned">
                                    {t('rightRail.changeReturned')}: {currencyCode} {formatAmount(activeLegChangeReturned)}
                                  </span>
                                </span>
                              </div>
                            ) : null}
                            {displayAmountCapNotice ? (
                              <CmxSummaryMessage
                                type="info"
                                title={displayAmountCapTitle}
                                items={[displayAmountCapNotice.message]}
                              />
                            ) : null}
                            <p className="rounded-xl border border-cyan-100 bg-cyan-50 px-3 py-2 text-xs text-cyan-800">
                              {t('workspace.keypadHint')}
                            </p>
                            {activeLeg ? (
                              <div className={`flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                <p className="text-xs text-slate-600">
                                  {t('workspace.remainingForLeg', {
                                    amount: `${currencyCode} ${formatAmount(activeLegRemainingCap)}`,
                                  })}
                                </p>
                                <CmxButton
                                  type="button"
                                  variant="outline"
                                  size="xs"
                                  disabled={activeLegRemainingCap <= moneyEpsilon}
                                  onClick={() => fillLegRemaining(activeLegIndex)}
                                  className="min-h-[44px] shrink-0 rounded-lg border-cyan-200 text-cyan-700"
                                >
                                  {t('splitPayment.fillRemaining')}
                                </CmxButton>
                              </div>
                            ) : null}
                          </div>
                          <div className="min-w-0 space-y-3">
                            <PaymentQuickTenderChips
                              items={quickTenderChipItems}
                              onSelect={handleQuickTenderSelect}
                              disabled={!activeLeg || submitBusy}
                              isRTL={isRTL}
                            />
                            <CmxKeypad
                              keys={KEYPAD_PAYMENT_4COL}
                              disabled={!activeLeg}
                              onKeyPress={handleKeypadPress}
                              onKeyLongPress={(key) => {
                                if (key === 'backspace') handleKeypadPress('clear');
                              }}
                              getKeyVariant={PAYMENT_KEY_VARIANT}
                              getKeyClassName={PAYMENT_KEY_CLASS}
                              getKeyAriaLabel={(key) => {
                                if (key === 'backspace') return t('workspace.backspace');
                                if (key === 'clear') return tCommon('clear');
                                return undefined;
                              }}
                              renderKeyLabel={(key) => {
                                if (key === 'backspace') return '⌫';
                                if (key === 'clear') return tCommon('clear');
                                return key;
                              }}
                            />
                          </div>
                        </PaymentWorkbenchSection>
                      ) : null}

                      <PaymentWorkbenchSection
                        sectionRef={paymentWorkspaceSectionRef}
                        sectionId={PAYMENT_MODAL_SECTION_IDS.PAYMENT_WORKSPACE}
                        expanded={isSectionExpanded(PAYMENT_MODAL_SECTION_IDS.PAYMENT_WORKSPACE)}
                        collapsible={isSectionCollapsible(PAYMENT_MODAL_SECTION_IDS.PAYMENT_WORKSPACE)}
                        onToggle={toggleSection}
                        cardClassName="min-h-[360px] border-cyan-100 bg-white"
                        headerClassName="border-cyan-100"
                        isRTL={isRTL}
                        expandLabel={workbenchSectionToggleLabels.expandLabel}
                        collapseLabel={workbenchSectionToggleLabels.collapseLabel}
                        title={(
                          <span className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <Maximize2 className="h-4 w-4 text-cyan-700" />
                            {t('sections.sectionC')} · {t('workspace.activeTitle')}
                          </span>
                        )}
                        description={t('workspace.activeDescription')}
                        headerAside={activeLeg ? (
                          <Badge variant="secondary" className="rounded-full bg-cyan-100 px-3 py-1 text-cyan-700">
                            {getCheckoutOptionDisplayName(activeLegOption, activeLeg.method)}
                          </Badge>
                        ) : undefined}
                        contentClassName="space-y-4 pt-4"
                      >
                          {/* Finding 1.7: the blocking "required action" renders ONLY in the
                              right rail (rose), next to the disabled CTA — the amber duplicate
                              that lived here is gone. Finding 1.1: the selected-leg / amount
                              cards duplicated the header badge and the amount editor, so only
                              the live "after this payment" delta remains. */}
                          {activeLeg ? (
                            <>
                              <div className={`flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                <p className={`text-xs font-semibold text-slate-500 ${!isRTL ? 'uppercase tracking-[0.14em]' : ''}`}>{t('workspace.afterThisPayment')}</p>
                                <p className={`text-2xl font-bold tabular-nums transition-colors duration-300 motion-reduce:transition-none ${remainingBalance > moneyEpsilon ? 'text-amber-600' : 'text-emerald-600'}`}>
                                  {currencyCode} {formatAmount(remainingBalance)}
                                </p>
                              </div>

                              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                <p className={`mb-3 text-sm font-semibold text-slate-900 ${isRTL ? 'text-right' : 'text-left'}`}>
                                  {t('workspace.detailsTitle')}
                                </p>

                                <div className="space-y-4">
                                  {creditMethodCodes.includes(activeLeg.method) && (
                                    <div className="rounded-2xl border border-cyan-100 bg-cyan-50 px-3 py-3 text-sm text-cyan-900">
                                      {activeLeg.method === 'CREDIT_NOTE' ? (
                                        <div className={`flex items-center justify-between gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                          <span>
                                            {activeLeg.creditReferenceId
                                              ? t('customerCredits.creditNoteSelected', {
                                                  id: activeLeg.creditReferenceId.slice(0, 8),
                                                })
                                              : t('customerCredits.creditNoteRequired')}
                                          </span>
                                          <CmxButton
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                              setPendingCreditNoteOption(
                                                customerCreditOptions.find(
                                                  (option) => option.payment_method_code === 'CREDIT_NOTE'
                                                ) ?? null
                                              );
                                              setCreditNotePickerOpen(true);
                                            }}
                                          >
                                            {t('customerCredits.creditNoteChange')}
                                          </CmxButton>
                                        </div>
                                      ) : (
                                        t('customerCredits.applied')
                                      )}
                                    </div>
                                  )}
                                  {/* Per-method leg detail fields — shared single-source
                                      component (also used by the split-tender dialog). */}
                                  <PaymentLegDetailFields
                                    leg={activeLeg}
                                    legIndex={activeLegIndex}
                                    option={activeLegOption}
                                    updateLeg={updateLeg}
                                    branchPaymentTerminals={branchPaymentTerminals}
                                    cardBrands={cardBrands}
                                    creditMethodCodes={creditMethodCodes}
                                    onCheckNumberChange={(value) =>
                                      setValue('checkNumber', value, { shouldValidate: true, shouldDirty: true })
                                    }
                                    onCheckBankChange={(value) =>
                                      setValue('checkBank', value, { shouldValidate: false, shouldDirty: true })
                                    }
                                    onCheckDateChange={(value) =>
                                      setValue('checkDate', value, { shouldValidate: false, shouldDirty: true })
                                    }
                                    checkNumberError={errors.checkNumber?.message}
                                    checkNumberInputRef={checkNumberInputRef}
                                    checkDateInputRef={checkDateInputRef}
                                  />
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="grid min-h-[240px] place-items-center rounded-2xl border border-dashed border-cyan-200 bg-white/70 p-6 text-center">
                              <div className="max-w-md">
                                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700">
                                  <CreditCard className="h-6 w-6" />
                                </div>
                                <p className="mt-4 text-lg font-semibold text-slate-900">{t('workspace.helperTitle')}</p>
                                <p className="mt-2 text-sm text-slate-600">{t('workspace.helperDescription')}</p>
                                <div className="mt-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
                                  <span className="rounded-full bg-slate-100 px-3 py-2">{t('workspace.helperMethod')}</span>
                                  <span className="rounded-full bg-slate-100 px-3 py-2">{t('workspace.helperAmount')}</span>
                                  <span className="rounded-full bg-slate-100 px-3 py-2">{t('workspace.helperCredits')}</span>
                                </div>
                              </div>
                            </div>
                          )}
                      </PaymentWorkbenchSection>
                    </>
                  )}

                  {showDiscountsCreditsSection ? (
                    <PaymentWorkbenchSection
                      sectionRef={couponCardRef}
                      sectionId={PAYMENT_MODAL_SECTION_IDS.DISCOUNTS_CREDITS}
                      expanded={isSectionExpanded(PAYMENT_MODAL_SECTION_IDS.DISCOUNTS_CREDITS)}
                      collapsible={isSectionCollapsible(PAYMENT_MODAL_SECTION_IDS.DISCOUNTS_CREDITS)}
                      onToggle={toggleSection}
                      cardClassName="border-purple-100 bg-white/95"
                      headerClassName="border-purple-100"
                      isRTL={isRTL}
                      expandLabel={workbenchSectionToggleLabels.expandLabel}
                      collapseLabel={workbenchSectionToggleLabels.collapseLabel}
                      title={`${t('sections.sectionE')} · ${t('rightRail.adjustments')}`}
                      description={t('sections.discountsCreditsHelp')}
                      headerAside={appliedBadgeCount > 0 ? (
                        <Badge variant="secondary" className="rounded-full bg-purple-100 px-3 py-1 text-purple-700">
                          {appliedBadgeCount}
                        </Badge>
                      ) : undefined}
                      contentClassName="space-y-5 pt-5"
                    >
                          <div className={`grid gap-4 ${showGiftCardWorkspace ? '' : 'xl:grid-cols-[minmax(0,1fr)_minmax(280px,380px)]'}`}>
                            <div className="space-y-4">
                              <PaymentDiscountFields
                                control={control}
                                setValue={setValue}
                                errors={errors}
                                total={total}
                                decimalPlaces={decimalPlaces}
                                amountInputRef={amountDiscountInputRef}
                                percentInputRef={percentDiscountInputRef}
                                className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                              />

                              {!NEW_ORDER_PROMO_GIFT_DISABLED ? (
                                <div className="space-y-4 rounded-2xl border border-purple-100 bg-purple-50/50 p-4">
                                  <div>
                                    <p className={`text-sm font-semibold text-slate-900 ${isRTL ? 'text-right' : 'text-left'}`}>
                                      {t('rightRail.creditsAndStoredValue')}
                                    </p>
                                    <p className={`mt-1 text-xs text-slate-500 ${isRTL ? 'text-right' : 'text-left'}`}>
                                      {t('rightRail.creditsAndStoredValueHelp')}
                                    </p>
                                  </div>

                                  {!appliedPromoCode ? (
                                    <div className="space-y-2">
                                      <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                        <Controller
                                          name="promoCode"
                                          control={control}
                                          render={({ field }) => (
                                            <CmxInput
                                              {...field}
                                              value={field.value || ''}
                                              onChange={(event) => {
                                                field.onChange(event.target.value.toUpperCase());
                                                if (promoCodeResult && !promoCodeResult.isValid) {
                                                  handleClearPromoCodeError();
                                                }
                                              }}
                                              onKeyDown={(event) => {
                                                if (event.key === 'Enter') {
                                                  event.preventDefault();
                                                  void handleValidatePromoCode();
                                                }
                                              }}
                                              placeholder={t('promoCode.placeholder')}
                                              disabled={promoCodeValidating}
                                            />
                                          )}
                                        />
                                        <CmxButton
                                          type="button"
                                          size="sm"
                                          onClick={handleValidatePromoCode}
                                          disabled={!promoCode?.trim() || promoCodeValidating}
                                        >
                                          {promoCodeValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : t('promoCode.apply')}
                                        </CmxButton>
                                      </div>
                                      {promoErrorMessage ? (
                                        <p className={`text-xs text-rose-600 ${isRTL ? 'text-right' : 'text-left'}`}>
                                          {promoErrorMessage}
                                        </p>
                                      ) : null}
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-between gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2">
                                      <span className="text-sm font-medium text-green-900">
                                        {appliedPromoCode.code} -{currencyCode} {formatAmount(appliedPromoCode.discount)}
                                      </span>
                                      <CmxButton type="button" variant="ghost" size="sm" onClick={handleClearPromoCode}>
                                        {t('promoCode.remove')}
                                      </CmxButton>
                                    </div>
                                  )}

                                  {!appliedGiftCard ? (
                                    <div ref={giftCardDetailsRef} className="space-y-3 rounded-xl border border-purple-200 bg-white p-3">
                                      <div className={`grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] ${isRTL ? 'sm:[direction:rtl]' : ''}`}>
                                        <Controller
                                          name="giftCardNumber"
                                          control={control}
                                          render={({ field }) => (
                                            <CmxInput
                                              {...field}
                                              value={field.value || ''}
                                              onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                                              placeholder={t('giftCard.placeholder')}
                                              disabled={giftCardValidating}
                                              className="min-w-0"
                                              onKeyDown={(event) => {
                                                if (event.key === 'Enter') {
                                                  event.preventDefault();
                                                  event.stopPropagation();
                                                  void handleFetchGiftCardDetails();
                                                }
                                              }}
                                            />
                                          )}
                                        />
                                        <CmxButton
                                          type="button"
                                          size="sm"
                                          variant="secondary"
                                          onClick={handleFetchGiftCardDetails}
                                          disabled={!giftCardNumber?.trim() || giftCardValidating || (pinRequired && !giftCardPin.trim())}
                                          className="shrink-0"
                                        >
                                          {giftCardValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : t('giftCard.fetch')}
                                        </CmxButton>
                                      </div>
                                      {giftCardResult && !giftCardResult.isValid ? (
                                        <p className={`text-xs text-rose-600 ${isRTL ? 'text-right' : 'text-left'}`}>
                                          {resolveGiftCardError(giftCardResult)}
                                        </p>
                                      ) : null}
                                      {showGiftCardWorkspace ? (
                                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,320px)]">
                                          <div className="rounded-xl border border-purple-100 bg-purple-50 px-3 py-2">
                                            <p className={`text-xs font-semibold ${labelCase} text-purple-500`}>
                                              {t('giftCard.cardCode')}
                                            </p>
                                            <p className="mt-1 break-all text-sm font-semibold text-slate-900" dir="ltr">
                                              {giftCardDetails?.number || giftCardNumber}
                                            </p>
                                            {giftCardDetails ? (
                                              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                                <SummaryRow
                                                  label={t('giftCard.balance')}
                                                  value={`${currencyCode} ${formatAmount(giftCardDetails.balance)}`}
                                                />
                                                <SummaryRow
                                                  label={t('rightRail.remainingBalance')}
                                                  value={`${currencyCode} ${formatAmount(remainingBalance)}`}
                                                  negative={remainingBalance > moneyEpsilon}
                                                />
                                              </div>
                                            ) : (
                                              <p className="mt-2 text-xs text-amber-700">{t('giftCard.pinPendingError')}</p>
                                            )}
                                          </div>
                                          <div className="space-y-3">
                                            {pinRequired ? (
                                              <div className={`grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_auto] ${isRTL ? 'sm:[direction:rtl]' : ''}`}>
                                                <CmxInput
                                                  ref={pinInputRef}
                                                  label={t('giftCard.pinLabel')}
                                                  value={giftCardPin}
                                                  type={pinVisible ? 'text' : 'password'}
                                                  dir="ltr"
                                                  error={pinFieldError ?? undefined}
                                                  className={`min-w-0 ${pinRequired && !giftCardPin.trim() ? 'ring-1 ring-rose-400' : ''}`}
                                                  onChange={(event) => {
                                                    setGiftCardPin(event.target.value);
                                                    setPinFieldError(null);
                                                  }}
                                                  onKeyDown={(event) => {
                                                    if (event.key === 'Enter') {
                                                      event.preventDefault();
                                                      event.stopPropagation();
                                                      void handleFetchGiftCardDetails();
                                                    }
                                                  }}
                                                />
                                                <CmxButton
                                                  type="button"
                                                  variant="outline"
                                                  size="sm"
                                                  className="h-9 shrink-0"
                                                  onClick={() => setPinVisible((value) => !value)}
                                                  aria-label={pinVisible ? t('giftCard.hidePin') : t('giftCard.showPin')}
                                                >
                                                  {pinVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </CmxButton>
                                              </div>
                                            ) : null}
                                            {giftCardDetails ? (
                                              <>
                                                <Controller
                                                  name="giftCardAmount"
                                                  control={control}
                                                  render={({ field }) => (
                                                    <CmxInput
                                                      {...field}
                                                      ref={(node) => {
                                                        field.ref(node);
                                                        giftCardAmountInputRef.current = node;
                                                      }}
                                                      type="number"
                                                      label={t('giftCard.applyAmount')}
                                                      value={field.value ?? ''}
                                                      dir="ltr"
                                                      min="0"
                                                      step="0.001"
                                                      inputMode="decimal"
                                                      placeholder={t('giftCard.amountPlaceholder')}
                                                      onChange={(event) => field.onChange(Number.parseFloat(event.target.value) || 0)}
                                                      onKeyDown={(event) => {
                                                        if (event.key === 'Enter') {
                                                          event.preventDefault();
                                                          event.stopPropagation();
                                                          handleApplyGiftCard();
                                                        }
                                                      }}
                                                    />
                                                  )}
                                                />
                                                <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                                  <CmxButton
                                                    type="button"
                                                    size="sm"
                                                    variant="secondary"
                                                    onClick={handleApplyGiftCard}
                                                    disabled={!giftCardAmount || giftCardAmount <= 0}
                                                    className="flex-1"
                                                  >
                                                    {t('giftCard.applyAmount')}
                                                  </CmxButton>
                                                  <CmxButton
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={handleClearGiftCard}
                                                    className="flex-1"
                                                  >
                                                    {tCommon('cancel')}
                                                  </CmxButton>
                                                </div>
                                              </>
                                            ) : null}
                                          </div>
                                        </div>
                                      ) : null}
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-between gap-2 rounded-xl border border-purple-200 bg-purple-50 px-3 py-2">
                                      <span className="text-sm font-medium text-purple-900">
                                        {appliedGiftCard.number} -{currencyCode} {formatAmount(appliedGiftCard.amount)}
                                      </span>
                                      <CmxButton type="button" variant="ghost" size="sm" onClick={handleClearGiftCard}>
                                        {t('giftCard.remove')}
                                      </CmxButton>
                                    </div>
                                  )}
                                </div>
                              ) : null}
                            </div>

                            {PAYMENT_MODAL_V04_SHOW_LIVE_EFFECT ? (
                              <div className="space-y-3 rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4">
                                <p className={`text-sm font-semibold text-slate-900 ${isRTL ? 'text-right' : 'text-left'}`}>
                                  {t('rightRail.liveEffect')}
                                </p>
                                <SummaryRow
                                  label={t('rightRail.orderTotalAfterDiscounts')}
                                  value={`${currencyCode} ${formatAmount(saleTotal)}`}
                                />
                                <SummaryRow
                                  label={t('rightRail.creditsApplied')}
                                  value={`${currencyCode} ${formatAmount(customerCreditAmount + (appliedGiftCard?.amount || 0))}`}
                                />
                                <SummaryRow
                                  label={t('rightRail.remainingBalance')}
                                  value={`${currencyCode} ${formatAmount(remainingBalance)}`}
                                  negative={remainingBalance > moneyEpsilon}
                                />
                              </div>
                            ) : null}
                          </div>
                    </PaymentWorkbenchSection>
                  ) : null}

                  {showCashDrawerWorkbenchSection ? (
                    <PaymentWorkbenchSection
                      sectionRef={(node) => {
                        cashDrawerCardRef.current = node;
                        cashDrawerSelectorCardRef.current = node;
                      }}
                      sectionId={PAYMENT_MODAL_SECTION_IDS.CASH_DRAWER}
                      expanded={isSectionExpanded(PAYMENT_MODAL_SECTION_IDS.CASH_DRAWER)}
                      collapsible={isSectionCollapsible(PAYMENT_MODAL_SECTION_IDS.CASH_DRAWER)}
                      onToggle={toggleSection}
                      cardClassName="border-cyan-200 bg-white/95"
                      headerClassName="border-cyan-100"
                      isRTL={isRTL}
                      expandLabel={workbenchSectionToggleLabels.expandLabel}
                      collapseLabel={workbenchSectionToggleLabels.collapseLabel}
                      title={(
                        <span className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <Banknote className="h-4 w-4 text-cyan-700" />
                          {t('sections.sectionF')} · {t('sections.cashDrawer')}
                        </span>
                      )}
                      description={t('cashDrawer.subtitle')}
                      headerAside={(
                        <Badge
                          variant="secondary"
                          className={`rounded-full px-3 py-1 ${
                            selectedCashDrawerChoice
                              ? 'bg-cyan-100 text-cyan-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {selectedCashDrawerChoice ? t('cashDrawer.boundBadge') : t('cashDrawer.pendingBadge')}
                        </Badge>
                      )}
                      contentClassName="space-y-4 pt-5"
                    >
                          {cashDrawersLoading ? (
                            <div className="grid gap-3 md:grid-cols-2">
                              <CmxSkeleton className="h-20 w-full" />
                              <CmxSkeleton className="h-20 w-full" />
                            </div>
                          ) : (
                            <>
                              {cashDrawerRequestError ? (
                                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                                  {cashDrawerRequestError}
                                </div>
                              ) : null}

                              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
                                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                                  {cashDrawerSessionChoices.length > 1 ? (
                                    <div className="space-y-2">
                                      <label className={`block text-xs font-semibold ${labelCase} text-slate-500 ${isRTL ? 'text-right' : 'text-left'}`}>
                                        {t('cashDrawer.selectLabel')}
                                      </label>
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
                                        emptyLabel={t('cashDrawer.selectPlaceholder')}
                                      >
                                        <CmxSelectDropdownTrigger dir={isRTL ? 'rtl' : 'ltr'}>
                                          <CmxSelectDropdownValue
                                            displayValue={
                                              selectedCashDrawerChoice
                                                ? `${getDrawerDisplayName(selectedCashDrawerChoice.drawer)} • ${selectedCashDrawerChoice.session.session_no}`
                                                : t('cashDrawer.selectPlaceholder')
                                            }
                                            placeholder={t('cashDrawer.selectPlaceholder')}
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
                                    </div>
                                  ) : null}

                                  {selectedCashDrawerChoice ? (
                                    <div className="rounded-2xl border border-cyan-200 bg-cyan-50/80 p-3">
                                      <div className={`flex items-center justify-between gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                        <div className={isRTL ? 'text-right' : 'text-left'}>
                                          <p className="text-sm font-semibold text-slate-900">
                                            {getDrawerDisplayName(selectedCashDrawerChoice.drawer)}
                                          </p>
                                          <p className="text-xs text-slate-500">
                                            {selectedCashDrawerChoice.session.session_no}
                                          </p>
                                        </div>
                                        <Banknote className="h-4 w-4 text-cyan-700" />
                                      </div>
                                      <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                                        <div>
                                          <p className="font-medium text-slate-500">{t('cashDrawer.openedAt')}</p>
                                          <p>{formatCashDrawerOpenedAt(selectedCashDrawerChoice.session.opened_at)}</p>
                                        </div>
                                        <div>
                                          <p className="font-medium text-slate-500">{t('cashDrawer.openingBalance')}</p>
                                          <p>{`${selectedCashDrawerChoice.drawer.currency_code} ${formatAmount(selectedCashDrawerChoice.session.opening_float_amount)}`}</p>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className={`rounded-2xl border px-3 py-3 text-xs ${
                                      cashDrawerSessionChoices.length === 0
                                        ? 'border-amber-200 bg-amber-50 text-amber-800'
                                        : 'border-slate-200 bg-slate-50 text-slate-600'
                                    }`}>
                                      {cashDrawerSessionChoices.length === 0
                                        ? t('cashDrawer.messages.noOpenSession')
                                        : t('cashDrawer.messages.sessionRequired')}
                                    </div>
                                  )}

                                  <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                    <CmxButton
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => void refetchCashDrawers()}
                                      disabled={cashDrawersFetching}
                                      className="rounded-xl"
                                    >
                                      {cashDrawersFetching ? (
                                        <Loader2 className="me-1 h-4 w-4 animate-spin" />
                                      ) : (
                                        <RefreshCw className="me-1 h-4 w-4" />
                                      )}
                                      {t('cashDrawer.refresh')}
                                    </CmxButton>
                                    <CmxButton
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={handleOpenCashDrawerDialog}
                                      disabled={!canOpenNewCashDrawerSession}
                                      className="rounded-xl"
                                    >
                                      <Plus className="me-1 h-4 w-4" />
                                      {t('cashDrawer.openSession')}
                                    </CmxButton>
                                  </div>
                                </div>

                                <div className="space-y-3 rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4">
                                  <p className={`text-sm font-semibold text-slate-900 ${isRTL ? 'text-right' : 'text-left'}`}>
                                    {t('rightRail.cashDrawerImpact')}
                                  </p>
                                  <SummaryRow
                                    label={t('rightRail.cashRetained')}
                                    value={`${currencyCode} ${formatAmount(netCashRetainedAmount)}`}
                                  />
                                  <SummaryRow
                                    label={t('rightRail.changeReturned')}
                                    value={`${currencyCode} ${formatAmount(displayChangeAmount)}`}
                                    negative={displayChangeAmount > moneyEpsilon}
                                  />
                                </div>
                              </div>
                            </>
                          )}
                    </PaymentWorkbenchSection>
                  ) : null}

                  <PaymentWorkbenchSection
                    sectionRef={financialInspectorSectionRef}
                    sectionId={PAYMENT_MODAL_SECTION_IDS.FINANCIAL_INSPECTOR}
                    expanded={isSectionExpanded(PAYMENT_MODAL_SECTION_IDS.FINANCIAL_INSPECTOR)}
                    collapsible={isSectionCollapsible(PAYMENT_MODAL_SECTION_IDS.FINANCIAL_INSPECTOR)}
                    onToggle={toggleSection}
                    cardClassName="border-slate-200 bg-white/95"
                    headerClassName="border-slate-100"
                    isRTL={isRTL}
                    expandLabel={workbenchSectionToggleLabels.expandLabel}
                    collapseLabel={workbenchSectionToggleLabels.collapseLabel}
                    title={`${t('sections.sectionG')} · ${t('sections.financialInspector')}`}
                    description={t('sections.financialInspectorHelp')}
                    headerAside={(
                      <Badge variant="secondary" className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                        {inspectorTabIds.length}
                      </Badge>
                    )}
                    contentClassName="pt-0"
                  >
                        <CmxTabsPanel
                          tabs={[
                            {
                              id: PAYMENT_MODAL_INSPECTOR_TAB_IDS.ORDER_VALUE,
                              label: t('rightRail.orderValue'),
                              content: (
                                <OrderValueBreakdownPanel
                                  model={orderValueBreakdownModel}
                                  isRTL={isRTL}
                                  taxLoading={totalsLoading && items.length > 0 && !serverTotals}
                                  labels={{
                                    grossValue: t('orderValue.grossValue'),
                                    grossValueHelp: t('orderValue.grossValueHelp'),
                                    discounts: t('orderValue.discounts'),
                                    discountsHelp: t('orderValue.discountsHelp'),
                                    taxes: t('orderValue.taxes'),
                                    taxesHelp: t('orderValue.taxesHelp'),
                                  }}
                                />
                              ),
                            },
                            ...(inspectorTabIds.includes(PAYMENT_MODAL_INSPECTOR_TAB_IDS.TAX_BREAKDOWN)
                              ? [
                                  {
                                    id: PAYMENT_MODAL_INSPECTOR_TAB_IDS.TAX_BREAKDOWN,
                                    label: t('rightRail.taxBreakdown'),
                                    content: displayTaxBreakdown.length === 0 ? (
                                      <p className={`text-xs text-slate-500 ${isRTL ? 'text-right' : 'text-left'}`}>
                                        {t('tax.noProfiles')}
                                      </p>
                                    ) : (
                                      <div className="space-y-2">
                                        {displayTaxBreakdown.map((entry, index) => (
                                          <div
                                            key={entry.profileId ?? `${entry.taxType}-${index}`}
                                            className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                                          >
                                            <div className="min-w-0 flex-1">
                                              <p className="truncate text-xs font-medium text-slate-700">
                                                {isRTL ? (entry.label2 || entry.label) : entry.label}
                                              </p>
                                              <p className="text-xs text-slate-500">
                                                {t('tax.rate')}: {entry.rate.toFixed(2)}%
                                              </p>
                                            </div>
                                            <span className="text-sm font-semibold tabular-nums text-slate-900">
                                              {currencyCode} {formatAmount(entry.taxAmount)}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    ),
                                  },
                                ]
                              : []),
                            ...(inspectorTabIds.includes(PAYMENT_MODAL_INSPECTOR_TAB_IDS.DISCOUNTS)
                              ? [
                                  {
                                    id: PAYMENT_MODAL_INSPECTOR_TAB_IDS.DISCOUNTS,
                                    label: t('rightRail.discounts'),
                                    content: (
                                      <div className="space-y-2">
                                        {(totals.autoRuleDiscount ?? 0) > moneyEpsilon ? (
                                          <SummaryRow
                                            label={t('summary.rulesDiscount')}
                                            value={`-${currencyCode} ${formatAmount(totals.autoRuleDiscount ?? 0)}`}
                                            negative
                                          />
                                        ) : null}
                                        {totals.manualDiscount > moneyEpsilon ? (
                                          <SummaryRow
                                            label={t('summary.manualDiscount')}
                                            value={`-${currencyCode} ${formatAmount(totals.manualDiscount)}`}
                                            negative
                                          />
                                        ) : null}
                                        {totals.promoDiscount > moneyEpsilon ? (
                                          <SummaryRow
                                            label={t('summary.promoDiscount')}
                                            value={`-${currencyCode} ${formatAmount(totals.promoDiscount)}`}
                                            negative
                                          />
                                        ) : null}
                                        {appliedGiftCard ? (
                                          <SummaryRow
                                            label={t('summary.giftCardApplied')}
                                            value={`-${currencyCode} ${formatAmount(appliedGiftCard.amount)}`}
                                            negative
                                          />
                                        ) : null}
                                      </div>
                                    ),
                                  },
                                ]
                              : []),
                            ...(inspectorTabIds.includes(PAYMENT_MODAL_INSPECTOR_TAB_IDS.B2B_AR)
                              ? [
                                  {
                                    id: PAYMENT_MODAL_INSPECTOR_TAB_IDS.B2B_AR,
                                    label: t('rightRail.b2bArDetails'),
                                    content: customerId ? (
                                      <div className="space-y-3">
                                        <B2BContractsSelect customerId={customerId} control={control} isRTL={isRTL} />
                                        <div className="grid gap-3 md:grid-cols-2">
                                          <Controller
                                            name="costCenterCode"
                                            control={control}
                                            render={({ field }) => (
                                              <CmxInput
                                                {...field}
                                                label={t('b2b.costCenter')}
                                                dir="ltr"
                                                placeholder={t('b2b.costCenterPlaceholder')}
                                              />
                                            )}
                                          />
                                          <Controller
                                            name="poNumber"
                                            control={control}
                                            render={({ field }) => (
                                              <CmxInput
                                                {...field}
                                                label={t('b2b.poNumber')}
                                                dir="ltr"
                                                placeholder={t('b2b.poNumberPlaceholder')}
                                              />
                                            )}
                                          />
                                        </div>
                                        {b2bCreditLimitInfo && b2bCreditLimitInfo.creditLimit > 0 ? (
                                          <div
                                            ref={creditLimitCardRef}
                                            className={`rounded-xl border p-3 ${b2bCreditLimitInfo.wouldExceed ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}`}
                                          >
                                            <p className={`flex items-center gap-2 text-sm font-medium text-slate-900 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                              <CircleAlert className="h-4 w-4 text-amber-600" />
                                              {t('b2b.creditLimit')}
                                            </p>
                                            <p className="mt-1 text-xs text-slate-600">
                                              {t('b2b.creditUsed')}: {currencyCode} {formatAmount(b2bCreditLimitInfo.currentBalance)} • {t('b2b.creditAvailable')}: {currencyCode} {formatAmount(b2bCreditLimitInfo.available)}
                                              {b2bCreditLimitInfo.wouldExceed && b2bCreditLimitInfo.exceedsBy > 0 ? (
                                                <span className="font-semibold text-amber-800">
                                                  {' '}• {t('b2b.creditExceedsBy')}: {currencyCode} {formatAmount(b2bCreditLimitInfo.exceedsBy)}
                                                </span>
                                              ) : null}
                                            </p>
                                            {b2bCreditLimitInfo.wouldExceed ? (
                                              <p className="mt-2 text-xs font-medium text-amber-800">
                                                {t('b2b.creditExceeded')}
                                              </p>
                                            ) : null}
                                          </div>
                                        ) : null}
                                      </div>
                                    ) : null,
                                  },
                                ]
                              : []),
                            {
                              id: PAYMENT_MODAL_INSPECTOR_TAB_IDS.PAYMENT_NOTES,
                              label: t('rightRail.paymentNotes'),
                              content: (
                                <Controller
                                  name="paymentNotes"
                                  control={control}
                                  render={({ field }) => (
                                    <CmxTextarea
                                      {...field}
                                      id="v4-payment-notes"
                                      value={field.value ?? ''}
                                      onChange={(event) => field.onChange(event.target.value)}
                                      dir={isRTL ? 'rtl' : 'ltr'}
                                      rows={4}
                                      className="min-h-28 resize-none"
                                      placeholder={t('paymentNotesPlaceholder')}
                                    />
                                  )}
                                />
                              ),
                            },
                          ] satisfies CmxTabItem[]}
                        />
                  </PaymentWorkbenchSection>

                  {showBalancePolicySection ? (
                    <PaymentWorkbenchSection
                      sectionRef={balancePolicySectionRef}
                      sectionId={PAYMENT_MODAL_SECTION_IDS.BALANCE_POLICY}
                      expanded={isSectionExpanded(PAYMENT_MODAL_SECTION_IDS.BALANCE_POLICY)}
                      collapsible={isSectionCollapsible(PAYMENT_MODAL_SECTION_IDS.BALANCE_POLICY)}
                      onToggle={toggleSection}
                      cardClassName="border-slate-200 bg-white/95"
                      headerClassName="border-slate-100"
                      isRTL={isRTL}
                      expandLabel={workbenchSectionToggleLabels.expandLabel}
                      collapseLabel={workbenchSectionToggleLabels.collapseLabel}
                      title={(
                        <span className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          {t('sections.sectionD')} · {t('rightRail.balancePolicy')}
                          <Info className="h-4 w-4 text-slate-400" />
                        </span>
                      )}
                      description={t('rightRail.balancePolicyHelp')}
                      contentClassName="space-y-3 pt-5"
                    >
                          {([
                            {
                              policy: 'NONE' as OutstandingPolicy,
                              title: t('rightRail.fullPaymentRequired'),
                              description: t('rightRail.fullPaymentRequiredHelp'),
                            },
                            {
                              policy: 'PAY_ON_COLLECTION' as OutstandingPolicy,
                              title: t('remainder.payOnCollection'),
                              description: t('rightRail.payOnCollectionHelp'),
                            },
                            {
                              policy: 'CREDIT_INVOICE' as OutstandingPolicy,
                              title: t('remainder.invoiceOutstanding'),
                              description: t('rightRail.invoiceOutstandingHelp'),
                            },
                          ]).map((option) => (
                            <CmxButton
                              key={option.policy}
                              ref={option.policy === 'PAY_ON_COLLECTION' ? payOnCollectionPolicyButtonRef : undefined}
                              type="button"
                              variant="outline"
                              onClick={() => handleOutstandingPolicyChange(option.policy)}
                              className={`h-auto w-full justify-start rounded-2xl border px-4 py-3 text-left ${
                                effectiveOutstandingPolicy === option.policy
                                  ? 'border-teal-500 bg-teal-50 text-slate-900 shadow-sm'
                                  : 'border-slate-200 bg-white text-slate-700'
                              } ${isRTL ? 'text-right' : ''}`}
                            >
                              <div className="space-y-1">
                                <p className="text-sm font-semibold">{option.title}</p>
                                <p className="text-xs text-slate-500">{option.description}</p>
                              </div>
                            </CmxButton>
                          ))}
                    </PaymentWorkbenchSection>
                  ) : null}
                </div>
                    </CmxCardContent>
                  </CmxCard>
                </section>

                {/* Phase 6: below xl the receipt rail is a slide-over; the
                    backdrop closes it. At xl+ these overrides reset to the
                    original in-grid column. */}
                {railOpen ? (
                  <button
                    type="button"
                    aria-label={tCommon('close')}
                    data-testid="payment-rail-backdrop"
                    onClick={() => setRailOpen(false)}
                    className="fixed inset-0 z-40 bg-slate-900/40 xl:hidden"
                  />
                ) : null}
                <aside
                  data-testid="payment-receipt-rail"
                  className={`fixed inset-y-0 end-0 z-50 w-[min(92vw,380px)] overflow-y-auto bg-slate-50 p-3 shadow-2xl transition-transform duration-300 motion-reduce:transition-none xl:static xl:z-auto xl:w-auto xl:min-w-0 xl:translate-x-0 xl:overflow-visible xl:bg-transparent xl:p-0 xl:shadow-none ${
                    railOpen
                      ? 'translate-x-0'
                      : isRTL
                        ? '-translate-x-full'
                        : 'translate-x-full'
                  } ${
                    PAYMENT_MODAL_V04_PIN_FINAL_ORDER_TOTAL
                      ? 'xl:sticky xl:top-0 xl:z-10 xl:flex xl:max-h-[calc(94vh-11rem)] xl:flex-col xl:self-start'
                      : ''
                  }`}
                >
                  <div className={`mb-2 flex justify-end xl:hidden ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <CmxButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setRailOpen(false)}
                      aria-label={tCommon('close')}
                      className="min-h-[44px] rounded-xl text-slate-600"
                    >
                      <X className="h-4 w-4" />
                    </CmxButton>
                  </div>
                  <CmxCard
                    className={`overflow-hidden border-cyan-100 bg-white/95 shadow-sm ${
                      PAYMENT_MODAL_V04_PIN_FINAL_ORDER_TOTAL ? 'flex min-h-0 flex-1 flex-col' : ''
                    }`}
                  >
                    <CmxCardHeader className="shrink-0 border-b border-cyan-100 pb-3">
                      <CmxCardTitle className={`flex items-center gap-2 text-base font-semibold text-cyan-900 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                        <UserRound className="h-4 w-4 text-cyan-700" />
                        {t('sections.receiptBrain')}
                      </CmxCardTitle>
                      <p className={`mt-1 text-xs text-slate-500 ${isRTL ? 'text-right' : 'text-left'}`}>
                        {t('sections.receiptBrainHelp')}
                      </p>
                    </CmxCardHeader>
                    <CmxCardContent
                      className={`pt-3 ${
                        PAYMENT_MODAL_V04_PIN_FINAL_ORDER_TOTAL
                          ? 'flex min-h-0 flex-1 flex-col gap-0'
                          : 'space-y-3'
                      }`}
                    >
                <div
                  className={
                    PAYMENT_MODAL_V04_PIN_FINAL_ORDER_TOTAL
                      ? 'min-h-0 flex-1 space-y-3 overflow-y-auto pe-0.5'
                      : 'space-y-3'
                  }
                >
                  <CmxCard className="overflow-hidden border-slate-200 bg-white/95 shadow-sm">
                    <CmxCardContent className="pt-5">
                      <div className={`flex items-start gap-3 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-cyan-700">
                          <UserRound className="h-6 w-6" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <p className="truncate text-lg font-semibold text-slate-900">{customerHeaderName}</p>
                            {customerType === 'b2b' ? (
                              <Badge variant="secondary" className="rounded-full bg-slate-100 text-slate-700">
                                B2B
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-1 truncate text-sm text-slate-500">{customerHeaderMeta}</p>
                        </div>
                      </div>
                    </CmxCardContent>
                  </CmxCard>

                  <div>
                    <CmxCard className="overflow-hidden border-slate-200 bg-white/95 shadow-sm backdrop-blur">
                      <CmxCardHeader className="border-b border-slate-100 pb-3">
                        <div className={`flex items-center justify-between gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <CmxCardTitle className="text-sm text-slate-900">{t('rightRail.balanceResult')}</CmxCardTitle>
                          <Badge
                            variant="secondary"
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors duration-300 motion-reduce:transition-none ${
                              rightRailState.balanceStatus === RIGHT_RAIL_BALANCE_STATUS.BLOCKED
                                ? 'bg-rose-100 text-rose-700'
                                : rightRailState.balanceStatus === RIGHT_RAIL_BALANCE_STATUS.OVERPAID
                                  ? 'bg-amber-100 text-amber-700'
                                  : rightRailState.balanceStatus === RIGHT_RAIL_BALANCE_STATUS.FULLY_SETTLED
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-cyan-100 text-cyan-700'
                            }`}
                          >
                            {balanceStatusLabel}
                          </Badge>
                        </div>
                      </CmxCardHeader>
                      <CmxCardContent className="space-y-2 pt-4">
                        <SummaryRow
                          label={t('rightRail.orderTotal')}
                          value={`${currencyCode} ${formatAmount(saleTotal)}`}
                        />
                          <SummaryRow
                            label={t('rightRail.totalSettledNow')}
                            value={`${currencyCode} ${formatAmount(amountAppliedToOrder)}`}
                          />
                        <SummaryRow
                          label={t('rightRail.remainingBalance')}
                          value={`${currencyCode} ${formatAmount(remainingBalance)}`}
                          negative={remainingBalance > moneyEpsilon}
                        />
                        {displayChangeAmount > moneyEpsilon ? (
                          <SummaryRow
                            label={t('rightRail.changeReturned')}
                            value={`${currencyCode} ${formatAmount(displayChangeAmount)}`}
                          />
                        ) : null}
                        {unresolvedOverpaymentAmount > moneyEpsilon ? (
                          <SummaryRow
                            label={t('rightRail.overpaidAmount')}
                            value={`${currencyCode} ${formatAmount(unresolvedOverpaymentAmount)}`}
                            negative
                          />
                        ) : null}
                        {/* Finding 1.4: polite live region driven by the balance-status
                            machine; the visible status already lives in the header badge
                            (the duplicated status row was removed — finding 1.1). */}
                        <p role="status" aria-live="polite" className="sr-only">
                          {balanceStatusAnnouncement}
                        </p>
                      </CmxCardContent>
                    </CmxCard>
                  </div>

                  {requiredActionCopy ? (
                    <CmxCard className="overflow-hidden border-rose-200 bg-rose-50/80 shadow-sm">
                      <CmxCardHeader className="border-b border-rose-100 pb-3">
                        <CmxCardTitle className={`flex items-center gap-2 text-sm text-rose-900 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <CircleAlert className="h-4 w-4" />
                          {requiredActionCopy.title}
                        </CmxCardTitle>
                      </CmxCardHeader>
                      <CmxCardContent className="space-y-3 pt-4">
                        <p className={`text-sm font-medium text-rose-900 ${isRTL ? 'text-right' : 'text-left'}`}>
                          {requiredActionCopy.message}
                        </p>
                        <CmxButton
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={handleRequiredAction}
                          className="w-full rounded-xl border-rose-200 bg-white text-rose-800 hover:bg-rose-100"
                        >
                          {requiredActionCopy.actionLabel ?? t('workspace.fixAction')}
                        </CmxButton>
                      </CmxCardContent>
                    </CmxCard>
                  ) : null}

                  <CmxCard className="overflow-hidden border-slate-200 bg-white/95 shadow-sm">
                    <CmxCardHeader className="border-b border-slate-100 pb-3">
                      <CmxCardTitle className="text-sm text-slate-900">{t('rightRail.settlementNow')}</CmxCardTitle>
                    </CmxCardHeader>
                    <CmxCardContent className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <p className={`text-[11px] font-semibold ${labelCase} text-slate-500 ${isRTL ? 'text-right' : 'text-left'}`}>
                          {t('rightRail.realPaymentsReceived')}
                        </p>
                        {realPaymentSummaryItems.length > 0 ? (
                          realPaymentSummaryItems.map((item) => (
                            <SummaryRow key={`${item.label}-${item.value}`} label={item.label} value={item.value} />
                          ))
                        ) : (
                          <p className={`text-xs text-slate-500 ${isRTL ? 'text-right' : 'text-left'}`}>
                            {t('rightRail.noneApplied')}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <p className={`text-[11px] font-semibold ${labelCase} text-slate-500 ${isRTL ? 'text-right' : 'text-left'}`}>
                          {t('rightRail.creditsApplied')}
                        </p>
                        {storedValueSummaryItems.length > 0 || appliedGiftCard ? (
                          <>
                            {storedValueSummaryItems.map((item) => (
                              <SummaryRow key={`${item.label}-${item.value}`} label={item.label} value={item.value} />
                            ))}
                            {appliedGiftCard ? (
                              <SummaryRow
                                label={t('giftCard.title')}
                                value={`${currencyCode} ${formatAmount(appliedGiftCard.amount)}`}
                              />
                            ) : null}
                          </>
                        ) : (
                          <p className={`text-xs text-slate-500 ${isRTL ? 'text-right' : 'text-left'}`}>
                            {t('rightRail.noneApplied')}
                          </p>
                        )}
                      </div>
                      <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2">
                        <SummaryRow
                          label={t('rightRail.totalSettledNow')}
                          value={`${currencyCode} ${formatAmount(amountAppliedToOrder)}`}
                          bold
                        />
                      </div>
                    </CmxCardContent>
                  </CmxCard>

                  <CmxCard className="overflow-hidden border-slate-200 bg-white/95 shadow-sm">
                    <CmxCardHeader className="border-b border-slate-100 pb-3">
                      <CmxCardTitle className="text-sm text-slate-900">{t('sections.shortcuts')}</CmxCardTitle>
                    </CmxCardHeader>
                    <CmxCardContent className="space-y-2 pt-4">
                      <CmxButton
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => scrollToWorkbenchSection(PAYMENT_MODAL_SECTION_IDS.DISCOUNTS_CREDITS)}
                        className="w-full justify-between rounded-xl"
                      >
                        <span>{t('rightRail.adjustments')}</span>
                        {appliedBadgeCount > 0 ? <Badge variant="secondary">{appliedBadgeCount}</Badge> : null}
                      </CmxButton>
                      {cashDrawerRequired ? (
                        <CmxButton
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => scrollToWorkbenchSection(PAYMENT_MODAL_SECTION_IDS.CASH_DRAWER)}
                          className="w-full justify-between rounded-xl"
                        >
                          <span>{t('sections.cashDrawer')}</span>
                          <Badge variant="secondary">{selectedCashDrawerChoice ? t('cashDrawer.boundBadge') : t('cashDrawer.pendingBadge')}</Badge>
                        </CmxButton>
                      ) : null}
                      <CmxButton
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => scrollToWorkbenchSection(PAYMENT_MODAL_SECTION_IDS.FINANCIAL_INSPECTOR)}
                        className="w-full justify-between rounded-xl"
                      >
                        <span>{t('sections.financialInspector')}</span>
                        <Badge variant="secondary">{inspectorTabIds.length}</Badge>
                      </CmxButton>
                      {showBalancePolicySection ? (
                        <CmxButton
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => scrollToWorkbenchSection(PAYMENT_MODAL_SECTION_IDS.BALANCE_POLICY)}
                          className="w-full justify-between rounded-xl"
                        >
                          <span>{t('rightRail.balancePolicy')}</span>
                          <Badge variant="secondary">{balanceStatusLabel}</Badge>
                        </CmxButton>
                      ) : null}
                    </CmxCardContent>
                  </CmxCard>
                </div>
                {PAYMENT_MODAL_V04_PIN_FINAL_ORDER_TOTAL ? (
                  <div className="hidden shrink-0 border-t border-slate-200 pt-3 xl:block">
                    <FinalOrderTotalPanel
                      value={orderValueBreakdownModel.totalRow.value}
                      title={t('orderValue.finalTotal')}
                      help={t('orderValue.finalTotalHelp')}
                      isRTL={isRTL}
                    />
                  </div>
                ) : null}
                    </CmxCardContent>
                  </CmxCard>
                </aside>
              </div>
              )}
            </div>

              <CmxDialogFooter className="flex-col items-stretch gap-2 border-t border-slate-200 bg-white">
                {/* Phase 6 docked bar: Final Total + Change stay visible beside
                    the CTA below xl (the rail is a slide-over there). */}
                <div className={`flex w-full items-stretch gap-2 xl:hidden ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <PaymentDockedSummaryBar
                    finalTotalLabel={t('orderValue.finalTotal')}
                    finalTotalValue={orderValueBreakdownModel.totalRow.value}
                    changeLabel={t('mode.simpleView.change')}
                    changeValue={`${currencyCode} ${formatAmount(displayChangeAmount)}`}
                    showChange={displayChangeAmount > moneyEpsilon}
                    isRTL={isRTL}
                    className="min-w-0 flex-1"
                  />
                  {mode === PAYMENT_MODAL_MODE.FULL ? (
                    <CmxButton
                      type="button"
                      variant="outline"
                      size="sm"
                      data-testid="payment-rail-toggle"
                      onClick={() => setRailOpen(true)}
                      className="min-h-[44px] shrink-0 rounded-xl border-slate-300 text-slate-700"
                    >
                      {t('sections.receiptBrain')}
                    </CmxButton>
                  ) : null}
                </div>
                {/* Phase 5: a routed server rejection surfaces as an in-view
                    guard naming the same cause as the server (shared footer —
                    visible in both faces; cleared on the next attempt). */}
                {serverGuard ? (
                  <PaymentSubmitGuard
                    reason={serverGuard.reason}
                    message={serverGuard.message}
                    actionLabel={serverGuardActionLabel}
                    onAction={showServerGuardAction ? handleServerGuardAction : undefined}
                    isRTL={isRTL}
                  />
                ) : b2bCreditClientGuard ? (
                  <PaymentSubmitGuard
                    reason="B2B_CREDIT_EXCEEDED"
                    message={t('b2b.creditExceeded')}
                    actionLabel={t('capabilities.B2B_ACCOUNT_BILLING.action')}
                    onAction={() => setB2bDialogOpen(true)}
                    isRTL={isRTL}
                  />
                ) : null}
                {validationItems.length > 0 ? (
                  <CmxSummaryMessage
                    type="warning"
                    title={t('messages.validationErrors')}
                    items={validationItems}
                    className="w-full"
                  />
                ) : null}
                <div
                  className={`flex w-full flex-col gap-3 ${
                    isRTL ? 'md:flex-row-reverse' : 'md:flex-row'
                  }`}
                >
                  <CmxButton type="button" variant="outline" onClick={closeWithGuard} className="flex-1 rounded-2xl border-slate-300">
                    {tCommon('cancel')}
                  </CmxButton>
                  {payExtraIntent &&
                  stripExtraAmount > moneyEpsilon &&
                  !overpaymentResolutionPayload ? (
                    <PaymentValidateButton
                      onClick={runValidatePayment}
                      disabled={!canEnablePayExtra}
                      isRTL={isRTL}
                      className="flex-1"
                    />
                  ) : null}
                  <CmxButton
                    type="button"
                    data-testid="payment-submit-button"
                    loading={loading}
                    disabled={submitBusy}
                    aria-disabled={submitHasBlockingIssues || submitBusy}
                    onClick={
                      submitHasBlockingIssues
                        ? mode === PAYMENT_MODAL_MODE.SIMPLE
                          ? handleSimpleBlockedSubmitAttempt
                          : handleBlockedSubmitAttempt
                        : // eslint-disable-next-line react-hooks/refs -- RHF handleSubmit reads form refs; event-time only
                          handleSubmit(onSubmitForm, onInvalidForm)
                    }
                    className={`flex-1 rounded-2xl font-bold shadow-sm ${
                      submitHasBlockingIssues
                        ? 'cursor-not-allowed bg-slate-300 text-slate-500 opacity-60 hover:bg-slate-300'
                        : 'bg-gradient-to-r from-teal-600 to-cyan-700'
                    }`}
                    size="lg"
                  >
                    {submitButtonLabel}
                  </CmxButton>
                </div>
                <p className={`w-full text-xs text-slate-500 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('messages.paymentMethodNote', { method: summaryMethodLabel })}
                </p>
              </CmxDialogFooter>
            </form>
          </div>
        </CmxDialogContent>
      </CmxDialog>

      <CmxDialog open={cashDrawerDialogOpen} onOpenChange={setCashDrawerDialogOpen}>
        <CmxDialogContent className="max-w-lg" scrollBody draggable>
          <CmxDialogHeader>
            <CmxDialogTitle>{t('cashDrawer.dialogTitle')}</CmxDialogTitle>
          </CmxDialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">{t('cashDrawer.dialogDescription')}</p>

            {cashDrawerRequestError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {cashDrawerRequestError}
              </div>
            )}

            <div className="space-y-2">
              <label className={`block text-sm font-medium text-slate-900 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('cashDrawer.drawerLabel')}
              </label>
              <CmxSelectDropdown
                value={cashDrawerToOpenId}
                onValueChange={(value) => {
                  setCashDrawerToOpenId(value);
                  setCashDrawerRequestError(null);
                }}
                emptyLabel={t('cashDrawer.drawerPlaceholder')}
              >
                <CmxSelectDropdownTrigger dir={isRTL ? 'rtl' : 'ltr'}>
                  <CmxSelectDropdownValue
                    displayValue={
                      (() => {
                        const selectedDrawer = cashDrawers.find((drawer) => drawer.id === cashDrawerToOpenId);
                        return selectedDrawer
                          ? getDrawerDisplayName(selectedDrawer)
                          : t('cashDrawer.drawerPlaceholder');
                      })()
                    }
                    placeholder={t('cashDrawer.drawerPlaceholder')}
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
              <label className={`block text-sm font-medium text-slate-900 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('cashDrawer.openingBalanceLabel')}
              </label>
              <CmxMoneyField
                value={openingBalanceValue}
                decimalPlaces={decimalPlaces}
                showZero
                aria-label={t('cashDrawer.openingBalanceLabel')}
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
              {tCommon('cancel')}
            </CmxButton>
            <CmxButton
              type="button"
              onClick={() => void handleCreateCashDrawerSession()}
              disabled={openingDrawerSession || !cashDrawerToOpenId}
            >
              {openingDrawerSession ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  {t('cashDrawer.openingAction')}
                </>
              ) : (
                t('cashDrawer.openSession')
              )}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>

      <CmxDialog
        open={submitConfirmOpen}
        onOpenChange={(nextOpen) => {
          setSubmitConfirmOpen(nextOpen);
          if (!nextOpen) setPendingSubmission(null);
        }}
      >
        <CmxDialogContent data-testid="payment-submit-confirm" className="max-w-lg" scrollBody draggable>
          <CmxDialogHeader>
            <CmxDialogTitle>{t('submitConfirm.title')}</CmxDialogTitle>
          </CmxDialogHeader>
          <div className="space-y-4">
            <p className={`text-sm text-slate-600 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('submitConfirm.description')}
            </p>
            <div className="rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4">
              <div className="space-y-2">
                <SummaryRow label={t('rightRail.orderTotal')} value={`${currencyCode} ${formatAmount(saleTotal)}`} />
                <SummaryRow label={t('rightRail.totalSettledNow')} value={`${currencyCode} ${formatAmount(amountAppliedToOrder)}`} />
                {cashTenderedAmount > moneyEpsilon ? (
                  <SummaryRow
                    label={t('rightRail.cashTendered')}
                    value={`${currencyCode} ${formatAmount(cashTenderedAmount)}`}
                  />
                ) : null}
                {appliedGiftCard ? (
                  <SummaryRow label={t('giftCard.title')} value={`${currencyCode} ${formatAmount(appliedGiftCard.amount)}`} />
                ) : null}
                <SummaryRow
                  label={t('rightRail.remainingBalance')}
                  value={`${currencyCode} ${formatAmount(remainingBalance)}`}
                  negative={remainingBalance > moneyEpsilon}
                />
                {displayChangeAmount > moneyEpsilon ? (
                  <SummaryRow
                    label={t('rightRail.changeReturned')}
                    value={`${currencyCode} ${formatAmount(displayChangeAmount)}`}
                  />
                ) : null}
                {overpaymentResolutionPayload ? (
                  <SummaryRow
                    label={t('submitConfirm.extraRouting')}
                    value={getExtraReceiptResolutionSummary(
                      allocation.extraReceiptMode,
                      overpaymentResolutionPayload.excessAmount,
                      currencyCode,
                      formatAmount,
                      t
                    )}
                  />
                ) : unresolvedOverpaymentAmount > moneyEpsilon ? (
                  <SummaryRow
                    label={t('rightRail.overpaidAmount')}
                    value={`${currencyCode} ${formatAmount(unresolvedOverpaymentAmount)}`}
                    negative
                  />
                ) : null}
                <SummaryRow label={t('submitConfirm.paymentMethod')} value={summaryMethodLabel} />
                {remainingBalance > moneyEpsilon ? (
                  <SummaryRow label={t('rightRail.balancePolicy')} value={simplePolicyLabel} />
                ) : null}
              </div>
            </div>
            {remainingBalance > moneyEpsilon ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 space-y-1">
                <p>
                  {t('submitConfirm.remainingNotice', {
                    amount: `${currencyCode} ${formatAmount(remainingBalance)}`,
                  })}
                </p>
                {remainingPolicyDetail ? (
                  <p>
                    {t('submitConfirm.remainingDestination', {
                      policy: simplePolicyLabel,
                      detail: remainingPolicyDetail,
                    })}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
          <CmxDialogFooter className={`flex gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <CmxButton
              type="button"
              variant="outline"
              onClick={() => {
                setSubmitConfirmOpen(false);
                setPendingSubmission(null);
              }}
            >
              {tCommon('cancel')}
            </CmxButton>
            <CmxButton
              type="button"
              data-testid="payment-submit-confirm-button"
              onClick={handleConfirmPaymentSubmit}
              disabled={!pendingSubmission}
            >
              {t('submitConfirm.confirm')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>

      <PaymentModalV4CreditNotePicker
        open={creditNotePickerOpen}
        onClose={() => {
          setCreditNotePickerOpen(false);
          setPendingCreditNoteOption(null);
        }}
        notes={storedValueSummary?.creditNotes ?? []}
        selectedNoteId={
          paymentLegs.find((leg) => leg.method === 'CREDIT_NOTE')?.creditReferenceId ?? null
        }
        onSelect={handleCreditNoteSelect}
        isRTL={isRTL}
      />

      <CmxConfirmDialog
        open={confirmCloseOpen}
        title={tCommon('confirm')}
        description={t('messages.discardChanges')}
        confirmLabel={tCommon('close')}
        cancelLabel={tCommon('cancel')}
        onCancel={() => setConfirmCloseOpen(false)}
        onConfirm={() => {
          setConfirmCloseOpen(false);
          setIsDirtySinceOpen(false);
          onClose();
        }}
      />

      {/* Overpayment-routing capability surface (ADR #5) — the adapter wraps the
          battle-tested extra-receipt dialog, routing open/confirm/back through the
          typed engine actions and adding capability open-observability. */}
      <OverpaymentRoutingDialog
        open={extraReceiptDialogOpen}
        actions={overpaymentRoutingActions}
        excessAmount={extraReceiptDialogExcessAmount}
        currencyCode={currencyCode}
        formatAmount={formatAmount}
        hasLinkedCustomer={Boolean(customerId?.trim())}
        selectedMode={allocation.extraReceiptMode}
        onModeChange={(mode) => {
          allocation.setExtraReceiptMode(mode);
          if (
            mode !== OVERPAYMENT_RESOLUTIONS.AUTO_ALLOCATE_TO_CUSTOMER_BALANCES &&
            mode !== OVERPAYMENT_RESOLUTIONS.ALLOCATE_TO_CUSTOMER_BALANCES
          ) {
            allocation.resetAllocationState();
          }
          // QA C17-1.2: "Adjust payment amounts" has no confirm step — close the
          // dialog and put the operator on the thing they need to change (the
          // amount editor when only one leg exists, the legs workspace otherwise).
          if (mode === 'adjust_legs') {
            setExtraReceiptDialogOpen(false);
            if (editableLegEntries.length === 1) {
              setActiveLegIndex(editableLegEntries[0].index);
              focusAmountEditor();
            } else {
              scrollToWorkbenchSection(PAYMENT_MODAL_SECTION_IDS.PAYMENT_WORKSPACE);
            }
          }
        }}
        onOpenAutoAllocate={
          canAllocateOverpayment ? () => void allocation.handleOpenAutoAllocate() : undefined
        }
        onOpenManualAllocate={
          canAllocateOverpayment ? () => void allocation.handleOpenManualAllocate() : undefined
        }
        allocationConfirmed={Boolean(allocation.allocationPreviewId)}
        canReturnCashChange={canReturnChangeFromCash}
        canAllocate={canAllocateOverpayment}
        canSaveAdvance={canSaveAdvanceOverpayment}
        canSaveCredit={canSaveCreditOverpayment}
        canSaveWallet={canWalletOverpayment}
        onConfirmFailed={() => {
          cmxMessage.error(t('validatePayment.requiredBeforeSubmit'));
        }}
        confirmDisabled={!overpaymentResolutionPayload}
        isRTL={isRTL}
      />

      {/*
        Allocation drawers are rendered AFTER the extra-receipt dialog on purpose.
        CmxDialog renders inline (no portal) with a shared `z-50`, so stacking is
        decided by DOM order. Declaring these last lets the auto/manual allocation
        drawers paint ABOVE the extra-receipt dialog that opens them; otherwise they
        appear behind it and the operator cannot confirm the allocation.
      */}
      <AutoAllocationPreviewDrawer
        open={allocation.autoDrawerOpen}
        onOpenChange={allocation.setAutoDrawerOpen}
        preview={allocation.allocationPreview}
        loading={allocation.previewLoading}
        confirming={allocation.confirmLoading}
        currencyCode={currencyCode}
        formatAmount={formatAmount}
        onConfirm={() => void allocation.handleConfirmAutoAllocation()}
        isRTL={isRTL}
      />

      <ManualAllocationDrawer
        open={allocation.manualDrawerOpen}
        onOpenChange={allocation.setManualDrawerOpen}
        targets={allocation.openBalanceTargets}
        excessAmount={unresolvedOverpaymentAmount}
        currencyCode={currencyCode}
        formatAmount={formatAmount}
        loading={allocation.openBalancesLoading}
        submitting={allocation.confirmLoading}
        onSubmit={(lines) => void allocation.handleSubmitManualAllocation(lines)}
        isRTL={isRTL}
      />
    </>
  );
}
