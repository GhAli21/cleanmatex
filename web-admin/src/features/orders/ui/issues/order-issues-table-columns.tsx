/**
 * Shared CmxDataTable column factory for order-issues tables.
 */

'use client';

import Link from 'next/link';
import { CmxButton } from '@ui/primitives';
import { CmxCodeChip, type CmxDataTableSimpleColumn } from '@ui/data-display';
import { ORDER_ISSUE_STATUS } from '@/lib/constants/order-issues';
import { OrderIssueActorTimeCell } from './order-issue-actor-time-cell';
import type { OrderIssueTableRow } from './order-issue-table-types';

import { CmxStatusBadge, type CmxBadgeTone } from '@ui/feedback';
export interface BuildOrderIssueColumnsOptions {
  locale: string;
  t: (key: string, values?: Record<string, string | number>) => string;
  includeOrderColumn?: boolean;
  includeScopeColumn?: boolean;
  onSolve?: (row: OrderIssueTableRow) => void;
  /** Shows a Photos button under the issue text (files attached to this issue). */
  onPhotos?: (row: OrderIssueTableRow) => void;
}

function typeLabel(row: OrderIssueTableRow, locale: string): string {
  if (locale === 'ar') {
    return row.issue_type_name2 || row.issue_type_name || row.issue_code;
  }
  return row.issue_type_name || row.issue_code;
}

function priorityLabel(row: OrderIssueTableRow, locale: string): string {
  if (locale === 'ar') {
    return row.priority_name2 || row.priority_name || row.priority || '—';
  }
  return row.priority_name || row.priority || '—';
}

function priorityTone(priority?: string | null): CmxBadgeTone {
  const code = String(priority ?? '').trim().toLowerCase();
  if (code === 'urgent' || code === 'critical') return 'danger';
  if (code === 'high') return 'warning';
  if (code === 'normal' || code === 'medium') return 'info';
  return 'neutral';
}

function isIssueOpen(row: OrderIssueTableRow): boolean {
  return row.status === ORDER_ISSUE_STATUS.OPEN;
}

/**
 * Status | Issue | Priority | [Scope] | Reported | Resolution | Solved (+ Order).
 */
export function buildOrderIssueTableColumns(
  options: BuildOrderIssueColumnsOptions
): CmxDataTableSimpleColumn<OrderIssueTableRow>[] {
  const {
    locale,
    t,
    includeOrderColumn = false,
    includeScopeColumn = false,
    onSolve,
    onPhotos,
  } = options;

  const cols: CmxDataTableSimpleColumn<OrderIssueTableRow>[] = [];

  if (includeOrderColumn) {
    cols.push({
      key: 'order',
      header: t('orderNo'),
      sortable: false,
      render: (row) =>
        row.order_id && row.order_no ? (
          <Link
            href={`/dashboard/orders/${row.order_id}?returnUrl=${encodeURIComponent('/dashboard/issues')}`}
            className="inline-flex font-medium text-primary-text hover:underline"
          >
            <CmxCodeChip code={row.order_no} kind="order" size="sm" copyable={false} />
          </Link>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    });
  }

  cols.push(
    {
      key: 'status',
      header: t('columns.status'),
      sortable: false,
      render: (row) => {
        const open = isIssueOpen(row);
        return (
          <CmxStatusBadge size="sm" tone={open ? 'danger' : 'success'}>
            {open ? t('statusOpen') : t('statusSolved')}
          </CmxStatusBadge>
        );
      },
    },
    {
      key: 'issue',
      header: t('columns.issue'),
      sortable: false,
      render: (row) => (
        <div className="min-w-[12rem] max-w-sm space-y-1">
          <CmxStatusBadge size="sm" tone="neutral" appearance="outline">{typeLabel(row, locale)}</CmxStatusBadge>
          <p className="text-sm font-medium whitespace-pre-wrap">
            {row.issue_text}
          </p>
          {onPhotos ? (
            <CmxButton type="button" variant="ghost" size="sm" className="px-1" onClick={() => onPhotos(row)}>
              {t('viewPhotos')}
            </CmxButton>
          ) : null}
        </div>
      ),
    },
    {
      key: 'priority',
      header: t('columns.priority'),
      sortable: false,
      render: (row) => {
        const label = priorityLabel(row, locale);
        return (
          <CmxStatusBadge
            size="sm"
            tone={priorityTone(row.priority)}
            appearance={row.priority ? 'soft' : 'outline'}
          >
            {label}
          </CmxStatusBadge>
        );
      },
    }
  );

  if (includeScopeColumn) {
    cols.push({
      key: 'scope',
      header: t('columns.scope'),
      sortable: false,
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {t(`scope.${String(row.scope_level || '').toLowerCase()}`)}
        </span>
      ),
    });
  }

  cols.push(
    {
      key: 'reported',
      header: t('columns.reported'),
      sortable: false,
      render: (row) => (
        <OrderIssueActorTimeCell
          byLabel={t('createdBy')}
          whenLabel={t('createdWhen')}
          actorName={row.created_by_name}
          actorId={row.created_by}
          at={row.created_at}
          locale={locale}
        />
      ),
    },
    {
      key: 'resolution',
      header: t('columns.resolution'),
      sortable: false,
      render: (row) => (
        <p className="min-w-[8rem] max-w-xs text-sm whitespace-pre-wrap text-muted-foreground">
          {row.solved_notes?.trim() || '—'}
        </p>
      ),
    },
    {
      key: 'solved',
      header: t('columns.solved'),
      sortable: false,
      render: (row) =>
        row.solved_at || row.status === ORDER_ISSUE_STATUS.SOLVED ? (
          <OrderIssueActorTimeCell
            byLabel={t('solvedBy')}
            whenLabel={t('solvedWhen')}
            actorName={row.solved_by_name}
            actorId={row.solved_by}
            at={row.solved_at}
            locale={locale}
          />
        ) : onSolve ? (
          <CmxButton
            type="button"
            variant="primary"
            size="sm"
            onClick={() => onSolve(row)}
          >
            {t('solve')}
          </CmxButton>
        ) : (
          '—'
        ),
    }
  );

  return cols;
}
