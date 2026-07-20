/**
 * Report button + status badge for order/item/piece rows.
 */

'use client';

import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { CmxButton } from '@ui/primitives';
import { Tooltip } from '@ui/primitives/tooltip';
import { OrderIssueStatusBadge } from './order-issue-status-badge';
import { OrderIssuesListDialog } from './order-issues-list-dialog';
import { OrderIssueReportDialog } from './order-issue-report-dialog';
import { ORDER_ISSUE_SCOPE, type OrderIssueScope } from '@/lib/constants/order-issues';

export interface OrderIssueRowActionsProps {
  orderId: string;
  scopeLevel: OrderIssueScope;
  orderItemId?: string | null;
  orderItemPieceId?: string | null;
  openCount?: number;
  totalCount?: number;
  /** When only has_issue is known (list rows): treat as open=1 total=1 if true */
  hasOpenIssue?: boolean;
  onChanged?: () => void;
  compact?: boolean;
}

/**
 * Always-available Report + optional red/green badge.
 */
export function OrderIssueRowActions({
  orderId,
  scopeLevel,
  orderItemId,
  orderItemPieceId,
  openCount,
  totalCount,
  hasOpenIssue,
  onChanged,
  compact = true,
}: OrderIssueRowActionsProps) {
  const t = useTranslations('orders.issues');
  const [listOpen, setListOpen] = React.useState(false);
  const [reportOpen, setReportOpen] = React.useState(false);

  const resolvedOpen =
    openCount ?? (hasOpenIssue ? 1 : 0);
  const resolvedTotal =
    totalCount ?? (hasOpenIssue ? 1 : 0);

  return (
    <div className="inline-flex items-center gap-1.5">
      <OrderIssueStatusBadge
        openCount={resolvedOpen}
        totalCount={resolvedTotal}
        size={compact ? 'sm' : 'md'}
        onClick={() => setListOpen(true)}
      />
      <Tooltip content={t('reportTitle')}>
        <CmxButton
          type="button"
          variant="ghost"
          size="xs"
          className="inline-flex items-center gap-1"
          onClick={(e) => {
            e.stopPropagation();
            setReportOpen(true);
          }}
          aria-label={t('reportTitle')}
        >
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          {!compact ? <span>{t('reportTitle')}</span> : null}
        </CmxButton>
      </Tooltip>

      <OrderIssuesListDialog
        open={listOpen}
        orderId={orderId}
        scopeLevel={scopeLevel}
        orderItemId={orderItemId}
        orderItemPieceId={orderItemPieceId}
        onOpenChange={setListOpen}
        onChanged={onChanged}
      />
      <OrderIssueReportDialog
        open={reportOpen}
        orderId={orderId}
        scopeLevel={scopeLevel}
        orderItemId={orderItemId}
        orderItemPieceId={orderItemPieceId}
        onOpenChange={setReportOpen}
        onSuccess={onChanged}
      />
    </div>
  );
}

export { ORDER_ISSUE_SCOPE };
