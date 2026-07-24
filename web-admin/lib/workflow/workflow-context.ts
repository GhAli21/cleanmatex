/**
 * Shared helpers for workflow-context payloads (kept for tests / future use).
 */

export const WORKFLOW_CONTEXT_ORDER_NOT_FOUND = 'ORDER_NOT_FOUND' as const

/**
 * True when a legacy workflow RPC payload indicates the order is missing.
 */
export function isWorkflowRpcOrderNotFound(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return false
  }
  const row = payload as Record<string, unknown>
  if (row.code === WORKFLOW_CONTEXT_ORDER_NOT_FOUND) return true
  if (row.error === 'Order not found') return true
  if (row.ok === false && typeof row.error === 'string') {
    return /order not found/i.test(row.error)
  }
  return false
}
