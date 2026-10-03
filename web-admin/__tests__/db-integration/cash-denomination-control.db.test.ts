/**
 * C1-1b — real-DB proof of tenant denomination control (migration 0562): overrides are sparse, a
 * switched-off denomination leaves this tenant's counting grid and is refused in a new count, the
 * tenant order is applied, and resetting to the HQ default removes the row.
 *
 * Local DB only — never remote. Skips gracefully when no DB is reachable.
 *
 * @jest-environment node
 */
import { prisma } from '@/lib/db/prisma';
import {
  assertDenominationsEnabledTx,
  listEffectiveDenominations,
  saveDenominationOverrides,
} from '@/lib/services/cash-denomination-control.service';
import { getCurrencyDenominations } from '@/lib/services/cash-drawer-catalogs.service';
import { CASH_LEDGER_ERRORS } from '@/lib/constants/cash-drawer';
import { resolveTestScope, type DbTestScope } from './helpers/cash-drawer-fixtures';

let scope: DbTestScope | null = null;
const CURRENCY = 'OMR';
const actor = 'denom-test';

beforeAll(async () => {
  scope = await resolveTestScope();
});

afterEach(async () => {
  if (!scope) return;
  await prisma.$executeRaw`
    DELETE FROM public.org_currency_denom_cf
    WHERE tenant_org_id = ${scope.tenantId}::uuid AND currency_code = ${CURRENCY}`;
});

afterAll(async () => {
  await prisma.$disconnect();
});

function dbit(name: string, fn: () => Promise<void>): void {
  it(name, async () => {
    if (!scope) {
      console.warn(`[cash-denomination-control] DB unavailable — skipping: ${name}`);
      return;
    }
    await fn();
  });
}

const overrideRows = async () =>
  prisma.$queryRaw<Array<{ denomination_code: string; is_enabled: boolean; display_order: number | null }>>`
    SELECT denomination_code, is_enabled, display_order FROM public.org_currency_denom_cf
    WHERE tenant_org_id = ${scope!.tenantId}::uuid AND currency_code = ${CURRENCY}`;

describe('tenant denomination control (C1-1b)', () => {
  dbit('with no override every HQ denomination is offered and nothing is stored', async () => {
    const effective = await listEffectiveDenominations(scope!.tenantId, CURRENCY);
    expect(effective.length).toBeGreaterThan(5);
    expect(effective.every((d) => d.isEnabled && d.displayOrderOverride === null)).toBe(true);
    expect(await overrideRows()).toHaveLength(0);
  });

  dbit('switching one off removes it from the counting grid and refuses it in a count; the rest are untouched', async () => {
    const before = await getCurrencyDenominations(CURRENCY, scope!.tenantId);
    const off = before[0];
    await saveDenominationOverrides(scope!.tenantId, actor, CURRENCY, [
      { denominationCode: off.denominationCode, isEnabled: false },
      // Enabled with no order of its own is the HQ default: nothing is stored for it.
      { denominationCode: before[1].denominationCode, isEnabled: true },
    ]);

    expect(await overrideRows()).toEqual([{ denomination_code: off.denominationCode, is_enabled: false, display_order: null }]);

    const after = await getCurrencyDenominations(CURRENCY, scope!.tenantId);
    expect(after.map((d) => d.denominationCode)).not.toContain(off.denominationCode);
    expect(after).toHaveLength(before.length - 1);
    // The HQ-wide catalog (no tenant) still lists it: HQ data is never touched.
    expect((await getCurrencyDenominations(CURRENCY)).map((d) => d.denominationCode)).toContain(off.denominationCode);

    await expect(
      prisma.$transaction((tx) => assertDenominationsEnabledTx(tx, scope!.tenantId, CURRENCY, [off.id])),
    ).rejects.toMatchObject({ code: CASH_LEDGER_ERRORS.CASH_DENOMINATION_DISABLED });
    await expect(
      prisma.$transaction((tx) => assertDenominationsEnabledTx(tx, scope!.tenantId, CURRENCY, [before[1].id])),
    ).resolves.toBeUndefined();
  });

  dbit('applies the tenant order, and enabling again with no order removes the override', async () => {
    const before = await getCurrencyDenominations(CURRENCY, scope!.tenantId);
    const [first, second] = before;
    await saveDenominationOverrides(scope!.tenantId, actor, CURRENCY, [
      { denominationCode: first.denominationCode, isEnabled: true, displayOrder: 900 },
      { denominationCode: second.denominationCode, isEnabled: true, displayOrder: 0 },
    ]);
    const reordered = await getCurrencyDenominations(CURRENCY, scope!.tenantId);
    expect(reordered[0].denominationCode).toBe(second.denominationCode);
    expect(reordered[reordered.length - 1].denominationCode).toBe(first.denominationCode);

    await saveDenominationOverrides(scope!.tenantId, actor, CURRENCY, [
      { denominationCode: first.denominationCode, isEnabled: true },
      { denominationCode: second.denominationCode, isEnabled: true },
    ]);
    expect(await overrideRows()).toHaveLength(0);
    expect((await getCurrencyDenominations(CURRENCY, scope!.tenantId)).map((d) => d.denominationCode)).toEqual(
      before.map((d) => d.denominationCode),
    );
  });

  dbit('refuses a code that is not a denomination of the currency', async () => {
    await expect(
      saveDenominationOverrides(scope!.tenantId, actor, CURRENCY, [{ denominationCode: 'NOPE_999', isEnabled: false }]),
    ).rejects.toThrow(/not a OMR denomination/);
    expect(await overrideRows()).toHaveLength(0);
  });
});
