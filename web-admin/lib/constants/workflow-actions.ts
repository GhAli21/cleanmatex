/**
 * Workflow action codes — mirror `sys_wf_actions_cd.action_code` (DB-mirror rule).
 *
 * Used by the workflow engine, API routes, and UI action CTAs.
 * @see docs/features/Workflow_Order_Advance/04_Status_and_Vocabulary.md
 */

export const WORKFLOW_ACTIONS = {
  CONFIRM_PHYSICAL_INTAKE: 'CONFIRM_PHYSICAL_INTAKE',
  SEND_TO_PREPARATION: 'SEND_TO_PREPARATION',
  COMPLETE_PREPARATION: 'COMPLETE_PREPARATION',
  COMPLETE_PROCESSING: 'COMPLETE_PROCESSING',
  COMPLETE_ASSEMBLY: 'COMPLETE_ASSEMBLY',
  PASS_QA: 'PASS_QA',
  FAIL_QA: 'FAIL_QA',
  COMPLETE_PACKING: 'COMPLETE_PACKING',
  MARK_READY: 'MARK_READY',
  RELEASE_FOR_PICKUP: 'RELEASE_FOR_PICKUP',
  RELEASE_FOR_DELIVERY: 'RELEASE_FOR_DELIVERY',
  CONFIRM_DELIVERY: 'CONFIRM_DELIVERY',
  CANCEL_ORDER: 'CANCEL_ORDER',
  RETURN_ORDER: 'RETURN_ORDER',
  HOLD_ORDER_WORK: 'HOLD_ORDER_WORK',
  RESUME_ORDER_WORK: 'RESUME_ORDER_WORK',
  STOP_ORDER_WORK: 'STOP_ORDER_WORK',
} as const;

export type WorkflowActionCode = (typeof WORKFLOW_ACTIONS)[keyof typeof WORKFLOW_ACTIONS];

/** Outbox event emitted after a successful workflow transition. */
export const WORKFLOW_OUTBOX_EVENT_TYPE = 'ORDER_WORKFLOW_TRANSITIONED' as const;

/** Idempotency resource namespace for POST …/actions. */
export const WORKFLOW_ACTION_IDEMPOTENCY_RESOURCE = 'workflow_action' as const;
