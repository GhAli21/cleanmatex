import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

/** Only an ACTIVE session row is a business organization. PENDING is a laundry choice, not a tenant. */
const ACTIVE_SESSION = 'ACTIVE';

interface SessionValidationRow {
  state: string;
  tenantOrgId: string | null;
}

/**
 * Resolves the staff organization from fn_auth_session_validate.
 * The function reads the caller from the bearer token. The service-role client has no session, so it is not used.
 */
@Injectable()
export class StaffSessionService {
  constructor(private readonly config: ConfigService) {}

  /**
   * @param accessToken - Supabase access token of the signed-in global user
   * @returns Organization id of the ACTIVE session
   */
  async resolveActiveOrganization(accessToken: string): Promise<string> {
    const url = this.config.get<string>('SUPABASE_URL');
    const anonKey = this.config.get<string>('SUPABASE_ANON_KEY');
    if (!url || !anonKey) {
      throw new UnauthorizedException('Session validation is not configured');
    }

    const client = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await client.rpc('fn_auth_session_validate', { p_touch: false });
    if (error) {
      throw new UnauthorizedException('Session validation failed');
    }

    const row = readValidationRow(data);
    if (!row || row.state !== ACTIVE_SESSION || !row.tenantOrgId) {
      throw new UnauthorizedException('Sign in to an organization before using this API');
    }
    return row.tenantOrgId;
  }
}

function readValidationRow(data: unknown): SessionValidationRow | null {
  if (!Array.isArray(data) || data.length === 0) return null;
  const row = data[0];
  if (!row || typeof row !== 'object') return null;
  const record = row as Record<string, unknown>;
  const state = typeof record.state === 'string' ? record.state : '';
  const tenantOrgId = typeof record.tenant_org_id === 'string' ? record.tenant_org_id : null;
  return { state, tenantOrgId };
}
