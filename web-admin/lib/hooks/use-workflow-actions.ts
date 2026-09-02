'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { cmxMessage } from '@ui/feedback';
import { isWorkflowEngineV2Enabled } from '@/lib/config/features';
import { postStaffWorkflowCommand } from '@/lib/workflow/post-staff-workflow-command';

export interface WorkflowGateDecisionDto {
  gateCode: string;
  result: 'WARNING' | 'OVERRIDABLE';
  messageKey?: string | null;
  acknowledgementChallenge?: string;
  overrideMinReasonLength?: number;
  overridePermissionCode?: string | null;
}

export function toSubmittedGateDecisions(
  decisions: WorkflowGateDecisionDto[] | undefined,
  overrideReason?: string,
): Array<{
  gateCode: string;
  acknowledgementChallenge?: string;
  overrideReason?: string;
}> | undefined {
  if (!decisions?.length) return undefined;
  return decisions.map((decision) => ({
    gateCode: decision.gateCode,
    ...(decision.result === 'WARNING' && decision.acknowledgementChallenge
      ? { acknowledgementChallenge: decision.acknowledgementChallenge }
      : {}),
    ...(decision.result === 'OVERRIDABLE' && overrideReason
      ? { overrideReason }
      : {}),
  }));
}

export interface WorkflowActionDto {
  actionCode: string;
  toStatus?: string;
  label: string;
  label2: string | null;
  enabled: boolean;
  blockedReasons: Array<{ code: string; message: string; message2?: string }>;
  gateDecisions?: WorkflowGateDecisionDto[];
}

export interface UseWorkflowActionsResult {
  enabled: boolean;
  loading: boolean;
  /** True after the first available-actions fetch settles (success or error). */
  hasLoaded: boolean;
  stateVersion: number | null;
  currentStatus: string | null;
  actions: WorkflowActionDto[];
  refresh: () => Promise<void>;
  execute: (
    actionCode: string,
    input?: Record<string, unknown>,
    preferredToStatus?: string,
    gateDecisions?: Array<{
      gateCode: string;
      acknowledgementChallenge?: string;
      overrideReason?: string;
    }>,
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
  // Start loading when canary+order are present so ActionBar does not treat the
  // pre-fetch empty list as "no actions" and bounce via emptyBackHref.
  const [loading, setLoading] = useState(() => enabled && Boolean(orderId));
  const [hasLoaded, setHasLoaded] = useState(() => !enabled || !orderId);
  const [stateVersion, setStateVersion] = useState<number | null>(null);
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const [actions, setActions] = useState<WorkflowActionDto[]>([]);

  const refresh = useCallback(async () => {
    if (!enabled || !orderId) {
      setActions([]);
      setLoading(false);
      setHasLoaded(true);
      return;
    }
    setHasLoaded(false);
    setLoading(true);
    try {
      const qs = new URLSearchParams({ screen });
      const res = await fetch(`/api/v1/orders/${orderId}/available-actions?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        const profileBlocked = typeof json.code === 'string' && json.code.startsWith('PROFILE_');
        throw new Error(profileBlocked ? t('profileUnavailable') : (json.error || t('actionFailed')));
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
      setHasLoaded(true);
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
      gateDecisions?: Array<{
        gateCode: string;
        acknowledgementChallenge?: string;
        overrideReason?: string;
      }>,
    ) => {
      if (!enabled || !orderId || stateVersion == null) {
        return false;
      }
      setLoading(true);
      try {
        const result = await postStaffWorkflowCommand({
          orderId,
          screen,
          actionCode,
          expectedStateVersion: stateVersion,
          input: {
            ...input,
            ...(preferredToStatus ? { preferredToStatus } : {}),
          },
          gateDecisions,
        });
        if (!result.ok || !result.success) {
          throw new Error(result.error || t('actionFailed'));
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
    hasLoaded,
    stateVersion,
    currentStatus,
    actions,
    refresh,
    execute,
  };
}
