/**
 * Workflow engine V2 canary resolution.
 *
 * Precedence (production-safe):
 * 1. Emergency env kill-switch / force-on: WORKFLOW_ENGINE_V2 / NEXT_PUBLIC_WORKFLOW_ENGINE_V2
 * 2. HQ tenant flag `workflow_engine_v2` (when tenantId provided)
 * 3. Default false
 *
 * HQ must seed `workflow_engine_v2` in cleanmatexsaas catalog before tenant canary via HQ UI.
 */

import { getFeatureFlags } from '@/lib/services/feature-flags.service';
import { FEATURE_FLAG_KEYS } from '@/lib/constants/feature-flags';

function envForceOn(): boolean {
  return (
    process.env.WORKFLOW_ENGINE_V2 === 'true' ||
    process.env.NEXT_PUBLIC_WORKFLOW_ENGINE_V2 === 'true'
  );
}

/**
 * Sync check for client hooks and call sites without tenant context.
 * Prefer {@link resolveWorkflowEngineV2Enabled} on the server when tenantId is known.
 */
export function isWorkflowEngineV2Enabled(): boolean {
  return envForceOn();
}

/**
 * Server/async resolution: HQ flag OR env force-on.
 */
export async function resolveWorkflowEngineV2Enabled(
  tenantId?: string | null,
): Promise<boolean> {
  if (envForceOn()) return true;
  if (!tenantId) return false;
  try {
    const flags = await getFeatureFlags(tenantId);
    return Boolean(flags[FEATURE_FLAG_KEYS.WORKFLOW_ENGINE_V2 as keyof typeof flags]);
  } catch {
    return false;
  }
}
