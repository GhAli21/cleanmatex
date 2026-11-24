/** @jest-environment node */
import { NextRequest } from 'next/server';

const campaignFind = jest.fn();
const staffFind = jest.fn();
const inboxCreate = jest.fn();
const queue = jest.fn();

jest.mock('@/lib/middleware/require-permission', () => ({
  requirePermission: () => async () => ({ tenantId: 'tenant-a', userId: 'user-a' }),
}));
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_ntf_campaigns_mst: { findFirst: (...a: unknown[]) => campaignFind(...a) },
    org_users_mst: { findFirst: (...a: unknown[]) => staffFind(...a) },
    org_ntf_inbox_mst: { create: (...a: unknown[]) => inboxCreate(...a) },
    $transaction: (fn: (tx: unknown) => unknown) => fn('tx'),
  },
}));
jest.mock('@/lib/db/tenant-context', () => ({ withTenantContext: (_t: string, fn: () => unknown) => fn() }));
jest.mock('@/lib/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn() } }));
jest.mock('@lib/notifications/campaign-jobs.service', () => ({
  renderCampaignContent: jest.fn().mockResolvedValue({ title: 'Eid', title2: null, body: 'Offer', body2: null, metadata: { variables: { offer: '20%' } } }),
}));
jest.mock('@lib/notifications/immediate-send.service', () => ({
  IMMEDIATE_SEND_PRIORITY: { CAMPAIGN_TEST: 15 },
  queueImmediateSendTx: (...a: unknown[]) => queue(...a),
}));

import { POST } from '@/app/api/v1/notifications/campaigns/[id]/test/route';

const call = () => POST(new NextRequest('http://localhost/x', { method: 'POST' }), { params: Promise.resolve({ id: 'campaign-a' }) });
const campaign = (channel_code: string, status = 'DRAFT') => ({ status, channel_code, template_code: 'mkt.eid', template_vars: {}, name: 'Eid', name2: null, description: null, description2: null });

describe('campaign test send', () => {
  beforeEach(() => jest.clearAllMocks());

  it('queues a WhatsApp test to the staff phone through the outbox, sourced campaign_test', async () => {
    campaignFind.mockResolvedValue(campaign('WHATSAPP'));
    staffFind.mockResolvedValue({ email: null, phone: '+96890123456' });
    queue.mockResolvedValue('outbox-1');

    const res = await call();
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ success: true, data: { outboxId: 'outbox-1' } });
    expect(queue).toHaveBeenCalledWith('tx', expect.objectContaining({
      tenantOrgId: 'tenant-a', channel: 'WHATSAPP', recipientAddress: '+96890123456', recipientUserId: 'user-a',
      sourceEntityType: 'campaign_test', sourceEntityId: 'campaign-a',
      metadata: expect.objectContaining({ variables: { offer: '20%' }, test_send: true }),
    }), 15);
  });

  it('refuses an email test when the staff member has no email, and a running campaign', async () => {
    campaignFind.mockResolvedValue(campaign('EMAIL'));
    staffFind.mockResolvedValue({ email: null, phone: null });
    expect((await call()).status).toBe(422);

    campaignFind.mockResolvedValue(campaign('EMAIL', 'RUNNING'));
    expect((await call()).status).toBe(422);
    expect(queue).not.toHaveBeenCalled();
  });

  it('delivers an in-app test directly, without the outbox', async () => {
    campaignFind.mockResolvedValue(campaign('IN_APP'));
    const res = await call();
    expect(res.status).toBe(200);
    expect(inboxCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ tenant_org_id: 'tenant-a', recipient_user_id: 'user-a' }) });
    expect(queue).not.toHaveBeenCalled();
  });
});
