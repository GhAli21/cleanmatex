# Plan: Users Page (Team Management) API Integration

## Overview

The Users settings page (`app/dashboard/settings/users/page.tsx`) uses mock team data and has TODO for the invite API call. It needs real APIs for listing team members, inviting users, and managing roles/status.

## Current State

- **File:** `app/dashboard/settings/users/page.tsx`
- **Data:** MOCK_TEAM array (hardcoded)
- **handleInvite:** TODO - API call; currently just logs and closes modal
- **Existing:** Uses `updateUser`, `deleteUser`, `activateUser`, `resetUserPassword` from `@/lib/api/users`
- **UI:** Team list, invite modal, edit modal, role badges, status badges

## Prerequisites

- `org_users_mst` table (tenant users with roles)
- Invite flow: Supabase Auth admin invite, or custom invite table + email
- Permission: only admin/owner can manage team

## Implementation Steps

### Step 1: List team members API

- `GET /api/v1/settings/users` or `GET /api/v1/team`
- Query org_users_mst for current tenant
- Join with auth.users for email, or use org_users_mst fields
- Return: id, name, email, role, status (active/pending/inactive), joinedAt
- Require permission (e.g. settings:write or admin)

### Step 2: Wire team list

- Replace MOCK_TEAM with fetch from API
- useEffect to load on mount
- Handle loading and empty state

### Step 3: Invite user API

- `POST /api/v1/settings/users/invite` or `POST /api/v1/team/invite`
- Body: { email, role }
- Backend: 
  - Option A: Supabase Auth admin inviteUserByEmail
  - Option B: Insert into org_user_invites, send email with magic link
  - Create org_users_mst row when user accepts (or link existing user)
- Return success with pending user or error

### Step 4: Wire handleInvite

- Call POST invite API with inviteData
- On success: refresh team list, close modal, show success
- On error: show error message

### Step 5: Verify existing actions

- updateUser, deleteUser, activateUser, resetUserPassword - ensure they hit real APIs
- If they use lib/api/users, confirm those functions call correct endpoints
- Add any missing APIs (e.g. update role, deactivate)

### Step 6: Role and permission checks

- Ensure only admin/owner can access this page (layout or middleware)
- Invite/remove actions check permission

## Acceptance Criteria

- [ ] Team list shows real org_users_mst data for tenant
- [ ] Invite creates pending user and sends email (or equivalent)
- [ ] Reset password, deactivate, edit work with real APIs
- [ ] Tenant isolation enforced
- [ ] Build passes

## Production Checklist

- [ ] Invite email template configured
- [ ] Supabase Auth invite (or custom flow) tested
- [ ] RLS on org_users_mst restricts to tenant
- [ ] i18n for invite success/error

## References

- web-admin/app/dashboard/settings/users/page.tsx
- web-admin/lib/api/users.ts
- org_users_mst schema
- Supabase Auth admin API (inviteUserByEmail)
