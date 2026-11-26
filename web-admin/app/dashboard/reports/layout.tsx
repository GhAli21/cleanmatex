import type { ReactNode } from 'react';
import { getAuthContext } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/db/prisma';
import { businessDateForTimezone } from '@/lib/utils/business-date';
import { readDatabaseInstant, resolveOrganizationTimeZone } from '@/lib/utils/operational-zone.server';
import { ReportsClockProvider } from '@features/reports/ui/reports-clock';
import { ReportsLayoutClient } from './reports-layout-client';

export default async function ReportsLayout({ children }: { children: ReactNode }) {
  const { tenantId } = await getAuthContext();
  const zone = await resolveOrganizationTimeZone(tenantId);
  const today = zone ? businessDateForTimezone(zone, await readDatabaseInstant(prisma)) : '';

  return (
    <ReportsClockProvider zone={zone} today={today}>
      <ReportsLayoutClient>{children}</ReportsLayoutClient>
    </ReportsClockProvider>
  );
}
