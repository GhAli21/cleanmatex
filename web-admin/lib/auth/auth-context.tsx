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
import {
  getUserPermissions,
  getUserWorkflowRoles,
} from '@/lib/services/permission-service-client'
import { fetchAuthData } from '@/lib/services/auth-data.service'
import {
  getCachedPermissions,
  setCachedPermissions,
  getCachedFeatureFlags,
  setCachedFeatureFlags,
  invalidatePermissionCache,
} from '@/lib/cache/permission-cache-client'
import type {
  AuthContextType,
  AuthUser,
  UserTenant,
  AuthSession,
  UserRole,
} from '@/types/auth'
import { trackLogout, type LogoutReason } from '@/lib/auth/logout-tracker'
import { getCSRFToken } from '@/lib/utils/csrf-token'

// Create the context
const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * Auth Provider Component
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()

  // State
  const [user, setUser] = useState<AuthUser | null>(null)
  const [session, setSession] = useState<AuthSession | null>(null)
  const [currentTenant, setCurrentTenant] = useState<UserTenant | null>(null)
  const [availableTenants, setAvailableTenants] = useState<UserTenant[]>([])
  const [permissions, setPermissions] = useState<string[]>([])
  const [workflowRoles, setWorkflowRoles] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Track if we're in the middle of a login to prevent duplicate fetching
  const isLoggingInRef = useRef(false)
  // Track if we're currently fetching tenants to prevent concurrent requests
  const isFetchingTenantsRef = useRef(false)
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

  /**
   * Fetch available tenants for current user
   */
  const refreshTenants = useCallback(async () => {
    if (!user) {
      setAvailableTenants([])
      setCurrentTenant(null)
      tenantFetchFailedRef.current = false
      return
    }

    // Prevent concurrent requests
    if (isFetchingTenantsRef.current) {
      return
    }

    isFetchingTenantsRef.current = true

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
      }) => ({
        tenant_id: t.tenant_id,
        tenant_name: t.tenant_name,
        tenant_slug: t.tenant_slug,
        user_role: t.user_role as UserRole,
        is_active: t.is_active,
        last_login_at: t.last_login_at,
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
    }
  }, [])

  /**
   * Sign in with email and password
   */
  const signIn = useCallback(async (email: string, password: string, rememberMe = false) => {
    // Prevent multiple simultaneous login attempts
    if (isLoggingInRef.current) {
      throw new Error('Login already in progress')
    }
    
    isLoggingInRef.current = true
    setIsLoading(true)
    try {
      const csrfToken = await getCSRFToken()
      const loginResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        body: JSON.stringify({ email, password, remember_me: rememberMe }),
      })

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
        throw new Error(loginData.error || 'Invalid email or password')
      }

      const { user: authUser, session: authSession } = loginData

      if (!authUser || !authSession) {
        throw new Error('Invalid response from login API')
      }

      // Update Supabase client session
      await supabase.auth.setSession({
        access_token: authSession.access_token,
        refresh_token: authSession.refresh_token,
      })

      setUser(authUser as AuthUser)
      setSession({
        user: authUser as AuthUser,
        access_token: authSession.access_token,
        refresh_token: authSession.refresh_token,
        expires_at: authSession.expires_at ?? null,
        expires_in: authSession.expires_in ?? null,
      })

      // Batch fetch all auth data after successful login
      // This is more efficient than sequential calls
      // Set a flag to prevent useEffect hooks from duplicating these calls
      const authData = await fetchAuthData()
      
      // Set all state at once to minimize re-renders
      setAvailableTenants(authData.tenants)
        if (authData.tenants.length > 0) {
        const firstTenant = authData.tenants[0]
        setCurrentTenant(firstTenant)
        currentTenantRef.current = firstTenant
        // Cache everything
        setCachedPermissions(firstTenant.tenant_id, authData.permissions)
        setCachedFeatureFlags(firstTenant.tenant_id, authData.featureFlags)
      }
      setPermissions(authData.permissions)
      setWorkflowRoles(authData.workflowRoles)

      // Redirect after state is set
      router.push('/dashboard')
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
   * Sign out
   */
  const signOut = useCallback(async (reason: LogoutReason = 'user') => {
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

      // Supabase auth sign out
      const { error } = await supabase.auth.signOut()
      if (error) throw error

      // Clear all auth state
      const currentUser = user
      const currentTenantId = currentTenant?.id

      setUser(null)
      setSession(null)
      setCurrentTenant(null)
      currentTenantRef.current = null
      setAvailableTenants([])
      setPermissions([])
      setWorkflowRoles([])

      // Clear browser storage
      localStorage.removeItem('permissions_cache')
      sessionStorage.clear()

      // Track logout event
      if (currentUser) {
        trackLogout({
          userId: currentUser.id,
          tenantId: currentTenantId,
          reason,
        })
      }

      router.push('/login')
    } catch (error) {
      console.error('Error signing out:', error)
      throw error
    } finally {
      setIsLoading(false)
      isSigningOutRef.current = false
    }
  }, [router, user, currentTenant])

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
   * Fetch permissions and workflow roles for current tenant
   * Uses caching for better performance
   */
  const refreshPermissions = useCallback(async () => {
    if (!user || !currentTenant) {
      setPermissions([])
      setWorkflowRoles([])
      return
    }

    try {
      // Check cache first
      const cached = getCachedPermissions(currentTenant.tenant_id)
      if (cached) {
        setPermissions(cached)
        // Still fetch workflow roles (they change more frequently)
        const workflow = await getUserWorkflowRoles()
        setWorkflowRoles(workflow)
        return
      }

      // Fetch from API if not cached
      const [perms, workflow] = await Promise.all([
        getUserPermissions(currentTenant.tenant_id),
        getUserWorkflowRoles(),
      ])

      setPermissions(perms)
      setWorkflowRoles(workflow)

      // Cache permissions
      setCachedPermissions(currentTenant.tenant_id, perms)
    } catch (error) {
      console.error('Error fetching permissions:', error)
      // Try to use cached data on error
      const cached = getCachedPermissions(currentTenant.tenant_id)
      if (cached) {
        setPermissions(cached)
      } else {
        setPermissions([])
      }
      setWorkflowRoles([])
    } finally {
      // Update ref after function completes
      refreshPermissionsRef.current = refreshPermissions
    }
  }, [user, currentTenant])

  /**
   * Switch active tenant context
   * Enhanced to ensure JWT is updated with tenant context
   */
  const switchTenant = useCallback(async (tenantId: string) => {
    setIsLoading(true)
    try {
      // 1. Validate user has access to tenant via RPC
      const { data, error } = await supabase.rpc('switch_tenant_context', {
        p_tenant_id: tenantId,
      })

      if (error) throw error

      if (!data || data.length === 0 || !data[0].success) {
        throw new Error('Failed to switch tenant')
      }

      const tenantData = data[0]
      const newTenant: UserTenant = {
        tenant_id: tenantData.tenant_id,
        tenant_name: tenantData.tenant_name,
        tenant_slug: tenantData.tenant_slug,
        user_role: tenantData.user_role as UserRole,
        is_active: true,
        last_login_at: new Date().toISOString(),
      }

      // 2. Update user_metadata with tenant_org_id BEFORE refresh
      // This ensures the new JWT will contain the tenant context
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          tenant_org_id: tenantId,
        },
      })

      if (updateError) {
        console.error('Error updating user metadata:', updateError)
        throw new Error('Failed to update tenant context in JWT')
      }

      // 3. Refresh session to get new JWT with tenant context
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()

      if (refreshError) {
        console.error('Error refreshing session:', refreshError)
        throw new Error('Failed to refresh session')
      }

      // 4. Verify new JWT contains correct tenant
      if (refreshData.session?.user.user_metadata?.tenant_org_id !== tenantId) {
        console.warn('JWT tenant mismatch after refresh, retrying...')
        
        // Retry once with exponential backoff
        await new Promise(resolve => setTimeout(resolve, 500))
        
        const { data: retryData, error: retryError } = await supabase.auth.refreshSession()
        
        if (retryError || retryData.session?.user.user_metadata?.tenant_org_id !== tenantId) {
          console.error('JWT tenant verification failed after retry')
          throw new Error('Tenant context not updated in JWT')
        }
      }

      // 5. Update local state
      setCurrentTenant(newTenant)
      currentTenantRef.current = newTenant

      // 6. Fetch permissions for new tenant
      await refreshPermissions()

      // 7. Reload the page to ensure all queries use new tenant context
      window.location.reload()
    } catch (error) {
      console.error('Error switching tenant:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [refreshPermissions])

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
          // Tenants and permissions will be fetched via useEffect hooks
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setSession(null)
          setCurrentTenant(null)
          currentTenantRef.current = null
          setAvailableTenants([])
          setPermissions([])
          setWorkflowRoles([])
          invalidatePermissionCache()
          sessionStorage.clear()
          // Redirect to logout page with reason when session expired (not user-initiated)
          if (!isSigningOutRef.current) {
            router.push('/logout?reason=session_expired')
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
  }, [initializeAuth]) // Removed currentTenant and refreshPermissions to prevent re-subscription loops

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isLoading, availableTenants.length]) // refreshTenants intentionally omitted to prevent loops

  /**
   * Fetch permissions when tenant changes or user logs in
   * Skip if we're in the middle of a login (signIn already fetches this data)
   */
  useEffect(() => {
    if (!isLoading && user && currentTenant && !isLoggingInRef.current) {
      // Only refresh if permissions are empty (not already loaded from signIn)
      if (permissions.length === 0 && workflowRoles.length === 0) {
        refreshPermissions()
      }
    } else if (!user || !currentTenant) {
      // Clear permissions when logged out or no tenant
      setPermissions([])
      setWorkflowRoles([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, currentTenant, isLoading, permissions.length, workflowRoles.length]) // refreshPermissions intentionally omitted to prevent loops

  const value: AuthContextType = {
    // State
    user,
    session,
    currentTenant,
    availableTenants,
    permissions,
    workflowRoles,
    isLoading,
    isAuthenticated: !!user,

    // Methods
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    switchTenant,
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
