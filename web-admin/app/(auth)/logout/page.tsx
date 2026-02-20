'use client'

/**
 * Logout Page
 *
 * Automatically performs sign out when accessed, clears all authentication state,
 * and redirects to the login page. Supports optional confirmation dialog and logout reasons.
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/lib/auth/auth-context'
import { useRTL } from '@/lib/hooks/useRTL'
import { CmxAlertDialog } from '@/src/ui/feedback'
import type { LogoutReason } from '@/lib/auth/logout-tracker'

export default function LogoutPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { signOut, isAuthenticated, isLoading: authLoading } = useAuth()
  const isRTL = useRTL()
  const t = useTranslations('auth.logout')
  const tCommon = useTranslations('common')
  
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasLoggedOutRef = useRef(false)
  const logoutReasonRef = useRef<LogoutReason>('user')

  // Get logout reason from query params
  useEffect(() => {
    const reason = (searchParams.get('reason') as LogoutReason) || 'user'
    const needsConfirmation = searchParams.get('confirm') === 'true'
    
    // Validate reason
    const validReasons: LogoutReason[] = ['user', 'session_expired', 'security', 'timeout', 'unknown']
    logoutReasonRef.current = validReasons.includes(reason) ? reason : 'user'
    setShowConfirmDialog(needsConfirmation)
  }, [searchParams])

  // Handle logout process
  const handleLogout = useCallback(async (reason: LogoutReason = 'user') => {
    if (hasLoggedOutRef.current) return // Prevent double logout
    
    setIsLoggingOut(true)
    setError(null)
    hasLoggedOutRef.current = true

    try {
      // Call server-side logout API for cache invalidation
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason }),
        })
      } catch (apiError) {
        // Log but don't fail - client-side logout will still work
        console.warn('Logout API call failed:', apiError)
      }

      // Perform client-side logout
      await signOut(reason)
      // signOut already redirects to /login
    } catch (error) {
      console.error('Logout error:', error)
      setError(t('error'))
      // Even on error, redirect to login after delay
      setTimeout(() => {
        router.push('/login')
      }, 2000)
    } finally {
      setIsLoggingOut(false)
    }
  }, [signOut, router, t])

  // Auto-logout on mount (if not showing confirmation)
  useEffect(() => {
    // If already logged out, redirect immediately
    if (!authLoading && !isAuthenticated) {
      router.push('/login')
      return
    }

    // If authenticated and no confirmation needed, perform logout
    if (!authLoading && isAuthenticated && !showConfirmDialog && !hasLoggedOutRef.current) {
      handleLogout(logoutReasonRef.current)
    }
  }, [isAuthenticated, authLoading, showConfirmDialog, handleLogout, router])

  // Safety redirect: if still on this page after 5s (e.g. signOut/redirect failed), force redirect to login
  useEffect(() => {
    const safetyMs = 5000
    const timeoutId = setTimeout(() => {
      router.replace('/login')
    }, safetyMs)
    return () => clearTimeout(timeoutId)
  }, [router])

  // Confirmation dialog handlers
  const handleConfirm = useCallback(() => {
    setShowConfirmDialog(false)
    handleLogout(logoutReasonRef.current)
  }, [handleLogout])

  const handleCancel = useCallback(() => {
    setShowConfirmDialog(false)
    router.push('/dashboard')
  }, [router])

  // Loading/Error UI
  if (error) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center bg-gray-50 px-4"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="text-center max-w-md">
          <div className="rounded-md bg-red-50 p-4 mb-4">
            <p className="text-sm font-medium text-red-800">{error}</p>
          </div>
          <p className="text-sm text-gray-600">{t('redirecting')}</p>
        </div>
      </div>
    )
  }

  // Confirmation Dialog
  if (showConfirmDialog && isAuthenticated) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center bg-gray-50 px-4"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <CmxAlertDialog
          open={showConfirmDialog}
          title={t('confirmTitle')}
          message={t('confirmMessage')}
          variant="default"
          confirmLabel={t('confirmButton')}
          cancelLabel={tCommon('cancel')}
          showCancel={true}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      </div>
    )
  }

  // Loading state
  return (
    <div 
      className="min-h-screen flex items-center justify-center bg-gray-50 px-4"
      dir={isRTL ? 'rtl' : 'ltr'}
      role="status"
      aria-live="polite"
      aria-label={t('signingOut')}
    >
      <div className="text-center">
        <div 
          className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"
          aria-hidden="true"
        />
        <p className="mt-4 text-gray-600">{t('signingOut')}</p>
        {isLoggingOut && (
          <p className="mt-2 text-sm text-gray-500">{t('pleaseWait')}</p>
        )}
      </div>
    </div>
  )
}

