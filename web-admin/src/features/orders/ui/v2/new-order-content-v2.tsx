/**
 * New Order Content V2
 * V2 layout: sticky top bar (branch/customer/express/categories) + streamlined panels
 * Re-Design: PRD-010 Advanced Orders - V2 Enhancement
 */

'use client';

import { useRTL } from '@/lib/hooks/useRTL';
import { useBreakpoint } from '@/lib/hooks/use-breakpoint';
import { useNewOrderStateWithDispatch } from '../../hooks/use-new-order-state';
import { useCategories, useProducts } from '../../hooks/use-category-products';
import { useOrderTotals } from '../../hooks/use-order-totals';
import { useReadyByEstimation } from '../../hooks/use-ready-by-estimation';
import { useTenantSettingsWithDefaults } from '@/lib/hooks/useTenantSettings';
import { useAuth } from '@/lib/auth/auth-context';
import { usePlanFlags } from '../../hooks/use-plan-flags';
import { useTenantPreferenceSettings } from '../../hooks/use-tenant-preference-settings';
import { usePreferenceCatalog } from '../../hooks/use-preference-catalog';
import { useOrderSubmission } from '../../hooks/use-order-submission';
import { useOrderEditDirty } from '../../hooks/use-order-edit-dirty';
import { useOrderEditCancel } from '../../hooks/use-order-edit-cancel';
import { useOrderWarnings } from '../../hooks/use-order-warnings';
import { useUnsavedChanges } from '../../hooks/use-unsaved-changes';
import { useKeyboardNavigation } from '@/lib/hooks/use-keyboard-navigation';
import { useOrderPerformance } from '../../hooks/use-order-performance';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useEffect, useState } from 'react';
import { CmxButton } from '@ui/primitives/cmx-button';
import { Check } from 'lucide-react';
import { cmxMessage, CmxAlertDialog } from '@ui/feedback';
import { getBranchesAction } from '@/app/actions/inventory/inventory-actions';
import { getCurrencyConfigAction } from '@/app/actions/tenant/get-currency-config';
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';
import type { BranchOption } from '@/lib/services/inventory-service';
import { NewOrderTopBarV2 } from './new-order-top-bar-v2';
import { ProductGridV2 } from './product-grid-v2';
import { OrderSummaryPanelV2 } from './order-summary-panel-v2';
import { OrderSummaryBottomSheet } from '../OrderSummaryBottomSheet';
import { ProductGridSkeleton } from '../loading-skeletons';
import { OrderDetailsSection } from '../order-details-section';
import { OrderCustomerDetailsSection } from '../order-customer-details-section';
import { EditOrderBar } from '../edit-order-bar';
import type { Product, OrderItem, PreSubmissionPiece } from '../../model/new-order-types';
import { generatePiecesForItem } from '@/lib/utils/piece-helpers';
import { calculateItemTotal } from '@/lib/utils/order-item-helpers';

/**
 * New Order Content V2 Component
 */
export function NewOrderContentV2() {
    const t = useTranslations('newOrder');
    const tWorkflow = useTranslations('workflow');
    const tCommon = useTranslations('common');
    const router = useRouter();
    const isRTL = useRTL();
    const { currentTenant } = useAuth();
    const state = useNewOrderStateWithDispatch();
    const { trackByPiece, packingPerPieceEnabled, enforcePrefCompatibility } = useTenantSettingsWithDefaults(
        currentTenant?.tenant_id || ''
    );
    const { bundlesEnabled, repeatLastOrderEnabled, smartSuggestionsEnabled } = usePlanFlags();
    const { autoApplyCustomerPrefs } = useTenantPreferenceSettings({
        tenantId: currentTenant?.tenant_id,
        branchId: state.state.branchId,
        enabled: true,
    });
    const { servicePrefs, conditionCatalog } = usePreferenceCatalog(state.state.branchId);
    const { trackItemAddition, trackModalOpen, resetMetrics } = useOrderPerformance();
    const [activeTab, setActiveTab] = useState<'select' | 'details' | 'customer'>('select');
    const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
    const { isDesktop } = useBreakpoint();
    const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const [branches, setBranches] = useState<BranchOption[]>([]);
    const [branchesLoading, setBranchesLoading] = useState(true);
    const [currencyCode, setCurrencyCode] = useState(ORDER_DEFAULTS.CURRENCY);
    const { submitOrder: _submitOrder, saveOrderUpdate, isSubmitting } = useOrderSubmission();
    const { isDirty } = useOrderEditDirty();
    const { cancelEditOrder, isCancelling } = useOrderEditCancel(state.state.editingOrderId);
    const totals = useOrderTotals();
    const { warnings, hasErrors } = useOrderWarnings({ hasBranches: branches.length > 0 });
    const { calculateReadyBy } = useReadyByEstimation();
    const tEdit = useTranslations('orders.edit');

    const hasUnsavedChanges = useCallback(() => {
        if (state.state.isEditMode) return isDirty;
        return (
            state.state.items.length > 0 ||
            (state.state.notes && state.state.notes.trim().length > 0) ||
            state.state.customer !== null
        );
    }, [state.state.isEditMode, isDirty, state.state.items.length, state.state.notes, state.state.customer]);

    useUnsavedChanges(
        hasUnsavedChanges,
        state.state.isEditMode
            ? (tEdit('confirmLeave') || 'Leave without saving?')
            : (t('warnings.unsavedChanges') || 'You have unsaved changes. Are you sure you want to leave?')
    );

    useEffect(() => {
        if (state.state.items.length === 0 && (activeTab === 'details' || activeTab === 'customer')) {
            setActiveTab('select');
        }
        if (state.state.customer === null && activeTab === 'customer') {
            setActiveTab('select');
        }
    }, [state.state.items.length, state.state.customer, activeTab]);

    const isRetailOnlyOrder = useMemo(
        () =>
            state.state.items.length > 0 &&
            state.state.items.every((i) => i.serviceCategoryCode === 'RETAIL_ITEMS'),
        [state.state.items]
    );

    useEffect(() => { resetMetrics(); }, [resetMetrics]);

    useEffect(() => {
        getBranchesAction().then((r) => {
            if (r.success && r.data) {
                setBranches(r.data);
                if (r.data.length === 1) state.setBranchId(r.data[0].id);
            }
        }).finally(() => setBranchesLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (currentTenant?.tenant_id) {
            getCurrencyConfigAction(currentTenant.tenant_id, state.state.branchId ?? undefined).then((config) => {
                setCurrencyCode(config.currencyCode);
            }).catch(() => {});
        }
    }, [currentTenant?.tenant_id, state.state.branchId]);

    const categoriesQuery = useCategories();
    const productsQuery = useProducts(state.state.selectedCategory);

    // Suppress unused variable warnings — hooks are used for side effects / cache population
    void categoriesQuery;
    void productsQuery;

    useEffect(() => {
        const { categories, selectedCategory } = state.state;
        const firstCode = categories[0]?.service_category_code;
        if (categories.length > 0 && !selectedCategory && firstCode) {
            state.setSelectedCategory(firstCode);
        }
    }, [state.state.categories, state.state.selectedCategory, state]);

    const handleSelectCategory = useCallback(
        (category: string) => { state.setSelectedCategory(category); },
        [state]
    );

    const handleAddItem = useCallback(
        async (product: Product) => {
            const isNewRetail = product.service_category_code === 'RETAIL_ITEMS' || (product as { is_retail_item?: boolean }).is_retail_item;
            const existingItems = state.state.items;
            if (existingItems.length > 0) {
                const firstExisting = existingItems[0];
                const isExistingRetail = firstExisting.serviceCategoryCode === 'RETAIL_ITEMS';
                if (isNewRetail !== isExistingRetail) {
                    cmxMessage.error(t('errors.mixedRetailServices'));
                    return;
                }
            }

            const pricePerUnit =
                state.state.express && product.default_express_sell_price
                    ? product.default_express_sell_price
                    : product.default_sell_price || 0;

            let resolvedServicePrefs: Array<{ preference_code: string; source: string; extra_price: number }> = [];
            if (autoApplyCustomerPrefs && state.state.customer?.id && servicePrefs.length > 0) {
                try {
                    const params = new URLSearchParams({
                        customerId: state.state.customer.id,
                        productCode: (product as { product_code?: string }).product_code ?? product.id,
                        serviceCategoryCode: product.service_category_code ?? '',
                    });
                    const res = await fetch(`/api/v1/preferences/resolve?${params}`, { credentials: 'include' });
                    const json = await res.json();
                    if (json.success && Array.isArray(json.data) && json.data.length > 0) {
                        const priceMap = new Map(servicePrefs.map((s) => [s.code, s.default_extra_price ?? 0]));
                        resolvedServicePrefs = json.data.map(
                            (p: { preference_code: string; source: string }) => ({
                                preference_code: p.preference_code,
                                source: p.source || 'customer_pref',
                                extra_price: priceMap.get(p.preference_code) ?? 0,
                            })
                        );
                    }
                } catch { /* ignore */ }
            }

            const servicePrefCharge = resolvedServicePrefs.reduce((sum, p) => sum + p.extra_price, 0);
            const newItem: OrderItem = {
                productId: product.id,
                productName: product.product_name,
                productName2: product.product_name2,
                quantity: 1,
                pricePerUnit,
                totalPrice: pricePerUnit + servicePrefCharge,
                defaultSellPrice: product.default_sell_price ?? null,
                defaultExpressSellPrice: product.default_express_sell_price ?? null,
                serviceCategoryCode: product.service_category_code || undefined,
                servicePrefs: resolvedServicePrefs.length > 0 ? resolvedServicePrefs : undefined,
                servicePrefCharge: resolvedServicePrefs.length > 0 ? servicePrefCharge : undefined,
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
        [state, trackByPiece, trackItemAddition, t, autoApplyCustomerPrefs, servicePrefs]
    );

    const handleRemoveItem = useCallback(
        (productId: string) => { state.removeItem(productId); },
        [state]
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
        [state, trackByPiece]
    );

    const handlePiecesChange = useCallback(
        (itemId: string, pieces: PreSubmissionPiece[]) => {
            const item = state.state.items.find((i) => i.productId === itemId);
            const prevPieces = item?.pieces ?? [];
            state.updateItemPieces(itemId, pieces);
            if (pieces.length > prevPieces.length) {
                const newPiece = pieces.find((p) => !prevPieces.some((prev) => prev.id === p.id));
                if (newPiece) state.setSelectedPiece(newPiece.id);
            }
        },
        [state]
    );

    // Copy piece conditions/notes to all siblings
    const handleCopyPieceToAll = useCallback(
        (itemId: string, pieceId: string) => {
            const item = state.state.items.find((i) => i.productId === itemId);
            const sourcePiece = item?.pieces?.find((p) => p.id === pieceId);
            if (!item || !sourcePiece || !item.pieces) return;
            const updated = item.pieces.map((p) => ({
                ...p,
                conditions: sourcePiece.conditions,
                notes: sourcePiece.notes,
                servicePrefs: sourcePiece.servicePrefs,
            }));
            state.updateItemPieces(itemId, updated);
            cmxMessage.success(t('pieces.copyToAllPieces') || 'Copied to all pieces');
        },
        [state, t]
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
        [state, selectedConditions]
    );

    const handleSubmitOrderClick = useCallback(() => {
        if (hasErrors) {
            const errorWarnings = warnings.filter((w) => w.severity === 'error');
            if (errorWarnings.length > 0) { cmxMessage.error(errorWarnings[0].message); return; }
        }
        if (!state.state.customer) { cmxMessage.error(t('errors.selectCustomer')); return; }
        if (state.state.items.length === 0) { cmxMessage.error(t('errors.addItems')); return; }
        state.openModal('payment');
    }, [state, t, hasErrors, warnings]);

    const handleNavigateToOrder = useCallback(() => {
        if (!state.state.createdOrderId) return;
        const status = state.state.createdOrderStatus;
        const orderId = state.state.createdOrderId;
        let route: string;
        if (status) {
            const statusLower = status.toLowerCase();
            if (statusLower === 'preparing' || statusLower === 'intake') route = `/dashboard/preparation/${orderId}`;
            else if (statusLower === 'processing') route = `/dashboard/processing/${orderId}`;
            else route = `/dashboard/orders/${orderId}`;
        } else { route = `/dashboard/orders/${orderId}`; }
        router.push(route);
        state.setCreatedOrder('', null);
    }, [state, router]);

    const getNavigationLabel = useCallback(
        (status: string | null): string => {
            if (!status) return tWorkflow('newOrder.goToOrder') || 'Go to Order';
            const statusLower = status.toLowerCase();
            if (statusLower === 'preparing' || statusLower === 'intake') return tWorkflow('newOrder.goToPreparation') || 'Go to Preparation';
            if (statusLower === 'processing') return tWorkflow('newOrder.goToProcessing') || 'Go to Processing';
            return tWorkflow('newOrder.goToOrder') || 'Go to Order';
        },
        [tWorkflow]
    );

    const handleAddNewOrder = useCallback(() => {
        if (state.state.createdOrderId) { state.resetOrder(); return; }
        const hasUnsaved =
            state.state.items.length > 0 ||
            (state.state.notes?.trim().length ?? 0) > 0 ||
            state.state.customer !== null;
        if (hasUnsaved) setShowDiscardConfirm(true);
        else state.resetOrder();
    }, [state]);

    const handleConfirmDiscard = useCallback(() => { state.resetOrder(); setShowDiscardConfirm(false); }, [state]);

    const handleCancelEdit = useCallback(() => {
        if (isDirty) setShowCancelConfirm(true);
        else cancelEditOrder();
    }, [isDirty, cancelEditOrder]);

    const handleConfirmCancelEdit = useCallback(() => { cancelEditOrder(); setShowCancelConfirm(false); }, [cancelEditOrder]);

    const handleSaveEditOrder = useCallback(() => {
        if (hasErrors) {
            const errorWarnings = warnings.filter((w) => w.severity === 'error');
            if (errorWarnings.length > 0) { cmxMessage.error(errorWarnings[0].message); return; }
        }
        saveOrderUpdate();
    }, [hasErrors, warnings, saveOrderUpdate]);

    const memoizedOrderItems = useMemo(
        () =>
            state.state.items.map((item) => {
                const cat = state.state.categories.find((c) => c.service_category_code === item.serviceCategoryCode);
                const prefCharge = item.servicePrefCharge ?? 0;
                const effectiveUnitPrice = prefCharge > 0 ? item.pricePerUnit + prefCharge / item.quantity : item.pricePerUnit;
                const conditions = item.pieces
                    ? Array.from(new Set(item.pieces.flatMap((p) => p.conditions ?? [])))
                    : [];
                const hasStain = conditions.some((c) =>
                    ['coffee', 'wine', 'blood', 'mud', 'oil', 'ink', 'grease', 'bleach', 'bubble'].includes(c.toLowerCase())
                );
                const hasDamage = conditions.some((c) =>
                    ['button_broken', 'button_missing', 'collar_torn', 'zipper_broken', 'hole', 'tear', 'seam_open'].includes(c.toLowerCase())
                );
                return {
                    id: item.productId,
                    productId: item.productId,
                    productName: item.productName || 'Unknown Product',
                    productName2: item.productName2 || undefined,
                    quantity: item.quantity,
                    pricePerUnit: effectiveUnitPrice,
                    totalPrice: calculateItemTotal(item),
                    notes: item.notes,
                    pieces: item.pieces,
                    conditions,
                    hasStain,
                    hasDamage,
                    serviceCategoryCode: item.serviceCategoryCode,
                    serviceCategoryName: cat?.ctg_name ?? item.serviceCategoryCode ?? undefined,
                    serviceCategoryName2: cat?.ctg_name2 ?? undefined,
                    priceOverride: item.priceOverride,
                    overrideReason: item.overrideReason,
                };
            }),
        [state.state.items, state.state.categories]
    );

    const isSubmitDisabled = useMemo(() => {
        if (state.state.isEditMode) return !isDirty || isSubmitting || state.state.loading || hasErrors;
        if (state.state.loading || isSubmitting || !state.state.customerName || state.state.items.length === 0 || !state.state.readyByAt) return true;
        const readyByDate = new Date(state.state.readyByAt);
        const now = new Date();
        const threshold = isRetailOnlyOrder ? now.getTime() - 60000 : now.getTime();
        const isFuture = isRetailOnlyOrder ? readyByDate.getTime() >= threshold : readyByDate > now;
        return !isFuture;
    }, [state.state.isEditMode, isDirty, isSubmitting, state.state.loading, hasErrors, state.state.customerName, state.state.items.length, state.state.readyByAt, isRetailOnlyOrder]);

    // canSubmit for OrderSummaryPanelV2
    const canSubmit = useMemo(() => !isSubmitDisabled, [isSubmitDisabled]);

    useKeyboardNavigation({
        enabled: true,
        onKey: (key, event) => {
            if (key === 's' && (event.ctrlKey || event.metaKey) && !isSubmitting && state.state.items.length > 0) {
                event.preventDefault();
                handleSubmitOrderClick();
                return;
            }
            if (event.altKey && !event.ctrlKey && !event.metaKey) {
                if (key === '1') { event.preventDefault(); setActiveTab('select'); return; }
                if (key === '2') { event.preventDefault(); setActiveTab('details'); return; }
                if (key === '3' && state.state.customer !== null) { event.preventDefault(); setActiveTab('customer'); return; }
            }
        },
    });

    const sharedSummaryPanelProps = {
        items: memoizedOrderItems,
        onEditItem: (itemId: string) => { state.openPriceOverrideModal(itemId); },
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
        total: totals.subtotal,
        onSubmit: handleSubmitOrderClick,
        isEditMode: state.state.isEditMode,
        isDirty,
        onSave: handleSaveEditOrder,
        isSaving: isSubmitting,
        hasErrors,
        validationErrors: warnings.filter((w) => w.severity === 'error').map((w) => w.message),
        onOpenReadyByModal: () => state.openModal('readyBy'),
        onCalculateReadyBy: async () => {
            try {
                const result = await calculateReadyBy();
                if (result) cmxMessage.success(t('success.readyByCalculated') || 'Ready-by date calculated successfully');
                else cmxMessage.error(t('errors.failedToCalculateReadyBy') || 'Failed to calculate ready-by date');
            } catch (error) {
                console.error('Error calculating ready-by:', error);
                cmxMessage.error(t('errors.failedToCalculateReadyBy') || 'Failed to calculate ready-by date');
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
    };

    return (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col" role="main" aria-label={t('title') || 'New Order'}>
            {/* Screen reader live region */}
            <div aria-live="polite" aria-atomic="true" className="sr-only">
                {state.state.items.length > 0 && (
                    <span>{t('orderSummary.items', { count: state.state.items.length }) || `${state.state.items.length} items in order`}</span>
                )}
            </div>

            {/* V2 Sticky Top Bar */}
            <NewOrderTopBarV2
                branches={branches}
                branchId={state.state.branchId}
                onBranchChange={state.setBranchId}
                branchesLoading={branchesLoading}
                customerName={state.state.customerName}
                onSelectCustomer={() => state.openModal('customerPicker')}
                onEditCustomer={() => state.openModal('customerEdit')}
                express={state.state.express}
                onExpressToggle={state.setExpress}
                categories={state.state.categories}
                selectedCategory={state.state.selectedCategory}
                onSelectCategory={handleSelectCategory}
                categoriesLoading={state.state.categoriesLoading}
                showCategories={activeTab === 'select'}
            />

            {/* Edit order bar */}
            {state.state.isEditMode && (
                <EditOrderBar
                    orderNo={state.state.editingOrderNo}
                    onCancelEdit={handleCancelEdit}
                    onSave={saveOrderUpdate}
                    isDirty={isDirty}
                    isCancelling={isCancelling}
                    isSaving={isSubmitting}
                />
            )}

            <div className={`flex-1 min-h-0 flex ${isRTL ? 'flex-row-reverse' : ''}`}>
                {/* Left/Center Panel */}
                <div className="flex-1 min-h-0 flex flex-col">
                    {/* Step Tabs */}
                    <div className="shrink-0 px-4 pt-4 pb-2">
                        <div className="bg-white rounded-lg border border-gray-200 p-2" role="tablist" aria-label={t('title') || 'New order steps'}>
                            <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={activeTab === 'select'}
                                    tabIndex={activeTab === 'select' ? 0 : -1}
                                    onClick={() => setActiveTab('select')}
                                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${activeTab === 'select' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                                >
                                    1) {t('itemsGrid.selectItems') || 'Select Items'}
                                </button>
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={activeTab === 'details'}
                                    tabIndex={activeTab === 'details' ? 0 : -1}
                                    onClick={() => setActiveTab('details')}
                                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center gap-1.5 ${isRTL ? 'flex-row-reverse' : ''} ${activeTab === 'details' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                                >
                                    {state.state.items.length > 0 && <Check className="w-4 h-4 shrink-0" aria-hidden="true" />}
                                    2) {t('itemsGrid.orderItems') || 'Order Items'} ({state.state.items.length})
                                </button>
                                {state.state.customer !== null && (
                                    <button
                                        type="button"
                                        role="tab"
                                        aria-selected={activeTab === 'customer'}
                                        tabIndex={activeTab === 'customer' ? 0 : -1}
                                        onClick={() => setActiveTab('customer')}
                                        className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center gap-1.5 ${isRTL ? 'flex-row-reverse' : ''} ${activeTab === 'customer' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                                    >
                                        <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                                        3) {t('customerDetails.title') || 'Customer Details'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Scrollable Panel Content */}
                    <div className={`flex-1 min-h-0 overflow-y-auto transition-opacity duration-200 ease-out ${!isDesktop && state.state.items.length > 0 ? 'pb-28' : ''}`}>
                        {activeTab === 'select' && (
                            <div className="p-4 sm:p-6 pt-2">
                                {state.state.productsLoading ? (
                                    <ProductGridSkeleton />
                                ) : (
                                    <ProductGridV2
                                        products={state.state.products}
                                        items={state.state.items}
                                        express={state.state.express}
                                        currencyCode={currencyCode}
                                        onAddItem={handleAddItem}
                                        onRemoveItem={handleRemoveItem}
                                        onQuantityChange={handleQuantityChange}
                                        selectedConditions={selectedConditions}
                                        onConditionToggle={handleConditionToggle}
                                        selectedPieceId={state.state.selectedPieceId}
                                        enforcePrefCompatibility={enforcePrefCompatibility}
                                        onOpenCustomItemModal={() => { state.openModal('customItem'); trackModalOpen('customItem'); }}
                                        onOpenPhotoCapture={() => { state.openModal('photoCapture'); trackModalOpen('photoCapture'); }}
                                    />
                                )}
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
                        {activeTab === 'customer' && (
                            <div className="p-4 sm:p-6 pt-2">
                                <OrderCustomerDetailsSection />
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Sidebar (desktop) */}
                {isDesktop ? (
                    <div className="w-96 shrink-0 border-s border-gray-200 bg-white h-full flex flex-col overflow-hidden">
                        {!state.state.createdOrderId && !state.state.isEditMode && (
                            <div className={`shrink-0 px-4 pt-3 pb-2 border-b border-gray-100 ${isRTL ? 'text-left' : 'text-right'}`}>
                                <button
                                    type="button"
                                    onClick={handleAddNewOrder}
                                    className="text-sm text-blue-600 hover:text-blue-700 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded"
                                >
                                    + {t('addNewOrder')}
                                </button>
                            </div>
                        )}
                        <OrderSummaryPanelV2 {...sharedSummaryPanelProps} />
                        {state.state.createdOrderId && (
                            <div className={`p-4 border-t border-gray-200 bg-blue-50 space-y-2 ${isRTL ? 'space-y-reverse' : ''}`}>
                                <CmxButton onClick={handleAddNewOrder} className="w-full" variant="secondary">
                                    + {t('addNewOrder')}
                                </CmxButton>
                                <CmxButton onClick={handleNavigateToOrder} className="w-full" variant="primary">
                                    {getNavigationLabel(state.state.createdOrderStatus)}
                                </CmxButton>
                            </div>
                        )}
                    </div>
                ) : (
                    <OrderSummaryBottomSheet
                        itemCount={state.state.items.length}
                        total={totals.subtotal}
                        currencyCode={currencyCode}
                        isOpen={bottomSheetOpen}
                        onOpen={() => setBottomSheetOpen(true)}
                        onClose={() => setBottomSheetOpen(false)}
                        onPrimaryAction={handleSubmitOrderClick}
                        primaryDisabled={isSubmitDisabled}
                        primaryLabel={state.state.isEditMode ? (tEdit('saveChanges') || 'Save changes') : (t('submitOrder') || 'Add Order')}
                        loading={state.state.loading || isSubmitting}
                    >
                        {!state.state.createdOrderId && !state.state.isEditMode && (
                            <div className={`shrink-0 px-4 pt-2 pb-2 border-b border-gray-100 ${isRTL ? 'text-left' : 'text-right'}`}>
                                <button type="button" onClick={handleAddNewOrder} className="text-sm text-blue-600 hover:text-blue-700 hover:underline">
                                    + {t('addNewOrder')}
                                </button>
                            </div>
                        )}
                        <OrderSummaryPanelV2 {...sharedSummaryPanelProps} />
                        {state.state.createdOrderId && (
                            <div className={`p-4 border-t border-gray-200 bg-blue-50 space-y-2 ${isRTL ? 'space-y-reverse' : ''}`}>
                                <CmxButton onClick={handleAddNewOrder} className="w-full" variant="secondary">+ {t('addNewOrder')}</CmxButton>
                                <CmxButton onClick={handleNavigateToOrder} className="w-full" variant="primary">{getNavigationLabel(state.state.createdOrderStatus)}</CmxButton>
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
        </div>
    );
}
