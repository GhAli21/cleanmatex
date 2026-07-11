/**
 * use-order-submission Hook
 * API submission with error handling
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
import { NEW_ORDER_PROMO_GIFT_DISABLED } from '@/lib/constants/order-checkout-flags';
import {
    routeServerErrorToGuard,
    type ServerErrorGuardRoute,
} from '../payment/domain/server-error-routing';

/**
 * A server submit rejection routed to its owning payment capability (Phase 5 —
 * server-error → capability-guard routing). `capability`/`reason` come from the
 * pure routing module; `message` is the already-localized infrastructure
 * message so the in-view guard and the toast name the same cause.
 */
export interface PaymentServerGuard extends ServerErrorGuardRoute {
    message: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_REGEX_V2 = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i;

function isValidBranchId(value: string | null | undefined): value is string {
  return true; //typeof value === 'string' && value.trim().length > 0 && UUID_REGEX_V2.test(value.trim());
}

const FIELD_LABELS: Record<string, string> = {
  readyByAt: 'Ready by date',
  customerId: 'Customer',
  customerEmail: 'Customer email',
  customerName: 'Customer name',
  customerMobile: 'Customer phone',
  branchId: 'Branch',
  notes: 'Notes',
  items: 'Order items',
  quantity: 'Quantity',
  pricePerUnit: 'Price',
  productId: 'Product',
};

type PosSessionEnsureResult = {
    type: 'CREATED' | 'CURRENT';
    session: { id: string };
};

async function ensurePosSessionForOrderEntry(input: {
    branchId: string;
    csrfToken: string | null;
    submitIdempotencyKey: string;
}): Promise<string> {
    const response = await fetch('/api/v1/pos-sessions/ensure-for-order-entry', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...getCSRFHeader(input.csrfToken),
        },
        credentials: 'include',
        body: JSON.stringify({
            branchId: input.branchId,
            idempotencyKey: `${input.submitIdempotencyKey}:pos-session`,
            sourceChannel: 'pos_order_entry',
        }),
    });

    const json = await response.json().catch(() => ({})) as {
        success?: boolean;
        data?: PosSessionEnsureResult;
        error?: string;
        errorCode?: string;
    };

    if (!response.ok || !json.success || !json.data?.session?.id) {
        const error = new Error(json.error || 'POS_SESSION_ENSURE_FAILED');
        Object.assign(error, { code: json.errorCode || 'POS_SESSION_ENSURE_FAILED' });
        throw error;
    }

    return json.data.session.id;
}

/**
 * Format API validation error into a readable message for the user
 * @param json
 * @param status
 */
function formatValidationErrorMessage(
  json: Record<string, unknown>,
  status?: number
): string {
  const baseError = (json.error as string) || (json.message as string);
  const details = json.details as Array<{ path?: (string | number)[]; message?: string }> | undefined;

  if (details && Array.isArray(details) && details.length > 0) {
    const lines = details.map((d) => {
      const pathParts = d.path ?? [];
      let pathStr = pathParts.length > 0
        ? pathParts
            .map((p) => (typeof p === 'number' ? `[${p}]` : `.${p}`))
            .join('')
            .replace(/^\./, '')
        : '';
      if (pathStr.match(/^items\[\d+\]/)) {
        const match = pathStr.match(/^items\[(\d+)\](?:\.(.+))?$/);
        const idx = match ? Number(match[1]) + 1 : 0;
        const sub = match?.[2];
        pathStr = sub ? `Item ${idx} (${FIELD_LABELS[sub] ?? sub})` : `Item ${idx}`;
      } else if (pathStr in FIELD_LABELS) {
        pathStr = FIELD_LABELS[pathStr];
      }
      const msg = d.message || '';
      return pathStr ? `${pathStr}: ${msg}` : msg;
    });
    return lines.length > 0 ? lines.join('. ') : baseError;
  }

  return baseError || (status ? `Request failed with status ${status}` : 'An error occurred');
}

/**
 * Hook to handle order submission
 */
export function useOrderSubmission() {
    const t = useTranslations('newOrder');
    const tWorkflow = useTranslations('workflow');
    const tEdit = useTranslations('orders.edit');
    const router = useRouter();
    const { currentTenant, user } = useAuth();
    const { trackByPiece, packingPerPieceEnabled } = useTenantSettingsWithDefaults(
        currentTenant?.tenant_id || ''
    );
    const { token: csrfToken } = useCSRFToken();
    const state = useNewOrderStateWithDispatch();
    const [isSubmitting, setIsSubmitting] = useState(false);
    // One key per submit session — stable across retries, reset after success.
    const idempotencyKeyRef = useRef<string>(crypto.randomUUID());
    const [amountMismatch, setAmountMismatch] = useState<{
        open: boolean;
        message?: string;
        differences?: AmountMismatchDifferences;
    }>({ open: false });
    // Server rejection routed to its owning capability — the payment modal
    // renders it as an in-view guard (cleared on the next attempt / modal open).
    const [serverGuard, setServerGuard] = useState<PaymentServerGuard | null>(null);
    const clearServerGuard = useCallback(() => setServerGuard(null), []);

    const submitOrder = useCallback(
        async (paymentData: PaymentFormData, payload?: NewOrderPaymentPayload) => {
            setIsSubmitting(true);
            state.setLoading(true);
            setServerGuard(null);

            // Check if we're in edit mode
            const isEditMode = state.state.isEditMode && state.state.editingOrderId;

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
                const sanitizedCustomerNotes = (state.state.customerNotes ?? state.state.notes)
                    ? sanitizeOrderNotes(state.state.customerNotes ?? state.state.notes)
                    : undefined;
                const sanitizedPaymentNotes = paymentData.paymentNotes?.trim()
                    ? sanitizeOrderNotes(paymentData.paymentNotes.trim())
                    : undefined;

                if (!payload?.totals) {
                    cmxMessage.error(t('payment.errors.invalidAmount'));
                    setIsSubmitting(false);
                    state.setLoading(false);
                    return;
                }

                // Validate branchId when present: must be a valid UUID
                if (state.state.branchId) {
                    if (!isValidBranchId(state.state.branchId)) {
                        const rawBranchId = state.state.branchId;
                        const debugContext = {
                            invalidBranchId: rawBranchId,
                            branchIdType: typeof rawBranchId,
                            branchIdLength: rawBranchId != null ? String(rawBranchId).length : undefined,
                            stack: new Error().stack,
                            context: {
                                customerId: state.state.customer?.id ?? null,
                                itemsCount: state.state.items.length,
                                paymentMethod: paymentData.paymentMethod,
                            },
                        };
                        console.error('[order-submission] Invalid branchId validation failed', debugContext);
                        cmxMessage.error(
                            t('errors.invalidBranchId', {
                                branchId: rawBranchId,
                                default: `Invalid branch selected. Wrong branchId: "${state.state.branchId}". Please choose a branch again.`,
                            })
                        );
                        setIsSubmitting(false);
                        state.setLoading(false);
                        return;
                    }
                }

                let posSessionId: string | undefined;
                if (!isEditMode) {
                    if (!state.state.branchId) {
                        cmxMessage.error(t('errors.selectBranch'));
                        setIsSubmitting(false);
                        state.setLoading(false);
                        return;
                    }

                    try {
                        posSessionId = await ensurePosSessionForOrderEntry({
                            branchId: state.state.branchId,
                            csrfToken,
                            submitIdempotencyKey: idempotencyKeyRef.current,
                        });
                    } catch (error) {
                        const code = error instanceof Error && 'code' in error
                            ? String((error as Error & { code?: string }).code)
                            : '';
                        const message =
                            code === 'POS_SESSION_BRANCH_CONFLICT'
                                ? t('errors.posSessionBranchConflict')
                                : code === 'POS_SESSION_OPEN_NOT_FOUND'
                                  ? t('errors.posSessionOpenNotFound')
                                  : code === 'POS_SESSION_TERMINAL_BRANCH_MISMATCH'
                                    ? t('errors.posSessionTerminalBranchMismatch')
                                    : error instanceof Error && error.message
                                      ? error.message
                                      : t('errors.posSessionEnsureFailed');
                        cmxMessage.error(message);
                        setIsSubmitting(false);
                        state.setLoading(false);
                        return;
                    }
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
                                ...(piece.colorCodes?.length ? { colorCodes: piece.colorCodes } : {}),
                                ...(piece.colorCfIds?.length ? { colorCfIds: piece.colorCfIds } : {}),
                                brand: piece.brand,
                                hasStain: piece.hasStain,
                                hasDamage: piece.hasDamage,
                                notes: piece.notes,
                                rackLocation: piece.rackLocation,
                                metadata: piece.metadata,
                                conditions: piece.conditions,
                                ...(packingPerPieceEnabled && piece.packingPrefCode && {
                                    packingPrefCode: piece.packingPrefCode,
                                    packingCfId: piece.packingCfId ?? null,
                                }),
                                ...(piece.servicePrefs && piece.servicePrefs.length > 0 && {
                                    servicePrefs: piece.servicePrefs,
                                }),
                            })),
                        }),
                        ...(item.servicePrefs && item.servicePrefs.length > 0 && {
                            servicePrefs: item.servicePrefs,
                        }),
                        servicePrefCharge: item.servicePrefCharge ?? 0,
                        ...(item.packingPrefCharge != null && { packingPrefCharge: item.packingPrefCharge }),
                        ...(item.packingPrefCode && {
                            packingPrefCode: item.packingPrefCode,
                            packingPrefIsOverride: item.packingPrefIsOverride,
                            packingPrefSource: item.packingPrefSource,
                            ...(item.packingCfId ? { packingCfId: item.packingCfId } : {}),
                        }),
                        ...(item.priceOverride != null && {
                            priceOverride: item.priceOverride,
                            overrideReason: item.overrideReason,
                            overrideBy: item.overrideBy,
                        }),
                    })),
                    isQuickDrop: state.state.isQuickDrop || false,
                    ...(state.state.isQuickDrop && state.state.quickDropQuantity > 0 && {
                        quickDropQuantity: state.state.quickDropQuantity,
                    }),
                    express: state.state.express || false,
                    customerNotes: sanitizedCustomerNotes,
                    paymentNotes: sanitizedPaymentNotes,
                    readyByAt: state.state.readyByAt,
                    paymentMethod: paymentData.paymentMethod,
                    percentDiscount: paymentData.percentDiscount ?? 0,
                    amountDiscount: paymentData.amountDiscount ?? 0,
                    /* Promo / gift — re-enable when NEW_ORDER_PROMO_GIFT_DISABLED is false (order-checkout-flags.ts) */
                    ...(NEW_ORDER_PROMO_GIFT_DISABLED
                        ? {}
                        : {
                              promoCode: paymentData.promoCode?.trim() || undefined,
                              ...(paymentData.promoCodeId?.trim() && {
                                  promoCodeId: paymentData.promoCodeId.trim(),
                              }),
                              giftCardNumber: paymentData.giftCardNumber?.trim() || undefined,
                              giftCardAmount: paymentData.giftCardAmount ?? 0,
                              ...(paymentData.giftCardId?.trim() && {
                                  giftCardId: paymentData.giftCardId.trim(),
                              }),
                          }),
                    promoDiscount: NEW_ORDER_PROMO_GIFT_DISABLED ? 0 : (payload.totals.promoDiscount ?? 0),
                    checkNumber: paymentData.checkNumber ? sanitizeInput(paymentData.checkNumber) : undefined,
                    checkBank: paymentData.checkBank ? sanitizeInput(paymentData.checkBank) : undefined,
                    checkDate: paymentData.checkDate,
                    ...(state.state.branchId && { branchId: state.state.branchId }),
                    ...((!payload.taxProfileIds || payload.taxProfileIds.length === 0) &&
                      (payload.totals.taxRate != null && payload.totals.taxRate > 0) && {
                        additionalTaxRate: payload.totals.taxRate,
                      }),
                    ...((!payload.taxProfileIds || payload.taxProfileIds.length === 0) &&
                      (payload.totals.taxAmount != null && payload.totals.taxAmount > 0) && {
                        additionalTaxAmount: payload.totals.taxAmount,
                      }),
                    ...(payload.taxProfileIds && payload.taxProfileIds.length > 0 && {
                        taxProfileIds: payload.taxProfileIds,
                    }),
                    customerMobile: state.state.customerSnapshotOverride?.phone != null
                        ? sanitizeInput(state.state.customerSnapshotOverride.phone)
                        : (state.state.customerMobile ? sanitizeInput(state.state.customerMobile) : undefined),
                    customerEmail: state.state.customerSnapshotOverride?.email != null
                        ? sanitizeInput(state.state.customerSnapshotOverride.email)
                        : (state.state.customerEmail ? sanitizeInput(state.state.customerEmail) : undefined),
                    customerName: state.state.customerSnapshotOverride?.name != null
                        ? sanitizeInput(state.state.customerSnapshotOverride.name)
                        : (state.state.customerNameSnapshot ? sanitizeInput(state.state.customerNameSnapshot) : undefined),
                    ...(state.state.isDefaultCustomer && { isDefaultCustomer: true }),
                    clientTotals: {
                        subtotal: payload.totals.subtotal,
                        manualDiscount: payload.totals.manualDiscount ?? 0,
                        promoDiscount: NEW_ORDER_PROMO_GIFT_DISABLED ? 0 : (payload.totals.promoDiscount ?? 0),
                        vatValue: payload.totals.vatValue,
                        saleTotal: payload.totals.saleTotal,
                    },
                    amountToCharge: payload.amountToCharge,
                    ...(payload.outstandingPolicy && {
                        outstandingPolicy: payload.outstandingPolicy,
                    }),
                    ...(payload.cashDrawerSessionId && {
                        cashDrawerSessionId: payload.cashDrawerSessionId,
                    }),
                    ...(posSessionId && {
                        posSessionId,
                    }),
                    ...(paymentData.b2bContractId && { b2bContractId: paymentData.b2bContractId }),
                    ...(paymentData.costCenterCode?.trim() && { costCenterCode: paymentData.costCenterCode.trim() }),
                    ...(paymentData.poNumber?.trim() && { poNumber: paymentData.poNumber.trim() }),
                    ...(payload.creditLimitOverride && { creditLimitOverride: true }),
                    ...(payload.paymentLegs && payload.paymentLegs.length > 0 && {
                        paymentLegs: payload.paymentLegs,
                    }),
                    ...(payload.overpaymentResolution && {
                        overpaymentResolution: payload.overpaymentResolution,
                    }),
                    idempotencyKey: idempotencyKeyRef.current,
                };

                const headers: Record<string, string> = {
                    'Content-Type': 'application/json',
                    ...getCSRFHeader(csrfToken),
                };

                // Edit mode: use update API instead of create
                let res: Response;
                if (isEditMode) {
                    const updateBody = {
                        customerId: state.state.customer?.id || '',
                        items: state.state.items.map((item) => ({
                            productId: item.productId,
                            productName: item.productName ?? undefined,
                            productName2: item.productName2 ?? undefined,
                            quantity: item.quantity,
                            pricePerUnit: item.pricePerUnit ?? 0,
                            totalPrice: item.totalPrice ?? 0,
                            serviceCategoryCode: item.serviceCategoryCode,
                            notes: item.notes ? sanitizeOrderNotes(item.notes) : undefined,
                            ...(trackByPiece && item.pieces && item.pieces.length > 0 && {
                                pieces: item.pieces.map((piece) => ({
                                    pieceSeq: piece.pieceSeq,
                                    color: piece.color,
                                    ...(piece.colorCodes?.length ? { colorCodes: piece.colorCodes } : {}),
                                    ...(piece.colorCfIds?.length ? { colorCfIds: piece.colorCfIds } : {}),
                                    brand: piece.brand,
                                    hasStain: piece.hasStain,
                                    hasDamage: piece.hasDamage,
                                    notes: piece.notes,
                                    rackLocation: piece.rackLocation,
                                    metadata: piece.metadata,
                                    conditions: piece.conditions,
                                    ...(packingPerPieceEnabled && piece.packingPrefCode && {
                                        packingPrefCode: piece.packingPrefCode,
                                        packingCfId: piece.packingCfId ?? null,
                                    }),
                                    ...(piece.servicePrefs && piece.servicePrefs.length > 0 && {
                                        servicePrefs: piece.servicePrefs,
                                    }),
                                })),
                            }),
                            priceOverride: item.priceOverride,
                            overrideReason: item.overrideReason,
                            overrideBy: item.overrideBy,
                            ...(item.servicePrefs && item.servicePrefs.length > 0 && {
                                servicePrefs: item.servicePrefs,
                            }),
                            servicePrefCharge: item.servicePrefCharge ?? 0,
                            ...(item.packingPrefCharge != null && { packingPrefCharge: item.packingPrefCharge }),
                            ...(item.packingPrefCode && {
                                packingPrefCode: item.packingPrefCode,
                                packingPrefIsOverride: item.packingPrefIsOverride,
                                packingPrefSource: item.packingPrefSource,
                                ...(item.packingCfId ? { packingCfId: item.packingCfId } : {}),
                            }),
                        })),
                        express: state.state.express || false,
                        notes: sanitizedNotes,
                        customerNotes: sanitizedCustomerNotes,
                        paymentNotes: sanitizedPaymentNotes,
                        readyByAt: state.state.readyByAt,
                        ...(state.state.branchId && { branchId: state.state.branchId }),
                        customerMobile: state.state.customerSnapshotOverride?.phone != null
                            ? sanitizeInput(state.state.customerSnapshotOverride.phone)
                            : (state.state.customerMobile ? sanitizeInput(state.state.customerMobile) : undefined),
                        customerEmail: state.state.customerSnapshotOverride?.email != null
                            ? sanitizeInput(state.state.customerSnapshotOverride.email)
                            : (state.state.customerEmail ? sanitizeInput(state.state.customerEmail) : undefined),
                        customerName: state.state.customerSnapshotOverride?.name != null
                            ? sanitizeInput(state.state.customerSnapshotOverride.name)
                            : (state.state.customerNameSnapshot ? sanitizeInput(state.state.customerNameSnapshot) : undefined),
                        expectedUpdatedAt: state.state.expectedUpdatedAt?.toISOString(),
                        recalculate: true,
                    };

                    res = await fetch(`/api/v1/orders/${state.state.editingOrderId}/update`, {
                        method: 'PATCH',
                        headers,
                        credentials: 'include',
                        body: JSON.stringify(updateBody),
                    });
                } else {
                    res = await fetch('/api/v1/orders/submit-order', {
                        method: 'POST',
                        headers,
                        credentials: 'include',
                        body: JSON.stringify(createWithPaymentBody),
                    });
                }

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
                    const isInfrastructureError = res.status === 422;
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
                            const details = json.details as Array<{
                                path?: string | string[];
                                message: string;
                            }>;
                            const checkDateDetail = details.find((detail) => {
                                const path = Array.isArray(detail.path)
                                    ? detail.path.join('.')
                                    : detail.path ?? '';
                                return path.includes('checkDate');
                            });
                            if (checkDateDetail) {
                                const reason = checkDateDetail.message;
                                if (reason === 'checkDateInvalid' || reason === 'checkDateInPast') {
                                    errorMessage = t(`payment.splitPayment.${reason}`);
                                } else {
                                    errorMessage = checkDateDetail.message;
                                }
                            } else {
                                const detailMessages = details
                                    .map(
                                        (d) => {
                                            const path = Array.isArray(d.path)
                                                ? d.path.join('.')
                                                : d.path;
                                            return `${path ? `${path}: ` : ''}${d.message}`;
                                        }
                                    )
                                    .join('; ');
                                errorMessage = errorMessage
                                    ? `${errorMessage} - ${detailMessages}`
                                    : detailMessages;
                            }
                        }
                        if (!errorMessage) {
                            errorMessage =
                                t('errors.orderCreationFailed') + ' - Validation failed';
                        }
                    } else if (isInfrastructureError) {
                        const errorCode = typeof json.errorCode === 'string' ? json.errorCode : '';
                        const infrastructureMessages: Record<string, string> = {
                            CASH_DRAWER_SESSION_REQUIRED: t('payment.cashDrawer.messages.sessionRequired'),
                            CASH_DRAWER_SESSION_SELECTION_REQUIRED: t('payment.cashDrawer.messages.selectionRequired'),
                            CASH_DRAWER_SESSION_CLOSED: t('payment.cashDrawer.messages.sessionClosed'),
                            CASH_TENDERED_REQUIRED: t('payment.messages.invalidAmount'),
                            CASH_TENDERED_LESS_THAN_AMOUNT: t('payment.messages.invalidAmount'),
                            CASH_CHANGE_NOT_ALLOWED: t('payment.messages.validationErrors'),
                            METHOD_OVERPAYMENT_NOT_ALLOWED: t('payment.messages.validationErrors'),
                            OVERPAYMENT_RESOLUTION_REQUIRED: t('payment.rightRail.requiredAction.overpaymentMessage', {
                                amount: '',
                                default: 'Extra receipt amount must be resolved before submitting.',
                            }),
                            OVERPAYMENT_RESOLUTION_MISMATCH: t('payment.validatePayment.requiredBeforeSubmit', {
                              default: 'Validate payment and choose what to do with the extra amount before submitting.',
                            }),
                            OVERPAYMENT_RESOLUTION_NOT_ALLOWED: t('payment.extraReceipt.allocation.manualBlockedReturn'),
                            RETURN_CHANGE_EXCEEDS_CAPACITY: t('payment.messages.validationErrors'),
                            RETURN_CHANGE_LEG_INVALID: t('payment.messages.validationErrors'),
                            RECEIPT_ALLOCATION_EXCESS_UNRESOLVED: t('payment.extraReceipt.allocation.manualRemaining', {
                              amount: '',
                              default: 'Still to allocate remaining excess before submitting.',
                            }),
                            CASH_TENDERED_ONLY_FOR_CASH: t('payment.messages.validationErrors'),
                            PAYMENT_REFERENCE_REQUIRED: t('payment.errors.paymentReferenceRequired'),
                            PAYMENT_TERMINAL_REQUIRED: t('payment.errors.paymentTerminalRequired'),
                            GATEWAY_NOT_CONFIGURED: t('errors.serverError', {
                                default: 'A payment service configuration issue prevented this order from being submitted.',
                            }),
                            OUTSTANDING_POLICY_REQUIRED: t('payment.errors.outstandingPolicyRequired'),
                            B2B_CREDIT_HOLD: t('payment.errors.b2bCreditHold'),
                            B2B_CREDIT_EXCEEDED: t('payment.errors.b2bCreditExceeded'),
                            SPLIT_AMOUNT_MISMATCH: t('payment.errors.splitAmountMismatch'),
                            DEFERRED_LEG_NOT_ALONE: t('payment.errors.deferredLegNotAlone'),
                            CHECK_NUMBER_REQUIRED: t('payment.splitPayment.validation.checkNumberRequired'),
                            CREDIT_REFERENCE_REQUIRED: t('payment.customerCredits.creditNoteRequired'),
                        };

                        errorMessage =
                            infrastructureMessages[errorCode] ||
                            errorMessage ||
                            t('errors.orderCreationFailed');

                        // Phase 5 (hardening #2): route the typed server code to its
                        // owning capability so the payment modal renders an in-view
                        // guard naming the same cause as this toast. Unknown codes
                        // return null → generic toast path only, never a view switch.
                        const guardRoute = routeServerErrorToGuard(errorCode);
                        if (guardRoute) {
                            setServerGuard({ ...guardRoute, message: errorMessage });
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

                // submit-order returns { order: {...}, voucher?, effects, warnings }
                // update-order returns flat { id, orderId, currentStatus, ... }
                const data = json.data as {
                    order?: { id: string; orderNo: string; currentStatus: string };
                    voucher?: { id: string; voucherNo: string; status: string; wiringStatus: string };
                    warnings?: string[];
                    // edit-mode update-order flat shape
                    id?: string;
                    orderId?: string;
                    currentStatus?: string;
                    status?: string;
                    orderNo?: string;
                    order_no?: string;
                };
                const orderId = data?.order?.id || data?.id || data?.orderId;
                const orderStatus = data?.order?.currentStatus || data?.currentStatus || data?.status;

                // Success - close payment modal, show success, reset
                state.closeModal('payment');
                if (orderId) {
                    state.setCreatedOrder(orderId, orderStatus || null);
                }
                const orderNo = data?.order?.orderNo || data?.orderNo || data?.order_no || state.state.editingOrderNo || '';

                // Show payment-status warnings from submit-order (PENDING/PROCESSING legs)
                if (!isEditMode && data?.warnings && data.warnings.length > 0) {
                    for (const warning of data.warnings) {
                        cmxMessage.info(t(`payment.warnings.${warning}` as Parameters<typeof t>[0], { default: warning }));
                    }
                }

                if (isEditMode) {
                    cmxMessage.success(
                        t('success.orderUpdated', { orderNo, default: `Order ${orderNo} updated successfully` })
                    );
                    // Exit edit mode and navigate back
                    state.dispatch({ type: 'EXIT_EDIT_MODE' });
                } else {
                    cmxMessage.success(
                        tWorkflow('newOrder.orderCreatedSuccess', { orderNo }) ||
                        t('success.orderCreated', { orderNo }) ||
                        `Order ${orderNo} created successfully`
                    );
                    if (data?.voucher) {
                        cmxMessage.info(
                            t('payment.voucherCreated', { voucherNo: data.voucher.voucherNo, default: `Receipt Voucher ${data.voucher.voucherNo} created` })
                        );
                    }
                    idempotencyKeyRef.current = crypto.randomUUID();
                    state.resetOrder();
                }
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
            packingPerPieceEnabled,
            csrfToken,
            currentTenant,
            user,
        ]
    );

    const saveOrderUpdate = useCallback(async () => {
        const isEditMode = state.state.isEditMode && state.state.editingOrderId;
        if (!isEditMode) return;

        setIsSubmitting(true);
        state.setLoading(true);

        try {
            const productIds = state.state.items.map((item) => item.productId);
            const invalidProductIds = validateProductIds(productIds);
            if (invalidProductIds.length > 0) {
                cmxMessage.error(t('errors.invalidProductIds'));
                setIsSubmitting(false);
                state.setLoading(false);
                return;
            }

            const sanitizedNotes = state.state.notes
                ? sanitizeOrderNotes(state.state.notes)
                : undefined;
            const sanitizedCustomerNotes = (state.state.customerNotes ?? state.state.notes)
                ? sanitizeOrderNotes(state.state.customerNotes ?? state.state.notes)
                : undefined;
            const sanitizedPaymentNotes = state.state.paymentNotes?.trim()
                ? sanitizeOrderNotes(state.state.paymentNotes.trim())
                : undefined;

            const updateBody = {
                customerId: state.state.customer?.id || '',
                items: state.state.items.map((item) => ({
                    productId: item.productId,
                    productName: item.productName ?? undefined,
                    productName2: item.productName2 ?? undefined,
                    quantity: item.quantity,
                    pricePerUnit: item.pricePerUnit ?? 0,
                    totalPrice: item.totalPrice ?? 0,
                    serviceCategoryCode: item.serviceCategoryCode,
                    notes: item.notes ? sanitizeOrderNotes(item.notes) : undefined,
                    ...(trackByPiece && item.pieces && item.pieces.length > 0 && {
                        pieces: item.pieces.map((piece) => ({
                            pieceSeq: piece.pieceSeq,
                            color: piece.color,
                            ...(piece.colorCodes?.length ? { colorCodes: piece.colorCodes } : {}),
                            ...(piece.colorCfIds?.length ? { colorCfIds: piece.colorCfIds } : {}),
                            brand: piece.brand,
                            hasStain: piece.hasStain,
                            hasDamage: piece.hasDamage,
                            notes: piece.notes,
                            rackLocation: piece.rackLocation,
                            metadata: piece.metadata,
                            conditions: piece.conditions,
                            ...(packingPerPieceEnabled && piece.packingPrefCode && {
                                packingPrefCode: piece.packingPrefCode,
                                packingCfId: piece.packingCfId ?? null,
                            }),
                            ...(piece.servicePrefs && piece.servicePrefs.length > 0 && {
                                servicePrefs: piece.servicePrefs,
                            }),
                        })),
                    }),
                    priceOverride: item.priceOverride,
                    overrideReason: item.overrideReason,
                    overrideBy: item.overrideBy,
                    ...(item.servicePrefs && item.servicePrefs.length > 0 && {
                        servicePrefs: item.servicePrefs,
                    }),
                    servicePrefCharge: item.servicePrefCharge ?? 0,
                    ...(item.packingPrefCharge != null && { packingPrefCharge: item.packingPrefCharge }),
                    ...(item.packingPrefCode && {
                        packingPrefCode: item.packingPrefCode,
                        packingPrefIsOverride: item.packingPrefIsOverride,
                        packingPrefSource: item.packingPrefSource,
                        ...(item.packingCfId ? { packingCfId: item.packingCfId } : {}),
                    }),
                })),
                express: state.state.express || false,
                notes: sanitizedNotes,
                customerNotes: sanitizedCustomerNotes,
                paymentNotes: sanitizedPaymentNotes,
                ...(state.state.readyByAt && { readyByAt: state.state.readyByAt }),
                ...(state.state.branchId && isValidBranchId(state.state.branchId) && { branchId: state.state.branchId }),
                customerMobile: state.state.customerSnapshotOverride?.phone != null
                    ? sanitizeInput(state.state.customerSnapshotOverride.phone)
                    : (state.state.customerMobile ? sanitizeInput(state.state.customerMobile) : undefined),
                customerEmail: state.state.customerSnapshotOverride?.email != null
                    ? sanitizeInput(state.state.customerSnapshotOverride.email)
                    : (state.state.customerEmail ? sanitizeInput(state.state.customerEmail) : undefined),
                customerName: state.state.customerSnapshotOverride?.name != null
                    ? sanitizeInput(state.state.customerSnapshotOverride.name)
                    : (state.state.customerNameSnapshot ? sanitizeInput(state.state.customerNameSnapshot) : undefined),
                expectedUpdatedAt: state.state.expectedUpdatedAt?.toISOString(),
                recalculate: true,
            };

            const res = await fetch(`/api/v1/orders/${state.state.editingOrderId}/update`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...getCSRFHeader(csrfToken),
                },
                credentials: 'include',
                body: JSON.stringify(updateBody),
            });

            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                const errorMessage = formatValidationErrorMessage(json, res.status);
                cmxMessage.error(errorMessage);
                setIsSubmitting(false);
                state.setLoading(false);
                return;
            }

            if (!json.success) {
                const errorMessage = formatValidationErrorMessage(json, res.status);
                cmxMessage.error(errorMessage);
                setIsSubmitting(false);
                state.setLoading(false);
                return;
            }

            const orderNo = (json.data?.order?.order_no ?? json.data?.order_no ?? state.state.editingOrderNo) || '';
            cmxMessage.success(tEdit('success') || t('success.orderUpdated', { orderNo }) || `Order ${orderNo} updated successfully`);

            // Update expectedUpdatedAt with the new updated_at from the server response
            // so optimistic locking works correctly if the user stays on the page
            const newUpdatedAt = json.data?.order?.updated_at;
            if (newUpdatedAt) {
                state.dispatch({ type: 'SET_EXPECTED_UPDATED_AT', payload: new Date(newUpdatedAt) });
            }

            // Navigate back to previous page after successful save
            router.back();
        } catch (err: unknown) {
            const error = err as Error;
            cmxMessage.error(error.message || t('errors.unknownError'));
        } finally {
            setIsSubmitting(false);
            state.setLoading(false);
        }
    }, [state, trackByPiece, packingPerPieceEnabled, csrfToken, t, tEdit, router]);

    return {
        submitOrder,
        saveOrderUpdate,
        isSubmitting,
        amountMismatch,
        setAmountMismatch,
        serverGuard,
        clearServerGuard,
    };
}
