# scripts/smoke-test.ps1
# Validates that all CleanMateX infrastructure services are up and responding.
# Run after start-services.ps1 to confirm the environment is healthy.
# Full guide: docs/dev/cleanmatex_infra_guide.md

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

$script:Passed  = 0
$script:Failed  = 0

# ─── Helper ───────────────────────────────────────────────────────────────────

function Test-Service {
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][scriptblock]$Test
    )
    Write-Host -NoNewline ("  {0,-28} " -f $Name)
    try {
        $ok = & $Test
        if ($ok -eq $true) {
            Write-Host "PASS" -ForegroundColor Green
            $script:Passed++
        } else {
            Write-Host "FAIL" -ForegroundColor Red
            $script:Failed++
        }
    } catch {
        Write-Host "FAIL  ($_)" -ForegroundColor Red
        $script:Failed++
    }
}

function Test-TcpPort {
    param([int]$Port, [int]$TimeoutMs = 2000)
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $iar = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
        $ok = $iar.AsyncWaitHandle.WaitOne($TimeoutMs)
        $connected = $ok -and $client.Connected
        $client.Close()
        return $connected
    } catch {
        return $false
    }
}

function Test-Http {
    param([string]$Uri, [int[]]$AcceptedCodes = @(200))
    $r = Invoke-WebRequest -Uri $Uri -UseBasicParsing -ErrorAction SilentlyContinue -TimeoutSec 5
    return ($null -ne $r -and $AcceptedCodes -contains $r.StatusCode)
}

# ─── Banner ───────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CleanMateX -- Infrastructure Smoke Test" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ─── Supabase ─────────────────────────────────────────────────────────────────

Write-Host "Supabase:" -ForegroundColor Yellow

Test-Service "API (54321)" {
    # REST endpoint returns 200 or non-5xx when healthy
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:54321/rest/v1/" -UseBasicParsing -ErrorAction SilentlyContinue -TimeoutSec 5
    return ($null -ne $r -and $r.StatusCode -lt 500)
}

Test-Service "DB / Postgres (54322)" {
    Test-TcpPort 54322
}

Test-Service "Studio (54323)" {
    Test-Http "http://127.0.0.1:54323" @(200)
}

# ─── Docker Compose services ──────────────────────────────────────────────────

Write-Host ""
Write-Host "Docker services:" -ForegroundColor Yellow

Test-Service "Redis (6379)" {
    $result = docker exec cmx-redis redis-cli ping 2>&1
    return ($result -match "PONG")
}

Test-Service "Redis Commander (8081)" {
    Test-Http "http://127.0.0.1:8081" @(200)
}

Test-Service "MinIO API (9000)" {
    Test-Http "http://127.0.0.1:9000/minio/health/live" @(200)
}

Test-Service "MinIO Console (9001)" {
    # Console returns 200 or redirect (302) on the root path
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:9001" -UseBasicParsing -ErrorAction SilentlyContinue -TimeoutSec 5 -MaximumRedirection 0
    return ($null -ne $r -and $r.StatusCode -lt 500)
}

Test-Service "Docker Network" {
    docker network inspect cleanmatex_cmx-network | Out-Null
    return ($LASTEXITCODE -eq 0)
}

# ─── Summary ──────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ("  Passed: {0}   Failed: {1}" -f $script:Passed, $script:Failed) -ForegroundColor $(if ($script:Failed -eq 0) { "Green" } else { "Yellow" })
Write-Host "========================================" -ForegroundColor Cyan

if ($script:Failed -eq 0) {
    Write-Host "  All tests passed. Infrastructure is healthy." -ForegroundColor Green
    Write-Host ""
    exit 0
} else {
    Write-Host "  $($script:Failed) test(s) failed." -ForegroundColor Red
    Write-Host "  Run .\scripts\dev\status-services.ps1 for details." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}
