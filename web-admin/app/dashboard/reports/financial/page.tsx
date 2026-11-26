import type { Metadata } from 'next';

/** Distinguishes finance-focused reporting from operational report screens. */
export const metadata: Metadata = { title: 'Financial Reports' };

import { getTranslations } from 'next-intl/server';
import { getAuthContext } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/db/prisma';
import { businessDateForTimezone } from '@/lib/utils/business-date';
import { readDatabaseInstant, resolveOrganizationTimeZone } from '@/lib/utils/operational-zone.server';
import { shiftCivilDate } from '@/lib/utils/operational-time';
import { FinancialReportsClient } from '@features/reports/ui/financial-reports-client';
import { MoneyPositionCardsRprt } from '@features/reports/ui/money-position-cards-rprt';

/**
 * Financial reports hub — money-position glance row (canonical ledgers) above
 * the orders/payments/tax report tabs.
 */
export default async function FinancialReportsPage() {
  const t = await getTranslations('reports.financial');
  const { tenantId } = await getAuthContext();
  const opsZone = await resolveOrganizationTimeZone(tenantId);
  const today = opsZone ? businessDateForTimezone(opsZone, await readDatabaseInstant(prisma)) : '';

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('description')}</p>
      </div>
      <MoneyPositionCardsRprt />
      <FinancialReportsClient
        opsZone={opsZone}
        initialFrom={today ? shiftCivilDate(today, -30) : ''}
        initialTo={today}
      />
    </div>
  );
}
