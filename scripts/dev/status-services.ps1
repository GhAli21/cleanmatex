# scripts/dev/status-services.ps1
# Checks Supabase and supporting Docker services for CleanMateX.

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Test-Port {
  param(
    [string]$TargetHost,
    [int]$Port,
    [int]$TimeoutSec = 1
  )
  $sw = [Diagnostics.Stopwatch]::StartNew()
  while ($sw.Elapsed.TotalSeconds -lt $TimeoutSec) {
    try {
      $client = New-Object System.Net.Sockets.TcpClient
      $iar = $client.BeginConnect($TargetHost, $Port, $null, $null)
      $ok = $iar.AsyncWaitHandle.WaitOne(300)
      if ($ok -and $client.Connected) {
        $client.Close()
        return $true
      }
      $client.Close()
    } catch { }
  }
  return $false
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CleanMateX Services Status" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Supabase status
Write-Host "[1/3] Supabase status" -ForegroundColor Yellow
try {
  supabase status
} catch {
  Write-Host "Supabase CLI not found or not running." -ForegroundColor Red
}

# Docker services status
Write-Host "`n[2/3] Docker compose ps" -ForegroundColor Yellow
try {
  docker compose ps
} catch {
  try { docker-compose ps } catch {
    Write-Host "docker compose not found." -ForegroundColor Red
  }
}

# Ports check
Write-Host "`n[3/3] Ports check" -ForegroundColor Yellow
$services = @(
  @{Name="Supabase API"; Port=54321},
  @{Name="Supabase Studio"; Port=54323},
  @{Name="Supabase DB"; Port=54322},
  @{Name="Redis"; Port=6379},
  @{Name="Redis Commander"; Port=8081},
  @{Name="MinIO API"; Port=9000},
  @{Name="MinIO Console"; Port=9001}
)

foreach ($svc in $services) {
  $ok = Test-Port -TargetHost "127.0.0.1" -Port $svc.Port
  $color = if ($ok) { "Green" } else { "Red" }
  $state = if ($ok) { "OK" } else { "DOWN" }
  Write-Host ("{0,-18} : {1} ({2})" -f $svc.Name, $state, $svc.Port) -ForegroundColor $color
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Status Check Complete" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
