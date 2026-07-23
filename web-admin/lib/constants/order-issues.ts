/**
 * Order issue scope / status / priorities — mirror DB values on org_order_issues.
 */

import {
  DEFAULT_PRIORITY,
  PRIORITY,
  PRIORITY_CODES,
  type PriorityCode,
} from '@/lib/constants/priority';

export const ORDER_ISSUE_SCOPE = {
  ORDER: 'ORDER',
  ITEM: 'ITEM',
  PIECE: 'PIECE',
} as const;

export type OrderIssueScope =
  (typeof ORDER_ISSUE_SCOPE)[keyof typeof ORDER_ISSUE_SCOPE];

/** @deprecated Prefer sys_issue_type_cd via lookups API. Kept for remap/docs. */
export const ORDER_ISSUE_CODE = {
  DAMAGE: 'DAMAGE',
  STAIN: 'STAIN',
  COMPLAINT: 'COMPLAINT',
  OTHER: 'OTHER',
} as const;

export type OrderIssueCode =
  (typeof ORDER_ISSUE_CODE)[keyof typeof ORDER_ISSUE_CODE];

export const ORDER_ISSUE_STATUS = {
  OPEN: 'OPEN',
  SOLVED: 'SOLVED',
} as const;

export type OrderIssueStatus =
  (typeof ORDER_ISSUE_STATUS)[keyof typeof ORDER_ISSUE_STATUS];

export const ORDER_ISSUE_PRIORITY = PRIORITY;
export type OrderIssuePriority = PriorityCode;
export { DEFAULT_PRIORITY, PRIORITY_CODES };

export const ORDER_ISSUE_ERROR = {
  SCOPE_INVALID: 'ISSUE_SCOPE_INVALID',
  HIERARCHY_MISMATCH: 'ISSUE_HIERARCHY_MISMATCH',
  ALREADY_SOLVED: 'ISSUE_ALREADY_SOLVED',
  NOT_FOUND: 'ISSUE_NOT_FOUND',
  CREATE_FAILED: 'ISSUE_CREATE_FAILED',
  RESOLVE_FAILED: 'ISSUE_RESOLVE_FAILED',
  INVALID_TYPE: 'ISSUE_INVALID_TYPE',
  INVALID_PRIORITY: 'ISSUE_INVALID_PRIORITY',
} as const;
