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

/**
 * Routes that don't require authentication
 */
const PUBLIC_ROUTES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/auth/callback',
  '/auth/confirm',
  '/logout',
  '/terms',
  '/privacy',
  '/public', // Public order tracking pages (no login required)
]

/**
 * Auth routes (should redirect to dashboard if already authenticated)
 */
const AUTH_ROUTES = ['/login', '/register', '/forgot-password', '/reset-password']

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
 * Proxy function
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

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
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
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
  const isPublicRoute =
    pathname === '/' || PUBLIC_ROUTES.some((route) => pathname.startsWith(route))
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

  // 2. If route is public, allow access
  if (isPublicRoute) {
    return response
  }

  // 3. If user is not authenticated and trying to access protected route
  // Redirect to login with return URL
  if (!user || authError) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = LOGIN_PATH
    // Add return URL to redirect back after login
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl)
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
