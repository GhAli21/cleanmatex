/**
 * Quick Test Script for Settings HQ API Migration
 * 
 * Usage:
 *   1. Set TENANT_ID and AUTH_TOKEN below
 *   2. Ensure all services are running (Supabase, HQ API, web-admin)
 *   3. Run: node scripts/test-settings-hq-api.js
 */

const API_BASE = process.env.TEST_API_BASE || 'http://localhost:3000/api/settings';
const TENANT_ID = process.env.TEST_TENANT_ID || '11111111-1111-1111-1111-111111111111' || 'me'; // Use 'me' or actual tenant ID
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OTcwMmZkOS1mY2E3LTQ1ODUtYjdkNy01YzllN2EwYzc4YjkiLCJlbWFpbCI6ImFkbWluQGNsZWFubWF0ZXguY29tIiwicm9sZSI6IlNVUEVSX0FETUlOIiwicGVybWlzc2lvbnMiOlsiKiJdLCJpYXQiOjE3Njg0Mjc2NDQsImV4cCI6MTc3MTAxOTY0NH0.O3a-2kGmAu5c5WnNqmrx42T-Zt6mEtszmfdb-P7DI7Y'; // Supabase auth token

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testEndpoint(name, method, url, body = null) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    console.log('TENANT_ID', TENANT_ID);
    console.log('AUTH_TOKEN', AUTH_TOKEN);
    console.log('API_BASE', API_BASE);
    console.log('url', `${API_BASE}${url}`);
    if (AUTH_TOKEN) {
      options.headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
    }
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const startTime = Date.now();
    const response = await fetch(`${API_BASE}${url}`, options);
    const duration = Date.now() - startTime;
    
    let data;
    try {
      data = await response.json();
    } catch (e) {
      data = { raw: await response.text() };
    }
    
    if (response.ok) {
      log(`✅ ${name} (${duration}ms)`, 'green');
      if (data.data && Array.isArray(data.data)) {
        log(`   Found ${data.data.length} settings`, 'blue');
      }
      return { success: true, status: response.status, data };
    } else {
      log(`❌ ${name} - ${response.status} ${response.statusText}`, 'red');
      log(`   Error: ${JSON.stringify(data).substring(0, 200)}`, 'yellow');
      return { success: false, status: response.status, error: data };
    }
  } catch (error) {
    log(`❌ ${name} - Network Error`, 'red');
    log(`   ${error.message}`, 'yellow');
    return { success: false, error: error.message };
  }
}

async function runTests() {
  log('\n🧪 Testing Settings HQ API Migration\n', 'blue');
  log('='.repeat(60), 'blue');
  
  if (!AUTH_TOKEN) {
    log('⚠️  Warning: No AUTH_TOKEN set. Some tests may fail.', 'yellow');
    log('   Set TEST_AUTH_TOKEN environment variable or update script.\n', 'yellow');
  }
  
  const results = {
    passed: 0,
    failed: 0,
    total: 0,
  };
  
  // Test 1: Effective Settings
  log('\n1. Testing Effective Settings Endpoint', 'blue');
  const test1 = await testEndpoint(
    'GET /tenants/[tenantId]/effective',
    'GET',
    `/tenants/${TENANT_ID}/effective`
  );
  results.total++;
  if (test1.success) results.passed++; else results.failed++;
  
  // Extract a real setting code from the response for subsequent tests
  let realSettingCode = 'workflow.max_concurrent_orders'; // fallback
  if (test1.success && test1.data?.data && Array.isArray(test1.data.data) && test1.data.data.length > 0) {
    realSettingCode = test1.data.data[0].stngCode;
    log(`   Using setting code from response: ${realSettingCode}`, 'blue');
  }
  
  // Test 2: Explain Setting (using real setting code from test 1)
  log('\n2. Testing Explain Setting Endpoint', 'blue');
  const test2 = await testEndpoint(
    'GET /tenants/[tenantId]/explain/[settingCode]',
    'GET',
    `/tenants/${TENANT_ID}/explain/${realSettingCode}`
  );
  results.total++;
  if (test2.success) results.passed++; else results.failed++;
  
  // Test 3: Get Tenant Profile
  log('\n3. Testing Get Tenant Profile', 'blue');
  const test3 = await testEndpoint(
    'GET /tenants/[tenantId]/profile',
    'GET',
    `/tenants/${TENANT_ID}/profile`
  );
  results.total++;
  if (test3.success) results.passed++; else results.failed++;
  
  // Test 4: Recompute Cache
  log('\n4. Testing Recompute Cache', 'blue');
  const test4 = await testEndpoint(
    'POST /tenants/[tenantId]/recompute',
    'POST',
    `/tenants/${TENANT_ID}/recompute`
  );
  results.total++;
  if (test4.success) results.passed++; else results.failed++;
  
  // Test 5: Upsert Override (optional - may require specific permissions)
  // Only test if we have a valid setting code
  log('\n5. Testing Upsert Override (optional)', 'blue');
  if (realSettingCode && realSettingCode !== 'workflow.max_concurrent_orders') {
    const test5 = await testEndpoint(
      'PATCH /tenants/[tenantId]/overrides',
      'PATCH',
      `/tenants/${TENANT_ID}/overrides`,
      {
        settingCode: realSettingCode,
        value: test1.data?.data?.[0]?.stngValue || 15, // Use existing value or default
        overrideReason: 'Test override',
      }
    );
    results.total++;
    if (test5.success) results.passed++; else results.failed++;
  } else {
    log('   ⏭️  Skipped (no valid setting code available)', 'yellow');
    results.total++;
    results.failed++; // Count as failed since we can't test
  }
  
  // Summary
  log('\n' + '='.repeat(60), 'blue');
  log(`\n📊 Test Results: ${results.passed}/${results.total} passed`, 
    results.failed === 0 ? 'green' : 'yellow');
  
  if (results.failed > 0) {
    log(`\n⚠️  ${results.failed} test(s) failed. Check logs above for details.`, 'yellow');
    log('   See docs/TESTING_SETTINGS_HQ_API.md for troubleshooting.', 'yellow');
  } else {
    log('\n✅ All tests passed!', 'green');
  }
  
  return results;
}

// Run tests
runTests().catch((error) => {
  log(`\n❌ Test runner error: ${error.message}`, 'red');
  process.exit(1);
});

