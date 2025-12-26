# Prisma Generate Script with Error Handling
# This script handles Windows file locking issues

Write-Host "🔄 Generating Prisma Client..." -ForegroundColor Cyan

# Navigate to web-admin directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$webAdminPath = Split-Path -Parent $scriptPath
Set-Location $webAdminPath

# Try to clean Prisma cache first
$prismaCachePath = "..\node_modules\.prisma"
if (Test-Path $prismaCachePath) {
    Write-Host "🧹 Cleaning Prisma cache..." -ForegroundColor Yellow
    try {
        Remove-Item -Path $prismaCachePath -Recurse -Force -ErrorAction Stop
        Write-Host "✅ Cache cleaned" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  Could not clean cache (file may be locked)" -ForegroundColor Yellow
        Write-Host "💡 Try closing VS Code/Cursor and running this script again" -ForegroundColor Yellow
    }
}

# Generate Prisma client
Write-Host "🔧 Generating Prisma Client..." -ForegroundColor Yellow
try {
    npx prisma generate
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Prisma Client generated successfully!" -ForegroundColor Green
    } else {
        Write-Host "❌ Generation failed" -ForegroundColor Red
        Write-Host ""
        Write-Host "💡 Troubleshooting:" -ForegroundColor Yellow
        Write-Host "   1. Close all VS Code/Cursor windows" -ForegroundColor White
        Write-Host "   2. Wait 5 seconds" -ForegroundColor White
        Write-Host "   3. Run this script again" -ForegroundColor White
        Write-Host ""
        Write-Host "   OR run in a fresh PowerShell window outside VS Code" -ForegroundColor White
        exit 1
    }
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Solution: Close VS Code/Cursor and try again" -ForegroundColor Yellow
    exit 1
}

