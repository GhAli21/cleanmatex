/**
 * Well-known Workflow Engine system actor (DB-mirrored).
 * Seeded by `0437_sys_wf_public_confirm_actor.sql` into `auth.users`
 * so `org_order_history.done_by` FK is satisfied for unauthenticated paths
 * (public tracking confirm-received).
 */
export const WORKFLOW_SYSTEM_ACTOR = {
  userId: 'a11ce000-0000-4000-8000-00000000f001',
  displayName: 'Workflow System',
  email: 'workflow-system@cleanmatex.internal',
} as const;

export type WorkflowSystemActor = typeof WORKFLOW_SYSTEM_ACTOR;
