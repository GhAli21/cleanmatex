/**
 * POST /api/v1/customers/send-otp — send a customer verification code (staff session).
 *
 * Body: { phone, purpose: 'registration' | 'login' | 'verification', channel?: 'SMS' | 'WHATSAPP' | 'EMAIL',
 *         email? (required for EMAIL), customerId? }
 * 202: { success, message, expiresAt, phone (masked), outboxId } — the message is queued; follow it with
 *      GET /api/v1/notifications/outbox/[outboxId]/status.
 * 400/422/429: { error, code } with code from OTP_SEND_ERROR.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContext } from '@/lib/middleware/require-permission';
import { getClientIp } from '@/lib/services/auth/session/request-meta';
import { OtpSendError, sendOTP } from '@/lib/services/otp.service';
import { OTP_CHANNELS } from '@/lib/constants/otp';
import { logger } from '@/lib/utils/logger';

const bodySchema = z.object({
  phone: z.string().trim().min(1).max(50),
  purpose: z.enum(['registration', 'login', 'verification']),
  channel: z.enum(OTP_CHANNELS).default('SMS'),
  email: z.string().trim().max(255).optional(),
  customerId: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  let auth: Awaited<ReturnType<typeof getAuthContext>>;
  try {
    auth = await getAuthContext();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await sendOTP({
      tenantId: auth.tenantId,
      userId: auth.userId,
      ...parsed.data,
      requestIp: getClientIp(request.headers),
    });
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    if (error instanceof OtpSendError) {
      return NextResponse.json({ error: error.code, code: error.code }, { status: error.status });
    }
    logger.error('send-otp failed', error instanceof Error ? error : new Error(String(error)), {
      feature: 'customer-otp', tenantId: auth.tenantId,
    });
    return NextResponse.json({ error: 'Failed to send verification code' }, { status: 500 });
  }
}
