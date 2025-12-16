# Stop all CleanMateX development infrastructure services (PowerShell)

Write-Host "🛑 Stopping CleanMateX Development Infrastructure..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Stop Supabase
Write-Host "🔷 Stopping Supabase..." -ForegroundColor Blue
Push-Location supabase

try {
    $status = supabase status 2>&1
    if ($LASTEXITCODE -eq 0) {
        supabase stop
        Write-Host "✓ Supabase stopped" -ForegroundColor Green
    }
} catch {
    Write-Host "ℹ️  Supabase is not running" -ForegroundColor Yellow
}

Pop-Location

# Step 2: Stop Docker Compose services
Write-Host ""
Write-Host "📦 Stopping Docker Compose services..." -ForegroundColor Blue
docker-compose stop

Write-Host ""
Write-Host "✅ All services stopped!" -ForegroundColor Green
Write-Host ""
Write-Host "Note: Data is preserved in Docker volumes."
Write-Host "To remove all data, run: docker-compose down -v"
Write-Host ""

