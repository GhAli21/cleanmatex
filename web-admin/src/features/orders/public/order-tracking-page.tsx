'use client';

import { useEffect, useMemo, useState } from 'react';
import type { OrderFinancialView as OrderFinancialViewModel } from '@/lib/types/order-fin-view';
import { OrderFinancialView } from '@/src/features/orders/order-fin-view/ui/order-financial-view';
import { useLocale, useTranslations } from 'next-intl';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { formatMoneyAmountWithCode } from '@/lib/money/format-money';
import { normalizeOrderPaymentStatus } from '@/lib/utils/order-payment-status';
import type { LineQualifier } from '@/lib/orders/line-qualifier';
import { formatLineQualifier } from '@/lib/orders/line-qualifier-format';
import type { PublicClockBlock } from '@cmx/clock';
import { ClockProvider, CmxInstant } from '@ui/clock';

interface PublicOrderTotals {
    subtotal: number | null;
    total: number | null;
    paidAmount: number | null;
    paymentStatus: string | null;
    outstandingAmount: number | null;
    payOnCollectionAmount: number | null;
}

interface PublicOrderCustomer {
    name: string | null;
    name2: string | null;
    phone: string | null;
    email: string | null;
}

interface PublicOrderItem {
    id: string;
    name: string | null;
    name2: string | null;
    quantity: number;
    totalPrice: number;
    lineTotalAmount?: number | null;
    /** Measure, own speed and ordinal that tell same-name lines apart. */
    qualifier?: LineQualifier;
}

interface PublicOrderData {
    id: string;
    orderNo: string;
    status: string;
    priority: string | null;
    paymentTypeCode: string | null;
    receivedAt: string | null;
    readyBy: string | null;
    bagCount?: number | null;
    pickupAvailability?: {
        availableForPickup: boolean;
        releasedAt: string | null;
    };
    totals: PublicOrderTotals;
    customer: PublicOrderCustomer | null;
    items: PublicOrderItem[];
    customerNotes?: string | null;
}

interface PublicOrderTimelineEntry {
    id: string;
    type: string;
    from: string | null;
    to: string | null;
    doneAt: string;
}

interface PublicOrderTrackingPageProps {
    lookupPath: string;
    confirmPath: string;
    /** Public financial view route (P4-06); absent on retired paths, which then show no statement. */
    financialViewPath?: string;
}

interface PublicOrderMoneyConfig {
    currencyCode: string;
    decimalPlaces: number;
}

interface ApiResponse {
    success: boolean;
    data?: {
        order: PublicOrderData;
        timeline: PublicOrderTimelineEntry[];
        moneyConfig?: PublicOrderMoneyConfig;
        /** Shop zone and display preferences from the server (G1). Null: times are not shown. */
        clock?: PublicClockBlock | null;
    };
    error?: string;
}

interface ConfirmReceivedResponse {
    success: boolean;
    data?: {
        orderId?: string;
        orderNo?: string;
        status?: string;
        idempotent?: boolean;
    };
    error?: string;
}

/**
 *
 * @param root0
 * @param root0.lookupPath
 * @param root0.confirmPath
 */
export function PublicOrderTrackingPage({ lookupPath, confirmPath, financialViewPath }: PublicOrderTrackingPageProps) {
    const locale = useLocale();
    const { currencyCode: ctxCurrencyCode, decimalPlaces: ctxDecimalPlaces } = useTenantCurrency();
    const moneyLocale = locale === 'ar' ? 'ar' : 'en';
    const [moneyConfigFromApi, setMoneyConfigFromApi] = useState<PublicOrderMoneyConfig | null>(null);
    const fmt = useMemo(
        () => {
            const currencyCode = moneyConfigFromApi?.currencyCode ?? ctxCurrencyCode;
            const decimalPlaces = moneyConfigFromApi?.decimalPlaces ?? ctxDecimalPlaces;
            return (n: number) =>
                formatMoneyAmountWithCode(n, { currencyCode, decimalPlaces, locale: moneyLocale });
        },
        [moneyConfigFromApi, ctxCurrencyCode, ctxDecimalPlaces, moneyLocale],
    );
    const t = useTranslations('publicOrderTracking');
    const tCommon = useTranslations('common');
    const tOrders = useTranslations('orders');

    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [order, setOrder] = useState<PublicOrderData | null>(null);
    const [timeline, setTimeline] = useState<PublicOrderTimelineEntry[]>([]);
    const [clockBlock, setClockBlock] = useState<PublicClockBlock | null>(null);
    const [isConfirming, setIsConfirming] = useState(false);
    const [confirmSuccess, setConfirmSuccess] = useState<string | null>(null);
    // The customer-safe statement (P6-11): projected on the server, never computed here.
    const [financialView, setFinancialView] = useState<OrderFinancialViewModel | null>(null);
    useEffect(() => {
        if (!financialViewPath) return undefined;
        const abort = new AbortController();
        fetch(financialViewPath, { signal: abort.signal, cache: 'no-store', headers: { Accept: 'application/json' } })
            .then(async (res) => {
                const body = await res.json().catch(() => null) as { success?: boolean; data?: OrderFinancialViewModel } | null;
                if (res.ok && body?.success && body.data) setFinancialView(body.data);
            })
            // The statement is extra: without it the page still shows the order.
            .catch(() => undefined);
        return () => abort.abort();
    }, [financialViewPath, confirmSuccess]);

    useEffect(() => {
        let cancelled = false;

        async function loadOrder() {
            try {
                setLoading(true);
                setLoadError(null);
                setActionError(null);

                const response = await fetch(lookupPath, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                    },
                });

                const json: ApiResponse = await response.json();

                if (!response.ok || !json.success || !json.data) {
                    if (!cancelled) {
                        setLoadError(json.error || t('errors.notFound'));
                    }
                    return;
                }

                if (!cancelled) {
                    setOrder(json.data.order);
                    setTimeline(json.data.timeline || []);
                    setMoneyConfigFromApi(json.data.moneyConfig ?? null);
                    setClockBlock(json.data.clock ?? null);
                    setConfirmSuccess(null);
                }
            } catch (err) {
                if (!cancelled) {
                    setLoadError(t('errors.generic'));
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        loadOrder();

        return () => {
            cancelled = true;
        };
    }, [lookupPath, t]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                    <p className="text-sm text-muted-foreground">{tCommon('loading')}</p>
                </div>
            </div>
        );
    }

    if (loadError || !order) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted px-4">
                <div className="max-w-md w-full bg-card rounded-xl shadow-sm border border-border p-6 text-center">
                    <h1 className="text-lg font-semibold text-foreground mb-2">
                        {t('title')}
                    </h1>
                    <p className="text-sm text-muted-foreground mb-4">
                        {loadError || t('errors.notFound')}
                    </p>
                </div>
            </div>
        );
    }

    const isAvailableForPickup =
        order.status === 'ready_for_pickup' ||
        (order.status === 'ready' && order.pickupAvailability?.availableForPickup === true);
    const isAwaitingPickupRelease = order.status === 'ready' && !isAvailableForPickup;
    let statusLabel: string;
    if (isAvailableForPickup) {
        statusLabel = t('pickupAvailability.status');
    } else if (isAwaitingPickupRelease) {
        statusLabel = t('pickupAvailability.notAvailableStatus');
    } else {
        try {
            statusLabel = tOrders(`statuses.${order.status}` as any);
        } catch {
            statusLabel = order.status.replaceAll('_', ' ').toUpperCase();
        }
    }

    const normalizedPaymentStatus = normalizeOrderPaymentStatus(order.totals.paymentStatus, {
        paymentTypeCode: order.paymentTypeCode,
        outstandingAmount: order.totals.outstandingAmount,
        payOnCollectionAmount: order.totals.payOnCollectionAmount,
    });
    const isPaymentSettled =
        normalizedPaymentStatus === 'PAID' ||
        normalizedPaymentStatus === 'OVERPAID';
    const paymentLabel =
        isPaymentSettled
            ? tOrders('paid')
            : tOrders('pendingPayment');
    // The balance as the server states it; never total minus paid in the browser.
    const remainingCollectionAmount = Math.max(
        0,
        financialView?.header.metrics.balance
        ?? order.totals.payOnCollectionAmount
        ?? order.totals.outstandingAmount
        ?? 0,
    );
    const showPayOnCollectionNotice =
        order.paymentTypeCode === 'PAY_ON_COLLECTION' &&
        !isPaymentSettled &&
        remainingCollectionAmount > 0;

    // Times are painted in the shop zone from the server `clock` block, never the device zone.
    const shopZone = clockBlock?.zone ?? null;
    const formattedReceivedAt = order.receivedAt ? <CmxInstant value={order.receivedAt} zone={shopZone} /> : null;

    const formattedReadyBy = order.readyBy ? <CmxInstant value={order.readyBy} zone={shopZone} /> : null;

    const canConfirmReceived =
        (isAvailableForPickup && !showPayOnCollectionNotice) ||
        order.status === 'out_for_delivery' ||
        order.status === 'delivered';
    const isConfirmReceivedDisabled =
        isConfirming ||
        order.status === 'delivered';
    const confirmButtonLabel = isConfirming
        ? t('actions.confirmingReceived')
        : order.status === 'delivered'
            ? t('actions.confirmReceivedDone')
            : t('actions.confirmReceived');

    async function handleConfirmReceived() {
        if (isConfirmReceivedDisabled) {
            return;
        }

        try {
            setIsConfirming(true);
            setConfirmSuccess(null);
            setActionError(null);

            const response = await fetch(
                confirmPath,
                {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                    },
                },
            );

            const json: ConfirmReceivedResponse = await response.json();

            if (!response.ok || !json.success) {
                setActionError(json.error || t('errors.generic'));
                return;
            }

            const nextStatus = String(json.data?.status ?? 'delivered').trim().toLowerCase();
            setOrder((currentOrder) => (
                currentOrder
                    ? {
                        ...currentOrder,
                        status: nextStatus,
                    }
                    : currentOrder
            ));
            setConfirmSuccess(t('actions.confirmReceivedSuccess'));
        } catch {
            setActionError(t('errors.generic'));
        } finally {
            setIsConfirming(false);
        }
    }

    return (
        // The shop clock block: zone, hour cycle and date format from the server (S4).
        <ClockProvider block={clockBlock}>
        <div className="min-h-screen bg-muted px-4 py-6">
            <div className="max-w-2xl mx-auto space-y-4">
                {/* Header */}
                <header className="space-y-2">
                    <p
                        className="text-xs uppercase tracking-wide text-primary-text text-start"
                    >
                        {t('brandSubtitle')}
                    </p>
                    <h1
                        className="text-2xl font-bold text-foreground text-start"
                    >
                        {t('title')}
                    </h1>
                    <p
                        className="text-sm text-muted-foreground text-start"
                    >
                        {t('description')}
                    </p>
                </header>

                {/* Order summary card */}
                <section className="bg-card rounded-xl shadow-sm border border-border p-4 space-y-3">
                    <div
                        className="flex items-start justify-between"
                    >
                        <div className="text-start">
                            <p className="text-xs text-muted-foreground">
                                {t('orderNumberLabel')}
                            </p>
                            <p className="text-xl font-semibold text-foreground">
                                {order.orderNo}
                            </p>
                            {formattedReceivedAt && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {t('receivedAtLabel')}: {formattedReceivedAt}
                                </p>
                            )}
                        </div>
                        <div className="text-end">
                            <span className="inline-flex items-center rounded-full bg-info-bg text-info-text text-xs font-medium px-3 py-1 border border-info-border">
                                {statusLabel}
                            </span>
                            {formattedReadyBy && (
                                <p className="mt-2 text-xs text-muted-foreground">
                                    {t('readyByLabel')}: {formattedReadyBy}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-3">
                        <div className="bg-muted rounded-lg px-3 py-2">
                            <p className="text-xs text-muted-foreground">
                                {t('totalAmountLabel')}
                            </p>
                            <p className="text-sm font-semibold text-foreground">
                                {fmt(order.totals.total ?? 0)}
                            </p>
                            <p className="text-xs text-success-text mt-1">{paymentLabel}</p>
                        </div>
                        <div className="bg-muted rounded-lg px-3 py-2">
                            <p className="text-xs text-muted-foreground">
                                {t('itemsCountLabel')}
                            </p>
                            <p className="text-sm font-semibold text-foreground">
                                {order.items.reduce((sum, item) => sum + (item.quantity || 0), 0)}
                            </p>
                        </div>
                    </div>

                    {financialView && (
                        <OrderFinancialView source={{ kind: 'data', view: financialView }} config={{ preset: 'public', layout: 'plain', density: 'compact', columns: 1 }} />
                    )}

                    {isAvailableForPickup && (
                        <div className="rounded-lg border border-success-border bg-success-bg px-3 py-2">
                            <p className="text-xs font-medium text-success-text">
                                {t('pickupAvailability.title')}
                            </p>
                            <p className="mt-1 text-xs text-success-text">
                                {t('pickupAvailability.description')}
                            </p>
                        </div>
                    )}

                    {showPayOnCollectionNotice && (
                        <div className="rounded-lg border border-warning-border bg-warning-bg px-3 py-2">
                            <p className="text-xs font-medium text-warning-text">
                                {t('paymentNotice.title')}
                            </p>
                            <p className="mt-1 text-xs text-warning-text">
                                {t('paymentNotice.description', {
                                    status: statusLabel,
                                    amount: fmt(remainingCollectionAmount),
                                })}
                            </p>
                        </div>
                    )}

                    {canConfirmReceived && (
                        <div className="mt-3 flex flex-col gap-2">
                            <button
                                type="button"
                                onClick={handleConfirmReceived}
                                disabled={isConfirmReceivedDisabled}
                                className="inline-flex justify-center items-center rounded-full bg-primary text-primary-foreground text-sm font-medium px-4 py-2 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {confirmButtonLabel}
                            </button>
                            {confirmSuccess && (
                                <p className="text-xs text-success-text">
                                    {confirmSuccess}
                                </p>
                            )}
                            {actionError && (
                                <p className="text-xs text-danger-text">
                                    {actionError}
                                </p>
                            )}
                        </div>
                    )}
                </section>

                {/* Customer info */}
                {order.customer && (
                    <section className="bg-card rounded-xl shadow-sm border border-border p-4 space-y-2">
                        <h2
                            className="text-sm font-semibold text-foreground text-start"
                        >
                            {t('customerSection.title')}
                        </h2>
                        <div className="space-y-1">
                            {order.customer.name && (
                                <p
                                    className="text-sm text-foreground text-start"
                                >
                                    {order.customer.name}
                                </p>
                            )}
                            {order.customer.phone && (
                                <p
                                    className="text-xs text-muted-foreground text-start"
                                >
                                    {order.customer.phone}
                                </p>
                            )}
                        </div>
                    </section>
                )}

                {/* Items list */}
                <section className="bg-card rounded-xl shadow-sm border border-border p-4 space-y-2">
                    <h2
                        className="text-sm font-semibold text-foreground text-start"
                    >
                        {t('itemsSection.title')}
                    </h2>
                    {order.items.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                            {t('itemsSection.empty')}
                        </p>
                    ) : (
                        <ul className="divide-y divide-border">
                            {order.items.map((item) => (
                                <li key={item.id} className="py-2 flex items-center justify-between">
                                    <div
                                        className="flex flex-col items-start text-start"
                                    >
                                        <span className="text-sm font-medium text-foreground">
                                            {item.name || t('itemsSection.unnamedItem')}
                                        </span>
                                        {item.name2 && (
                                            <span className="text-xs text-muted-foreground">
                                                {item.name2}
                                            </span>
                                        )}
                                        {formatLineQualifier(item.qualifier, { locale: locale === 'ar' ? 'ar' : 'en' }) && (
                                            <span className="text-xs text-muted-foreground tabular-nums">
                                                {formatLineQualifier(item.qualifier, { locale: locale === 'ar' ? 'ar' : 'en' })}
                                            </span>
                                        )}
                                    </div>
                                    <div
                                        className="flex flex-col items-end text-end"
                                    >
                                        <span className="text-xs text-muted-foreground">
                                            {t('itemsSection.quantityLabel', {
                                                quantity: item.quantity,
                                            })}
                                        </span>
                                        <span className="text-xs font-medium text-foreground">
                                            {fmt(item.lineTotalAmount ?? item.totalPrice)}
                                        </span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                {/* Timeline */}
                {timeline.length > 0 && (
                    <section className="bg-card rounded-xl shadow-sm border border-border p-4 space-y-3">
                        <h2
                            className="text-sm font-semibold text-foreground text-start"
                        >
                            {t('timelineSection.title')}
                        </h2>
                        <ol className="space-y-2 text-xs text-muted-foreground">
                            {timeline.map((entry) => (
                                <li key={entry.id} className="flex items-start gap-2">
                                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                                    <div
                                        className="flex-1 text-start"
                                    >
                                        <p className="font-medium text-foreground">
                                            {entry.type}
                                        </p>
                                        <p className="text-muted-foreground">
                                            <CmxInstant value={entry.doneAt} zone={shopZone} />
                                        </p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </section>
                )}

                {/* Notes */}
                {order.customerNotes && (
                    <section className="bg-card rounded-xl shadow-sm border border-border p-4">
                        <h2
                            className="text-sm font-semibold text-foreground mb-1 text-start"
                        >
                            {t('notesSection.title')}
                        </h2>
                        <p
                            className="text-xs text-muted-foreground whitespace-pre-line text-start"
                        >
                            {order.customerNotes}
                        </p>
                    </section>
                )}

                <footer className="pt-2 pb-4">
                    <p className="text-[11px] text-muted-foreground text-center">
                        {t('footer')}
                    </p>
                </footer>
            </div>
        </div>
        </ClockProvider>
    );
}


