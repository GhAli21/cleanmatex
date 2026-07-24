/**
 * Workflow engine V2 — server-only canary resolution (HQ tenant flag).
 *
 * Must not be imported from Client Components.
 */

import 'server-only';

import { getFeatureFlags } from '@/lib/services/feature-flags.service';
import { FEATURE_FLAG_KEYS } from '@/lib/constants/feature-flags';
import { envWorkflowEngineV2ForceOn } from '@/lib/config/workflow-engine-v2';

/**
 * Server/async resolution: HQ flag OR env force-on.
 */
export async function resolveWorkflowEngineV2Enabled(
  tenantId?: string | null,
): Promise<boolean> {
  if (envWorkflowEngineV2ForceOn()) return true;
  if (!tenantId) return false;
  try {
    const flags = await getFeatureFlags(tenantId);
    return Boolean(flags[FEATURE_FLAG_KEYS.WORKFLOW_ENGINE_V2 as keyof typeof flags]);
  } catch {
    return false;
  }
}
