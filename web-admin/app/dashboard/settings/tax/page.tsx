import { getAuthContext } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { TaxSetupClient } from '@features/settings/tax/ui/tax-setup-client';
import { TaxSettingsScreen } from '@features/tax/ui/tax-settings-screen';
import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { SETTINGS_SETTINGS_TAX_ACCESS } from '@features/settings/access/settings-access'
import type { Metadata } from 'next'

/** Keeps browser history identifiable without coupling it to the brand suffix. */
export const metadata: Metadata = { title: 'Tax Setup' }

/** Loads the tenant-scoped tax setup surface. */
export default async function TaxSetupPage() {
  const { tenantId } = await getAuthContext();

  const [profiles, exemptions] = await Promise.all([
    withTenantContext(tenantId, () =>
      prisma.org_tax_profiles_cf.findMany({
        where:   { tenant_org_id: tenantId, rec_status: 1, source: 'TENANT' },
        orderBy: { created_at: 'asc' },
      })
    ),
    withTenantContext(tenantId, () =>
      prisma.org_tax_exemptions_cf.findMany({
        where:   { tenant_org_id: tenantId, rec_status: 1, is_active: true },
        orderBy: { created_at: 'asc' },
      })
    ),
  ]);

  const serializedProfiles = profiles.map((p) => ({
    ...p,
    rate:         Number(p.rate),
    effective_from: p.effective_from.toISOString(),
    effective_to:   p.effective_to?.toISOString() ?? null,
    created_at:   p.created_at.toISOString(),
    updated_at:   p.updated_at?.toISOString() ?? null,
  }));

  const serializedExemptions = exemptions.map((e) => ({
    ...e,
    valid_from: e.valid_from.toISOString(),
    valid_to:   e.valid_to?.toISOString() ?? null,
    created_at: e.created_at.toISOString(),
    updated_at: e.updated_at?.toISOString() ?? null,
  }));

  return (
    <RequireAnyPermission permissions={SETTINGS_SETTINGS_TAX_ACCESS.page.permissions ?? []}>
      <TaxSettingsScreen
        currentOrderTax={
          <TaxSetupClient initialProfiles={serializedProfiles} initialExemptions={serializedExemptions} />
        }
      />
    </RequireAnyPermission>
  );
}
