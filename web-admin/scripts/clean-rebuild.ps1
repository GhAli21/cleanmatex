# Clean Rebuild Script for web-admin
# This script cleans everything and rebuilds from scratch

Write-Host "🧹 Starting clean rebuild..." -ForegroundColor Cyan

# Navigate to web-admin directory
Set-Location $PSScriptRoot\..

Write-Host "📁 Current directory: $(Get-Location)" -ForegroundColor Yellow

# Step 1: Remove node_modules
Write-Host "`n🗑️  Removing node_modules..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Remove-Item -Path "node_modules" -Recurse -Force
    Write-Host "✅ node_modules removed" -ForegroundColor Green
}
else {
    Write-Host "ℹ️  node_modules not found" -ForegroundColor Gray
}

# Step 2: Remove package-lock.json
Write-Host "`n🗑️  Removing package-lock.json..." -ForegroundColor Yellow
if (Test-Path "package-lock.json") {
    Remove-Item -Path "package-lock.json" -Force
    Write-Host "✅ package-lock.json removed" -ForegroundColor Green
}
else {
    Write-Host "ℹ️  package-lock.json not found" -ForegroundColor Gray
}

# Step 3: Remove .next directory
Write-Host "`n🗑️  Removing .next directory..." -ForegroundColor Yellow
if (Test-Path ".next") {
    Remove-Item -Path ".next" -Recurse -Force
    Write-Host "✅ .next removed" -ForegroundColor Green
}
else {
    Write-Host "ℹ️  .next not found" -ForegroundColor Gray
}

# Step 4: Remove .turbo directory (if exists)
Write-Host "`n🗑️  Removing .turbo directory..." -ForegroundColor Yellow
if (Test-Path ".turbo") {
    Remove-Item -Path ".turbo" -Recurse -Force
    Write-Host "✅ .turbo removed" -ForegroundColor Green
}
else {
    Write-Host "ℹ️  .turbo not found" -ForegroundColor Gray
}

# Step 5: Clear npm cache
Write-Host "`n🧹 Clearing npm cache..." -ForegroundColor Yellow
npm cache clean --force
Write-Host "✅ npm cache cleared" -ForegroundColor Green

# Step 6: Install dependencies
Write-Host "`n📦 Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Dependencies installed" -ForegroundColor Green
}
else {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

# Step 7: Generate Prisma client
Write-Host "`n🔧 Generating Prisma client..." -ForegroundColor Yellow
npm run prisma:generate
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Prisma client generated" -ForegroundColor Green
}
else {
    Write-Host "⚠️  Prisma generation failed (may be okay)" -ForegroundColor Yellow
}

# Step 8: Build project
Write-Host "`n🏗️  Building project..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Build successful!" -ForegroundColor Green
    Write-Host "🚀 Ready for deployment!" -ForegroundColor Cyan
}
else {
    Write-Host "`n❌ Build failed" -ForegroundColor Red
    exit 1
}

Write-Host "`n✨ Clean rebuild complete!" -ForegroundColor Green
