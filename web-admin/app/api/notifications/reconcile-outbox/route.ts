/**
 * POST /api/notifications/reconcile-outbox
 * Internal-only, scheduler-invoked reconciliation pass for outbox rows whose
 * provider acceptance is uncertain or whose claim lease expired without a
 * recorded outcome (production implementation plan section 8.2 step 6).
 * Authorization: Bearer {NOTIFICATIONS_OUTBOX_SECRET} — reuses the same
 * trust boundary as process-outbox since both are internal, scheduler-only,
 * never browser-invocable endpoints operating on the same tenant outbox.
 *
 * This route never dispatches a notification itself; it only resolves rows
 * the live processor already left in a held state. See
 * lib/notifications/reconciliation-service.ts for the resolution logic.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { reconcileTenantOutbox } from '@lib/notifications/reconciliation-service';

/**
 * Verifies the internal scheduler bearer secret without exposing it to logs.
 * @param request Internal pg_net/cron request.
 * @returns Whether the request may run reconciliation.
 */
function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.NOTIFICATIONS_OUTBOX_SECRET;
  if (!secret) return false;
  const authHeader = request.headers.get('authorization') ?? '';
  return authHeader === `Bearer ${secret}`;
}

/**
 * POST /api/notifications/reconcile-outbox
 *
 * Reconciles stuck outbox rows for every active tenant organization. Each
 * tenant is processed independently so one tenant's provider/credential
 * problem cannot block reconciliation for any other tenant.
 * @param request Internal POST carrying the server-side outbox secret.
 * @returns Per-tenant inspected/resolved totals, or an authorization/discovery failure.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();

  // org_tenants_mst identifies its tenant by id and has no tenant_org_id column.
  const { data: tenants, error: tenantError } = await supabase
    .from('org_tenants_mst')
    .select('id')
    .eq('is_active', true)
    .eq('rec_status', 1);

  if (tenantError) {
    logger.error('reconcile-outbox: failed to resolve active tenants', new Error(tenantError.message), {
      feature: 'notifications',
    });
    return NextResponse.json({ error: 'DB error fetching active tenants' }, { status: 500 });
  }

  const tenantIds = (tenants ?? []).map((tenant) => tenant.id);
  let inspected = 0;
  let errors = 0;
  const perTenant: Array<{ tenantOrgId: string; inspected: number }> = [];

  for (const tenantOrgId of tenantIds) {
    try {
      const summary = await reconcileTenantOutbox(tenantOrgId);
      inspected += summary.inspected;
      perTenant.push({ tenantOrgId, inspected: summary.inspected });
      if (summary.inspected > 0) {
        logger.info('reconcile-outbox: tenant pass complete', {
          tenantOrgId,
          inspected: summary.inspected,
          outcomes: summary.results.map((r) => r.outcome),
          feature: 'notifications',
        });
      }
    } catch (error) {
      errors++;
      logger.error('reconcile-outbox: tenant pass failed', error instanceof Error ? error : new Error(String(error)), {
        tenantOrgId, feature: 'notifications',
      });
    }
  }

  return NextResponse.json({ success: true, tenants: tenantIds.length, inspected, errors, perTenant });
}
