import { NextRequest, NextResponse } from 'next/server';
import { validateCSRF } from '@/lib/middleware/csrf';
import { requireAnyPermission } from '@/lib/middleware/require-permission';
import { postCustomerAccountReceipt } from '@/lib/services/customer-receipt-posting.service';
import { CashDrawerLedgerError } from '@/lib/services/cash-drawer-ledger/cash-drawer-errors';
import { postCustomerReceiptRequestSchema } from '@/lib/validations/customer-receipt-allocation-schema';

/**
 * POST /api/v1/customer-receipts/post — posts a confirmed customer account
 * receipt (CLF W6). Errors return `{ success: false, error, code? }`:
 * cash-drawer ledger refusals and the service's stable codes come back as
 * `code` with HTTP 422 so the screen can show a translated message.
 * @param request JSON body matching postCustomerReceiptRequestSchema
 */
export async function POST(request: NextRequest) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requireAnyPermission([
    'customers:receipt_allocate',
    'orders:overpayment_allocate',
  ])(request);
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'VALIDATION_ERROR' }, { status: 400 });
  }
  const parsed = await postCustomerReceiptRequestSchema.safeParseAsync(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await postCustomerAccountReceipt(
      auth.tenantId,
      auth.userId ?? 'system',
      parsed.data
    );
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof CashDrawerLedgerError) {
      return NextResponse.json(
        { success: false, code: error.code, error: error.code },
        { status: 422 }
      );
    }
    const message = error instanceof Error ? error.message : 'Failed to post customer receipt';
    // Service business-rule failures are stable UPPER_SNAKE codes.
    const code = /^[A-Z][A-Z0-9_]+$/.test(message) ? message : undefined;
    return NextResponse.json(
      { success: false, code, error: message },
      { status: code ? 422 : 400 }
    );
  }
}
