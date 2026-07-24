/**
 * Feature toggles for web-admin runtime.
 *
 * Client-safe only. Server HQ flag resolution lives in
 * `@/lib/config/workflow-engine-v2.server`.
 */

export { isWorkflowEngineV2Enabled } from '@/lib/config/workflow-engine-v2';

/**
 *
 */
export function isPreparationEnabled(): boolean {
  return process.env.NEXT_PUBLIC_FEATURE_PREPARATION === 'true';
}
