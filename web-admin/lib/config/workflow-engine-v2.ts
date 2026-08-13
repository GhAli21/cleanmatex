/**
 * Workflow engine V2 — client-safe sync helpers.
 *
 * Env override only. For tenant HQ flag resolution on the server,
 * use {@link resolveWorkflowEngineV2Enabled} from `workflow-engine-v2.server`.
 *
 * Precedence (full, server):
 * 1. WORKFLOW_ENGINE_V2 / NEXT_PUBLIC_WORKFLOW_ENGINE_V2
 * 2. HQ tenant flag `workflow_engine_v2` (when tenantId provided)
 * 3. Default true
 */

export const DEFAULT_WORKFLOW_ENGINE_V2_ENABLED = true;

export function envWorkflowEngineV2ForceOn(): boolean {
  return (
    process.env.WORKFLOW_ENGINE_V2 === 'true' ||
    process.env.NEXT_PUBLIC_WORKFLOW_ENGINE_V2 === 'true'
  );
}

function envWorkflowEngineV2ForceOff(): boolean {
  return (
    process.env.WORKFLOW_ENGINE_V2 === 'false' ||
    process.env.NEXT_PUBLIC_WORKFLOW_ENGINE_V2 === 'false'
  );
}

/**
 * Sync check for client hooks and call sites without tenant context.
 * Prefer server resolve when tenantId is known.
 */
export function isWorkflowEngineV2Enabled(): boolean {
  if (envWorkflowEngineV2ForceOn()) return true;
  if (envWorkflowEngineV2ForceOff()) return false;
  return DEFAULT_WORKFLOW_ENGINE_V2_ENABLED;
}
