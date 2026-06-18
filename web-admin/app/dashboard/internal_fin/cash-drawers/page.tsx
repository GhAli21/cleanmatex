/**
 * Cash Drawers List Page
 *
 * Displays all active cash drawers for the tenant with their current session status.
 * Route: /dashboard/internal_fin/cash-drawers
 */

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getAuthContext } from '@/lib/auth/server-auth';
import { getDrawers } from '@/lib/services/cash-drawer.service';
import { withTenantContext } from '@/lib/db/tenant-context';
import { prisma } from '@/lib/db/prisma';

/**
 *
 */
export default async function CashDrawersPage() {
  const t = await getTranslations('billing.cashDrawers');

  let tenantId: string;
  try {
    const auth = await getAuthContext();
    tenantId = auth.tenantId;
  } catch (error) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error instanceof Error ? error.message : 'Authentication failed. Please log in again.'}
        </div>
      </div>
    );
  }

  let drawers: Awaited<ReturnType<typeof getDrawers>> = [];
  try {
    drawers = await getDrawers(tenantId);
  } catch (error) {
    return (
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="mt-1 text-gray-600">{t('description')}</p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error instanceof Error ? error.message : 'Failed to load drawers'}
        </div>
      </div>
    );
  }

  /** Fetch open-session status for all drawers in one query */
  const openSessions = drawers.length
    ? await withTenantContext(tenantId, () =>
        prisma.org_cash_drawer_sessions_mst.findMany({
          where: { tenant_org_id: tenantId, cash_drawer_id: { in: drawers.map((d) => d.id) }, status: 'OPEN' },
          select: { cash_drawer_id: true, id: true, session_no: true },
        })
      )
    : [];

  const openSessionMap = new Map(openSessions.map((s) => [s.cash_drawer_id, s]));

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="mt-1 text-gray-600">{t('description')}</p>
      </div>

      {drawers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 py-16 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          <p className="mt-4 text-sm text-gray-500">{t('noDrawers')}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Currency</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('sessionStatus')}</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {drawers.map((drawer) => {
                const openSession = openSessionMap.get(drawer.id);
                return (
                  <tr key={drawer.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {drawer.drawer_name}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                      <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                        {drawer.drawer_type}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                      {drawer.currency_code}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      {openSession ? (
                        <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                          Open [{openSession.session_no}]
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                          Closed
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                      <Link
                        href={`/dashboard/internal_fin/cash-drawers/${drawer.id}`}
                        className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
