/**
 * B2B Customers List screen
 * Filtered org_customers_mst where type = 'b2b'
 */

'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CmxButton } from '@ui/primitives';
import { CmxDataTable, type CmxDataTableSimpleColumn } from '@ui/data-display/cmx-datatable';
import { CmxCrudPageShell } from '@ui/patterns/cmx-crud-page-shell';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { RequireAnyPermission } from '@features/auth/ui/RequirePermission';
import { B2B_B2B_CUSTOMERS_ACCESS } from '@features/b2b/access/b2b-access';

interface B2BCustomerRow {
  id: string;
  name: string | null;
  name2: string | null;
  display_name: string | null;
  phone: string | null;
  company_name: string | null;
  company_name2: string | null;
  credit_limit: number | null;
  payment_terms_days: number | null;
}

/**
 *
 */
export default function B2BCustomersPage() {
  const t = useTranslations('b2b');
  const router = useRouter();
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.tenant_id ?? null;

  const { data: customers, isLoading } = useQuery({
    queryKey: ['b2b-customers', tenantId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('org_customers_mst')
        .select('id, name, name2, display_name, phone, company_name, company_name2, credit_limit, payment_terms_days')
        .eq('tenant_org_id', tenantId)
        .eq('type', 'b2b')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as B2BCustomerRow[];
    },
    enabled: !!tenantId && !!currentTenant,
  });

  if (isLoading) {
    return (
      <RequireAnyPermission permissions={B2B_B2B_CUSTOMERS_ACCESS.page.permissions ?? []}>
        <div className="space-y-6">
          <div className="h-8 bg-muted rounded w-1/4 animate-pulse" />
          <div className="h-64 bg-muted rounded animate-pulse" />
        </div>
      </RequireAnyPermission>
    );
  }

  const columns: CmxDataTableSimpleColumn<B2BCustomerRow>[] = [
    {
      key: 'company',
      header: t('company') || 'Company',
      sortable: false,
      render: (c) => c.company_name || c.display_name || c.name || '—',
    },
    {
      key: 'phone',
      header: t('phone') || 'Phone',
      sortable: false,
      render: (c) => (c.phone ? <bdi dir="ltr" className="tabular-nums">{c.phone}</bdi> : '—'),
    },
    {
      key: 'credit_limit',
      header: t('creditLimit') || 'Credit Limit',
      align: 'end',
      sortable: false,
      render: (c) =>
        c.credit_limit != null ? (
          <bdi dir="ltr" className="tabular-nums">{Number(c.credit_limit).toLocaleString()}</bdi>
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
          onClick={() => router.push(`/dashboard/b2b/customers/${c.id}`)}
        >
          {t('view') || 'View'}
        </CmxButton>
      ),
    },
  ];

  return (
    <RequireAnyPermission permissions={B2B_B2B_CUSTOMERS_ACCESS.page.permissions ?? []}>
      <CmxCrudPageShell
        title={t('customers') || 'B2B Customers'}
        actions={
          <CmxButton variant="primary" onClick={() => router.push('/dashboard/b2b/customers/new')}>
            {t('createB2BCustomer') || 'Create B2B Customer'}
          </CmxButton>
        }
      >
        <CmxDataTable<B2BCustomerRow>
          columns={columns}
          data={customers ?? []}
          auditConfig={false}
          scrollable={false}
          paginationFooter="never"
          emptyStateTitle={t('noCustomers') || 'No B2B customers yet. Create one to get started.'}
          emptyStateAction={
            <CmxButton
              onClick={() => router.push('/dashboard/b2b/customers/new')}
              variant="primary"
            >
              {t('createB2BCustomer') || 'Create B2B Customer'}
            </CmxButton>
          }
        />
      </CmxCrudPageShell>
    </RequireAnyPermission>
  );
}
