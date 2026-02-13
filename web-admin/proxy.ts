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
  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route))
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
      // Get user role from database
      const { data: userRole, error } = await supabase
        .from('org_users_mst')
        .select('role, tenant_org_id')
        .eq('user_id', user.id)
        .single()

      if (error || !userRole) {
        console.error('Error fetching user role:', error)
        // Redirect to dashboard if can't verify role
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = DEFAULT_REDIRECT
        redirectUrl.searchParams.set('error', 'role_verification_failed')
        return NextResponse.redirect(redirectUrl)
      }

      // Check if user is admin
      if (!['admin', 'super_admin', 'tenant_admin'].includes(userRole.role)) {
      //if (userRole.role !== 'admin') {
        // Redirect to dashboard with error message
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = DEFAULT_REDIRECT
        redirectUrl.searchParams.set('error', 'insufficient_permissions')
        return NextResponse.redirect(redirectUrl)
      }

      // Add tenant context to response headers for downstream use
      response.headers.set('X-Tenant-ID', userRole.tenant_org_id)
      response.headers.set('X-User-Role', userRole.role)
    } catch (error) {
      console.error('Proxy error checking admin access:', error)
      // Redirect to dashboard on error (fail closed for security)
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = DEFAULT_REDIRECT
      redirectUrl.searchParams.set('error', 'authorization_error')
      return NextResponse.redirect(redirectUrl)
    }
  }

  // 5. Generate and set CSRF token for authenticated users
  if (user) {
    // Check if CSRF token already exists
    let csrfToken = getCSRFTokenFromRequest(request);
    
    // Generate new token if it doesn't exist
    if (!csrfToken) {
      csrfToken = generateCSRFToken();
      setCSRFTokenInResponse(response, csrfToken);
    }
    
    // Add user info to headers for server components
    response.headers.set('X-User-ID', user.id)
    response.headers.set('X-User-Email', user.email || '')
  }

  // 6. Set locale for next-intl (from cookie or Accept-Language)
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
