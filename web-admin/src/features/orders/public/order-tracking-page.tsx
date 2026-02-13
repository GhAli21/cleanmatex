'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';

interface PublicOrderTotals {
    subtotal: number | null;
    total: number | null;
    paidAmount: number | null;
    paymentStatus: string | null;
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
}

interface PublicOrderData {
    id: string;
    orderNo: string;
    status: string;
    priority: string | null;
    receivedAt: string | null;
    readyBy: string | null;
    bagCount?: number | null;
    rackLocation?: string | null;
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
    tenantId: string;
    orderNo: string;
}

interface ApiResponse {
    success: boolean;
    data?: {
        order: PublicOrderData;
        timeline: PublicOrderTimelineEntry[];
    };
    error?: string;
}

export function PublicOrderTrackingPage({ tenantId, orderNo }: PublicOrderTrackingPageProps) {
    const isRTL = useRTL();
    const t = useTranslations('publicOrderTracking');
    const tCommon = useTranslations('common');
    const tOrders = useTranslations('orders');

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [order, setOrder] = useState<PublicOrderData | null>(null);
    const [timeline, setTimeline] = useState<PublicOrderTimelineEntry[]>([]);
    const [isConfirming, setIsConfirming] = useState(false);
    const [confirmSuccess, setConfirmSuccess] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function loadOrder() {
            try {
                setLoading(true);
                setError(null);

                const response = await fetch(`/api/v1/public/orders/${encodeURIComponent(tenantId)}/${encodeURIComponent(orderNo)}`, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                    },
                });

                const json: ApiResponse = await response.json();

                if (!response.ok || !json.success || !json.data) {
                    if (!cancelled) {
                        setError(json.error || t('errors.notFound'));
                    }
                    return;
                }

                if (!cancelled) {
                    setOrder(json.data.order);
                    setTimeline(json.data.timeline || []);
                    setConfirmSuccess(null);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(t('errors.generic'));
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
    }, [tenantId, orderNo, t]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-10 w-10 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
                    <p className="text-sm text-slate-600">{tCommon('loading')}</p>
                </div>
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
                <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200 p-6 text-center">
                    <h1 className="text-lg font-semibold text-slate-900 mb-2">
                        {t('title')}
                    </h1>
                    <p className="text-sm text-slate-600 mb-4">
                        {error || t('errors.notFound')}
                    </p>
                </div>
            </div>
        );
    }

    let statusLabel: string;
    try {
        statusLabel = tOrders(`statuses.${order.status}` as any);
    } catch {
        statusLabel = order.status.replace('_', ' ').toUpperCase();
    }

    const paymentLabel =
        order.totals.paymentStatus === 'paid'
            ? tOrders('paid')
            : tOrders('pendingPayment');

    const formattedReceivedAt = order.receivedAt
        ? new Date(order.receivedAt).toLocaleString()
        : null;

    const formattedReadyBy = order.readyBy
        ? new Date(order.readyBy).toLocaleString()
        : null;

    const canConfirmReceived =
        order.status === 'ready' ||
        order.status === 'out_for_delivery' ||
        order.status === 'delivered';

    async function handleConfirmReceived() {
        try {
            setIsConfirming(true);
            setConfirmSuccess(null);
            setError(null);

            const response = await fetch(
                `/api/v1/public/orders/${encodeURIComponent(tenantId)}/${encodeURIComponent(orderNo)}/confirm-received`,
                {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                    },
                },
            );

            const json: ApiResponse = await response.json();

            if (!response.ok || !json.success) {
                setError(json.error || t('errors.generic'));
                return;
            }

            setConfirmSuccess(t('actions.confirmReceivedSuccess'));
        } catch {
            setError(t('errors.generic'));
        } finally {
            setIsConfirming(false);
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 px-4 py-6">
            <div className="max-w-2xl mx-auto space-y-4">
                {/* Header */}
                <header className="space-y-2">
                    <p
                        className={`text-xs uppercase tracking-wide text-blue-600 ${isRTL ? 'text-right' : 'text-left'
                            }`}
                    >
                        {t('brandSubtitle')}
                    </p>
                    <h1
                        className={`text-2xl font-bold text-slate-900 ${isRTL ? 'text-right' : 'text-left'
                            }`}
                    >
                        {t('title')}
                    </h1>
                    <p
                        className={`text-sm text-slate-600 ${isRTL ? 'text-right' : 'text-left'
                            }`}
                    >
                        {t('description')}
                    </p>
                </header>

                {/* Order summary card */}
                <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
                    <div
                        className={`flex items-start justify-between ${isRTL ? 'flex-row-reverse' : ''
                            }`}
                    >
                        <div className={isRTL ? 'text-right' : 'text-left'}>
                            <p className="text-xs text-slate-500">
                                {t('orderNumberLabel')}
                            </p>
                            <p className="text-xl font-semibold text-slate-900">
                                {order.orderNo}
                            </p>
                            {formattedReceivedAt && (
                                <p className="mt-1 text-xs text-slate-500">
                                    {t('receivedAtLabel')}: {formattedReceivedAt}
                                </p>
                            )}
                        </div>
                        <div className={isRTL ? 'text-left' : 'text-right'}>
                            <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 text-xs font-medium px-3 py-1 border border-blue-100">
                                {statusLabel}
                            </span>
                            {formattedReadyBy && (
                                <p className="mt-2 text-xs text-slate-500">
                                    {t('readyByLabel')}: {formattedReadyBy}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-3">
                        <div className="bg-slate-50 rounded-lg px-3 py-2">
                            <p className="text-xs text-slate-500">
                                {t('totalAmountLabel')}
                            </p>
                            <p className="text-sm font-semibold text-slate-900">
                                {(order.totals.total ?? 0).toFixed(3)} OMR
                            </p>
                            <p className="text-xs text-emerald-700 mt-1">{paymentLabel}</p>
                        </div>
                        <div className="bg-slate-50 rounded-lg px-3 py-2">
                            <p className="text-xs text-slate-500">
                                {t('itemsCountLabel')}
                            </p>
                            <p className="text-sm font-semibold text-slate-900">
                                {order.items.reduce((sum, item) => sum + (item.quantity || 0), 0)}
                            </p>
                        </div>
                    </div>

                    {canConfirmReceived && (
                        <div className="mt-3 flex flex-col gap-2">
                            <button
                                type="button"
                                onClick={handleConfirmReceived}
                                disabled={isConfirming}
                                className="inline-flex justify-center items-center rounded-full bg-blue-600 text-white text-sm font-medium px-4 py-2 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {isConfirming ? t('actions.confirmingReceived') : t('actions.confirmReceived')}
                            </button>
                            {confirmSuccess && (
                                <p className="text-xs text-emerald-700">
                                    {confirmSuccess}
                                </p>
                            )}
                            {error && (
                                <p className="text-xs text-red-600">
                                    {error}
                                </p>
                            )}
                        </div>
                    )}
                </section>

                {/* Customer info */}
                {order.customer && (
                    <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-2">
                        <h2
                            className={`text-sm font-semibold text-slate-900 ${isRTL ? 'text-right' : 'text-left'
                                }`}
                        >
                            {t('customerSection.title')}
                        </h2>
                        <div className="space-y-1">
                            {order.customer.name && (
                                <p
                                    className={`text-sm text-slate-900 ${isRTL ? 'text-right' : 'text-left'
                                        }`}
                                >
                                    {order.customer.name}
                                </p>
                            )}
                            {order.customer.phone && (
                                <p
                                    className={`text-xs text-slate-600 ${isRTL ? 'text-right' : 'text-left'
                                        }`}
                                >
                                    {order.customer.phone}
                                </p>
                            )}
                        </div>
                    </section>
                )}

                {/* Items list */}
                <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-2">
                    <h2
                        className={`text-sm font-semibold text-slate-900 ${isRTL ? 'text-right' : 'text-left'
                            }`}
                    >
                        {t('itemsSection.title')}
                    </h2>
                    {order.items.length === 0 ? (
                        <p className="text-xs text-slate-500">
                            {t('itemsSection.empty')}
                        </p>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {order.items.map((item) => (
                                <li key={item.id} className="py-2 flex items-center justify-between">
                                    <div
                                        className={`flex flex-col ${isRTL ? 'items-end text-right' : 'items-start text-left'
                                            }`}
                                    >
                                        <span className="text-sm font-medium text-slate-900">
                                            {item.name || t('itemsSection.unnamedItem')}
                                        </span>
                                        {item.name2 && (
                                            <span className="text-xs text-slate-500">
                                                {item.name2}
                                            </span>
                                        )}
                                    </div>
                                    <div
                                        className={`flex flex-col items-end ${isRTL ? 'text-left' : 'text-right'
                                            }`}
                                    >
                                        <span className="text-xs text-slate-500">
                                            {t('itemsSection.quantityLabel', {
                                                quantity: item.quantity,
                                            })}
                                        </span>
                                        <span className="text-xs font-medium text-slate-900">
                                            {item.totalPrice.toFixed(3)} OMR
                                        </span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                {/* Timeline */}
                {timeline.length > 0 && (
                    <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
                        <h2
                            className={`text-sm font-semibold text-slate-900 ${isRTL ? 'text-right' : 'text-left'
                                }`}
                        >
                            {t('timelineSection.title')}
                        </h2>
                        <ol className="space-y-2 text-xs text-slate-600">
                            {timeline.map((entry) => (
                                <li key={entry.id} className="flex items-start gap-2">
                                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500" />
                                    <div
                                        className={`flex-1 ${isRTL ? 'text-right' : 'text-left'
                                            }`}
                                    >
                                        <p className="font-medium text-slate-800">
                                            {entry.type}
                                        </p>
                                        <p className="text-slate-500">
                                            {new Date(entry.doneAt).toLocaleString()}
                                        </p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </section>
                )}

                {/* Notes */}
                {order.customerNotes && (
                    <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                        <h2
                            className={`text-sm font-semibold text-slate-900 mb-1 ${isRTL ? 'text-right' : 'text-left'
                                }`}
                        >
                            {t('notesSection.title')}
                        </h2>
                        <p
                            className={`text-xs text-slate-600 whitespace-pre-line ${isRTL ? 'text-right' : 'text-left'
                                }`}
                        >
                            {order.customerNotes}
                        </p>
                    </section>
                )}

                <footer className="pt-2 pb-4">
                    <p className="text-[11px] text-slate-400 text-center">
                        {t('footer')}
                    </p>
                </footer>
            </div>
        </div>
    );
}


