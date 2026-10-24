import { getCSRFHeader } from '@/lib/hooks/use-csrf-token';
import type { PaymentQuoteData, PaymentQuoteRequest, PaymentQuoteResponse } from '@/lib/types/payment-quote';

/** A recoverable quote failure, kept structured for localized financial feedback. */
export class PaymentQuoteError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'PaymentQuoteError';
  }
}

/** Restricts response traversal to JSON records before reading monetary fields. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Rejects NaN/infinity and negative payable values without rounding server authority. */
function isMoney(value: unknown, signed = false): value is number {
  return typeof value === 'number' && Number.isFinite(value) && (signed || value >= 0);
}

/** Accepts optional bilingual labels without interpreting absent data as a new label. */
function isNullableString(value: unknown): boolean {
  return value === null || typeof value === 'string';
}

/** Checks the wire shape while allowing organization-defined payment method codes. */
function isSettlementOption(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return ['id', 'payment_method_code', 'payment_nature', 'display_name'].every((key) => typeof value[key] === 'string' && value[key].length > 0) &&
    ['gateway_code', 'display_name2', 'description', 'description2'].every((key) => isNullableString(value[key])) &&
    ['requires_cash_drawer', 'requires_terminal', 'supports_overpayment', 'supports_change_return', 'requires_reference', 'allowed_in_pos'].every((key) => typeof value[key] === 'boolean') &&
    ['allowed_for_pay_now', 'allowed_for_pay_on_collection', 'allowed_for_invoice_payment'].every((key) => value[key] === undefined || value[key] === null || typeof value[key] === 'boolean') &&
    (value.available_balance === undefined || value.available_balance === null || isMoney(value.available_balance)) &&
    (value.credit_application_type === undefined || isNullableString(value.credit_application_type)) &&
    (value.requires_credit_reference_selection === undefined || typeof value.requires_credit_reference_selection === 'boolean') &&
    (value.display_order === undefined || value.display_order === null || isMoney(value.display_order, true));
}

/** Validates authorized balance metadata separately from payable amounts (balances can be signed). */
function isStoredValueSummary(value: unknown): boolean {
  if (value === null) return true;
  if (!isRecord(value) || !isRecord(value.wallet) || !isRecord(value.advance)) return false;
  const loyalty = value.loyalty;
  return isNullableString(value.wallet.walletId) && isMoney(value.wallet.balance, true) && isNullableString(value.wallet.currencyCode) &&
    isNullableString(value.advance.advanceId) && isMoney(value.advance.balance, true) && isNullableString(value.advance.currencyCode) &&
    isMoney(value.creditNoteTotal) && Array.isArray(value.creditNotes) && value.creditNotes.every((note: unknown) =>
      isRecord(note) && typeof note.id === 'string' && isMoney(note.remaining_balance) && typeof note.currency_code === 'string') &&
    (loyalty === undefined || (isRecord(loyalty) &&
      ['pointsBalance', 'availableValue', 'expiredUnappliedPoints', 'redeemRatePerPoint'].every((key) => isMoney(loyalty[key]))));
}

/**
 * Rejects incomplete authority before any financial value reaches a money field.
 * This validates transport shape; eligibility and financial arithmetic remain server-owned.
 */
function isPaymentQuoteData(value: unknown, requestId: string): value is PaymentQuoteData {
  if (!isRecord(value) || value.requestId !== requestId || typeof value.currencyCode !== 'string' ||
    value.currencyCode.trim() !== value.currencyCode || !value.currencyCode ||
    typeof value.decimalPlaces !== 'number' || !Number.isInteger(value.decimalPlaces) || value.decimalPlaces < 0 || value.decimalPlaces > 6 ||
    !isMoney(value.currencyExRate) || value.currencyExRate <= 0) return false;
  if (!['subtotal', 'manualDiscount', 'autoRuleDiscount', 'promoDiscount', 'afterDiscounts', 'additionalTaxAmount', 'vatValue', 'giftCardApplied', 'saleTotal', 'vatTaxPercent'].every((key) => isMoney(value[key])) ||
    (value.chargesTotal !== undefined && !isMoney(value.chargesTotal)) ||
    (value.roundingAdjustmentAmount !== undefined && !isMoney(value.roundingAdjustmentAmount, true)) ||
    (value.taxPricingMode !== undefined && value.taxPricingMode !== 'TAX_INCLUSIVE' && value.taxPricingMode !== 'TAX_EXCLUSIVE')) return false;
  if (!Array.isArray(value.taxProfileEntries) || !value.taxProfileEntries.every((profile: unknown) =>
    isRecord(profile) && typeof profile.id === 'string' && typeof profile.name === 'string' && isNullableString(profile.name2) &&
    typeof profile.tax_type === 'string' && isMoney(profile.rate) && typeof profile.is_compound === 'boolean' && typeof profile.enabled === 'boolean')) return false;
  if (!Array.isArray(value.taxBreakdown) || !value.taxBreakdown.every((line: unknown) =>
    isRecord(line) && ['VAT', 'GST', 'CUSTOM'].includes(String(line.taxType)) && typeof line.label === 'string' && isNullableString(line.label2) &&
    ['rate', 'baseAmount', 'taxAmount'].every((key) => isMoney(line[key])) && typeof line.isCompound === 'boolean' &&
    (line.profileId === undefined || typeof line.profileId === 'string'))) return false;
  if (value.creditLimit !== undefined && (!isRecord(value.creditLimit) || !isMoney(value.creditLimit.currentBalance, true) ||
    !isMoney(value.creditLimit.creditLimit) || !isMoney(value.creditLimit.available, true) || typeof value.creditLimit.wouldExceed !== 'boolean' ||
    (value.creditLimit.mode !== undefined && value.creditLimit.mode !== 'warn' && value.creditLimit.mode !== 'block'))) return false;
  return isRecord(value.checkoutOptions) && Array.isArray(value.checkoutOptions.paymentMethods) && value.checkoutOptions.paymentMethods.every(isSettlementOption) &&
    Array.isArray(value.checkoutOptions.customerCredits) && value.checkoutOptions.customerCredits.every(isSettlementOption) && isStoredValueSummary(value.storedValueSummary);
}

/**
 * Reads a non-posting payment quote with cancellation and a bounded deadline.
 * Authentication supplies tenant/user scope; the body never selects either.
 * @param request - Financial inputs and response correlation token.
 * @param csrfToken - Session token protecting the authenticated POST.
 * @param signal - Query cancellation signal for superseded or closed dialogs.
 * @returns One authoritative financial and eligibility snapshot.
 * @throws {PaymentQuoteError} When configuration, eligibility, or the deadline fails.
 */
export async function fetchOrderPaymentQuote(
  request: PaymentQuoteRequest,
  csrfToken: string | null | undefined,
  signal: AbortSignal,
): Promise<PaymentQuoteData> {
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) controller.abort();
  // Match the existing settings-client deadline; failed financial reads require Retry.
  const deadline = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 30_000);
  try {
    const response = await fetch('/api/v1/orders/payment-quote', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...getCSRFHeader(csrfToken) },
      body: JSON.stringify(request),
      signal: controller.signal,
      cache: 'no-store',
    });
    const result = await response.json() as PaymentQuoteResponse;
    if (response.status === 401) throw new PaymentQuoteError('PAYMENT_CONTEXT_UNAVAILABLE');
    if (!response.ok || !result.success) {
      throw new PaymentQuoteError('errorCode' in result ? result.errorCode ?? 'PAYMENT_QUOTE_UNAVAILABLE' : 'PAYMENT_QUOTE_UNAVAILABLE');
    }
    const data = result.data;
    if (!isPaymentQuoteData(data, request.requestId)) throw new PaymentQuoteError('PAYMENT_QUOTE_INVALID');
    return data;
  } catch (error) {
    if (timedOut) throw new PaymentQuoteError('PAYMENT_QUOTE_TIMEOUT');
    throw error;
  } finally {
    clearTimeout(deadline);
    signal.removeEventListener('abort', abort);
  }
}

/**
 * Loads payment metadata without treating transport failure as an empty catalog.
 * @param path - Existing payment-settings endpoint.
 * @param signal - Cancellation supplied by the tenant/cashier-scoped query.
 * @returns The successful metadata rows; an empty array means a verified empty catalog.
 */
export async function fetchPaymentMetadata<T>(path: string, signal: AbortSignal): Promise<T[]> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) controller.abort();
  // Metadata must recover with Retry under the same deadline as the quote.
  const deadline = setTimeout(abort, 30_000);
  try {
    const response = await fetch(path, { signal: controller.signal });
    const result = await response.json() as { success?: boolean; data?: T[] };
    if (!response.ok || result.success === false || !Array.isArray(result.data)) {
      throw new PaymentQuoteError('PAYMENT_METADATA_UNAVAILABLE');
    }
    return result.data;
  } finally {
    clearTimeout(deadline);
    signal.removeEventListener('abort', abort);
  }
}
