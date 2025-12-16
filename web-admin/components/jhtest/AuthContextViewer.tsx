'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { Shield, User, Building2, RefreshCw, CheckCircle, XCircle, Clock, Code, Zap, AlertCircle } from 'lucide-react';

export default function AuthContextViewer() {
  const authContext = useAuth();
  const [showMethods, setShowMethods] = useState(false);

  const {
    user,
    session,
    currentTenant,
    availableTenants,
    isLoading,
    isAuthenticated,
  } = authContext;

  // Calculate session time remaining
  const getTimeRemaining = () => {
    if (!session?.expires_at) return 'N/A';
    const now = Math.floor(Date.now() / 1000);
    const remaining = session.expires_at - now;

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
          <h2 className="text-2xl font-bold text-gray-900">Auth Context (useAuth Hook)</h2>
          <p className="text-sm text-gray-600 mt-1">
            Live data from the application's auth context provider
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Reload Page
        </button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <div>
              <h3 className="font-semibold text-blue-900">Loading Auth Context</h3>
              <p className="text-sm text-blue-700 mt-1">Auth context is initializing...</p>
            </div>
          </div>
        </div>
      )}

      {/* Authentication Status */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Shield className="h-5 w-5 text-purple-600" />
          Authentication Status
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Is Authenticated</label>
            <div className="mt-1">
              {isAuthenticated ? (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                  <CheckCircle className="h-4 w-4" />
                  Yes
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                  <XCircle className="h-4 w-4" />
                  No
                </span>
              )}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Is Loading</label>
            <div className="mt-1">
              {isLoading ? (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                  <Clock className="h-4 w-4" />
                  Loading...
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                  <CheckCircle className="h-4 w-4" />
                  Ready
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* User State */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <User className="h-5 w-5 text-purple-600" />
          User State
        </h3>
        {user ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Email</label>
                <p className="text-sm text-gray-900 mt-1">{user.email || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Phone</label>
                <p className="text-sm text-gray-900 mt-1">{user.phone || 'N/A'}</p>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-700">User ID</label>
                <p className="text-xs text-gray-900 mt-1 font-mono break-all">{user.id}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Created At</label>
                <p className="text-sm text-gray-900 mt-1">
                  {user.created_at ? new Date(user.created_at).toLocaleString() : 'N/A'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Last Sign In</label>
                <p className="text-sm text-gray-900 mt-1">
                  {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'N/A'}
                </p>
              </div>
            </div>
            <details className="mt-4">
              <summary className="text-sm font-medium text-gray-700 cursor-pointer hover:text-gray-900">
                Show Full User Object
              </summary>
              <pre className="text-xs bg-gray-50 p-3 rounded border border-gray-200 overflow-x-auto mt-2">
                {JSON.stringify(user, null, 2)}
              </pre>
            </details>
          </div>
        ) : (
          <div className="text-center py-4">
            <XCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600">No user logged in</p>
          </div>
        )}
      </div>

      {/* Session State */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5 text-purple-600" />
          Session State
        </h3>
        {session ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Access Token</label>
                <p className="text-xs text-gray-900 mt-1 font-mono break-all">
                  {session.access_token ? `${session.access_token.substring(0, 40)}...` : 'N/A'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Refresh Token</label>
                <p className="text-xs text-gray-900 mt-1 font-mono break-all">
                  {session.refresh_token ? `${session.refresh_token.substring(0, 40)}...` : 'N/A'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Expires At</label>
                <p className="text-sm text-gray-900 mt-1">
                  {session.expires_at ? new Date(session.expires_at * 1000).toLocaleString() : 'N/A'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Time Remaining</label>
                <p className="text-sm font-semibold text-purple-600 mt-1">{getTimeRemaining()}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Expires In (seconds)</label>
                <p className="text-sm text-gray-900 mt-1">{session.expires_in || 'N/A'}</p>
              </div>
            </div>
            <details className="mt-4">
              <summary className="text-sm font-medium text-gray-700 cursor-pointer hover:text-gray-900">
                Show Full Session Object
              </summary>
              <pre className="text-xs bg-gray-50 p-3 rounded border border-gray-200 overflow-x-auto mt-2">
                {JSON.stringify(session, null, 2)}
              </pre>
            </details>
          </div>
        ) : (
          <div className="text-center py-4">
            <XCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600">No active session</p>
          </div>
        )}
      </div>

      {/* Current Tenant State */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-purple-600" />
          Current Tenant State
        </h3>
        {currentTenant ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Tenant Name</label>
                <p className="text-sm text-gray-900 mt-1 font-semibold">{currentTenant.tenant_name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Tenant Slug</label>
                <p className="text-sm text-gray-900 mt-1 font-mono">{currentTenant.tenant_slug}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">User Role</label>
                <p className="text-sm text-gray-900 mt-1">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    {currentTenant.user_role}
                  </span>
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Is Active</label>
                <p className="text-sm text-gray-900 mt-1">
                  {currentTenant.is_active ? (
                    <span className="text-green-600 flex items-center gap-1">
                      <CheckCircle className="h-4 w-4" />
                      Active
                    </span>
                  ) : (
                    <span className="text-red-600 flex items-center gap-1">
                      <XCircle className="h-4 w-4" />
                      Inactive
                    </span>
                  )}
                </p>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-700">Tenant ID</label>
                <p className="text-xs text-gray-900 mt-1 font-mono break-all">{currentTenant.tenant_id}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Last Login At</label>
                <p className="text-sm text-gray-900 mt-1">
                  {currentTenant.last_login_at ? new Date(currentTenant.last_login_at).toLocaleString() : 'N/A'}
                </p>
              </div>
            </div>
            <details className="mt-4">
              <summary className="text-sm font-medium text-gray-700 cursor-pointer hover:text-gray-900">
                Show Full Tenant Object
              </summary>
              <pre className="text-xs bg-gray-50 p-3 rounded border border-gray-200 overflow-x-auto mt-2">
                {JSON.stringify(currentTenant, null, 2)}
              </pre>
            </details>
          </div>
        ) : (
          <div className="text-center py-4">
            <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600">No tenant context set</p>
          </div>
        )}
      </div>

      {/* Available Tenants State */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-purple-600" />
          Available Tenants ({availableTenants.length})
        </h3>
        {availableTenants.length > 0 ? (
          <div className="space-y-3">
            {availableTenants.map((tenant, index) => (
              <div
                key={tenant.tenant_id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">{tenant.tenant_name}</span>
                      {currentTenant?.tenant_id === tenant.tenant_id && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          Current
                        </span>
                      )}
                      {tenant.is_active ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                    <p className="text-xs text-gray-600 font-mono mb-1">{tenant.tenant_id}</p>
                    <p className="text-xs text-gray-600">Slug: {tenant.tenant_slug}</p>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      {tenant.user_role}
                    </span>
                    {tenant.last_login_at && (
                      <p className="text-xs text-gray-500 mt-1">
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
            <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600">No tenants available</p>
          </div>
        )}
      </div>

      {/* Available Methods */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Zap className="h-5 w-5 text-purple-600" />
            Available Methods
          </h3>
          <button
            onClick={() => setShowMethods(!showMethods)}
            className="text-sm text-purple-600 hover:text-purple-700"
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
                'switchTenant(tenantId)',
                'refreshTenants()',
                'updateProfile(displayName, preferences)',
              ].map((method) => (
                <div key={method} className="border border-gray-200 rounded p-3 bg-gray-50">
                  <code className="text-xs text-purple-600 font-mono">{method}</code>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Usage Example */}
      <div className="bg-purple-50 rounded-lg border border-purple-200 p-6">
        <h3 className="text-lg font-semibold text-purple-900 mb-3 flex items-center gap-2">
          <Code className="h-5 w-5" />
          Usage in Components
        </h3>
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-purple-800 mb-2">Import and use the hook:</p>
            <pre className="text-xs bg-white p-3 rounded border border-purple-200 overflow-x-auto">
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
    switchTenant,
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
      <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">Auth Context Provider Info</h3>
        <div className="space-y-2 text-sm text-blue-800">
          <p>📁 <strong>Location:</strong> <code className="text-xs bg-blue-100 px-1 py-0.5 rounded">lib/auth/auth-context.tsx</code></p>
          <p>🎯 <strong>Purpose:</strong> Manages authentication state and operations across the application</p>
          <p>🔄 <strong>Features:</strong> Multi-tenant support, tenant switching, auto token refresh</p>
          <p>🔐 <strong>Security:</strong> Account locking, login attempt tracking, session management</p>
          <p>📡 <strong>Events:</strong> Listens to Supabase auth state changes (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED)</p>
        </div>
      </div>
    </div>
  );
}
