'use client';

import { useCallback, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWorkflowActions } from '@/lib/hooks/use-workflow-actions';
import { WORKFLOW_ACTIONS } from '@/lib/constants/workflow-actions';
import { WORKFLOW_SCREENS } from '@/lib/constants/workflow-screens';
import {
  completeOrderDelivery,
  getActiveDeliveryStop,
} from '@features/delivery/api/delivery-completion-api';
import type { DeliveryStopView } from '@/lib/services/delivery/delivery-route-query.service';

interface RetryKey {
  key: string;
  fingerprint: string;
}

/** Notes collected on the delivery floor when no planned stop exists. */
export interface ConfirmDeliveryHandoverInput {
  podNotes?: string;
}

/**
 * Loads the profile CONFIRM_DELIVERY action and chooses stop-owned vs ad-hoc writers.
 *
 * @param orderId order currently shown on the Delivery floor
 * @returns action, optional active stop, and ad-hoc confirm mutation
 */
export function useDeliveryHandover(orderId: string | null | undefined) {
  const workflow = useWorkflowActions(orderId, WORKFLOW_SCREENS.DRIVER_DELIVERY);
  const [submitting, setSubmitting] = useState(false);
  const retryKeyRef = useRef<RetryKey | null>(null);

  const action = workflow.actions.find(
    (candidate) => candidate.actionCode === WORKFLOW_ACTIONS.CONFIRM_DELIVERY,
  );

  const activeStopQuery = useQuery<DeliveryStopView | null>({
    queryKey: ['delivery', 'active-stop', orderId],
    enabled: Boolean(orderId),
    queryFn: () => getActiveDeliveryStop(orderId as string),
  });

  const confirm = useCallback(async (input: ConfirmDeliveryHandoverInput) => {
    if (!orderId || workflow.stateVersion === null) {
      throw new Error('Delivery handover is not available. Refresh and retry.');
    }
    const podNotes = input.podNotes?.trim() || undefined;
    const fingerprint = JSON.stringify({
      expectedStateVersion: workflow.stateVersion,
      podNotes,
    });
    if (!retryKeyRef.current || retryKeyRef.current.fingerprint !== fingerprint) {
      retryKeyRef.current = {
        key: crypto.randomUUID(),
        fingerprint,
      };
    }

    setSubmitting(true);
    try {
      const result = await completeOrderDelivery({
        orderId,
        expectedStateVersion: workflow.stateVersion,
        idempotencyKey: retryKeyRef.current.key,
        podNotes,
      });
      retryKeyRef.current = null;
      await workflow.refresh();
      return result;
    } finally {
      setSubmitting(false);
    }
  }, [orderId, workflow]);

  return {
    action,
    activeStop: activeStopQuery.data ?? null,
    currentStatus: workflow.currentStatus,
    loading: workflow.loading || activeStopQuery.isLoading,
    submitting,
    refresh: workflow.refresh,
    confirm,
  };
}
