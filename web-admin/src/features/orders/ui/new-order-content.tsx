/**
 * New Order Content
 * Main content area: sticky top bar, step tabs, product grid, and order summary
 * PRD-010: Advanced Order Management
 */

'use client';

import { useRTL } from '@/lib/hooks/useRTL';
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
  Product,
  OrderItem,
  PreSubmissionPiece,
} from '../model/new-order-types';
import { generatePiecesForItem } from '@/lib/utils/piece-helpers';
import { calculateItemTotal } from '@/lib/utils/order-item-helpers';
import {
  orderItemLinePackingCharge,
  packingPreferencePriceMap,
} from '@/lib/utils/order-packing-charges';
import { useBilingual } from '@/lib/utils/bilingual';

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
  const isRTL = useRTL();
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
  const handleLineSpeedChange = (productId: string, serviceSpeed: string | null) => {
    captureSpeedChange();
    state.setItemServiceSpeed(productId, serviceSpeed);
  };
  // ─── Line discount (P5-03c): permission-gated; the server checks it again ───
  const canDiscountLines = useHasAnyPermission(NEW_ORDER_ACCESS.actions?.lineDiscount?.requirement.permissions ?? []);
  // P5-03e: a custom item's entered price is a price decision (`pricing:override`); in Edit also an ADD_ITEM (P6-02d).
  const canEnterPrices = useHasAnyPermission(NEW_ORDER_ACCESS.actions?.priceOverride?.requirement.permissions ?? []);
  const [discountProductId, setDiscountProductId] = useState<string | null>(null);
  const [discountPieceId, setDiscountPieceId] = useState<string | null>(null);
  const discountItemIndex = discountProductId
    ? state.state.items.findIndex((item) => item.productId === discountProductId)
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
    setDiscountProductId(null);
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
  // A line's own speed is its own policy cell (CHANGE_SERVICE_SPEED / ITEM, P6-02b).
  const lineSpeedCapability = useEditControlGroup(['CHANGE_SERVICE_SPEED'], 'ITEM');

  const handleAddItem = useCallback(
    async (product: Product) => {
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
      const newItem: OrderItem = {
        productId: product.id,
        productName: product.product_name,
        productName2: product.product_name2,
        quantity: 1,
        pricePerUnit,
        totalPrice: pricePerUnit + servicePrefCharge,
        defaultSellPrice: product.default_sell_price ?? null,
        serviceCategoryCode: product.service_category_code || undefined,
        servicePrefs:
          resolvedServicePrefs.length > 0 ? resolvedServicePrefs : undefined,
        servicePrefCharge:
          resolvedServicePrefs.length > 0 ? servicePrefCharge : undefined,
        pieces: trackByPiece ? generatePiecesForItem(product.id, 1) : undefined,
      };

      state.addItem(newItem);
      trackItemAddition();
      if (trackByPiece && newItem.pieces && newItem.pieces.length > 0) {
        state.setSelectedPiece(newItem.pieces[newItem.pieces.length - 1].id);
      } else if (!trackByPiece && newItem.quantity === 1) {
        state.setSelectedPiece(`temp-${newItem.productId}-1`);
      } else {
        state.setSelectedPiece(null);
      }
    },
    [
      state,
      trackByPiece,
      trackItemAddition,
      t,
      autoApplyCustomerPrefs,
      servicePrefs,
    ],
  );

  const handleRemoveItem = useCallback(
    (productId: string) => {
      if (!state.removeItem(productId)) return;
      cmxMessage.success(t('itemsGrid.itemRemoved'));
    },
    [state, t],
  );

  const handleQuantityChange = useCallback(
    (productId: string, quantity: number) => {
      const item = state.state.items.find((i) => i.productId === productId);
      const prevQty = item?.quantity ?? 0;
      state.updateItemQuantity(productId, quantity);
      if (trackByPiece && quantity > prevQty) {
        state.setSelectedPiece(`temp-${productId}-${quantity}`);
      }
    },
    [state, trackByPiece],
  );

  const handlePiecesChange = useCallback(
    (itemId: string, pieces: PreSubmissionPiece[]) => {
      const item = state.state.items.find((i) => i.productId === itemId);
      const prevPieces = item?.pieces ?? [];
      state.updateItemPieces(itemId, pieces);
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

  // Copy piece conditions/notes to all siblings
  const handleCopyPieceToAll = useCallback(
    (itemId: string, pieceId: string) => {
      const item = state.state.items.find((i) => i.productId === itemId);
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
    state.openModal('payment');
  }, [state, t, tPos, hasErrors, warnings, orderEntryLocked, posGuide]);

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
          id: item.persistedItemId ?? item.productId,
          productId: item.productId,
          productName: item.productName || 'Unknown Product',
          productName2: item.productName2 || undefined,
          quantity: item.quantity,
          pricePerUnit: effectiveUnitPrice,
          totalPrice: calculateItemTotal(item),
          notes: item.notes,
          pieces: item.pieces,
          piecePriced: item.piecePriced,
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
      state.state.items.length === 0 ||
      !state.state.readyByAt
    )
      return true;
    const readyByDate = new Date(state.state.readyByAt);
    const now = new Date();
    const threshold = isRetailOnlyOrder ? now.getTime() - 60000 : now.getTime();
    const isFuture = isRetailOnlyOrder
      ? readyByDate.getTime() >= threshold
      : readyByDate > now;
    return !isFuture;
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
      if (
        key === 's' &&
        (event.ctrlKey || event.metaKey) &&
        !isSubmitting &&
        state.state.items.length > 0
      ) {
        event.preventDefault();
        if (workspace) workspace.onReview();
        else if (!state.state.isEditMode) handleSubmitOrderClick();
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

  const sharedSummaryPanelProps = {
    items: memoizedOrderItems,
    onEditItem: priceCapability.interactive ? (itemId: string) => {
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
          onEditLineDiscount: canDiscountLines && lineDiscountCapability.interactive ? setDiscountProductId : undefined,
          onEditPieceDiscount: canDiscountLines && lineDiscountCapability.interactive
            ? (productId: string, pieceId: string) => {
                setDiscountProductId(productId);
                setDiscountPieceId(pieceId);
              }
            : undefined,
        }
      : {
          lines: cartQuote.data?.lines ?? null,
          pending: cartQuote.pending,
          onLineSpeedChange: handleLineSpeedChange,
          previewRequest: cartQuoteRequest,
          onEditLineDiscount: canDiscountLines ? setDiscountProductId : undefined,
          onEditPieceDiscount: canDiscountLines
            ? (productId: string, pieceId: string) => {
                setDiscountProductId(productId);
                setDiscountPieceId(pieceId);
              }
            : undefined,
        },
    speedChangeNote,
    // Bags
    bags: state.state.bags,
    onBagsChange: state.setBags,
    // Edit item preferences — piece-level preferences tab (track-by-piece) or Order Items tab, focused on the item
    onEditItemPreferences: (itemId: string) => {
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
    <div
      className="flex-1 min-h-0 overflow-hidden flex flex-col"
      role="main"
      aria-label={t('title') || 'New Order'}
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
        className={`flex-1 min-h-0 flex ${isRTL ? 'flex-row-reverse' : ''}`}
        inert={orderEntryLocked ? true : undefined}
      >
        {/* Left/Center Panel */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
          {/* Branch Required Gate */}
          {branchRequired ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
                <GitBranch className="w-8 h-8 text-amber-500" aria-hidden />
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-800">
                  {t('errors.selectBranch') || 'Please select a branch'}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {tCommon('selectBranch') || 'Select a branch to continue'}
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Step Tabs */}
              <div className="shrink-0 px-4 pt-4 pb-2">
                <div
                  className="bg-white rounded-lg border border-gray-200 p-2"
                  role="tablist"
                  aria-label={t('title') || 'New order steps'}
                >
                  <div
                    className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeTab === 'select'}
                      tabIndex={activeTab === 'select' ? 0 : -1}
                      onClick={() => setRequestedActiveTab('select')}
                      className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${activeTab === 'select' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                      1) {t('itemsGrid.selectItems') || 'Select Items'}
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeTab === 'details'}
                      tabIndex={activeTab === 'details' ? 0 : -1}
                      onClick={() => setRequestedActiveTab('details')}
                      className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center gap-1.5 ${isRTL ? 'flex-row-reverse' : ''} ${activeTab === 'details' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                      {state.state.items.length > 0 && (
                        <Check
                          className="w-4 h-4 shrink-0"
                          aria-hidden="true"
                        />
                      )}
                      2) {t('itemsGrid.orderItems') || 'Order Items'} (
                      {state.state.items.length})
                    </button>
                    {trackByPiece && state.state.items.length > 0 && (
                      <>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={activeTab === 'piecePreferences'}
                          tabIndex={activeTab === 'piecePreferences' ? 0 : -1}
                          onClick={() =>
                            setRequestedActiveTab('piecePreferences')
                          }
                          className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${activeTab === 'piecePreferences' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        >
                          3) {t('pieces.editItemPreferences')} ({totalPieces})
                        </button>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={activeTab === 'pieces'}
                          tabIndex={activeTab === 'pieces' ? 0 : -1}
                          onClick={() => setRequestedActiveTab('pieces')}
                          className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${activeTab === 'pieces' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        >
                          4) {t('pieces.editItemNotes') || 'Edit Item Notes'} (
                          {totalPieces})
                        </button>
                      </>
                    )}
                    {state.state.customer !== null && (
                      <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 'customer'}
                        tabIndex={activeTab === 'customer' ? 0 : -1}
                        onClick={() => setRequestedActiveTab('customer')}
                        className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center gap-1.5 ${isRTL ? 'flex-row-reverse' : ''} ${activeTab === 'customer' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                      >
                        <Check
                          className="w-4 h-4 shrink-0"
                          aria-hidden="true"
                        />
                        {trackByPiece ? '5)' : '3)'}{' '}
                        {t('customerDetails.title') || 'Customer Details'}
                      </button>
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
                          onRemoveItem={handleRemoveItem}
                          onQuantityChange={handleQuantityChange}
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
          <div className="w-[28rem] shrink-0 border-s border-gray-200 bg-white h-full flex flex-col overflow-hidden">
            {!state.state.createdOrderId && !state.state.isEditMode && (
              <div
                className={`shrink-0 px-4 pt-3 pb-2 border-b border-gray-100 ${isRTL ? 'text-left' : 'text-right'}`}
              >
                <button
                  type="button"
                  onClick={handleAddNewOrder}
                  className="text-sm text-blue-600 hover:text-blue-700 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded"
                >
                  + {t('addNewOrder')}
                </button>
              </div>
            )}
            <OrderSummaryPanel {...sharedSummaryPanelProps} />
            {state.state.createdOrderId && (
              <div
                className={`p-4 border-t border-gray-200 bg-blue-50 space-y-2 ${isRTL ? 'space-y-reverse' : ''}`}
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
                className={`shrink-0 px-4 pt-2 pb-2 border-b border-gray-100 ${isRTL ? 'text-left' : 'text-right'}`}
              >
                <button
                  type="button"
                  onClick={handleAddNewOrder}
                  className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
                >
                  + {t('addNewOrder')}
                </button>
              </div>
            )}
            <OrderSummaryPanel {...sharedSummaryPanelProps} />
            {state.state.createdOrderId && (
              <div
                className={`p-4 border-t border-gray-200 bg-blue-50 space-y-2 ${isRTL ? 'space-y-reverse' : ''}`}
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
      {discountItem && discountPiece ? (
        <LineDiscountDialog
          key={discountPiece.id}
          open
          onClose={closeDiscountDialog}
          productName={`${getBilingual(discountItem.productName, discountItem.productName2) || discountItem.productId} · ${discountPieceIndex + 1}`}
          lineGross={discountPieceGross}
          current={discountPiece.lineDiscount ?? null}
          onApply={(lineDiscount) => handlePiecesChange(discountItem.productId, (discountItem.pieces ?? []).map((p) => (p.id === discountPiece.id ? { ...p, lineDiscount } : p)))}
          onRemove={() => handlePiecesChange(discountItem.productId, (discountItem.pieces ?? []).map((p) => (p.id === discountPiece.id ? { ...p, lineDiscount: null } : p)))}
        />
      ) : discountItem ? (
        <LineDiscountDialog
          key={discountItem.productId}
          open
          onClose={closeDiscountDialog}
          productName={getBilingual(discountItem.productName, discountItem.productName2) || discountItem.productId}
          lineGross={discountLineGross}
          current={discountItem.lineDiscount ?? null}
          onApply={(lineDiscount) => state.setItemLineDiscount(discountItem.productId, lineDiscount)}
          onRemove={() => state.setItemLineDiscount(discountItem.productId, null)}
        />
      ) : null}
    </div>
  );
}
