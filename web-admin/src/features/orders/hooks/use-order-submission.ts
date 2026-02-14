/**
 * use-order-submission Hook
 * API submission with error handling
 */

'use client';

import { useState, useCallback } from 'react';
import type { AmountMismatchDifferences } from '@/lib/types/payment';
import { useTranslations } from 'next-intl';
import { useNewOrderStateWithDispatch } from './use-new-order-state';
import { useCSRFToken, getCSRFHeader } from '@/lib/hooks/use-csrf-token';
import { useTenantSettingsWithDefaults } from '@/lib/hooks/useTenantSettings';
import { useAuth } from '@/lib/auth/auth-context';
import { cmxMessage } from '@ui/feedback';
import { validateProductIds } from '@/lib/utils/validation-helpers';
import { sanitizeOrderNotes, sanitizeInput } from '@/lib/utils/security-helpers';
import type { PaymentFormData } from '../model/payment-form-schema';
import type { NewOrderPaymentPayload } from '@/lib/validations/new-order-payment-schemas';
import { newOrderPaymentPayloadSchema } from '@/lib/validations/new-order-payment-schemas';
import { PAYMENT_METHODS } from '@/lib/constants/order-types';

/**
 * Hook to handle order submission
 */
export function useOrderSubmission() {
    const t = useTranslations('newOrder');
    const tWorkflow = useTranslations('workflow');
    const { currentTenant, user } = useAuth();
    const { trackByPiece } = useTenantSettingsWithDefaults(
        currentTenant?.tenant_id || ''
    );
    const { token: csrfToken } = useCSRFToken();
    const state = useNewOrderStateWithDispatch();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [amountMismatch, setAmountMismatch] = useState<{
        open: boolean;
        message?: string;
        differences?: AmountMismatchDifferences;
    }>({ open: false });

    const submitOrder = useCallback(
        async (paymentData: PaymentFormData, payload?: NewOrderPaymentPayload) => {
            setIsSubmitting(true);
            state.setLoading(true);

            try {
                // Validate extended payload when provided (invoice or cash/card/check flow)
                if (payload) {
                    const parsed = newOrderPaymentPayloadSchema.safeParse(payload);
                    if (!parsed.success) {
                        const first = parsed.error.issues[0];
                        cmxMessage.error(first ? `${first.path.join('.')}: ${first.message}` : t('payment.errors.invalidAmount'));
                        setIsSubmitting(false);
                        state.setLoading(false);
                        return;
                    }
                    payload = parsed.data;
                }

                // Retail orders: PAY_ON_COLLECTION not allowed (must pay at POS)
                const isRetailOnly = state.state.items.length > 0
                    && state.state.items.every((i) => i.serviceCategoryCode === 'RETAIL_ITEMS');
                if (isRetailOnly && paymentData.paymentMethod === PAYMENT_METHODS.PAY_ON_COLLECTION) {
                    cmxMessage.error(t('errors.retailPayOnCollection'));
                    setIsSubmitting(false);
                    state.setLoading(false);
                    return;
                }

                // Validate all product IDs are UUIDs
                const productIds = state.state.items.map((item) => item.productId);
                const invalidProductIds = validateProductIds(productIds);

                if (invalidProductIds.length > 0) {
                    cmxMessage.error(t('errors.invalidProductIds'));
                    setIsSubmitting(false);
                    state.setLoading(false);
                    return;
                }

                // Sanitize order notes before submission
                const sanitizedNotes = state.state.notes
                    ? sanitizeOrderNotes(state.state.notes)
                    : undefined;

                if (!payload?.totals) {
                    cmxMessage.error(t('payment.errors.invalidAmount'));
                    setIsSubmitting(false);
                    state.setLoading(false);
                    return;
                }

                const createWithPaymentBody = {
                    customerId: state.state.customer?.id || '',
                    orderTypeId: 'POS',
                    items: state.state.items.map((item) => ({
                        productId: item.productId,
                        productName: item.productName ?? undefined,
                        productName2: item.productName2 ?? undefined,
                        quantity: item.quantity,
                        pricePerUnit: item.pricePerUnit ?? 0,
                        totalPrice: item.totalPrice ?? 0,
                        serviceCategoryCode: item.serviceCategoryCode,
                        notes: item.notes ? sanitizeOrderNotes(item.notes) : undefined,
                        hasStain: item.hasStain,
                        hasDamage: item.hasDamage,
                        stainNotes: item.stainNotes,
                        damageNotes: item.damageNotes,
                        ...(trackByPiece && item.pieces && item.pieces.length > 0 && {
                            pieces: item.pieces.map((piece) => ({
                                pieceSeq: piece.pieceSeq,
                                color: piece.color,
                                brand: piece.brand,
                                hasStain: piece.hasStain,
                                hasDamage: piece.hasDamage,
                                notes: piece.notes,
                                rackLocation: piece.rackLocation,
                                metadata: piece.metadata,
                            })),
                        }),
                    })),
                    isQuickDrop: state.state.isQuickDrop || false,
                    ...(state.state.isQuickDrop && state.state.quickDropQuantity > 0 && {
                        quickDropQuantity: state.state.quickDropQuantity,
                    }),
                    express: state.state.express || false,
                    customerNotes: sanitizedNotes,
                    readyByAt: state.state.readyByAt,
                    paymentMethod: paymentData.paymentMethod,
                    percentDiscount: paymentData.percentDiscount ?? 0,
                    amountDiscount: paymentData.amountDiscount ?? 0,
                    promoCode: paymentData.promoCode?.trim() || undefined,
                    ...(paymentData.promoCodeId?.trim() && { promoCodeId: paymentData.promoCodeId.trim() }),
                    promoDiscount: payload.totals.promoDiscount ?? 0,
                    giftCardNumber: paymentData.giftCardNumber?.trim() || undefined,
                    giftCardAmount: paymentData.giftCardAmount ?? 0,
                    ...(paymentData.giftCardId?.trim() && { giftCardId: paymentData.giftCardId.trim() }),
                    checkNumber: paymentData.checkNumber ? sanitizeInput(paymentData.checkNumber) : undefined,
                    checkBank: paymentData.checkBank ? sanitizeInput(paymentData.checkBank) : undefined,
                    checkDate: paymentData.checkDate,
                    ...(state.state.branchId && { branchId: state.state.branchId }),
                    ...((payload.totals.taxRate != null && payload.totals.taxRate > 0) && { additionalTaxRate: payload.totals.taxRate }),
                    ...((payload.totals.taxAmount != null && payload.totals.taxAmount > 0) && { additionalTaxAmount: payload.totals.taxAmount }),
                    clientTotals: {
                        subtotal: payload.totals.subtotal,
                        manualDiscount: payload.totals.manualDiscount ?? 0,
                        promoDiscount: payload.totals.promoDiscount ?? 0,
                        vatValue: payload.totals.vatValue,
                        finalTotal: payload.totals.finalTotal,
                    },
                };

                const headers: Record<string, string> = {
                    'Content-Type': 'application/json',
                    ...getCSRFHeader(csrfToken),
                };

                const res = await fetch('/api/v1/orders/create-with-payment', {
                    method: 'POST',
                    headers,
                    credentials: 'include',
                    body: JSON.stringify(createWithPaymentBody),
                });

                // Handle error responses
                if (!res.ok) {
                    let errorMessage = '';
                    let json: Record<string, unknown> = {};

                    try {
                        const responseText = await res.text();
                        if (responseText) {
                            try {
                                json = JSON.parse(responseText) as Record<string, unknown>;
                            } catch {
                                errorMessage =
                                    responseText || `Server returned ${res.status} ${res.statusText}`;
                            }
                        }
                    } catch {
                        errorMessage = `Server returned ${res.status} ${res.statusText}`;
                    }

                    // AMOUNT_MISMATCH: show dialog, do not persist anything
                    if (json.errorCode === 'AMOUNT_MISMATCH') {
                        setAmountMismatch({
                            open: true,
                            message: (json.error as string) ?? undefined,
                            differences: json.differences as AmountMismatchDifferences | undefined,
                        });
                        setIsSubmitting(false);
                        state.setLoading(false);
                        return;
                    }

                    // Extract error message
                    if (!errorMessage) {
                        if (json.error && typeof json.error === 'string') {
                            errorMessage = json.error;
                        } else if (json.message && typeof json.message === 'string') {
                            errorMessage = json.message;
                        } else if (
                            typeof json.error === 'object' &&
                            json.error !== null
                        ) {
                            errorMessage =
                                (json.error as { message?: string }).message ||
                                JSON.stringify(json.error);
                        }
                    }

                    // Determine error type
                    const isPermissionError = res.status === 403;
                    const isValidationError = res.status === 400;
                    const isServerError = res.status >= 500;

                    // Format error messages
                    if (isPermissionError) {
                        const permissionMatch = errorMessage.match(
                            /Permission denied:\s*([^\s]+)/i
                        );
                        const permission = permissionMatch
                            ? permissionMatch[1]
                            : 'orders:create';
                        errorMessage = t('errors.permissionDenied', {
                            permission,
                            default: `You don't have permission to create orders. Please contact your administrator to grant you the "${permission}" permission.`,
                        });
                    } else if (isValidationError) {
                        if (
                            json.details &&
                            Array.isArray(json.details) &&
                            json.details.length > 0
                        ) {
                            const detailMessages = (json.details as Array<{
                                path?: string;
                                message: string;
                            }>)
                                .map(
                                    (d) => `${d.path ? `${d.path}: ` : ''}${d.message}`
                                )
                                .join('; ');
                            errorMessage = errorMessage
                                ? `${errorMessage} - ${detailMessages}`
                                : detailMessages;
                        }
                        if (!errorMessage) {
                            errorMessage =
                                t('errors.orderCreationFailed') + ' - Validation failed';
                        }
                    } else if (isServerError) {
                        errorMessage = t('errors.serverError', {
                            default:
                                'A server error occurred. Please try again later or contact support if the problem persists.',
                        });
                    } else {
                        errorMessage =
                            errorMessage ||
                            t('errors.orderCreationFailed') ||
                            `Request failed with status ${res.status}`;
                    }

                    cmxMessage.error(errorMessage);
                    setIsSubmitting(false);
                    state.setLoading(false);
                    return;
                }

                // Parse success response
                let json: Record<string, unknown> = {};
                try {
                    const responseText = await res.text();
                    json = responseText ? (JSON.parse(responseText) as Record<string, unknown>) : {};
                } catch {
                    cmxMessage.error(
                        t('errors.orderCreationFailed') || 'Failed to parse server response'
                    );
                    setIsSubmitting(false);
                    state.setLoading(false);
                    return;
                }

                // Check if response indicates failure
                if (!json.success) {
                    const errorMessage =
                        (json.error as string) ||
                        t('errors.orderCreationFailed') ||
                        'Order creation failed';
                    cmxMessage.error(errorMessage);
                    setIsSubmitting(false);
                    state.setLoading(false);
                    return;
                }

                const data = json.data as {
                    id?: string;
                    orderId?: string;
                    currentStatus?: string;
                    status?: string;
                    orderNo?: string;
                    order_no?: string;
                };
                const orderId = data?.id || data?.orderId;
                const orderStatus = data?.currentStatus || data?.status;

                // Order + invoice + payment created atomically by create-with-payment API
                // Success - close payment modal, show success, reset
                state.closeModal('payment');
                if (orderId) {
                    state.setCreatedOrder(orderId, orderStatus || null);
                }
                const orderNo = data?.orderNo || data?.order_no || '';
                cmxMessage.success(
                    tWorkflow('newOrder.orderCreatedSuccess', { orderNo }) ||
                    t('success.orderCreated', { orderNo }) ||
                    `Order ${orderNo} created successfully`
                );
                state.resetOrder();
            } catch (err: unknown) {
                const error = err as Error;
                let errorMessage = error.message || t('errors.unknownError');

                // Handle specific error types
                if (
                    error.message.includes('fetch') ||
                    error.message.includes('network') ||
                    error.message.includes('Failed to fetch')
                ) {
                    errorMessage = t('errors.networkError', {
                        default:
                            'Network error. Please check your internet connection and try again.',
                    });
                } else if (
                    error.message.includes('timeout') ||
                    error.message.includes('aborted')
                ) {
                    errorMessage = t('errors.timeoutError', {
                        default: 'Request timed out. Please try again.',
                    });
                } else if (error.message.toLowerCase().includes('permission denied')) {
                    const permissionMatch = error.message.match(
                        /Permission denied:\s*([^\s]+)/i
                    );
                    const permission = permissionMatch ? permissionMatch[1] : 'orders:create';
                    errorMessage = t('errors.permissionDenied', {
                        permission,
                        default: `You don't have permission to create orders. Please contact your administrator to grant you the "${permission}" permission.`,
                    });
                }

                cmxMessage.error(errorMessage);
            } finally {
                setIsSubmitting(false);
                state.setLoading(false);
            }
        },
        [
            t,
            tWorkflow,
            state,
            trackByPiece,
            csrfToken,
            currentTenant,
            user,
        ]
    );

    return {
        submitOrder,
        isSubmitting,
        amountMismatch,
        setAmountMismatch,
    };
}

