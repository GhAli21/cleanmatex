/**
 * C1-1c — real-DB proof that the opening/closing count policy is enforced by the server, not just
 * offered by the form: a tenant that requires denominations cannot be bypassed with a bare total, a
 * total-only tenant cannot post denominations, and a denominations-required policy falls back to a
 * total only when the tenant has nothing to count with in the drawer's currency.
 *
 * Local DB only — never remote. Skips gracefully when no DB is reachable.
 *
 * @jest-environment node
 */
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import { updateCashControlSettings } from '@/lib/services/cash-control-settings.service';
import { startClose } from '@/lib/services/cash-drawer-session.service';
import { getDrawerCountPolicy } from '@/lib/services/cash-drawer-count-policy.service';
import { listEffectiveDenominations, saveDenominationOverrides } from '@/lib/services/cash-denomination-control.service';
import { CASH_LEDGER_ERRORS } from '@/lib/constants/cash-drawer';
import { cleanupTestDrawers, createTestDrawer, openTestSession, resolveTestScope, type DbTestScope } from './helpers/cash-drawer-fixtures';

let scope: DbTestScope | null = null;
let realUserId = '';

beforeAll(async () => {
  scope = await resolveTestScope();
  if (!scope) return;
  const [user] = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM public.org_users_mst WHERE tenant_org_id = ${scope.tenantId}::uuid ORDER BY created_at LIMIT 1`;
  realUserId = user.id;
});

afterEach(async () => {
  if (!scope) return;
  await prisma.$executeRaw`
    DELETE FROM public.org_currency_denom_cf WHERE tenant_org_id = ${scope.tenantId}::uuid AND currency_code = 'OMR'`;
});

afterAll(async () => {
  await prisma.$disconnect();
});

function dbit(name: string, fn: () => Promise<void>): void {
  it(
    name,
    async () => {
      if (!scope) {
        console.warn(`[cash-drawer-count-policy] DB unavailable — skipping: ${name}`);
        return;
      }
      await fn();
    },
    120_000,
  );
}

async function withDrawer(
  closingMode: 'TOTAL_ONLY' | 'DENOMINATION' | 'OPTIONAL_DENOMINATION',
  run: (ctx: { drawerId: string; sessionId: string; actor: string }) => Promise<void>,
) {
  const drawerId = await createTestDrawer(scope!, { codePrefix: 'C11C-TEST', name: 'C1-1c count policy' });
  const actor = randomUUID();
  try {
    await updateCashControlSettings(
      { tenantId: scope!.tenantId, drawerId },
      { closingCountMode: closingMode },
      { userId: realUserId, reason: 'C1-1c count policy proof' },
    );
    const { sessionId } = await openTestSession(scope!, actor, drawerId);
    await run({ drawerId, sessionId, actor });
  } finally {
    await prisma.org_fin_cash_ctrl_audit_dtl.deleteMany({ where: { tenant_org_id: scope!.tenantId, scope_id: drawerId } });
    await cleanupTestDrawers(scope!, [drawerId]);
  }
}

describe('opening/closing count policy (C1-1c)', () => {
  dbit('a denominations-required policy refuses a bare total, and the form is told only denominations', async () => {
    await withDrawer('DENOMINATION', async ({ drawerId, sessionId, actor }) => {
      const policy = await getDrawerCountPolicy(scope!.tenantId, actor, drawerId);
      expect(policy?.closing).toEqual(['DENOMINATION']);

      await expect(
        startClose(scope!.tenantId, actor, {
          sessionId,
          drawerId,
          closingCount: { countMode: 'TOTAL_ONLY', totalAmount: 0 },
        }),
      ).rejects.toMatchObject({ code: CASH_LEDGER_ERRORS.CASH_COUNT_MODE_NOT_ALLOWED });
    });
  });

  dbit('a total-only policy refuses denominations; an optional policy allows either', async () => {
    await withDrawer('TOTAL_ONLY', async ({ drawerId, sessionId, actor }) => {
      expect((await getDrawerCountPolicy(scope!.tenantId, actor, drawerId))?.closing).toEqual(['TOTAL_ONLY']);
      const denoms = await listEffectiveDenominations(scope!.tenantId, 'OMR');
      const first = await prisma.sys_currency_denominations_cd.findFirst({
        where: { currency_code: 'OMR', denomination_code: denoms[0].denominationCode },
        select: { id: true },
      });
      await expect(
        startClose(scope!.tenantId, actor, {
          sessionId,
          drawerId,
          closingCount: { countMode: 'DENOMINATION', denominations: [{ denominationId: first!.id, quantity: 1 }] },
        }),
      ).rejects.toMatchObject({ code: CASH_LEDGER_ERRORS.CASH_COUNT_MODE_NOT_ALLOWED });
    });

    await withDrawer('OPTIONAL_DENOMINATION', async ({ drawerId, sessionId, actor }) => {
      expect((await getDrawerCountPolicy(scope!.tenantId, actor, drawerId))?.closing).toEqual(['TOTAL_ONLY', 'DENOMINATION']);
      const started = await startClose(scope!.tenantId, actor, {
        sessionId,
        drawerId,
        closingCount: { countMode: 'TOTAL_ONLY', totalAmount: 0 },
      });
      expect(started.currencyBalances[0].closingVariance).toBe('0.0000');
    });
  });

  dbit('denominations-required falls back to a total when the tenant has nothing to count with in the currency', async () => {
    await withDrawer('DENOMINATION', async ({ drawerId, sessionId, actor }) => {
      const all = await listEffectiveDenominations(scope!.tenantId, 'OMR');
      await saveDenominationOverrides(
        scope!.tenantId,
        actor,
        'OMR',
        all.map((d) => ({ denominationCode: d.denominationCode, isEnabled: false })),
      );

      // The form is told a total is fine (no empty grid to be stuck on) …
      expect((await getDrawerCountPolicy(scope!.tenantId, actor, drawerId))?.closing).toEqual(['TOTAL_ONLY']);
      // … and the server agrees.
      const started = await startClose(scope!.tenantId, actor, {
        sessionId,
        drawerId,
        closingCount: { countMode: 'TOTAL_ONLY', totalAmount: 0 },
      });
      expect(started.sessionId).toBe(sessionId);
    });
  });
});
