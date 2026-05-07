/**
 * Settings → General API
 *
 *   GET  /api/v1/settings/general — load business info, hours, locale
 *   PUT  /api/v1/settings/general — replace business info, hours, locale
 *
 * Backed by `lib/services/tenant-profile.service.ts` which writes first-class
 * columns on `org_tenants_mst`. Tenant scope comes from the JWT (never the
 * body); see also RLS policy `tenant_access_own_tenant` (migration 0004).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/middleware/require-permission';
import { checkAPIRateLimitTenant } from '@/lib/middleware/rate-limit';
import { validateCSRF } from '@/lib/middleware/csrf';
import { logger } from '@/lib/utils/logger';
import {
  getTenantProfile,
  updateTenantGeneral,
  TenantProfileError,
} from '@/lib/services/tenant-profile.service';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const HHmm = /^([01]\d|2[0-3]):[0-5]\d$/;

const dayHoursSchema = z.object({
  open: z.string().regex(HHmm, 'open must be HH:mm'),
  close: z.string().regex(HHmm, 'close must be HH:mm'),
  closed: z.boolean(),
});

const businessHoursSchema = z.object({
  monday: dayHoursSchema,
  tuesday: dayHoursSchema,
  wednesday: dayHoursSchema,
  thursday: dayHoursSchema,
  friday: dayHoursSchema,
  saturday: dayHoursSchema,
  sunday: dayHoursSchema,
});

const ALLOWED_COUNTRIES = ['OM', 'SA', 'AE', 'KW', 'BH', 'QA'] as const;
const ALLOWED_TIMEZONES = [
  'Asia/Muscat',
  'Asia/Riyadh',
  'Asia/Dubai',
  'Asia/Kuwait',
  'Asia/Bahrain',
  'Asia/Qatar',
] as const;
const ALLOWED_CURRENCIES = ['SAR', 'OMR', 'AED', 'KWD', 'BHD', 'QAR'] as const;
const ALLOWED_LANGUAGES = ['en', 'ar'] as const;

const generalInputSchema = z.object({
  businessName: z.string().trim().min(1, 'businessName is required').max(250),
  businessNameAr: z.string().trim().max(250).optional().default(''),
  email: z.string().trim().email('invalid email'),
  phone: z.string().trim().min(3).max(50),
  address: z.string().trim().max(500).optional().default(''),
  city: z.string().trim().max(100).optional().default(''),
  country: z.enum(ALLOWED_COUNTRIES),
  timezone: z.enum(ALLOWED_TIMEZONES),
  currency: z.enum(ALLOWED_CURRENCIES),
  defaultLanguage: z.enum(ALLOWED_LANGUAGES),
  businessHours: businessHoursSchema,
});

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const authCheck = await requirePermission('settings:read')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId } = authCheck;

    const { general } = await getTenantProfile(tenantId);
    return NextResponse.json({ success: true, data: general });
  } catch (err) {
    logger.error('GET /settings/general failed', { err });
    return NextResponse.json(
      { error: 'Failed to load general settings' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PUT
// ---------------------------------------------------------------------------

export async function PUT(request: NextRequest) {
  try {
    const csrfResponse = await validateCSRF(request);
    if (csrfResponse) return csrfResponse;

    const authCheck = await requirePermission('settings:organization')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId, userId } = authCheck;

    const rl = await checkAPIRateLimitTenant(tenantId);
    if (rl) return rl;

    const raw = await request.json();
    const parsed = generalInputSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          fieldErrors: flattenZod(parsed.error),
        },
        { status: 400 }
      );
    }

    const userInfo = request.headers.get('user-agent') ?? undefined;

    try {
      const updated = await updateTenantGeneral(tenantId, parsed.data, {
        userId,
        userInfo,
      });
      revalidatePath('/dashboard/settings/general');
      return NextResponse.json({ success: true, data: updated });
    } catch (err) {
      if (err instanceof TenantProfileError) {
        return mapDomainError(err);
      }
      throw err;
    }
  } catch (err) {
    logger.error('PUT /settings/general failed', { err });
    return NextResponse.json(
      { error: 'Failed to update general settings' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers (kept local; one file = one responsibility)
// ---------------------------------------------------------------------------

function flattenZod(zodErr: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of zodErr.issues) {
    const path = issue.path.join('.') || '_root';
    if (!out[path]) out[path] = issue.message;
  }
  return out;
}

function mapDomainError(err: TenantProfileError): NextResponse {
  switch (err.code) {
    case 'EMAIL_TAKEN':
      return NextResponse.json(
        { error: err.message, code: err.code, fieldErrors: { email: err.message } },
        { status: 409 }
      );
    case 'CURRENCY_LOCKED':
      return NextResponse.json(
        { error: err.message, code: err.code, fieldErrors: { currency: err.message } },
        { status: 409 }
      );
    case 'COUNTRY_LOCKED':
      return NextResponse.json(
        { error: err.message, code: err.code, fieldErrors: { country: err.message } },
        { status: 409 }
      );
    case 'NOT_FOUND':
      return NextResponse.json({ error: err.message, code: err.code }, { status: 404 });
    default:
      return NextResponse.json({ error: err.message, code: err.code }, { status: 500 });
  }
}
