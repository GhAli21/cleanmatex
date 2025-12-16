/**
 * Authentication and Authorization Types
 *
 * Type definitions for CleanMateX authentication system
 */

import type { User as SupabaseUser } from '@supabase/supabase-js'

/**
 * User roles within a tenant organization
 */
export type UserRole = 'admin' | 'operator' | 'viewer'

/**
 * Extended user information with tenant context
 */
export interface AuthUser extends SupabaseUser {
  // Supabase user properties are inherited
}

/**
 * Tenant information for multi-tenant users
 */
export interface UserTenant {
  tenant_id: string
  tenant_name: string
  tenant_slug: string
  user_role: UserRole
  is_active: boolean
  last_login_at: string | null
}

/**
 * Current session context
 */
export interface AuthSession {
  user: AuthUser | null
  access_token: string | null
  refresh_token: string | null
  expires_at: number | null
  expires_in: number | null
}

/**
 * Auth state for context provider
 */
export interface AuthState {
  user: AuthUser | null
  session: AuthSession | null
  currentTenant: UserTenant | null
  availableTenants: UserTenant[]
  permissions: string[] // RBAC permissions
  workflowRoles: string[] // Workflow roles
  isLoading: boolean
  isAuthenticated: boolean
}

/**
 * Auth context methods
 */
export interface AuthContextType extends AuthState {
  // Authentication methods
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, displayName: string) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  updatePassword: (newPassword: string) => Promise<void>

  // Tenant management
  switchTenant: (tenantId: string) => Promise<void>
  refreshTenants: () => Promise<void>
  refreshPermissions: () => Promise<void>

  // Profile management
  updateProfile: (displayName: string, preferences?: Record<string, any>) => Promise<void>
}

/**
 * Login credentials
 */
export interface LoginCredentials {
  email: string
  password: string
  tenantId?: string // Optional: for multi-tenant users
}

/**
 * Registration data
 */
export interface RegistrationData {
  email: string
  password: string
  displayName: string
  tenantSlug?: string // Optional: for invite flow
}

/**
 * Password reset request
 */
export interface PasswordResetRequest {
  email: string
}

/**
 * Password update data
 */
export interface PasswordUpdateData {
  token: string
  newPassword: string
}

/**
 * User profile update data
 */
export interface ProfileUpdateData {
  display_name?: string
  preferences?: Record<string, any>
}

/**
 * Auth error types
 */
export type AuthErrorCode =
  | 'invalid_credentials'
  | 'email_not_verified'
  | 'account_locked'
  | 'tenant_not_found'
  | 'permission_denied'
  | 'session_expired'
  | 'network_error'
  | 'unknown_error'

/**
 * Auth error with context
 */
export interface AuthError extends Error {
  code: AuthErrorCode
  details?: any
}

/**
 * Form validation errors
 */
export interface FormErrors {
  email?: string
  password?: string
  displayName?: string
  general?: string
}

/**
 * Password strength requirements
 */
export interface PasswordRequirements {
  minLength: number
  requireUppercase: boolean
  requireLowercase: boolean
  requireNumbers: boolean
  requireSpecialChars: boolean
}

/**
 * Password strength result
 */
export interface PasswordStrength {
  isValid: boolean
  score: number // 0-4 (weak to strong)
  feedback: string[]
}
