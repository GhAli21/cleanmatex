# scripts/dev/check-prerequisites.ps1
# Validates that this machine meets all requirements to run CleanMateX locally.
# Run this FIRST on a new machine before start-services.ps1.
# Full guide: docs/dev/cleanmatex_infra_guide.md

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

# ─── Scoop PATH fix ───────────────────────────────────────────────────────────
$scoopShims = "$env:USERPROFILE\scoop\shims"
if (($env:PATH -split ';') -notcontains $scoopShims) {
    $env:PATH = "$scoopShims;$env:PATH"
}

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$script:Passed   = 0
$script:Warnings = 0
$script:Failed   = 0

# ─── Helpers ──────────────────────────────────────────────────────────────────

function Write-Pass {
    param([string]$Msg)
    Write-Host "  [PASS] $Msg" -ForegroundColor Green
    $script:Passed++
}

function Write-Warn {
    param([string]$Msg)
    Write-Host "  [WARN] $Msg" -ForegroundColor Yellow
    $script:Warnings++
}

function Write-Fail {
    param([string]$Msg)
    Write-Host "  [FAIL] $Msg" -ForegroundColor Red
    $script:Failed++
}

# ─── Banner ───────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CleanMateX -- Prerequisites Check" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ─── 1. Docker Desktop ────────────────────────────────────────────────────────

Write-Host "Docker Desktop:" -ForegroundColor Yellow

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Fail "Docker not found in PATH."
    Write-Host "         Install: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
} else {
    Write-Pass "Docker CLI found ($(docker --version))."

    docker info | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Docker Desktop is not running. Start it and wait for it to initialise."
    } else {
        Write-Pass "Docker Desktop is running."

        # Memory check
        $memBytesStr = docker info --format "{{.MemTotal}}"
        if ($memBytesStr -match '^\d+$') {
            $memGB = [math]::Round([int64]$memBytesStr / 1073741824, 1)
            if ($memGB -lt 4) {
                Write-Fail "Docker has only ${memGB} GB RAM. Supabase requires 6+ GB. (Docker Desktop > Settings > Resources > Memory)"
            } elseif ($memGB -lt 6) {
                Write-Warn "Docker has ${memGB} GB RAM. 6+ GB recommended. (Docker Desktop > Settings > Resources > Memory)"
            } else {
                Write-Pass "Docker memory: ${memGB} GB."
            }
        }
    }
}

# ─── 2. Supabase CLI ──────────────────────────────────────────────────────────

Write-Host ""
Write-Host "Supabase CLI:" -ForegroundColor Yellow

if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
    Write-Fail "Supabase CLI not found. Install via Scoop: scoop install supabase (npm global install is NOT supported). See docs/dev/cleanmatex_infra_guide.md section 3.2."
} else {
    Write-Pass "Supabase CLI found ($(supabase --version))."
}

# ─── 3. Node.js ───────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "Node.js:" -ForegroundColor Yellow

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Fail "Node.js not found. Install v20+ from https://nodejs.org"
} else {
    $nodeVersion = node --version
    if ($nodeVersion -match 'v(\d+)') {
        $major = [int]$Matches[1]
        if ($major -lt 20) {
            Write-Fail "Node.js $nodeVersion found — v20 or higher required."
        } else {
            Write-Pass "Node.js $nodeVersion."
        }
    } else {
        Write-Warn "Could not parse Node.js version: $nodeVersion"
    }
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Fail "npm not found. It should ship with Node.js."
} else {
    Write-Pass "npm found ($(npm --version))."
}

# ─── 4. Environment files ─────────────────────────────────────────────────────

Write-Host ""
Write-Host "Environment files:" -ForegroundColor Yellow

$envLocal = Join-Path $ProjectRoot "web-admin\.env.local"
if (Test-Path $envLocal) {
    Write-Pass "web-admin\.env.local exists."
} else {
    Write-Warn "web-admin\.env.local not found. Copy it from another machine or create it before running npm run dev."
}

# ─── 5. Port availability ─────────────────────────────────────────────────────

Write-Host ""
Write-Host "Port availability (checking for conflicts):" -ForegroundColor Yellow

$ports = @(
    @{ Port = 54321; Label = "Supabase API" },
    @{ Port = 54322; Label = "Supabase DB" },
    @{ Port = 54323; Label = "Supabase Studio" },
    @{ Port = 6379;  Label = "Redis" },
    @{ Port = 8081;  Label = "Redis Commander" },
    @{ Port = 9000;  Label = "MinIO API" },
    @{ Port = 9001;  Label = "MinIO Console" },
    @{ Port = 3000;  Label = "Web Admin" }
)

$anyConflict = $false
foreach ($p in $ports) {
    $conn = Get-NetTCPConnection -LocalPort $p.Port -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        $pid  = ($conn | Select-Object -First 1).OwningProcess
        $proc = (Get-Process -Id $pid -ErrorAction SilentlyContinue).Name
        $procLabel = if ($proc) { " (PID $pid — $proc)" } else { " (PID $pid)" }
        Write-Warn "Port $($p.Port) ($($p.Label)) is already in use$procLabel."
        $anyConflict = $true
    }
}

if (-not $anyConflict) {
    Write-Pass "All required ports are free."
}

# ─── 6. Supabase config ───────────────────────────────────────────────────────

Write-Host ""
Write-Host "Supabase project:" -ForegroundColor Yellow

$configToml = Join-Path $ProjectRoot "supabase\config.toml"
if (Test-Path $configToml) {
    Write-Pass "supabase\config.toml exists."
} else {
    Write-Fail "supabase\config.toml not found. Is this the correct project root? ($ProjectRoot)"
}

$migrationsDir = Join-Path $ProjectRoot "supabase\migrations"
if (Test-Path $migrationsDir) {
    $count = (Get-ChildItem $migrationsDir -Filter "*.sql" -ErrorAction SilentlyContinue).Count
    Write-Pass "supabase\migrations\ exists ($count migration files)."
} else {
    Write-Fail "supabase\migrations\ not found."
}

# ─── Summary ──────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ("  Passed: {0}   Warnings: {1}   Failed: {2}" -f $script:Passed, $script:Warnings, $script:Failed)
Write-Host "========================================" -ForegroundColor Cyan

if ($script:Failed -gt 0) {
    Write-Host "  Fix the FAIL items above before running start-services.ps1." -ForegroundColor Red
    Write-Host ""
    exit 1
} elseif ($script:Warnings -gt 0) {
    Write-Host "  Prerequisites met with warnings. Review WARN items above." -ForegroundColor Yellow
    Write-Host "  Ready to run: .\scripts\dev\start-services.ps1" -ForegroundColor Green
    Write-Host ""
    exit 0
} else {
    Write-Host "  All prerequisites satisfied." -ForegroundColor Green
    Write-Host "  Ready to run: .\scripts\dev\start-services.ps1" -ForegroundColor Green
    Write-Host ""
    exit 0
}
