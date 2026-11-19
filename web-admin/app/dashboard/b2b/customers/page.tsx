/**
 * B2B Customers List screen
 * Filtered org_customers_mst where type = 'b2b'
 */

'use client';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle, CmxButton } from '@ui/primitives';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';


import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { B2B_B2B_CUSTOMERS_ACCESS } from '@features/b2b/access/b2b-access'

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
      return data ?? [];
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {t('customers') || 'B2B Customers'}
        </h1>
        <CmxButton variant="primary" onClick={() => router.push('/dashboard/b2b/customers/new')}>
          {t('createB2BCustomer') || 'Create B2B Customer'}
        </CmxButton>
      </div>

      <CmxCard>
        <CmxCardHeader>
          <CmxCardTitle>{t('customers') || 'B2B Customers'}</CmxCardTitle>
        </CmxCardHeader>
        <CmxCardContent>
          {!customers?.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground mb-4">
                {t('noCustomers') || 'No B2B customers yet. Create one to get started.'}
              </p>
              <CmxButton
                onClick={() => router.push('/dashboard/b2b/customers/new')}
                variant="primary"
              >
                {t('createB2BCustomer') || 'Create B2B Customer'}
              </CmxButton>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-start py-2 px-3">{t('company') || 'Company'}</th>
                    <th className="text-start py-2 px-3">{t('phone') || 'Phone'}</th>
                    <th className="text-start py-2 px-3">{t('creditLimit') || 'Credit Limit'}</th>
                    <th className="text-start py-2 px-3">{t('actions') || 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.id} className="border-b hover:bg-muted">
                      <td className="py-2 px-3">
                        {c.company_name || c.display_name || c.name || '-'}
                      </td>
                      <td className="py-2 px-3">{c.phone || '-'}</td>
                      <td className="py-2 px-3">
                        {c.credit_limit != null ? Number(c.credit_limit).toLocaleString() : '-'}
                      </td>
                      <td className="py-2 px-3">
                        <CmxButton
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/dashboard/b2b/customers/${c.id}`)}
                        >
                          {t('view') || 'View'}
                        </CmxButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CmxCardContent>
      </CmxCard>
    </div>
  );
}
