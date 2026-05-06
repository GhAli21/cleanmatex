# scripts/dev/stop-services.ps1
# Stops all CleanMateX local services in safe order:
# app-level Docker services first, then the Supabase database layer.
# Full guide: docs/dev/cleanmatex_infra_guide.md

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

# ─── Scoop PATH fix ───────────────────────────────────────────────────────────
$scoopShims = "$env:USERPROFILE\scoop\shims"
if (($env:PATH -split ';') -notcontains $scoopShims) {
    $env:PATH = "$scoopShims;$env:PATH"
}

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CleanMateX -- Stop Services" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ─── [1/2] Docker Compose services (redis, minio, redis-commander) ────────────

Write-Host "[1/2] Stopping Docker services..." -ForegroundColor Yellow

Push-Location $ProjectRoot
try {
    docker compose down
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  Docker services stopped." -ForegroundColor Green
    } else {
        docker-compose down
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  Docker services stopped." -ForegroundColor Green
        } else {
            Write-Host "  Docker services may already be stopped." -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "  Docker services may already be stopped." -ForegroundColor Yellow
} finally {
    Pop-Location
}

# ─── [2/2] Supabase (database — stop last) ────────────────────────────────────

Write-Host ""
Write-Host "[2/2] Stopping Supabase..." -ForegroundColor Yellow

Push-Location $ProjectRoot
try {
    supabase stop
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  Supabase stopped." -ForegroundColor Green
    } else {
        Write-Host "  Supabase may already be stopped." -ForegroundColor Yellow
    }
} catch {
    Write-Host "  Supabase may already be stopped." -ForegroundColor Yellow
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  All services stopped." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  To start again: .\scripts\dev\start-services.ps1" -ForegroundColor Yellow
Write-Host ""
