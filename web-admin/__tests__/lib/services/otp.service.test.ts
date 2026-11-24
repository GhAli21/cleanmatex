/** @jest-environment node */
/**
 * Customer verification codes (Background Jobs STEP5_PLAN item 5): signed token, hashed code,
 * send limits, allowed countries, and the outbox send.
 */
jest.mock('server-only', () => ({}));

const tx = {
  $executeRaw: jest.fn().mockResolvedValue(0),
  sys_otp_codes: { count: jest.fn(), create: jest.fn() },
};
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_tenants_mst: { findFirst: jest.fn().mockResolvedValue({ name: 'Clean Co', name2: 'كلين', language: 'en' }) },
    org_customers_mst: { findFirst: jest.fn().mockResolvedValue({ preferred_language: 'ar' }) },
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  },
}));
jest.mock('@/lib/db/tenant-context', () => ({ withTenantContext: (_t: string, fn: () => unknown) => fn() }));
jest.mock('@/lib/notifications/settings-service', () => ({
  notificationSettingsService: { isChannelEnabled: jest.fn().mockResolvedValue(true) },
}));
jest.mock('@/lib/notifications/template-renderer', () => ({
  renderChannelTemplate: jest.fn(async (_e: string, _c: string, v: Record<string, string>) => ({
    title: 'Code', title2: 'رمز', body: `EN ${v.otp_code}`, body2: `AR ${v.otp_code}`, metadata: {},
  })),
}));
const queueImmediateSendTx = jest.fn().mockResolvedValue('outbox-1');
jest.mock('@/lib/notifications/immediate-send.service', () => ({
  IMMEDIATE_SEND_PRIORITY: { OTP: 20, RECEIPT: 15 },
  queueImmediateSendTx: (...args: unknown[]) => queueImmediateSendTx(...args),
}));

import {
  generateVerificationToken,
  hashOtpCode,
  OtpSendError,
  sendOTP,
  verifyVerificationToken,
} from '@/lib/services/otp.service';

const SECRET = 'x'.repeat(40);
const base = { tenantId: 't-1', userId: 'u-1', phone: '90123456', purpose: 'verification' as const, requestIp: '10.0.0.1' };

beforeEach(() => {
  process.env.OTP_HMAC_SECRET = SECRET;
  jest.clearAllMocks();
  tx.sys_otp_codes.count.mockResolvedValue(0);
  tx.sys_otp_codes.create.mockResolvedValue({ id: 'otp-1' });
});

describe('verification token', () => {
  it('round-trips a signed token and rejects tampered, unsigned and expired ones', () => {
    const token = generateVerificationToken('+96890123456');
    expect(verifyVerificationToken(token)).toEqual({ phone: '+96890123456' });

    const [v, payload, sig] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ phone: '+96899999999', exp: Date.now() + 60_000 })).toString('base64url');
    expect(verifyVerificationToken(`${v}.${forged}.${sig}`)).toBeNull();
    // The pre-5d format: base64 JSON with no signature.
    expect(verifyVerificationToken(Buffer.from(JSON.stringify({ phone: '+96890123456', exp: 9e15 })).toString('base64'))).toBeNull();
    expect(verifyVerificationToken(`${v}.${payload}.`)).toBeNull();

    jest.useFakeTimers().setSystemTime(Date.now() + 16 * 60_000);
    expect(verifyVerificationToken(token)).toBeNull();
    jest.useRealTimers();
  });

  it('fails closed without the secret', () => {
    delete process.env.OTP_HMAC_SECRET;
    expect(() => generateVerificationToken('+96890123456')).toThrow('OTP_HMAC_SECRET');
  });
});

describe('hashOtpCode', () => {
  it('stores a 64-character hash bound to the phone', () => {
    const hash = hashOtpCode('+96890123456', '123456');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashOtpCode('+96890000000', '123456')).not.toBe(hash);
  });
});

describe('sendOTP', () => {
  it('queues an SMS in the customer language at the highest priority, storing only the hash', async () => {
    const result = await sendOTP({ ...base, channel: 'SMS', customerId: 'c-1' });
    expect(result).toMatchObject({ success: true, outboxId: 'outbox-1' });

    const stored = tx.sys_otp_codes.create.mock.calls[0][0].data;
    expect(stored).toMatchObject({ phone: '+96890123456', purpose: 'verification', request_ip: '10.0.0.1' });
    expect(stored.code).toMatch(/^[0-9a-f]{64}$/);

    const [, send, priority] = queueImmediateSendTx.mock.calls[0];
    expect(priority).toBe(20);
    expect(send).toMatchObject({
      channel: 'SMS', recipientAddress: '+96890123456', eventCode: 'customer.otp_generated',
      sourceEntityType: 'otp', sourceEntityId: 'otp-1', idempotencyKey: 'otp:otp-1', maxRetries: 2,
    });
    const code = (send.body as string).replace('AR ', '');
    expect(send.body).toMatch(/^AR \d{6}$/); // customer prefers Arabic
    expect(stored.code).toBe(hashOtpCode('+96890123456', code));
    expect(send.metadata.variables).toBeUndefined(); // the code is only in WhatsApp metadata
  });

  it('puts the code in metadata.variables for WhatsApp and sends email to the given address', async () => {
    await sendOTP({ ...base, channel: 'WHATSAPP' });
    expect(queueImmediateSendTx.mock.calls[0][1].metadata.variables.otp_code).toMatch(/^\d{6}$/);

    await sendOTP({ ...base, phone: '+447911123456', channel: 'EMAIL', email: ' Customer@Example.com ' });
    expect(queueImmediateSendTx.mock.calls[1][1]).toMatchObject({ channel: 'EMAIL', recipientAddress: 'customer@example.com' });
  });

  it('refuses SMS outside the served countries, email without an address, and an invalid phone', async () => {
    await expect(sendOTP({ ...base, phone: '+447911123456', channel: 'SMS' })).rejects.toMatchObject({ code: 'OTP_COUNTRY_NOT_ALLOWED', status: 422 });
    await expect(sendOTP({ ...base, channel: 'EMAIL', email: 'not-an-email' })).rejects.toMatchObject({ code: 'OTP_EMAIL_REQUIRED' });
    await expect(sendOTP({ ...base, phone: '12', channel: 'SMS' })).rejects.toMatchObject({ code: 'OTP_INVALID_PHONE' });
    expect(queueImmediateSendTx).not.toHaveBeenCalled();
  });

  it('refuses within the cooldown and above the hourly limits, without creating a code', async () => {
    tx.sys_otp_codes.count.mockResolvedValueOnce(1); // a code in the last minute
    await expect(sendOTP({ ...base, channel: 'SMS' })).rejects.toBeInstanceOf(OtpSendError);

    tx.sys_otp_codes.count.mockResolvedValueOnce(0).mockResolvedValueOnce(5); // 5 this hour for the phone
    await expect(sendOTP({ ...base, channel: 'SMS' })).rejects.toMatchObject({ code: 'OTP_RATE_LIMITED', status: 429 });

    tx.sys_otp_codes.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(30); // 30 from the IP
    await expect(sendOTP({ ...base, channel: 'SMS' })).rejects.toMatchObject({ code: 'OTP_RATE_LIMITED' });
    expect(tx.sys_otp_codes.create).not.toHaveBeenCalled();
  });
});
