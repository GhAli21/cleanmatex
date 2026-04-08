import 'server-only';

import { FEATURE_FLAG_KEYS, requireFeature } from '@/lib/services/feature-flags.service';

/**
 * Ensures ERP-Lite is enabled for the tenant (`erp_lite_enabled`).
 * Call at the start of server-side ERP-Lite domain operations (services, posting engine).
 */
export async function assertErpLiteEnabledForTenant(tenantId: string): Promise<void> {
  await requireFeature(tenantId, FEATURE_FLAG_KEYS.ERP_LITE_ENABLED);
}
