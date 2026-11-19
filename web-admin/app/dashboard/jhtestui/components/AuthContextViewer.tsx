'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { Shield, User, Building2, RefreshCw, CheckCircle, XCircle, Clock, Code, Zap, AlertCircle } from 'lucide-react';

/**
 *
 */
export default function AuthContextViewer() {
  const authContext = useAuth();
  const [showMethods, setShowMethods] = useState(false);
  const [nowEpochSeconds, setNowEpochSeconds] = useState(() => Math.floor(Date.now() / 1000));

  const {
    user,
    session,
    currentTenant,
    availableTenants,
    isLoading,
    isAuthenticated,
  } = authContext;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowEpochSeconds(Math.floor(Date.now() / 1000));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  // Calculate session time remaining
  const getTimeRemaining = () => {
    if (!session?.expires_at) return 'N/A';
    const remaining = session.expires_at - nowEpochSeconds;

    if (remaining <= 0) return 'Expired';

    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    const seconds = remaining % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Auth Context (useAuth Hook)</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Live data from the application&apos;s auth context provider
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary-hover transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Reload Page
        </button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="bg-info-bg rounded-lg border border-info-border p-4">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
            <div>
              <h3 className="font-semibold text-primary-text">Loading Auth Context</h3>
              <p className="text-sm text-primary-text mt-1">Auth context is initializing...</p>
            </div>
          </div>
        </div>
      )}

      {/* Authentication Status */}
      <div className="bg-card rounded-lg border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary-text" />
          Authentication Status
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-foreground">Is Authenticated</label>
            <div className="mt-1">
              {isAuthenticated ? (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-success-bg text-success-text">
                  <CheckCircle className="h-4 w-4" />
                  Yes
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-danger-bg text-danger-text">
                  <XCircle className="h-4 w-4" />
                  No
                </span>
              )}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Is Loading</label>
            <div className="mt-1">
              {isLoading ? (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-warning-bg text-warning-text">
                  <Clock className="h-4 w-4" />
                  Loading...
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-success-bg text-success-text">
                  <CheckCircle className="h-4 w-4" />
                  Ready
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* User State */}
      <div className="bg-card rounded-lg border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <User className="h-5 w-5 text-primary-text" />
          User State
        </h3>
        {user ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground">Email</label>
                <p className="text-sm text-foreground mt-1">{user.email || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Phone</label>
                <p className="text-sm text-foreground mt-1">{user.phone || 'N/A'}</p>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-foreground">User ID</label>
                <p className="text-xs text-foreground mt-1 font-mono break-all">{user.id}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Created At</label>
                <p className="text-sm text-foreground mt-1">
                  {user.created_at ? new Date(user.created_at).toLocaleString() : 'N/A'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Last Sign In</label>
                <p className="text-sm text-foreground mt-1">
                  {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'N/A'}
                </p>
              </div>
            </div>
            <details className="mt-4">
              <summary className="text-sm font-medium text-foreground cursor-pointer hover:text-foreground/80">
                Show Full User Object
              </summary>
              <pre className="text-xs bg-muted p-3 rounded border border-border overflow-x-auto mt-2">
                {JSON.stringify(user, null, 2)}
              </pre>
            </details>
          </div>
        ) : (
          <div className="text-center py-4">
            <XCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No user logged in</p>
          </div>
        )}
      </div>

      {/* Session State */}
      <div className="bg-card rounded-lg border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary-text" />
          Session State
        </h3>
        {session ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground">Access Token</label>
                <p className="text-xs text-foreground mt-1 font-mono break-all">
                  {session.access_token ? `${session.access_token.substring(0, 40)}...` : 'N/A'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Refresh Token</label>
                <p className="text-xs text-foreground mt-1 font-mono break-all">
                  {session.refresh_token ? `${session.refresh_token.substring(0, 40)}...` : 'N/A'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Expires At</label>
                <p className="text-sm text-foreground mt-1">
                  {session.expires_at ? new Date(session.expires_at * 1000).toLocaleString() : 'N/A'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Time Remaining</label>
                <p className="text-sm font-semibold text-primary-text mt-1">{getTimeRemaining()}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Expires In (seconds)</label>
                <p className="text-sm text-foreground mt-1">{session.expires_in || 'N/A'}</p>
              </div>
            </div>
            <details className="mt-4">
              <summary className="text-sm font-medium text-foreground cursor-pointer hover:text-foreground/80">
                Show Full Session Object
              </summary>
              <pre className="text-xs bg-muted p-3 rounded border border-border overflow-x-auto mt-2">
                {JSON.stringify(session, null, 2)}
              </pre>
            </details>
          </div>
        ) : (
          <div className="text-center py-4">
            <XCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No active session</p>
          </div>
        )}
      </div>

      {/* Current Tenant State */}
      <div className="bg-card rounded-lg border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary-text" />
          Current Tenant State
        </h3>
        {currentTenant ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground">Tenant Name</label>
                <p className="text-sm text-foreground mt-1 font-semibold">{currentTenant.tenant_name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Tenant Slug</label>
                <p className="text-sm text-foreground mt-1 font-mono">{currentTenant.tenant_slug}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">User Role</label>
                <p className="text-sm text-foreground mt-1">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-info-bg text-info-text">
                    {currentTenant.user_role}
                  </span>
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Is Active</label>
                <p className="text-sm text-foreground mt-1">
                  {currentTenant.is_active ? (
                    <span className="text-success-text flex items-center gap-1">
                      <CheckCircle className="h-4 w-4" />
                      Active
                    </span>
                  ) : (
                    <span className="text-danger-text flex items-center gap-1">
                      <XCircle className="h-4 w-4" />
                      Inactive
                    </span>
                  )}
                </p>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-foreground">Tenant ID</label>
                <p className="text-xs text-foreground mt-1 font-mono break-all">{currentTenant.tenant_id}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Last Login At</label>
                <p className="text-sm text-foreground mt-1">
                  {currentTenant.last_login_at ? new Date(currentTenant.last_login_at).toLocaleString() : 'N/A'}
                </p>
              </div>
            </div>
            <details className="mt-4">
              <summary className="text-sm font-medium text-foreground cursor-pointer hover:text-foreground/80">
                Show Full Tenant Object
              </summary>
              <pre className="text-xs bg-muted p-3 rounded border border-border overflow-x-auto mt-2">
                {JSON.stringify(currentTenant, null, 2)}
              </pre>
            </details>
          </div>
        ) : (
          <div className="text-center py-4">
            <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No tenant context set</p>
          </div>
        )}
      </div>

      {/* Available Tenants State */}
      <div className="bg-card rounded-lg border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary-text" />
          Available Tenants ({availableTenants.length})
        </h3>
        {availableTenants.length > 0 ? (
          <div className="space-y-3">
            {availableTenants.map((tenant, index) => (
              <div
                key={tenant.tenant_id}
                className="border border-border rounded-lg p-4 hover:bg-muted transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-foreground">{tenant.tenant_name}</span>
                      {currentTenant?.tenant_id === tenant.tenant_id && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-info-bg text-info-text">
                          Current
                        </span>
                      )}
                      {tenant.is_active ? (
                        <CheckCircle className="h-4 w-4 text-success-text" />
                      ) : (
                        <XCircle className="h-4 w-4 text-danger-text" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono mb-1">{tenant.tenant_id}</p>
                    <p className="text-xs text-muted-foreground">Slug: {tenant.tenant_slug}</p>
                  </div>
                  <div className="text-end">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-info-bg text-info-text">
                      {tenant.user_role}
                    </span>
                    {tenant.last_login_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Last: {new Date(tenant.last_login_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No tenants available</p>
          </div>
        )}
      </div>

      {/* Available Methods */}
      <div className="bg-card rounded-lg border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary-text" />
            Available Methods
          </h3>
          <button
            onClick={() => setShowMethods(!showMethods)}
            className="text-sm text-primary-text hover:text-primary-text/80"
          >
            {showMethods ? 'Hide' : 'Show'}
          </button>
        </div>
        {showMethods && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                'signIn(email, password)',
                'signUp(email, password, displayName)',
                'signOut()',
                'resetPassword(email)',
                'updatePassword(newPassword)',
                'refreshTenants()',
                'updateProfile(displayName, preferences)',
              ].map((method) => (
                <div key={method} className="border border-border rounded p-3 bg-muted">
                  <code className="text-xs text-primary-text font-mono">{method}</code>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Usage Example */}
      <div className="bg-info-bg rounded-lg border border-info-border p-6">
        <h3 className="text-lg font-semibold text-primary-text mb-3 flex items-center gap-2">
          <Code className="h-5 w-5" />
          Usage in Components
        </h3>
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-primary-text mb-2">Import and use the hook:</p>
            <pre className="text-xs bg-card p-3 rounded border border-info-border overflow-x-auto">
{`import { useAuth } from '@/lib/auth/auth-context';

function MyComponent() {
  const {
    user,
    session,
    currentTenant,
    availableTenants,
    isLoading,
    isAuthenticated,
    signIn,
    signOut,
  } = useAuth();

  // Use auth state and methods
  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated) return <div>Please log in</div>;

  return (
    <div>
      <p>Welcome, {user?.email}</p>
      <p>Tenant: {currentTenant?.tenant_name}</p>
      <button onClick={signOut}>Sign Out</button>
    </div>
  );
}`}
            </pre>
          </div>
        </div>
      </div>

      {/* Context Provider Info */}
      <div className="bg-info-bg rounded-lg border border-info-border p-6">
        <h3 className="text-lg font-semibold text-primary-text mb-3">Auth Context Provider Info</h3>
        <div className="space-y-2 text-sm text-primary-text">
          <p>📁 <strong>Location:</strong> <code className="text-xs bg-info-bg px-1 py-0.5 rounded">lib/auth/auth-context.tsx</code></p>
          <p>🎯 <strong>Purpose:</strong> Manages authentication state and operations across the application</p>
          <p>🔄 <strong>Features:</strong> Multi-tenant support, tenant switching, auto token refresh</p>
          <p>🔐 <strong>Security:</strong> Account locking, login attempt tracking, session management</p>
          <p>📡 <strong>Events:</strong> Listens to Supabase auth state changes (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED)</p>
        </div>
      </div>
    </div>
  );
}
