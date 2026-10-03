/**
 * Current Supabase session id for server code (route handlers / server actions).
 *
 * Read from the caller's own verified access token — never from request input — so "this device" flags and
 * "do not revoke the current session" rules cannot be spoofed by a client.
 */

import { createClient } from '@/lib/supabase/server'
import { getSessionIdFromToken } from '@/lib/auth/jwt-claims'

/**
 * @returns The caller's `session_id` claim, or null when there is no session
 */
export async function getCurrentAuthSessionId(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return getSessionIdFromToken(session?.access_token)
}
