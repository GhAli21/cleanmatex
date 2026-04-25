import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

export interface BranchPublicProfile {
  id: string;
  name: string;
  name2: string | null;
  isMain: boolean;
  address: string | null;
  area: string | null;
  city: string | null;
}

export interface TenantPublicProfile {
  tenantOrgId: string;
  name: string;
  name2: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  branches?: BranchPublicProfile[];
}

export async function resolveTenantBySlug(
  slug: string,
): Promise<TenantPublicProfile | null> {
  if (!slug) return null;

  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('org_tenants_mst')
      .select('id, name, name2, logo_url, brand_color_primary, slug')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      tenantOrgId: data.id as string,
      name: (data.name as string) ?? '',
      name2: (data.name2 as string | null) ?? null,
      logoUrl: (data.logo_url as string | null) ?? null,
      primaryColor: (data.brand_color_primary as string | null) ?? null,
    };
  } catch (err) {
    logger.error('resolveTenantBySlug failed', { slug, err });
    return null;
  }
}
