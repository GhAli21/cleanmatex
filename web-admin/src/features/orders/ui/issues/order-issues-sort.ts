/**
 * Client-side sort for enriched order-issue table rows.
 */

import { ORDER_ISSUE_STATUS } from '@/lib/constants/order-issues';
import {
  ORDER_ISSUES_SORT_BY,
  type OrderIssuesSortBy,
  type OrderIssuesSortDir,
} from './order-issues-filter-types';
import type { OrderIssueTableRow } from './order-issue-table-types';

function statusRank(status: string | null | undefined): number {
  if (status === ORDER_ISSUE_STATUS.OPEN) return 0;
  if (status === ORDER_ISSUE_STATUS.SOLVED) return 1;
  return 2;
}

function scopeRank(scope: string | null | undefined): number {
  const key = String(scope || '').toUpperCase();
  if (key === 'ORDER') return 0;
  if (key === 'ITEM') return 1;
  if (key === 'PIECE') return 2;
  return 3;
}

function compareNullableString(
  a: string | null | undefined,
  b: string | null | undefined,
  dir: OrderIssuesSortDir
): number {
  const av = (a ?? '').trim();
  const bv = (b ?? '').trim();
  if (!av && !bv) return 0;
  if (!av) return 1;
  if (!bv) return -1;
  const base = av.localeCompare(bv, undefined, { sensitivity: 'base' });
  return dir === 'asc' ? base : -base;
}

function compareNumber(
  a: number,
  b: number,
  dir: OrderIssuesSortDir
): number {
  if (a === b) return 0;
  const base = a < b ? -1 : 1;
  return dir === 'asc' ? base : -base;
}

/**
 * Stable sort of issue rows by selected field / direction.
 */
export function sortOrderIssueRows(
  rows: OrderIssueTableRow[],
  sortBy: OrderIssuesSortBy,
  sortDir: OrderIssuesSortDir
): OrderIssueTableRow[] {
  const copy = [...rows];
  copy.sort((left, right) => {
    let primary = 0;

    switch (sortBy) {
      case ORDER_ISSUES_SORT_BY.PRIORITY:
        primary = compareNumber(
          Number(left.priority_display_order ?? 99),
          Number(right.priority_display_order ?? 99),
          sortDir
        );
        break;
      case ORDER_ISSUES_SORT_BY.STATUS:
        primary = compareNumber(
          statusRank(left.status),
          statusRank(right.status),
          sortDir
        );
        break;
      case ORDER_ISSUES_SORT_BY.SCOPE:
        primary = compareNumber(
          scopeRank(left.scope_level),
          scopeRank(right.scope_level),
          sortDir
        );
        break;
      case ORDER_ISSUES_SORT_BY.ISSUE_TYPE:
        primary = compareNullableString(
          left.issue_code,
          right.issue_code,
          sortDir
        );
        break;
      case ORDER_ISSUES_SORT_BY.ORDER_NO:
        primary = compareNullableString(
          left.order_no ?? left.order_id,
          right.order_no ?? right.order_id,
          sortDir
        );
        break;
      case ORDER_ISSUES_SORT_BY.SOLVED_AT:
        primary = compareNullableString(
          left.solved_at,
          right.solved_at,
          sortDir
        );
        break;
      case ORDER_ISSUES_SORT_BY.CREATED_AT:
      default:
        primary = compareNullableString(
          left.created_at,
          right.created_at,
          sortDir
        );
        break;
    }

    if (primary !== 0) return primary;

    // Tie-breaker: newest created first
    return compareNullableString(
      left.created_at,
      right.created_at,
      'desc'
    );
  });
  return copy;
}
