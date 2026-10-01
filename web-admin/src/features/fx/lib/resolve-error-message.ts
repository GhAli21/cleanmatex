import { FX_ERROR, type FxErrorCode } from '@/lib/services/fx/fx-errors';

const KNOWN_CODES: ReadonlySet<string> = new Set(Object.values(FX_ERROR));

/**
 * Maps a server action's `errorCode` (an `FX_ERROR` code) to its
 * `currencyFx.errors.<CODE>` translation, falling back to the raw message
 * (or a generic one) for anything unrecognized — never calls the
 * translator with an unknown key.
 */
export function resolveFxErrorMessage(
  tErrors: (key: FxErrorCode) => string,
  errorCode: string | undefined,
  fallback: string
): string {
  if (errorCode && KNOWN_CODES.has(errorCode)) {
    return tErrors(errorCode as FxErrorCode);
  }
  return fallback;
}
