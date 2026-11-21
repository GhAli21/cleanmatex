/**
 * Quality Check (QA) Screen - Thin Route Shell
 * Renders the RBAC-gated QA queue built on WorkflowQueueShell.
 */

import type { Metadata } from 'next';
import { RequireAnyPermission } from '@features/auth/ui/RequirePermission';
import { ORDERS_PERMISSIONS } from '@/lib/constants/permissions/orders-perm';
import { QaListScreen } from '@features/qa/ui/qa-list-screen';

export const metadata: Metadata = { title: 'Quality Check' };

export default function QAPage() {
  return (
    <RequireAnyPermission permissions={[ORDERS_PERMISSIONS.READ]}>
      <QaListScreen />
    </RequireAnyPermission>
  );
}
