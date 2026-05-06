# scripts/dev/start-services.ps1
# CleanMateX local bootstrap — starts Supabase then supporting Docker services.
# Requirements: Docker Desktop (6+ GB RAM allocated), Supabase CLI, PowerShell 5+
# Full guide: docs/dev/cleanmatex_infra_guide.md

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ─── Scoop PATH fix ───────────────────────────────────────────────────────────
# Scoop only updates the PATH of the session that ran its installer.
# New terminals (including VS Code) won't see supabase unless we add the shims
# folder here. This is safe to run every time — it's a no-op if already present.
$scoopShims = "$env:USERPROFILE\scoop\shims"
if (($env:PATH -split ';') -notcontains $scoopShims) {
    $env:PATH = "$scoopShims;$env:PATH"
}

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")

# ─── Helpers ──────────────────────────────────────────────────────────────────

function Wait-Port {
    param(
        [Parameter(Mandatory)][string]$TargetHost,
        [Parameter(Mandatory)][int]$Port,
        [int]$TimeoutSec = 90
    )
    $sw = [Diagnostics.Stopwatch]::StartNew()
    while ($sw.Elapsed.TotalSeconds -lt $TimeoutSec) {
        try {
            $client = New-Object System.Net.Sockets.TcpClient
            $iar = $client.BeginConnect($TargetHost, $Port, $null, $null)
            if ($iar.AsyncWaitHandle.WaitOne(1000) -and $client.Connected) {
                $client.Close()
                return $true
            }
            $client.Close()
        } catch { }
        Start-Sleep -Milliseconds 500
    }
    return $false
}

function Show-PortStatus {
    param([string]$Name, [int]$Port)
    if (Wait-Port -TargetHost "127.0.0.1" -Port $Port -TimeoutSec 2) {
        Write-Host ("  {0,-22}: OK   (:{1})" -f $Name, $Port) -ForegroundColor Green
    } else {
        Write-Host ("  {0,-22}: DOWN (:{1})" -f $Name, $Port) -ForegroundColor Red
    }
}

function Invoke-DockerCompose {
    param([string[]]$Arguments)
    docker compose @Arguments
    if ($LASTEXITCODE -ne 0) {
        docker-compose @Arguments
    }
}

# ─── Banner ───────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CleanMateX -- Start Services" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ─── [1/4] Docker Desktop ─────────────────────────────────────────────────────

Write-Host "[1/4] Checking Docker Desktop..." -ForegroundColor Yellow

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "  ERROR: Docker is not installed or not in PATH." -ForegroundColor Red
    Write-Host "  Install Docker Desktop from https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    exit 1
}

docker info | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: Docker Desktop is not running." -ForegroundColor Red
    Write-Host "  Start Docker Desktop and wait for it to fully initialise, then retry." -ForegroundColor Yellow
    exit 1
}

$memBytesStr = docker info --format "{{.MemTotal}}"
if ($memBytesStr -match '^\d+$') {
    $memGB = [math]::Round([int64]$memBytesStr / 1073741824, 1)
    if ($memGB -lt 4) {
        Write-Host "  WARNING: Docker has only ${memGB} GB RAM allocated." -ForegroundColor Red
        Write-Host "           Supabase requires at least 6 GB." -ForegroundColor Yellow
        Write-Host "           Go to Docker Desktop > Settings > Resources > Memory." -ForegroundColor Yellow
    } elseif ($memGB -lt 6) {
        Write-Host "  WARNING: Docker has ${memGB} GB RAM. 6+ GB recommended for stability." -ForegroundColor Yellow
    } else {
        Write-Host "  Docker is running (${memGB} GB RAM allocated)." -ForegroundColor Green
    }
} else {
    Write-Host "  Docker is running." -ForegroundColor Green
}

# ─── [2/4] Supabase CLI ───────────────────────────────────────────────────────

Write-Host ""
Write-Host "[2/4] Checking Supabase CLI..." -ForegroundColor Yellow

if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
    Write-Host "  ERROR: Supabase CLI not found in PATH." -ForegroundColor Red
    Write-Host "  Install via Scoop (only supported method on Windows):" -ForegroundColor Yellow
    Write-Host "    1. Install Scoop:  irm get.scoop.sh | iex" -ForegroundColor Yellow
    Write-Host "    2. Fix PATH:       [System.Environment]::SetEnvironmentVariable('PATH', `"`$env:USERPROFILE\scoop\shims;`" + [System.Environment]::GetEnvironmentVariable('PATH','User'), 'User')" -ForegroundColor Yellow
    Write-Host "    3. Restart terminal, then: scoop install supabase" -ForegroundColor Yellow
    Write-Host "  See: docs/dev/cleanmatex_infra_guide.md" -ForegroundColor Yellow
    exit 1
}

$supabaseVersion = supabase --version
Write-Host "  Supabase CLI $supabaseVersion found." -ForegroundColor Green

# ─── [3/4] Start Supabase ─────────────────────────────────────────────────────

Write-Host ""
Write-Host "[3/4] Starting Supabase..." -ForegroundColor Yellow

Push-Location $ProjectRoot
try {
    supabase start
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "  ERROR: supabase start failed (exit code $LASTEXITCODE)." -ForegroundColor Red
        Write-Host "  Common causes:" -ForegroundColor Yellow
        Write-Host "    * Docker Desktop needs more memory -- set to 6+ GB in Settings > Resources" -ForegroundColor Yellow
        Write-Host "    * Port conflict on 54321, 54322, or 54323" -ForegroundColor Yellow
        Write-Host "      Run: netstat -ano | findstr '5432'" -ForegroundColor Yellow
        Write-Host "    * supabase\config.toml missing -- verify the supabase\ folder exists" -ForegroundColor Yellow
        exit 1
    }
} finally {
    Pop-Location
}

Write-Host "  Waiting for Supabase API    (54321)..." -NoNewline -ForegroundColor Cyan
if (-not (Wait-Port "127.0.0.1" 54321 90)) { Write-Host " TIMEOUT" -ForegroundColor Red; exit 1 }
Write-Host " Ready" -ForegroundColor Green

Write-Host "  Waiting for Supabase DB     (54322)..." -NoNewline -ForegroundColor Cyan
if (-not (Wait-Port "127.0.0.1" 54322 90)) { Write-Host " TIMEOUT" -ForegroundColor Red; exit 1 }
Write-Host " Ready" -ForegroundColor Green

Write-Host "  Waiting for Supabase Studio (54323)..." -NoNewline -ForegroundColor Cyan
if (-not (Wait-Port "127.0.0.1" 54323 90)) { Write-Host " TIMEOUT" -ForegroundColor Red; exit 1 }
Write-Host " Ready" -ForegroundColor Green

# ─── [4/4] Docker Compose services ───────────────────────────────────────────

Write-Host ""
Write-Host "[4/4] Starting Docker services (redis, minio, redis-commander)..." -ForegroundColor Yellow

Push-Location $ProjectRoot
try {
    Invoke-DockerCompose @("up", "-d", "redis", "redis-commander", "minio")
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ERROR: docker compose up failed." -ForegroundColor Red
        exit 1
    }
    Write-Host "  Docker services started." -ForegroundColor Green
} finally {
    Pop-Location
}

Write-Host "  Waiting for Redis     (6379)..." -NoNewline -ForegroundColor Cyan
if (-not (Wait-Port "127.0.0.1" 6379 30)) { Write-Host " TIMEOUT" -ForegroundColor Yellow } else { Write-Host " Ready" -ForegroundColor Green }

Write-Host "  Waiting for MinIO API (9000)..." -NoNewline -ForegroundColor Cyan
if (-not (Wait-Port "127.0.0.1" 9000 30)) { Write-Host " TIMEOUT" -ForegroundColor Yellow } else { Write-Host " Ready" -ForegroundColor Green }

# ─── Summary ──────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Services Status" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Show-PortStatus "Supabase API"     54321
Show-PortStatus "Supabase DB"      54322
Show-PortStatus "Supabase Studio"  54323
Show-PortStatus "Redis"            6379
Show-PortStatus "Redis Commander"  8081
Show-PortStatus "MinIO API"        9000
Show-PortStatus "MinIO Console"    9001

Write-Host ""
Write-Host "  URLs:" -ForegroundColor Yellow
Write-Host "    Supabase Studio  : http://127.0.0.1:54323"
Write-Host "    Supabase API     : http://127.0.0.1:54321"
Write-Host "    Redis Commander  : http://127.0.0.1:8081"
Write-Host "    MinIO Console    : http://127.0.0.1:9001  (user: minioadmin / minioadmin123)"

Write-Host ""
Write-Host "  Next steps:" -ForegroundColor Yellow
Write-Host "    cd web-admin"
Write-Host "    npm run dev"
Write-Host ""
