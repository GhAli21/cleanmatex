# scripts/dev/gen-types.ps1
# Regenerates Supabase TypeScript types for cleanmatex (tenant) and/or cleanmatexsaas (HQ),
# then pulls Prisma (tenant web-admin schema only).
# -Scope tenant|hq|all (default: all)
# -Source linked|local (default: linked) -- linked = remote/hosted project, local = local Postgres (supabase start)
# -SkipPrisma regenerates types only, no prisma:pull.
# Full guide: docs/dev/cleanmatex_infra_guide.md

param(
    [ValidateSet("tenant", "hq", "all")]
    [string]$Scope = "all",
    [ValidateSet("linked", "local")]
    [string]$Source = "linked",
    [switch]$SkipPrisma
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$SaasRoot = Join-Path $ProjectRoot "..\cleanmatexsaas"
$SourceFlag = if ($Source -eq "local") { "--local" } else { "--linked" }

function Invoke-GenTypes {
    param(
        [Parameter(Mandatory)][string]$OutFile
    )
    Write-Host "  -> $OutFile" -ForegroundColor Gray
    $outDir = Split-Path -Parent $OutFile
    if (-not (Test-Path $outDir)) {
        New-Item -ItemType Directory -Force -Path $outDir | Out-Null
    }
    supabase gen types typescript $SourceFlag | Out-File -Encoding utf8 $OutFile
    if ($LASTEXITCODE -ne 0) {
        throw "supabase gen types typescript $SourceFlag failed (exit $LASTEXITCODE) while generating $OutFile"
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CleanMateX -- Regenerating DB Types ($Scope, $Source)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($Scope -eq "tenant" -or $Scope -eq "all") {
    Invoke-GenTypes -OutFile (Join-Path $ProjectRoot "web-admin\types\database.ts")
    Invoke-GenTypes -OutFile (Join-Path $ProjectRoot "web-admin\types\database.generated.ts")
}

if ($Scope -eq "hq" -or $Scope -eq "all") {
    Invoke-GenTypes -OutFile (Join-Path $SaasRoot "platform-web\lib\types\database.ts")
    Invoke-GenTypes -OutFile (Join-Path $SaasRoot "platform-api\src\database\database.types.ts")
    Invoke-GenTypes -OutFile (Join-Path $SaasRoot "platform-api\src\database\types\database.types.ts")
}

# prisma:pull syncs web-admin's own Prisma schema; irrelevant when only HQ types were requested.
if ($Scope -eq "hq" -or $SkipPrisma) {
    Write-Host ""
    Write-Host "Done (types only; prisma:pull skipped)." -ForegroundColor Green
    return
}

$prismaPullScript = if ($Source -eq "local") { "prisma:pull:local" } else { "prisma:pull:remote" }

Write-Host ""
Write-Host "Types generated. Running $prismaPullScript..." -ForegroundColor Cyan
Write-Host ""

Push-Location $ProjectRoot
try {
    npm run $prismaPullScript
    if ($LASTEXITCODE -ne 0) {
        throw "npm run $prismaPullScript failed (exit $LASTEXITCODE)"
    }
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "Done." -ForegroundColor Green
