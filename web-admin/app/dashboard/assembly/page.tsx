/**
 * Assembly Screen - Thin Route Shell
 * Renders the RBAC-gated Assembly queue built on WorkflowQueueShell.
 */

import type { Metadata } from 'next';
import { RequireAnyPermission } from '@features/auth/ui/RequirePermission';
import { ORDERS_PERMISSIONS } from '@/lib/constants/permissions/orders-perm';
import { AssemblyListScreen } from '@features/assembly/ui/assembly-list-screen';

export const metadata: Metadata = { title: 'Assembly' };

export default function AssemblyPage() {
  return (
    <RequireAnyPermission permissions={[ORDERS_PERMISSIONS.READ]}>
      <AssemblyListScreen />
    </RequireAnyPermission>
  );
}
