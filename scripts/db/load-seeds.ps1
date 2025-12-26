# ==================================================================
# load-seeds.ps1
# Purpose: Load all seed data into local Supabase PostgreSQL
# Author: CleanMateX Development Team
# Created: 2025-10-24
# ==================================================================
# Usage: .\scripts\db\load-seeds.ps1
# ==================================================================

param(
    [switch]$Help,
    [switch]$SkipLookups,
    [switch]$Tenant1Only,
    [switch]$Tenant2Only,
    [switch]$AutoCreateAdmins
)

# Show help
if ($Help) {
    Write-Host @"
Load Seed Data - CleanMateX Database Helper
============================================

Usage:
    .\scripts\db\load-seeds.ps1 [options]

Options:
    -Help              Show this help message
    -SkipLookups       Skip loading lookup tables (if already loaded)
    -Tenant1Only       Load only Demo Tenant #1
    -Tenant2Only       Load only Demo Tenant #2
    -AutoCreateAdmins  Automatically create admin users after loading seeds

Examples:
    # Load all seeds
    .\scripts\db\load-seeds.ps1

    # Load all seeds + create admin users
    .\scripts\db\load-seeds.ps1 -AutoCreateAdmins

    # Load only tenant 1
    .\scripts\db\load-seeds.ps1 -Tenant1Only

    # Load both tenants, skip lookups
    .\scripts\db\load-seeds.ps1 -SkipLookups

    # Load tenant 1 with admin creation
    .\scripts\db\load-seeds.ps1 -Tenant1Only -AutoCreateAdmins

Database:
    postgresql://postgres:postgres@localhost:54322/postgres

"@
    exit 0
}

# Configuration
$DB_URL = "postgresql://postgres:postgres@localhost:54322/postgres"
$SEEDS_DIR = "supabase/migrations/seeds"

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "  CleanMateX - Load Seed Data" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

# Check if PostgreSQL is accessible
Write-Host "Checking database connection..." -ForegroundColor Yellow
$testConnection = psql $DB_URL -c "SELECT 1;" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Cannot connect to PostgreSQL!" -ForegroundColor Red
    Write-Host "Make sure Supabase is running: supabase start" -ForegroundColor Red
    exit 1
}
Write-Host "Database connection successful" -ForegroundColor Green
Write-Host ""

# Define seeds to load
$seeds = @()

if (-not $SkipLookups -and -not $Tenant1Only -and -not $Tenant2Only) {
    $seeds += "$SEEDS_DIR/0001_seed_lookup_tables.sql"
}

if (-not $Tenant2Only) {
    $seeds += "$SEEDS_DIR/0002_seed_tenant_demo1.sql"
}

if (-not $Tenant1Only) {
    $seeds += "$SEEDS_DIR/0003_seed_tenant_demo2.sql"
}

# Load seeds
foreach ($seed in $seeds) {
    $seedName = Split-Path $seed -Leaf
    Write-Host "Loading: $seedName..." -ForegroundColor Yellow

    if (-not (Test-Path $seed)) {
        Write-Host "  ERROR: File not found: $seed" -ForegroundColor Red
        continue
    }

    psql $DB_URL -f $seed

    if ($LASTEXITCODE -eq 0) {
        Write-Host "  Loaded successfully" -ForegroundColor Green
    }
    else {
        Write-Host "  Failed to load" -ForegroundColor Red
        Write-Host "  Check the error messages above for details" -ForegroundColor Red
        exit 1
    }
    Write-Host ""
}

# Create admin users if requested
if ($AutoCreateAdmins) {
    Write-Host ""
    Write-Host "=================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Creating admin users..." -ForegroundColor Yellow
    Write-Host ""

    # Change to project root for node script
    $scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
    $projectRoot = Split-Path -Parent (Split-Path -Parent $scriptPath)
    Set-Location $projectRoot

    node scripts/db/create-demo-admins.js

    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "WARNING: Admin user creation failed" -ForegroundColor Yellow
        Write-Host "You can create users manually via Supabase Studio" -ForegroundColor Yellow
    }
    Write-Host ""
}

# Summary
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "  Seed Loading Complete!" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

if (-not $Tenant2Only) {
    Write-Host "Demo Tenant #1 (Demo Laundry LLC):" -ForegroundColor Yellow
    Write-Host "  ID:    11111111-1111-1111-1111-111111111111" -ForegroundColor White
    Write-Host "  Email: owner@demo-laundry.example" -ForegroundColor White
    if ($AutoCreateAdmins -and $LASTEXITCODE -eq 0) {
        Write-Host "  Users: admin, operator, viewer (password: Admin123/Operator123/Viewer123)" -ForegroundColor White
    }
    else {
        Write-Host "  Admin: admin@demo-laundry.example / Admin123 (create manually)" -ForegroundColor White
    }
    Write-Host ""
}

if (-not $Tenant1Only) {
    Write-Host "Demo Tenant #2 (BlueWave Laundry Co.):" -ForegroundColor Yellow
    Write-Host "  ID:    20000002-2222-2222-2222-222222222221" -ForegroundColor White
    Write-Host "  Email: hq@bluewave.example" -ForegroundColor White
    if ($AutoCreateAdmins -and $LASTEXITCODE -eq 0) {
        Write-Host "  Users: admin, operator, viewer (password: Admin123/Operator123/Viewer123)" -ForegroundColor White
    }
    else {
        Write-Host "  Admin: admin@bluewave.example / Admin123 (create manually)" -ForegroundColor White
    }
    Write-Host ""
}

if (-not $AutoCreateAdmins) {
    Write-Host "WARNING: Admin users need to be created:" -ForegroundColor Yellow
    Write-Host "   Auto: .\scripts\db\load-seeds.ps1 -AutoCreateAdmins" -ForegroundColor White
    Write-Host "   Manual: node scripts/db/create-demo-admins.js" -ForegroundColor White
    Write-Host "   OR via Supabase Studio: http://localhost:54323" -ForegroundColor White
    Write-Host ""
}
elseif ($LASTEXITCODE -eq 0) {
    Write-Host "SUCCESS: Admin users created successfully!" -ForegroundColor Green
    Write-Host "   Ready to login at: http://localhost:3000" -ForegroundColor White
    Write-Host ""
}
