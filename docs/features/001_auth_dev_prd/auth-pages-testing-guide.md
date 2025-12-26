# Authentication Pages - Testing Guide

**Feature:** User Authentication (PRD-001)
**Module:** Auth Pages
**Created:** 2025-10-18
**Status:** Complete

---

## 📋 Overview

This guide provides step-by-step testing scenarios for all authentication pages in CleanMateX web admin.

### Pages Covered
1. [Login Page](#1-login-page) - `/login`
2. [Registration Page](#2-registration-page) - `/register`
3. [Forgot Password Page](#3-forgot-password-page) - `/forgot-password`
4. [Reset Password Page](#4-reset-password-page) - `/reset-password`
5. [Email Verification Page](#5-email-verification-page) - `/verify-email`

---

## 1. Login Page

**Location:** `web-admin/app/(auth)/login/page.tsx`
**Route:** `/login`

### Features
- Email and password login
- Show/hide password toggle
- Remember me checkbox
- Forgot password link
- Sign up link
- Form validation
- Error handling
- Loading states

### Test Scenarios

#### ✅ Scenario 1.1: Successful Login

**Steps:**
1. Navigate to `http://localhost:3000/login`
2. Enter valid credentials:
   - Email: `admin@demo.cleanmatex.com`
   - Password: `Demo123!`
3. Click "Sign in"

**Expected Result:**
- Loading spinner appears
- User is redirected to `/dashboard`
- Session is established
- Tenant context is loaded

**Verification:**
```bash
# Check browser console for:
# - No errors
# - JWT token in cookies
# - User state in AuthContext
```

---

#### ❌ Scenario 1.2: Invalid Credentials

**Steps:**
1. Navigate to `/login`
2. Enter invalid credentials:
   - Email: `wrong@example.com`
   - Password: `WrongPassword123`
3. Click "Sign in"

**Expected Result:**
- Red error banner appears
- Message: "Invalid email or password. Please try again."
- Form remains filled
- User stays on login page

---

#### ⚠️ Scenario 1.3: Validation Errors

**Steps:**
1. Navigate to `/login`
2. Enter invalid email: `notanemail`
3. Leave password empty
4. Click "Sign in"

**Expected Result:**
- Email field shows: "Please enter a valid email address"
- Password field shows: "Password is required"
- Submit button is disabled or validation prevents submission

---

#### 🔄 Scenario 1.4: Password Toggle

**Steps:**
1. Navigate to `/login`
2. Enter password: `MyPassword123`
3. Click eye icon in password field

**Expected Result:**
- Password becomes visible as plain text
- Eye icon changes to "eye-off" icon
- Click again to hide password

---

#### 🔗 Scenario 1.5: Navigation Links

**Steps:**
1. Navigate to `/login`
2. Test all links:
   - "Forgot your password?" → `/forgot-password`
   - "Sign up" → `/register`

**Expected Result:**
- All links navigate to correct pages
- No errors in console

---

## 2. Registration Page

**Location:** `web-admin/app/(auth)/register/page.tsx`
**Route:** `/register`

### Features
- Full name, email, password, confirm password fields
- Password strength validation
- Show/hide password toggles
- Terms & conditions checkbox
- Email verification flow
- Success state with instructions

### Test Scenarios

#### ✅ Scenario 2.1: Successful Registration

**Steps:**
1. Navigate to `http://localhost:3000/register`
2. Fill in the form:
   - Full Name: `John Doe`
   - Email: `john.doe@example.com`
   - Password: `SecurePass123!`
   - Confirm Password: `SecurePass123!`
3. Check "I agree to Terms" checkbox
4. Click "Create Account"

**Expected Result:**
- Loading state appears
- Success screen displays with:
  - Green checkmark icon
  - "Registration Successful!" message
  - Email address confirmation
  - Next steps instructions
- Email verification sent to user

**Verification:**
```bash
# Check Supabase logs:
supabase logs

# Check for:
# - User created in auth.users
# - Verification email sent
# - No errors in console
```

---

#### ❌ Scenario 2.2: Email Already Exists

**Steps:**
1. Navigate to `/register`
2. Enter email that's already registered
3. Fill other fields correctly
4. Click "Create Account"

**Expected Result:**
- Error message: "User already registered"
- Form stays filled
- User remains on registration page

---

#### ⚠️ Scenario 2.3: Password Requirements Not Met

**Steps:**
1. Navigate to `/register`
2. Enter weak password: `weak`
3. Try to submit

**Expected Result:**
- Red error under password field
- Message includes all unmet requirements:
  - "Password must be at least 8 characters"
  - "Password must contain at least one uppercase letter"
  - "Password must contain at least one number"

---

#### ⚠️ Scenario 2.4: Password Mismatch

**Steps:**
1. Navigate to `/register`
2. Password: `SecurePass123!`
3. Confirm Password: `SecurePass456!`
4. Click "Create Account"

**Expected Result:**
- Red error under confirm password field
- Message: "Passwords do not match"

---

#### 🔄 Scenario 2.5: Password Visibility Toggle

**Steps:**
1. Navigate to `/register`
2. Enter password in both fields
3. Toggle visibility on each field

**Expected Result:**
- Each field can be independently shown/hidden
- Icons update correctly
- Password remains in field during toggle

---

#### 📧 Scenario 2.6: Verification Email Flow

**Steps:**
1. Complete registration successfully
2. Check email inbox (or Mailpit if using Supabase local)
3. Click verification link in email

**Expected Result:**
- Email received with subject: "Confirm your email"
- Link format: `/verify-email?token=xxx&type=signup`
- Clicking link redirects to verification page

**Check Mailpit (Supabase Local):**
```bash
# Open browser to:
http://localhost:54324

# View sent emails
# Find verification email
# Copy verification link
```

---

## 3. Forgot Password Page

**Location:** `web-admin/app/(auth)/forgot-password/page.tsx`
**Route:** `/forgot-password`

### Features
- Email input
- Reset email sending
- Success state with instructions
- Resend option
- Help text

### Test Scenarios

#### ✅ Scenario 3.1: Successful Password Reset Request

**Steps:**
1. Navigate to `http://localhost:3000/forgot-password`
2. Enter email: `admin@demo.cleanmatex.com`
3. Click "Send Reset Link"

**Expected Result:**
- Loading state appears
- Success screen displays:
  - Green email icon
  - "Check your email" message
  - Email address confirmation
  - Next steps instructions
  - Warning about 1-hour expiry

**Verification:**
```bash
# Check Mailpit:
# http://localhost:54324
#
# Look for email with subject: "Reset your password"
# Verify link format: /reset-password?token=xxx&type=recovery
```

---

#### ❌ Scenario 3.2: Invalid Email Format

**Steps:**
1. Navigate to `/forgot-password`
2. Enter invalid email: `notanemail`
3. Click "Send Reset Link"

**Expected Result:**
- Red error under email field
- Message: "Please enter a valid email address"
- Submit prevented

---

#### ⚠️ Scenario 3.3: Email Not Found (Security)

**Steps:**
1. Navigate to `/forgot-password`
2. Enter non-existent email: `doesnotexist@example.com`
3. Click "Send Reset Link"

**Expected Result:**
- **Same success message appears** (security best practice)
- Message: "Password reset email sent if account exists"
- This prevents email enumeration attacks

---

#### 🔄 Scenario 3.4: Resend from Success Screen

**Steps:**
1. Complete password reset request
2. On success screen, click "try again" link
3. Form reappears with email pre-filled

**Expected Result:**
- Return to form view
- Email field populated with previous email
- Can submit again

---

## 4. Reset Password Page

**Location:** `web-admin/app/(auth)/reset-password/page.tsx`
**Route:** `/reset-password?token=xxx&type=recovery`

### Features
- Token validation
- New password and confirm password fields
- Password strength validation
- Show/hide toggles
- Success state with auto-redirect
- Invalid/expired token handling

### Test Scenarios

#### ✅ Scenario 4.1: Successful Password Reset

**Prerequisites:**
- Valid reset token from forgot password flow

**Steps:**
1. Click reset link from email
2. Enter new password: `NewSecure123!`
3. Confirm password: `NewSecure123!`
4. Click "Reset Password"

**Expected Result:**
- Loading state appears
- Success screen displays:
  - Green checkmark
  - "Password Reset Successful!" message
  - Auto-redirect countdown
- After 3 seconds, redirects to `/login`
- User can now login with new password

**Verification:**
```bash
# Test login with new password
# Should work successfully
```

---

#### ❌ Scenario 4.2: Invalid/Expired Token

**Steps:**
1. Navigate to `/reset-password?token=invalid&type=recovery`
2. Or use a token that's > 1 hour old

**Expected Result:**
- Error screen displays:
  - Red X icon
  - "Invalid Reset Link" message
  - Explanation about expiry
  - Options to:
    - "Request New Link" → `/forgot-password`
    - "Back to Login" → `/login`

---

#### ⚠️ Scenario 4.3: Password Requirements Not Met

**Steps:**
1. Access page with valid token
2. Enter weak password: `weak`
3. Click "Reset Password"

**Expected Result:**
- Red error under password field
- Lists all unmet requirements
- Submit prevented

---

#### ⚠️ Scenario 4.4: Password Mismatch

**Steps:**
1. Access page with valid token
2. New Password: `NewSecure123!`
3. Confirm Password: `Different123!`
4. Click "Reset Password"

**Expected Result:**
- Red error under confirm password
- Message: "Passwords do not match"

---

#### 🔄 Scenario 4.5: Missing Token Parameter

**Steps:**
1. Navigate to `/reset-password` (no token in URL)

**Expected Result:**
- Invalid token screen appears immediately
- Same as expired token scenario

---

## 5. Email Verification Page

**Location:** `web-admin/app/(auth)/verify-email/page.tsx`
**Route:** `/verify-email?token=xxx&type=signup`

### Features
- Token verification
- Success/error states
- Resend verification email
- Loading states
- Auto-redirect after success

### Test Scenarios

#### ✅ Scenario 5.1: Successful Email Verification

**Prerequisites:**
- Complete registration
- Have verification token from email

**Steps:**
1. Click verification link from registration email
2. Wait for verification process

**Expected Result:**
- Loading spinner appears briefly
- Success screen displays:
  - Green checkmark
  - "Email Verified!" message
  - Success confirmation
- Auto-redirects to `/login?verified=true` after 3 seconds

**Verification:**
```bash
# Check Supabase database:
# User email_confirmed_at should be set
# User should be able to login
```

---

#### ❌ Scenario 5.2: Invalid Verification Token

**Steps:**
1. Navigate to `/verify-email?token=invalid&type=signup`

**Expected Result:**
- Error screen displays:
  - Red X icon
  - "Verification Failed" message
  - Error details
  - Options:
    - "Resend Verification Email"
    - "Back to Login"

---

#### 📧 Scenario 5.3: Resend Verification Email

**Steps:**
1. On verification page (or error state)
2. Ensure email is populated (from URL or storage)
3. Click "Resend" button

**Expected Result:**
- Green success banner appears
- Message: "Verification email sent successfully! Check your inbox."
- New email sent to user
- Banner disappears after 5 seconds

---

#### ⚠️ Scenario 5.4: Already Verified Token

**Steps:**
1. Use a verification link that was already used
2. Click link again

**Expected Result:**
- Error message: "Email already verified" or similar
- Option to go to login

---

#### 🔄 Scenario 5.5: Default View (No Token)

**Steps:**
1. Navigate to `/verify-email` without token
2. Or navigate after registration

**Expected Result:**
- Shows verification notice:
  - Blue email icon
  - "Verify your email" heading
  - Instructions for next steps
  - "Didn't receive email?" with resend button
  - Link back to login

---

## 🔧 Development Testing Tools

### 1. Supabase Local Email Testing

```bash
# Start Supabase local
supabase start

# Open Mailpit to view emails
# http://localhost:54324

# All verification and reset emails appear here
```

### 2. Check Auth State

```javascript
// In browser console:
const { data: { session } } = await supabase.auth.getSession()
console.log('Session:', session)
console.log('User:', session?.user)
```

### 3. Check Database

```bash
# Connect to database
psql postgresql://postgres:postgres@localhost:54322/postgres

# Check users
SELECT email, email_confirmed_at, created_at FROM auth.users;

# Check user-tenant associations
SELECT u.email, ou.role, t.name as tenant_name
FROM auth.users u
JOIN org_users_mst ou ON u.id = ou.user_id
JOIN org_tenants_mst t ON ou.tenant_org_id = t.id;
```

### 4. Test RLS Policies

```sql
-- Set JWT context (simulates authenticated user)
SET LOCAL request.jwt.claims = '{"sub": "user-uuid", "tenant_org_id": "tenant-uuid", "role": "admin"}';

-- Test query
SELECT * FROM org_users_mst;
-- Should only return users from specified tenant
```

---

## 🐛 Common Issues & Troubleshooting

### Issue 1: "Invalid email or password" on Valid Credentials

**Possible Causes:**
- Email not verified yet
- User not linked to any tenant
- RLS blocking the query

**Debug Steps:**
```sql
-- Check if user exists
SELECT email, email_confirmed_at FROM auth.users WHERE email = 'user@example.com';

-- Check tenant associations
SELECT * FROM org_users_mst WHERE user_id = 'user-uuid';
```

**Solution:**
- Verify email first
- Ensure user has org_users_mst record
- Check RLS policies

---

### Issue 2: Verification Email Not Received

**Possible Causes:**
- SMTP not configured
- Using Supabase local without Mailpit
- Email in spam

**Debug Steps:**
```bash
# Check Supabase logs
supabase logs

# Check Mailpit (local development)
# http://localhost:54324
```

**Solution:**
- For local dev, use Mailpit
- For production, configure SMTP in Supabase dashboard

---

### Issue 3: "Token expired" on Reset Password

**Cause:**
- Reset tokens expire after 1 hour

**Solution:**
- Request new reset email
- Update token expiry in Supabase settings if needed

---

### Issue 4: Redirect Loop

**Possible Causes:**
- Middleware redirecting authenticated users
- Missing tenant context
- Session not properly set

**Debug Steps:**
```javascript
// Check auth state
const { data: { session } } = await supabase.auth.getSession()
console.log('Session:', session)
console.log('Tenant:', session?.user?.user_metadata?.tenant_org_id)
```

**Solution:**
- Clear cookies and re-login
- Check middleware logic
- Ensure tenant context is set

---

## 📊 Test Coverage Checklist

### Login Page
- [x] Valid login succeeds
- [x] Invalid credentials show error
- [x] Empty fields show validation
- [x] Password toggle works
- [x] Links navigate correctly
- [ ] Remember me persists session
- [ ] Account lockout after 5 failed attempts

### Registration Page
- [x] Valid registration succeeds
- [x] Duplicate email shows error
- [x] Password requirements validated
- [x] Password mismatch detected
- [x] Terms checkbox required
- [x] Success state displays
- [x] Verification email sent

### Forgot Password Page
- [x] Valid email sends reset link
- [x] Invalid email shows validation
- [x] Non-existent email shows generic message (security)
- [x] Success state displays
- [x] Resend option works

### Reset Password Page
- [x] Valid token allows reset
- [x] Invalid/expired token shows error
- [x] Password requirements validated
- [x] Password mismatch detected
- [x] Success redirects to login
- [x] Can login with new password

### Email Verification Page
- [x] Valid token verifies email
- [x] Invalid token shows error
- [x] Already verified shows appropriate message
- [x] Resend email works
- [x] Success redirects to login
- [x] Default view shows instructions

---

## 🚀 Next Steps

After testing all auth pages:

1. **Test Multi-Tenant Scenarios**
   - User with multiple tenants
   - Tenant switching
   - Cross-tenant isolation

2. **Test Edge Cases**
   - Network failures
   - Concurrent sessions
   - Token refresh

3. **Performance Testing**
   - Login response time < 500ms
   - Token refresh < 200ms

4. **Security Testing**
   - XSS attempts
   - SQL injection
   - CSRF protection

5. **Accessibility Testing**
   - Keyboard navigation
   - Screen reader compatibility
   - ARIA labels

---

## 📝 Report Issues

If you find bugs or issues during testing:

1. **Document the issue:**
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots/console logs

2. **Check existing issues:**
   - `docs/troubleshooting.md`
   - `docs/common_issues.md`

3. **Report new issues:**
   - Create issue in project tracker
   - Tag as `bug`, `auth`, `PRD-001`

---

**Last Updated:** 2025-10-18
**Tested By:** Development Team
**Next Review:** After middleware implementation
