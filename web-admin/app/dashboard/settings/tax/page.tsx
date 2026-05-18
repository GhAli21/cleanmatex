import { getTranslations } from 'next-intl/server';
import { getAuthContext } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { TaxSetupClient } from '@features/settings/tax/ui/tax-setup-client';

export default async function TaxSetupPage() {
  const t = await getTranslations('taxSetup');
  const { tenantId } = await getAuthContext();

  const [profiles, exemptions] = await Promise.all([
    withTenantContext(tenantId, () =>
      prisma.org_tax_profiles_cf.findMany({
        where:   { tenant_org_id: tenantId, rec_status: 1 },
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
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('description')}</p>
      </div>
      <TaxSetupClient
        initialProfiles={serializedProfiles}
        initialExemptions={serializedExemptions}
        tenantId={tenantId}
      />
    </div>
  );
}
