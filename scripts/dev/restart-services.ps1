# scripts/dev/restart-services.ps1
# Stops all CleanMateX services then starts them again.
# Useful after config changes or to recover from an unclean state.
# Full guide: docs/dev/cleanmatex_infra_guide.md

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ScriptDir = $PSScriptRoot

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CleanMateX -- Restart Services" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Step 1/2: Stopping services..." -ForegroundColor Yellow
& "$ScriptDir\stop-services.ps1"

Write-Host ""
Write-Host "Step 2/2: Starting services..." -ForegroundColor Yellow
& "$ScriptDir\start-services.ps1"
