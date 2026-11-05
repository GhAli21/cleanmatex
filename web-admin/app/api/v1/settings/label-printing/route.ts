/**
 * Label printing settings (HFC P4, migration 0685, decisions A-46..A-49).
 *
 * GET  /api/v1/settings/label-printing?branchId=<uuid>  (settings:read)
 *   -> { success, data: { systemDefaults, tenantOverrides, branchOverrides, effective } }
 *      branchId absent = tenant-wide scope. effective = fn_label_printing_resolve for that scope.
 * PUT  /api/v1/settings/label-printing  (CSRF, settings:update, tenant rate limit)
 *   body { branchId: uuid | null, rows: [{ labelType, sizeCode, showQr, showCustomerName, showOrderBarcode, copies }] }
 *   null value = use the default; a row with only nulls is removed. Returns the same payload as GET.
 *
 * Errors: 400 VALIDATION_ERROR (bad body or branchId), 404 BRANCH_NOT_FOUND (not a branch of the tenant), 500.
 * Labels are available to every tenant: there is no feature-flag gate here.
 */
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { checkAPIRateLimitTenant } from '@/lib/middleware/rate-limit';
import { validateCSRF } from '@/lib/middleware/csrf';
import { logger } from '@/lib/utils/logger';
import { SETTINGS_PERMISSIONS } from '@/lib/constants/permissions/settings-perm';
import { LabelPrintingConfigService } from '@/lib/services/labels/label-printing-config.service';
import { labelPrintingSaveSchema, parseBranchIdParam } from '@/lib/validations/label-printing-schemas';
import type { SupabaseClient } from '@supabase/supabase-js';

const NO_STORE = { 'Cache-Control': 'no-store' };

function fail(code: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ success: false, error: code, ...extra }, { status, headers: NO_STORE });
}

async function branchBelongsToTenant(supabase: SupabaseClient, tenantId: string, branchId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('org_branches_mst')
    .select('id')
    .eq('tenant_org_id', tenantId)
    .eq('id', branchId)
    .maybeSingle();
  if (error) throw new Error(`label printing: branch lookup failed: ${error.message}`);
  return Boolean(data);
}

/** Defaults, overrides and effective label settings for the tenant or one branch. */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(SETTINGS_PERMISSIONS.READ)(request);
    if (auth instanceof NextResponse) return auth;

    const branchId = parseBranchIdParam(request.nextUrl.searchParams.get('branchId'));
    if (branchId === undefined) return fail('VALIDATION_ERROR', 400);

    const supabase = await createClient();
    if (branchId && !(await branchBelongsToTenant(supabase, auth.tenantId, branchId))) {
      return fail('BRANCH_NOT_FOUND', 404);
    }
    const data = await LabelPrintingConfigService.getConfig(supabase, auth.tenantId, branchId);
    return NextResponse.json({ success: true, data }, { headers: NO_STORE });
  } catch (err) {
    logger.error('GET /settings/label-printing failed', err instanceof Error ? err : new Error(String(err)), {});
    return fail('LOAD_FAILED', 500);
  }
}

/** Saves the overrides of one scope (tenant-wide or one branch). */
export async function PUT(request: NextRequest) {
  try {
    const csrfResponse = await validateCSRF(request);
    if (csrfResponse) return csrfResponse;

    const auth = await requirePermission(SETTINGS_PERMISSIONS.UPDATE)(request);
    if (auth instanceof NextResponse) return auth;
    const { tenantId, userId } = auth;

    const rl = await checkAPIRateLimitTenant(tenantId);
    if (rl) return rl;

    const raw = await request.json().catch(() => null);
    const parsed = labelPrintingSaveSchema.safeParse(raw);
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', 400, {
        issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    const { branchId, rows } = parsed.data;

    const supabase = await createClient();
    if (branchId && !(await branchBelongsToTenant(supabase, tenantId, branchId))) {
      return fail('BRANCH_NOT_FOUND', 404);
    }

    await LabelPrintingConfigService.saveOverrides(supabase, {
      tenantId,
      branchId,
      userId,
      userInfo: request.headers.get('user-agent') ?? undefined,
      rows: rows.map((r) => ({
        labelType: r.labelType,
        sizeCode: r.sizeCode ?? null,
        showQr: r.showQr ?? null,
        showCustomerName: r.showCustomerName ?? null,
        showOrderBarcode: r.showOrderBarcode ?? null,
        copies: r.copies ?? null,
      })),
    });
    revalidatePath('/dashboard/settings/labels');

    const data = await LabelPrintingConfigService.getConfig(supabase, tenantId, branchId);
    return NextResponse.json({ success: true, data }, { headers: NO_STORE });
  } catch (err) {
    logger.error('PUT /settings/label-printing failed', err instanceof Error ? err : new Error(String(err)), {});
    return fail('SAVE_FAILED', 500);
  }
}
