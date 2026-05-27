import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { Decimal } from '@prisma/client/runtime/library';

function toNumber(value: Decimal | null | undefined): number | null {
  return value == null ? null : Number(value);
}

export async function GET(request: NextRequest) {
  const auth = await requirePermission('orders:create')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const branchId = request.nextUrl.searchParams.get('branchId') ?? undefined;
  const amount = Number(request.nextUrl.searchParams.get('amount') ?? '0');

  try {
    const methods = await withTenantContext(tenantId, async () => {
      const tenantMethods = await prisma.org_payment_methods_cf.findMany({
        where: {
          tenant_org_id: tenantId,
          rec_status: 1,
          is_active: true,
          is_enabled: true,
          is_platform_disabled: false,
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
          allowed_for_pay_now:
            override.allowed_for_pay_now ?? method.allowed_for_pay_now,
          allowed_for_pay_on_collection:
            override.allowed_for_pay_on_collection ?? method.allowed_for_pay_on_collection,
          allowed_for_invoice_payment:
            override.allowed_for_invoice_payment ?? method.allowed_for_invoice_payment,
          requires_cash_drawer:
            override.cash_drawer_required ?? method.requires_cash_drawer,
          requires_terminal:
            override.terminal_required ?? method.requires_terminal,
          min_amount: override.min_amount ?? method.min_amount,
          max_amount: override.max_amount ?? method.max_amount,
          min_order_amount: override.min_amount ?? method.min_order_amount,
          max_order_amount: override.max_amount ?? method.max_order_amount,
          display_order: override.display_order ?? method.display_order,
        };
      });
    });

    const filtered = methods
      .filter((method) => method.allowed_in_pos !== false && method.is_enabled !== false)
      .filter((method) => {
        const minOrderAmount = toNumber(method.min_order_amount);
        const maxOrderAmount = toNumber(method.max_order_amount);
        if (Number.isFinite(amount) && amount > 0) {
          if (minOrderAmount != null && amount < minOrderAmount) return false;
          if (maxOrderAmount != null && amount > maxOrderAmount) return false;
        }
        return true;
      })
      .map((method) => ({
        id: method.id,
        payment_method_code: method.payment_method_code,
        payment_nature: method.payment_nature,
        gateway_code: method.gateway_code,
        display_name: method.display_name,
        display_name2: method.display_name2,
        requires_cash_drawer: method.requires_cash_drawer,
        requires_terminal: method.requires_terminal,
        requires_reference: method.requires_reference,
        allowed_in_pos: method.allowed_in_pos,
        allowed_for_pay_now: method.allowed_for_pay_now,
        allowed_for_pay_on_collection: method.allowed_for_pay_on_collection,
        allowed_for_invoice_payment: method.allowed_for_invoice_payment,
        display_order: method.display_order,
      }));

    return NextResponse.json({ success: true, data: filtered });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch checkout options';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
