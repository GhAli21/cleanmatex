/** Maps a failed UoM call to its translated `uom.errors.<code>` text (falls back to the generic one). */
import { UomApiError } from '../api/uom-api';

type Translate = ((key: string) => string) & { has: (key: string) => boolean };

/**
 * @param error what the API client threw
 * @param t translator for the `uom` namespace
 * @returns the text to show the user
 */
export function uomErrorText(error: unknown, t: Translate): string {
  const code = error instanceof UomApiError ? error.code : null;
  return code && t.has(`errors.${code}`) ? t(`errors.${code}`) : t('errors.GENERIC');
}
