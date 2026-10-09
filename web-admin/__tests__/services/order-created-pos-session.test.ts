import { stampCreatedPosSession } from '@/lib/services/order-created-pos-session';

jest.mock('server-only', () => ({}), { virtual: true });

jest.mock('@prisma/client', () => ({
  Prisma: {
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
      strings: Array.from(strings),
      values,
    }),
    empty: { strings: [''], values: [] },
  },
}));

describe('stampCreatedPosSession', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const orderId = '22222222-2222-4222-8222-222222222222';
  const sessionId = '33333333-3333-4333-8333-333333333333';

  it('does not write when there is no session and no user', async () => {
    const executeRaw = jest.fn();
    await stampCreatedPosSession({ $executeRaw: executeRaw, $queryRaw: jest.fn() } as never, {
      tenantId,
      orderId,
    });
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it('writes only while the creating session is still empty', async () => {
    const executeRaw = jest.fn().mockResolvedValue(1);
    await stampCreatedPosSession({ $executeRaw: executeRaw, $queryRaw: jest.fn() } as never, {
      tenantId,
      orderId,
      posSessionId: sessionId,
    });
    const sql = executeRaw.mock.calls[0][0] as { strings: string[]; values: unknown[] };
    const text = sql.strings.join(' ');
    expect(text).toContain('created_pos_session_id IS NULL');
    expect(text).toContain('o.tenant_org_id');
    expect(sql.values).toEqual(expect.arrayContaining([tenantId, orderId, sessionId]));
  });
});
