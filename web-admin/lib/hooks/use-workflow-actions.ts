'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { cmxMessage } from '@ui/feedback';
import { isWorkflowEngineV2Enabled } from '@/lib/config/features';

export interface WorkflowActionDto {
  actionCode: string;
  toStatus?: string;
  label: string;
  label2: string | null;
  enabled: boolean;
  blockedReasons: Array<{ code: string; message: string; message2?: string }>;
}

export interface UseWorkflowActionsResult {
  enabled: boolean;
  loading: boolean;
  stateVersion: number | null;
  currentStatus: string | null;
  actions: WorkflowActionDto[];
  refresh: () => Promise<void>;
  execute: (
    actionCode: string,
    input?: Record<string, unknown>,
    preferredToStatus?: string,
  ) => Promise<boolean>;
}

/**
 * Client helper for Workflow Order Advance action UX.
 * No-ops when WORKFLOW_ENGINE_V2 / NEXT_PUBLIC_WORKFLOW_ENGINE_V2 is off.
 */
export function useWorkflowActions(
  orderId: string | null | undefined,
  screen: string,
): UseWorkflowActionsResult {
  const t = useTranslations('workflow.engine');
  const enabled = isWorkflowEngineV2Enabled();
  const [loading, setLoading] = useState(false);
  const [stateVersion, setStateVersion] = useState<number | null>(null);
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const [actions, setActions] = useState<WorkflowActionDto[]>([]);

  const refresh = useCallback(async () => {
    if (!enabled || !orderId) {
      setActions([]);
      return;
    }
    setLoading(true);
    try {
      const qs = new URLSearchParams({ screen });
      const res = await fetch(`/api/v1/orders/${orderId}/available-actions?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || t('actionFailed'));
      }
      const payload = json.data ?? json;
      setStateVersion(payload.stateVersion ?? null);
      setCurrentStatus(payload.currentStatus ?? null);
      setActions(Array.isArray(payload.actions) ? payload.actions : []);
    } catch (err) {
      cmxMessage.error(err instanceof Error ? err.message : t('actionFailed'));
      setActions([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, orderId, screen, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const execute = useCallback(
    async (
      actionCode: string,
      input?: Record<string, unknown>,
      preferredToStatus?: string,
    ) => {
      if (!enabled || !orderId || stateVersion == null) {
        return false;
      }
      setLoading(true);
      try {
        const idempotencyKey =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${orderId}:${actionCode}:${Date.now()}`;
        const res = await fetch(`/api/v1/orders/${orderId}/actions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey,
          },
          body: JSON.stringify({
            screen,
            actionCode,
            expectedStateVersion: stateVersion,
            input: {
              ...input,
              ...(preferredToStatus ? { preferredToStatus } : {}),
            },
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || t('actionFailed'));
        }
        cmxMessage.success(t('actionSuccess'));
        await refresh();
        return true;
      } catch (err) {
        cmxMessage.error(err instanceof Error ? err.message : t('actionFailed'));
        return false;
      } finally {
        setLoading(false);
      }
    },
    [enabled, orderId, screen, stateVersion, refresh, t],
  );

  return {
    enabled,
    loading,
    stateVersion,
    currentStatus,
    actions,
    refresh,
    execute,
  };
}
