import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

export interface TenantPublicProfile {
  tenantOrgId: string;
  name: string;
  name2: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
}

export async function resolveTenantBySlug(
  slug: string,
): Promise<TenantPublicProfile | null> {
  if (!slug) return null;

  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('sys_org_mst')
      .select('org_id, name, name2, logo_url, primary_color, slug')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      tenantOrgId: data.org_id as string,
      name: (data.name as string) ?? '',
      name2: (data.name2 as string | null) ?? null,
      logoUrl: (data.logo_url as string | null) ?? null,
      primaryColor: (data.primary_color as string | null) ?? null,
    };
  } catch (err) {
    logger.error('resolveTenantBySlug failed', { slug, err });
    return null;
  }
}
