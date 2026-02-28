/**
 * New Order Content
 * Main content area with category tabs, product grid, and order summary
 */

'use client';

import { useRTL } from '@/lib/hooks/useRTL';
import { useNewOrderStateWithDispatch } from '../hooks/use-new-order-state';
import { useCategories, useProducts } from '../hooks/use-category-products';
import { useOrderTotals } from '../hooks/use-order-totals';
import { useReadyByEstimation } from '../hooks/use-ready-by-estimation';
import { useTenantSettingsWithDefaults } from '@/lib/hooks/useTenantSettings';
import { useAuth } from '@/lib/auth/auth-context';
import { useOrderSubmission } from '../hooks/use-order-submission';
import { useNotesPersistence } from '../hooks/use-notes-persistence';
import { useOrderWarnings } from '../hooks/use-order-warnings';
import { useUnsavedChanges } from '../hooks/use-unsaved-changes';
import { useKeyboardNavigation } from '@/lib/hooks/use-keyboard-navigation';
import { useOrderPerformance } from '../hooks/use-order-performance';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useEffect, useState } from 'react';
import { CmxButton } from '@ui/primitives/cmx-button';
import { cmxMessage, CmxAlertDialog } from '@ui/feedback';
import { getBranchesAction } from '@/app/actions/inventory/inventory-actions';
import { getCurrencyConfigAction } from '@/app/actions/tenant/get-currency-config';
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';
import type { BranchOption } from '@/lib/services/inventory-service';
// Temporary imports - will move to feature folder later
// Using @ alias to access app folder components
import { CategoryTabs } from './category-tabs';
import { ProductGrid } from './product-grid';
import { OrderSummaryPanel } from './order-summary-panel';
import { CategoryTabsSkeleton, ProductGridSkeleton } from './loading-skeletons';
import { OrderDetailsSection } from './order-details-section';
import type { Product, OrderItem, PreSubmissionPiece } from '../model/new-order-types';
import { generatePiecesForItem } from '@/lib/utils/piece-helpers';

/**
 * New Order Content Component
 */
export function NewOrderContent() {
    const t = useTranslations('newOrder');
    const tWorkflow = useTranslations('workflow');
    const tCommon = useTranslations('common');
    const router = useRouter();
    const isRTL = useRTL();
    const { currentTenant } = useAuth();
    const { trackByPiece } = useTenantSettingsWithDefaults(
        currentTenant?.tenant_id || ''
    );
    const {
        trackItemAddition,
        trackModalOpen,
        resetMetrics,
    } = useOrderPerformance();
    const [activeTab, setActiveTab] = useState<'select' | 'details'>('select');
    const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
    const [branches, setBranches] = useState<BranchOption[]>([]);
    const [branchesLoading, setBranchesLoading] = useState(true);
    const [currencyCode, setCurrencyCode] = useState(ORDER_DEFAULTS.CURRENCY);
    const state = useNewOrderStateWithDispatch();
    const { submitOrder, isSubmitting } = useOrderSubmission();
    const totals = useOrderTotals();
    const { warnings, hasErrors } = useOrderWarnings({ hasBranches: branches.length > 0 });
    const { calculateReadyBy } = useReadyByEstimation();

    // Notes persistence
    const handleLoadNotes = useCallback((savedNotes: string) => {
        state.setNotes(savedNotes);
    }, [state]);

    const { clearSavedNotes } = useNotesPersistence(state.state.notes, handleLoadNotes);

    // Unsaved changes warning
    useUnsavedChanges(() => {
        return (
            state.state.items.length > 0 ||
            (state.state.notes && state.state.notes.trim().length > 0) ||
            state.state.customer !== null
        );
    }, t('warnings.unsavedChanges') || 'You have unsaved changes. Are you sure you want to leave?');

    // Clear saved notes when order is successfully created
    useEffect(() => {
        if (state.state.createdOrderId) {
            clearSavedNotes();
        }
    }, [state.state.createdOrderId, clearSavedNotes]);

    // Reset active tab to 'select' when order is reset (items cleared)
    useEffect(() => {
        // Reset tab to 'select' when items are cleared (after order submission or manual reset)
        if (state.state.items.length === 0 && activeTab === 'details') {
            setActiveTab('select');
        }
    }, [state.state.items.length, activeTab]);

    const isRetailOnlyOrder = useMemo(
        () =>
            state.state.items.length > 0 &&
            state.state.items.every((i) => i.serviceCategoryCode === 'RETAIL_ITEMS'),
        [state.state.items]
    );

    // Reset performance metrics on mount
    useEffect(() => {
        resetMetrics();
    }, [resetMetrics]);

    // Fetch branches for branch selector
    useEffect(() => {
        getBranchesAction().then((r) => {
            if (r.success && r.data) {
                setBranches(r.data);
                // Auto-select when only one branch exists
                if (r.data.length === 1) {
                    state.setBranchId(r.data[0].id);
                }
            }
        }).finally(() => setBranchesLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init only, setBranchId is stable
    }, []);

    // Fetch tenant currency config
    useEffect(() => {
        if (currentTenant?.tenant_id) {
            getCurrencyConfigAction(currentTenant.tenant_id, state.state.branchId ?? undefined).then((config) => {
                setCurrencyCode(config.currencyCode);
            }).catch(() => { /* keep default from ORDER_DEFAULTS */ });
        }
    }, [currentTenant?.tenant_id, state.state.branchId]);

    // Load categories and products
    const categoriesQuery = useCategories();
    const productsQuery = useProducts(state.state.selectedCategory);

    // Auto-select first service category when categories load
    useEffect(() => {
        const { categories, selectedCategory } = state.state;
        const firstCode = categories[0]?.service_category_code;
        if (categories.length > 0 && !selectedCategory && firstCode) {
            state.setSelectedCategory(firstCode);
        }
    }, [state.state.categories, state.state.selectedCategory, state]);

    // Handle category selection
    const handleSelectCategory = useCallback(
        (category: string) => {
            state.setSelectedCategory(category);
        },
        [state]
    );

    // Handle add item (retail vs services: cannot mix)
    const handleAddItem = useCallback(
        (product: Product) => {
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

            const newItem: OrderItem = {
                productId: product.id,
                productName: product.product_name,
                productName2: product.product_name2,
                quantity: 1,
                pricePerUnit,
                totalPrice: pricePerUnit,
                defaultSellPrice: product.default_sell_price ?? null,
                defaultExpressSellPrice: product.default_express_sell_price ?? null,
                serviceCategoryCode: product.service_category_code || undefined,
                pieces: trackByPiece
                    ? generatePiecesForItem(product.id, 1)
                    : undefined,
            };

            state.addItem(newItem);
            trackItemAddition();
        },
        [state, trackByPiece, trackItemAddition, t]
    );

    // Handle remove item
    const handleRemoveItem = useCallback(
        (productId: string) => {
            state.removeItem(productId);
        },
        [state]
    );

    // Handle quantity change
    const handleQuantityChange = useCallback(
        (productId: string, quantity: number) => {
            state.updateItemQuantity(productId, quantity);
        },
        [state]
    );

    // Handle pieces change
    const handlePiecesChange = useCallback(
        (itemId: string, pieces: PreSubmissionPiece[]) => {
            state.updateItemPieces(itemId, pieces);
        },
        [state]
    );

    // Handle submit order click
    const handleSubmitOrderClick = useCallback(() => {
        // Check for errors first
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
    }, [state, t, hasErrors, warnings]);

    // Handle navigation to order
    const handleNavigateToOrder = useCallback(() => {
        if (!state.state.createdOrderId) return;

        const status = state.state.createdOrderStatus;
        const orderId = state.state.createdOrderId;

        let route: string;
        if (status) {
            const statusLower = status.toLowerCase();
            if (statusLower === 'preparing' || statusLower === 'intake') {
                route = `/dashboard/preparation/${orderId}`;
            } else if (statusLower === 'processing') {
                route = `/dashboard/processing/${orderId}`;
            } else {
                route = `/dashboard/orders/${orderId}`;
            }
        } else {
            route = `/dashboard/orders/${orderId}`;
        }

        router.push(route);
        state.setCreatedOrder('', null);
    }, [state, router]);

    // Get navigation label
    const getNavigationLabel = useCallback(
        (status: string | null): string => {
            if (!status) return tWorkflow('newOrder.goToOrder') || 'Go to Order';

            const statusLower = status.toLowerCase();
            if (statusLower === 'preparing' || statusLower === 'intake') {
                return tWorkflow('newOrder.goToPreparation') || 'Go to Preparation';
            }
            if (statusLower === 'processing') {
                return tWorkflow('newOrder.goToProcessing') || 'Go to Processing';
            }
            return tWorkflow('newOrder.goToOrder') || 'Go to Order';
        },
        [tWorkflow]
    );

    // Add New Order: reset form, with confirmation when unsaved changes exist
    const handleAddNewOrder = useCallback(() => {
        if (state.state.createdOrderId) {
            state.resetOrder();
            clearSavedNotes?.();
            return;
        }
        const hasUnsaved =
            state.state.items.length > 0 ||
            (state.state.notes?.trim().length ?? 0) > 0 ||
            state.state.customer !== null;
        if (hasUnsaved) {
            setShowDiscardConfirm(true);
        } else {
            state.resetOrder();
        }
    }, [state, clearSavedNotes]);

    const handleConfirmDiscard = useCallback(() => {
        state.resetOrder();
        clearSavedNotes?.();
        setShowDiscardConfirm(false);
    }, [state, clearSavedNotes]);

    // Memoized order items for OrderSummaryPanel
    const memoizedOrderItems = useMemo(
        () =>
            state.state.items.map((item) => {
                const cat = state.state.categories.find(
                    (c) => c.service_category_code === item.serviceCategoryCode
                );
                return {
                    id: item.productId,
                    productId: item.productId,
                    productName: item.productName || 'Unknown Product',
                    productName2: item.productName2 || undefined,
                    quantity: item.quantity,
                    pricePerUnit: item.pricePerUnit,
                    totalPrice: item.totalPrice,
                    notes: item.notes,
                    pieces: item.pieces,
                    serviceCategoryCode: item.serviceCategoryCode,
                    serviceCategoryName: cat?.ctg_name ?? item.serviceCategoryCode ?? undefined,
                    serviceCategoryName2: cat?.ctg_name2 ?? undefined,
                    priceOverride: item.priceOverride,
                    overrideReason: item.overrideReason,
                };
            }),
        [state.state.items, state.state.categories]
    );

    // Get unique service categories from items
    const serviceCategories = useMemo(() => {
        return Array.from(
            new Set(
                state.state.items
                    .map((item) => item.serviceCategoryCode)
                    .filter(Boolean)
            )
        ) as string[];
    }, [state.state.items]);

    // Keyboard navigation
    useKeyboardNavigation({
        enabled: true,
        onKey: (key, event) => {
            // Ctrl/Cmd + S to submit order
            if (key === 's' && (event.ctrlKey || event.metaKey) && !isSubmitting && state.state.items.length > 0) {
                event.preventDefault();
                handleSubmitOrderClick();
                return;
            }

            // Alt + 1 / Alt + 2 to switch main tabs
            if (event.altKey && !event.ctrlKey && !event.metaKey) {
                if (key === '1') {
                    event.preventDefault();
                    setActiveTab('select');
                    return;
                }
                if (key === '2') {
                    event.preventDefault();
                    setActiveTab('details');
                    return;
                }
            }
        },
    });

    return (
        <div
            className="flex-1 min-h-0 overflow-hidden flex flex-col"
            role="main"
            aria-label={t('title') || 'New Order'}
        >
            {/* Screen reader live region for announcements */}
            <div
                aria-live="polite"
                aria-atomic="true"
                className="sr-only"
            >
                {state.state.items.length > 0 && (
                    <span>
                        {t('orderSummary.items', { count: state.state.items.length }) ||
                            `${state.state.items.length} items in order`}
                    </span>
                )}
            </div>

            <div className={`h-full min-h-0 flex ${isRTL ? 'flex-row-reverse' : ''}`}>
                {/* Left/Center Panel - Primary Content Area: categories fixed, Select Items scrollable */}
                <div className="flex-1 min-h-0 flex flex-col">
                    {/* Fixed at top: branch selector, then categories, then step tabs */}
                    <div className="flex-shrink-0 p-6 space-y-4">
                        {/* Branch Selector - at top */}
                        {branches.length > 0 && (
                            <div className={`flex flex-col gap-1 ${isRTL ? 'items-end' : 'items-start'}`}>
                                <div className={`flex items-center gap-3 w-full ${isRTL ? 'flex-row-reverse' : ''}`}>
                                    <label htmlFor="new-order-branch" className="text-sm font-medium text-gray-700 whitespace-nowrap">
                                        {tCommon('branch')} <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        id="new-order-branch"
                                        value={state.state.branchId ?? ''}
                                        onChange={(e) => state.setBranchId(e.target.value || null)}
                                        className={`flex-1 max-w-xs px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${!state.state.branchId && branches.length > 1 ? 'border-red-400 bg-red-50/50' : 'border-gray-300'} ${isRTL ? 'text-right' : 'text-left'}`}
                                        dir={isRTL ? 'rtl' : 'ltr'}
                                        required
                                        aria-required="true"
                                        aria-invalid={!state.state.branchId && branches.length > 1}
                                    >
                                        <option value="">{tCommon('selectBranch')}</option>
                                        {branches.map((b) => (
                                            <option key={b.id} value={b.id}>
                                                {isRTL ? (b.name2 || b.name) : b.name}
                                            </option>
                                        ))}
                                    </select>
                                    {branchesLoading && (
                                        <span className="text-xs text-gray-500">{tCommon('loading') || 'Loading...'}</span>
                                    )}
                                </div>
                                {branches.length > 1 && !state.state.branchId && (
                                    <p className="text-sm text-red-600" role="alert">
                                        {t('chooseBranch')}
                                    </p>
                                )}
                            </div>
                        )}
                        {/* Category Tabs - fixed at top when on Select Items */}
                        {activeTab === 'select' && (
                            <>
                                {state.state.categoriesLoading ? (
                                    <CategoryTabsSkeleton />
                                ) : (
                                    <CategoryTabs
                                        categories={state.state.categories}
                                        selectedCategory={state.state.selectedCategory}
                                        onSelectCategory={handleSelectCategory}
                                    />
                                )}
                            </>
                        )}

                        {/* Main Step Tabs: Select Items / Order Details */}
                        <div
                            className="bg-white rounded-lg border border-gray-200 p-2"
                            role="tablist"
                            aria-label={t('title') || 'New order steps'}
                        >
                            <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={activeTab === 'select'}
                                    aria-controls="new-order-select-items-panel"
                                    tabIndex={activeTab === 'select' ? 0 : -1}
                                    onClick={() => setActiveTab('select')}
                                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${activeTab === 'select'
                                            ? 'bg-blue-600 text-white shadow-md'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    1) {t('itemsGrid.selectItems') || 'Select Items'}
                                </button>
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={activeTab === 'details'}
                                    aria-controls="new-order-details-panel"
                                    tabIndex={activeTab === 'details' ? 0 : -1}
                                    onClick={() => setActiveTab('details')}
                                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${activeTab === 'details'
                                            ? 'bg-blue-600 text-white shadow-md'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    2) {t('itemsGrid.orderItems') || 'Order Items'} (
                                    {state.state.items.length})
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Scrollable: Select Items (product grid) or Order Details */}
                    <div
                        id={activeTab === 'select' ? 'new-order-select-items-panel' : 'new-order-details-panel'}
                        role="tabpanel"
                        aria-labelledby={activeTab === 'select' ? 'new-order-select-items-tab' : 'new-order-details-tab'}
                        className="flex-1 min-h-0 overflow-y-auto"
                    >
                        {activeTab === 'select' && (
                            <div className="p-6 pt-0">
                                {state.state.productsLoading ? (
                                    <ProductGridSkeleton />
                                ) : (
                                    <ProductGrid
                                        products={state.state.products}
                                        items={state.state.items}
                                        express={state.state.express}
                                        currencyCode={currencyCode}
                                        onAddItem={handleAddItem}
                                        onRemoveItem={handleRemoveItem}
                                        onQuantityChange={handleQuantityChange}
                                        onOpenCustomItemModal={() => {
                                            state.openModal('customItem');
                                            trackModalOpen('customItem');
                                        }}
                                        onOpenPhotoCapture={() => {
                                            state.openModal('photoCapture');
                                            trackModalOpen('photoCapture');
                                        }}
                                    />
                                )}
                            </div>
                        )}

                        {activeTab === 'details' && (
                            <div className="p-6 pt-0">
                                <OrderDetailsSection trackByPiece={trackByPiece} />
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Sidebar - Order Summary */}
                <div
                    className={`w-96 ${isRTL ? 'border-r' : 'border-l'
                        } border-gray-200 bg-white h-full flex flex-col overflow-hidden`}
                >
                    {/* Add New Order - compact link when not in post-creation state */}
                    {!state.state.createdOrderId && (
                        <div className={`flex-shrink-0 px-4 pt-3 pb-2 border-b border-gray-100 ${isRTL ? 'text-left' : 'text-right'}`}>
                            <button
                                type="button"
                                onClick={handleAddNewOrder}
                                className="text-sm text-blue-600 hover:text-blue-700 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded"
                                aria-label={t('addNewOrder')}
                            >
                                + {t('addNewOrder')}
                            </button>
                        </div>
                    )}
                    <OrderSummaryPanel
                        customerName={state.state.customerName}
                        onSelectCustomer={() => state.openModal('customerPicker')}
                        onEditCustomer={() => state.openModal('customerEdit')}
                        items={memoizedOrderItems}
                        onEditItem={(itemId) => {
                            state.openPriceOverrideModal(itemId);
                        }}
                        onDeleteItem={handleRemoveItem}
                        onPiecesChange={handlePiecesChange}
                        isQuickDrop={state.state.isQuickDrop}
                        onQuickDropToggle={state.setQuickDrop}
                        quickDropQuantity={state.state.quickDropQuantity}
                        onQuickDropQuantityChange={state.setQuickDropQuantity}
                        express={state.state.express}
                        onExpressToggle={state.setExpress}
                        notes={state.state.notes}
                        onNotesChange={state.setNotes}
                        readyByAt={state.state.readyByAt}
                        total={totals.subtotal}
                        onSubmit={handleSubmitOrderClick}
                        onOpenReadyByModal={() => state.openModal('readyBy')}
                        onCalculateReadyBy={async () => {
                            try {
                                const result = await calculateReadyBy();
                                if (result) {
                                    cmxMessage.success(t('success.readyByCalculated') || 'Ready-by date calculated successfully');
                                } else {
                                    cmxMessage.error(t('errors.failedToCalculateReadyBy') || 'Failed to calculate ready-by date');
                                }
                            } catch (error) {
                                console.error('Error calculating ready-by:', error);
                                cmxMessage.error(t('errors.failedToCalculateReadyBy') || 'Failed to calculate ready-by date');
                            }
                        }}
                        loading={state.state.loading || isSubmitting}
                        currencyCode={currencyCode}
                        trackByPiece={trackByPiece}
                        isRetailOnlyOrder={isRetailOnlyOrder}
                    />

                    {/* Post-creation: Add New Order + Go to Order */}
                    {state.state.createdOrderId && (
                        <div className={`p-4 border-t border-gray-200 bg-blue-50 space-y-2 ${isRTL ? 'space-y-reverse' : ''}`}>
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
            </div>

            {/* Discard changes confirmation when adding new order with unsaved data */}
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
        </div>
    );
}

