import { getTranslations } from 'next-intl/server';
import { ReconciliationReportsClient } from '@features/reports/ui/reconciliation-reports-client';
import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { REPORTS_REPORTS_RECONCILIATION_ACCESS } from '@features/reports/access/reports-access'

/**
 * D-09 — Reconciliation Reports page. Four launch-required reconciliation views:
 * unallocated excess / customer stored-value liability, B2B statement payments,
 * overpayment dispositions, and cash drawer movements. Read-only.
 */
export default async function ReconciliationReportsPage() {
  const t = await getTranslations('reports.reconciliation');

  return (
    <RequireAnyPermission permissions={REPORTS_REPORTS_RECONCILIATION_ACCESS.page.permissions ?? []}>
      <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('description')}</p>
      </div>
      <ReconciliationReportsClient />
    </div>
    </RequireAnyPermission>
  );
}
