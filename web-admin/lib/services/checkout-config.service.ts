import 'server-only';

import { PAYMENT_NATURE, CREDIT_APPLICATION_TYPES } from '@/lib/constants/order-financial';
import type { SettlementOption, CheckoutSettlementOptions } from '@/lib/types/order-financial';
import { getWalletBalance, getAdvanceBalance, getCreditNotes } from './stored-value.service';
import { getLoyaltyAccount, getLoyaltyConfig } from './loyalty.service';
import { Decimal } from '@prisma/client/runtime/library';
import {
  listCheckoutEligiblePaymentMethodConfigs,
  listEffectivePaymentMethodConfigs,
} from './payment-config.service';

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
  // D9 config fields — resolved via COALESCE(org, sys) in the query
  eff_default_creation_status?: string | null;
  eff_allow_status_override?: boolean | null;
  eff_requires_reference?: boolean | null;
  eff_is_user_id_required?: boolean | null;
  allowed_in_pos?: boolean | null;
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
    defaultCreationStatus: row.eff_default_creation_status ?? 'PENDING',
    allowStatusOverride:   row.eff_allow_status_override ?? false,
    requiresReference:     row.eff_requires_reference ?? false,
    isUserIdRequired:      row.eff_is_user_id_required ?? false,
    allowedInPos:          row.allowed_in_pos ?? true,
  };
}

/**
 * Load all active checkout settlement options for a tenant, filtered by order amount.
 * Enriches CREDIT_APPLICATION rows with live balance data when customerId is provided.
 *
 * @param tenantId Tenant identifier used to resolve configured payment methods and balances.
 * @param orderContext Checkout context containing amount, customer, and optional branch scope.
 * @param orderContext.amount Order total used for amount-based payment method eligibility filters.
 * @param orderContext.customerId Optional customer identifier used to enrich stored-value balances.
 * @param orderContext.branchId Optional branch identifier used to apply branch-specific payment overrides.
 * @returns Payment, credit, deferred, and AR settlement options ready for checkout orchestration.
 */
export async function getCheckoutOptions(
  tenantId: string,
  orderContext: { amount: number; customerId?: string; branchId?: string }
): Promise<CheckoutSettlementOptions> {
  const { amount, customerId } = orderContext;
  const eligible = await listCheckoutEligiblePaymentMethodConfigs({
    tenantId,
    branchId: orderContext.branchId,
    amount,
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
    const option = mapToSettlementOption({
      id: row.id,
      payment_method_code: row.payment_method_code,
      payment_nature: row.payment_nature,
      gateway_code: row.gateway_code,
      display_name: row.display_name,
      display_name2: row.display_name2,
      settlement_type_code: row.settlement_type_code,
      credit_application_type: row.credit_application_type,
      requires_cash_drawer: row.requires_cash_drawer,
      requires_terminal: row.requires_terminal,
      min_amount: row.min_amount != null ? new Decimal(row.min_amount) : null,
      max_amount: row.max_amount != null ? new Decimal(row.max_amount) : null,
      min_order_amount: row.min_order_amount != null ? new Decimal(row.min_order_amount) : null,
      max_order_amount: row.max_order_amount != null ? new Decimal(row.max_order_amount) : null,
      is_platform_disabled: row.is_platform_disabled,
      sys_globally_disabled: row.is_globally_disabled,
      eff_default_creation_status: row.default_creation_status,
      eff_allow_status_override: row.allow_status_override,
      eff_requires_reference: row.requires_reference,
      eff_is_user_id_required: row.is_user_id_required,
      allowed_in_pos: row.allowed_in_pos,
    });

    if (option.paymentNature === PAYMENT_NATURE.REAL_PAYMENT) {
      result.paymentMethods.push(option);
    } else if (option.paymentNature === PAYMENT_NATURE.CREDIT_APPLICATION) {
      if (customerId) {
        switch (option.creditApplicationType) {
          case CREDIT_APPLICATION_TYPES.WALLET:
            option.availableBalance = walletBalance; break;
          case CREDIT_APPLICATION_TYPES.CUSTOMER_ADVANCE:
            option.availableBalance = advanceBalance; break;
          case CREDIT_APPLICATION_TYPES.CUSTOMER_CREDIT:
            option.availableBalance = creditNotesTotal; break;
          case CREDIT_APPLICATION_TYPES.LOYALTY_CREDIT:
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
 *
 * @param tenantId Tenant identifier used to scope payment method resolution.
 * @param paymentMethodCode Payment method code selected for the settlement leg.
 * @param gatewayCode Optional gateway code when multiple gateway-backed variants share the same method code.
 * @returns Canonical settlement option metadata for the requested payment leg.
 */
export async function resolveSettlementLeg(
  tenantId:          string,
  paymentMethodCode: string,
  gatewayCode:       string | null
): Promise<SettlementOption> {
  const rows = await listEffectivePaymentMethodConfigs({
    tenantId,
    methodCodes: [paymentMethodCode],
  });
  const row = rows.find((method) => method.gateway_code === (gatewayCode ?? null));
  if (!row) {
    throw new Error(`Payment method ${paymentMethodCode} is not configured for this tenant`);
  }
  if (row.is_globally_disabled) {
    throw new Error(`Payment method ${paymentMethodCode} is globally disabled`);
  }
  if (row.gateway_globally_disabled) {
    throw new Error(`Gateway ${gatewayCode} is globally disabled`);
  }

  return mapToSettlementOption({
    id: row.id,
    payment_method_code: row.payment_method_code,
    payment_nature: row.payment_nature,
    gateway_code: row.gateway_code,
    display_name: row.display_name,
    display_name2: row.display_name2,
    settlement_type_code: row.settlement_type_code,
    credit_application_type: row.credit_application_type,
    requires_cash_drawer: row.requires_cash_drawer,
    requires_terminal: row.requires_terminal,
    min_amount: row.min_amount != null ? new Decimal(row.min_amount) : null,
    max_amount: row.max_amount != null ? new Decimal(row.max_amount) : null,
    min_order_amount: row.min_order_amount != null ? new Decimal(row.min_order_amount) : null,
    max_order_amount: row.max_order_amount != null ? new Decimal(row.max_order_amount) : null,
    is_platform_disabled: row.is_platform_disabled,
    sys_globally_disabled: row.is_globally_disabled,
    eff_default_creation_status: row.default_creation_status,
    eff_allow_status_override: row.allow_status_override,
    eff_requires_reference: row.requires_reference,
    eff_is_user_id_required: row.is_user_id_required,
    allowed_in_pos: row.allowed_in_pos,
  });
}
