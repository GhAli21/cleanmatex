import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { acknowledgeIssue } from '@/lib/services/reconciliation.service';

const schema = z.object({
  status: z.enum(['ACKNOWLEDGED', 'RESOLVED']),
  notes:  z.string().optional(),
});

/**
 *
 * @param request
 * @param root0
 * @param root0.params
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  // Phase 4 R1: corrected from 'reconciliation:acknowledge' (unseeded code)
  // to 'reconciliation:acknowledge_issues' which is what migration 0294 seeds
  // into sys_auth_permissions. The wrong code caused PATCH to always return 403
  // for every role, blocking acknowledge/resolve workflows.
  const auth = await requirePermission('reconciliation:acknowledge_issues')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId } = auth;

  const { issueId } = await params;
  const body   = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });

  try {
    const issue = await acknowledgeIssue(tenantId, issueId, parsed.data.status, parsed.data.notes, userId);
    return NextResponse.json({ success: true, data: issue });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Update failed';
    return NextResponse.json({ success: false, error: message }, { status: 422 });
  }
}
