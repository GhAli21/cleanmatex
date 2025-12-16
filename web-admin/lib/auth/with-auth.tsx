/**
 * Higher-Order Component (HOC) for Protected Pages
 *
 * Wraps pages that require authentication
 * Redirects to login if user is not authenticated
 */

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from './auth-context'

interface WithAuthOptions {
  redirectTo?: string
  redirectIfAuthenticated?: boolean
}

/**
 * HOC to protect pages requiring authentication
 *
 * @example
 * ```tsx
 * const ProtectedPage = withAuth(MyPage)
 * export default ProtectedPage
 * ```
 */
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options: WithAuthOptions = {}
) {
  const {
    redirectTo = '/login',
    redirectIfAuthenticated = false,
  } = options

  return function ProtectedComponent(props: P) {
    const router = useRouter()
    const { isAuthenticated, isLoading } = useAuth()

    useEffect(() => {
      if (isLoading) return

      if (redirectIfAuthenticated && isAuthenticated) {
        router.push('/dashboard')
      } else if (!redirectIfAuthenticated && !isAuthenticated) {
        router.push(redirectTo)
      }
    }, [isAuthenticated, isLoading, router])

    // Show loading while checking auth
    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      )
    }

    // Don't render if redirecting
    if (redirectIfAuthenticated && isAuthenticated) {
      return null
    }

    if (!redirectIfAuthenticated && !isAuthenticated) {
      return null
    }

    // Render the protected component
    return <Component {...props} />
  }
}

/**
 * Convenience wrapper for pages that should redirect to dashboard if authenticated
 * Useful for login/register pages
 *
 * @example
 * ```tsx
 * const LoginPage = withAuthRedirect(MyLoginPage)
 * export default LoginPage
 * ```
 */
export function withAuthRedirect<P extends object>(
  Component: React.ComponentType<P>
) {
  return withAuth(Component, { redirectIfAuthenticated: true })
}
