import 'server-only';

import type { NextRequest } from 'next/server';
import { POS_SESSION_STATUS } from '@/lib/constants/pos-session';
import { getMyActivePosSession } from '@/lib/services/pos-session.service';
import { logger } from '@/lib/utils/logger';
import { resolveWorkflowCommandChannel } from '@/lib/api/workflow-command-channel';

/**
 * Channels allowed on POS-eligible fulfilment adapters (intake, pickup, delivery).
 * Generic floor adapters (`/actions`, stage commands) must not use this helper.
 */
export type PosEligibleWorkflowChannel = 'staff_web' | 'mobile' | 'pos';

/** Authenticated lookup used to prove an OPEN till without trusting the client. */
export interface ResolvePosEligibleWorkflowChannelInput {
  request: NextRequest;
  tenantId: string;
  userId: string;
  /** When set, an OPEN session at another branch stays `staff_web`. */
  orderBranchId?: string | null;
}

/**
 * Derives the command channel for adapters whose live policy includes `pos`.
 *
 * Bearer JWT stays `mobile` even if a till is open. Cookie sessions become
 * `pos` only after a tenant-scoped OPEN POS session is found for this actor,
 * optionally matching the order branch. Lookup failures fall back to `staff_web`
 * so a drawer outage cannot block handover.
 *
 * @param input Authenticated request plus tenant actor (and optional order branch)
 * @returns Server-assigned channel; never a client-supplied value
 */
export async function resolvePosEligibleWorkflowCommandChannel(
  input: ResolvePosEligibleWorkflowChannelInput,
): Promise<PosEligibleWorkflowChannel> {
  const credentialChannel = resolveWorkflowCommandChannel(input.request);
  if (credentialChannel === 'mobile') return 'mobile';

  try {
    const active = await getMyActivePosSession({
      tenantId: input.tenantId,
      userId: input.userId,
      branchId: input.orderBranchId ?? undefined,
    });
    if (active.type !== 'ACTIVE') return 'staff_web';
    if (active.session.status !== POS_SESSION_STATUS.OPEN) return 'staff_web';
    return 'pos';
  } catch (error) {
    logger.warn('POS session lookup failed; using staff_web channel', {
      feature: 'workflow',
      action: 'resolve_pos_channel',
      tenantId: input.tenantId,
      error: error instanceof Error ? error.message : String(error),
    });
    return 'staff_web';
  }
}
