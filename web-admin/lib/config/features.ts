/**
 * Feature toggles for web-admin runtime.
 */

export {
  isWorkflowEngineV2Enabled,
  resolveWorkflowEngineV2Enabled,
} from '@/lib/config/workflow-engine-v2';

/**
 *
 */
export function isPreparationEnabled(): boolean {
  return process.env.NEXT_PUBLIC_FEATURE_PREPARATION === 'true';
}
