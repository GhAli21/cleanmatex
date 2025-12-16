# CleanMateX Authentication - User Guide

**For:** End Users & Administrators
**Version:** 1.0
**Last Updated:** 2025-10-18

---

## 🎯 Quick Start

### For New Users

1. **Sign Up**
   - Go to the registration page
   - Enter your full name and email
   - Create a secure password (min 8 characters with uppercase, lowercase, and number)
   - Accept terms and conditions
   - Click "Create Account"

2. **Verify Your Email**
   - Check your email inbox
   - Click the verification link
   - You'll be redirected to the login page

3. **Sign In**
   - Enter your email and password
   - Click "Sign in"
   - You'll be taken to your dashboard

### For Existing Users

1. **Login**
   - Visit `/login`
   - Enter your credentials
   - Click "Sign in"

2. **Forgot Password?**
   - Click "Forgot your password?" on login page
   - Enter your email
   - Check email for reset link
   - Click link and set new password

---

## 📖 Detailed Guides

### 1. Creating an Account

**Step-by-Step:**

1. **Navigate to Registration**
   - Click "Sign up" link from login page
   - Or go directly to `/register`

2. **Fill in Your Information**
   - **Full Name**: Your real name (displayed in the system)
   - **Email**: Your work or personal email (must be unique)
   - **Password**: Strong password following requirements:
     - At least 8 characters
     - One uppercase letter (A-Z)
     - One lowercase letter (a-z)
     - One number (0-9)
     - Special characters recommended but optional

3. **Password Tips**
   - ✅ Good: `LaundryPro2024!`
   - ❌ Bad: `password` (too simple)
   - ❌ Bad: `12345678` (no letters)

4. **Accept Terms**
   - Read and check the "I agree to Terms" checkbox
   - Review privacy policy if needed

5. **Submit**
   - Click "Create Account"
   - Wait for confirmation

6. **Verify Email**
   - Check your inbox for verification email
   - **Important**: Check spam folder if not received
   - Click the blue "Verify Email" button
   - You'll be redirected to login

---

### 2. Logging In

**Normal Login:**

1. Go to `/login`
2. Enter your registered email
3. Enter your password
4. (Optional) Check "Remember me" to stay logged in
5. Click "Sign in"

**First Time Login:**
- You'll see a quick tutorial (if configured)
- Dashboard will load with your tenant's data

**Multi-Tenant Users:**
- If you have access to multiple organizations:
  - You'll see a tenant selector in the header
  - Choose your active tenant
  - Dashboard updates to show that tenant's data

---

### 3. Resetting Your Password

**When You Forgot Your Password:**

1. **Request Reset**
   - Click "Forgot your password?" on login page
   - Enter your registered email
   - Click "Send Reset Link"

2. **Check Email**
   - Look for email with subject "Reset your password"
   - **Note**: Link expires in 1 hour for security
   - Check spam folder if not received

3. **Set New Password**
   - Click reset link in email
   - Enter new password (must meet requirements)
   - Confirm new password
   - Click "Reset Password"

4. **Login with New Password**
   - You'll be redirected to login
   - Use your new password to sign in

**Didn't Receive Email?**
- Wait 2-3 minutes (may be delayed)
- Check spam/junk folder
- Click "Resend" button
- Contact support if still not received

---

### 4. Email Verification

**Why Verify?**
- Proves you own the email address
- Enables password reset functionality
- Required for full account access

**Verification Process:**

1. **After Registration**
   - Automatic email sent immediately
   - Subject: "Confirm your email"

2. **Click Verification Link**
   - Link format: `verify-email?token=xxx`
   - Opens verification page
   - Automatic verification on page load

3. **Success**
   - Green checkmark displayed
   - "Email Verified!" message
   - Auto-redirect to login in 3 seconds

**Resend Verification:**
- If email expired or lost:
  - Go to `/verify-email`
  - Click "Resend" button
  - New email sent immediately

---

### 5. Password Security Best Practices

**Creating Strong Passwords:**

✅ **DO:**
- Use 12+ characters for extra security
- Mix uppercase and lowercase
- Include numbers and symbols
- Use unique password for this account
- Consider a password manager

❌ **DON'T:**
- Use common words or phrases
- Use personal info (birthdate, name)
- Reuse passwords from other sites
- Share your password
- Write it down in plain text

**Example Strong Passwords:**
- `CleanLaundry2024!`
- `MyBusiness#Secure99`
- `WashFold&Press456`

---

### 6. Multi-Tenant Access

**If You Work for Multiple Organizations:**

**Switching Tenants:**
1. Look for tenant selector in header
2. Click dropdown showing current tenant
3. Select different tenant from list
4. Page reloads with new tenant's data

**What Changes:**
- All data shown is for selected tenant
- Your role may differ per tenant
- Permissions apply to current tenant only

**Example:**
- You're **Admin** at "ABC Laundry"
- You're **Operator** at "XYZ Cleaners"
- Switch between them as needed

---

## 🔒 Security Features

### Account Protection

1. **Password Requirements**
   - Enforced complexity rules
   - Minimum length requirements
   - No common/weak passwords allowed

2. **Email Verification**
   - Confirms account ownership
   - Prevents fake accounts

3. **Session Management**
   - Automatic logout after inactivity
   - Token refresh for security
   - Secure cookie storage

4. **Failed Login Protection**
   - Account locked after 5 failed attempts
   - 15-minute cooldown period
   - Email notification of lockout

---

## 🆘 Troubleshooting

### Can't Login

**"Invalid email or password"**
- ✅ Check email spelling
- ✅ Check caps lock is off
- ✅ Try password reset
- ✅ Ensure email is verified

**"Account locked"**
- Wait 15 minutes
- Check email for lockout notification
- Use password reset to unlock
- Contact admin if persists

### Email Issues

**Verification Email Not Received**
1. Wait 5 minutes
2. Check spam/junk folder
3. Add noreply@cleanmatex.com to contacts
4. Click "Resend" button
5. Try different email if persists

**Reset Email Not Received**
- Same steps as verification email
- Ensure you're using registered email
- Check account isn't locked

### Password Reset Issues

**"Invalid Reset Link"**
- Link expired (1-hour limit)
- Request new reset email
- Don't reuse old links

**Can't Set New Password**
- Check password requirements
- Ensure passwords match
- Try different browser if persists

---

## 📱 Browser Compatibility

**Supported Browsers:**
- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)

**Mobile Browsers:**
- ✅ iOS Safari
- ✅ Android Chrome
- ✅ Mobile Firefox

**Not Supported:**
- ❌ Internet Explorer
- ❌ Very old browser versions

---

## ⌨️ Keyboard Shortcuts

**Login Page:**
- `Tab` - Move between fields
- `Enter` - Submit form
- `Shift+Tab` - Move backward

**All Forms:**
- `Ctrl+A` (in field) - Select all
- `Ctrl+C` - Copy
- `Ctrl+V` - Paste

---

## 🌍 Language Support

**Currently Available:**
- English (EN) - Default
- Arabic (AR) - Coming soon

**Switching Language:**
- Language selector in footer/header
- Preference saved to your profile
- RTL support for Arabic

---

## 📞 Getting Help

### Self-Service

1. **Check This Guide**
   - Most common questions covered

2. **Troubleshooting Section**
   - Common issues and solutions

3. **FAQ** (if available)
   - Quick answers to frequent questions

### Contact Support

**If You Still Need Help:**

1. **Email Support**
   - support@cleanmatex.com
   - Include: your email, issue description, screenshots

2. **Live Chat** (if available)
   - Click chat icon in dashboard
   - Available during business hours

3. **Admin Users**
   - Contact your organization's admin
   - They can reset passwords, unlock accounts

---

## 📊 Account Status

**Check Your Account Status:**

1. **Email Verified**
   - ✅ Green checkmark in profile
   - ❌ Red warning if not verified

2. **Active Session**
   - Shows in user menu
   - Displays last login time

3. **Multi-Tenant Access**
   - Number of organizations shown
   - List available in tenant selector

---

## 🔐 Privacy & Data

**Your Data:**
- Email address (required)
- Display name (required)
- Password (encrypted, never visible)
- Login history (for security)

**We Never:**
- ❌ Share your password
- ❌ Send password in email
- ❌ Store password in plain text
- ❌ Sell your data

**You Control:**
- ✅ Update your name
- ✅ Change your password
- ✅ Request account deletion
- ✅ Export your data

---

## 📝 Tips & Best Practices

### For Security

1. **Use Strong Passwords**
   - Different from other sites
   - Change periodically (every 90 days)

2. **Verify Your Email**
   - Do it immediately after registration
   - Keeps account secure

3. **Logout When Done**
   - Especially on shared computers
   - Click user menu → Logout

4. **Don't Share Credentials**
   - Each person should have own account
   - Admins can create multiple users

### For Efficiency

1. **Use Remember Me**
   - On trusted devices only
   - Saves time on repeat visits

2. **Bookmark Dashboard**
   - Quick access to work
   - Skip login page

3. **Keep Email Updated**
   - Ensure you receive important notices
   - Update in profile if changed

---

## 🆕 What's New

**Recent Updates:**

**v1.0 (2025-10-18)**
- ✨ Complete registration flow
- ✨ Email verification
- ✨ Password reset
- ✨ Multi-tenant support
- ✨ Improved security

**Coming Soon:**
- 🔜 Two-factor authentication (2FA)
- 🔜 Social login (Google, Microsoft)
- 🔜 Biometric authentication
- 🔜 Advanced audit logs

---

## 📚 Related Documentation

**For Administrators:**
- [Admin Guide](./ADMIN_GUIDE.md) - User management
- [Security Guide](./SECURITY.md) - Best practices

**For Developers:**
- [Testing Guide](./auth-pages-testing-guide.md) - Test scenarios
- [API Documentation](./API.md) - Integration guide

---

**Questions?** Contact support@cleanmatex.com
**Documentation:** https://docs.cleanmatex.com
**Status:** https://status.cleanmatex.com
