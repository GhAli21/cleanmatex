import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminSupabaseClient } from '@/lib/supabase/server'

/**
 * Client for `sys_*` / `hq_*` catalogs and for RPCs the public key must not call.
 *
 * Those objects are revoked from `anon` and `authenticated`. A session client
 * (the user JWT) cannot read them after that change. Callers pass the session
 * client only so Jest can keep using its mock: under `NODE_ENV=test` the mock
 * is returned. Every other environment uses the service role for this
 * statement alone. Organization tables stay on the session client so row
 * security still applies to tenant data.
 * @param sessionClient - Session or test client. Ignored outside Jest.
 * @returns Service-role client, or the test mock when one was passed
 */
export function catalogReadClient(sessionClient?: SupabaseClient): SupabaseClient {
  if (process.env.NODE_ENV === 'test' && sessionClient) {
    return sessionClient
  }
  return createAdminSupabaseClient()
}
