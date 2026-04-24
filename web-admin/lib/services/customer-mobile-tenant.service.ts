import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

import { normalizePhone } from './customers.service';
import type { TenantPublicProfile } from './tenant-resolve.service';

export async function listCustomerTenantsByPhone(
  phone: string,
): Promise<TenantPublicProfile[]> {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone.isValid) {
    return [];
  }

  try {
    const supabase = await createClient();

    const { data: customers, error: customersError } = await supabase
      .from('org_customers_mst')
      .select('tenant_org_id')
      .eq('phone', normalizedPhone.normalized)
      .eq('is_active', true);

    if (customersError || !customers?.length) {
      return [];
    }

    const tenantIds = Array.from(
      new Set(
        customers
            .map((row) => row.tenant_org_id as string | null)
            .filter((tenantId): tenantId is string => !!tenantId),
      ),
    );

    const { data: tenants, error: tenantsError } = await supabase
      .from('org_tenants_mst')
      .select('id, name, name2, logo_url, brand_color_primary')
      .in('id', tenantIds)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (tenantsError || !tenants) {
      return [];
    }

    return tenants.map((tenant) => ({
      tenantOrgId: tenant.id as string,
      name: (tenant.name as string | null) ?? '',
      name2: (tenant.name2 as string | null) ?? null,
      logoUrl: (tenant.logo_url as string | null) ?? null,
      primaryColor: (tenant.brand_color_primary as string | null) ?? null,
    }));
  } catch (err) {
    logger.error('listCustomerTenantsByPhone failed', { err });
    return [];
  }
}
