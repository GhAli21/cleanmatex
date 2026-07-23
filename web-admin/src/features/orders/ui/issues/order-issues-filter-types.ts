/**
 * Shared filter types for order-issues list dialog + tenant queue.
 */

import type { PriorityCode } from '@/lib/constants/priority';

/** Per-order list dialog scope chips (includes "this level"). */
export type OrderIssuesDialogScopeFilter =
  | 'this'
  | 'order'
  | 'item'
  | 'piece'
  | 'all';

/** Tenant queue scope chips (DB scope_level values + all). */
export type OrderIssuesQueueScopeFilter = 'all' | 'ORDER' | 'ITEM' | 'PIECE';

export type OrderIssuesStatusFilter = 'open' | 'solved' | 'all';

export type OrderIssuesPriorityFilter = 'all' | PriorityCode;

export const ORDER_ISSUES_SORT_BY = {
  CREATED_AT: 'created_at',
  PRIORITY: 'priority',
  STATUS: 'status',
  SOLVED_AT: 'solved_at',
  SCOPE: 'scope_level',
  ISSUE_TYPE: 'issue_code',
  ORDER_NO: 'order_no',
} as const;

export type OrderIssuesSortBy =
  (typeof ORDER_ISSUES_SORT_BY)[keyof typeof ORDER_ISSUES_SORT_BY];

export const ORDER_ISSUES_SORT_DIR = {
  ASC: 'asc',
  DESC: 'desc',
} as const;

export type OrderIssuesSortDir =
  (typeof ORDER_ISSUES_SORT_DIR)[keyof typeof ORDER_ISSUES_SORT_DIR];

export const DEFAULT_ORDER_ISSUES_SORT_BY = ORDER_ISSUES_SORT_BY.CREATED_AT;
export const DEFAULT_ORDER_ISSUES_SORT_DIR = ORDER_ISSUES_SORT_DIR.DESC;

/** Sort fields shared by dialog + queue. */
export const ORDER_ISSUES_SORT_FIELDS_SHARED: OrderIssuesSortBy[] = [
  ORDER_ISSUES_SORT_BY.CREATED_AT,
  ORDER_ISSUES_SORT_BY.PRIORITY,
  ORDER_ISSUES_SORT_BY.STATUS,
  ORDER_ISSUES_SORT_BY.SOLVED_AT,
  ORDER_ISSUES_SORT_BY.SCOPE,
  ORDER_ISSUES_SORT_BY.ISSUE_TYPE,
];

/** Extra sort fields for tenant queue only. */
export const ORDER_ISSUES_SORT_FIELDS_QUEUE: OrderIssuesSortBy[] = [
  ...ORDER_ISSUES_SORT_FIELDS_SHARED,
  ORDER_ISSUES_SORT_BY.ORDER_NO,
];
