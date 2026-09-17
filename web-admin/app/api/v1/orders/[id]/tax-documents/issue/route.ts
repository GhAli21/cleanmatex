/**
 * B14 follow-up — Manual tax document issuance.
 *
 * POST /api/v1/orders/[id]/tax-documents/issue
 *
 * Explicit admin action for an order the automatic `ON_ORDER_SUBMIT`
 * trigger never reached (tenant's `org_tax_doc_triggers_cfg` opt-in wasn't
 * configured yet, or the order predates this feature). Gated by
 * `tax_document:issue` — already seeded by migration 0341.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { issueTaxDocumentManually, TaxDocumentIssuanceError } from '@/lib/services/tax-document-issuance.service';

const issueSchema = z.object({
  documentType: z.enum(['INVOICE', 'SIMPLIFIED_INVOICE']),
});

/**
 *
 * @param request
 * @param root0
 * @param root0.params
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('tax_document:issue')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId } = auth;

  const { id: orderId } = await params;

  const body = await request.json().catch(() => ({}));
  const parsed = issueSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'INVALID_DOCUMENT_TYPE' },
      { status: 400 },
    );
  }

  try {
    const result = await issueTaxDocumentManually({
      tenantId,
      orderId,
      documentType: parsed.data.documentType,
      issuedBy: userId,
    });
    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (err) {
    if (err instanceof TaxDocumentIssuanceError) {
      return NextResponse.json({ success: false, error: err.code }, { status: 422 });
    }
    const message = err instanceof Error ? err.message : 'Failed to issue tax document';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
