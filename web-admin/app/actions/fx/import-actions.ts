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
import { commitCsvImport, previewCsvImport, CSV_MAX_FILE_BYTES } from '@/lib/services/fx/fx-csv-import.service';
import { commitUrlImport, previewUrlImport } from '@/lib/services/fx/fx-url-import.service';
import { FxError } from '@/lib/services/fx/fx-errors';
import { CURRENCY_FX_PERMISSIONS } from '@/lib/constants/permissions/currency-fx-perm';
import type {
  HqCopyCommitResult,
  HqCopyPreviewResult,
  CsvCommitResult,
  CsvPreviewResult,
  UrlImportCommitResult,
  UrlImportPreviewResult,
} from '@/lib/types/currency-fx';

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

/** CSV file upload — a Cmx form submits a FormData with `file` + `sourceCode`. */
export async function previewCsvImportAction(formData: FormData): Promise<ActionResult<CsvPreviewResult>> {
  try {
    const { tenantId, userId } = await getAuthContext();
    if (!(await hasPermissionServer(CURRENCY_FX_PERMISSIONS.FX_RATES_IMPORT))) {
      return { success: false, error: 'Forbidden' };
    }

    const file = formData.get('file') as File | null;
    const sourceCode = (formData.get('sourceCode') as string | null)?.trim();
    if (!file || !sourceCode) {
      return { success: false, error: 'A file and a source are required' };
    }
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return { success: false, error: 'Please select a CSV file' };
    }
    if (file.size > CSV_MAX_FILE_BYTES) {
      return { success: false, error: `CSV file exceeds the ${CSV_MAX_FILE_BYTES}-byte limit` };
    }

    const fileContent = await file.text();
    const data = await previewCsvImport({ tenantId, actorId: userId, sourceCode, fileName: file.name, fileContent });
    return { success: true, data };
  } catch (error) {
    return toError(error, 'Failed to preview CSV import');
  }
}

export async function commitCsvImportAction(
  batchId: string,
  rowNumbers?: number[]
): Promise<ActionResult<CsvCommitResult>> {
  try {
    const { tenantId, userId } = await getAuthContext();
    if (!(await hasPermissionServer(CURRENCY_FX_PERMISSIONS.FX_RATES_IMPORT))) {
      return { success: false, error: 'Forbidden' };
    }
    const actorCanApprove = await hasPermissionServer(CURRENCY_FX_PERMISSIONS.FX_RATES_APPROVE);
    const data = await commitCsvImport({ tenantId, batchId, actorId: userId, actorCanApprove, rowNumbers });
    revalidatePath(REVALIDATE_PATH);
    return { success: true, data };
  } catch (error) {
    return toError(error, 'Failed to import CSV rates');
  }
}

export async function previewUrlImportAction(providerCode: string): Promise<ActionResult<UrlImportPreviewResult>> {
  try {
    const { tenantId, userId } = await getAuthContext();
    if (!(await hasPermissionServer(CURRENCY_FX_PERMISSIONS.FX_RATES_IMPORT))) {
      return { success: false, error: 'Forbidden' };
    }
    const data = await previewUrlImport({ tenantId, actorId: userId, providerCode });
    return { success: true, data };
  } catch (error) {
    return toError(error, 'Failed to fetch provider rates');
  }
}

export async function commitUrlImportAction(
  batchId: string,
  rowNumbers?: number[]
): Promise<ActionResult<UrlImportCommitResult>> {
  try {
    const { tenantId, userId } = await getAuthContext();
    if (!(await hasPermissionServer(CURRENCY_FX_PERMISSIONS.FX_RATES_IMPORT))) {
      return { success: false, error: 'Forbidden' };
    }
    const actorCanApprove = await hasPermissionServer(CURRENCY_FX_PERMISSIONS.FX_RATES_APPROVE);
    const data = await commitUrlImport({ tenantId, batchId, actorId: userId, actorCanApprove, rowNumbers });
    revalidatePath(REVALIDATE_PATH);
    return { success: true, data };
  } catch (error) {
    return toError(error, 'Failed to import provider rates');
  }
}
