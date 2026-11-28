import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { OTP_CHANNELS } from '@/lib/constants/otp';
import { checkLoginRateLimit } from '@/lib/middleware/rate-limit';
import { getClientIp } from '@/lib/services/auth/session/request-meta';
import { normalizePhone } from '@/lib/services/customers.service';
import { OtpSendError, sendOTP } from '@/lib/services/otp.service';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

const bodySchema = z.object({
  phone: z.string().trim().min(6).max(50),
  tenantId: z.string().uuid().optional().nullable(),
  channel: z.enum(OTP_CHANNELS).optional().default('SMS'),
  email: z.string().trim().email().max(255).optional().nullable(),
});

/**
 * POST /api/v1/public/customer/auth/request-otp
 * Public, IP-rate-limited OTP send endpoint for CleanMateX Go mobile customers.
 * Replaces the staff-only `/api/v1/customers/send-otp` route on mobile sign-in.
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await checkLoginRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, errorCode: 'INVALID_REQUEST', error: 'Valid phone number is required' },
      { status: 400 },
    );
  }

  try {
    const supabase = createAdminSupabaseClient();
    let resolvedTenantId = parsed.data.tenantId ?? null;

    if (resolvedTenantId) {
      const { data: tenantRow } = await supabase
        .from('org_tenants_mst')
        .select('id')
        .eq('id', resolvedTenantId)
        .eq('is_active', true)
        .maybeSingle();
      if (!tenantRow) resolvedTenantId = null;
    }

    if (!resolvedTenantId) {
      const norm = normalizePhone(parsed.data.phone);
      const candidates = Array.from(
        new Set(
          [
            parsed.data.phone.trim(),
            norm.normalized,
            norm.normalized.replace(/^\+/, ''),
            norm.nationalNumber,
          ].filter((v): v is string => v.length > 0),
        ),
      );
      const { data: orgCust } = await supabase
        .from('org_customers_mst')
        .select('tenant_org_id')
        .in('phone', candidates)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      resolvedTenantId = orgCust?.tenant_org_id ?? null;
    }

    if (!resolvedTenantId) {
      return NextResponse.json(
        {
          success: false,
          errorCode: 'TENANT_REQUIRED',
          error: 'Please select your laundry before requesting a verification code',
        },
        { status: 400 },
      );
    }

    let resolvedEmail = parsed.data.email?.trim().toLowerCase() || null;

    if (parsed.data.channel === 'EMAIL' && !resolvedEmail) {
      // Fall back to the customer's registered email if they did not type one.
      const norm = normalizePhone(parsed.data.phone);
      const candidates = Array.from(
        new Set(
          [
            parsed.data.phone.trim(),
            norm.normalized,
            norm.normalized.replace(/^\+/, ''),
            norm.nationalNumber,
          ].filter((v): v is string => v.length > 0),
        ),
      );
      const { data: orgCustEmail } = await supabase
        .from('org_customers_mst')
        .select('email, sys_customers_mst(email)')
        .eq('tenant_org_id', resolvedTenantId)
        .in('phone', candidates)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      const sysRef = orgCustEmail?.sys_customers_mst;
      const sysEmail = Array.isArray(sysRef) ? sysRef[0]?.email : sysRef?.email;
      resolvedEmail = (orgCustEmail?.email ?? sysEmail ?? null)?.trim().toLowerCase() || null;
    }

    const result = await sendOTP({
      tenantId: resolvedTenantId,
      userId: 'customer-app-public',
      phone: parsed.data.phone,
      purpose: 'login',
      channel: parsed.data.channel,
      email: parsed.data.channel === 'EMAIL' ? resolvedEmail : undefined,
      requestIp: getClientIp(request.headers),
    });

    return NextResponse.json({ success: true, data: result }, { status: 202 });
  } catch (error) {
    if (error instanceof OtpSendError) {
      return NextResponse.json(
        { success: false, errorCode: error.code, error: error.code },
        { status: error.status },
      );
    }
    logger.error(
      'Public customer request-otp failed',
      error instanceof Error ? error : new Error(String(error)),
      { feature: 'customer_public_otp' },
    );
    return NextResponse.json(
      { success: false, errorCode: 'OTP_SEND_FAILED', error: 'Failed to send verification code' },
      { status: 500 },
    );
  }
}
