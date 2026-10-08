/**
 * Next.js Proxy for Route Protection
 *
 * Handles:
 * - Internationalization (i18n) with next-intl
 * - Authentication checks
 * - Route protection (public vs protected)
 * - Automatic redirects (login ↔ dashboard)
 * - Token validation
 * - Tenant context verification
 * - Role-based access control
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { defaultLocale } from './i18n'
import { generateCSRFToken, getCSRFTokenFromRequest, setCSRFTokenInResponse } from './lib/security/csrf'
import { isPublicRoutePath } from './lib/security/public-routes'
import { guardSession, isSessionActive } from './lib/auth/session-guard'
import { readRequestMeta } from './lib/services/auth/session/request-meta'
import { DEVICE_COOKIE_NAME, FORCED_PASSWORD_CHANGE_PATH, loginReasonForEndReason } from './lib/constants/auth-session'

/** Cookie storing "Remember me" choice; when "0" or missing, auth cookies are session-only. */
const SB_REMEMBER_ME_COOKIE = 'sb-remember-me'

/**
 * Auth routes (should redirect to dashboard if already authenticated)
 */
// NOTE: /reset-password is deliberately NOT listed: a password-recovery link creates an authenticated session,
// and that user must be able to reach the reset form (listing it would bounce them to the dashboard).
const AUTH_ROUTES = ['/login', '/register', '/forgot-password']

/**
 * Admin-only routes
 */
const ADMIN_ROUTES = [
  '/dashboard/users',
  '/dashboard/settings/organization',
  '/dashboard/settings/billing',
]

/**
 * Default redirect after login
 */
const DEFAULT_REDIRECT = '/dashboard'

/**
 * Login page path
 */
const LOGIN_PATH = '/login'

/**
 * Build a redirect to the login page for an ended/invalid session and clear this browser's Supabase auth
 * cookies on the response. Clearing is essential: otherwise the login page would still see an authenticated
 * user (proxy step 1) and bounce back to the dashboard — an infinite redirect loop.
 *
 * @param request - Incoming request (cookies to clear, return URL)
 * @param reason - ?reason= code for the login page banner
 */
function redirectToLoginClearingSession(request: NextRequest, reason: string): NextResponse {
  const { pathname, search } = request.nextUrl
  const redirectUrl = request.nextUrl.clone()
  redirectUrl.pathname = LOGIN_PATH
  redirectUrl.search = ''
  redirectUrl.searchParams.set('reason', reason)
  redirectUrl.searchParams.set('redirect', pathname + search)

  const redirectResponse = NextResponse.redirect(redirectUrl)
  for (const { name } of request.cookies.getAll()) {
    // Supabase auth cookies (incl. chunked .0/.1) and our remember-me flag all start with sb-.
    if (name.startsWith('sb-')) {
      redirectResponse.cookies.set(name, '', { path: '/', maxAge: 0 })
    }
  }
  return redirectResponse
}

/**
 * Proxy function
 * @param request
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Session-only cookies when sb-remember-me is not "1" (expire on browser close)
  const rememberMe = request.cookies.get(SB_REMEMBER_ME_COOKIE)?.value === '1'
  const applyCookieOptions = (opts: CookieOptions) =>
    rememberMe ? opts : { ...opts, maxAge: undefined, expires: undefined }

  // Create Supabase client with cookie handling
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          const opts = applyCookieOptions(options)
          request.cookies.set({
            name,
            value,
            ...opts,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...opts,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Get user (more reliable than getSession)
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  // Check route types
  const isApiRoute = pathname.startsWith('/api')
  const isPublicRoute = isPublicRoutePath(pathname)
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route))
  const isAdminRoute = ADMIN_ROUTES.some((route) => pathname.startsWith(route))

  // API routes handle their own authentication - don't redirect them
  if (isApiRoute) {
    return response
  }

  // 1. If user is authenticated and trying to access auth routes (login, register)
  // Redirect to dashboard
  if (user && !authError && isAuthRoute) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = DEFAULT_REDIRECT
    return NextResponse.redirect(redirectUrl)
  }

  // 2. If route is public, allow access (set CSRF cookie first for login/register)
  if (isPublicRoute) {
    let csrfToken = getCSRFTokenFromRequest(request)
    if (!csrfToken) {
      csrfToken = generateCSRFToken()
      setCSRFTokenInResponse(response, csrfToken)
    }
    return response
  }

  // 3. If user is not authenticated and trying to access protected route
  // Redirect to login with return URL
  if (!user || authError) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = LOGIN_PATH
    // Add return URL to redirect back after login (keep the query string)
    redirectUrl.searchParams.set('redirect', pathname + request.nextUrl.search)
    return NextResponse.redirect(redirectUrl)
  }

  // 3b. Server-authoritative session lifecycle: the session must still be alive (membership, absolute
  // expiry, idle timeout). Navigation does NOT count as activity — only the client heartbeat extends the
  // idle window — so this validation is read-only apart from ending a timed-out session.
  try {
    const validation = await guardSession(
      supabase,
      readRequestMeta(request.headers, request.cookies.get(DEVICE_COOKIE_NAME)?.value)
    )
    if (!isSessionActive(validation)) {
      return redirectToLoginClearingSession(request, loginReasonForEndReason(validation.endReason))
    }

    // An administrator-set temporary password must be replaced before anything else is reachable; the forced page
    // itself is only for accounts in that state.
    const onForcedPage = pathname === FORCED_PASSWORD_CHANGE_PATH
    if (validation.mustChangePassword !== onForcedPage) {
      const target = request.nextUrl.clone()
      target.pathname = validation.mustChangePassword ? FORCED_PASSWORD_CHANGE_PATH : DEFAULT_REDIRECT
      target.search = ''
      return NextResponse.redirect(target)
    }
  } catch (sessionError) {
    // Fail closed WITHOUT redirecting to /login: cookies are intact, so /login would bounce back here.
    console.error('Proxy session validation failed:', sessionError)
    return new NextResponse('Service temporarily unavailable. Please try again.', {
      status: 503,
      headers: { 'Retry-After': '5' },
    })
  }

  // 4. If admin route, check user role
  if (isAdminRoute) {
    try {
      // Use get_user_tenants RPC (same source as UI, SECURITY DEFINER, handles multi-tenant)
      const { data: tenants, error } = await supabase.rpc('get_user_tenants')
      if (error || !tenants?.length) {
        // Redirect to dashboard if can't verify role
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = DEFAULT_REDIRECT
        redirectUrl.searchParams.set('error', 'role_verification_failed')
        return NextResponse.redirect(redirectUrl)
      }

      // Check if user has admin role in ANY tenant (case-insensitive)
      const adminRoles = ['admin', 'super_admin', 'tenant_admin']
      const hasAdminRole = tenants.some(
        (t: { user_role?: string }) =>
          adminRoles.includes((t.user_role || '').toLowerCase().trim())
      )

      if (!hasAdminRole) {
        // Redirect to dashboard with error message
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = DEFAULT_REDIRECT
        redirectUrl.searchParams.set('error', 'insufficient_permissions')
        return NextResponse.redirect(redirectUrl)
      }

      // Add tenant context from first admin tenant for downstream use
      const adminTenant = tenants.find((t: { user_role?: string }) =>
        adminRoles.includes((t.user_role || '').toLowerCase().trim())
      )
      if (adminTenant) {
        response.headers.set('X-Tenant-ID', adminTenant.tenant_id)
        response.headers.set('X-User-Role', adminTenant.user_role)
      }
    } catch (error) {
      console.error('Proxy error checking admin access:', error)
      // Redirect to dashboard on error (fail closed for security)
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = DEFAULT_REDIRECT
      redirectUrl.searchParams.set('error', 'authorization_error')
      return NextResponse.redirect(redirectUrl)
    }
  }

  // 5. Set CSRF cookie for page requests when missing (needed for login/register before auth)
  if (!isApiRoute) {
    let csrfToken = getCSRFTokenFromRequest(request)
    if (!csrfToken) {
      csrfToken = generateCSRFToken()
      setCSRFTokenInResponse(response, csrfToken)
    }
  }

  // 6. Add user info to headers for server components when authenticated
  if (user) {
    response.headers.set('X-User-ID', user.id)
    response.headers.set('X-User-Email', user.email || '')
  }

  // 7. Set locale for next-intl (from cookie or Accept-Language)
  const localeCookie = request.cookies.get('NEXT_LOCALE')?.value
  const locale =
    localeCookie && ['en', 'ar'].includes(localeCookie)
      ? localeCookie
      : request.headers.get('accept-language')?.toLowerCase().startsWith('ar')
        ? 'ar'
        : defaultLocale
  response.headers.set('x-next-intl-locale', locale)

  return response
}

/**
 * Specify which routes this proxy should run on
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
