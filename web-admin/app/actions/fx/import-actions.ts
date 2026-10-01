'use server';

/**
 * HQ-copy FX import server actions (Tenant_Currency_FX plan 01 §7.2,
 * "Import" tab — "From CleanMateX HQ" only; CSV/Excel/URL are 5D/5E).
 * Permission gating lives here — the service layer never checks permissions.
 */

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth/server-auth';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import { commitHqCopyImport, previewHqCopyImport } from '@/lib/services/fx/fx-import.service';
import { FxError } from '@/lib/services/fx/fx-errors';
import { CURRENCY_FX_PERMISSIONS } from '@/lib/constants/permissions/currency-fx-perm';
import type { HqCopyCommitResult, HqCopyPreviewResult } from '@/lib/types/currency-fx';

const REVALIDATE_PATH = '/dashboard/settings/finance/currency-fx';

interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
}

function toError<T>(error: unknown, fallback: string): ActionResult<T> {
  if (error instanceof FxError) return { success: false, error: error.message, errorCode: error.code };
  return { success: false, error: error instanceof Error ? error.message : fallback };
}

export async function previewHqCopyImportAction(input: {
  rateTypeCode?: string;
  asOfDate?: string;
  sourceCode?: string;
}): Promise<ActionResult<HqCopyPreviewResult>> {
  try {
    const { tenantId, userId } = await getAuthContext();
    if (!(await hasPermissionServer(CURRENCY_FX_PERMISSIONS.FX_RATES_IMPORT))) {
      return { success: false, error: 'Forbidden' };
    }
    const data = await previewHqCopyImport({ tenantId, actorId: userId, ...input });
    return { success: true, data };
  } catch (error) {
    return toError(error, 'Failed to preview HQ rates');
  }
}

export async function commitHqCopyImportAction(
  batchId: string,
  hqRateIds?: string[]
): Promise<ActionResult<HqCopyCommitResult>> {
  try {
    const { tenantId, userId } = await getAuthContext();
    if (!(await hasPermissionServer(CURRENCY_FX_PERMISSIONS.FX_RATES_IMPORT))) {
      return { success: false, error: 'Forbidden' };
    }
    const actorCanApprove = await hasPermissionServer(CURRENCY_FX_PERMISSIONS.FX_RATES_APPROVE);
    const data = await commitHqCopyImport({ tenantId, batchId, actorId: userId, actorCanApprove, hqRateIds });
    revalidatePath(REVALIDATE_PATH);
    return { success: true, data };
  } catch (error) {
    return toError(error, 'Failed to import HQ rates');
  }
}
