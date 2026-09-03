'use client';

import { useCallback, useRef, useState } from 'react';
import { useCSRFToken } from '@/lib/hooks/use-csrf-token';
import { useWorkflowActions } from '@/lib/hooks/use-workflow-actions';
import { WORKFLOW_ACTIONS } from '@/lib/constants/workflow-actions';
import { WORKFLOW_SCREENS } from '@/lib/constants/workflow-screens';
import {
  confirmHomeCollection,
  type ConfirmHomeCollectionResponse,
} from '@features/home-collection/api/home-collection-api';

interface RetryKey {
  key: string;
  fingerprint: string;
}

export interface ConfirmHomeCollectionInput {
  collectionNotes?: string;
}

export function useHomeCollectionHandover(orderId: string | null | undefined) {
  const { token: csrfToken, loading: csrfLoading } = useCSRFToken();
  const workflow = useWorkflowActions(orderId, WORKFLOW_SCREENS.HOME_COLLECTION);
  const [submitting, setSubmitting] = useState(false);
  const retryKeyRef = useRef<RetryKey | null>(null);

  const confirmAction = workflow.actions.find(
    (candidate) => candidate.actionCode === WORKFLOW_ACTIONS.CONFIRM_HOME_COLLECTION,
  );

  const confirm = useCallback(async (
    input: ConfirmHomeCollectionInput,
  ): Promise<ConfirmHomeCollectionResponse> => {
    if (!orderId || workflow.stateVersion === null) {
      throw new Error('Home collection confirm is not available. Refresh and retry.');
    }
    const collectionNotes = input.collectionNotes?.trim() || undefined;
    const fingerprint = JSON.stringify({
      expectedStateVersion: workflow.stateVersion,
      collectionNotes,
    });
    if (!retryKeyRef.current || retryKeyRef.current.fingerprint !== fingerprint) {
      retryKeyRef.current = {
        key: crypto.randomUUID(),
        fingerprint,
      };
    }

    setSubmitting(true);
    try {
      const result = await confirmHomeCollection(
        orderId,
        { expectedStateVersion: workflow.stateVersion, collectionNotes },
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
    confirmAction,
    assignAction: workflow.actions.find(
      (candidate) => candidate.actionCode === WORKFLOW_ACTIONS.ASSIGN_HOME_COLLECTION,
    ),
    currentStatus: workflow.currentStatus,
    loading: workflow.loading || csrfLoading,
    submitting,
    refresh: workflow.refresh,
    confirm,
    execute: workflow.execute,
  };
}
