'use client'

/**
 * Authentication Context Provider
 *
 * Manages authentication state and operations across the application
 * Handles multi-tenant user support with tenant switching
 */

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { sessionActivityStore } from '@lib/session-activity'
import {
  getUserPermissions,
  getUserWorkflowRoles,
} from '@/lib/services/permission-service-client'
import { fetchAuthData } from '@/lib/services/auth-data.service'
import { useQueryClient } from '@tanstack/react-query'
import {
  getCachedPermissions,
  setCachedPermissions,
  invalidatePermissionCache,
} from '@/lib/cache/permission-cache-client'
import { removeAllFeatureFlagQueries } from '@/lib/query/feature-flag-keys'
import { removeAllNotificationQueries } from '@/lib/query/notification-keys'
import type {
  AuthContextType,
  SignOutOptions,
  AuthUser,
  UserTenant,
  AuthSession,
  UserRole,
} from '@/types/auth'
import { trackLogout, type LogoutReason } from '@/lib/auth/logout-tracker'
import { getSafeRedirectPath } from '@/lib/security/safe-redirect'
import { LOGIN_REASONS, type LoginReason } from '@/lib/constants/auth-session'
import { broadcastLogout } from '@/src/features/auth-session/model/session-channel'
import { getCSRFToken } from '@/lib/utils/csrf-token'

// Create the context
const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * Auth Provider Component
 * @param root0
 * @param root0.children
 */
/** Login-page banner for a client-side logout reason (plain user sign-out shows none). */
function loginReasonForLogout(reason: LogoutReason): LoginReason | null {
  switch (reason) {
    case 'timeout':
      return LOGIN_REASONS.IDLE_TIMEOUT
    case 'session_expired':
      return LOGIN_REASONS.SESSION_EXPIRED
    case 'security':
      return LOGIN_REASONS.DEACTIVATED
    default:
      return null
  }
}

/** Current page (path + query) for "come back here after signing in"; null when unavailable or already on an auth page. */
function currentLocationPath(): string | undefined {
  if (typeof window === 'undefined') return undefined
  const { pathname, search } = window.location
  return pathname + search
}

/**
 * Build the /login URL with an optional reason banner and a validated return-to path.
 *
 * @param reason - Login banner code (null = none)
 * @param returnTo - Page to return to after sign-in; validated (open-redirect safe) and dropped when it is an auth page
 */
function buildLoginUrl(reason: LoginReason | null, returnTo?: string): string {
  const params = new URLSearchParams()
  if (reason) params.set('reason', reason)
  const safe = returnTo ? getSafeRedirectPath(returnTo, '') : ''
  if (safe) params.set('redirect', safe)
  const query = params.toString()
  return query ? `/login?${query}` : '/login'
}
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const queryClient = useQueryClient()

  // State
  const [user, setUser] = useState<AuthUser | null>(null)
  const [session, setSession] = useState<AuthSession | null>(null)
  const [currentTenant, setCurrentTenant] = useState<UserTenant | null>(null)
  const [availableTenants, setAvailableTenants] = useState<UserTenant[]>([])
  const [permissions, setPermissions] = useState<string[]>([])
  const [workflowRoles, setWorkflowRoles] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  /** First get_user_tenants (or login batch) completed for this session */
  const [isTenantContextReady, setIsTenantContextReady] = useState(false)
  
  // Track if we're in the middle of a login to prevent duplicate fetching
  const isLoggingInRef = useRef(false)
  // Track if we're currently fetching tenants to prevent concurrent requests
  const isFetchingTenantsRef = useRef(false)
  // Track if we're currently fetching permissions/workflow roles to prevent concurrent requests
  const isFetchingPermissionsRef = useRef(false)
  // Track if tenant fetch failed to prevent infinite retries
  const tenantFetchFailedRef = useRef(false)
  // Track previous user ID to detect user changes
  const previousUserIdRef = useRef<string | null>(null)
  // Refs to access latest values without causing dependency loops
  const currentTenantRef = useRef<UserTenant | null>(null)
  const refreshPermissionsRef = useRef<(() => Promise<void>) | null>(null)
  const refreshTenantsRef = useRef<(() => Promise<void>) | null>(null)
  // Track user-initiated signOut so we don't redirect to session_expired on normal logout
  const isSigningOutRef = useRef(false)
  // Track the tenant ID for which permissions were last loaded — avoids re-fetching same tenant
  const permissionsLoadedForTenantRef = useRef<string | null>(null)

  /**
   * Fetch available tenants for current user
   */
  const refreshTenants = useCallback(async () => {
    if (!user) {
      setAvailableTenants([])
      setCurrentTenant(null)
      tenantFetchFailedRef.current = false
      setIsTenantContextReady(true)
      return
    }

    // Prevent concurrent requests
    if (isFetchingTenantsRef.current) {
      return
    }

    isFetchingTenantsRef.current = true
    // Only block feature gates while the *first* tenant context is loading — not on every
    // refresh — otherwise B2B (and other RequireFeature) pages unmount and “flash” empty.
    if (!currentTenantRef.current) {
      setIsTenantContextReady(false)
    }

    try {
      const { data, error } = await supabase.rpc('get_user_tenants')

      if (error) throw error

      const tenants: UserTenant[] = data.map((t: {
        tenant_id: string
        tenant_name: string
        tenant_slug: string
        user_role: string
        is_active: boolean
        last_login_at: string | null
        s_current_plan?: string
      }) => ({
        tenant_id: t.tenant_id,
        tenant_name: t.tenant_name,
        tenant_slug: t.tenant_slug,
        user_role: t.user_role as UserRole,
        is_active: t.is_active,
        last_login_at: t.last_login_at,
        s_current_plan: t.s_current_plan ?? 'FREE_TRIAL',
      }))

      setAvailableTenants(tenants)
      tenantFetchFailedRef.current = false

      // Set current tenant if not already set (using functional update to avoid dependency)
      setCurrentTenant((prevTenant) => {
        if (!prevTenant && tenants.length > 0) {
          const newTenant = tenants[0]
          currentTenantRef.current = newTenant
          return newTenant
        }
        currentTenantRef.current = prevTenant
        return prevTenant
      })
      
    } catch (error) {
      console.error('Error fetching tenants:', error)
      // Mark as failed to prevent infinite retries
      // Don't clear availableTenants - this would trigger the useEffect to retry again
      tenantFetchFailedRef.current = true
    } finally {
      setIsTenantContextReady(true)
      isFetchingTenantsRef.current = false
      // Update ref after function completes
      refreshTenantsRef.current = refreshTenants
    }
  }, [user]) // Removed currentTenant and availableTenants.length from dependencies to prevent infinite loop

  /**
   * Initialize auth state from session
   * Using getUser() instead of getSession() as recommended by Supabase
   */
  const initializeAuth = useCallback(async () => {
    let sessionHasUser = false
    try {
      // Use getUser() instead of getSession() - more reliable server-side
      const { data: { user: currentUser }, error } = await supabase.auth.getUser()

      if (error) {
        // Only log errors that aren't "session missing" (expected when not logged in)
        if (error.message !== 'Auth session missing!') {
          console.error('Error getting user:', error)
        }
        setUser(null)
        setSession(null)
      setCurrentTenant(null)
      currentTenantRef.current = null
      setAvailableTenants([])
      return
    }

      if (currentUser) {
        sessionHasUser = true
        setUser(currentUser as AuthUser)

        // Get session for tokens
        const { data: { session: currentSession } } = await supabase.auth.getSession()

        if (currentSession) {
          setSession({
            user: currentUser as AuthUser,
            access_token: currentSession.access_token,
            refresh_token: currentSession.refresh_token,
            expires_at: currentSession.expires_at ?? null,
            expires_in: currentSession.expires_in ?? null,
          })
        }
      } else {
        setUser(null)
        setSession(null)
        setCurrentTenant(null)
        currentTenantRef.current = null
        setAvailableTenants([])
      }
    } catch (error) {
      console.error('Error initializing auth:', error)
    } finally {
      setIsLoading(false)
      if (!sessionHasUser) {
        setIsTenantContextReady(true)
      }
    }
  }, [])

  /**
   * Sign in with a user code or email plus password.
   *
   * @param identifier - User code or email (the server tells them apart and resolves the account)
   * @param password - Account password
   * @param rememberMe - Persist the session across browser restarts
   * @param redirectTo - Page to return to after sign-in (validated; unsafe values fall back to /dashboard)
   */
  const signIn = useCallback(async (identifier: string, password: string, rememberMe = false, redirectTo?: string) => {
    // Prevent multiple simultaneous login attempts
    if (isLoggingInRef.current) {
      throw new Error('Login already in progress')
    }

    isLoggingInRef.current = true
    setIsLoading(true)
    const t0 = Date.now()
    console.log('[LOGIN:client] ▶ start')
    try {
      console.log(`[LOGIN:client] [${Date.now() - t0}ms] ▶ getCSRFToken`)
      const csrfToken = await getCSRFToken()
      console.log(`[LOGIN:client] [${Date.now() - t0}ms] ✓ getCSRFToken done`)

      console.log(`[LOGIN:client] [${Date.now() - t0}ms] ▶ POST /api/auth/login`)
      const loginResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        body: JSON.stringify({ identifier, password, remember_me: rememberMe }),
      })
      console.log(`[LOGIN:client] [${Date.now() - t0}ms] ✓ POST /api/auth/login done — status: ${loginResponse.status}`)

      const loginData = await loginResponse.json()

      if (!loginResponse.ok) {
        if (loginResponse.status === 403) {
          throw new Error(loginData.error || 'Invalid or missing CSRF token. Please refresh the page and try again.')
        }
        if (loginResponse.status === 429) {
          throw new Error(loginData.message || 'Too many login attempts. Please try again later.')
        }
        if (loginResponse.status === 423) {
          throw new Error(loginData.error || 'Account is temporarily locked.')
        }
        // Carry the machine code so the login page can show a translated message.
        const signInError = new Error(loginData.error || 'Invalid credentials') as Error & { code?: string }
        signInError.code = typeof loginData.code === 'string' ? loginData.code : undefined
        throw signInError
      }

      const { user: authUser, session: authSession, tenants: rawTenants } = loginData

      if (!authUser || !authSession) {
        throw new Error('Invalid response from login API')
      }

      // Update Supabase client session
      console.log(`[LOGIN:client] [${Date.now() - t0}ms] ▶ supabase.auth.setSession`)
      await supabase.auth.setSession({
        access_token: authSession.access_token,
        refresh_token: authSession.refresh_token,
      })
      console.log(`[LOGIN:client] [${Date.now() - t0}ms] ✓ supabase.auth.setSession done`)

      setUser(authUser as AuthUser)
      setSession({
        user: authUser as AuthUser,
        access_token: authSession.access_token,
        refresh_token: authSession.refresh_token,
        expires_at: authSession.expires_at ?? null,
        expires_in: authSession.expires_in ?? null,
      })

      // Transform tenants already returned by the login API (avoids a duplicate get_user_tenants call)
      const prefetchedTenants: UserTenant[] = Array.isArray(rawTenants)
        ? rawTenants.map((t: {
            tenant_id: string
            tenant_name: string
            tenant_slug: string
            user_role: string
            is_active: boolean
            last_login_at: string | null
            s_current_plan?: string
          }) => ({
            tenant_id: t.tenant_id,
            tenant_name: t.tenant_name,
            tenant_slug: t.tenant_slug,
            user_role: t.user_role as UserRole,
            is_active: t.is_active,
            last_login_at: t.last_login_at,
            s_current_plan: t.s_current_plan ?? 'FREE_TRIAL',
          }))
        : []
      console.log(`[LOGIN:client] [${Date.now() - t0}ms] tenants from login response: ${prefetchedTenants.length} row(s)`)

      // Fetch permissions + workflow roles in parallel; skip tenant re-fetch when already available
      console.log(`[LOGIN:client] [${Date.now() - t0}ms] ▶ fetchAuthData (tenants prefetched: ${prefetchedTenants.length > 0})`)
      const authData = await fetchAuthData(
        prefetchedTenants.length > 0 ? { prefetchedTenants } : undefined
      )
      console.log(`[LOGIN:client] [${Date.now() - t0}ms] ✓ fetchAuthData done — permissions: ${authData.permissions.length}, workflowRoles: ${authData.workflowRoles.length}, tenants: ${authData.tenants.length}`)

      // Block inactive users — sign out immediately before touching any state
      const activeTenant = authData.tenants.find(t => t.is_active)
      if (!activeTenant) {
        await supabase.auth.signOut()
        throw new Error('Your account has been deactivated. Please contact your administrator.')
      }

      // Set all state at once to minimize re-renders
      setAvailableTenants(authData.tenants)
      setCurrentTenant(activeTenant)
      currentTenantRef.current = activeTenant
      // Cache everything
      setCachedPermissions(activeTenant.tenant_id, authData.permissions)
      setPermissions(authData.permissions)
      setWorkflowRoles(authData.workflowRoles)

      // Mark permissions as loaded for this tenant so the useEffect does not re-fetch
      permissionsLoadedForTenantRef.current = activeTenant.tenant_id

      setIsTenantContextReady(true)

      const destination = getSafeRedirectPath(redirectTo)
      console.log(`[LOGIN:client] [${Date.now() - t0}ms] ✓ done — redirecting to ${destination}`)
      // Redirect after state is set
      router.push(destination)
    } catch (error: unknown) {
      // Error handling is done in API route, just re-throw
      throw error
    } finally {
      setIsLoading(false)
      isLoggingInRef.current = false
    }
  }, [router])

  /**
   * Sign up with email and password
   */
  const signUp = useCallback(async (
    email: string,
    password: string,
    displayName: string
  ) => {
    setIsLoading(true)
    try {
      const csrfToken = await getCSRFToken()
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        body: JSON.stringify({ email, password, displayName }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error(data.error || 'Invalid or missing CSRF token. Please refresh the page and try again.')
        }
        if (response.status === 429) {
          throw new Error(data.message || 'Too many registration attempts. Please try again later.')
        }
        throw new Error(data.error || 'Failed to create account')
      }

      // Note: User won't be automatically logged in until email is verified
      // We'll show a message to check email
      // Data is available but not returned to match AuthContextType interface
    } catch (error) {
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Sign out (single path: the logout page and every caller go through here).
   *
   * Order matters: the server ends the session first (registry row, Supabase session and its refresh token,
   * audit event); then this browser's local session is cleared (local scope - other devices stay signed in);
   * then every cache is dropped and the other tabs are told. Server/bookkeeping errors never block sign-out.
   *
   * @param reason - Why the user is signing out
   * @param options.loginReason - Banner to show on /login (defaults from `reason`)
   * @param options.returnTo - Page to return to after the next sign-in (validated; ignored for plain sign-outs)
   */
  const signOut = useCallback(async (reason: LogoutReason = 'user', options: SignOutOptions = {}) => {
    isSigningOutRef.current = true
    setIsLoading(true)
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

      // Clear this browser's Supabase session. Local scope: other devices are NOT signed out. If the server
      // already deleted the session (idle timeout, revoke) this fails harmlessly - cleanup continues.
      try {
        await supabase.auth.signOut({ scope: 'local' })
      } catch (localError) {
        console.warn('Local sign-out failed (continuing cleanup):', localError)
      }

      // Tell the other tabs of this browser to drop their state and go to /login.
      const loginReason = options.loginReason ?? loginReasonForLogout(reason)
      if (!options.skipBroadcast) broadcastLogout(loginReason)

      // Clear all auth state
      const currentUser = user
      const currentTenantId = currentTenant?.tenant_id

      setUser(null)
      setSession(null)
      setCurrentTenant(null)
      currentTenantRef.current = null
      setAvailableTenants([])
      setPermissions([])
      setWorkflowRoles([])
      permissionsLoadedForTenantRef.current = null
      setIsTenantContextReady(true)
      // Drop every cached query (nothing of this user may leak to the next one) and all browser caches.
      queryClient.clear()
      invalidatePermissionCache()
      sessionActivityStore.clear()
      sessionStorage.clear()

      // Track logout event
      if (currentUser) {
        trackLogout({
          userId: currentUser.id,
          tenantId: currentTenantId,
          reason,
        })
      }

      router.push(buildLoginUrl(loginReason, options.returnTo))
    } catch (error) {
      console.error('Error signing out:', error)
      throw error
    } finally {
      setIsLoading(false)
      isSigningOutRef.current = false
    }
  }, [router, user, currentTenant, queryClient])

  /**
   * Request password reset
   */
  const resetPassword = useCallback(async (email: string) => {
    try {
      const csrfToken = await getCSRFToken()
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error(data.error || 'Invalid or missing CSRF token. Please refresh the page and try again.')
        }
        if (response.status === 429) {
          throw new Error(data.message || 'Too many password reset requests. Please try again later.')
        }
        throw new Error(data.error || 'Failed to send password reset email')
      }

      // Success - message is in data.message
    } catch (error) {
      throw error
    }
  }, [])

  /**
   * Update password (after reset or change)
   */
  const updatePassword = useCallback(async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) throw error
    } catch (error) {
      throw error
    }
  }, [])

  /**
   * Fetch permissions and workflow roles for current tenant.
   * - Guards against concurrent in-flight calls (isFetchingPermissionsRef)
   * - Always fetches both permissions AND workflow roles together in one round-trip
   * - Caches permissions; workflow roles are always re-fetched (they change frequently)
   * - Tracks which tenant was last loaded so the useEffect does not re-trigger on same tenant
   */
  const refreshPermissions = useCallback(async () => {
    if (!user || !currentTenant) {
      setPermissions([])
      setWorkflowRoles([])
      permissionsLoadedForTenantRef.current = null
      return
    }

    // Prevent concurrent fetches
    if (isFetchingPermissionsRef.current) {
      return
    }

    isFetchingPermissionsRef.current = true

    try {
      const cached = getCachedPermissions(currentTenant.tenant_id)

      if (cached) {
        // Permissions are cached — only re-fetch workflow roles (they change more frequently)
        const workflow = await getUserWorkflowRoles()
        setPermissions(cached)
        setWorkflowRoles(workflow)
      } else {
        // Full fetch — permissions + workflow roles in parallel
        const [perms, workflow] = await Promise.all([
          getUserPermissions(currentTenant.tenant_id),
          getUserWorkflowRoles(),
        ])
        setPermissions(perms)
        setWorkflowRoles(workflow)
        setCachedPermissions(currentTenant.tenant_id, perms)
      }

      // Record which tenant we loaded for, so the useEffect guard can skip redundant calls
      permissionsLoadedForTenantRef.current = currentTenant.tenant_id
    } catch (error) {
      console.error('Error fetching permissions:', error)
      const cached = getCachedPermissions(currentTenant.tenant_id)
      setPermissions(cached ?? [])
      setWorkflowRoles([])
      permissionsLoadedForTenantRef.current = null
    } finally {
      isFetchingPermissionsRef.current = false
      refreshPermissionsRef.current = refreshPermissions
    }
  }, [user, currentTenant])



  /**
   * Update user profile
   */
  const updateProfile = useCallback(async (
    displayName: string,
    preferences?: Record<string, unknown>
  ) => {
    if (!user) throw new Error('No user logged in')

    try {
      const { error } = await supabase
        .from('org_users_mst')
        .update({
          display_name: displayName,
          preferences: (preferences || {}) as any, // Cast to any for JSON type
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)

      if (error) throw error

      // Update local state
      setUser(prev => prev ? { ...prev, user_metadata: { ...prev.user_metadata, display_name: displayName } } : null)
    } catch (error) {
      console.error('Error updating profile:', error)
      throw error
    }
  }, [user])

  /**
   * Initialize auth and listen for auth state changes
   */
  useEffect(() => {
    initializeAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (event === 'SIGNED_IN' && currentSession) {
          setUser(currentSession.user as AuthUser)
          setSession({
            user: currentSession.user as AuthUser,
            access_token: currentSession.access_token,
            refresh_token: currentSession.refresh_token,
            expires_at: currentSession.expires_at ?? null,
            expires_in: currentSession.expires_in ?? null,
          })
          // Do not toggle isTenantContextReady here: duplicate SIGNED_IN events would block
          // RequireFeature while availableTenants is already loaded (refreshTenants won't re-run).
          // Tenants and permissions will be fetched via useEffect hooks
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setSession(null)
          setCurrentTenant(null)
          currentTenantRef.current = null
          setAvailableTenants([])
          setPermissions([])
          setWorkflowRoles([])
          permissionsLoadedForTenantRef.current = null
          setIsTenantContextReady(true)
          invalidatePermissionCache()
          removeAllFeatureFlagQueries(queryClient)
          removeAllNotificationQueries(queryClient)
          sessionStorage.clear()
          // Redirect to login with reason when session expired (not user-initiated), remembering where the
          // user was so they come back to it after signing in again.
          if (!isSigningOutRef.current) {
            router.push(buildLoginUrl(LOGIN_REASONS.SESSION_EXPIRED, currentLocationPath()))
          }
        } else if (event === 'TOKEN_REFRESHED' && currentSession) {
          setSession({
            user: currentSession.user as AuthUser,
            access_token: currentSession.access_token,
            refresh_token: currentSession.refresh_token,
            expires_at: currentSession.expires_at ?? null,
            expires_in: currentSession.expires_in ?? null,
          })
          // Don't refresh permissions on every token refresh - it's too frequent
          // Permissions are cached and only need refresh on tenant switch or explicit refresh
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [initializeAuth, queryClient]) // Removed currentTenant and refreshPermissions to prevent re-subscription loops

  /**
   * Fetch tenants when user changes
   * Skip if we're in the middle of a login (signIn already fetches this data)
   * Skip if we've already failed to prevent infinite retries
   */
  useEffect(() => {
    const currentUserId = user?.id ?? null
    
    // Reset failed flag only when user actually changes (not on every render)
    if (currentUserId !== previousUserIdRef.current) {
      tenantFetchFailedRef.current = false
      previousUserIdRef.current = currentUserId
    }

    if (
      user && 
      !isLoading && 
      !isLoggingInRef.current && 
      availableTenants.length === 0 && 
      !tenantFetchFailedRef.current &&
      !isFetchingTenantsRef.current
    ) {
      refreshTenants()
    }
     
  }, [user, isLoading, availableTenants.length]) // refreshTenants intentionally omitted to prevent loops

  /**
   * Fetch permissions when tenant changes or user logs in.
   *
   * Guards:
   * - Skip while still loading auth state
   * - Skip during an in-progress login (signIn already fetched everything)
   * - Skip during an in-progress permissions fetch (isFetchingPermissionsRef)
   * - Skip if permissions were already loaded for this exact tenant (permissionsLoadedForTenantRef)
   *
   * Deps intentionally exclude `permissions` / `workflowRoles` lengths to avoid
   * re-trigger loops whenever those arrays change.
   */
  useEffect(() => {
    if (isLoading) return

    if (!user || !currentTenant) {
      // Logged out or no tenant — clear permissions
      setPermissions([])
      setWorkflowRoles([])
      permissionsLoadedForTenantRef.current = null
      return
    }

    // Skip if already loaded for this tenant, or a fetch is already in flight
    if (
      isLoggingInRef.current ||
      isFetchingPermissionsRef.current ||
      permissionsLoadedForTenantRef.current === currentTenant.tenant_id
    ) {
      return
    }

    refreshPermissions()
     
  }, [user, currentTenant, isLoading]) // refreshPermissions intentionally omitted — accessed via ref to avoid loops

  const value: AuthContextType = {
    // State
    user,
    session,
    currentTenant,
    availableTenants,
    permissions,
    workflowRoles,
    isLoading,
    isTenantContextReady,
    isAuthenticated: !!user,

    // Methods
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    refreshTenants,
    refreshPermissions,
    updateProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * Hook to use auth context
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
