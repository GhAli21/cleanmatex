# Run Settings HQ API Tests Helper Script
# This script automates getting authentication token and running tests

param(
    [string]$HQApiUrl = "http://localhost:3002/api/hq/v1",
    [string]$WebAdminUrl = "http://localhost:3000",
    [string]$Email = "admin@cleanmatex.com",
    [string]$Password = "Admin@123",
    [string]$TenantId = "me"
)

$ErrorActionPreference = "Stop"

Write-Host "`n🧪 Settings HQ API Test Runner`n" -ForegroundColor Blue
Write-Host "=" * 60 -ForegroundColor Blue

# Step 1: Check if services are running
Write-Host "`n[1/4] Checking services..." -ForegroundColor Cyan

$hqApiRunning = $false
$webAdminRunning = $false

try {
    $hqResponse = Invoke-WebRequest -Uri "$HQApiUrl/health" -Method GET -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($hqResponse.StatusCode -eq 200) {
        $hqApiRunning = $true
        Write-Host "   ✅ HQ API (port 3002) is running" -ForegroundColor Green
    }
} catch {
    Write-Host "   ❌ HQ API (port 3002) is NOT running" -ForegroundColor Red
    Write-Host "      Start it with: cd F:\jhapp\cleanmatexsaas\platform-api; npm run start:dev" -ForegroundColor Yellow
}

try {
    $webResponse = Invoke-WebRequest -Uri "$WebAdminUrl/api/health" -Method GET -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($webResponse.StatusCode -eq 200) {
        $webAdminRunning = $true
        Write-Host "   ✅ web-admin (port 3000) is running" -ForegroundColor Green
    }
} catch {
    Write-Host "   ❌ web-admin (port 3000) is NOT running" -ForegroundColor Red
    Write-Host "      Start it with: cd F:\jhapp\cleanmatex\web-admin; npm run dev" -ForegroundColor Yellow
}

if (-not $hqApiRunning -or -not $webAdminRunning) {
    Write-Host "`n⚠️  Please start the required services before running tests.`n" -ForegroundColor Yellow
    exit 1
}

# Step 2: Get authentication token
Write-Host "`n[2/4] Getting authentication token..." -ForegroundColor Cyan

try {
    $loginBody = @{
        email = $Email
        password = $Password
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod -Uri "$HQApiUrl/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $loginBody `
        -ErrorAction Stop

    if ($loginResponse.access_token) {
        $token = $loginResponse.access_token
        Write-Host "   ✅ Token obtained successfully" -ForegroundColor Green
        Write-Host "   Token preview: $($token.Substring(0, 50))..." -ForegroundColor Gray
    } else {
        Write-Host "   ❌ No access_token in response" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "   ❌ Failed to get token: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "`n   Alternative: Set TEST_AUTH_TOKEN manually:" -ForegroundColor Yellow
    Write-Host "   `$env:TEST_AUTH_TOKEN='your-token-here'`n" -ForegroundColor Yellow
    exit 1
}

# Step 3: Set environment variables
Write-Host "`n[3/4] Setting environment variables..." -ForegroundColor Cyan

$env:TEST_AUTH_TOKEN = $token
$env:TEST_TENANT_ID = $TenantId
$env:TEST_API_BASE = "$WebAdminUrl/api/settings"

Write-Host "   ✅ TEST_AUTH_TOKEN set" -ForegroundColor Green
Write-Host "   ✅ TEST_TENANT_ID = $TenantId" -ForegroundColor Green
Write-Host "   ✅ TEST_API_BASE = $($env:TEST_API_BASE)" -ForegroundColor Green

# Step 4: Run tests
Write-Host "`n[4/4] Running tests...`n" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Blue

$scriptPath = Join-Path $PSScriptRoot "test-settings-hq-api.js"
if (-not (Test-Path $scriptPath)) {
    Write-Host "❌ Test script not found: $scriptPath" -ForegroundColor Red
    exit 1
}

try {
    node $scriptPath
    $exitCode = $LASTEXITCODE
} catch {
    Write-Host "❌ Failed to run test script: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`n" + ("=" * 60) -ForegroundColor Blue

if ($exitCode -eq 0) {
    Write-Host "`n✅ All tests completed successfully!`n" -ForegroundColor Green
} else {
    Write-Host "`n⚠️  Some tests failed. Check output above for details.`n" -ForegroundColor Yellow
}

exit $exitCode

