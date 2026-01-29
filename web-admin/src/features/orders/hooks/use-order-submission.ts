/**
 * use-order-submission Hook
 * API submission with error handling
 */

'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useNewOrderStateWithDispatch } from './use-new-order-state';
import { useCSRFToken, getCSRFHeader } from '@/lib/hooks/use-csrf-token';
import { useWorkflowSystemMode } from '@/lib/config/workflow-config';
import { useTenantSettingsWithDefaults } from '@/lib/hooks/useTenantSettings';
import { useAuth } from '@/lib/auth/auth-context';
import { cmxMessage } from '@ui/feedback';
import { validateProductIds } from '@/lib/utils/validation-helpers';
import { sanitizeOrderNotes, sanitizeInput, sanitizeNumber } from '@/lib/utils/security-helpers';
import type { PaymentFormData } from '../model/payment-form-schema';

/**
 * Hook to handle order submission
 */
export function useOrderSubmission() {
    const t = useTranslations('newOrder');
    const tWorkflow = useTranslations('workflow');
    const router = useRouter();
    const { currentTenant } = useAuth();
    const useNewWorkflowSystem = useWorkflowSystemMode();
    const { trackByPiece } = useTenantSettingsWithDefaults(
        currentTenant?.tenant_id || ''
    );
    const { token: csrfToken } = useCSRFToken();
    const state = useNewOrderStateWithDispatch();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const submitOrder = useCallback(
        async (paymentData: PaymentFormData) => {
            setIsSubmitting(true);
            state.setLoading(true);
            const submissionStartTime = performance.now();

            try {
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

                // Prepare request body with payment data
                const requestBody = {
                    customerId: state.state.customer?.id || '',
                    orderTypeId: 'POS',
                    items: state.state.items.map((item) => ({
                        productId: item.productId,
                        quantity: item.quantity,
                        pricePerUnit: item.pricePerUnit,
                        totalPrice: item.totalPrice,
                        serviceCategoryCode: item.serviceCategoryCode,
                        notes: item.notes ? sanitizeOrderNotes(item.notes) : undefined,
                        // Include piece-level data if trackByPiece is enabled and pieces exist
                        ...(trackByPiece &&
                            item.pieces &&
                            item.pieces.length > 0 && {
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
                    ...(state.state.isQuickDrop &&
                        state.state.quickDropQuantity > 0 && {
                        quickDropQuantity: state.state.quickDropQuantity,
                    }),
                    express: state.state.express || false,
                    priority: state.state.express ? 'express' : 'normal',
                    ...(sanitizedNotes && { customerNotes: sanitizedNotes }),
                    ...(state.state.readyByAt && { readyByAt: state.state.readyByAt }),
                    useOldWfCodeOrNew: !useNewWorkflowSystem,
                    // Payment data (sanitize check number if provided)
                    paymentMethod: paymentData.paymentMethod,
                    ...(paymentData.checkNumber && {
                        checkNumber: sanitizeInput(paymentData.checkNumber),
                    }),
                    ...(paymentData.percentDiscount > 0 && {
                        percentDiscount: paymentData.percentDiscount,
                    }),
                    ...(paymentData.amountDiscount > 0 && {
                        amountDiscount: paymentData.amountDiscount,
                    }),
                    ...(paymentData.promoCode && {
                        promoCode: paymentData.promoCode,
                        promoCodeId: paymentData.promoCodeId,
                        promoDiscount: paymentData.promoDiscount,
                    }),
                    ...(paymentData.giftCardNumber && {
                        giftCardNumber: paymentData.giftCardNumber,
                        giftCardAmount: paymentData.giftCardAmount,
                    }),
                    payAllOrders: paymentData.payAllOrders,
                };

                // Include CSRF token in headers
                const headers: Record<string, string> = {
                    'Content-Type': 'application/json',
                    ...getCSRFHeader(csrfToken),
                };

                const res = await fetch('/api/v1/orders', {
                    method: 'POST',
                    headers,
                    credentials: 'include',
                    body: JSON.stringify(requestBody),
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

                // Success - close payment modal
                state.closeModal('payment');

                // Store created order info
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

                if (orderId) {
                    state.setCreatedOrder(orderId, orderStatus || null);
                }

                // Show success message
                const orderNo = data?.orderNo || data?.order_no || '';
                cmxMessage.success(
                    tWorkflow('newOrder.orderCreatedSuccess', { orderNo }) ||
                    t('success.orderCreated', { orderNo }) ||
                    `Order ${orderNo} created successfully`
                );

                // Reset order (keep categories and products)
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
            useNewWorkflowSystem,
            csrfToken,
        ]
    );

    return {
        submitOrder,
        isSubmitting,
    };
}

