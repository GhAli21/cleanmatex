# ==================================================================
# reset-with-seeds.ps1
# Purpose: Reset database with production migrations AND load demo seeds
# Author: CleanMateX Development Team
# Created: 2025-10-24
# ==================================================================
# This script:
# 1. Resets the database with production migrations
# 2. Loads all seed data (lookup tables + demo tenants)
# ==================================================================
# Usage: .\scripts\db\reset-with-seeds.ps1
# ==================================================================

param(
    [switch]$Help,
    [switch]$SkipConfirm,
    [switch]$Tenant1Only,
    [switch]$Tenant2Only
)

# Show help
if ($Help) {
    Write-Host @"
Reset Database with Seeds - CleanMateX Database Helper
========================================================

Usage:
    .\scripts\db\reset-with-seeds.ps1 [options]

Options:
    -Help          Show this help message
    -SkipConfirm   Skip confirmation prompt (use with caution!)
    -Tenant1Only   Load only Demo Tenant #1 (+ lookups)
    -Tenant2Only   Load only Demo Tenant #2 (+ lookups)

What this script does:
    1. Resets the database (destroys all data)
    2. Runs production migrations (clean schema)
    3. Loads lookup tables
    4. Loads demo tenant data

After running:
    - You will have a fully seeded development environment
    - Ready for testing and development

"@
    exit 0
}

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "  CleanMateX - Reset Database with Seeds" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

# Confirm action
if (-not $SkipConfirm) {
    Write-Host "WARNING: This will DESTROY all data in the local database!" -ForegroundColor Red
    Write-Host ""
    $confirm = Read-Host "Are you sure you want to continue? (yes/no)"
    if ($confirm -ne "yes") {
        Write-Host "Cancelled." -ForegroundColor Yellow
        exit 0
    }
    Write-Host ""
}

# Get script directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path

# Step 1: Reset production database
Write-Host "[Step 1/3] Resetting production database..." -ForegroundColor Yellow
Write-Host ""

& "$scriptPath\reset-production.ps1" -SkipConfirm

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Production reset failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

# Step 2: Load seeds
Write-Host "[Step 2/3] Loading seed data..." -ForegroundColor Yellow
Write-Host ""

$loadSeedsArgs = @()
if ($Tenant1Only) {
    $loadSeedsArgs += "-Tenant1Only"
}
if ($Tenant2Only) {
    $loadSeedsArgs += "-Tenant2Only"
}

& "$scriptPath\load-seeds.ps1" @loadSeedsArgs

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Seed loading failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

# Step 3: Create admin users
Write-Host "[Step 3/3] Creating admin users..." -ForegroundColor Yellow
Write-Host ""

# Change to project root for node script
$projectRoot = Split-Path -Parent (Split-Path -Parent $scriptPath)
Set-Location $projectRoot

node scripts/db/create-demo-admins.js

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "WARNING: Admin user creation failed (non-fatal)" -ForegroundColor Yellow
    Write-Host "You can create users manually via Supabase Studio" -ForegroundColor Yellow
}
else {
    Write-Host ""
}

# Final summary
Write-Host ""
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "  Complete Setup Finished!" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Your development database is ready:" -ForegroundColor Green
Write-Host "  Production schema loaded" -ForegroundColor White
Write-Host "  Lookup tables seeded" -ForegroundColor White

if (-not $Tenant2Only) {
    Write-Host "  Demo Tenant #1 loaded" -ForegroundColor White
}
if (-not $Tenant1Only) {
    Write-Host "  Demo Tenant #2 loaded" -ForegroundColor White
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "  Admin users created" -ForegroundColor White
}

Write-Host ""
Write-Host "Quick Links:" -ForegroundColor Yellow
Write-Host "  Supabase Studio: http://localhost:54323" -ForegroundColor Cyan
Write-Host "  Web Admin: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""

if ($LASTEXITCODE -eq 0) {
    Write-Host "SUCCESS: Ready to login with demo credentials!" -ForegroundColor Green
    Write-Host ""
}
else {
    Write-Host "WARNING: Create admin users manually" -ForegroundColor Yellow
    Write-Host ""
}
