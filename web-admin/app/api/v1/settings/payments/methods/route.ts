import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { Decimal } from '@prisma/client/runtime/library';

function toNumber(value: Decimal | null | undefined): number | null {
  return value == null ? null : Number(value);
}

export async function GET(request: NextRequest) {
  const auth = await requirePermission('payment_config:view')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const branchId = request.nextUrl.searchParams.get('branchId') ?? undefined;

  try {
    const methods = await withTenantContext(tenantId, async () => {
      const tenantMethods = await prisma.org_payment_methods_cf.findMany({
        where: {
          tenant_org_id: tenantId,
          rec_status: 1,
          is_active: true,
        },
        orderBy: [
          { display_order: 'asc' },
          { created_at: 'asc' },
        ],
      });

      if (!branchId) {
        return tenantMethods;
      }

      const branchOverrides = await prisma.org_branch_payment_methods_cf.findMany({
        where: {
          tenant_org_id: tenantId,
          branch_id: branchId,
          rec_status: 1,
          is_active: true,
        },
      });

      const overrideMap = new Map(
        branchOverrides.map((override) => [override.org_payment_method_id, override])
      );

      return tenantMethods.map((method) => {
        const override = overrideMap.get(method.id);
        if (!override) {
          return method;
        }

        return {
          ...method,
          is_enabled: override.is_enabled ?? method.is_enabled,
          allowed_in_pos: override.allowed_in_pos ?? method.allowed_in_pos,
          allowed_in_customer_app:
            override.allowed_in_customer_app ?? method.allowed_in_customer_app,
          allowed_in_staff_app:
            override.allowed_in_staff_app ?? method.allowed_in_staff_app,
          allowed_for_pay_now:
            override.allowed_for_pay_now ?? method.allowed_for_pay_now,
          allowed_for_pay_on_collection:
            override.allowed_for_pay_on_collection ?? method.allowed_for_pay_on_collection,
          allowed_for_invoice_payment:
            override.allowed_for_invoice_payment ?? method.allowed_for_invoice_payment,
          allowed_for_refund:
            override.allowed_for_refund ?? method.allowed_for_refund,
          requires_cash_drawer:
            override.cash_drawer_required ?? method.requires_cash_drawer,
          requires_terminal:
            override.terminal_required ?? method.requires_terminal,
          min_amount: override.min_amount ?? method.min_amount,
          max_amount: override.max_amount ?? method.max_amount,
          display_order: override.display_order ?? method.display_order,
          gateway_config: {
            ...(method.gateway_config as Record<string, unknown>),
            ...((override.branch_gateway_config as Record<string, unknown>) ?? {}),
          },
          metadata: {
            ...(method.metadata as Record<string, unknown>),
            branch_override: {
              id: override.id,
              branch_id: branchId,
              is_enabled: override.is_enabled,
              allowed_in_pos: override.allowed_in_pos,
              allowed_in_customer_app: override.allowed_in_customer_app,
              allowed_in_staff_app: override.allowed_in_staff_app,
              allowed_for_pay_now: override.allowed_for_pay_now,
              allowed_for_pay_on_collection: override.allowed_for_pay_on_collection,
              allowed_for_invoice_payment: override.allowed_for_invoice_payment,
              allowed_for_refund: override.allowed_for_refund,
              cash_drawer_required: override.cash_drawer_required,
              terminal_required: override.terminal_required,
              min_amount: toNumber(override.min_amount),
              max_amount: toNumber(override.max_amount),
            },
          },
        };
      });
    });
    return NextResponse.json({ success: true, data: methods });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch payment methods';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
