/**
 * Supabase Server Client Configuration
 *
 * Creates server-side Supabase client for use in:
 * - Server Components
 * - Server Actions
 * - API Routes
 * - Middleware
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

/**
 * Create a Supabase client for server-side operations
 *
 * This client:
 * - Reads auth tokens from cookies
 * - Enforces RLS based on authenticated user
 * - Automatically refreshes tokens
 *
 * Usage in Server Components:
 * ```ts
 * const supabase = await createServerSupabaseClient()
 * const { data } = await supabase.from('table').select()
 * ```
 *
 * @returns Promise<SupabaseClient>
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // Handle cases where cookies can't be set (e.g., middleware)
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // Handle cases where cookies can't be removed
          }
        },
      },
    }
  )
}

/**
 * Create an admin Supabase client (bypasses RLS)
 *
 * ⚠️ WARNING: This client has full database access
 * Use ONLY for:
 * - System operations
 * - Admin functions
 * - Background jobs
 *
 * NEVER expose service role key to client!
 *
 * @returns SupabaseClient with admin privileges
 */
export function createAdminSupabaseClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get() {
          return undefined
        },
        set() {},
        remove() {},
      },
    }
  )
}

/**
 * Alias for backward compatibility
 * @deprecated Use createServerSupabaseClient instead
 */
export const createClient = createServerSupabaseClient
