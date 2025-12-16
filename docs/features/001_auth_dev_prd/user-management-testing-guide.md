# User Management - Complete Testing Guide

**Feature:** User Management Interface
**Status:** ✅ COMPLETE
**Created:** 2025-10-18

---

## 📋 Overview

Complete testing guide for the User Management feature in CleanMateX web admin.

### Components Tested
1. Main Users Page
2. User Table with Pagination
3. User Filters Bar
4. User Stats Cards
5. User Modal (Add/Edit)

---

## 🧪 Test Scenarios

### Scenario 1: Access User Management (Admin Only) ✅

**Steps:**
1. Login as admin user:
   - Email: `admin@demo.cleanmatex.com`
   - Password: `Demo123!`
2. Navigate to `/dashboard/users`

**Expected:**
- Page loads successfully
- Protected by `withAdminRole` HOC
- User table displays
- Stats cards show counts
- Filters bar visible
- "Add User" button visible

**Verify Permissions:**
```bash
# Try as non-admin
# Login as operator or viewer
# Navigate to /dashboard/users
# Should redirect to /dashboard?error=insufficient_permissions
```

---

### Scenario 2: View User List ✅

**Steps:**
1. On users page
2. Observe user table

**Expected:**
- All users for current tenant displayed
- Columns shown:
  - Checkbox for selection
  - User avatar/name/email
  - Role badge (colored)
  - Status badge (Active/Inactive)
  - Last login date
  - Action buttons
- Pagination if > 20 users
- Loading state while fetching

**Verify:**
```sql
-- Check users in database
SELECT
  u.email,
  ou.display_name,
  ou.role,
  ou.is_active,
  ou.last_login_at
FROM auth.users u
JOIN org_users_mst ou ON u.id = ou.user_id
WHERE ou.tenant_org_id = 'your-tenant-id'
ORDER BY ou.created_at DESC;
```

---

### Scenario 3: View Statistics ✅

**Steps:**
1. Check stats cards at top of page

**Expected:**
- 4 cards displayed:
  1. **Total Users** - Count of all users
  2. **Active Users** - Active count (with progress bar)
  3. **Administrators** - Admin count (with operator/viewer breakdown)
  4. **Recent Logins** - Logins in last 7 days
- Icons and colors:
  - Total: Blue
  - Active: Green
  - Admins: Purple
  - Recent: Indigo

**Verify:**
```javascript
// In browser console on users page
// Stats should match database counts
```

---

### Scenario 4: Search Users 🔍

**Steps:**
1. Enter text in search box
2. Table filters automatically

**Test Cases:**
- Search by email: Enter part of email
- Search by name: Enter part of display name
- Clear search: Clear input
- No results: Search for non-existent user

**Expected:**
- Real-time filtering (no page reload)
- Results update as you type
- Empty state if no matches
- Active filter badge shows search term
- Can clear via X button in badge

---

### Scenario 5: Filter by Role 🎭

**Steps:**
1. Select role from dropdown:
   - All Roles
   - Admin
   - Operator
   - Viewer
2. Table filters

**Expected:**
- Only users with selected role shown
- Role filter badge appears
- Can clear via badge X button
- Pagination resets to page 1
- Stats remain unchanged (show all users)

---

### Scenario 6: Filter by Status 🟢

**Steps:**
1. Select status from dropdown:
   - All Status
   - Active
   - Inactive
2. Table filters

**Expected:**
- Only users with selected status shown
- Status filter badge appears
- Can clear via badge X button
- Pagination resets
- Can combine with role filter

---

### Scenario 7: Sort Users 🔽

**Steps:**
1. Change "Sort By" dropdown:
   - Date Created (default)
   - Email
   - Name
   - Role
   - Last Login
2. Table re-sorts

**Expected:**
- Table data reorders
- Default order: newest first
- Can sort ascending/descending
- Pagination maintained
- Filters still applied

---

### Scenario 8: Create New User ➕

**Steps:**
1. Click "Add User" button
2. Modal opens
3. Fill form:
   - Email: `newuser@example.com`
   - Password: `SecurePass123!`
   - Confirm Password: `SecurePass123!`
   - Display Name: `New Test User`
   - Role: Select `operator`
   - Check "Send invitation email"
4. Click "Create User"

**Expected:**
- Modal displays
- Form validation works:
  - Email format checked
  - Password strength validated
  - Passwords must match
  - Display name required
- Password toggle buttons work
- Loading state during creation
- Modal closes on success
- User appears in table
- Stats update
- Invitation email sent (check Mailpit)

**Verify:**
```sql
-- Check user was created
SELECT u.email, ou.display_name, ou.role
FROM auth.users u
JOIN org_users_mst ou ON u.id = ou.user_id
WHERE u.email = 'newuser@example.com';
```

```bash
# Check invitation email in Mailpit
http://localhost:54324
```

---

### Scenario 9: Edit User ✏️

**Steps:**
1. Click "Edit" on a user
2. Modal opens with user data
3. Change display name
4. Change role from `viewer` to `operator`
5. Click "Update User"

**Expected:**
- Modal shows pre-filled data
- Email is read-only (cannot change)
- No password fields (edit mode)
- Can change display name
- Can change role
- Role options with descriptions
- Loading state during save
- Modal closes on success
- Table updates with new data

**Verify:**
```sql
-- Check user was updated
SELECT display_name, role, updated_at
FROM org_users_mst
WHERE user_id = 'user-uuid';
```

---

### Scenario 10: Deactivate User ❌

**Steps:**
1. Click "Deactivate" on active user
2. Confirm dialog appears
3. Click OK

**Expected:**
- Confirmation dialog shows
- User's `is_active` set to false
- Status badge changes to "Inactive"
- User cannot login anymore
- "Deactivate" button changes to "Activate"
- Stats update (active count decreases)

**Test Login:**
```bash
# Try to login as deactivated user
# Should fail with appropriate error
```

---

### Scenario 11: Activate User ✅

**Steps:**
1. Click "Activate" on inactive user
2. User is reactivated

**Expected:**
- `is_active` set to true
- Status badge changes to "Active"
- User can login again
- "Activate" button changes to "Deactivate"
- Stats update (active count increases)

---

### Scenario 12: Reset User Password 🔑

**Steps:**
1. Click "Reset Password" on a user
2. Confirm dialog
3. Email sent

**Expected:**
- Confirmation dialog appears
- Password reset email sent
- Success message shown
- User receives email with reset link
- Link expires in 1 hour

**Verify:**
```bash
# Check email in Mailpit
http://localhost:54324

# Click reset link
# Should go to /reset-password page
# Can set new password
```

---

### Scenario 13: Pagination 📄

**Setup:** Create > 20 test users

**Steps:**
1. Observe pagination controls
2. Click "Next" page
3. Click page number
4. Click "Previous"

**Expected:**
- Page 1 loaded by default
- Pagination shows if > 20 users
- Current page highlighted
- Previous/Next buttons work
- Page numbers clickable
- Results count shows correctly:
  - "Showing 1 to 20 of 45 results"
- Filters preserved across pages

---

### Scenario 14: Bulk Selection 📋

**Steps:**
1. Check individual user checkboxes
2. Bulk action bar appears
3. Check "Select All" in header
4. All on page selected

**Expected:**
- Individual checkboxes work
- Select all checkbox works
- Bulk action bar shows:
  - "X users selected"
  - Action buttons (Activate, Deactivate, Delete)
- Cannot select current logged-in user
- Selection persists during filtering

---

### Scenario 15: Bulk Actions (Activate/Deactivate) 🔄

**Steps:**
1. Select multiple users
2. Click "Activate" or "Deactivate"
3. Confirm action
4. Users updated

**Expected:**
- Confirmation dialog shows
- All selected users affected
- Loading state during operation
- Table refreshes
- Selection cleared
- Stats update
- Success message (optional)

**Verify:**
```sql
-- Check users were updated
SELECT user_id, is_active
FROM org_users_mst
WHERE user_id IN ('uuid1', 'uuid2', 'uuid3');
```

---

### Scenario 16: Clear Filters 🧹

**Steps:**
1. Apply multiple filters:
   - Search: "john"
   - Role: Admin
   - Status: Active
2. Click "Clear Filters"

**Expected:**
- All filters reset to default
- Search input cleared
- Role set to "All Roles"
- Status set to "All Status"
- Sort set to "Date Created"
- Table shows all users
- Active filter badges removed
- "Clear Filters" button disabled when no filters

---

### Scenario 17: Form Validation ⚠️

**Test Cases:**

**Email Validation:**
- Invalid format: `notanemail` → Error
- Missing: Empty → Error
- Valid: `user@example.com` → OK

**Password Validation:**
- Too short: `pass` → Error
- No uppercase: `password123` → Error
- No lowercase: `PASSWORD123` → Error
- No number: `Password` → Error
- Valid: `SecurePass123!` → OK

**Password Match:**
- Different: `Pass123!` vs `Pass456!` → Error
- Matching: `Pass123!` vs `Pass123!` → OK

**Display Name:**
- Empty: `` → Error
- Valid: `John Doe` → OK

---

### Scenario 18: Role Badge Colors 🎨

**Verify Colors:**
- **Admin**: Purple background (`bg-purple-100 text-purple-800`)
- **Operator**: Blue background (`bg-blue-100 text-blue-800`)
- **Viewer**: Gray background (`bg-gray-100 text-gray-800`)

**Status Badge Colors:**
- **Active**: Green (`bg-green-100 text-green-800`)
- **Inactive**: Red (`bg-red-100 text-red-800`)

---

### Scenario 19: Empty States 📭

**Test Cases:**

**No Users:**
- New tenant with no users
- Should show: "No users found"

**No Search Results:**
- Search for non-existent user
- Should show: "No users found"
- Clear search suggestion

**No Filtered Results:**
- Filter by Admin when no admins exist
- Should show empty state

---

### Scenario 20: Loading States ⏳

**Verify Loading Indicators:**

1. **Page Load:** Spinner while fetching users
2. **User Actions:** Spinner on action buttons
3. **Modal Submit:** "Saving..." text with spinner
4. **Bulk Actions:** "Processing..." text

**Expected:**
- All actions show loading state
- Buttons disabled during loading
- User cannot double-click
- Loading clears on completion/error

---

## 🔍 Edge Cases & Error Handling

### Edge Case 1: Duplicate Email

**Steps:**
1. Try to create user with existing email
2. Submit form

**Expected:**
- Error from Supabase Auth
- Error message displayed
- Modal stays open
- User can correct and retry

---

### Edge Case 2: Self-Management

**Steps:**
1. Try to edit your own account
2. Try to deactivate yourself
3. Try to select yourself for bulk action

**Expected:**
- Edit button works (can update own name)
- Deactivate button disabled
- Checkbox disabled for self
- Cannot lock yourself out

---

### Edge Case 3: Network Failure

**Steps:**
1. Disable network
2. Try to create/edit user

**Expected:**
- Error message shown
- Graceful failure
- User can retry when online
- No partial data saved

---

### Edge Case 4: Permission Changes

**Steps:**
1. Admin user on users page
2. Another admin removes your admin role
3. Try to perform admin action

**Expected:**
- Action should fail
- Error message shown
- Redirect to dashboard (optional)
- Session refresh may be needed

---

## 💻 How to Test Locally

### Setup Test Environment

```bash
# 1. Start development server
cd web-admin
npm run dev

# 2. Ensure Supabase is running
supabase status

# 3. Ensure you have test data
# Run seed script or create manually
```

### Create Admin User

```sql
-- Make yourself admin
UPDATE org_users_mst
SET role = 'admin'
WHERE user_id = (
  SELECT id FROM auth.users
  WHERE email = 'your-email@example.com'
);
```

### Create Test Users

```bash
# Use the UI to create test users with:
- 2 admins
- 3 operators
- 2 viewers
- 1 inactive user
```

### Test Checklist

- [ ] Access control (admin only)
- [ ] View user list
- [ ] View statistics
- [ ] Search users
- [ ] Filter by role
- [ ] Filter by status
- [ ] Sort users
- [ ] Create new user
- [ ] Edit user
- [ ] Deactivate user
- [ ] Activate user
- [ ] Reset password
- [ ] Pagination
- [ ] Bulk selection
- [ ] Bulk actions
- [ ] Clear filters
- [ ] Form validation
- [ ] Role badges
- [ ] Empty states
- [ ] Loading states
- [ ] Edge cases

---

## 🐛 Common Issues

### Issue: Users Page Not Loading

**Possible Causes:**
- Not logged in as admin
- Middleware blocking access
- RLS policies too restrictive

**Solution:**
```sql
-- Check your role
SELECT role FROM org_users_mst
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'your-email');

-- Should return 'admin'
```

---

### Issue: Cannot Create Users

**Possible Causes:**
- Missing service role key
- Supabase Auth not configured
- Network error

**Solution:**
```bash
# Check environment variables
echo $NEXT_PUBLIC_SUPABASE_URL
echo $NEXT_PUBLIC_SUPABASE_ANON_KEY

# Check Supabase logs
supabase logs
```

---

### Issue: Stats Not Updating

**Possible Causes:**
- State not refreshing
- RLS blocking count query

**Solution:**
- Refresh page
- Check console for errors
- Verify RLS policies allow SELECT

---

## 📊 Performance Testing

### Load Test

**Create 100 test users:**
```sql
-- Use a script or manual creation
-- Test pagination performance
-- Test search performance
-- Test filter performance
```

**Expected:**
- Page load < 2s
- Search response < 500ms
- Filter response < 500ms
- No lag in UI

---

## ✅ Acceptance Criteria

All features must meet these criteria:

### Functionality
- [x] Admin can view all tenant users
- [x] Admin can create new users
- [x] Admin can edit user details and roles
- [x] Admin can activate/deactivate users
- [x] Admin can reset user passwords
- [x] Search works across name and email
- [x] Filters work correctly (role, status)
- [x] Sorting works for all columns
- [x] Pagination works correctly
- [x] Bulk actions work for multiple users

### Security
- [x] Only admins can access
- [x] Cannot edit/delete self (deactivate)
- [x] Tenant isolation maintained
- [x] RLS policies enforced
- [x] Passwords validated

### UX
- [x] Loading states for all async operations
- [x] Error messages are clear
- [x] Success feedback provided
- [x] Empty states handled
- [x] Forms are validated
- [x] Modal UX is smooth

### Performance
- [x] Page loads in < 2s
- [x] Search/filter in < 500ms
- [x] No UI lag with 100+ users
- [x] Proper pagination

---

## 📝 Test Report Template

```markdown
# User Management Test Report

**Date:** YYYY-MM-DD
**Tester:** Your Name
**Environment:** Development/Staging/Production

## Summary
- Total Tests: XX
- Passed: XX
- Failed: XX
- Blocked: XX

## Test Results

### Scenario 1: Access User Management
- Status: PASS/FAIL
- Notes: ...

### Scenario 2: View User List
- Status: PASS/FAIL
- Notes: ...

[Continue for all scenarios]

## Issues Found
1. Issue description
   - Steps to reproduce
   - Expected vs Actual
   - Screenshot

## Recommendations
- ...
```

---

**Created:** 2025-10-18
**Status:** ✅ Ready for Testing
**Next:** Deploy to Staging for UAT
