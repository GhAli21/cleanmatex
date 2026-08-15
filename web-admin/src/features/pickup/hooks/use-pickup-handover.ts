'use client';

import { useCallback, useRef, useState } from 'react';
import { useCSRFToken } from '@/lib/hooks/use-csrf-token';
import { useWorkflowActions } from '@/lib/hooks/use-workflow-actions';
import { WORKFLOW_ACTIONS } from '@/lib/constants/workflow-actions';
import {
  confirmPickup,
  type ConfirmPickupResponse,
} from '@features/pickup/api/pickup-api';

const PICKUP_HANDOVER_SCREEN = 'pickup_handover';

interface RetryKey {
  key: string;
  fingerprint: string;
}

/** Input collected from a staff member at physical counter handover. */
export interface ConfirmPickupInput {
  handoverNotes?: string;
}

/**
 * Provides the tenant-safe pickup action state and replay-safe command mutation.
 *
 * Tenant authorization is enforced by the server endpoint; this hook only uses
 * the workflow action read-model to avoid presenting an invalid client action.
 *
 * @param orderId order currently shown on the Ready screen
 * @returns available pickup action, loading state, and confirm mutation
 * @example
 * const { action, confirm } = usePickupHandover(orderId);
 */
export function usePickupHandover(orderId: string | null | undefined) {
  const { token: csrfToken, loading: csrfLoading } = useCSRFToken();
  const workflow = useWorkflowActions(orderId, PICKUP_HANDOVER_SCREEN);
  const [submitting, setSubmitting] = useState(false);
  const retryKeyRef = useRef<RetryKey | null>(null);

  const action = workflow.actions.find(
    (candidate) => candidate.actionCode === WORKFLOW_ACTIONS.CONFIRM_PICKUP,
  );

  const confirm = useCallback(async (input: ConfirmPickupInput): Promise<ConfirmPickupResponse> => {
    if (!orderId || workflow.stateVersion === null) {
      throw new Error('Pickup handover is not available. Refresh and retry.');
    }
    const handoverNotes = input.handoverNotes?.trim() || undefined;
    const fingerprint = JSON.stringify({
      expectedStateVersion: workflow.stateVersion,
      handoverNotes,
    });
    if (!retryKeyRef.current || retryKeyRef.current.fingerprint !== fingerprint) {
      retryKeyRef.current = {
        key: crypto.randomUUID(),
        fingerprint,
      };
    }

    setSubmitting(true);
    try {
      const result = await confirmPickup(
        orderId,
        { expectedStateVersion: workflow.stateVersion, handoverNotes },
        retryKeyRef.current.key,
        csrfToken,
      );
      retryKeyRef.current = null;
      await workflow.refresh();
      return result;
    } finally {
      setSubmitting(false);
    }
  }, [csrfToken, orderId, workflow]);

  return {
    action,
    currentStatus: workflow.currentStatus,
    loading: workflow.loading || csrfLoading,
    submitting,
    refresh: workflow.refresh,
    confirm,
  };
}
