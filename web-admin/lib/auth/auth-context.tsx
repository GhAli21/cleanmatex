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

  /**
   * Fetch available tenants for current user
   */
  const refreshTenants = useCallback(async () => {
    if (!user) {
      setAvailableTenants([])
      setCurrentTenant(null)
      return
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
      }) => ({
        tenant_id: t.tenant_id,
        tenant_name: t.tenant_name,
        tenant_slug: t.tenant_slug,
        user_role: t.user_role as UserRole,
        is_active: t.is_active,
        last_login_at: t.last_login_at,
      }))

      setAvailableTenants(tenants)

      // Set current tenant if not already set (using functional update to avoid dependency)
      setCurrentTenant((prevTenant) => {
        if (!prevTenant && tenants.length > 0) {
          return tenants[0]
        }
        return prevTenant
      })
      
    } catch (error) {
      console.error('Error fetching tenants:', error)
      setAvailableTenants([])
    }
  }, [user]) // Removed currentTenant from dependencies to prevent infinite loop

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
  const signIn = useCallback(async (email: string, password: string) => {
    // Prevent multiple simultaneous login attempts
    if (isLoggingInRef.current) {
      throw new Error('Login already in progress')
    }
    
    isLoggingInRef.current = true
    setIsLoading(true)
    try {
      // SECURITY: Check if account is locked BEFORE attempting login
      // Wrap in try-catch in case migration hasn't been run yet
      try {
        const { data: lockStatus, error: lockError } = await supabase.rpc('is_account_locked', {
          p_email: email,
        })

        if (!lockError && lockStatus && lockStatus.length > 0 && lockStatus[0].is_locked) {
          const lockedUntil = new Date(lockStatus[0].locked_until)
          const minutesRemaining = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000)

          throw new Error(
            `Account is temporarily locked due to too many failed login attempts. ` +
            `Please try again in ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''}.`
          )
        }
      } catch (lockCheckError: unknown) {
        // If function doesn't exist or other error, log it but continue with login
        // This allows the system to work even if the security enhancement migration hasn't been run
        const errorMessage = lockCheckError instanceof Error ? lockCheckError.message : String(lockCheckError)
        if (!errorMessage.includes('locked')) {
          console.warn('Account lock check skipped:', errorMessage)
        } else {
          // Re-throw if it's an actual lock error
          throw lockCheckError
        }
      }

      // Attempt login
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      // Record successful login attempt in audit log
      await supabase.rpc('record_login_attempt', {
        p_email: email,
        p_success: true,
        p_ip_address: undefined, // Browser doesn't have access to IP
        p_user_agent: navigator.userAgent,
        p_error_message: undefined,
      })

      setUser(data.user as AuthUser)
      setSession({
        user: data.user as AuthUser,
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at ?? null,
        expires_in: data.session.expires_in ?? null,
      })

      // Batch fetch all auth data after successful login
      // This is more efficient than sequential calls
      // Set a flag to prevent useEffect hooks from duplicating these calls
      const authData = await fetchAuthData()
      
      // Set all state at once to minimize re-renders
      setAvailableTenants(authData.tenants)
      if (authData.tenants.length > 0) {
        setCurrentTenant(authData.tenants[0])
        // Cache everything
        setCachedPermissions(authData.tenants[0].tenant_id, authData.permissions)
        setCachedFeatureFlags(authData.tenants[0].tenant_id, authData.featureFlags)
      }
      setPermissions(authData.permissions)
      setWorkflowRoles(authData.workflowRoles)

      // Redirect after state is set
      router.push('/dashboard')
    } catch (error: unknown) {
      // Record failed login attempt
      const errorMessage = error instanceof Error ? error.message : String(error)
      const { data: loginResult } = await supabase.rpc('record_login_attempt', {
        p_email: email,
        p_success: false,
        p_ip_address: undefined,
        p_user_agent: navigator.userAgent,
        p_error_message: errorMessage,
      })

      // Check if account was just locked
      if (loginResult && loginResult.length > 0 && loginResult[0].is_locked) {
        const lockedUntil = new Date(loginResult[0].locked_until)
        const minutesRemaining = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000)

        throw new Error(
          `Too many failed login attempts. Your account has been locked for ${minutesRemaining} minutes. ` +
          `Please try again later or contact support if you need assistance.`
        )
      }

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
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
          },
        },
      })

      if (error) throw error

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
  const signOut = useCallback(async () => {
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error

      // Clear all auth state
      setUser(null)
      setSession(null)
      setCurrentTenant(null)
      setAvailableTenants([])
      setPermissions([])
      setWorkflowRoles([])

      // Clear browser storage
      localStorage.removeItem('permissions_cache')
      sessionStorage.clear()

      // Note: Cache invalidation will be handled by server-side logout API
      // We don't need to invalidate cache from client since it will expire

      router.push('/login')
    } catch (error) {
      console.error('Error signing out:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [router])

  /**
   * Request password reset
   */
  const resetPassword = useCallback(async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })

      if (error) throw error
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
    }
  }, [user, currentTenant])

  /**
   * Switch active tenant context
   */
  const switchTenant = useCallback(async (tenantId: string) => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase.rpc('switch_tenant_context', {
        p_tenant_id: tenantId,
      })

      if (error) throw error

      if (data && data.length > 0 && data[0].success) {
        const tenantData = data[0]
        const newTenant: UserTenant = {
          tenant_id: tenantData.tenant_id,
          tenant_name: tenantData.tenant_name,
          tenant_slug: tenantData.tenant_slug,
          user_role: tenantData.user_role as UserRole,
          is_active: true,
          last_login_at: new Date().toISOString(),
        }
        setCurrentTenant(newTenant)

        // Refresh the session to update JWT claims
        await supabase.auth.refreshSession()

        // Fetch permissions for new tenant
        await refreshPermissions()

        // Reload the page to ensure all queries use new tenant context
        window.location.reload()
      } else {
        throw new Error('Failed to switch tenant')
      }
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
          setAvailableTenants([])
          setPermissions([])
          setWorkflowRoles([])
          // Clear browser storage and cache
          invalidatePermissionCache()
          sessionStorage.clear()
        } else if (event === 'TOKEN_REFRESHED' && currentSession) {
          setSession({
            user: currentSession.user as AuthUser,
            access_token: currentSession.access_token,
            refresh_token: currentSession.refresh_token,
            expires_at: currentSession.expires_at ?? null,
            expires_in: currentSession.expires_in ?? null,
          })
          // Refresh permissions on token refresh if tenant is set
          if (currentTenant) {
            refreshPermissions()
          }
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [initializeAuth, currentTenant, refreshPermissions])

  /**
   * Fetch tenants when user changes
   * Skip if we're in the middle of a login (signIn already fetches this data)
   */
  useEffect(() => {
    if (user && !isLoading && !isLoggingInRef.current && availableTenants.length === 0) {
      refreshTenants()
    }
  }, [user, isLoading, availableTenants.length, refreshTenants])

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
  }, [user, currentTenant, isLoading, permissions.length, workflowRoles.length, refreshPermissions])

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
