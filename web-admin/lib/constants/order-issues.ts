/**
 * Order issue scope / codes / priorities — must mirror DB CHECKs on org_order_issues.
 */

export const ORDER_ISSUE_SCOPE = {
  ORDER: 'ORDER',
  ITEM: 'ITEM',
  PIECE: 'PIECE',
} as const;

export type OrderIssueScope =
  (typeof ORDER_ISSUE_SCOPE)[keyof typeof ORDER_ISSUE_SCOPE];

export const ORDER_ISSUE_CODE = {
  DAMAGE: 'damage',
  STAIN: 'stain',
  COMPLAINT: 'complaint',
  OTHER: 'other',
} as const;

export type OrderIssueCode =
  (typeof ORDER_ISSUE_CODE)[keyof typeof ORDER_ISSUE_CODE];

export const ORDER_ISSUE_PRIORITY = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent',
} as const;

export type OrderIssuePriority =
  (typeof ORDER_ISSUE_PRIORITY)[keyof typeof ORDER_ISSUE_PRIORITY];

export const ORDER_ISSUE_ERROR = {
  SCOPE_INVALID: 'ISSUE_SCOPE_INVALID',
  HIERARCHY_MISMATCH: 'ISSUE_HIERARCHY_MISMATCH',
  ALREADY_SOLVED: 'ISSUE_ALREADY_SOLVED',
  NOT_FOUND: 'ISSUE_NOT_FOUND',
  CREATE_FAILED: 'ISSUE_CREATE_FAILED',
  RESOLVE_FAILED: 'ISSUE_RESOLVE_FAILED',
} as const;
