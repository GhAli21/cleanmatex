import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { checkLoginRateLimit } from '@/lib/middleware/rate-limit';
import { CustomerAppAuthError, signInCustomerApp, type CustomerAppIdentity } from '@/lib/services/customer-app-auth.service';

const bodySchema = z.object({
  identity: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('PHONE'), countryCode: z.string().min(2).max(4), mobileNumber: z.string().min(4).max(14) }),
    z.object({ kind: z.literal('EMAIL'), email: z.string().email().max(254) }),
  ]),
  password: z.string().min(1).max(256),
});

/**
 * POST /api/v1/public/customer/auth/login
 *
 * Authenticates a global Customer App identity and intentionally accepts no tenant identifier.
 * The shared login limiter limits online credential guessing before Argon2id verification.
 *
 * @param request - Public HTTPS request containing a phone-or-email identity and password.
 * @returns Non-enumerating credential error or customer-safe session payload.
 */
export async function POST(request: NextRequest) {
  // Rate limit: five login requests per 15 minutes per IP to slow online credential guessing.
  const rateLimitResponse = await checkLoginRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid sign-in request' }, { status: 400 });
  }

  try {
    // The schema has validated both fields; without strict mode Zod types them as optional.
    const result = await signInCustomerApp({
      identity: parsed.data.identity as CustomerAppIdentity,
      password: parsed.data.password as string,
    });
    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (error) {
    if (error instanceof CustomerAppAuthError) {
      return NextResponse.json({ success: false, error: 'Invalid sign-in credentials' }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: 'Unable to sign in' }, { status: 500 });
  }
}
