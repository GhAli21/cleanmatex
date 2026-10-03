import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { getCashControlSettings } from '@/lib/services/cash-control-settings.service';
import { allowedCountMethods, type CashCountMethod } from '@/lib/constants/cash-control';
import { countEnabledDenominationsTx } from '@/lib/services/cash-denomination-control.service';

/** The count methods a drawer's policy allows, per phase (C1-1c). */
export interface DrawerCountPolicy {
  /** Methods allowed when counting the opening float. */
  opening: CashCountMethod[];
  /** Methods allowed for the closing count and a recount. */
  closing: CashCountMethod[];
  openingRequired: boolean;
  closingRequired: boolean;
}

/**
 * Resolves what a cashier may enter when counting this drawer. The server enforces the same rule
 * (`assertCountMethodAllowedTx`), so the forms can offer exactly these choices.
 *
 * @param tenantId tenant (explicitly filtered)
 * @param userId the person counting (the policy ladder can be per user)
 * @param drawerId the drawer
 * @returns the policy, or null when the drawer does not exist for this tenant
 */
export async function getDrawerCountPolicy(
  tenantId: string,
  userId: string,
  drawerId: string,
): Promise<DrawerCountPolicy | null> {
  return withTenantContext(tenantId, async () => {
    const drawer = await prisma.org_cash_drawers_mst.findFirst({
      where: { id: drawerId, tenant_org_id: tenantId },
      select: { branch_id: true, currency_code: true },
    });
    if (!drawer) return null;
    const settings = await getCashControlSettings({ tenantId, branchId: drawer.branch_id, userId, drawerId });
    // A mandatory-denomination policy cannot be met with nothing to count in: it falls back to a total
    // (the same rule the server applies in assertCountMethodAllowedTx).
    const denominations = await prisma.$transaction((tx) => countEnabledDenominationsTx(tx, tenantId, drawer.currency_code));
    const relax = (methods: CashCountMethod[]): CashCountMethod[] =>
      denominations === 0 && methods.length === 1 && methods[0] === 'DENOMINATION' ? ['TOTAL_ONLY'] : methods;
    return {
      opening: relax(allowedCountMethods(settings.openingCountMode)),
      closing: relax(allowedCountMethods(settings.closingCountMode)),
      openingRequired: settings.openingCountRequired,
      closingRequired: settings.closingCountRequired,
    };
  });
}
