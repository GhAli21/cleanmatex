/**
 * Role Definitions
 * PRD-010: Role-based access control for workflow screens
 */

export const WORKFLOW_ROLES = {
  RECEPTION: 'ROLE_RECEPTION',
  PREPARATION: 'ROLE_PREPARATION',
  PROCESSING: 'ROLE_PROCESSING',
  QA: 'ROLE_QA',
  DELIVERY: 'ROLE_DELIVERY',
  ADMIN: 'ADMIN', 
} as const;

export type Role = typeof WORKFLOW_ROLES[keyof typeof WORKFLOW_ROLES];

/**
 * Screen access mapping
 * Maps screens to allowed roles
 */
export const SCREEN_ACCESS: Record<string, Role[]> = {
  NEW_ORDER: [WORKFLOW_ROLES.RECEPTION, WORKFLOW_ROLES.ADMIN],
  PREPARATION: [WORKFLOW_ROLES.PREPARATION, WORKFLOW_ROLES.ADMIN],
  PROCESSING: [WORKFLOW_ROLES.PROCESSING, WORKFLOW_ROLES.ADMIN],
  ASSEMBLY: [WORKFLOW_ROLES.PROCESSING, WORKFLOW_ROLES.ADMIN],
  QA: [WORKFLOW_ROLES.QA, WORKFLOW_ROLES.ADMIN],
  READY: [WORKFLOW_ROLES.RECEPTION, WORKFLOW_ROLES.DELIVERY, WORKFLOW_ROLES.ADMIN],
  WORKFLOW_CONFIG: [WORKFLOW_ROLES.ADMIN],
};

/**
 * Transition access mapping
 * Maps transitions to allowed roles
 */
export const TRANSITION_ACCESS: Record<string, Role[]> = {

  'intake->preparing': [WORKFLOW_ROLES.RECEPTION, WORKFLOW_ROLES.PREPARATION],
  'preparing->processing': [WORKFLOW_ROLES.PREPARATION],
  'processing->ready': [WORKFLOW_ROLES.PROCESSING],
  'qa->ready': [WORKFLOW_ROLES.QA],
  'ready->delivered': [WORKFLOW_ROLES.RECEPTION, WORKFLOW_ROLES.DELIVERY],
};

/**
 * Check if user has required role for screen
 */
export function hasScreenAccess(userRole: Role, screen: string): boolean {
  const allowedRoles = SCREEN_ACCESS[screen] || [];
  return allowedRoles.includes(userRole);
}

/**
 * Check if user has required role for transition 
 */
export function hasTransitionAccess(userRole: Role, from: string, to: string): boolean {
  const key = `${from}->${to}`;
  const allowedRoles = TRANSITION_ACCESS[key] || [];
  //return allowedRoles.includes(userRole) || allowedRoles.includes(ROLES.ADMIN);
  return allowedRoles.includes(userRole) || userRole.toLowerCase() === WORKFLOW_ROLES.ADMIN.toLowerCase();
}

