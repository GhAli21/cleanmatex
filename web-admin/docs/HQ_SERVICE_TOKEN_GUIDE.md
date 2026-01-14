# HQ_SERVICE_TOKEN Guide

## What is HQ_SERVICE_TOKEN?

`HQ_SERVICE_TOKEN` is a JWT token used for server-to-server authentication between `cleanmatex/web-admin` and `cleanmatexsaas/platform-api`. It allows Next.js API routes to authenticate with the Platform HQ API without requiring a user's client token.

## How to Get HQ_SERVICE_TOKEN

### Option 1: Login to HQ API (Recommended for Testing)

**Step 1: Login to Platform HQ API**

```bash
curl -X POST http://localhost:3002/api/hq/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@cleanmatex.com",
    "password": "Admin@123"
  }'
```

**Step 2: Copy the `access_token` from response**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1YmQxYTk3Yy1mMGFmLTRiNjctYjYwMC1lM2UyZWM2NDYxZTEiLCJlbWFpbCI6ImFkbWluQGNsZWFubWF0ZXguY29tIiwicm9sZSI6InN1cGVyX2FkbWluIiwicGVybWlzc2lvbnMiOltdLCJpYXQiOjE3MzYzODQ5MjAsImV4cCI6MTczNzc4MDkyMH0.xxxxxxxxxxxx",
  "user": {
    "id": "5bd1a97c-f0af-4b67-b600-e3e2ec6461e1",
    "email": "admin@cleanmatex.com",
    ...
  }
}
```

**Step 3: Use the token in `.env.local`**

```env
HQ_SERVICE_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1YmQxYTk3Yy1mMGFmLTRiNjctYjYwMC1lM2UyZWM2NDYxZTEiLCJlbWFpbCI6ImFkbWluQGNsZWFubWF0ZXguY29tIiwicm9sZSI6InN1cGVyX2FkbWluIiwicGVybWlzc2lvbnMiOltdLCJpYXQiOjE3MzYzODQ5MjAsImV4cCI6MTczNzc4MDkyMH0.xxxxxxxxxxxx
```

**Note:** This token expires after 15 days (default). You'll need to refresh it periodically.

### Option 2: Generate Long-Lived Service Token (For Production)

Create a script to generate a service token that doesn't expire (or has very long expiration):

**File: `platform-api/scripts/generate-service-token.ts`**

```typescript
import * as jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-jwt-secret-here";
const SERVICE_USER_ID = "service-account-user-id"; // Create a service account user in hq_users

const payload = {
  sub: SERVICE_USER_ID,
  email: "service@cleanmatex.com",
  role: "service_account",
  permissions: ["settings:read", "settings:resolve"],
};

// Generate token with 1 year expiration (or no expiration)
const token = jwt.sign(payload, JWT_SECRET, {
  expiresIn: "365d", // 1 year
  // Or use: expiresIn: false for no expiration (not recommended)
});

console.log("Service Token:");
console.log(token);
```

Run:

```bash
cd platform-api
ts-node scripts/generate-service-token.ts
```

### Option 3: Use Existing HQ User Token

If you already have an HQ user account:

1. Login via Platform HQ Console (`http://localhost:3001`)
2. Open browser DevTools → Application → Local Storage
3. Find `access_token` value
4. Copy and use as `HQ_SERVICE_TOKEN`

## Example Values

### Example 1: Valid JWT Token Format

```
HQ_SERVICE_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1YmQxYTk3Yy1mMGFmLTRiNjctYjYwMC1lM2UyZWM2NDYxZTEiLCJlbWFpbCI6ImFkbWluQGNsZWFubWF0ZXguY29tIiwicm9sZSI6InN1cGVyX2FkbWluIiwicGVybWlzc2lvbnMiOltdLCJpYXQiOjE3MzYzODQ5MjAsImV4cCI6MTczNzc4MDkyMH0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

**Format:** `eyJ...` (Base64 encoded JWT with 3 parts: header.payload.signature)

### Example 2: Testing Without Token (Using Forwarded Client Token)

If you don't set `HQ_SERVICE_TOKEN`, the API routes will try to forward the client's `Authorization` header:

```env
# .env.local
HQ_API_URL=http://localhost:3002/api/hq/v1
# HQ_SERVICE_TOKEN=  # Commented out or not set
```

Then make requests with client token:

```bash
curl http://localhost:3000/api/settings/tenants/me/effective \
  -H "Authorization: Bearer YOUR_SUPABASE_CLIENT_TOKEN"
```

## Token Structure

The JWT token contains:

```json
{
  "sub": "user-id-uuid", // Required: User ID
  "email": "admin@cleanmatex.com", // Optional: User email
  "role": "super_admin", // Optional: User role
  "permissions": [], // Optional: Permissions array
  "iat": 1736384920, // Issued at timestamp
  "exp": 1737780920 // Expiration timestamp
}
```

## Verification

### Test if Token Works

```bash
# Test HQ API directly with token
curl -X GET "http://localhost:3002/api/hq/v1/settings/tenants/YOUR_TENANT_ID/effective" \
  -H "Authorization: Bearer YOUR_SERVICE_TOKEN"

# Should return settings data, not 401 Unauthorized
```

### Decode Token (for debugging)

Use https://jwt.io to decode and inspect the token:

1. Paste your token
2. Check expiration (`exp` field)
3. Verify payload structure

## Security Notes

1. **Never commit tokens to Git** - Always use `.env.local` (which is gitignored)
2. **Rotate tokens regularly** - Especially in production
3. **Use service accounts** - Create dedicated service account users for production
4. **Limit permissions** - Service accounts should only have necessary permissions
5. **Monitor token usage** - Log when service tokens are used

## Troubleshooting

### Token Expired

**Error:** `401 Unauthorized` or `Token expired`

**Solution:**

- Login again to get new token
- Or generate new service token with longer expiration

### Invalid Token Format

**Error:** `Invalid token` or `jwt malformed`

**Solution:**

- Ensure token starts with `eyJ`
- Check for extra spaces or quotes
- Verify token is complete (has 3 parts separated by dots)

### Token Missing Required Fields

**Error:** `Invalid token payload` or `JWT payload missing user ID`

**Solution:**

- Token must have `sub` field (user ID)
- Ensure token was generated by HQ API auth service

## Quick Test Script

```bash
# Get token
TOKEN=$(curl -s -X POST http://localhost:3002/api/hq/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@cleanmatex.com","password":"Admin@123"}' \
  | jq -r '.access_token')

echo "Token: $TOKEN"

# Test token
curl -X GET "http://localhost:3002/api/hq/v1/settings/tenants/YOUR_TENANT_ID/effective" \
  -H "Authorization: Bearer $TOKEN"
```
