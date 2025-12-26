# ==================================================================
# reset-production.ps1
# Purpose: Reset database with production migrations only (no seeds)
# Author: CleanMateX Development Team
# Created: 2025-10-24
# ==================================================================

param(
    [switch]$Help,
    [switch]$SkipConfirm
)

if ($Help) {
    Write-Host "Reset Production Database - CleanMateX"
    Write-Host "========================================"
    Write-Host ""
    Write-Host "Usage: .\scripts\db\reset-production.ps1 [-SkipConfirm]"
    Write-Host ""
    Write-Host "This script resets the database and runs production migrations only."
    Write-Host "No demo data will be loaded."
    Write-Host ""
    exit 0
}

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "  CleanMateX - Reset Production Database" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

if (-not $SkipConfirm) {
    Write-Host "WARNING: This will DESTROY all data!" -ForegroundColor Red
    Write-Host ""
    $confirm = Read-Host "Continue? (yes/no)"
    if ($confirm -ne "yes") {
        Write-Host "Cancelled." -ForegroundColor Yellow
        exit 0
    }
    Write-Host ""
}

# Change to project root
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent (Split-Path -Parent $scriptPath)
Set-Location $projectRoot

Write-Host "Current directory: $projectRoot" -ForegroundColor Cyan
Write-Host ""

# Step 1: Temporarily move production migrations to root
Write-Host "[1/3] Setting up production migrations..." -ForegroundColor Yellow

# Backup any existing migrations in root
if (Test-Path "supabase/migrations/*.sql") {
    New-Item -ItemType Directory -Path "supabase/migrations/.temp_backup" -Force | Out-Null
    Move-Item -Path "supabase/migrations/*.sql" -Destination "supabase/migrations/.temp_backup/" -Force -ErrorAction SilentlyContinue
}

# Copy production migrations to root
Copy-Item -Path "supabase/migrations/production/*.sql" -Destination "supabase/migrations/" -Exclude "README.md" -Force
Write-Host "  Production migrations ready" -ForegroundColor Green
Write-Host ""

# Step 2: Reset database
Write-Host "[2/3] Resetting database..." -ForegroundColor Yellow
supabase db reset

$resetSuccess = $LASTEXITCODE -eq 0

if ($resetSuccess) {
    Write-Host "  Database reset successful" -ForegroundColor Green
} else {
    Write-Host "  Database reset failed!" -ForegroundColor Red
}
Write-Host ""

# Step 3: Cleanup
Write-Host "[3/3] Cleaning up..." -ForegroundColor Yellow

# Remove production migrations from root
Remove-Item -Path "supabase/migrations/000*.sql" -Force -ErrorAction SilentlyContinue

# Restore backup if exists
if (Test-Path "supabase/migrations/.temp_backup") {
    Move-Item -Path "supabase/migrations/.temp_backup/*.sql" -Destination "supabase/migrations/" -Force -ErrorAction SilentlyContinue
    Remove-Item -Path "supabase/migrations/.temp_backup" -Recurse -Force
}

Write-Host "  Cleanup complete" -ForegroundColor Green
Write-Host ""

if (-not $resetSuccess) {
    Write-Host "Database reset failed. Check errors above." -ForegroundColor Red
    exit 1
}

# Summary
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "  Production Database Reset Complete!" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Load seeds: .\scripts\db\load-seeds.ps1" -ForegroundColor White
Write-Host "  2. Or create tenants via API/admin" -ForegroundColor White
Write-Host ""
Write-Host "Supabase Studio: http://localhost:54323" -ForegroundColor Cyan
Write-Host ""
