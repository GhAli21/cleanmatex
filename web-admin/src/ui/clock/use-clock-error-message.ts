'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { CLOCK_ERROR_MESSAGE_KEYS, type ClockErrorCode } from '@cmx/clock';

/** An API error body or a bare code. */
type ClockErrorLike = string | { code?: unknown; error?: unknown; messageKey?: unknown } | null | undefined;

function codeOf(value: ClockErrorLike): ClockErrorCode | null {
  const raw = typeof value === 'string' ? value : (value?.code ?? value?.error);
  return typeof raw === 'string' && raw in CLOCK_ERROR_MESSAGE_KEYS ? (raw as ClockErrorCode) : null;
}

/**
 * S6: the EN/AR text for a clock error from an API response (`ZONE_MISMATCH`,
 * `LOCAL_TIME_NONEXISTENT`, `LOCAL_TIME_AMBIGUOUS`, …). Returns null when the value is not a
 * clock error or the code is never shown to users, so the caller keeps its generic message.
 */
export function useClockErrorMessage(): (value: ClockErrorLike) => string | null {
  const t = useTranslations('clock');
  return useCallback(
    (value: ClockErrorLike) => {
      const code = codeOf(value);
      const key = code ? CLOCK_ERROR_MESSAGE_KEYS[code] : null;
      return key ? t(key.replace(/^clock\./, '')) : null;
    },
    [t],
  );
}
