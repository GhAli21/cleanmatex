'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { civilDateInZone, civilDateInputValue, civilRangeQuery, formatCivilDate, shiftCivilDate } from '@/lib/utils/operational-time';

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

/** Civil day of an instant in the organization zone. A missing zone shows no day. */
export function ReportInstantDay({ value }: { value?: string | null }) {
  const { zone } = useReportsClock();
  const locale = useLocale();
  const day = civilDateInZone(value, zone);
  return <>{day ? formatCivilDate(day, locale) : '-'}</>;
}

/** A stored civil date. The UTC calendar day of a date column stays that day. */
export function ReportCivilDay({ value }: { value?: string | null }) {
  const locale = useLocale();
  const day = civilDateInputValue(value);
  return <>{day ? formatCivilDate(day, locale) : '-'}</>;
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
