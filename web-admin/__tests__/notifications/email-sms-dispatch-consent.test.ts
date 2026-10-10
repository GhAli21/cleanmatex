/** @jest-environment node */
import { deliverEmailOutbox, type OutboxEmailRow } from '@lib/notifications/adapters/email';
import { deliverSmsOutbox, type OutboxSmsRow } from '@lib/notifications/adapters/sms';
import { sendEmail } from '@lib/notifications/email-sender';
import { resolveCustomerDispatchConsent } from '@lib/notifications/customer-dispatch-consent';
import { isNtfDispatchViaHq, getTwilioSmsFrom } from '@lib/notifications/config';
import twilio from 'twilio';

jest.mock('@lib/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@lib/notifications/email-sender', () => ({ sendEmail: jest.fn() }));
jest.mock('@lib/notifications/customer-dispatch-consent', () => ({ resolveCustomerDispatchConsent: jest.fn() }));
jest.mock('@lib/notifications/config', () => ({
  isNtfDispatchViaHq: jest.fn(),
  getNtfHqDispatchUrl: jest.fn(),
  getTwilioSmsFrom: jest.fn(),
}));
jest.mock('twilio', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@lib/notifications/log-missing-env', () => ({ collectMissingEnv: jest.fn(() => []), logMissingNotificationEnv: jest.fn() }));

const emailRow: OutboxEmailRow = {
  id: 'outbox-email-1', tenant_org_id: 'tenant-a', recipient_address: 'customer@example.com',
  recipient_user_id: 'customer-a', rendered_subject: 'Order ready', rendered_body: '<p>Ready</p>',
  event_code: 'order.ready', retry_count: 0, source_entity_type: 'order', source_entity_id: 'order-a',
};

const smsRow: OutboxSmsRow = {
  id: 'outbox-sms-1', tenant_org_id: 'tenant-a', recipient_address: '+96891234567',
  rendered_body: 'Ready', event_code: 'order.ready', retry_count: 0,
  source_entity_type: 'order', source_entity_id: 'order-a',
};

describe('EMAIL dispatch consent recheck', () => {
  const createMessage = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(isNtfDispatchViaHq).mockResolvedValue(false);
    jest.mocked(getTwilioSmsFrom).mockResolvedValue('+96890000000');
    jest.mocked(twilio).mockReturnValue({ messages: { create: createMessage } } as unknown as ReturnType<typeof twilio>);
    createMessage.mockResolvedValue({ sid: 'SM-sms-test' });
    process.env.TWILIO_ACCOUNT_SID = 'AC-test';
    process.env.TWILIO_AUTH_TOKEN = 'test-token';
  });

  it('sends exactly as before for an eligible recipient (no applicable consent gate)', async () => {
    jest.mocked(resolveCustomerDispatchConsent).mockResolvedValue({ applicable: false, allowed: true });
    jest.mocked(sendEmail).mockResolvedValue(true);
    const result = await deliverEmailOutbox(emailRow);
    expect(result).toEqual({ success: true });
    expect(sendEmail).toHaveBeenCalledWith({ to: 'customer@example.com', subject: 'Order ready', html: '<p>Ready</p>' });
  });

  it('sends exactly as before for a customer who never opted out', async () => {
    jest.mocked(resolveCustomerDispatchConsent).mockResolvedValue({ applicable: true, allowed: true });
    jest.mocked(sendEmail).mockResolvedValue(true);
    const result = await deliverEmailOutbox(emailRow);
    expect(result).toEqual({ success: true });
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it('skips (not errors) a customer who explicitly opted out of email, with no provider call', async () => {
    jest.mocked(resolveCustomerDispatchConsent).mockResolvedValue({
      applicable: true, allowed: false, retryable: false, reason: 'Customer has opted out of email notifications',
    });
    const result = await deliverEmailOutbox(emailRow);
    expect(result).toEqual({ success: false, skipped: true, errorMessage: 'Customer has opted out of email notifications' });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('treats a retryable consent lookup failure as a temporary failure, not a skip, with no provider call', async () => {
    jest.mocked(resolveCustomerDispatchConsent).mockResolvedValue({
      applicable: true, allowed: false, retryable: true, reason: 'email customer consent lookup failed for the source order',
    });
    const result = await deliverEmailOutbox(emailRow);
    expect(result).toEqual({ success: false, permanent: false, errorMessage: 'email customer consent lookup failed for the source order' });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('calls resolveCustomerDispatchConsent with the row tenant/source, not an inferred value', async () => {
    jest.mocked(resolveCustomerDispatchConsent).mockResolvedValue({ applicable: false, allowed: true });
    jest.mocked(sendEmail).mockResolvedValue(true);
    await deliverEmailOutbox(emailRow);
    expect(resolveCustomerDispatchConsent).toHaveBeenCalledWith('tenant-a', 'email', 'order', 'order-a');
  });
});

describe('SMS dispatch consent recheck', () => {
  const createMessage = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(isNtfDispatchViaHq).mockResolvedValue(false);
    jest.mocked(getTwilioSmsFrom).mockResolvedValue('+96890000000');
    jest.mocked(twilio).mockReturnValue({ messages: { create: createMessage } } as unknown as ReturnType<typeof twilio>);
    createMessage.mockResolvedValue({ sid: 'SM-sms-test' });
    process.env.TWILIO_ACCOUNT_SID = 'AC-test';
    process.env.TWILIO_AUTH_TOKEN = 'test-token';
  });

  it('sends exactly as before for an eligible recipient', async () => {
    jest.mocked(resolveCustomerDispatchConsent).mockResolvedValue({ applicable: true, allowed: true });
    const result = await deliverSmsOutbox(smsRow);
    expect(result).toEqual({ success: true });
    expect(createMessage).toHaveBeenCalledWith({ from: '+96890000000', to: '+96891234567', body: 'Ready' });
  });

  it('skips a customer who explicitly opted out of SMS, with no provider call', async () => {
    jest.mocked(resolveCustomerDispatchConsent).mockResolvedValue({
      applicable: true, allowed: false, retryable: false, reason: 'Customer has opted out of sms notifications',
    });
    const result = await deliverSmsOutbox(smsRow);
    expect(result).toEqual({ success: false, skipped: true, errorMessage: 'Customer has opted out of sms notifications' });
    expect(createMessage).not.toHaveBeenCalled();
  });

  it('never falls back to another channel when SMS consent is blocked (checks only this channel)', async () => {
    jest.mocked(resolveCustomerDispatchConsent).mockResolvedValue({
      applicable: true, allowed: false, retryable: false, reason: 'Customer has opted out of sms notifications',
    });
    await deliverSmsOutbox(smsRow);
    expect(resolveCustomerDispatchConsent).toHaveBeenCalledWith('tenant-a', 'sms', 'order', 'order-a');
    expect(resolveCustomerDispatchConsent).toHaveBeenCalledTimes(1);
  });
});
