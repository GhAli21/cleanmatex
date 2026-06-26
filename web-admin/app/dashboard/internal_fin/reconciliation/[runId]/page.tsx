/**
 * Reconciliation Run Detail Page
 *
 * Shows the full details and issues for a single reconciliation run.
 * Route: /dashboard/internal_fin/reconciliation/[runId]
 *
 * BVM Phase 4 §24.3 UI Cmx migration:
 *   - Raw arrow-prefixed `<Link>` back-button → `CmxButton asChild` with an
 *     `ArrowLeft` icon that flips via `rtl:rotate-180`.
 *   - Inline red error panel → `CmxSummaryMessage variant="error"`.
 *   - Mojibake `â†` characters replaced with the proper `ArrowLeft` icon.
 */

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { getReconRunAction } from '@/app/actions/billing/reconciliation-actions';
import ReconciliationDetailClient from '@features/billing/ui/reconciliation-detail-client';
import { CmxButton } from '@ui/primitives';
import { CmxSummaryMessage } from '@ui/feedback';
import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { BILLING_INTERNAL_FIN_RECONCILIATION_ACCESS } from '@features/billing/access/billing-access'

interface PageProps {
  params: Promise<{ runId: string }>;
}

/**
 *
 * @param root0
 * @param root0.params
 */
export default async function ReconciliationDetailPage({ params }: PageProps) {
  const t = await getTranslations('billing.reconciliation');
  const { runId } = await params;

  const result = await getReconRunAction(runId);

  if (!result.success) {
    return (
    <RequireAnyPermission permissions={BILLING_INTERNAL_FIN_RECONCILIATION_ACCESS.page.permissions ?? []}>
      <div className="space-y-4 p-6">
        <CmxButton asChild variant="ghost" size="sm">
          <Link href="/dashboard/internal_fin/reconciliation" className="inline-flex items-center gap-2">
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
            {t('title')}
          </Link>
        </CmxButton>
        <CmxSummaryMessage type="error" title={result.error} items={[]} />
      </div>
    </RequireAnyPermission>
  );
  }

  return (
    <div className="space-y-6 p-6">
      <CmxButton asChild variant="ghost" size="sm">
        <Link href="/dashboard/internal_fin/reconciliation" className="inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t('title')}
        </Link>
      </CmxButton>

      <ReconciliationDetailClient run={result.data} />
    </div>
  );
}
