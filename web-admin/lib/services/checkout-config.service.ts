import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '../db/tenant-context';
import { PAYMENT_NATURE, CREDIT_APPLICATION_TYPES } from '@/lib/constants/order-financial';
import type { SettlementOption, CheckoutSettlementOptions } from '@/lib/types/order-financial';
import { getWalletBalance, getAdvanceBalance, getCreditNotes } from './stored-value.service';
import { getLoyaltyAccount, getLoyaltyConfig } from './loyalty.service';
import { Decimal } from '@prisma/client/runtime/library';

function toNumber(d: Decimal | null | undefined): number {
  return d ? Number(d) : 0;
}

function mapToSettlementOption(row: {
  id: string;
  payment_method_code: string;
  payment_nature: string;
  gateway_code: string | null;
  display_name: string;
  display_name2: string | null;
  settlement_type_code: string | null;
  credit_application_type: string | null;
  requires_cash_drawer: boolean;
  requires_terminal: boolean;
  min_amount: Decimal | null;
  max_amount: Decimal | null;
  min_order_amount: Decimal | null;
  max_order_amount: Decimal | null;
  is_platform_disabled: boolean;
  sys_globally_disabled?: boolean;
}): SettlementOption {
  return {
    id:                    row.id,
    paymentMethodCode:     row.payment_method_code,
    paymentNature:         row.payment_nature as SettlementOption['paymentNature'],
    gatewayCode:           row.gateway_code,
    displayName:           row.display_name,
    displayName2:          row.display_name2,
    settlementTypeCode:    row.settlement_type_code as SettlementOption['settlementTypeCode'],
    creditApplicationType: row.credit_application_type as SettlementOption['creditApplicationType'],
    requiresCashDrawer:    row.requires_cash_drawer,
    requiresTerminal:      row.requires_terminal,
    minAmount:             row.min_amount ? toNumber(row.min_amount) : null,
    maxAmount:             row.max_amount ? toNumber(row.max_amount) : null,
    minOrderAmount:        row.min_order_amount ? toNumber(row.min_order_amount) : null,
    maxOrderAmount:        row.max_order_amount ? toNumber(row.max_order_amount) : null,
    isPlatformDisabled:    row.is_platform_disabled,
    isGloballyDisabled:    row.sys_globally_disabled ?? false,
  };
}

/**
 * Load all active checkout settlement options for a tenant, filtered by order amount.
 * Enriches CREDIT_APPLICATION rows with live balance data when customerId is provided.
 */
export async function getCheckoutOptions(
  tenantId: string,
  orderContext: { amount: number; customerId?: string }
): Promise<CheckoutSettlementOptions> {
  type RawRow = Awaited<ReturnType<typeof prisma.org_payment_methods_cf.findMany>>[number] & {
    sys_globally_disabled?: boolean;
    gw_globally_disabled?: boolean;
  };

  const rows = await withTenantContext(tenantId, async () => {
    return prisma.$queryRaw<RawRow[]>`
      SELECT o.*,
             s.is_globally_disabled AS sys_globally_disabled,
             g.is_globally_disabled AS gw_globally_disabled
      FROM org_payment_methods_cf o
      JOIN sys_payment_method_cd s ON s.payment_method_code = o.payment_method_code
      LEFT JOIN sys_payment_gateway_cd g ON g.code = o.gateway_code
      WHERE o.tenant_org_id      = ${tenantId}::uuid
        AND o.is_enabled         = true
        AND o.is_active          = true
        AND o.rec_status         = 1
        AND o.is_platform_disabled = false
        AND s.is_globally_disabled = false
        AND (s.is_deprecated IS NULL OR s.is_deprecated = false)
        AND (o.gateway_code IS NULL OR g.is_globally_disabled = false)
      ORDER BY o.display_order ASC`;
  });

  const { amount, customerId } = orderContext;

  // Filter by order amount eligibility
  const eligible = rows.filter((r) => {
    const min = r.min_order_amount ? Number(r.min_order_amount) : null;
    const max = r.max_order_amount ? Number(r.max_order_amount) : null;
    if (min !== null && amount < min) return false;
    if (max !== null && amount > max) return false;
    return true;
  });

  const result: CheckoutSettlementOptions = {
    paymentMethods:     [],
    creditApplications: [],
    deferredSettlement: [],
    arOptions:          [],
  };

  // Fetch balances once if customer provided
  let walletBalance       = 0;
  let advanceBalance      = 0;
  let creditNotesTotal    = 0;
  let loyaltyPointsValue  = 0;

  if (customerId) {
    const [wallet, advance, creditNotes, loyaltyAccount, loyaltyConfig] = await Promise.all([
      getWalletBalance(tenantId, customerId),
      getAdvanceBalance(tenantId, customerId),
      getCreditNotes(tenantId, customerId),
      getLoyaltyAccount(tenantId, customerId),
      getLoyaltyConfig(tenantId),
    ]);
    walletBalance    = wallet.balance;
    advanceBalance   = advance.balance;
    creditNotesTotal = creditNotes.reduce((s, cn) => s + Number(cn.remaining_balance ?? 0), 0);

    if (loyaltyAccount && loyaltyConfig) {
      const redeemRate = toNumber(loyaltyConfig.redeem_rate_per_point);
      loyaltyPointsValue = loyaltyAccount.points_balance * redeemRate;
    }
  }

  for (const row of eligible) {
    const option = mapToSettlementOption(row as Parameters<typeof mapToSettlementOption>[0]);

    if (option.paymentNature === PAYMENT_NATURE.REAL_PAYMENT) {
      result.paymentMethods.push(option);
    } else if (option.paymentNature === PAYMENT_NATURE.CREDIT_APPLICATION) {
      if (customerId) {
        switch (option.creditApplicationType) {
          case CREDIT_APPLICATION_TYPES.WALLET:
            option.availableBalance = walletBalance; break;
          case CREDIT_APPLICATION_TYPES.ADVANCE:
            option.availableBalance = advanceBalance; break;
          case CREDIT_APPLICATION_TYPES.CREDIT_NOTE:
            option.availableBalance = creditNotesTotal; break;
          case CREDIT_APPLICATION_TYPES.LOYALTY_POINTS:
            option.availableBalance = loyaltyPointsValue; break;
          // GIFT_CARD: balance looked up at redemption time by card code
        }
      }
      result.creditApplications.push(option);
    } else if (option.paymentNature === PAYMENT_NATURE.DEFERRED_SETTLEMENT) {
      result.deferredSettlement.push(option);
    } else if (option.paymentNature === PAYMENT_NATURE.AR_ALLOCATION) {
      result.arOptions.push(option);
    }
    // INTERNAL_ADJUSTMENT: never returned
  }

  return result;
}

/**
 * Load a single SettlementOption row by paymentMethodCode + gatewayCode.
 * Used by order-settlement.service.ts to resolve a leg before routing.
 */
export async function resolveSettlementLeg(
  tenantId:          string,
  paymentMethodCode: string,
  gatewayCode:       string | null
): Promise<SettlementOption> {
  const row = await withTenantContext(tenantId, () =>
    prisma.org_payment_methods_cf.findFirstOrThrow({
      where: {
        tenant_org_id:       tenantId,
        payment_method_code: paymentMethodCode,
        gateway_code:        gatewayCode ?? null,
        is_enabled:          true,
        is_active:           true,
        is_platform_disabled: false,
      },
    })
  );

  const [sysMethod, gateway] = await Promise.all([
    prisma.sys_payment_method_cd.findUnique({ where: { payment_method_code: paymentMethodCode } }),
    gatewayCode ? prisma.sys_payment_gateway_cd.findUnique({ where: { code: gatewayCode } }) : Promise.resolve(null),
  ]);

  if (sysMethod?.is_globally_disabled) throw new Error(`Payment method ${paymentMethodCode} is globally disabled`);
  if (gateway?.is_globally_disabled) throw new Error(`Gateway ${gatewayCode} is globally disabled`);

  return mapToSettlementOption({
    ...row,
    sys_globally_disabled: sysMethod?.is_globally_disabled ?? false,
  });
}
