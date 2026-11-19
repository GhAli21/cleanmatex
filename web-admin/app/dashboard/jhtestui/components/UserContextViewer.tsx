'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User, Building2, Shield, Mail, Phone, Calendar, RefreshCw, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
 
interface TenantInfo {
  tenant_id: string;
  tenant_name: string;
  user_role: string;
}

interface UserContext {
  user: any;
  tenants: TenantInfo[];
  currentTenant: TenantInfo | null;
  session: any;
}

/**
 *
 */
export default function UserContextViewer() {
  const [context, setContext] = useState<UserContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const loadUserContext = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get authenticated user
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError) {
        throw new Error(`Auth error: ${userError.message}`);
      }

      if (!user) {
        throw new Error('No authenticated user found');
      }

      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('Session error:', sessionError);
      }

      // Get user's tenants using RPC
      const { data: tenants, error: tenantsError } = await supabase.rpc('get_user_tenants');

      if (tenantsError) {
        console.error('Tenants RPC error:', tenantsError);
      }

      setContext({
        user,
        tenants: tenants || [],
        currentTenant: tenants && tenants.length > 0 ? tenants[0] : null,
        session,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load user context');
      console.error('User context error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserContext();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-success"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-danger-bg border border-danger-border p-4">
        <div className="flex items-start gap-3">
          <XCircle className="h-5 w-5 text-danger-text mt-0.5" />
          <div>
            <h3 className="font-semibold text-danger-text">Error Loading User Context</h3>
            <p className="text-sm text-danger-text mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!context) {
    return (
      <div className="rounded-lg bg-warning-bg border border-warning-border p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-warning-text mt-0.5" />
          <div>
            <h3 className="font-semibold text-warning-text">No Context Available</h3>
            <p className="text-sm text-warning-text mt-1">User context could not be loaded.</p>
          </div>
        </div>
      </div>
    );
  }

  const { user, tenants, currentTenant, session } = context;

  return (
    <div className="space-y-6">
      {/* Header with Refresh Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">User & Tenant Context</h2>
          <p className="text-sm text-muted-foreground mt-1">Current authenticated user and tenant information</p>
        </div>
        <button
          onClick={loadUserContext}
          className="flex items-center gap-2 px-4 py-2 bg-success text-on-solid rounded-md hover:bg-success/90 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* User Information */}
      <div className="bg-card rounded-lg border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <User className="h-5 w-5 text-success-text" />
          User Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-foreground flex items-center gap-1">
              <Mail className="h-4 w-4" />
              Email
            </label>
            <p className="text-sm text-foreground mt-1">{user.email || 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground flex items-center gap-1">
              <Phone className="h-4 w-4" />
              Phone
            </label>
            <p className="text-sm text-foreground mt-1">{user.phone || 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">User ID</label>
            <p className="text-xs text-foreground mt-1 font-mono break-all">{user.id}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground flex items-center gap-1">
              <CheckCircle className="h-4 w-4" />
              Email Confirmed
            </label>
            <p className="text-sm text-foreground mt-1">
              {user.email_confirmed_at ? (
                <span className="text-success-text flex items-center gap-1">
                  <CheckCircle className="h-4 w-4" />
                  Yes ({new Date(user.email_confirmed_at).toLocaleDateString()})
                </span>
              ) : (
                <span className="text-warning-text flex items-center gap-1">
                  <XCircle className="h-4 w-4" />
                  No
                </span>
              )}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Created At
            </label>
            <p className="text-sm text-foreground mt-1">
              {user.created_at ? new Date(user.created_at).toLocaleString() : 'N/A'}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Last Sign In
            </label>
            <p className="text-sm text-foreground mt-1">
              {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'N/A'}
            </p>
          </div>
        </div>

        {/* User Metadata */}
        {user.user_metadata && Object.keys(user.user_metadata).length > 0 && (
          <div className="mt-4">
            <label className="text-sm font-medium text-foreground mb-2 block">User Metadata</label>
            <pre className="text-xs bg-muted p-3 rounded border border-border overflow-x-auto">
              {JSON.stringify(user.user_metadata, null, 2)}
            </pre>
          </div>
        )}

        {/* App Metadata */}
        {user.app_metadata && Object.keys(user.app_metadata).length > 0 && (
          <div className="mt-4">
            <label className="text-sm font-medium text-foreground mb-2 block">App Metadata</label>
            <pre className="text-xs bg-muted p-3 rounded border border-border overflow-x-auto">
              {JSON.stringify(user.app_metadata, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Current Tenant */}
      {currentTenant && (
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-success-text" />
            Current Tenant
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground">Tenant Name</label>
              <p className="text-sm text-foreground mt-1 font-semibold">{currentTenant.tenant_name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground flex items-center gap-1">
                <Shield className="h-4 w-4" />
                User Role
              </label>
              <p className="text-sm text-foreground mt-1">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-bg text-success-text">
                  {currentTenant.user_role}
                </span>
              </p>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-foreground">Tenant ID</label>
              <p className="text-xs text-foreground mt-1 font-mono break-all">{currentTenant.tenant_id}</p>
            </div>
          </div>
        </div>
      )}

      {/* All Tenants */}
      {tenants && tenants.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-success-text" />
            All Accessible Tenants ({tenants.length})
          </h3>
          <div className="space-y-3">
            {tenants.map((tenant, index) => (
              <div
                key={tenant.tenant_id}
                className="border border-border rounded-lg p-4 hover:bg-muted transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{tenant.tenant_name}</span>
                      {index === 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-info-bg text-info-text">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 font-mono">{tenant.tenant_id}</p>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-bg text-success-text">
                    {tenant.user_role}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Session Information */}
      {session && (
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5 text-success-text" />
            Session Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground">Access Token Type</label>
              <p className="text-sm text-foreground mt-1">{session.token_type || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Expires At</label>
              <p className="text-sm text-foreground mt-1">
                {session.expires_at ? new Date(session.expires_at * 1000).toLocaleString() : 'N/A'}
              </p>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-foreground">Refresh Token</label>
              <p className="text-xs text-foreground mt-1 font-mono break-all">
                {session.refresh_token ? `${session.refresh_token.substring(0, 50)}...` : 'N/A'}
              </p>
            </div>
          </div>

          {/* Full Session Object */}
          <details className="mt-4">
            <summary className="text-sm font-medium text-foreground cursor-pointer hover:text-foreground/80">
              Show Full Session Object
            </summary>
            <pre className="text-xs bg-muted p-3 rounded border border-border overflow-x-auto mt-2 max-h-96 overflow-y-auto">
              {JSON.stringify(session, null, 2)}
            </pre>
          </details>
        </div>
      )}

      {/* Auth Code Usage Example */}
      <div className="bg-info-bg rounded-lg border border-info-border p-6">
        <h3 className="text-lg font-semibold text-primary-text mb-3">Usage in API Routes</h3>
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-primary-text mb-2">Standard Pattern:</p>
            <pre className="text-xs bg-card p-3 rounded border border-info-border overflow-x-auto">
{`const supabase = await createClient();
const {
  data: { user },
} = await supabase.auth.getUser();

if (!user) {
  return NextResponse.json(
    { error: 'Unauthorized' },
    { status: 401 }
  );
}

// Get user's tenants
const { data: tenants } = await supabase.rpc('get_user_tenants');
const tenantId = tenants[0].tenant_id;
const userRole = tenants[0].user_role;`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
