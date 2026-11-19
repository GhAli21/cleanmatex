/**
 * B2B Contracts List
 * Lists org_b2b_contracts_mst for the tenant; create new contracts via dialog.
 */

'use client';
import { CmxButton } from '@ui/primitives';
import { CmxDataTable, type CmxDataTableSimpleColumn } from '@ui/data-display/cmx-datatable';
import { CmxCrudPageShell } from '@ui/patterns/cmx-crud-page-shell';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth/auth-context';
import { useHasAnyPermission } from '@/lib/hooks/usePermissions';


import { createClient } from '@/lib/supabase/client';
import { B2bCreateContractDialog } from '@/src/features/b2b/ui/b2b-create-contract-dialog';
import { B2B_CONTRACTS_ACCESS } from '@features/b2b/access/b2b-access';
import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'

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

/**
 *
 */
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
        <div className="h-8 bg-muted rounded w-1/4 animate-pulse" />
        <div className="h-64 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  const columns: CmxDataTableSimpleColumn<ContractRow>[] = [
    {
      key: 'contract_no',
      header: t('contractNo') || 'Contract No',
      sortable: false,
      render: (c) => <bdi dir="ltr">{c.contract_no}</bdi>,
    },
    {
      key: 'company',
      header: t('company'),
      sortable: false,
      render: (c) => customerLabelById.get(c.customer_id) ?? '—',
    },
    {
      key: 'effective_from',
      header: t('effectiveFrom') || 'Effective From',
      sortable: false,
      render: (c) =>
        c.effective_from ? (
          <bdi dir="ltr" className="tabular-nums">{new Date(c.effective_from).toLocaleDateString()}</bdi>
        ) : (
          '—'
        ),
    },
    {
      key: 'effective_to',
      header: t('effectiveTo') || 'Effective To',
      sortable: false,
      render: (c) =>
        c.effective_to ? (
          <bdi dir="ltr" className="tabular-nums">{new Date(c.effective_to).toLocaleDateString()}</bdi>
        ) : (
          '—'
        ),
    },
    {
      key: 'actions',
      header: t('actions') || 'Actions',
      align: 'end',
      sortable: false,
      render: (c) => (
        <CmxButton
          variant="outline"
          size="sm"
          onClick={() => window.location.assign(`/dashboard/b2b/customers/${c.customer_id}`)}
        >
          {t('view') || 'View Customer'}
        </CmxButton>
      ),
    },
  ];

  return (
    <RequireAnyPermission permissions={B2B_CONTRACTS_ACCESS.page.permissions ?? []}>
      <CmxCrudPageShell
        title={t('contracts') || 'Contracts'}
        actions={
          canCreate ? (
            <CmxButton type="button" variant="primary" onClick={() => setCreateOpen(true)}>
              {t('createContract')}
            </CmxButton>
          ) : undefined
        }
      >
        <CmxDataTable<ContractRow>
          columns={columns}
          data={contracts ?? []}
          auditConfig={false}
          scrollable={false}
          paginationFooter="never"
          emptyStateDescription={contractsListEmptyHint}
          emptyStateAction={
            <div className="flex flex-wrap justify-center gap-2">
              {canCreate ? (
                <CmxButton type="button" variant="primary" onClick={() => setCreateOpen(true)}>
                  {t('createContract')}
                </CmxButton>
              ) : null}
              <CmxButton
                type="button"
                variant={canCreate ? 'outline' : 'primary'}
                onClick={() => window.location.assign('/dashboard/b2b/customers')}
              >
                {t('goToCustomers') || 'Go to B2B Customers'}
              </CmxButton>
            </div>
          }
        />

        {canCreate ? (
          <B2bCreateContractDialog open={createOpen} onOpenChange={setCreateOpen} />
        ) : null}
      </CmxCrudPageShell>
    </RequireAnyPermission>
  );
}
