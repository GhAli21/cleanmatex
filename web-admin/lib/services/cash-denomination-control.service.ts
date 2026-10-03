import 'server-only';

import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { CashDrawerLedgerError } from '@/lib/services/cash-drawer-ledger/cash-drawer-errors';
import { CASH_LEDGER_ERRORS } from '@/lib/constants/cash-drawer';

/**
 * Tenant control of counted denominations (C1-1b, migration 0562). HQ owns the global catalog
 * (`sys_currency_denominations_cd`); a tenant keeps sparse overrides in `org_currency_denom_cf`: a
 * denomination it does not handle can be switched off, and the counting grid can be reordered. No
 * row means "inherit HQ" (offered, HQ order). Counts already recorded are never rewritten.
 */

export interface EffectiveDenomination {
  denominationCode: string;
  denominationMinor: number;
  denomKind: string;
  name: string;
  name2: string | null;
  /** HQ order, before the tenant override. */
  hqDisplayOrder: number | null;
  /** The tenant's order override, or null to inherit. */
  displayOrderOverride: number | null;
  /** False when this tenant switched the denomination off. */
  isEnabled: boolean;
}

export interface DenominationOverrideInput {
  denominationCode: string;
  isEnabled: boolean;
  /** null/undefined inherits the HQ order. */
  displayOrder?: number | null;
}

/**
 * Every in-circulation HQ denomination of a currency with this tenant's overrides applied (switched-off
 * ones included, flagged), in the order the counting grid shows them.
 *
 * @param tenantId tenant (explicitly filtered)
 * @param currencyCode ISO currency code
 */
export async function listEffectiveDenominations(
  tenantId: string,
  currencyCode: string,
): Promise<EffectiveDenomination[]> {
  return withTenantContext(tenantId, async () => {
    const rows = await prisma.$queryRaw<
      Array<{
        denomination_code: string;
        denomination_minor: number;
        denom_kind: string;
        name: string;
        name2: string | null;
        hq_order: number | null;
        override_order: number | null;
        is_enabled: boolean | null;
      }>
    >(Prisma.sql`
      SELECT d.denomination_code, d.denomination_minor, d.denom_kind, d.name, d.name2,
             d.display_order AS hq_order, o.display_order AS override_order, o.is_enabled
      FROM public.sys_currency_denominations_cd d
      LEFT JOIN public.org_currency_denom_cf o
        ON o.tenant_org_id = ${tenantId}::uuid
       AND o.currency_code = d.currency_code
       AND o.denomination_code = d.denomination_code
       AND o.is_active = TRUE
      WHERE d.currency_code = ${currencyCode}
        AND d.is_active = TRUE AND d.is_in_circulation = TRUE
      ORDER BY COALESCE(o.display_order, d.display_order, 0), d.denomination_minor
    `);
    return rows.map((r) => ({
      denominationCode: r.denomination_code,
      denominationMinor: r.denomination_minor,
      denomKind: r.denom_kind,
      name: r.name,
      name2: r.name2,
      hqDisplayOrder: r.hq_order,
      displayOrderOverride: r.override_order,
      isEnabled: r.is_enabled ?? true,
    }));
  });
}

/**
 * Saves the tenant's overrides for one currency. An item that is enabled with no order of its own
 * is the HQ default, so its override row is removed instead of stored (sparse by design).
 *
 * @param tenantId tenant (explicitly filtered)
 * @param actor acting user id (audit)
 * @param currencyCode ISO currency code; must be enabled for the tenant
 * @param items one entry per denomination to set
 * @throws Error when a denomination code does not belong to the currency
 */
export async function saveDenominationOverrides(
  tenantId: string,
  actor: string,
  currencyCode: string,
  items: DenominationOverrideInput[],
): Promise<void> {
  await withTenantContext(tenantId, () =>
    prisma.$transaction(async (tx) => {
      const known = await tx.sys_currency_denominations_cd.findMany({
        where: { currency_code: currencyCode },
        select: { denomination_code: true },
      });
      const knownCodes = new Set(known.map((k) => k.denomination_code));
      for (const item of items) {
        if (!knownCodes.has(item.denominationCode)) {
          throw new Error(`saveDenominationOverrides: ${item.denominationCode} is not a ${currencyCode} denomination`);
        }
      }

      for (const item of items) {
        const order = item.displayOrder ?? null;
        if (item.isEnabled && order === null) {
          await tx.$executeRaw(Prisma.sql`
            DELETE FROM public.org_currency_denom_cf
            WHERE tenant_org_id = ${tenantId}::uuid AND currency_code = ${currencyCode}
              AND denomination_code = ${item.denominationCode}
          `);
          continue;
        }
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO public.org_currency_denom_cf (
            tenant_org_id, currency_code, denomination_code, is_enabled, display_order, created_by, created_info
          ) VALUES (
            ${tenantId}::uuid, ${currencyCode}, ${item.denominationCode}, ${item.isEnabled}, ${order},
            ${actor}, 'cash-denomination-control'
          )
          ON CONFLICT (tenant_org_id, currency_code, denomination_code) DO UPDATE SET
            is_enabled = EXCLUDED.is_enabled,
            display_order = EXCLUDED.display_order,
            is_active = TRUE,
            updated_at = CURRENT_TIMESTAMP, updated_by = ${actor}, updated_info = 'cash-denomination-control'
        `);
      }
    }),
  );
}

/**
 * How many denominations of a currency this tenant can count with: in circulation at HQ and not
 * switched off by the tenant. Zero means counting by denomination is impossible for the currency, so
 * a "denominations required" policy cannot be met and falls back to a total.
 *
 * @param tx open transaction
 * @param tenantId tenant (explicitly filtered)
 * @param currencyCode ISO currency code
 */
export async function countEnabledDenominationsTx(
  tx: Prisma.TransactionClient,
  tenantId: string,
  currencyCode: string,
): Promise<number> {
  const rows = await tx.$queryRaw<Array<{ n: number }>>(Prisma.sql`
    SELECT COUNT(*)::int AS n
    FROM public.sys_currency_denominations_cd d
    LEFT JOIN public.org_currency_denom_cf o
      ON o.tenant_org_id = ${tenantId}::uuid
     AND o.currency_code = d.currency_code
     AND o.denomination_code = d.denomination_code
     AND o.is_active = TRUE
    WHERE d.currency_code = ${currencyCode}
      AND d.is_active = TRUE AND d.is_in_circulation = TRUE
      AND COALESCE(o.is_enabled, TRUE) = TRUE
  `);
  return rows[0]?.n ?? 0;
}

/**
 * Refuses a count line that uses a denomination this tenant switched off. Called inside the count
 * transaction so a disabled note can never enter a new count, whatever the client sends.
 *
 * @param tx open transaction
 * @param tenantId tenant (explicitly filtered)
 * @param currencyCode currency of the count
 * @param denominationIds HQ denomination ids used by the count's lines
 * @throws CashDrawerLedgerError CASH_DENOMINATION_DISABLED
 */
export async function assertDenominationsEnabledTx(
  tx: Prisma.TransactionClient,
  tenantId: string,
  currencyCode: string,
  denominationIds: readonly string[],
): Promise<void> {
  if (denominationIds.length === 0) return;
  const disabled = await tx.$queryRaw<Array<{ denomination_code: string }>>(Prisma.sql`
    SELECT o.denomination_code
    FROM public.org_currency_denom_cf o
    JOIN public.sys_currency_denominations_cd d
      ON d.currency_code = o.currency_code AND d.denomination_code = o.denomination_code
    WHERE o.tenant_org_id = ${tenantId}::uuid
      AND o.currency_code = ${currencyCode}
      AND o.is_active = TRUE AND o.is_enabled = FALSE
      AND d.id IN (${Prisma.join(denominationIds.map((id) => Prisma.sql`${id}::uuid`))})
  `);
  if (disabled.length > 0) {
    throw new CashDrawerLedgerError(
      CASH_LEDGER_ERRORS.CASH_DENOMINATION_DISABLED,
      `denomination ${disabled.map((d) => d.denomination_code).join(', ')} is switched off for this tenant`,
    );
  }
}

/**
 * Currencies this tenant can count cash in and for which HQ publishes denominations — the choices of
 * the denomination admin.
 *
 * @param tenantId tenant (explicitly filtered)
 * @returns ISO codes, base currency first
 */
export async function listCountableCurrencies(tenantId: string): Promise<string[]> {
  return withTenantContext(tenantId, async () => {
    const rows = await prisma.$queryRaw<Array<{ currency_code: string }>>(Prisma.sql`
      SELECT c.currency_code
      FROM public.org_currency_cf c
      WHERE c.tenant_org_id = ${tenantId}::uuid
        AND c.is_active = TRUE AND c.allow_cash = TRUE
        AND EXISTS (
          SELECT 1 FROM public.sys_currency_denominations_cd d
          WHERE d.currency_code = c.currency_code AND d.is_active = TRUE AND d.is_in_circulation = TRUE
        )
      ORDER BY c.is_base_currency DESC, c.display_order NULLS LAST, c.currency_code
    `);
    return rows.map((r) => r.currency_code);
  });
}
