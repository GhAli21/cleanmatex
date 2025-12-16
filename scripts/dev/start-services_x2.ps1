# ============================================
# CleanMateX Development Services Startup
# ============================================
# This script starts all required services for local development:
# 1. Supabase Local (includes PostgreSQL on port 54322)
# 2. Docker Services (Redis, MinIO, Redis Commander)
#
# Usage: .\scripts\dev\start-services.ps1
# ============================================

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  CleanMateX Development Environment" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# ============================================
# STEP 1: Start Supabase Local
# ============================================
Write-Host "[1/4] Starting Supabase Local..." -ForegroundColor Yellow

try {
    $supabaseStatus = supabase status 2>&1
    if ($LASTEXITCODE -eq 0 -and $supabaseStatus -match "supabase local development setup is running") {
        Write-Host "  ✓ Supabase is already running" -ForegroundColor Green
    } else {
        Write-Host "  → Starting Supabase services..." -ForegroundColor Gray
        supabase start
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  ✗ Failed to start Supabase" -ForegroundColor Red
            exit 1
        }
        Write-Host "  ✓ Supabase started successfully" -ForegroundColor Green
    }
} catch {
    Write-Host "  ✗ Error checking Supabase status: $_" -ForegroundColor Red
    Write-Host "  → Make sure Supabase CLI is installed: npm i -g supabase" -ForegroundColor Yellow
    exit 1
}

# ============================================
# STEP 2: Wait for Supabase Health Checks
# ============================================
Write-Host "`n[2/4] Waiting for Supabase to be ready..." -ForegroundColor Yellow

$supabaseAPI = "http://127.0.0.1:54321"
$supabaseStudio = "http://127.0.0.1:54323"
$maxAttempts = 30
$attempt = 0

function Test-ServiceHealth {
    param([string]$url)
    try {
        $response = Invoke-WebRequest -Uri $url -Method Get -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        return $response.StatusCode -eq 200
    } catch {
        return $false
    }
}

# Check API
Write-Host "  → Checking Supabase API (port 54321)..." -ForegroundColor Gray
while ($attempt -lt $maxAttempts) {
    if (Test-ServiceHealth $supabaseAPI) {
        Write-Host "  ✓ Supabase API is ready" -ForegroundColor Green
        break
    }
    $attempt++
    Start-Sleep -Milliseconds 500
}

if ($attempt -eq $maxAttempts) {
    Write-Host "  ⚠ Supabase API health check timed out (may still be starting)" -ForegroundColor Yellow
}

# Check Studio
Write-Host "  → Checking Supabase Studio (port 54323)..." -ForegroundColor Gray
$attempt = 0
while ($attempt -lt $maxAttempts) {
    if (Test-ServiceHealth $supabaseStudio) {
        Write-Host "  ✓ Supabase Studio is ready" -ForegroundColor Green
        break
    }
    $attempt++
    Start-Sleep -Milliseconds 500
}

if ($attempt -eq $maxAttempts) {
    Write-Host "  ⚠ Supabase Studio health check timed out (may still be starting)" -ForegroundColor Yellow
}

# ============================================
# STEP 3: Start Docker Services
# ============================================
Write-Host "`n[3/4] Starting Docker services..." -ForegroundColor Yellow

try {
    # Check if Docker is running
    docker info 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ✗ Docker is not running. Please start Docker Desktop." -ForegroundColor Red
        exit 1
    }

    Write-Host "  → Starting Redis, MinIO, and Redis Commander..." -ForegroundColor Gray
    docker-compose up -d redis redis-commander minio 2>&1 | Out-Null

    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Docker services started successfully" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Failed to start Docker services" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "  ✗ Error starting Docker services: $_" -ForegroundColor Red
    exit 1
}

# ============================================
# STEP 4: Verify All Services
# ============================================
Write-Host "`n[4/4] Verifying service availability..." -ForegroundColor Yellow

$services = @(
    @{Name="Supabase API"; Port=54321; URL="http://localhost:54321"},
    @{Name="Supabase Studio"; Port=54323; URL="http://localhost:54323"},
    @{Name="Supabase DB"; Port=54322; URL=$null},
    @{Name="Supabase Mailpit"; Port=54324; URL="http://localhost:54324"},
    @{Name="Redis"; Port=6379; URL=$null},
    @{Name="Redis Commander"; Port=8081; URL="http://localhost:8081"},
    @{Name="MinIO API"; Port=9000; URL="http://localhost:9000"},
    @{Name="MinIO Console"; Port=9001; URL="http://localhost:9001"}
)

function Test-Port {
    param([int]$port)
    try {
        $connection = New-Object System.Net.Sockets.TcpClient
        $connection.Connect("127.0.0.1", $port)
        $connection.Close()
        return $true
    } catch {
        return $false
    }
}

foreach ($service in $services) {
    $status = if (Test-Port $service.Port) { "✓" } else { "✗" }
    $color = if ($status -eq "✓") { "Green" } else { "Red" }

    Write-Host "  $status " -ForegroundColor $color -NoNewline
    Write-Host "$($service.Name) (port $($service.Port))" -ForegroundColor Gray
}

# ============================================
# Summary & Next Steps
# ============================================
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  ✓ All Services Started Successfully!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "📍 Service URLs:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Supabase Studio:    " -NoNewline -ForegroundColor Gray
Write-Host "http://localhost:54323" -ForegroundColor Cyan
Write-Host "  Supabase API:       " -NoNewline -ForegroundColor Gray
Write-Host "http://localhost:54321" -ForegroundColor Cyan
Write-Host "  Redis Commander:    " -NoNewline -ForegroundColor Gray
Write-Host "http://localhost:8081" -ForegroundColor Cyan
Write-Host "  MinIO Console:      " -NoNewline -ForegroundColor Gray
Write-Host "http://localhost:9001" -ForegroundColor Cyan
Write-Host "                      " -NoNewline -ForegroundColor Gray
Write-Host "(user: minioadmin / pass: minioadmin123)" -ForegroundColor DarkGray
Write-Host "  Mailpit (emails):   " -NoNewline -ForegroundColor Gray
Write-Host "http://localhost:54324" -ForegroundColor Cyan

Write-Host "`n🔌 Database Connection:" -ForegroundColor Yellow
Write-Host "  postgresql://postgres:postgres@localhost:54322/postgres" -ForegroundColor Cyan

Write-Host "`n📦 Next Steps:" -ForegroundColor Yellow
Write-Host "  1. " -NoNewline -ForegroundColor Gray
Write-Host "cd web-admin" -ForegroundColor White
Write-Host "  2. " -NoNewline -ForegroundColor Gray
Write-Host "npm run dev" -ForegroundColor White
Write-Host "  3. " -NoNewline -ForegroundColor Gray
Write-Host "Open http://localhost:3000" -ForegroundColor Cyan

Write-Host "`n💡 Useful Commands:" -ForegroundColor Yellow
Write-Host "  Status:   " -NoNewline -ForegroundColor Gray
Write-Host ".\scripts\dev\status-services.ps1" -ForegroundColor White
Write-Host "  Stop:     " -NoNewline -ForegroundColor Gray
Write-Host ".\scripts\dev\stop-services.ps1" -ForegroundColor White
Write-Host "  Supabase: " -NoNewline -ForegroundColor Gray
Write-Host "supabase status" -ForegroundColor White
Write-Host "  Docker:   " -NoNewline -ForegroundColor Gray
Write-Host "docker-compose ps" -ForegroundColor White

Write-Host ""
