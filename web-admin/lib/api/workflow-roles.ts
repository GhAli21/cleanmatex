/**
 * Workflow Roles API Client
 *
 * Client-safe wrapper for workflow role management API calls
 */

export interface User {
  id: string;
  email: string;
  display_name: string | null;
}

export interface WorkflowRoleAssignment {
  id: string;
  user_id: string;
  workflow_role: string;
  is_active: boolean;
}

export interface UserWithWorkflowRoles extends User {
  workflow_roles: WorkflowRoleAssignment[];
}

export interface AssignWorkflowRoleRequest {
  user_id: string;
  workflow_role: string;
}

/**
 * Get all users with their workflow role assignments
 */
export async function getUsersWithWorkflowRoles(): Promise<UserWithWorkflowRoles[]> {
  const response = await fetch('/api/workflow-roles/users', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Failed to fetch users with workflow roles');
  }

  return result.data;
}

/**
 * Get workflow role assignments for a specific user
 */
export async function getUserWorkflowRoleAssignments(
  userId: string
): Promise<WorkflowRoleAssignment[]> {
  const response = await fetch(`/api/workflow-roles?userId=${userId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Failed to fetch workflow role assignments');
  }

  return result.data;
}

/**
 * Assign workflow role to user
 */
export async function assignWorkflowRoleToUser(
  data: AssignWorkflowRoleRequest
): Promise<WorkflowRoleAssignment> {
  const response = await fetch('/api/workflow-roles', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Failed to assign workflow role');
  }

  return result.data;
}

/**
 * Remove workflow role from user
 */
export async function removeWorkflowRoleFromUser(
  assignmentId: string
): Promise<void> {
  const response = await fetch(`/api/workflow-roles/${assignmentId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Failed to remove workflow role');
  }
}
