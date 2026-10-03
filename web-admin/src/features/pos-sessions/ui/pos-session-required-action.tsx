'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { CmxButton } from '@ui/primitives';
import { cmxMessage } from '@ui/feedback';

import { useCSRFToken } from '@/lib/hooks/use-csrf-token';
import { postEnsureOwnPosSession } from '@features/pos-sessions/api/pos-session-api';
import type { PosSessionRequiredInfo } from '@features/pos-sessions/model/pos-session-required';

interface PosSessionRequiredActionProps {
  /** The refusal the finance write returned (see `readPosSessionRequired`). */
  info: PosSessionRequiredInfo;
  /** Stable per-attempt key so a double-click opens one session. */
  idempotencyKey: string;
  /** Where the request came from (audit trail), e.g. `customer_receipt`. */
  sourceChannel: string;
  /** Called after the session is open — clear the error and let the user retry. */
  onOpened: () => void | Promise<void>;
  className?: string;
}

/**
 * Inline recovery for a `POS_SESSION_REQUIRED` refusal: opens (or reuses) the user's own session
 * in one click, then hands control back so the user presses the screen's own action again. It
 * never retries the money write itself and never touches anything the user typed (no silent
 * money mutation). Shared by every finance screen that can be refused for a missing session.
 *
 * Without a known branch the action cannot open a session itself, so it is not rendered; the
 * refusal text already tells the user to open one from POS Sessions.
 */
export function PosSessionRequiredAction({
  info,
  idempotencyKey,
  sourceChannel,
  onOpened,
  className,
}: PosSessionRequiredActionProps) {
  const t = useTranslations('cashControl.posSessionRequired');
  const { token: csrfToken } = useCSRFToken();
  const [opening, setOpening] = useState(false);

  if (!info.branchId) return null;
  const branchId = info.branchId;

  const handleOpen = async () => {
    setOpening(true);
    try {
      await postEnsureOwnPosSession({
        csrfToken,
        branchId,
        idempotencyKey: `${idempotencyKey}:pos-session`,
        sourceChannel,
      });
      cmxMessage.success(t('opened'));
      await onOpened();
    } catch {
      cmxMessage.error(t('openFailed'));
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className={className}>
      <CmxButton type="button" variant="outline" loading={opening} disabled={opening} onClick={() => void handleOpen()}>
        {t('open')}
      </CmxButton>
    </div>
  );
}
