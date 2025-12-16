# Supabase Auth Configuration for CleanMateX

**Last Updated:** 2025-10-17
**Purpose:** Guide for configuring Supabase Authentication for CleanMateX

---

## 🔧 Local Development Setup

### 1. Access Supabase Studio

Open: http://127.0.0.1:54323

### 2. Configure Email Settings

**Path:** Authentication → Settings → Email

```yaml
Site URL: http://localhost:3000
Redirect URLs:
  - http://localhost:3000/auth/callback
  - http://localhost:3000/auth/confirm

Email Templates:
  - Confirm Signup
  - Reset Password
  - Magic Link
  - Invite User
```

### 3. JWT Settings

**Path:** Settings → API

```yaml
JWT Expiry: 3600 (1 hour)
Refresh Token Rotation: Enabled
Reuse Interval: 10 seconds
```

### 4. Password Requirements

**Path:** Authentication → Settings → Policies

```yaml
Minimum Password Length: 8
Require Uppercase: Yes
Require Lowercase: Yes
Require Numbers: Yes
Require Special Characters: No (optional)
```

---

## 📧 Email Templates

### Confirm Signup Template

**Subject:** Confirm your CleanMateX account

**Body:**
```html
<h2>Welcome to CleanMateX!</h2>
<p>Click the link below to confirm your email address:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm Email</a></p>
<p>If you didn't create an account, you can safely ignore this email.</p>
<p>This link will expire in 24 hours.</p>
```

### Reset Password Template

**Subject:** Reset your CleanMateX password

**Body:**
```html
<h2>Reset Your Password</h2>
<p>Click the link below to reset your password:</p>
<p><a href="{{ .ConfirmationURL }}">Reset Password</a></p>
<p>If you didn't request a password reset, you can safely ignore this email.</p>
<p>This link will expire in 1 hour.</p>
```

### Invite User Template

**Subject:** You've been invited to CleanMateX

**Body:**
```html
<h2>You're Invited!</h2>
<p>{{ .InviterEmail }} has invited you to join {{ .OrganizationName }} on CleanMateX.</p>
<p>Click the link below to accept the invitation:</p>
<p><a href="{{ .ConfirmationURL }}">Accept Invitation</a></p>
<p>This link will expire in 7 days.</p>
```

---

## 🔐 Custom JWT Claims

We need to add `tenant_org_id` to JWT tokens for RLS filtering.

### Option 1: Database Trigger (Recommended for Local)

Create a trigger to add custom claims after signup:

```sql
-- This will be implemented via Supabase Edge Functions in production
-- For local development, we'll handle this in application code
```

### Option 2: Application Code (Current Implementation)

The frontend will call `switch_tenant_context()` after login to set the active tenant.

---

## 🚀 Production Configuration

### 1. SMTP Settings

**Path:** Settings → Email → SMTP

```yaml
Provider: SendGrid / AWS SES / Custom
SMTP Host: smtp.sendgrid.net
SMTP Port: 587
SMTP Username: apikey
SMTP Password: [Your SendGrid API Key]
Sender Email: noreply@cleanmatex.com
Sender Name: CleanMateX
```

### 2. Production URLs

```yaml
Site URL: https://app.cleanmatex.com
Redirect URLs:
  - https://app.cleanmatex.com/auth/callback
  - https://app.cleanmatex.com/auth/confirm
  - https://app.cleanmatex.com/auth/reset-password
```

### 3. Security Settings

```yaml
Rate Limiting:
  - Signup: 10 requests per hour per IP
  - Login: 20 requests per hour per IP
  - Password Reset: 5 requests per hour per email

Session Management:
  - Max Sessions Per User: 5
  - Session Timeout: 7 days (refresh token)
  - Absolute Timeout: 30 days

Email Verification:
  - Required: Yes
  - Grace Period: 7 days (can login but limited access)
```

---

## 🧪 Testing Email Locally

### Using Inbucket (Built-in with Supabase)

Access: http://127.0.0.1:54324

All emails sent in local development will appear in Inbucket.

### Manual Testing Steps

1. Create a test user in Supabase Studio
2. Navigate to Inbucket
3. Find the confirmation email
4. Copy the confirmation link
5. Open in browser to complete signup

---

## 🔑 Environment Variables

### Development (.env.local)

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key-from-supabase-start>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# Auth Configuration
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_AUTH_REDIRECT_URL=http://localhost:3000/auth/callback
```

### Production (.env.production)

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-production-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-production-service-role-key>

# Auth Configuration
NEXT_PUBLIC_SITE_URL=https://app.cleanmatex.com
NEXT_PUBLIC_AUTH_REDIRECT_URL=https://app.cleanmatex.com/auth/callback
```

---

## 📱 OAuth Providers (Future)

### Google OAuth
- Client ID: TBD
- Client Secret: TBD
- Redirect URI: `{site_url}/auth/callback`

### Apple OAuth (for Mobile)
- Service ID: TBD
- Team ID: TBD
- Key ID: TBD

---

## 🐛 Troubleshooting

### Issue: Emails not sending

**Solution:**
- Check Inbucket: http://127.0.0.1:54324
- Verify SMTP settings in Supabase Studio
- Check Supabase logs: `supabase logs`

### Issue: JWT claims missing tenant_org_id

**Solution:**
- Ensure user is linked to tenant in `org_users_mst`
- Call `switch_tenant_context()` after login
- Verify JWT token in browser DevTools → Application → Local Storage

### Issue: RLS blocking queries

**Solution:**
- Verify user has record in `org_users_mst`
- Check `tenant_org_id` in JWT claims
- Use service role key for admin operations (server-side only)

---

## 📚 References

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [JWT Claims](https://supabase.com/docs/guides/auth/jwts)
- [Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [RLS Policies](https://supabase.com/docs/guides/auth/row-level-security)

---

**Status:** Configuration guide complete. Apply settings via Supabase Studio.
