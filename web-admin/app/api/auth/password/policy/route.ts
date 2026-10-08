/**
 * GET /api/auth/password/policy — what the signed-in user's password form needs to know.
 *
 * Returns the tenant's effective password rules (current password required? history depth? breach check?), whether
 * the account has a deliverable email (so the "email me a link" option can be offered, with a masked address) and
 * whether a forced change is pending. Read-only; identity and tenant come from the verified session.
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateJWTWithTenant } from '@/lib/middleware/jwt-tenant-validator'
import { createAdminSupabaseClient } from '@/lib/supabase/server'
import { isDeliverableEmail } from '@/lib/services/auth/password/password-link'
import { loadPasswordPolicy } from '@/lib/services/auth/password/password-policy'

/**
 * @param email - Deliverable address
 * @returns `j***@example.com` style display value
 */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  return `${local.slice(0, 1)}***@${domain}`
}

/**
 * @param request - Incoming request
 */
export async function GET(request: NextRequest) {
  const auth = await validateJWTWithTenant(request)
  if (auth instanceof NextResponse) return auth

  const policy = await loadPasswordPolicy(createAdminSupabaseClient(), auth.tenantId)
  const email: string | undefined = auth.user?.email

  return NextResponse.json({
    success: true,
    data: {
      requireCurrent: policy.requireCurrent,
      freshSigninMin: policy.freshSigninMin,
      historyCount: policy.historyCount,
      breachCheck: policy.breachCheck,
      canEmailLink: isDeliverableEmail(email),
      maskedEmail: isDeliverableEmail(email) ? maskEmail(email) : null,
      mustChange: auth.mustChangePassword,
    },
  })
}
