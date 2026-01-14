# Testing Guide: Settings HQ API Migration

## Prerequisites

### 1. Start Required Services

**Terminal 1: Start Supabase** (from cleanmatex project)

```powershell
cd F:\jhapp\cleanmatex
.\scripts\dev\start-services.ps1
# Wait for "Supabase API : OK (54321)"
```

**Terminal 2: Start Platform HQ API** (from cleanmatexsaas project)

```powershell
cd F:\jhapp\cleanmatexsaas\platform-api
npm run start:dev
# Should start on http://localhost:3002
# Verify: http://localhost:3002/api/hq/v1/health
```

**Terminal 3: Start cleanmatex web-admin**

```powershell
cd F:\jhapp\cleanmatex\web-admin
npm run dev
# Should start on http://localhost:3000
```

### 2. Configure Environment Variables

Create/update `F:\jhapp\cleanmatex\web-admin\.env.local`:

```env
# Existing variables...
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# NEW: Platform HQ API Configuration
HQ_API_URL=http://localhost:3002/api/hq/v1

# Optional: Service token for server-to-server auth
# Get this from platform-api .env or generate via HQ API auth
HQ_SERVICE_TOKEN=your-service-token-here
```

**To get HQ_SERVICE_TOKEN:**

1. Check `F:\jhapp\cleanmatexsaas\platform-api\.env.local` for `JWT_SECRET`
2. Or login to HQ API and use the returned token
3. Or use Supabase service role key (if HQ API accepts it)

### 3. Verify Services Are Running

```bash
# Check Supabase
curl http://localhost:54321/rest/v1/

# Check Platform HQ API
curl http://localhost:3002/api/hq/v1/health

# Check cleanmatex web-admin
curl http://localhost:3000/api/health  # if exists
```

## Testing Scenarios

### Scenario 1: Test Effective Settings Endpoint

**Test via Browser/Postman:**

```
GET http://localhost:3000/api/settings/tenants/me/effective
Headers:
  Authorization: Bearer <your-supabase-token>
```

**Test via curl:**

```bash
# First, get a Supabase auth token (login via your app)
# Then use it:
curl -X GET "http://localhost:3000/api/settings/tenants/me/effective" \
  -H "Authorization: Bearer YOUR_SUPABASE_TOKEN"
```

**Expected Response:**

```json
{
  "data": [
    {
      "stngCode": "workflow.max_concurrent_orders",
      "stngValue": 10,
      "stngSourceLayer": "SYSTEM_PROFILE",
      "stngSourceId": "GCC_OM_SME",
      "computedAt": "2026-01-08T12:00:00.000Z"
    },
    ...
  ]
}
```

**What to Verify:**

- ✅ Response format matches expected structure
- ✅ `stngCode`, `stngValue`, `stngSourceLayer`, `stngSourceId` are present
- ✅ No errors in console
- ✅ Response time is reasonable (< 2 seconds)

### Scenario 2: Test Explain Setting Endpoint

```bash
curl -X GET "http://localhost:3000/api/settings/tenants/me/explain/workflow.max_concurrent_orders?branchId=some-branch-id" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**

```json
{
  "settingCode": "workflow.max_concurrent_orders",
  "finalValue": 10,
  "finalSource": "SYSTEM_PROFILE",
  "layers": [
    {
      "layer": "SYSTEM_DEFAULT",
      "value": 5,
      "sourceId": "CATALOG",
      "applied": true
    },
    {
      "layer": "SYSTEM_PROFILE",
      "value": 10,
      "sourceId": "GCC_OM_SME",
      "applied": true,
      "reason": "INHERITED_FROM_GCC_OM_SME"
    }
  ],
  "inheritanceChain": [
    "GCC_OM_SME",
    "GCC_OM_MAIN",
    "GCC_MAIN_PROFILE",
    "GENERAL_MAIN_PROFILE"
  ],
  "computedAt": "2026-01-08T12:00:00.000Z"
}
```

### Scenario 3: Test Recompute Cache

```bash
curl -X POST "http://localhost:3000/api/settings/tenants/me/recompute" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**

```json
{
  "message": "Cache invalidated successfully"
}
```

### Scenario 4: Test Get Tenant Profile

```bash
curl -X GET "http://localhost:3000/api/settings/tenants/me/profile" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**

```json
{
  "stng_profile_code": "GCC_OM_SME",
  "stng_profile_name": "GCC Oman SME Profile",
  "stng_profile_version_applied": 1,
  "stng_profile_locked": false
}
```

### Scenario 5: Test Upsert Override

```bash
curl -X PATCH "http://localhost:3000/api/settings/tenants/me/overrides" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "settingCode": "workflow.max_concurrent_orders",
    "value": 20,
    "overrideReason": "Testing override"
  }'
```

**Expected Response:**

```json
{
  "message": "Override created/updated successfully"
}
```

### Scenario 6: Test Delete Override

```bash
curl -X DELETE "http://localhost:3000/api/settings/tenants/me/overrides/workflow.max_concurrent_orders?branchId=some-branch-id" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**

```json
{
  "message": "Override deleted successfully"
}
```

## Testing Authentication

### Test 1: Service Token Authentication

1. Set `HQ_SERVICE_TOKEN` in `.env.local`
2. Make request WITHOUT Authorization header:

```bash
curl -X GET "http://localhost:3000/api/settings/tenants/YOUR_TENANT_ID/effective"
```

3. Should work if service token is valid

### Test 2: Forwarded Client Token

1. Remove or comment out `HQ_SERVICE_TOKEN` in `.env.local`
2. Make request WITH Authorization header:

```bash
curl -X GET "http://localhost:3000/api/settings/tenants/me/effective" \
  -H "Authorization: Bearer YOUR_SUPABASE_TOKEN"
```

3. Should forward token to HQ API

### Test 3: Authentication Failure

1. Make request without token and without `HQ_SERVICE_TOKEN`:

```bash
curl -X GET "http://localhost:3000/api/settings/tenants/YOUR_TENANT_ID/effective"
```

2. Should return 401 with error message

## Testing via Frontend

### 1. Test Settings Page

1. Navigate to: `http://localhost:3000/dashboard/settings`
2. Verify settings load correctly
3. Check browser console for errors
4. Verify profile info card displays correctly

### 2. Test Explain Functionality

1. Click "Explain" button on any setting
2. Verify explain drawer opens
3. Verify resolution trace displays correctly
4. Check all layers are shown

### 3. Test Override Management

1. Try to override a setting value
2. Verify override is saved
3. Verify effective value changes
4. Try to delete override
5. Verify value reverts to inherited/default

## Debugging

### Check HQ API Logs

Watch Terminal 2 (Platform HQ API) for:

- Incoming requests
- Authentication errors
- Resolution errors

### Check cleanmatex Logs

Watch Terminal 3 (web-admin) for:

- API route errors
- HQ API client errors
- Response transformation issues

### Common Issues

#### Issue: "No authentication token available"

**Solution:**

- Set `HQ_SERVICE_TOKEN` in `.env.local`
- Or ensure requests include `Authorization` header

#### Issue: "Failed to fetch effective settings"

**Check:**

- HQ API is running: `curl http://localhost:3002/api/hq/v1/health`
- `HQ_API_URL` is correct in `.env.local`
- Network connectivity between services

#### Issue: "401 Unauthorized"

**Check:**

- Service token is valid (if using service token)
- Client token is valid (if forwarding token)
- HQ API JWT validation is working

#### Issue: Response format mismatch

**Check:**

- HQ API response structure matches expected format
- Response transformation in `hq-api-client.ts` is correct
- Compare HQ API direct response vs cleanmatex API response

### Verify HQ API Directly

Test HQ API endpoints directly to compare:

```bash
# Direct HQ API call
curl -X GET "http://localhost:3002/api/hq/v1/settings/tenants/YOUR_TENANT_ID/effective" \
  -H "Authorization: Bearer YOUR_HQ_API_TOKEN"

# Compare with cleanmatex proxy
curl -X GET "http://localhost:3000/api/settings/tenants/YOUR_TENANT_ID/effective" \
  -H "Authorization: Bearer YOUR_SUPABASE_TOKEN"
```

Both should return similar data (format may differ slightly due to transformation).

## Automated Testing Script

Create a test script `test-settings-api.js`:

```javascript
const API_BASE = "http://localhost:3000/api/settings";
const TENANT_ID = "your-tenant-id"; // Replace with actual tenant ID
const AUTH_TOKEN = "your-token"; // Replace with actual token

async function testEndpoint(name, method, url, body) {
  try {
    const options = {
      method,
      headers: {
        Authorization: `Bearer ${AUTH_TOKEN}`,
        "Content-Type": "application/json",
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE}${url}`, options);
    const data = await response.json();

    console.log(`✅ ${name}:`, response.status, response.statusText);
    console.log(
      "   Response:",
      JSON.stringify(data, null, 2).substring(0, 200)
    );
    return { success: response.ok, data };
  } catch (error) {
    console.error(`❌ ${name}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log("🧪 Testing Settings HQ API Migration\n");

  await testEndpoint(
    "Effective Settings",
    "GET",
    `/tenants/${TENANT_ID}/effective`
  );
  await testEndpoint(
    "Explain Setting",
    "GET",
    `/tenants/${TENANT_ID}/explain/workflow.max_concurrent_orders`
  );
  await testEndpoint("Get Profile", "GET", `/tenants/${TENANT_ID}/profile`);
  await testEndpoint(
    "Recompute Cache",
    "POST",
    `/tenants/${TENANT_ID}/recompute`
  );

  console.log("\n✅ All tests completed");
}

runTests();
```

Run with:

```bash
node test-settings-api.js
```

## Success Criteria

All tests pass when:

- ✅ All endpoints return expected response format
- ✅ No errors in console/logs
- ✅ Frontend displays settings correctly
- ✅ Authentication works (both service token and forwarded token)
- ✅ Error handling works (invalid tenant, missing token, etc.)
- ✅ Response times are acceptable (< 2 seconds)

## Next Steps After Testing

1. If all tests pass: Deploy to staging/production
2. If issues found: Check troubleshooting section above
3. Monitor production logs for any errors
4. Update documentation with any findings
