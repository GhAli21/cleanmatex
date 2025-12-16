# scripts/dev/start-services.ps1
# CleanMateX local bootstrap: Supabase + selected Docker services
# Requirements: Docker Desktop, Supabase CLI, PowerShell 5+ or 7+

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Wait-Port {
  param(
    [Parameter(Mandatory=$true)][string]$TargetHost,
    [Parameter(Mandatory=$true)][int]$Port,
    [int]$TimeoutSec = 60
  )
  $sw = [Diagnostics.Stopwatch]::StartNew()
  while ($sw.Elapsed.TotalSeconds -lt $TimeoutSec) {
    try {
      $client = New-Object System.Net.Sockets.TcpClient
      $iar = $client.BeginConnect($TargetHost, $Port, $null, $null)
      $ok = $iar.AsyncWaitHandle.WaitOne(1000)
      if ($ok -and $client.Connected) { $client.Close(); return $true }
      $client.Close()
    } catch { }
    Start-Sleep -Milliseconds 400
  }
  return $false
}

function Invoke-DockerCompose {
  param([Parameter(Mandatory=$true)][string[]]$Args)
  try {
    docker compose @Args
  } catch {
    docker-compose @Args
  }
}

function Test-Port-Status {
  param([string]$Name, [int]$Port)
  if (Wait-Port -TargetHost "127.0.0.1" -Port $Port -TimeoutSec 1) {
    Write-Host ("{0,-20} : OK   ({1})" -f $Name, $Port) -ForegroundColor Green
  } else {
    Write-Host ("{0,-20} : DOWN ({1})" -f $Name, $Port) -ForegroundColor Red
  }
}

Write-Host "Starting Supabase..." -ForegroundColor Cyan
try {
  supabase start | Out-Null
} catch {
  Write-Host "supabase start failed or already running. Continuing." -ForegroundColor Yellow
}

Write-Host "Waiting for Supabase API (54321)..." -ForegroundColor Cyan
if (-not (Wait-Port -TargetHost "127.0.0.1" -Port 54321 -TimeoutSec 60)) {
  Write-Host "Supabase API not ready on 54321." -ForegroundColor Red
  exit 1
}

Write-Host "Waiting for Supabase Studio (54323)..." -ForegroundColor Cyan
if (-not (Wait-Port -TargetHost "127.0.0.1" -Port 54323 -TimeoutSec 60)) {
  Write-Host "Supabase Studio not ready on 54323." -ForegroundColor Red
  exit 1
}

# Optional: wait for Postgres port (Supabase DB)
Write-Host "Waiting for Supabase DB (54322)..." -ForegroundColor Cyan
if (-not (Wait-Port -TargetHost "127.0.0.1" -Port 54322 -TimeoutSec 60)) {
  Write-Host "Supabase DB not ready on 54322." -ForegroundColor Red
  exit 1
}

Write-Host "Starting Docker services (redis, redis-commander, minio)..." -ForegroundColor Cyan
try {
  Invoke-DockerCompose -Args @("up","-d","redis","redis-commander","minio") | Out-Null
} catch {
  Write-Host "docker compose up failed." -ForegroundColor Red
  throw
}

Write-Host ""
Write-Host "Services status:" -ForegroundColor Yellow
Test-Port-Status "Supabase API" 54321
Test-Port-Status "Supabase Studio" 54323
Test-Port-Status "Supabase DB" 54322
Test-Port-Status "Redis" 6379
Test-Port-Status "Redis Commander" 8081
Test-Port-Status "MinIO API" 9000
Test-Port-Status "MinIO Console" 9001

Write-Host ""
Write-Host "URLs:" -ForegroundColor Yellow
Write-Host "  Supabase Studio : http://127.0.0.1:54323"
Write-Host "  Supabase API    : http://127.0.0.1:54321"
Write-Host "  Redis Commander : http://127.0.0.1:8081"
Write-Host "  MinIO Console   : http://127.0.0.1:9001"

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  cd web-admin"
Write-Host "  npm run dev"
