/**
 * B2B Contracts List
 * Lists org_b2b_contracts_mst for the tenant; create new contracts via dialog.
 */

'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth/auth-context';
import { useHasAnyPermission } from '@/lib/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@ui/primitives/card';
import { Button } from '@ui/primitives/button';
import { createClient } from '@/lib/supabase/client';
import { B2bCreateContractDialog } from '@/src/features/b2b/ui/b2b-create-contract-dialog';
import { B2B_CONTRACTS_ACCESS } from '@/src/features/b2b/access/b2b-contracts-access';

type ContractRow = {
  id: string;
  contract_no: string;
  customer_id: string;
  effective_from: string | null;
  effective_to: string | null;
};

type B2bCustomerRow = {
  id: string;
  company_name: string | null;
  display_name: string | null;
};

export default function B2BContractsPage() {
  const t = useTranslations('b2b');
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.tenant_id ?? null;
  const createContractRequirement =
    B2B_CONTRACTS_ACCESS.actions?.createContract.requirement.permissions ?? [];
  const canCreate = useHasAnyPermission(createContractRequirement);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: contracts, isLoading } = useQuery({
    queryKey: ['b2b-contracts', 'list', tenantId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('org_b2b_contracts_mst')
        .select('id, contract_no, customer_id, effective_from, effective_to')
        .eq('tenant_org_id', tenantId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ContractRow[];
    },
    enabled: !!tenantId && !!currentTenant,
  });

  const {
    data: b2bCustomers,
    isPending: b2bCustomersPending,
  } = useQuery({
    queryKey: ['b2b-customers', tenantId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('org_customers_mst')
        .select('id, company_name, display_name')
        .eq('tenant_org_id', tenantId)
        .eq('type', 'b2b')
        .eq('is_active', true);
      if (error) throw error;
      return (data ?? []) as B2bCustomerRow[];
    },
    enabled: !!tenantId && !!currentTenant,
  });

  const b2bCustomerRows = b2bCustomers ?? [];

  const contractsListEmptyHint = b2bCustomersPending
    ? t('contractsListEmptyHintPending')
    : b2bCustomerRows.length === 0
      ? t('contractsListEmptyHintNoCustomers')
      : t('contractsListEmptyHintHasCustomers');

  const customerLabelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of b2bCustomerRows) {
      m.set(c.id, c.company_name || c.display_name || c.id);
    }
    return m;
  }, [b2bCustomerRows]);

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">
          {t('contracts') || 'Contracts'}
        </h1>
        {canCreate ? (
          <Button type="button" variant="default" onClick={() => setCreateOpen(true)}>
            {t('createContract')}
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('contracts') || 'Contracts'}</CardTitle>
        </CardHeader>
        <CardContent>
          {!contracts?.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-gray-500 mb-4 max-w-md">
                {contractsListEmptyHint}
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {canCreate ? (
                  <Button type="button" variant="default" onClick={() => setCreateOpen(true)}>
                    {t('createContract')}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant={canCreate ? 'outline' : 'default'}
                  onClick={() => window.location.assign('/dashboard/b2b/customers')}
                >
                  {t('goToCustomers') || 'Go to B2B Customers'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3">{t('contractNo') || 'Contract No'}</th>
                    <th className="text-left py-2 px-3">{t('company')}</th>
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
                        {customerLabelById.get(c.customer_id) ?? '—'}
                      </td>
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
                          onClick={() =>
                            window.location.assign(`/dashboard/b2b/customers/${c.customer_id}`)
                          }
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

      {canCreate ? (
        <B2bCreateContractDialog open={createOpen} onOpenChange={setCreateOpen} />
      ) : null}
    </div>
  );
}
