# scripts/dev/status-services.ps1
# Shows the current state of all CleanMateX local services.
# Full guide: docs/dev/cleanmatex_infra_guide.md

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

# ─── Scoop PATH fix ───────────────────────────────────────────────────────────
$scoopShims = "$env:USERPROFILE\scoop\shims"
if (($env:PATH -split ';') -notcontains $scoopShims) {
    $env:PATH = "$scoopShims;$env:PATH"
}

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")

function Test-Port {
    param(
        [Parameter(Mandatory)][string]$TargetHost,
        [Parameter(Mandatory)][int]$Port,
        [int]$TimeoutMs = 800
    )
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $iar = $client.BeginConnect($TargetHost, $Port, $null, $null)
        $ok = $iar.AsyncWaitHandle.WaitOne($TimeoutMs)
        $connected = $ok -and $client.Connected
        $client.Close()
        return $connected
    } catch {
        return $false
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CleanMateX -- Services Status" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ─── Supabase CLI status ──────────────────────────────────────────────────────

Write-Host "[1/3] Supabase status" -ForegroundColor Yellow
Push-Location $ProjectRoot
try {
    supabase status
} catch {
    Write-Host "  Supabase CLI not found or not running." -ForegroundColor Red
} finally {
    Pop-Location
}

# ─── Docker Compose status ────────────────────────────────────────────────────

Write-Host ""
Write-Host "[2/3] Docker Compose services" -ForegroundColor Yellow
Push-Location $ProjectRoot
try {
    docker compose ps
} catch {
    try {
        docker-compose ps
    } catch {
        Write-Host "  docker compose not available." -ForegroundColor Red
    }
} finally {
    Pop-Location
}

# ─── Port reachability ────────────────────────────────────────────────────────

Write-Host ""
Write-Host "[3/3] Port reachability" -ForegroundColor Yellow

$services = @(
    @{ Name = "Supabase API";    Port = 54321 },
    @{ Name = "Supabase DB";     Port = 54322 },
    @{ Name = "Supabase Studio"; Port = 54323 },
    @{ Name = "Redis";           Port = 6379  },
    @{ Name = "Redis Commander"; Port = 8081  },
    @{ Name = "MinIO API";       Port = 9000  },
    @{ Name = "MinIO Console";   Port = 9001  },
    @{ Name = "Web Admin (dev)"; Port = 3000  }
)

foreach ($svc in $services) {
    $ok    = Test-Port -TargetHost "127.0.0.1" -Port $svc.Port
    $color = if ($ok) { "Green" } else { "Red" }
    $state = if ($ok) { "UP  " } else { "DOWN" }
    Write-Host ("  {0,-22}: {1} (:{2})" -f $svc.Name, $state, $svc.Port) -ForegroundColor $color
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Status check complete." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
