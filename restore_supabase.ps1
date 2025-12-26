<# ============================================================
 CleanMateX RESTORE TEST (PowerShell / Windows)

 Restores a .dump (custom pg_dump archive) into a fresh Postgres
 container, then runs sanity checks.

 Requirements:
  - Docker Desktop running
  - A .dump file produced by the backup script (pg_dump -Fc)
  - Optional: psql inside container is used (no local psql needed)

 Usage examples:
  1) Restore latest dump from a run folder:
     .\Supabase_DB_Restore_Test.ps1 -DumpFile "F:\...\cleanmatex_full_all_schemas_YYYYMMDD_HHMMSS.dump"

  2) Restore and keep container (for manual inspection):
     .\Supabase_DB_Restore_Test.ps1 -DumpFile "F:\...\file.dump" -KeepContainer

 Output:
  - Prints pass/fail checks
  - Writes logs into a restore_run_YYYY... folder next to DumpFile

Run Example:
.\Supabase_DB_Restore_Test.ps1 -DumpFile "F:\JhApps_doc\CleanMateX_Jh\Backups\DB_Backup\run_20251215_125720xx\db\cleanmatex_full_all_schemas_20251215_125720.dump"

============================================================ #>

param(
  [Parameter(Mandatory=$true)]
  [string]$DumpFile,

  [string]$RestoreDbName = "cmx_restore_test",

  [string]$PgUser = "postgres",

  [string]$PgPassword = "postgres",

  [int]$HostPort = 55432,

  [switch]$KeepContainer
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Test-Cmd([string]$name) {
  return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

function Write-Section([string]$title) {
  Write-Host ""
  Write-Host "============================================================"
  Write-Host $title
  Write-Host "============================================================"
}

if (-not (Test-Path $DumpFile)) { throw "Dump file not found: $DumpFile" }
if (-not (Test-Cmd "docker")) { throw "docker not found in PATH. Install Docker Desktop and reopen PowerShell." }

$dumpInfo = Get-Item $DumpFile
if ($dumpInfo.Length -lt 1024) { throw "Dump file is too small; likely invalid: $DumpFile" }

# Logs folder beside dump
$parentDir  = Split-Path -Parent $DumpFile
$timestamp  = Get-Date -Format "yyyyMMdd_HHmmss"
$runDir     = Join-Path $parentDir ("restore_run_" + $timestamp)
New-Item -ItemType Directory -Force -Path $runDir | Out-Null

$logFile = Join-Path $runDir "restore_test.log"
Start-Transcript -Path $logFile | Out-Null

Write-Section "0) Preflight"
Write-Host "DumpFile      : $DumpFile"
Write-Host "RunDir        : $runDir"
Write-Host "RestoreDbName : $RestoreDbName"
Write-Host "HostPort      : $HostPort"

# Unique container name
$containerName = "cmx-restore-test-$timestamp"

Write-Section "1) Start fresh Postgres container"
docker run -d `
  --name $containerName `
  -e "POSTGRES_PASSWORD=$PgPassword" `
  -e "POSTGRES_USER=$PgUser" `
  -e "POSTGRES_DB=$RestoreDbName" `
  -p "$HostPort:5432" `
  postgres:16-alpine | Out-Null

Write-Host "Started container: $containerName"

# Wait for DB readiness
Write-Section "2) Wait for Postgres ready"
$maxWaitSec = 60
$ready = $false
for ($i=0; $i -lt $maxWaitSec; $i++) {
  try {
    $out = docker exec $containerName sh -lc "pg_isready -U $PgUser -d $RestoreDbName"
    if ($out -match "accepting connections") { $ready = $true; break }
  } catch {}
  Start-Sleep -Seconds 1
}

if (-not $ready) {
  docker logs $containerName | Out-File (Join-Path $runDir "postgres_container_logs.txt") -Encoding utf8
  throw "Postgres did not become ready within $maxWaitSec seconds."
}
Write-Host "OK: Postgres is ready"

Write-Section "3) Copy dump into container"
$containerDumpPath = "/tmp/restore.dump"
docker cp "$DumpFile" "${containerName}:$containerDumpPath"
Write-Host "OK: Copied dump into container: $containerDumpPath"

Write-Section "4) Restore (pg_restore)"
# Restore into the target DB.
# --clean --if-exists cleans objects if needed. Use with caution; safe here (fresh DB).
docker exec $containerName sh -lc "pg_restore -U $PgUser -d $RestoreDbName --clean --if-exists --verbose $containerDumpPath" `
  | Out-File (Join-Path $runDir "pg_restore_verbose.txt") -Encoding utf8

Write-Host "OK: Restore completed (see pg_restore_verbose.txt)"

Write-Section "5) Sanity checks"
# Save full schema list
docker exec $containerName sh -lc "psql -U $PgUser -d $RestoreDbName -Atc `"select schema_name from information_schema.schemata order by 1;`"" `
  | Out-File (Join-Path $runDir "schemas.txt") -Encoding utf8

# Save table counts for key schemas
docker exec $containerName sh -lc "psql -U $PgUser -d $RestoreDbName -Atc `"select table_schema, count(*) as tables from information_schema.tables where table_type='BASE TABLE' group by 1 order by 1;`"" `
  | Out-File (Join-Path $runDir "tables_by_schema.txt") -Encoding utf8

# Check existence of your core tables (adjust list if needed)
$mustHave = @(
  "public.org_tenants_mst",
  "public.org_orders_mst",
  "public.org_order_items_dtl",
  "public.sys_auth_permissions"
)

$checkResults = @()
foreach ($t in $mustHave) {
  $schema, $table = $t.Split(".")
  $exists = docker exec $containerName sh -lc "psql -U $PgUser -d $RestoreDbName -Atc `"select to_regclass('$schema.$table') is not null;`"" 2>$null
  $ok = ($exists -match "t")
  $checkResults += [PSCustomObject]@{ table=$t; exists=$ok }
}

$checkResults | Format-Table -AutoSize | Out-String | Out-File (Join-Path $runDir "must_have_tables.txt") -Encoding utf8
$failed = $checkResults | Where-Object { $_.exists -eq $false }

if ($failed.Count -gt 0) {
  Write-Host "❌ Restore validation FAILED. Missing tables:"
  $failed | ForEach-Object { Write-Host (" - " + $_.table) }
  throw "Restore test failed."
}

Write-Host "✅ Restore validation PASSED (core tables exist)."

# Optional: quick row counts (best effort; may fail if RLS/permissions are strict, but on plain Postgres restore it should work)
Write-Section "6) Optional row count snapshot"
$countsFile = Join-Path $runDir "row_counts.txt"
foreach ($t in $mustHave) {
  try {
    $cnt = docker exec $containerName sh -lc "psql -U $PgUser -d $RestoreDbName -Atc `"select count(*) from $t;`"" 2>$null
    "$t => $cnt" | Out-File $countsFile -Append -Encoding utf8
  } catch {
    "$t => (count failed: $($_.Exception.Message))" | Out-File $countsFile -Append -Encoding utf8
  }
}
Write-Host "OK: Row counts written -> $countsFile"

Write-Section "7) Finish"
Stop-Transcript | Out-Null

Write-Host ""
Write-Host "DONE."
Write-Host "Logs folder: $runDir"
Write-Host "Container  : $containerName"
Write-Host ("KeepContainer: " + [bool]$KeepContainer)

if (-not $KeepContainer) {
  Write-Host "Cleaning up container..."
  docker rm -f $containerName | Out-Null
  Write-Host "OK: container removed"
} else {
  Write-Host "Container kept. Connect via:"
  Write-Host "  docker exec -it $containerName sh"
  Write-Host "  psql -U $PgUser -d $RestoreDbName"
}
