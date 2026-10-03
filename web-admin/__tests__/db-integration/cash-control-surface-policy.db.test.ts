/**
 * D62 — DB-integration for the per-screen POS-session policy (migrations 0554 + 0557): the six
 * `pos_session_mode_*` columns persist through the real settings service, resolve with the
 * documented defaults, and the database itself rejects an invalid mode (CHECK constraints).
 *
 * Local DB only — never remote. Skips gracefully when no DB is reachable.
 *
 * @jest-environment node
 */
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import { getCashControlSettings, updateCashControlSettings } from '@/lib/services/cash-control-settings.service';
import { POS_SESSION_REQUIREMENT_MODE as MODE } from '@/lib/constants/pos-session';
import { cleanupTestDrawers, createTestDrawer, resolveTestScope, type DbTestScope } from './helpers/cash-drawer-fixtures';

let scope: DbTestScope | null = null;

beforeAll(async () => {
  scope = await resolveTestScope();
});

afterAll(async () => {
  await prisma.$disconnect();
});

function dbit(name: string, fn: () => Promise<void>): void {
  it(name, async () => {
    if (!scope) {
      console.warn(`[cash-control-surface-policy] DB unavailable — skipping: ${name}`);
      return;
    }
    await fn();
  });
}

async function withDrawerScope(run: (drawerId: string, userId: string) => Promise<void>): Promise<void> {
  const drawerId = await createTestDrawer(scope!, { codePrefix: 'PSM', name: 'PSM policy proof' });
  // The settings audit trail keeps a real tenant user (FK to org_users_mst).
  const [realUser] = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM public.org_users_mst WHERE tenant_org_id = ${scope!.tenantId}::uuid ORDER BY created_at LIMIT 1`;
  try {
    await run(drawerId, realUser.id);
  } finally {
    await prisma.org_fin_cash_ctrl_stng_cf.deleteMany({ where: { tenant_org_id: scope!.tenantId, scope_id: drawerId } });
    await prisma.org_fin_cash_ctrl_audit_dtl.deleteMany({ where: { tenant_org_id: scope!.tenantId, scope_id: drawerId } });
    await cleanupTestDrawers(scope!, [drawerId]);
  }
}

describe('per-screen POS-session policy (D62)', () => {
  dbit('a scope with no override resolves every screen to its default', async () => {
    await withDrawerScope(async (drawerId) => {
      const s = await getCashControlSettings({ tenantId: scope!.tenantId, drawerId });
      expect(s.posSessionModeOrderEntry).toBe(MODE.REQUIRED_FOR_CASH);
      expect(s.posSessionModeLaterColl).toBe(MODE.OPTIONAL);
      expect(s.posSessionModeStoredVal).toBe(MODE.OPTIONAL);
      expect(s.posSessionModeCashRefd).toBe(MODE.OPTIONAL);
      expect(s.posSessionModeCustRcpt).toBe(MODE.OPTIONAL);
      expect(s.posSessionModeManualVchr).toBe(MODE.OPTIONAL);
    });
  });

  dbit('each screen stores and resolves its own mode, independently of the others, with an audit row per change', async () => {
    await withDrawerScope(async (drawerId, userId) => {
      await updateCashControlSettings(
        { tenantId: scope!.tenantId, drawerId },
        {
          posSessionModeOrderEntry: MODE.OPTIONAL,
          posSessionModeManualVchr: MODE.REQUIRED,
          posSessionModeCustRcpt: MODE.REQUIRED_FOR_CASH,
        },
        { userId, reason: 'D62 per-screen policy proof' },
      );
      const s = await getCashControlSettings({ tenantId: scope!.tenantId, drawerId });
      expect(s.posSessionModeOrderEntry).toBe(MODE.OPTIONAL);
      expect(s.posSessionModeManualVchr).toBe(MODE.REQUIRED);
      expect(s.posSessionModeCustRcpt).toBe(MODE.REQUIRED_FOR_CASH);
      // Untouched screens keep inheriting their defaults.
      expect(s.posSessionModeLaterColl).toBe(MODE.OPTIONAL);
      expect(s.posSessionModeStoredVal).toBe(MODE.OPTIONAL);
      expect(s.posSessionModeCashRefd).toBe(MODE.OPTIONAL);

      const audit = await prisma.org_fin_cash_ctrl_audit_dtl.findMany({
        where: { tenant_org_id: scope!.tenantId, scope_id: drawerId },
        select: { setting_column: true, audit_action: true },
      });
      expect(audit.map((a) => a.setting_column).sort()).toEqual([
        'pos_session_mode_cust_rcpt',
        'pos_session_mode_manual_vchr',
        'pos_session_mode_order_entry',
      ]);

      // Clearing one reverts it to inherit (the default) without touching the others.
      await updateCashControlSettings(
        { tenantId: scope!.tenantId, drawerId },
        { posSessionModeManualVchr: null },
        { userId },
      );
      const cleared = await getCashControlSettings({ tenantId: scope!.tenantId, drawerId });
      expect(cleared.posSessionModeManualVchr).toBe(MODE.OPTIONAL);
      expect(cleared.posSessionModeCustRcpt).toBe(MODE.REQUIRED_FOR_CASH);
    });
  });

  dbit('the database rejects a value that is not a requirement mode (CHECK constraints), for every screen', async () => {
    await withDrawerScope(async (drawerId) => {
      for (const column of [
        'pos_session_mode_order_entry',
        'pos_session_mode_later_coll',
        'pos_session_mode_stored_val',
        'pos_session_mode_cash_refd',
        'pos_session_mode_cust_rcpt',
        'pos_session_mode_manual_vchr',
      ]) {
        await expect(
          prisma.$executeRawUnsafe(
            `INSERT INTO public.org_fin_cash_ctrl_stng_cf (id, tenant_org_id, scope_level, scope_id, ${column})
             VALUES ($1::uuid, $2::uuid, 'DRAWER', $3::uuid, 'ALWAYS')`,
            randomUUID(),
            scope!.tenantId,
            drawerId,
          ),
        ).rejects.toThrow(/check constraint|chk_ofccs_psm|23514/i);
      }
    });
  });

  dbit('the two retired global booleans no longer exist', async () => {
    const cols = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'org_fin_cash_ctrl_stng_cf'
         AND column_name IN ('pos_session_req_for_cash', 'pos_session_req_all_tenders')`;
    expect(cols).toEqual([]);
  });
});
