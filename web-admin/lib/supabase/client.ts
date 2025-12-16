/**
 * Supabase Client Configuration
 *
 * Creates browser-based Supabase client for client-side operations
 * Includes automatic token refresh and RLS enforcement
 */

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

/**
 * Create a Supabase client for client-side operations
 *
 * This client:
 * - Automatically handles auth token refresh
 * - Enforces Row-Level Security (RLS)
 * - Uses cookies for auth state persistence
 *
 * @returns Supabase client instance
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

/**
 * Singleton instance for client-side usage
 * Import this in client components
 */
export const supabase = createClient()
