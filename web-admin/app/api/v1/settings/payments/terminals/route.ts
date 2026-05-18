import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';

export async function GET(request: NextRequest) {
  const auth = await requirePermission('payment_config:view')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const branchId = request.nextUrl.searchParams.get('branchId') ?? undefined;

  try {
    const terminals = await withTenantContext(tenantId, () =>
      prisma.org_payment_terminals_cf.findMany({
        where: {
          tenant_org_id: tenantId,
          is_active:     true,
          rec_status:    1,
          ...(branchId ? { branch_id: branchId } : {}),
        },
        orderBy: { created_at: 'asc' },
      })
    );
    return NextResponse.json({ success: true, data: terminals });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch terminals';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

const createSchema = z.object({
  terminalCode:  z.string().min(1),
  terminalName:  z.string().min(1),
  terminalName2: z.string().optional(),
  terminalType:  z.string().min(1),
  branchId:      z.string().uuid().optional(),
  gatewayCode:   z.string().optional(),
  serialNo:      z.string().optional(),
  merchantId:    z.string().optional(),
});

export async function POST(request: NextRequest) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('payment_config:manage')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const body   = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });

  try {
    const terminal = await withTenantContext(tenantId, () =>
      prisma.org_payment_terminals_cf.create({
        data: {
          tenant_org_id:  tenantId,
          terminal_code:  parsed.data.terminalCode,
          terminal_name:  parsed.data.terminalName,
          terminal_name2: parsed.data.terminalName2 ?? null,
          terminal_type:  parsed.data.terminalType,
          branch_id:      parsed.data.branchId ?? null,
          gateway_code:   parsed.data.gatewayCode ?? null,
          serial_no:      parsed.data.serialNo ?? null,
          merchant_id:    parsed.data.merchantId ?? null,
          is_active:      true,
          rec_status:     1,
        },
      })
    );
    return NextResponse.json({ success: true, data: terminal }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create terminal';
    return NextResponse.json({ success: false, error: message }, { status: 422 });
  }
}
