/**
 * Workflow screen keys used by org_ord_screen_contracts_cf.screen_key.
 * Must match workflow screen catalog seeds.
 */
export const WORKFLOW_SCREEN_KEYS = [
  'preparation',
  'processing',
  'assembly',
  'qa',
  'packing',
  'ready_release',
  'driver_delivery',
  'new_order',
  'workboard',
  'canceling',
  'returning',
  'order_control',
  'public_tracking',
] as const

export type WorkflowScreenKey = (typeof WORKFLOW_SCREEN_KEYS)[number]

export const WORKFLOW_SCREEN_KEY_SET = new Set<string>(WORKFLOW_SCREEN_KEYS)
