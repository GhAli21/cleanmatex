/**
 * Compact Report Issue dialog for Simple Processing (order-level).
 * Thin wrapper around shared OrderIssueReportDialog.
 */

'use client';

import { OrderIssueReportDialog } from '@features/orders/ui/issues/order-issue-report-dialog';
import { ORDER_ISSUE_SCOPE } from '@/lib/constants/order-issues';

export interface SimpleProcessingIssueDialogProps {
  open: boolean;
  orderId: string;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

/**
 * Nested issue form for Simple Processing header action.
 */
export function SimpleProcessingIssueDialog({
  open,
  orderId,
  onOpenChange,
  onSuccess,
}: SimpleProcessingIssueDialogProps) {
  return (
    <OrderIssueReportDialog
      open={open}
      orderId={orderId}
      scopeLevel={ORDER_ISSUE_SCOPE.ORDER}
      orderItemId={null}
      onOpenChange={onOpenChange}
      onSuccess={onSuccess}
    />
  );
}
