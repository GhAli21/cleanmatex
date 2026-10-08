/**
 * Emailed "choose a new password" link — used for (a) a signed-in user who prefers the link over typing their
 * current password and (b) an administrator who wants the user to choose their own password.
 *
 * The link carries a Supabase one-time recovery token hash and lands on GET /auth/confirm, which verifies it in
 * the RECIPIENT's browser (no PKCE verifier needed, so it works when someone else requested it). No password is
 * ever placed in the email. The token is single-use and expires with the project's OTP expiry (default 1 hour).
 */

import { SYNTHETIC_EMAIL_DOMAIN } from '@/lib/constants/auth-session'
import type { createAdminSupabaseClient } from '@/lib/supabase/server'
import { sendEmail as defaultSendEmail } from '@lib/notifications/email-sender'
import { logger } from '@/lib/utils/logger'

type AdminClient = ReturnType<typeof createAdminSupabaseClient>

/** Why the link was requested (selects the wording). */
export type PasswordLinkReason = 'self' | 'admin'

/**
 * @param email - Account email
 * @returns true when the address is a real mailbox (not the synthetic sign-in address of email-less users)
 */
export function isDeliverableEmail(email: string | null | undefined): email is string {
  return !!email && email.includes('@') && !email.toLowerCase().endsWith(SYNTHETIC_EMAIL_DOMAIN)
}

/**
 * Build the public URL of the confirm route for a hashed recovery token.
 *
 * @param siteUrl - Public origin of the app (no trailing slash needed)
 * @param tokenHash - `hashed_token` from auth.admin.generateLink
 */
export function buildPasswordLinkUrl(siteUrl: string, tokenHash: string): string {
  const base = siteUrl.replace(/\/+$/, '')
  return `${base}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`
}

/** HTML-escape a value placed into the email template. */
function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Bilingual (EN + AR) email body. One message in both languages because the recipient's language is not
 * known to this layer.
 */
export function renderPasswordLinkEmail(url: string, reason: PasswordLinkReason) {
  const u = esc(url)
  const enWhy =
    reason === 'admin'
      ? 'An administrator asked you to choose a new password for your account.'
      : 'You asked for a link to change your account password.'
  const arWhy =
    reason === 'admin'
      ? 'طلب منك أحد المسؤولين اختيار كلمة مرور جديدة لحسابك.'
      : 'لقد طلبت رابطاً لتغيير كلمة مرور حسابك.'
  const subject = 'Choose a new password · اختيار كلمة مرور جديدة'
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;line-height:1.6">
<p>${enWhy}</p>
<p><a href="${u}" style="display:inline-block;padding:10px 18px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none">Choose a new password</a></p>
<p style="color:#555">The link works once and expires soon. If you did not expect this email, ignore it — your password has not changed.</p>
<hr style="border:none;border-top:1px solid #ddd;margin:24px 0">
<div dir="rtl" style="text-align:right">
<p>${arWhy}</p>
<p><a href="${u}" style="display:inline-block;padding:10px 18px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none">اختيار كلمة مرور جديدة</a></p>
<p style="color:#555">الرابط صالح لمرة واحدة وتنتهي صلاحيته قريباً. إذا لم تتوقع هذه الرسالة فتجاهلها — لم تتغير كلمة مرورك.</p>
</div></div>`
  const text = `${enWhy}\n${url}\nThe link works once and expires soon.\n\n${arWhy}\n${url}`
  return { subject, html, text }
}

/**
 * Generate a recovery token for the account and email the link.
 *
 * @param admin - Service-role client
 * @param params.email - Real account email (checked with isDeliverableEmail by the caller)
 * @param params.siteUrl - Public origin used to build the link
 * @param params.reason - Wording selector
 * @param send - Injectable mailer (tests)
 * @returns true when the email was handed to the mail provider
 */
export async function sendPasswordLink(
  admin: AdminClient,
  params: { email: string; siteUrl: string; reason: PasswordLinkReason },
  send: typeof defaultSendEmail = defaultSendEmail
): Promise<boolean> {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email: params.email })
  const tokenHash = data?.properties?.hashed_token
  if (error || !tokenHash) {
    logger.error('Failed to generate password link', error ?? new Error('no token'), { feature: 'auth' })
    return false
  }

  const mail = renderPasswordLinkEmail(buildPasswordLinkUrl(params.siteUrl, tokenHash), params.reason)
  return send({ to: params.email, subject: mail.subject, html: mail.html, text: mail.text })
}

/**
 * Public origin for links: explicit env first (reliable behind proxies), the request origin otherwise.
 *
 * @param requestOrigin - `request.nextUrl.origin`
 */
export function resolveSiteUrl(requestOrigin: string): string {
  return process.env.NEXT_PUBLIC_SITE_URL || requestOrigin
}
