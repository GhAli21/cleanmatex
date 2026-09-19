/**
 * Formats submit-order / update-order API failures for the cashier toast.
 *
 * Typed business codes must always show: translated (or humanized) text,
 * any server details, and the exact `[ERROR_CODE]`. A 500 without a code
 * stays on the generic server-error copy so we never leak stack traces.
 */

import { formatCodeLabel } from '@/lib/utils/format-code-label';
import { isStableErrorCode } from '@/lib/utils/business-error';

const EXTRA_DETAIL_KEYS = [
  'creditLimit',
  'currentBalance',
  'available',
  'productId',
  'minRedeemPoints',
  'pointsToRedeem',
  'monetaryAmount',
  'redeemRatePerPoint',
] as const;

/**
 * Resolve the machine code from a submit-order JSON body.
 * Prefers `errorCode`; falls back to `error` when it is itself a code.
 */
export function resolveSubmitErrorCode(json: Record<string, unknown>): string {
  if (typeof json.errorCode === 'string' && json.errorCode.trim()) {
    return json.errorCode.trim();
  }
  if (typeof json.error === 'string' && isStableErrorCode(json.error)) {
    return json.error;
  }
  return '';
}

/**
 * Merge `details` with known top-level extra fields from the API body.
 */
export function collectSubmitErrorDetails(
  json: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const collected: Record<string, unknown> = {};
  if (json.details && typeof json.details === 'object' && !Array.isArray(json.details)) {
    Object.assign(collected, json.details);
  }
  for (const key of EXTRA_DETAIL_KEYS) {
    if (json[key] !== undefined && json[key] !== null && json[key] !== '') {
      collected[key] = json[key];
    }
  }
  return Object.keys(collected).length > 0 ? collected : undefined;
}

function humanizeDetailKey(key: string): string {
  const fromCode = formatCodeLabel(key);
  if (fromCode !== key) return fromCode;
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Render details as `Label: value · Label: value` for the toast.
 */
export function formatErrorDetails(details: unknown): string {
  if (details == null || details === '') return '';
  if (typeof details === 'string') return details;
  if (typeof details !== 'object') return String(details);
  if (Array.isArray(details)) {
    return details
      .map((item) => (item == null ? '' : String(item)))
      .filter(Boolean)
      .join('; ');
  }

  return Object.entries(details as Record<string, unknown>)
    .filter(([, value]) => value != null && value !== '')
    .map(([key, value]) => {
      const label = humanizeDetailKey(key) || key;
      const rendered =
        typeof value === 'object' ? JSON.stringify(value) : String(value);
      return `${label}: ${rendered}`;
    })
    .join(' · ');
}

/**
 * Build the cashier-visible toast: text + details + `[CODE]`.
 */
export function formatSubmitErrorMessage(input: {
  message: string;
  errorCode?: string;
  details?: unknown;
}): string {
  const code =
    input.errorCode && isStableErrorCode(input.errorCode) ? input.errorCode : '';
  const detailsText = formatErrorDetails(input.details);
  return [input.message.trim(), detailsText, code ? `[${code}]` : '']
    .filter(Boolean)
    .join(' ');
}

/**
 * Pick the toast text for a failed submit response.
 *
 * Typed codes never collapse to the generic 500 copy — even when the HTTP
 * status is 500 (legacy allow-list miss).
 */
export function resolveSubmitToastMessage(input: {
  status: number;
  json: Record<string, unknown>;
  extractedText: string;
  translatedByCode: Record<string, string>;
  genericServerError: string;
  orderCreationFailed: string;
}): { errorCode: string; message: string } {
  const errorCode = resolveSubmitErrorCode(input.json);
  const details = collectSubmitErrorDetails(input.json);
  const translated = errorCode ? input.translatedByCode[errorCode] : undefined;
  const rawError = typeof input.json.error === 'string' ? input.json.error : '';
  const proseError =
    rawError && rawError !== errorCode && !isStableErrorCode(rawError)
      ? rawError
      : '';

  const isServerError = input.status >= 500;
  const fallback =
    translated ||
    proseError ||
    input.extractedText ||
    (errorCode ? formatCodeLabel(errorCode) : '') ||
    (isServerError && !errorCode
      ? input.genericServerError
      : input.orderCreationFailed);

  const message =
    isServerError && !errorCode
      ? input.genericServerError
      : formatSubmitErrorMessage({
          message: fallback,
          errorCode,
          details,
        });

  return { errorCode, message };
}
