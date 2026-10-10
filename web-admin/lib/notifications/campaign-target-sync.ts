/**
 * Bridges terminal outbox delivery outcomes for campaign-sourced sends back
 * onto org_ntf_camp_targets_dtl.
 *
 * Context: POST /api/notifications/process-campaigns (Phase B) hands each
 * EMAIL/SMS/WHATSAPP/PUSH target to org_ntf_outbox_dtl and marks the target
 * QUEUED — it does not know (and must not wait to know) whether the channel
 * adapter later actually sends it. POST /api/notifications/process-outbox is
 * the only place that later learns the real terminal outcome. This module is
 * the hookup between the two: call `resolveCampaignTargetForOutbox` once an
 * outbox row has been finalized, and it advances the matching campaign
 * target (found via its own `outbox_id` back-reference, tenant-scoped) to
 * SENT/FAILED/SKIPPED and atomically increments the owning campaign's
 * sent_count/failed_count — see migration 0601's fn_ntf_camp_target_resolve.
 *
 * No-op for any outbox row that is not campaign-sourced
 * (source_entity_type !== 'campaign') — callers should still check that
 * before calling, this module does not re-check it.
 */
import { createAdminSupabaseClient } from '@lib/supabase/server';
import { logger } from '@lib/utils/logger';
import { OUTBOX_STATUS } from '@lib/notifications/types';

export type CampaignTargetTerminalStatus = 'SENT' | 'FAILED' | 'SKIPPED';

/**
 * Narrow RPC bridge for `fn_ntf_camp_target_resolve` (migration 0601,
 * applied; `Database['public']['Functions']` now includes it). Kept
 * permanently, unlike the now-removed bridges for `fn_ntf_meter_usage_atomic`
 * / `fn_ntf_quota_usage_locked` (migration 0598, see STATUS.md) — this one
 * is not a stand-in for missing type generation. Supabase's generator never
 * emits `| null` for an RPC function's TEXT argument regardless of the SQL
 * parameter's actual nullability (confirmed: no generated Functions.*.Args
 * field anywhere in database.ts is typed `| null`), so the real generated
 * Args type for `p_skip_reason` is `string`, not `string | null`. Calling
 * `.rpc()` directly with `p_skip_reason: skipReason ?? null` would not
 * type-check against that, and coercing to `skipReason ?? ''` to satisfy it
 * would be a behavior change: the SQL side does
 * `COALESCE(p_skip_reason, skip_reason)`, so NULL preserves the existing
 * skip_reason but '' would overwrite it. This bridge is what lets the real
 * NULL continue to be sent.
 */
interface CampTargetResolveRpcClient {
  rpc(
    fn: 'fn_ntf_camp_target_resolve',
    args: {
      p_outbox_id: string;
      p_tenant_org_id: string;
      p_target_status: CampaignTargetTerminalStatus;
      p_skip_reason: string | null;
    },
  ): Promise<{ data: boolean | null; error: { message: string } | null }>;
}

/**
 * Maps a resolved org_ntf_outbox_dtl status onto the matching
 * org_ntf_camp_targets_dtl terminal status, or null when the outcome is not
 * terminal yet (still retryable — e.g. FAILED_TEMPORARY) and the campaign
 * target must stay QUEUED until a later resolution.
 * @param outboxStatus The outbox row's finalized status.
 * @returns The terminal campaign-target status to apply, or null to leave the target untouched.
 */
export function mapOutboxStatusToCampaignTargetStatus(
  outboxStatus: string,
): CampaignTargetTerminalStatus | null {
  switch (outboxStatus) {
    case OUTBOX_STATUS.SENT:
      return 'SENT';
    case OUTBOX_STATUS.FAILED_PERMANENT:
      return 'FAILED';
    case OUTBOX_STATUS.SKIPPED:
      return 'SKIPPED';
    default:
      // FAILED_TEMPORARY (still retrying), PROCESSING, QUEUED, CANCELLED,
      // DELIVERED, READ — none of these are a campaign-target terminal
      // transition at this hookup point.
      return null;
  }
}

/**
 * Advances a campaign target row from QUEUED to its terminal state once the
 * outbox row it is linked to (org_ntf_camp_targets_dtl.outbox_id) resolves,
 * and atomically increments the owning campaign's sent_count/failed_count
 * exactly once. Safe to call more than once for the same outbox row — the
 * underlying function guards on `status = 'QUEUED'`, so a redelivered or
 * duplicate call is a no-op (returns false) rather than double-counting.
 * @param tenantOrgId Explicit tenant key — never relied on via RLS alone (CLAUDE.md rule #4).
 * @param outboxId The org_ntf_outbox_dtl.id whose delivery just resolved.
 * @param targetStatus Terminal campaign-target status to apply.
 * @param skipReason Optional diagnostic recorded when targetStatus is FAILED/SKIPPED.
 * @returns Whether a matching QUEUED campaign target row was found and resolved.
 */
export async function resolveCampaignTargetForOutbox(
  tenantOrgId: string,
  outboxId: string,
  targetStatus: CampaignTargetTerminalStatus,
  skipReason?: string | null,
): Promise<boolean> {
  const supabase = createAdminSupabaseClient() as unknown as CampTargetResolveRpcClient;
  const { data, error } = await supabase.rpc('fn_ntf_camp_target_resolve', {
    p_outbox_id: outboxId,
    p_tenant_org_id: tenantOrgId,
    p_target_status: targetStatus,
    p_skip_reason: skipReason ?? null,
  });

  if (error) {
    logger.error('campaign-target-sync: fn_ntf_camp_target_resolve failed', new Error(error.message), {
      outboxId, tenantOrgId, targetStatus, feature: 'notifications-campaigns',
    });
    return false;
  }

  return Boolean(data);
}
