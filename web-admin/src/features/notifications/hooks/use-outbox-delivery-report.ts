'use client';

import { useCallback } from 'react';
import { cmxMessage } from '@ui/feedback';
import { waitForOutboxDelivery } from '../api/outbox-status-api';

/** Already-translated texts for the three outcomes of a send. */
export interface OutboxDeliveryMessages {
  sent: string;
  failed: string;
  /** Still sending after 15 s. */
  pending: string;
}

/**
 * Returns a function that follows a queued message and reports its outcome through cmxMessage.
 * The caller does not wait for it; the screen stays usable while the message is sent.
 */
export function useOutboxDeliveryReport() {
  return useCallback(async (outboxId: string, messages: OutboxDeliveryMessages): Promise<void> => {
    const outcome = await waitForOutboxDelivery(outboxId);
    if (outcome === 'SENT') cmxMessage.success(messages.sent);
    else if (outcome === 'FAILED') cmxMessage.error(messages.failed);
    else cmxMessage.info(messages.pending);
  }, []);
}
