# ==================================================================
# reset-with-seeds.ps1 (fixed)
# Purpose: Reset database with production migrations AND load demo seeds
# ==================================================================

param(
    [switch]$Help,
    [switch]$SkipConfirm,
    [switch]$Tenant1Only,
    [switch]$Tenant2Only
)

function Show-Help {
@"
Reset Database with Seeds - CleanMateX Database Helper
========================================================

Usage:
    .\scripts\db\reset-with-seeds.ps1 [options]

Options:
    -Help          Show this help message
    -SkipConfirm   Skip confirmation prompts
    -Tenant1Only   Seed only Demo Tenant #1
    -Tenant2Only   Seed only Demo Tenant #2

Behavior:
- Runs `supabase db reset` (drops and recreates local DB, then applies ALL migrations)
- Applies seed migrations for lookups and demo tenants
- Prints quick links and next steps
"@
}

if ($Help) { Show-Help; exit 0 }

# Confirm
if (-not $SkipConfirm) {
    $ans = Read-Host "This will RESET local DB and apply ALL migrations. Continue? (y/N)"
    if ($ans -ne 'y' -and $ans -ne 'Y') { Write-Host "Cancelled."; exit 0 }
}

# Ensure we're at repo root
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot  = Resolve-Path (Join-Path $scriptDir "..\..")
Set-Location $repoRoot

# Check supabase CLI
if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
    Write-Error "supabase CLI not found. Install: https://supabase.com/docs/guides/cli"
    exit 1
}

Write-Host "==> Resetting database with all migrations..." -ForegroundColor Cyan
$env:SUPABASE_URL       = $env:SUPABASE_URL       # pass-through if set
$env:SUPABASE_ANON_KEY  = $env:SUPABASE_ANON_KEY  # pass-through if set
$env:SUPABASE_SERVICE_ROLE_KEY = $env:SUPABASE_SERVICE_ROLE_KEY

# Full reset
supabase db reset 
#--no-backup
if ($LASTEXITCODE -ne 0) { Write-Error "supabase db reset failed."; exit 1 }

# Seed ordering if you keep seeds outside migrations folder:
# Example: run specific seed SQL files after reset (adjust paths to your repo)
$seedDir = Join-Path $repoRoot "supabase\seeds"
if (Test-Path $seedDir) {
    Write-Host "==> Applying seed SQL files..." -ForegroundColor Cyan
    $psql = "psql"
    if (-not (Get-Command $psql -ErrorAction SilentlyContinue)) {
        Write-Error "psql not found in PATH. Install PostgreSQL client tools."
        exit 1
    }

    # Apply common lookup seeds first
    $commonSeeds = @(
        "0001_core.sql"
    )

    foreach ($file in $commonSeeds) {
        $path = Join-Path $seedDir $file
        if (Test-Path $path) {
            Write-Host "Applying seed: $file"
            & $psql -v ON_ERROR_STOP=1 -f $path
            if ($LASTEXITCODE -ne 0) { Write-Error "Failed: $file"; exit 1 }
        }
    }

    # Tenant #1
    if (-not $Tenant2Only) {
        $t1 = @(
            "0006_seed_auth_demo.sql",
            "0009_create_demo_admin_user.sql"
        )
        foreach ($file in $t1) {
            $path = Join-Path $seedDir $file
            if (Test-Path $path) {
                Write-Host "Applying Tenant #1 seed: $file"
                & $psql -v ON_ERROR_STOP=1 -f $path
                if ($LASTEXITCODE -ne 0) { Write-Error "Failed: $file"; exit 1 }
            }
        }
    }

    # Tenant #2
    if (-not $Tenant1Only) {
        $t2 = @(
            "0012_seed_auth_demo_02.sql",
            "0013_create_demo_admin_user_02.sql"
        )
        foreach ($file in $t2) {
            $path = Join-Path $seedDir $file
            if (Test-Path $path) {
                Write-Host "Applying Tenant #2 seed: $file"
                & $psql -v ON_ERROR_STOP=1 -f $path
                if ($LASTEXITCODE -ne 0) { Write-Error "Failed: $file"; exit 1 }
            }
        }
    }
}

Write-Host ""
Write-Host "Quick Links:" -ForegroundColor Yellow
Write-Host '  Supabase Studio: http://localhost:54323' -ForegroundColor Cyan
Write-Host '  Web Admin: http://localhost:3000' -ForegroundColor Cyan
Write-Host ""

if ($LASTEXITCODE -eq 0) {
    Write-Host "Ready to login with demo credentials." -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host 'Create admin users manually or run: node scripts\db\create-demo-admins.js' -ForegroundColor Yellow
    Write-Host ""
}
