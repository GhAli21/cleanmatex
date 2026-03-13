/**
 * B2B Statements List
 * Lists org_b2b_statements_mst for the tenant
 */

'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@ui/primitives/card';
import { Button } from '@ui/primitives/button';
import { createClient } from '@/lib/supabase/client';

export default function B2BStatementsPage() {
  const t = useTranslations('b2b');
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id ?? null;

  const { data: statements, isLoading } = useQuery({
    queryKey: ['b2b-statements', tenantId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('org_b2b_statements_mst')
        .select('id, statement_no, customer_id, period_from, period_to, due_date, total_amount, paid_amount, balance_amount, status_cd')
        .eq('tenant_org_id', tenantId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenantId && !!currentTenant,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded w-1/4 animate-pulse" />
        <div className="h-64 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {t('statements') || 'Statements'}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('statements') || 'Statements'}</CardTitle>
        </CardHeader>
        <CardContent>
          {!statements?.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-gray-500 mb-4">
                No statements yet. Generate a statement from a B2B customer detail page.
              </p>
              <Button
                variant="default"
                onClick={() => window.location.assign('/dashboard/b2b/customers')}
              >
                {t('goToCustomers') || 'Go to B2B Customers'}
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3">{t('statementNo') || 'Statement No'}</th>
                    <th className="text-left py-2 px-3">{t('periodFrom') || 'Period From'}</th>
                    <th className="text-left py-2 px-3">{t('periodTo') || 'Period To'}</th>
                    <th className="text-left py-2 px-3">{t('dueDate') || 'Due Date'}</th>
                    <th className="text-left py-2 px-3">{t('totalAmount') || 'Total'}</th>
                    <th className="text-left py-2 px-3">{t('balanceAmount') || 'Balance'}</th>
                    <th className="text-left py-2 px-3">{t('actions') || 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {statements.map((s) => (
                    <tr key={s.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-3">{s.statement_no}</td>
                      <td className="py-2 px-3">
                        {s.period_from ? new Date(s.period_from).toLocaleDateString() : '-'}
                      </td>
                      <td className="py-2 px-3">
                        {s.period_to ? new Date(s.period_to).toLocaleDateString() : '-'}
                      </td>
                      <td className="py-2 px-3">
                        {s.due_date ? new Date(s.due_date).toLocaleDateString() : '-'}
                      </td>
                      <td className="py-2 px-3">
                        {s.total_amount != null ? Number(s.total_amount).toLocaleString() : '-'}
                      </td>
                      <td className="py-2 px-3">
                        {s.balance_amount != null ? Number(s.balance_amount).toLocaleString() : '-'}
                      </td>
                      <td className="py-2 px-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.location.assign(`/dashboard/customers/${s.customer_id}`)}
                        >
                          {t('view') || 'View'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
