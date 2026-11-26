'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { civilRangeQuery, shiftCivilDate } from '@/lib/utils/operational-time';

interface ReportsClock {
  zone: string | null;
  today: string;
}

const ReportsClockContext = createContext<ReportsClock>({ zone: null, today: '' });

export function ReportsClockProvider({
  zone,
  today,
  children,
}: ReportsClock & { children: ReactNode }) {
  return <ReportsClockContext.Provider value={{ zone, today }}>{children}</ReportsClockContext.Provider>;
}

export function useReportsClock(): ReportsClock {
  return useContext(ReportsClockContext);
}

/** Civil range from the address bar, otherwise the organization day. The query bounds use that zone. */
export function useReportRange(daysBack = 30): {
  zone: string | null;
  today: string;
  startCivil: string;
  endCivil: string;
  query: { start: string; end: string } | null;
} {
  const searchParams = useSearchParams();
  const { zone, today } = useReportsClock();
  const startCivil = searchParams.get('startDate') || (today ? shiftCivilDate(today, -daysBack) : '');
  const endCivil = searchParams.get('endDate') || today;
  const query = zone && startCivil && endCivil ? civilRangeQuery(startCivil, endCivil, zone) : null;
  return { zone, today, startCivil, endCivil, query };
}
