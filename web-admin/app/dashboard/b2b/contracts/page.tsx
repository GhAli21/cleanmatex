/**
 * B2B Contracts List
 * Lists org_b2b_contracts_mst for the tenant
 */

'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@ui/primitives/card';
import { Button } from '@ui/primitives/button';
import { createClient } from '@/lib/supabase/client';

export default function B2BContractsPage() {
  const t = useTranslations('b2b');
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.tenant_id ?? null;

  const { data: contracts, isLoading } = useQuery({
    queryKey: ['b2b-contracts', tenantId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('org_b2b_contracts_mst')
        .select('id, contract_no, customer_id, effective_from, effective_to')
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
          {t('contracts') || 'Contracts'}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('contracts') || 'Contracts'}</CardTitle>
        </CardHeader>
        <CardContent>
          {!contracts?.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-gray-500 mb-4">
                No contracts yet. Create a B2B customer and add contracts from the customer detail page.
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
                    <th className="text-left py-2 px-3">{t('contractNo') || 'Contract No'}</th>
                    <th className="text-left py-2 px-3">{t('effectiveFrom') || 'Effective From'}</th>
                    <th className="text-left py-2 px-3">{t('effectiveTo') || 'Effective To'}</th>
                    <th className="text-left py-2 px-3">{t('actions') || 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.map((c) => (
                    <tr key={c.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-3">{c.contract_no}</td>
                      <td className="py-2 px-3">
                        {c.effective_from ? new Date(c.effective_from).toLocaleDateString() : '-'}
                      </td>
                      <td className="py-2 px-3">
                        {c.effective_to ? new Date(c.effective_to).toLocaleDateString() : '-'}
                      </td>
                      <td className="py-2 px-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.location.assign(`/dashboard/customers/${c.customer_id}`)}
                        >
                          {t('view') || 'View Customer'}
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
