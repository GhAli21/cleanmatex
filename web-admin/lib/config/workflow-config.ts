/**
 * Workflow System Configuration
 *
 * Centralized switch for choosing the workflow system.
 *
 * Semantics in this repo:
 * - When calling `/api/v1/orders/:id/transition` with `screen`:
 *   - `useOldWfCodeOrNew === false` => use OLD workflow code path
 *   - `useOldWfCodeOrNew !== false` => use NEW (enhanced) workflow code path
 *
 * This module exposes a clearer boolean: "use new workflow system".
 * Screens can map it directly into the request field `useOldWfCodeOrNew`.
 */

/**
 * @returns true to use the NEW workflow system, false to use the OLD workflow system.
 *
 * Defaults to false (old workflow) for safer gradual rollout.
 */
export function getWorkflowSystemMode(): boolean {
  const envValue = process.env.NEXT_PUBLIC_USE_NEW_WORKFLOW_SYSTEM;

  if (!envValue) return false;

  const normalized = envValue.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;

  return false;
}

/**
 * React-friendly helper (still build-time env for NEXT_PUBLIC_*).
 */
export function useWorkflowSystemMode(): boolean {
  return getWorkflowSystemMode();
}


