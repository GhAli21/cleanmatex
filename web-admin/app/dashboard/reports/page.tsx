import type { Metadata } from 'next';

/** Names the reports landing route before it redirects to its default report. */
export const metadata: Metadata = { title: 'Reports' };

import { redirect } from 'next/navigation';

/**
 *
 */
export default function ReportsPage() {
  redirect('/dashboard/reports/orders');
}
