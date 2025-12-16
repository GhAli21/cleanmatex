/**
 * Permissions API Client
 *
 * Client-safe wrapper for permission management API calls
 */

export interface Permission {
  permission_id: string;
  code: string;
  name: string | null;
  name2: string | null;
  category: string | null;
  description: string | null;
  is_active: boolean;
}

export interface PermissionsResponse {
  permissions: Permission[];
  grouped: Record<string, Permission[]>;
}

/**
 * Get all permissions grouped by category
 */
export async function getAllPermissions(): Promise<PermissionsResponse> {
  const response = await fetch('/api/permissions', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Failed to fetch permissions');
  }

  return result.data;
}
