/**
 * POS shift report print preview
 * Route: /dashboard/internal_fin/pos-sessions/[sessionId]/report/print?kind=x|z&layout=thermal|a4
 */
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import { POS_SESSIONS_ACCESS_CONTRACTS } from '@features/pos-sessions/access/pos-sessions-access';
import { PosShiftReportPrintScreen } from '@features/pos-sessions/ui/pos-shift-report-print-screen';

/** Identifies the shift report print preview in browser navigation. */
export const metadata: Metadata = { title: 'POS Shift Report (print)' };

const PRINT_CONTRACT = POS_SESSIONS_ACCESS_CONTRACTS.find(
  (contract) => contract.routePattern === '/dashboard/internal_fin/pos-sessions/[sessionId]/report/print'
);

export default async function PosShiftReportPrintPage() {
  const t = await getTranslations('posSessions');
  const requiredPermission = PRINT_CONTRACT?.page.permissions?.[0] ?? 'pos_session:view';
  const canView = await hasPermissionServer(requiredPermission);

  if (!canView) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <h2 className="font-semibold">{t('accessDeniedTitle')}</h2>
          <p className="mt-1">{t('accessDeniedDescription', { permission: requiredPermission })}</p>
        </div>
      </div>
    );
  }

  return <PosShiftReportPrintScreen />;
}
