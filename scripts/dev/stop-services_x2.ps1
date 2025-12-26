# ============================================
# CleanMateX Development Services Shutdown
# ============================================
# This script stops all development services in the correct order:
# 1. Docker Services (Redis, MinIO, Redis Commander)
# 2. Supabase Local (includes PostgreSQL)
#
# Usage: .\scripts\dev\stop-services.ps1
# ============================================

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Stopping CleanMateX Services" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# ============================================
# STEP 1: Stop Docker Services
# ============================================
Write-Host "[1/2] Stopping Docker services..." -ForegroundColor Yellow

try {
    # Check if Docker is running
    docker info 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ⚠ Docker is not running (already stopped)" -ForegroundColor Yellow
    } else {
        Write-Host "  → Stopping Docker Compose services..." -ForegroundColor Gray
        docker-compose down 2>&1 | Out-Null

        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✓ Docker services stopped successfully" -ForegroundColor Green
        } else {
            Write-Host "  ✗ Error stopping Docker services" -ForegroundColor Red
        }
    }
} catch {
    Write-Host "  ⚠ Docker services may already be stopped" -ForegroundColor Yellow
}

# ============================================
# STEP 2: Stop Supabase Local
# ============================================
Write-Host "`n[2/2] Stopping Supabase Local..." -ForegroundColor Yellow

try {
    $supabaseStatus = supabase status 2>&1
    if ($LASTEXITCODE -ne 0 -or $supabaseStatus -notmatch "supabase local development setup is running") {
        Write-Host "  ⚠ Supabase is not running (already stopped)" -ForegroundColor Yellow
    } else {
        Write-Host "  → Stopping Supabase services..." -ForegroundColor Gray
        supabase stop

        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✓ Supabase stopped successfully" -ForegroundColor Green
        } else {
            Write-Host "  ✗ Error stopping Supabase" -ForegroundColor Red
        }
    }
} catch {
    Write-Host "  ⚠ Supabase may already be stopped" -ForegroundColor Yellow
}

# ============================================
# Summary
# ============================================
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  ✓ All Services Stopped" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "💡 To start services again:" -ForegroundColor Yellow
Write-Host "  .\scripts\dev\start-services.ps1`n" -ForegroundColor White
