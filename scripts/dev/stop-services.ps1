Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Stopping CleanMateX Services" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: stop docker services
Write-Host "[1/2] Stopping Docker services" -ForegroundColor Yellow
try {
  try { docker compose down } catch { docker-compose down }
  Write-Host "Docker services stopped." -ForegroundColor Green
} catch {
  Write-Host "Docker services may already be stopped." -ForegroundColor Yellow
}

# Step 2: stop supabase
Write-Host "[2/2] Stopping Supabase" -ForegroundColor Yellow
try {
  supabase stop
  Write-Host "Supabase stopped." -ForegroundColor Green
} catch {
  Write-Host "Supabase may already be stopped." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  All services stopped" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "To start again: .\scripts\dev\start-services.ps1" -ForegroundColor Yellow
