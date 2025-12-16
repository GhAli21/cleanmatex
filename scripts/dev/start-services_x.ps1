# Start all CleanMateX development infrastructure services (PowerShell)

Write-Host "🚀 Starting CleanMateX Development Infrastructure..." -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
try {
    docker info | Out-Null
} catch {
    Write-Host "❌ Error: Docker is not running!" -ForegroundColor Red
    Write-Host "Please start Docker Desktop and try again."
    exit 1
}

# Check if .env file exists
if (-not (Test-Path ".env")) {
    Write-Host "⚠️  Warning: .env file not found!" -ForegroundColor Yellow
    Write-Host "Copying .env.example to .env..."
    Copy-Item ".env.example" ".env"
    Write-Host "✓ Created .env file" -ForegroundColor Green
    Write-Host "Please update .env with your configuration and run this script again." -ForegroundColor Yellow
    exit 0
}

# Step 1: Start Docker Compose services
Write-Host "📦 Starting Docker Compose services..." -ForegroundColor Blue
docker-compose up -d

# Step 2: Wait for services to be healthy
Write-Host ""
Write-Host "⏳ Waiting for services to become healthy..." -ForegroundColor Blue

# Wait for PostgreSQL
Write-Host -NoNewline "   PostgreSQL: "
while ($true) {
    try {
        docker exec cmx-postgres pg_isready -U cmx_user -d cmx_db 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) { break }
    } catch {
        # Continue waiting
    }
    Write-Host -NoNewline "."
    Start-Sleep -Seconds 1
}
Write-Host " ✓" -ForegroundColor Green

# Wait for Redis
Write-Host -NoNewline "   Redis: "
while ($true) {
    try {
        docker exec cmx-redis redis-cli ping 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) { break }
    } catch {
        # Continue waiting
    }
    Write-Host -NoNewline "."
    Start-Sleep -Seconds 1
}
Write-Host " ✓" -ForegroundColor Green

# Wait for MinIO
Write-Host -NoNewline "   MinIO: "
while ($true) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:9000/minio/health/live" -UseBasicParsing -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) { break }
    } catch {
        # Continue waiting
    }
    Write-Host -NoNewline "."
    Start-Sleep -Seconds 1
}
Write-Host " ✓" -ForegroundColor Green

# Step 3: Start Supabase (if not already running)
Write-Host ""
Write-Host "🔷 Starting Supabase local instance..." -ForegroundColor Blue
Push-Location supabase

try {
    $status = supabase status 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "ℹ️  Supabase is already running" -ForegroundColor Yellow
    } else {
        supabase start
    }
} catch {
    supabase start
}

Pop-Location

# Step 4: Display service URLs
Write-Host ""
Write-Host "✅ All services are running!" -ForegroundColor Green
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════"
Write-Host "  📍 Service URLs"
Write-Host "═══════════════════════════════════════════════════════"
Write-Host "  PostgreSQL:        " -NoNewline; Write-Host "localhost:5432" -ForegroundColor Blue
Write-Host "  Redis:             " -NoNewline; Write-Host "localhost:6379" -ForegroundColor Blue
Write-Host "  MinIO API:         " -NoNewline; Write-Host "http://localhost:9000" -ForegroundColor Blue
Write-Host "  MinIO Console:     " -NoNewline; Write-Host "http://localhost:9001" -ForegroundColor Blue
Write-Host "  Redis Commander:   " -NoNewline; Write-Host "http://localhost:8081" -ForegroundColor Blue
Write-Host "  Supabase API:      " -NoNewline; Write-Host "http://localhost:54321" -ForegroundColor Blue
Write-Host "  Supabase Studio:   " -NoNewline; Write-Host "http://localhost:54323" -ForegroundColor Blue
Write-Host "  Inbucket (Email):  " -NoNewline; Write-Host "http://localhost:54324" -ForegroundColor Blue
Write-Host "═══════════════════════════════════════════════════════"
Write-Host ""
Write-Host "🎉 Ready to start developing!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. cd web-admin; npm run dev      (Start admin dashboard)"
Write-Host "  2. cd backend; npm run dev         (Start backend API)"
Write-Host ""
Write-Host "To stop services: npm run services:stop"
Write-Host ""
