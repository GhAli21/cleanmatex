/**
 * New Order Content
 * Main content area: sticky top bar, step tabs, product grid, and order summary
 * PRD-010: Advanced Order Management
 */

'use client';

import { useBreakpoint } from '@/lib/hooks/use-breakpoint';
import { useNewOrderStateWithDispatch } from '../hooks/use-new-order-state';
import { useCategories, useProducts } from '../hooks/use-category-products';
import { useNewOrderCartQuote } from '../hooks/use-new-order-cart-quote';
import { useHasAnyPermission } from '@/lib/hooks/usePermissions';
import { NEW_ORDER_ACCESS } from '../access/orders-access';
import { LineDiscountDialog } from './line-discount-dialog';
import { useServiceSpeeds } from '../hooks/use-service-speeds';
import { SERVICE_SPEEDS } from '@/lib/constants/commercial';
import { useTenantSettingsWithDefaults } from '@/lib/hooks/useTenantSettings';
import { useAuth } from '@/lib/auth/auth-context';
import { usePlanFlags } from '../hooks/use-plan-flags';
import { useTenantPreferenceSettings } from '../hooks/use-tenant-preference-settings';
import { usePreferenceCatalog } from '../hooks/use-preference-catalog';
import { useOrderSubmission } from '../hooks/use-order-submission';
import { useOrderWorkspaceSessionOptional } from '../order-change/order-workspace-session';
import { setEditLeaveBypass } from '../order-change/edit-page-session';
import { EditOrderContextBar } from '../order-change/edit-order-context-bar';
import { EditPolicyInfoButton } from '../order-change/edit-policy-info-button';
import { useOrderEditDirty } from '../hooks/use-order-edit-dirty';
import { useOrderEditCancel } from '../hooks/use-order-edit-cancel';
import { useOrderWarnings } from '../hooks/use-order-warnings';
import { useUnsavedChanges } from '../hooks/use-unsaved-changes';
import { usePaymentModalVersion } from '../hooks/use-payment-modal-version';
import { useKeyboardNavigation } from '@/lib/hooks/use-keyboard-navigation';
import { useOrderPerformance } from '../hooks/use-order-performance';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { formatMoneyAmountWithCode } from '@/lib/money/format-money';
import type { CartQuoteLine } from '@/lib/types/cart-quote';
import { useCallback, useMemo, useEffect, useState, useRef } from 'react';
import { CmxButton } from '@ui/primitives/cmx-button';
import { Check, GitBranch } from 'lucide-react';
import { cmxMessage, CmxAlertDialog, CmxSummaryMessage } from '@ui/feedback';
import { getBranchesAction } from '@/app/actions/inventory/inventory-actions';
import { getCurrencyConfigOutcomeAction } from '@/app/actions/tenant/get-currency-config';
import type { ServicePreferenceCode } from '@/lib/types/service-preferences';
import type { BranchOption } from '@/lib/services/inventory-service';
import { NewOrderTopBar } from './new-order-top-bar';
import { useNewOrderDispatch } from './context/new-order-context';
import { useNewOrderPosSessionGate } from '../hooks/use-new-order-pos-session';
import { EditControlNotice } from '../order-change/edit-control-notice';
import { useEditControlGroup } from '../order-change/use-edit-control-capability';
import { ProductGrid } from './product-grid';
import { PosShortcutsDialog } from './pos-shortcuts-dialog';
import { resolvePosHotkey } from '../hooks/use-pos-hotkeys';
import { isEditableEventTarget } from '../hooks/use-payment-shortcuts';
import { useProductSpeedPrices } from '../hooks/use-product-speed-prices';
import { OrderSummaryPanel } from './order-summary-panel';
import { OrderSummaryBottomSheet } from './OrderSummaryBottomSheet';
import { ProductGridSkeleton } from './loading-skeletons';
import { OrderDetailsSection } from './order-details-section';
import { OrderCustomerDetailsSection } from './order-customer-details-section';
import { OrderPiecePreferencesSection } from './piece-preferences/order-piece-preferences-section';
import { OrderPreferencesDialog } from './preferences/OrderPreferencesDialog';
import { OrderPiecesNotesSection } from './order-pieces-notes-section';
import { EditOrderBar } from './edit-order-bar';
import { PosSessionOrderBanner } from '@features/pos-sessions/ui/pos-session-order-banner';
import { PosSessionHub } from '@features/pos-sessions/ui/pos-session-hub';
import type {
  LineKey,
  Product,
  OrderItem,
  OrderItemMeasure,
  OrderItemUom,
  PreSubmissionPiece,
} from '../model/new-order-types';
import { MeasureLineDialog, type MeasureMergeChoice } from './measure-line-dialog';
import { useUomUnits } from '@features/uom/hooks/use-uom-units';
import { pricedQty } from '@/lib/utils/order-item-helpers';
import { generatePiecesForItem } from '@/lib/utils/piece-helpers';
import { newCartLineKey } from '../model/cart-line-key';
import { findMatchingMeasuredLines, measureWithArticle, productLineNumber, resolveCartAddTarget } from '../model/cart-line-grouping';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { readyByBlockReason } from '@/lib/utils/ready-by-calculator';
import { calculateItemTotal } from '@/lib/utils/order-item-helpers';
import {
  orderItemLinePackingCharge,
  packingPreferencePriceMap,
} from '@/lib/utils/order-packing-charges';
import { useBilingual } from '@/lib/utils/bilingual';
import { useReadyByZone } from '../hooks/use-ready-by-zone';

/**
 * New Order Content Component
 *
 * @returns Tenant-aware new order workspace with the payment modal selector for demo tenants.
 */
export function NewOrderContent() {
  const t = useTranslations('newOrder');
  const tPos = useTranslations('posSessions');
  const tWorkflow = useTranslations('workflow');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { currentTenant } = useAuth();
  const state = useNewOrderStateWithDispatch();
  const dispatch = useNewOrderDispatch();
  const posGate = useNewOrderPosSessionGate({
    isEditMode: state.state.isEditMode,
    dispatch,
  });
  const orderEntryLocked = !state.state.isEditMode && posGate.mode !== 'open';
  const posGuide =
    posGate.mode === 'none' ||
    posGate.mode === 'paused' ||
    posGate.mode === 'error'
      ? posGate.mode
      : null;
  const { trackByPiece, packingPerPieceEnabled, enforcePrefCompatibility } =
    useTenantSettingsWithDefaults(currentTenant?.tenant_id || '');
  const { bundlesEnabled, repeatLastOrderEnabled, smartSuggestionsEnabled } =
    usePlanFlags();
  const { autoApplyCustomerPrefs } = useTenantPreferenceSettings({
    tenantId: currentTenant?.tenant_id,
    branchId: state.state.branchId,
    enabled: true,
  });
  /** Full catalog for pricing, customer pref resolution, and summary colors */
  const orderCatalog = usePreferenceCatalog(state.state.branchId, false, false);
  /** Quick-bar kinds + visibility-filtered prefs for Edit Items Preferences tab */
  const pieceWizardCatalog = usePreferenceCatalog(
    state.state.branchId,
    true,
    true,
  );
  const { servicePrefs, conditionCatalog, packingPrefs, hasServicePrefs } =
    orderCatalog;
  const packingPriceByCode = useMemo(
    () => packingPreferencePriceMap(packingPrefs),
    [packingPrefs],
  );
  const packingExtraPriceByCode = useMemo(() => {
    const o: Record<string, number> = {};
    for (const [code, amount] of packingPriceByCode.entries()) {
      o[code] = amount;
    }
    return o;
  }, [packingPriceByCode]);
  const {
    preferenceKinds,
    kindsLoading,
    prefsByKind,
    servicePrefs: pieceWizardServicePrefs,
    conditionCatalog: pieceConditionCatalog,
  } = pieceWizardCatalog;
  const getBilingual = useBilingual();
  const preferenceLabelByCode = useMemo(() => {
    const m: Record<string, string> = {};
    const put = (
      code: string,
      name: string | null | undefined,
      name2: string | null | undefined,
    ) => {
      if (!code) return;
      m[code] = getBilingual(name, name2 ?? null);
    };
    for (const p of servicePrefs) put(p.code, p.name, p.name2 ?? null);
    for (const p of packingPrefs) put(p.code, p.name, p.name2 ?? null);
    for (const c of conditionCatalog.stains)
      put(c.code, c.name, c.name2 ?? null);
    for (const c of conditionCatalog.damages)
      put(c.code, c.name, c.name2 ?? null);
    for (const c of conditionCatalog.colors)
      put(c.code, c.name, c.name2 ?? null);
    return m;
  }, [servicePrefs, packingPrefs, conditionCatalog, getBilingual]);
  const { trackItemAddition, trackModalOpen, resetMetrics } =
    useOrderPerformance();
  const [requestedActiveTab, setRequestedActiveTab] = useState<
    'select' | 'details' | 'piecePreferences' | 'pieces' | 'customer'
  >('select');
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
  const [focusItemId, setFocusItemId] = useState<string | null>(null);
  const { isDesktop } = useBreakpoint();
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [orderPrefsDialogOpen, setOrderPrefsDialogOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [currencyCode, setCurrencyCode] = useState<string>('');
  const {
    submitOrder: _submitOrder,
    isSubmitting,
  } = useOrderSubmission();
  const { isDirty } = useOrderEditDirty();
  const {
    paymentModalVersion,
    setPaymentModalVersion,
    showPaymentModalVersionSelector,
  } = usePaymentModalVersion(currentTenant);
  // P5-03 (BF-19, D33): the cart's figures and ready-by come from the server
  // quote — the same calculation the payment modal and submit use. Order Edit
  // is not quoted as a new order; its only total is the live edit card.
  const cartQuote = useNewOrderCartQuote();
  const cartQuoteRequest = cartQuote.request;
  const summaryTotal = cartQuote.current && cartQuote.data ? cartQuote.data.totals.saleTotal : null;

  // ─── Speed change disclosure (rule #15, PLAN §11.1) ───────────────────────
  // A speed change re-prices lines on the server. The cart keeps the figures from
  // just before the change and, once the new quote is in, lists every line whose
  // price moved, until the cashier dismisses it or edits anything else in the cart.
  const speedAgnosticCartKey = useMemo(
    () => JSON.stringify([
      cartQuoteRequest.items.map(({ serviceSpeed: _speed, ...rest }) => rest),
      cartQuoteRequest.orderServicePrefs, cartQuoteRequest.branchId, cartQuoteRequest.customerId,
    ]),
    [cartQuoteRequest],
  );
  const tSpeed = useTranslations('newOrder.serviceSpeed');
  const locale = useLocale();
  const [speedChangeBase, setSpeedChangeBase] = useState<{
    requestId: string; lines: CartQuoteLine[]; cartKey: string;
  } | null>(null);
  const captureSpeedChange = () => {
    setSpeedChangeBase(cartQuote.current && cartQuote.data
      ? { requestId: cartQuote.data.requestId, lines: cartQuote.data.lines, cartKey: speedAgnosticCartKey }
      : null);
  };
  const speedChangeNote = useMemo(() => {
    const data = cartQuote.data;
    if (!speedChangeBase || !cartQuote.current || !data || data.requestId === speedChangeBase.requestId ||
      speedChangeBase.cartKey !== speedAgnosticCartKey) return null;
    const fmt = (amount: number) => formatMoneyAmountWithCode(amount, {
      currencyCode: data.currencyCode, decimalPlaces: data.decimalPlaces, locale: locale === 'ar' ? 'ar' : 'en',
    });
    const changed = data.lines.flatMap((line) => {
      const before = speedChangeBase.lines.find((b) => b.index === line.index);
      const item = state.state.items[line.index];
      if (!before || !item || before.grossAmount === line.grossAmount) return [];
      return [tSpeed('repricedLine', {
        item: getBilingual(item.productName, item.productName2) || item.productId,
        from: fmt(before.grossAmount),
        to: fmt(line.grossAmount),
      })];
    });
    if (changed.length === 0) return null;
    return {
      title: tSpeed('repricedTitle', { count: changed.length }),
      items: changed,
      onDismiss: () => setSpeedChangeBase(null),
    };
  }, [speedChangeBase, cartQuote.current, cartQuote.data, speedAgnosticCartKey, state.state.items, tSpeed, getBilingual, locale]);
  const { labelOf: speedLabel } = useServiceSpeeds();
  const productSpeedNote = state.state.serviceSpeed !== SERVICE_SPEEDS.STANDARD
    ? tSpeed('premiumInCart', { speed: speedLabel(state.state.serviceSpeed) })
    : null;
  const productSpeedPrices = useProductSpeedPrices(state.state.products);
  const productSpeedPricedNote = productSpeedPrices ? tSpeed('priceAtSpeed', { speed: speedLabel(state.state.serviceSpeed) }) : null;
  const handleServiceSpeedChange = (serviceSpeed: string) => {
    if (serviceSpeed === state.state.serviceSpeed) return;
    captureSpeedChange();
    state.setServiceSpeed(serviceSpeed);
  };
  const handleLineSpeedChange = (lineKey: LineKey, serviceSpeed: string | null) => {
    captureSpeedChange();
    state.setItemServiceSpeed(lineKey, serviceSpeed);
  };
  // ─── Line discount (P5-03c): permission-gated; the server checks it again ───
  const canDiscountLines = useHasAnyPermission(NEW_ORDER_ACCESS.actions?.lineDiscount?.requirement.permissions ?? []);
  // P5-03e: a custom item's entered price is a price decision (`pricing:override`); in Edit also an ADD_ITEM (P6-02d).
  const canEnterPrices = useHasAnyPermission(NEW_ORDER_ACCESS.actions?.priceOverride?.requirement.permissions ?? []);
  const [discountLineKey, setDiscountLineKey] = useState<LineKey | null>(null);
  const [discountPieceId, setDiscountPieceId] = useState<string | null>(null);
  const discountItemIndex = discountLineKey
    ? state.state.items.findIndex((item) => item.lineKey === discountLineKey)
    : -1;
  const discountItem = discountItemIndex >= 0 ? state.state.items[discountItemIndex] : null;
  // Edit has no live quote: the stored line total caps the amount; Review re-prices and the server checks it again.
  const discountLineGross = discountItem && state.state.isEditMode
    ? discountItem.totalPrice
    : discountItemIndex >= 0 && cartQuote.current
      ? cartQuote.data?.lines.find((line) => line.index === discountItemIndex)?.grossAmount ?? null
      : null;

  const discountPieceIndex = discountItem?.pieces?.findIndex((p) => p.id === discountPieceId) ?? -1;
  const discountPiece = discountPieceIndex >= 0 ? discountItem?.pieces?.[discountPieceIndex] ?? null : null;
  const discountPieceGross = discountPieceIndex >= 0 && state.state.isEditMode
    ? discountItem?.pricePerUnit ?? null
    : discountPieceIndex >= 0 && cartQuote.current
    ? cartQuote.data?.lines.find((line) => line.index === discountItemIndex)?.pieces[discountPieceIndex]?.grossAmount ?? null
    : null;
  const closeDiscountDialog = () => {
    setDiscountLineKey(null);
    setDiscountPieceId(null);
  };

  const handleApplySpeedToAllLines = () => {
    captureSpeedChange();
    state.applySpeedToAllLines();
  };
  const { warnings, hasErrors } = useOrderWarnings({
    hasBranches: branches.length > 0,
  });
  /** Fills ready-by with the resolver's estimate for the cart as it is now (fresh, never a cached time). */
  const calculateReadyBy = async (): Promise<string | null> => {
    if (state.state.isEditMode || state.state.items.length === 0) return null;
    const fresh = await cartQuote.refetch();
    const readyByAt = fresh.data?.readyByAt ?? null;
    if (readyByAt) state.setReadyByAt(readyByAt);
    return readyByAt;
  };
  const tEdit = useTranslations('orders.edit');

  const hasUnsavedChanges = useCallback(() => {
    if (state.state.isEditMode) return isDirty;
    return (
      state.state.items.length > 0 ||
      (state.state.notes && state.state.notes.trim().length > 0) ||
      state.state.customer !== null
    );
  }, [
    state.state.isEditMode,
    isDirty,
    state.state.items.length,
    state.state.notes,
    state.state.customer,
  ]);

  const { allowNextNavigation } = useUnsavedChanges(
    hasUnsavedChanges,
    state.state.isEditMode
      ? tEdit('confirmLeave') || 'Leave without saving?'
      : t('warnings.unsavedChanges') ||
          'You have unsaved changes. Are you sure you want to leave?',
  );

  const { cancelEditOrder, isCancelling } = useOrderEditCancel(
    state.state.editingOrderId,
    allowNextNavigation,
  );

  const activeTab = useMemo(() => {
    if (
      state.state.items.length === 0 &&
      (requestedActiveTab === 'details' ||
        requestedActiveTab === 'piecePreferences' ||
        requestedActiveTab === 'pieces' ||
        requestedActiveTab === 'customer')
    ) {
      return 'select';
    }
    if (state.state.customer === null && requestedActiveTab === 'customer') {
      return 'select';
    }
    return requestedActiveTab;
  }, [requestedActiveTab, state.state.items.length, state.state.customer]);

  const isRetailOnlyOrder = useMemo(
    () =>
      state.state.items.length > 0 &&
      state.state.items.every((i) => i.serviceCategoryCode === 'RETAIL_ITEMS'),
    [state.state.items],
  );

  const totalPieces = useMemo(
    () =>
      state.state.items.reduce(
        (sum, item) => sum + (item.pieces?.length ?? item.quantity),
        0,
      ),
    [state.state.items],
  );

  useEffect(() => {
    resetMetrics();
  }, [resetMetrics]);

  useEffect(() => {
    getBranchesAction()
      .then((r) => {
        if (r.success && r.data) {
          setBranches(r.data);
          if (r.data.length === 1) state.setBranchId(r.data[0].id);
        }
      })
      .finally(() => setBranchesLoading(false));
  }, []);

  useEffect(() => {
    if (currentTenant?.tenant_id) {
      getCurrencyConfigOutcomeAction(
        currentTenant.tenant_id,
        state.state.branchId ?? undefined,
      ).then((outcome) => {
        setCurrencyCode(outcome.ok ? outcome.config.currencyCode : '');
      });
    }
  }, [currentTenant?.tenant_id, state.state.branchId]);

  const categoriesQuery = useCategories();
  const productsQuery = useProducts(state.state.selectedCategory);

  void categoriesQuery;

  const getCategoryLabel = useCallback(
    (code: string | null): string | undefined => {
      if (!code) return undefined;
      const cat = state.state.categories.find(
        (c) => c.service_category_code === code,
      );
      if (cat) {
        return getBilingual(cat.ctg_name, cat.ctg_name2) || code;
      }
      return code;
    },
    [state.state.categories, getBilingual],
  );

  useEffect(() => {
    if (!productsQuery.isError || !productsQuery.error) return;
    const message =
      productsQuery.error instanceof Error
        ? productsQuery.error.message
        : String(productsQuery.error);
    if (message.includes('403')) {
      cmxMessage.error(t('errors.productsForbidden'));
    } else if (
      message.includes('504') ||
      message.toLowerCase().includes('timeout')
    ) {
      cmxMessage.error(t('errors.timeoutError'));
    } else {
      cmxMessage.error(t('errors.failedToLoadProducts'));
    }
  }, [productsQuery.isError, productsQuery.error, t]);

  useEffect(() => {
    const { categories, selectedCategory } = state.state;
    const firstCode = categories[0]?.service_category_code;
    if (categories.length > 0 && !selectedCategory && firstCode) {
      state.setSelectedCategory(firstCode);
    }
  }, [state.state.categories, state.state.selectedCategory, state]);

  const handleSelectCategory = useCallback(
    (category: string) => {
      state.setSelectedCategory(category);
    },
    [state],
  );

  const workspace = useOrderWorkspaceSessionOptional();
  useEffect(() => {
    if (!workspace) return;
    setEditLeaveBypass(allowNextNavigation);
    return () => setEditLeaveBypass(null);
  }, [workspace, allowNextNavigation]);
  const itemCapability = useEditControlGroup(['ADD_ITEM']);
  // A line's cashier price and discount are their own policy cells (ITEM, P6-02c).
  const priceCapability = useEditControlGroup(['CHANGE_ITEM_PRICE'], 'ITEM');
  const lineDiscountCapability = useEditControlGroup(['CHANGE_DISCOUNT'], 'ITEM');
  // A measured merge changes the line's quantity and measure and adds a piece (Cart Line Grouping §4.5).
  const measuredMergeLineCapability = useEditControlGroup(['CHANGE_ITEM_QUANTITY', 'CHANGE_ITEM_MEASURE'], 'ITEM');
  const measuredMergePieceCapability = useEditControlGroup(['ADD_PIECE']);
  // A line's own speed is its own policy cell (CHANGE_SERVICE_SPEED / ITEM, P6-02b).
  const lineSpeedCapability = useEditControlGroup(['CHANGE_SERVICE_SPEED'], 'ITEM');

  // Measured products (kg, m, m²…) are added through the Measure dialog; the unit list decides which are measured.
  const uomUnits = useUomUnits(true);
  const tUom = useTranslations('uom');
  const tLines = useTranslations('newOrder.lines');
  const { formatMoneyWithCode } = useTenantCurrency();
  const [measureTarget, setMeasureTarget] = useState<{ product: Pick<Product, 'id' | 'product_code' | 'product_name' | 'product_name2'>; uom: OrderItemUom; lineKey?: LineKey } | null>(null);
  const uomOf = useCallback(
    (product: Product): OrderItemUom | null => {
      const unit = uomUnits.data?.find((u) => u.code === product.base_uom_code);
      if (!unit || unit.dimension === 'COUNT') return null;
      return {
        code: unit.code, dimension: unit.dimension, qtyDecimals: unit.qtyDecimals, symbol: unit.symbol, symbol2: unit.symbol2,
        minBillableQty: product.min_billable_qty ?? null, billingIncrement: product.billing_increment ?? null,
      };
    },
    [uomUnits.data],
  );

  const handleAddItem = useCallback(
    async (product: Product, measured?: { uom: OrderItemUom; measure: OrderItemMeasure }, mergeInto?: LineKey) => {
      if (!measured) {
        const uom = uomOf(product);
        // A product with a unit we cannot read yet is never added as a count: the server would refuse it as unmeasured.
        if (product.base_uom_code && !uomUnits.data) { cmxMessage.error(tUom('errors.GENERIC')); return; }
        if (uom) {
          setMeasureTarget({ product, uom });
          return;
        }
      }
      const isNewRetail =
        product.service_category_code === 'RETAIL_ITEMS' ||
        (product as { is_retail_item?: boolean }).is_retail_item;
      const existingItems = state.state.items;
      if (existingItems.length > 0) {
        const firstExisting = existingItems[0];
        const isExistingRetail =
          firstExisting.serviceCategoryCode === 'RETAIL_ITEMS';
        if (isNewRetail !== isExistingRetail) {
          cmxMessage.error(t('errors.mixedRetailServices'));
          return;
        }
      }

      // Standard catalog price only; the speed premium comes from the speed rules on the server (P5-03b).
      const pricePerUnit = product.default_sell_price || 0;

      let resolvedServicePrefs: Array<{
        preference_code: string;
        source: string;
        extra_price: number;
      }> = [];
      if (
        autoApplyCustomerPrefs &&
        state.state.customer?.id &&
        servicePrefs.length > 0
      ) {
        try {
          const params = new URLSearchParams({
            customerId: state.state.customer.id,
            productCode:
              (product as { product_code?: string }).product_code ?? product.id,
            serviceCategoryCode: product.service_category_code ?? '',
          });
          const res = await fetch(`/api/v1/preferences/resolve?${params}`, {
            credentials: 'include',
          });
          const json = await res.json();
          if (
            json.success &&
            Array.isArray(json.data) &&
            json.data.length > 0
          ) {
            const priceMap = new Map(
              servicePrefs.map((s) => [s.code, s.default_extra_price ?? 0]),
            );
            resolvedServicePrefs = json.data.map(
              (p: { preference_code: string; source: string }) => ({
                preference_code: p.preference_code as ServicePreferenceCode,
                source: p.source || 'customer_pref',
                extra_price:
                  priceMap.get(p.preference_code as ServicePreferenceCode) ?? 0,
              }),
            );
          }
        } catch {
          /* ignore */
        }
      }

      const servicePrefCharge = resolvedServicePrefs.reduce(
        (sum, p) => sum + p.extra_price,
        0,
      );
      // The add rule (DESIGN §4): a counted product joins its latest open line; a measured article joins a
      // line only when staff chose it in the Measure dialog (§4.1).
      const counted = measured ? null : resolveCartAddTarget(state.state.items, product.id);
      const targetKey = measured ? mergeInto : counted?.kind === 'MERGE' ? counted.lineKey : undefined;
      const mergeLine = targetKey ? state.state.items.find((item) => item.lineKey === targetKey) : undefined;
      const lineKey = newCartLineKey();
      const newItem: OrderItem = {
        lineKey,
        productId: product.id,
        productName: product.product_name,
        productName2: product.product_name2,
        quantity: 1,
        pricePerUnit,
        ...(measured ? { uom: measured.uom, measure: measured.measure } : {}),
        // pre-quote estimate; the server quote line is what the cart shows
        totalPrice: pricedQty({ quantity: 1, ...measured }) * pricePerUnit + servicePrefCharge,
        defaultSellPrice: product.default_sell_price ?? null,
        serviceCategoryCode: product.service_category_code || undefined,
        servicePrefs:
          resolvedServicePrefs.length > 0 ? resolvedServicePrefs : undefined,
        servicePrefCharge:
          resolvedServicePrefs.length > 0 ? servicePrefCharge : undefined,
        pieces: trackByPiece ? generatePiecesForItem(lineKey, 1) : undefined,
      };

      const addedTo = state.addItem(
        newItem,
        mergeLine?.lineKey,
        measured && mergeLine ? measureWithArticle(mergeLine, measured.measure) : undefined,
      );
      if (!addedTo) return;
      trackItemAddition();
      if (mergeLine && addedTo === mergeLine.lineKey) {
        // Merged: the reducer appended the piece to that line with the next sequence.
        const nextSeq = Math.max(0, ...(mergeLine.pieces ?? []).map((p) => p.pieceSeq)) + 1;
        state.setSelectedPiece(trackByPiece ? `temp-${mergeLine.lineKey}-${nextSeq}` : null);
      } else if (trackByPiece && newItem.pieces && newItem.pieces.length > 0) {
        state.setSelectedPiece(newItem.pieces[newItem.pieces.length - 1].id);
      } else if (!trackByPiece && newItem.quantity === 1) {
        state.setSelectedPiece(`temp-${newItem.lineKey}-1`);
      } else {
        state.setSelectedPiece(null);
      }
    },
    [
      state,
      trackByPiece,
      trackItemAddition,
      t,
      tUom,
      uomOf,
      uomUnits.data,
      autoApplyCustomerPrefs,
      servicePrefs,
    ],
  );

  /** Measure dialog confirm: a line opened from the cart is re-measured; from the grid, the article becomes a new line. */
  const confirmMeasure = useCallback(
    (measure: OrderItemMeasure) => {
      if (!measureTarget) return;
      const { product, uom, lineKey } = measureTarget;
      setMeasureTarget(null);
      if (lineKey) state.updateItemMeasure(lineKey, measure);
      else void handleAddItem(product as Product, { uom, measure });
    },
    [measureTarget, state, handleAddItem],
  );

  /** Staff chose to add the measured article to a line that already has this measure (§4.1). */
  const mergeMeasuredArticle = useCallback(
    (lineKey: string, measure: OrderItemMeasure) => {
      if (!measureTarget) return;
      const { product, uom } = measureTarget;
      setMeasureTarget(null);
      void handleAddItem(product as Product, { uom, measure }, lineKey as LineKey);
    },
    [measureTarget, handleAddItem],
  );

  const measuredMergeAllowed = measuredMergeLineCapability.interactive && measuredMergePieceCapability.interactive;
  /** The lines that could take the article, as ready-to-show options; null adds a new line at once. */
  const measureMergeChoice = useCallback(
    (measure: OrderItemMeasure): MeasureMergeChoice | null => {
      if (!measureTarget || measureTarget.lineKey || !measuredMergeAllowed) return null;
      const product = measureTarget.product as Product;
      const { uom } = measureTarget;
      const items = state.state.items;
      const matches = findMatchingMeasuredLines(items, {
        productId: product.id, serviceCategoryCode: product.service_category_code, uomCode: uom.code,
      }, measure);
      if (matches.length === 0) return null;
      const symbol = locale === 'ar' && uom.symbol2 ? uom.symbol2 : uom.symbol;
      const perUnit = (amount: number) => `${formatMoneyWithCode(amount)}/${symbol}`;
      // Order Edit: a saved line keeps its agreed price; a new line takes today's catalog price (§4.4).
      const showPrices = state.state.isEditMode;
      return {
        title: tLines('measureMatchTitle'),
        options: matches.map((line) => ({
          lineKey: line.lineKey,
          label: tLines('addToLine', { number: productLineNumber(items, line.lineKey) ?? 1 }),
          result: tLines('addToLineResult', { pieces: line.quantity + 1, measure: `${measureWithArticle(line, measure).measuredQty} ${symbol}` }),
          priceNote: showPrices && line.persistedItemId ? tLines('agreedPrice', { price: perUnit(line.pricePerUnit) }) : undefined,
        })),
        newLineLabel: tLines('addAsNewLine'),
        newLinePriceNote: showPrices ? tLines('todaysPrice', { price: perUnit(product.default_sell_price ?? 0) }) : undefined,
        note: uom.minBillableQty || uom.billingIncrement ? tLines('measureMinimumNote') : undefined,
      };
    },
    [measureTarget, measuredMergeAllowed, state.state.items, state.state.isEditMode, locale, formatMoneyWithCode, tLines],
  );

  /** Moves one equal share of a measured line to a new line right after it (§4.3). */
  const handleSplitMeasuredShare = useCallback(
    (lineKey: LineKey) => {
      const result = state.splitMeasuredShare(lineKey);
      if (result === 'OK') {
        cmxMessage.success(tLines('movedToLine', { number: (productLineNumber(state.state.items, lineKey) ?? 1) + 1 }));
        return;
      }
      cmxMessage.warning(tLines(result === 'NOT_EXACT' ? 'shareNotExact' : result === 'SAVED_PIECE' ? 'savedPieceCannotMove' : 'moveBlocked'));
    },
    [state, tLines],
  );

  const handleRemoveItem = useCallback(
    (lineKey: LineKey) => {
      if (!state.removeItem(lineKey)) return;
      cmxMessage.success(t('itemsGrid.itemRemoved'));
    },
    [state, t],
  );

  const handleQuantityChange = useCallback(
    (lineKey: LineKey, quantity: number) => {
      const item = state.state.items.find((i) => i.lineKey === lineKey);
      const prevQty = item?.quantity ?? 0;
      // false: held for the measure check (measured line) or refused; the follow-up runs on confirm.
      if (!state.updateItemQuantity(lineKey, quantity)) return;
      if (trackByPiece && quantity > prevQty) {
        state.setSelectedPiece(`temp-${lineKey}-${quantity}`);
      }
    },
    [state, trackByPiece],
  );

  // The product grid works with products (DESIGN §7): its + goes through the add rule (`onAddItem`);
  // its - takes one piece off the product's most recently added line, which is removed at 0.
  const lastLineOf = useCallback(
    (productId: string) => [...state.state.items].reverse().find((i) => i.productId === productId),
    [state.state.items],
  );
  const handleGridQuantityChange = useCallback(
    (productId: string, quantity: number) => {
      const total = state.state.items.filter((i) => i.productId === productId).reduce((sum, i) => sum + i.quantity, 0);
      const line = lastLineOf(productId);
      if (!line || quantity >= total) return;
      handleQuantityChange(line.lineKey, line.quantity - 1);
    },
    [state.state.items, lastLineOf, handleQuantityChange],
  );
  const handleGridRemoveItem = useCallback(
    (productId: string) => {
      const line = lastLineOf(productId);
      if (line) handleRemoveItem(line.lineKey);
    },
    [lastLineOf, handleRemoveItem],
  );

  const handlePiecesChange = useCallback(
    (itemId: LineKey, pieces: PreSubmissionPiece[]) => {
      const item = state.state.items.find((i) => i.lineKey === itemId);
      const prevPieces = item?.pieces ?? [];
      // false: held for the measure check (measured line) or refused; the follow-ups run on confirm.
      if (!state.updateItemPieces(itemId, pieces)) return;
      if (item) {
        state.adjustItemPackingCharge(
          itemId,
          orderItemLinePackingCharge({ ...item, pieces }, packingPriceByCode),
        );
      }
      if (pieces.length > prevPieces.length) {
        const newPiece = pieces.find(
          (p) => !prevPieces.some((prev) => prev.id === p.id),
        );
        if (newPiece) state.setSelectedPiece(newPiece.id);
      }
    },
    [state, packingPriceByCode],
  );

  // A piece-count change on a measured line waits here until staff check the total measure.
  const recheck = state.state.measureRecheck;
  const recheckItem = recheck ? state.state.items.find((i) => i.lineKey === recheck.lineKey) : undefined;
  const [recheckRefusal, setRecheckRefusal] = useState<string | undefined>(undefined);
  const closeRecheck = useCallback(() => {
    setRecheckRefusal(undefined);
    state.cancelMeasureRecheck();
  }, [state]);
  const confirmRecheck = useCallback(
    (measure: OrderItemMeasure) => {
      const item = recheckItem;
      const result = state.confirmMeasureRecheck(measure);
      if (result.status === 'MEASURE_BLOCKED') { setRecheckRefusal(tUom('measure.recheckBlocked')); return; }
      setRecheckRefusal(undefined);
      if (result.status !== 'APPLIED' || !item) return;
      // The follow-ups the plain handlers run once the change is really applied.
      const action = result.deferred;
      if (action.type === 'UPDATE_ITEM_PIECES') {
        const pieces = action.payload.pieces;
        const prevPieces = item.pieces ?? [];
        state.adjustItemPackingCharge(item.lineKey, orderItemLinePackingCharge({ ...item, pieces }, packingPriceByCode));
        const added = pieces.find((p) => !prevPieces.some((prev) => prev.id === p.id));
        if (added) state.setSelectedPiece(added.id);
      } else if (action.type === 'UPDATE_ITEM_QUANTITY' && trackByPiece && action.payload.quantity > item.quantity) {
        state.setSelectedPiece(`temp-${item.lineKey}-${action.payload.quantity}`);
      }
    },
    [recheckItem, state, tUom, packingPriceByCode, trackByPiece],
  );

  // Copy piece conditions/notes to all siblings
  const handleCopyPieceToAll = useCallback(
    (itemId: LineKey, pieceId: string) => {
      const item = state.state.items.find((i) => i.lineKey === itemId);
      const sourcePiece = item?.pieces?.find((p) => p.id === pieceId);
      if (!item || !sourcePiece || !item.pieces) return;
      const updated = item.pieces.map((p) => ({
        ...p,
        color: sourcePiece.color,
        colorCodes: sourcePiece.colorCodes,
        colorCfIds: sourcePiece.colorCfIds,
        conditions: sourcePiece.conditions,
        notes: sourcePiece.notes,
        servicePrefs: sourcePiece.servicePrefs,
        packingPrefCode: sourcePiece.packingPrefCode,
        packingCfId: sourcePiece.packingCfId,
      }));
      state.updateItemPieces(itemId, updated);
      state.adjustItemPackingCharge(
        itemId,
        orderItemLinePackingCharge(
          { ...item, pieces: updated },
          packingPriceByCode,
        ),
      );
      cmxMessage.success(t('pieces.copyToAllPieces') || 'Copied to all pieces');
    },
    [state, t, packingPriceByCode],
  );

  const selectedConditions = useMemo(() => {
    const pieceId = state.state.selectedPieceId;
    if (!pieceId) return [];
    for (const item of state.state.items) {
      const piece = item.pieces?.find((p) => p.id === pieceId);
      if (piece) return piece.conditions ?? [];
    }
    return [];
  }, [state.state.selectedPieceId, state.state.items]);

  const handleConditionToggle = useCallback(
    (conditionCode: string) => {
      const pieceId = state.state.selectedPieceId;
      if (!pieceId) return;
      const current = selectedConditions;
      const next = current.includes(conditionCode)
        ? current.filter((c) => c !== conditionCode)
        : [...current, conditionCode];
      state.updatePieceConditions(pieceId, next);
    },
    [state, selectedConditions],
  );

  const handleSubmitOrderClick = useCallback(() => {
    if (orderEntryLocked) {
      cmxMessage.warning(tPos(`newOrderGate.${posGuide ?? 'none'}Body`));
      document.getElementById('pos-session-hub-trigger')?.focus();
      return;
    }
    if (hasErrors) {
      const errorWarnings = warnings.filter((w) => w.severity === 'error');
      if (errorWarnings.length > 0) {
        cmxMessage.error(errorWarnings[0].message);
        return;
      }
    }
    if (!state.state.customer) {
      cmxMessage.error(t('errors.selectCustomer'));
      return;
    }
    if (state.state.items.length === 0) {
      cmxMessage.error(t('errors.addItems'));
      return;
    }
    // Keyboard paths (F9, Ctrl+Enter) reach here even when the button is disabled for these.
    const readyByBlock = readyByBlockReason(state.state.readyByAt, isRetailOnlyOrder);
    if (readyByBlock) {
      cmxMessage.error(t(`validation.${readyByBlock}`));
      return;
    }
    if (state.state.loading) return;
    state.openModal('payment');
  }, [state, t, tPos, hasErrors, warnings, orderEntryLocked, posGuide, isRetailOnlyOrder]);

  const handleNavigateToOrder = useCallback(() => {
    if (!state.state.createdOrderId) return;
    const status = state.state.createdOrderStatus;
    const orderId = state.state.createdOrderId;
    let route: string;
    if (status) {
      const statusLower = status.toLowerCase();
      if (statusLower === 'preparing' || statusLower === 'intake')
        route = `/dashboard/preparation/${orderId}`;
      else if (statusLower === 'processing')
        route = `/dashboard/processing/${orderId}`;
      else route = `/dashboard/orders/${orderId}`;
    } else {
      route = `/dashboard/orders/${orderId}`;
    }
    router.push(route);
    state.setCreatedOrder('', null);
  }, [state, router]);

  const getNavigationLabel = useCallback(
    (status: string | null): string => {
      if (!status) return tWorkflow('newOrder.goToOrder') || 'Go to Order';
      const statusLower = status.toLowerCase();
      if (statusLower === 'preparing' || statusLower === 'intake')
        return tWorkflow('newOrder.goToPreparation') || 'Go to Preparation';
      if (statusLower === 'processing')
        return tWorkflow('newOrder.goToProcessing') || 'Go to Processing';
      return tWorkflow('newOrder.goToOrder') || 'Go to Order';
    },
    [tWorkflow],
  );

  const handleAddNewOrder = useCallback(() => {
    if (state.state.createdOrderId) {
      state.resetOrder();
      return;
    }
    const hasUnsaved =
      state.state.items.length > 0 ||
      (state.state.notes?.trim().length ?? 0) > 0 ||
      state.state.customer !== null;
    if (hasUnsaved) setShowDiscardConfirm(true);
    else state.resetOrder();
  }, [state]);

  const handleConfirmDiscard = useCallback(() => {
    state.resetOrder();
    setShowDiscardConfirm(false);
  }, [state]);

  const handleCancelEdit = useCallback(() => {
    if (isDirty) setShowCancelConfirm(true);
    else cancelEditOrder();
  }, [isDirty, cancelEditOrder]);

  const handleConfirmCancelEdit = useCallback(() => {
    cancelEditOrder();
    setShowCancelConfirm(false);
  }, [cancelEditOrder]);

  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const focusSaveButton = useCallback(() => {
    const btn = saveButtonRef.current;
    if (!btn) return;
    btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    btn.focus({ preventScroll: true });
  }, []);

  const memoizedOrderItems = useMemo(
    () =>
      state.state.items.map((item) => {
        const cat = state.state.categories.find(
          (c) => c.service_category_code === item.serviceCategoryCode,
        );
        const prefCharge = item.servicePrefCharge ?? 0;
        const effectiveUnitPrice =
          prefCharge > 0
            ? item.pricePerUnit + prefCharge / item.quantity
            : item.pricePerUnit;
        const conditions = item.pieces
          ? Array.from(new Set(item.pieces.flatMap((p) => p.conditions ?? [])))
          : [];
        const hasStain = conditions.some((c) =>
          [
            'coffee',
            'wine',
            'blood',
            'mud',
            'oil',
            'ink',
            'grease',
            'bleach',
            'bubble',
          ].includes(c.toLowerCase()),
        );
        const hasDamage = conditions.some((c) =>
          [
            'button_broken',
            'button_missing',
            'collar_torn',
            'zipper_broken',
            'hole',
            'tear',
            'seam_open',
          ].includes(c.toLowerCase()),
        );
        return {
          id: item.lineKey,
          lineNumber: productLineNumber(state.state.items, item.lineKey),
          productId: item.productId,
          productName: item.productName || 'Unknown Product',
          productName2: item.productName2 || undefined,
          quantity: item.quantity,
          pricePerUnit: effectiveUnitPrice,
          totalPrice: calculateItemTotal(item),
          notes: item.notes,
          pieces: item.pieces,
          piecePriced: item.piecePriced,
          uom: item.uom,
          measure: item.measure,
          conditions,
          hasStain,
          hasDamage,
          serviceCategoryCode: item.serviceCategoryCode,
          serviceCategoryName:
            cat?.ctg_name ?? item.serviceCategoryCode ?? undefined,
          serviceCategoryName2: cat?.ctg_name2 ?? undefined,
          priceOverride: item.priceOverride,
          overrideReason: item.overrideReason,
          serviceSpeed: item.serviceSpeed ?? null,
        };
      }),
    [state.state.items, state.state.categories],
  );

  const isSubmitDisabled = useMemo(() => {
    if (state.state.isEditMode)
      return !isDirty || isSubmitting || state.state.loading || hasErrors;
    if (
      orderEntryLocked ||
      state.state.loading ||
      isSubmitting ||
      !state.state.customerName ||
      state.state.items.length === 0
    )
      return true;
    return readyByBlockReason(state.state.readyByAt, isRetailOnlyOrder) !== null;
  }, [
    state.state.isEditMode,
    isDirty,
    isSubmitting,
    state.state.loading,
    hasErrors,
    state.state.customerName,
    state.state.items.length,
    state.state.readyByAt,
    isRetailOnlyOrder,
    orderEntryLocked,
  ]);

  const canSubmit = useMemo(() => !isSubmitDisabled, [isSubmitDisabled]);

  // Branch is required when there are multiple branches and none is selected yet
  const branchRequired =
    !branchesLoading && branches.length > 1 && !state.state.branchId;

  const hasBranchDependentData =
    state.state.items.length > 0 || !!state.state.customer;

  useKeyboardNavigation({
    enabled: true,
    onKey: (key, event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const action = resolvePosHotkey(event, {
        // Dialogs outside `modals` (discount, preferences, this cheat sheet) trap focus, so the key comes from inside them.
        anyModalOpen:
          shortcutsOpen ||
          Object.values(state.state.modals).some(Boolean) ||
          !!target?.closest('[role="dialog"],[role="alertdialog"]'),
        editableTarget: isEditableEventTarget(event.target),
        isWorkspace: !!workspace,
        isEditMode: state.state.isEditMode,
      });
      if (!action) return;
      // Tab keys keep their own conditions below and prevent the default only when they switch.
      if (action !== 'tab') event.preventDefault();
      if (action === 'block') return;
      if (action === 'focusSearch') {
        document.getElementById('new-order-product-search')?.focus();
        return;
      }
      if (action === 'showHelp') {
        setShortcutsOpen(true);
        return;
      }
      if (action === 'pickCustomer') {
        state.openModal('customerPicker');
        return;
      }
      if (action === 'pay' || action === 'save') {
        // Same gate as the button (ruling 4): it shows the reason when the order is not ready.
        if (isSubmitting) return;
        if (workspace) {
          // Same conditions as the disabled Review button.
          if (state.state.items.length > 0 && !workspace.accessBlocked && !workspace.reviewing) workspace.onReview();
        } else if (!state.state.isEditMode) handleSubmitOrderClick();
        return;
      }
      if (event.altKey && !event.ctrlKey && !event.metaKey) {
        if (key === '1') {
          event.preventDefault();
          setRequestedActiveTab('select');
          return;
        }
        if (key === '2') {
          event.preventDefault();
          setRequestedActiveTab('details');
          return;
        }
        if (trackByPiece && state.state.items.length > 0) {
          if (key === '3') {
            event.preventDefault();
            setRequestedActiveTab('piecePreferences');
            return;
          }
          if (key === '4') {
            event.preventDefault();
            setRequestedActiveTab('pieces');
            return;
          }
          if (key === '5' && state.state.customer !== null) {
            event.preventDefault();
            setRequestedActiveTab('customer');
            return;
          }
        } else if (key === '3' && state.state.customer !== null) {
          event.preventDefault();
          setRequestedActiveTab('customer');
          return;
        }
      }
    },
  });

  // G1: the Ready By is shown in the fulfilment-branch zone, not the device zone.
  const readyByZoneQuery = useReadyByZone(state.state.branchId);
  const sharedSummaryPanelProps = {
    items: memoizedOrderItems,
    onEditItem: priceCapability.interactive ? (itemId: LineKey) => {
      state.openPriceOverrideModal(itemId);
    } : undefined,
    onDeleteItem: handleRemoveItem,
    onPiecesChange: handlePiecesChange,
    onCopyPieceToAll: handleCopyPieceToAll,
    isQuickDrop: state.state.isQuickDrop,
    onQuickDropToggle: state.setQuickDrop,
    quickDropQuantity: state.state.quickDropQuantity,
    onQuickDropQuantityChange: state.setQuickDropQuantity,
    notes: state.state.notes,
    onNotesChange: state.setNotes,
    readyByAt: state.state.readyByAt,
    readyByZone: readyByZoneQuery.data ?? null,
    cartQuote: state.state.isEditMode
      ? undefined
      : {
          data: cartQuote.data,
          pending: cartQuote.pending,
          failed: cartQuote.failed,
          errorCode: cartQuote.errorCode,
          onRetry: () => void cartQuote.refetch(),
        },
    onSubmit: handleSubmitOrderClick,
    primaryAction: workspace
      ? {
          label: tEdit('workspace.review'),
          disabled: workspace.accessBlocked || workspace.reviewing,
          loading: workspace.reviewing,
          onClick: workspace.onReview,
        }
      : undefined,
    isEditMode: state.state.isEditMode,
    isDirty,
    saveButtonRef,
    isSaving: isSubmitting,
    hasErrors,
    validationErrors: warnings
      .filter((w) => w.severity === 'error')
      .map((w) => w.message),
    onOpenReadyByModal: () => state.openModal('readyBy'),
    onCalculateReadyBy: async () => {
      try {
        const result = await calculateReadyBy();
        if (result)
          cmxMessage.success(
            t('success.readyByCalculated') ||
              'Ready-by date calculated successfully',
          );
        else
          cmxMessage.error(
            t('errors.failedToCalculateReadyBy') ||
              'Failed to calculate ready-by date',
          );
      } catch (error) {
        console.error('Error calculating ready-by:', error);
        cmxMessage.error(
          t('errors.failedToCalculateReadyBy') ||
            'Failed to calculate ready-by date',
        );
      }
    },
    loading: state.state.loading || isSubmitting,
    currencyCode,
    trackByPiece,
    isRetailOnlyOrder,
    selectedPieceId: state.state.selectedPieceId,
    onSelectPiece: state.setSelectedPiece,
    canSubmit,
    onOpenPaymentModal: () => state.openModal('payment'),
    colorCatalog: conditionCatalog.colors,
    preferenceLabelByCode,
    packingExtraPriceByCode,
    // Customer header
    customerName: state.state.customerName,
    onSelectCustomer: () => state.openModal('customerPicker'),
    onEditCustomer: () => state.openModal('customerEdit'),
    onClearCustomer: () => state.setCustomer(null, ''),
    // Order speed (§5.4) and line speeds (P6-02b). Quoted line figures are New Order only;
    // Order Edit shows the stored prices and re-prices at Review.
    serviceSpeed: state.state.serviceSpeed,
    onServiceSpeedChange: handleServiceSpeedChange,
    speedPreview: state.state.isEditMode ? undefined : { requestFor: (code: string) => ({ ...cartQuoteRequest, serviceSpeed: code }) },
    hasLineSpeedOverrides: state.state.items.some((item) => item.serviceSpeed != null),
    onApplySpeedToAllLines: lineSpeedCapability.interactive ? handleApplySpeedToAllLines : undefined,
    lineQuote: state.state.isEditMode
      ? {
          lines: null,
          pending: false,
          unquoted: true,
          onLineSpeedChange: handleLineSpeedChange,
          lineSpeedDisabled: !lineSpeedCapability.interactive,
          onEditLineDiscount: canDiscountLines && lineDiscountCapability.interactive ? setDiscountLineKey : undefined,
          onEditPieceDiscount: canDiscountLines && lineDiscountCapability.interactive
            ? (lineKey: LineKey, pieceId: string) => {
                setDiscountLineKey(lineKey);
                setDiscountPieceId(pieceId);
              }
            : undefined,
        }
      : {
          lines: cartQuote.data?.lines ?? null,
          pending: cartQuote.pending,
          onLineSpeedChange: handleLineSpeedChange,
          previewRequest: cartQuoteRequest,
          onEditLineDiscount: canDiscountLines ? setDiscountLineKey : undefined,
          onEditPieceDiscount: canDiscountLines
            ? (lineKey: LineKey, pieceId: string) => {
                setDiscountLineKey(lineKey);
                setDiscountPieceId(pieceId);
              }
            : undefined,
        },
    speedChangeNote,
    // Bags
    bags: state.state.bags,
    onBagsChange: state.setBags,
    onSplitMeasuredShare: handleSplitMeasuredShare,
    onEditItemMeasure: (lineKey: LineKey) => {
      const item = state.state.items.find((i) => i.lineKey === lineKey);
      if (item?.uom) setMeasureTarget({ product: { id: item.productId, product_code: item.productId, product_name: item.productName, product_name2: item.productName2 }, uom: item.uom, lineKey });
    },
    // Edit item preferences — piece-level preferences tab (track-by-piece) or Order Items tab, focused on the item
    onEditItemPreferences: (itemId: LineKey) => {
      if (trackByPiece) {
        setFocusItemId(itemId);
        setRequestedActiveTab('piecePreferences');
      } else {
        setRequestedActiveTab('details');
      }
    },
    showPaymentModalVersionSelector,
    paymentModalVersion,
    onPaymentModalVersionChange: setPaymentModalVersion,
  };

  return (
    <section
      className="flex-1 min-h-0 overflow-hidden flex flex-col"
      aria-label={t('title')}
    >
      {/* Screen reader live region */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {state.state.items.length > 0 && (
          <span>
            {t('orderSummary.items', { count: state.state.items.length }) ||
              `${state.state.items.length} items in order`}
          </span>
        )}
      </div>

      {/* Sticky Top Bar */}
      <NewOrderTopBar
        branches={branches}
        branchId={state.state.branchId}
        onBranchChange={workspace ? () => undefined : state.setBranchId}
        branchesLoading={branchesLoading}
        orderTypeId={state.state.orderTypeId}
        onOrderTypeChange={state.setOrderTypeId}
        orderSourceCode={state.state.orderSourceCode}
        onOrderSourceChange={state.setOrderSourceCode}
        showOrderContextSelectors={!state.state.isEditMode}
        customerName={state.state.customerName}
        onSelectCustomer={
          workspace ? () => undefined : () => state.openModal('customerPicker')
        }
        onEditCustomer={
          workspace ? () => undefined : () => state.openModal('customerEdit')
        }
        serviceSpeed={state.state.serviceSpeed}
        onServiceSpeedChange={handleServiceSpeedChange}
        speedPreview={state.state.isEditMode ? undefined : { requestFor: (code: string) => ({ ...cartQuoteRequest, serviceSpeed: code }) }}
        categories={state.state.categories}
        selectedCategory={state.state.selectedCategory}
        onSelectCategory={handleSelectCategory}
        categoriesLoading={state.state.categoriesLoading}
        showCategories={activeTab === 'select'}
        hasBranchDependentData={hasBranchDependentData}
        branchLocked={
          workspace != null ||
          (!state.state.isEditMode && posGate.lockBranchId != null)
        }
        orderPrefsCount={state.state.orderServicePrefs?.length ?? 0}
        onOpenOrderPreferences={
          hasServicePrefs ? () => setOrderPrefsDialogOpen(true) : undefined
        }
        sessionSlot={
          workspace ? (
            <EditPolicyInfoButton />
          ) : !state.state.isEditMode ? (
            <PosSessionHub
              branchId={posGate.lockBranchId ?? state.state.branchId}
              guide={posGuide}
            />
          ) : null
        }
      />

      <OrderPreferencesDialog
        open={orderPrefsDialogOpen}
        onOpenChange={setOrderPrefsDialogOpen}
        enforcePrefCompatibility={enforcePrefCompatibility}
      />

      {!state.state.isEditMode && posGuide ? (
        <div className="px-4 pt-3">
          <CmxSummaryMessage
            type={posGuide === 'error' ? 'error' : 'warning'}
            title={tPos(`newOrderGate.${posGuide}Title`)}
            items={[tPos(`newOrderGate.${posGuide}Body`)]}
          />
        </div>
      ) : null}

      {!state.state.isEditMode && (
        <PosSessionOrderBanner branchId={state.state.branchId} />
      )}

      {workspace ? <EditOrderContextBar session={workspace} /> : null}
      {workspace ? <EditControlNotice codes={['CHANGE_ITEM_PRICE', 'CHANGE_DISCOUNT']} targetType="ITEM" /> : null}
      {state.state.isEditMode && !workspace && (
        <EditOrderBar
          orderNo={state.state.editingOrderNo}
          onCancelEdit={handleCancelEdit}
          onSave={focusSaveButton}
          isDirty={isDirty}
          isCancelling={isCancelling}
          isSaving={isSubmitting}
        />
      )}

      <div
        className={`flex-1 min-h-0 flex ${orderEntryLocked ? 'opacity-50' : ''}`}
        inert={orderEntryLocked ? true : undefined}
      >
        {/* Left/Center Panel */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
          {/* Branch Required Gate */}
          {branchRequired ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-warning-bg flex items-center justify-center">
                <GitBranch className="w-8 h-8 text-warning-text" aria-hidden />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">
                  {t('errors.selectBranch') || 'Please select a branch'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {tCommon('selectBranch') || 'Select a branch to continue'}
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Step Tabs */}
              <div className="shrink-0 px-4 pt-4 pb-2">
                <div
                  className="bg-card rounded-lg border border-border p-2"
                  role="tablist"
                  aria-label={t('title')}
                  onKeyDown={(e) => {
                    const visibleTabs: Array<'select' | 'details' | 'piecePreferences' | 'pieces' | 'customer'> = [
                      'select',
                      'details',
                      ...(trackByPiece && state.state.items.length > 0
                        ? (['piecePreferences', 'pieces'] as const)
                        : []),
                      ...(state.state.customer !== null ? (['customer'] as const) : []),
                    ];
                    const idx = visibleTabs.indexOf(activeTab);
                    if (idx === -1) return;
                    let nextIdx: number | null = null;
                    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % visibleTabs.length;
                    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + visibleTabs.length) % visibleTabs.length;
                    else if (e.key === 'Home') nextIdx = 0;
                    else if (e.key === 'End') nextIdx = visibleTabs.length - 1;
                    if (nextIdx !== null) {
                      e.preventDefault();
                      const nextTab = visibleTabs[nextIdx];
                      setRequestedActiveTab(nextTab);
                      document.getElementById(`new-order-tab-${nextTab}`)?.focus();
                    }
                  }}
                >
                  <div
                    className="flex gap-2 overflow-x-auto [scrollbar-width:thin]"
                  >
                    <CmxButton
                      id="new-order-tab-select"
                      type="button"
                      variant={activeTab === 'select' ? 'primary' : 'ghost'}
                      role="tab"
                      aria-selected={activeTab === 'select'}
                      tabIndex={activeTab === 'select' ? 0 : -1}
                      onClick={() => setRequestedActiveTab('select')}
                      className={`shrink-0 whitespace-nowrap flex-1 px-4 py-2 rounded-lg text-sm font-semibold ${activeTab === 'select' ? 'shadow-md' : 'bg-muted text-foreground hover:bg-border'}`}
                    >
                      1) {t('itemsGrid.selectItems')}
                    </CmxButton>
                    <CmxButton
                      id="new-order-tab-details"
                      type="button"
                      variant={activeTab === 'details' ? 'primary' : 'ghost'}
                      role="tab"
                      aria-selected={activeTab === 'details'}
                      tabIndex={activeTab === 'details' ? 0 : -1}
                      onClick={() => setRequestedActiveTab('details')}
                      className={`shrink-0 whitespace-nowrap flex-1 px-4 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 ${activeTab === 'details' ? 'shadow-md' : 'bg-muted text-foreground hover:bg-border'}`}
                    >
                      {state.state.items.length > 0 && (
                        <Check
                          className="w-4 h-4 shrink-0"
                          aria-hidden="true"
                        />
                      )}
                      2) {t('itemsGrid.orderItems')} (
                      {state.state.items.length})
                    </CmxButton>
                    {trackByPiece && state.state.items.length > 0 && (
                      <>
                        <CmxButton
                          id="new-order-tab-piecePreferences"
                          type="button"
                          variant={activeTab === 'piecePreferences' ? 'primary' : 'ghost'}
                          role="tab"
                          aria-selected={activeTab === 'piecePreferences'}
                          tabIndex={activeTab === 'piecePreferences' ? 0 : -1}
                          onClick={() =>
                            setRequestedActiveTab('piecePreferences')
                          }
                          className={`shrink-0 whitespace-nowrap flex-1 px-4 py-2 rounded-lg text-sm font-semibold ${activeTab === 'piecePreferences' ? 'shadow-md' : 'bg-muted text-foreground hover:bg-border'}`}
                        >
                          3) {t('pieces.editItemPreferences')} ({totalPieces})
                        </CmxButton>
                        <CmxButton
                          id="new-order-tab-pieces"
                          type="button"
                          variant={activeTab === 'pieces' ? 'primary' : 'ghost'}
                          role="tab"
                          aria-selected={activeTab === 'pieces'}
                          tabIndex={activeTab === 'pieces' ? 0 : -1}
                          onClick={() => setRequestedActiveTab('pieces')}
                          className={`shrink-0 whitespace-nowrap flex-1 px-4 py-2 rounded-lg text-sm font-semibold ${activeTab === 'pieces' ? 'shadow-md' : 'bg-muted text-foreground hover:bg-border'}`}
                        >
                          4) {t('pieces.editItemNotes')} (
                          {totalPieces})
                        </CmxButton>
                      </>
                    )}
                    {state.state.customer !== null && (
                      <CmxButton
                        id="new-order-tab-customer"
                        type="button"
                        variant={activeTab === 'customer' ? 'primary' : 'ghost'}
                        role="tab"
                        aria-selected={activeTab === 'customer'}
                        tabIndex={activeTab === 'customer' ? 0 : -1}
                        onClick={() => setRequestedActiveTab('customer')}
                        className={`shrink-0 whitespace-nowrap flex-1 px-4 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 ${activeTab === 'customer' ? 'shadow-md' : 'bg-muted text-foreground hover:bg-border'}`}
                      >
                        <Check
                          className="w-4 h-4 shrink-0"
                          aria-hidden="true"
                        />
                        {trackByPiece ? '5)' : '3)'}{' '}
                        {t('customerDetails.title')}
                      </CmxButton>
                    )}
                  </div>
                </div>
              </div>

              {/* Scrollable Panel Content */}
              <div
                className={`flex-1 min-h-0 overflow-y-auto transition-opacity duration-200 ease-out ${!isDesktop && state.state.items.length > 0 ? 'pb-28' : ''}`}
              >
                {activeTab === 'select' && (
                  <div className="space-y-2 p-4 sm:p-6 pt-2">
                    <EditControlNotice codes={['ADD_ITEM']} />
                    <div
                      className={
                        itemCapability.interactive
                          ? ''
                          : 'pointer-events-none opacity-60'
                      }
                    >
                      {productsQuery.isInitialLoading ? (
                        <ProductGridSkeleton />
                      ) : (
                        <ProductGrid
                          products={state.state.products}
                          items={state.state.items}
                          speedNote={productSpeedNote}
                          speedPrices={productSpeedPrices}
                          speedPricedNote={productSpeedPricedNote}
                          currencyCode={currencyCode}
                          productSearch={productsQuery.productSearch}
                          onProductSearchChange={productsQuery.setProductSearch}
                          isSearchPending={productsQuery.isSearchPending}
                          searchAllCategories={
                            productsQuery.searchAllCategories
                          }
                          onSearchAllCategoriesChange={
                            productsQuery.setSearchAllCategories
                          }
                          isGlobalSearch={productsQuery.isGlobalSearch}
                          productsTotal={productsQuery.productsTotal}
                          totalPages={productsQuery.totalPages}
                          currentPage={productsQuery.currentPage}
                          pageSize={productsQuery.pageSize}
                          onPageChange={productsQuery.setCurrentPage}
                          onPageSizeChange={productsQuery.setPageSize}
                          isFetching={productsQuery.isFetching}
                          getCategoryLabel={getCategoryLabel}
                          onAddItem={handleAddItem}
                          onRemoveItem={handleGridRemoveItem}
                          onQuantityChange={handleGridQuantityChange}
                          selectedConditions={selectedConditions}
                          onConditionToggle={handleConditionToggle}
                          selectedPieceId={state.state.selectedPieceId}
                          enforcePrefCompatibility={enforcePrefCompatibility}
                          onOpenCustomItemModal={canEnterPrices && itemCapability.interactive ? () => {
                            state.openModal('customItem');
                            trackModalOpen('customItem');
                          } : undefined}
                          onOpenPhotoCapture={() => {
                            state.openModal('photoCapture');
                            trackModalOpen('photoCapture');
                          }}
                          pendingPhotoCount={state.state.pendingPhotos.length}
                        />
                      )}
                    </div>
                  </div>
                )}
                {activeTab === 'details' && (
                  <div className="p-4 sm:p-6 pt-2">
                    <OrderDetailsSection
                      trackByPiece={trackByPiece}
                      currencyCode={currencyCode}
                      packingPerPieceEnabled={packingPerPieceEnabled}
                      bundlesEnabled={bundlesEnabled}
                      repeatLastOrderEnabled={repeatLastOrderEnabled}
                      smartSuggestionsEnabled={smartSuggestionsEnabled}
                      enforcePrefCompatibility={enforcePrefCompatibility}
                    />
                  </div>
                )}
                {activeTab === 'piecePreferences' && trackByPiece && (
                  <div className="p-4 sm:p-6 pt-2">
                    <OrderPiecePreferencesSection
                      preferenceKinds={preferenceKinds}
                      prefsByKind={prefsByKind}
                      packingPrefs={packingPrefs}
                      servicePrefsFallback={pieceWizardServicePrefs}
                      conditionCatalog={pieceConditionCatalog}
                      kindsLoading={kindsLoading}
                      currencyCode={currencyCode}
                      enforcePrefCompatibility={enforcePrefCompatibility}
                      focusItemId={focusItemId}
                      onFocusItemHandled={() => setFocusItemId(null)}
                    />
                  </div>
                )}
                {activeTab === 'pieces' && (
                  <div className="p-4 sm:p-6 pt-2">
                    <OrderPiecesNotesSection
                      onCopyPieceToAll={handleCopyPieceToAll}
                      focusItemId={focusItemId}
                      onFocusItemHandled={() => setFocusItemId(null)}
                    />
                  </div>
                )}
                {activeTab === 'customer' && (
                  <div className="p-4 sm:p-6 pt-2">
                    <OrderCustomerDetailsSection />
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right Sidebar (desktop) */}
        {isDesktop ? (
          <div className="w-[28rem] shrink-0 border-s border-border bg-card h-full flex flex-col overflow-hidden">
            {!state.state.createdOrderId && !state.state.isEditMode && (
              <div
                className="shrink-0 px-4 pt-3 pb-2 border-b border-border text-end"
              >
                <CmxButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleAddNewOrder}
                  className="h-auto px-1 py-0.5 text-sm text-primary-text hover:bg-transparent hover:text-primary-text/80 hover:underline"
                >
                  + {t('addNewOrder')}
                </CmxButton>
              </div>
            )}
            <OrderSummaryPanel {...sharedSummaryPanelProps} />
            {state.state.createdOrderId && (
              <div
                className="p-4 border-t border-border bg-info-bg space-y-2"
              >
                <CmxButton
                  onClick={handleAddNewOrder}
                  className="w-full"
                  variant="secondary"
                >
                  + {t('addNewOrder')}
                </CmxButton>
                <CmxButton
                  onClick={handleNavigateToOrder}
                  className="w-full"
                  variant="primary"
                >
                  {getNavigationLabel(state.state.createdOrderStatus)}
                </CmxButton>
              </div>
            )}
          </div>
        ) : (
          <OrderSummaryBottomSheet
            itemCount={state.state.items.length}
            total={summaryTotal}
            currencyCode={currencyCode}
            isOpen={bottomSheetOpen}
            onOpen={() => setBottomSheetOpen(true)}
            onClose={() => setBottomSheetOpen(false)}
            onPrimaryAction={
              workspace ? workspace.onReview : handleSubmitOrderClick
            }
            primaryDisabled={
              workspace
                ? workspace.accessBlocked || workspace.reviewing
                : isSubmitDisabled
            }
            primaryLabel={
              workspace
                ? tEdit('workspace.review')
                : t('submitOrder') || 'Add Order'
            }
            loading={state.state.loading || isSubmitting}
          >
            {!state.state.createdOrderId && !state.state.isEditMode && (
              <div
                className="shrink-0 px-4 pt-2 pb-2 border-b border-border text-end"
              >
                <CmxButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleAddNewOrder}
                  className="h-auto px-1 py-0.5 text-sm text-primary-text hover:bg-transparent hover:text-primary-text/80 hover:underline"
                >
                  + {t('addNewOrder')}
                </CmxButton>
              </div>
            )}
            <OrderSummaryPanel {...sharedSummaryPanelProps} />
            {state.state.createdOrderId && (
              <div
                className="p-4 border-t border-border bg-info-bg space-y-2"
              >
                <CmxButton
                  onClick={handleAddNewOrder}
                  className="w-full"
                  variant="secondary"
                >
                  + {t('addNewOrder')}
                </CmxButton>
                <CmxButton
                  onClick={handleNavigateToOrder}
                  className="w-full"
                  variant="primary"
                >
                  {getNavigationLabel(state.state.createdOrderStatus)}
                </CmxButton>
              </div>
            )}
          </OrderSummaryBottomSheet>
        )}
      </div>

      <CmxAlertDialog
        open={showDiscardConfirm}
        title={t('warnings.discardAndNewOrderTitle')}
        message={t('warnings.discardAndNewOrder')}
        variant="warning"
        confirmLabel={tCommon('confirm')}
        cancelLabel={tCommon('cancel')}
        onConfirm={handleConfirmDiscard}
        onCancel={() => setShowDiscardConfirm(false)}
      />
      <CmxAlertDialog
        open={showCancelConfirm}
        title={tEdit('confirmCancel')}
        message={tEdit('confirmCancelMessage')}
        variant="warning"
        confirmLabel={tCommon('confirm')}
        cancelLabel={tCommon('cancel')}
        onConfirm={handleConfirmCancelEdit}
        onCancel={() => setShowCancelConfirm(false)}
      />
      <PosShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      {discountItem && discountPiece ? (
        <LineDiscountDialog
          key={discountPiece.id}
          open
          onClose={closeDiscountDialog}
          productName={`${getBilingual(discountItem.productName, discountItem.productName2) || discountItem.productId} · ${discountPieceIndex + 1}`}
          lineGross={discountPieceGross}
          current={discountPiece.lineDiscount ?? null}
          onApply={(lineDiscount) => handlePiecesChange(discountItem.lineKey, (discountItem.pieces ?? []).map((p) => (p.id === discountPiece.id ? { ...p, lineDiscount } : p)))}
          onRemove={() => handlePiecesChange(discountItem.lineKey, (discountItem.pieces ?? []).map((p) => (p.id === discountPiece.id ? { ...p, lineDiscount: null } : p)))}
        />
      ) : discountItem ? (
        <LineDiscountDialog
          key={discountItem.lineKey}
          open
          onClose={closeDiscountDialog}
          productName={getBilingual(discountItem.productName, discountItem.productName2) || discountItem.productId}
          lineGross={discountLineGross}
          current={discountItem.lineDiscount ?? null}
          onApply={(lineDiscount) => state.setItemLineDiscount(discountItem.lineKey, lineDiscount)}
          onRemove={() => state.setItemLineDiscount(discountItem.lineKey, null)}
        />
      ) : null}
      <MeasureLineDialog
        open={!!measureTarget}
        productName={measureTarget ? getBilingual(measureTarget.product.product_name, measureTarget.product.product_name2) || measureTarget.product.product_code : ''}
        uom={measureTarget?.uom ?? { code: '', dimension: 'MASS', qtyDecimals: 0, symbol: '', symbol2: null, minBillableQty: null, billingIncrement: null }}
        initial={measureTarget ? state.state.items.find((i) => (measureTarget.lineKey ? i.lineKey === measureTarget.lineKey : i.productId === measureTarget.product.id))?.measure : undefined}
        mergeChoice={measureMergeChoice}
        onMerge={mergeMeasuredArticle}
        onConfirm={confirmMeasure}
        onClose={() => setMeasureTarget(null)}
      />
      {recheck && recheckItem?.uom ? (
        <MeasureLineDialog
          open
          productName={getBilingual(recheckItem.productName, recheckItem.productName2) || recheckItem.productId}
          uom={recheckItem.uom}
          initial={recheckItem.measure}
          notice={tUom('measure.recheckNotice', { from: recheck.from, to: recheck.to })}
          refusal={recheckRefusal}
          onConfirm={confirmRecheck}
          onClose={closeRecheck}
        />
      ) : null}
    </section>
  );
}
