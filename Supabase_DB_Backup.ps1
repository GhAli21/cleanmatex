<# ============================================================
 CleanMateX FULL LOCAL BACKUP (PowerShell / Windows)

 Backups created:
  1) FULL Postgres custom archive (.dump) using pg_dump INSIDE the DB container
     then docker cp to Windows (binary-safe; no corruption).
     - Includes ALL schemas (public + auth + storage + extensions)
  2) Schema-only SQL (all schemas) using pg_dump inside container (readable)
  3) Optional Supabase CLI SQL dump (secondary artifact; version-dependent)
  4) supabase/ folder snapshot (migrations + config)
  5) Manifest + SHA256 hashes
  6) ZIP bundle

 Requirements:
  - Docker Desktop running
  - Supabase local stack running (supabase start)
  - supabase CLI installed (optional; only for optional SQL dump)

 Usage:
  .\Supabase_DB_Backup.ps1 -ProjectRoot "F:\jhapp\cleanmatex" -BackupRoot "F:\JhApps_doc\CleanMateX_Jh\Backups\DB_Backup"

 Notes:
  - No need to install pg_dump on Windows.
============================================================ #>

param(
  [string]$ProjectRoot = (Get-Location).Path,
  [string]$BackupRoot  = "F:\JhApps_doc\CleanMateX_Jh\Backups\DB_Backup",
  [switch]$AlsoSupabaseSqlDump = $true
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

# -----------------------
# 0) Preflight
# -----------------------
Write-Section "0) Preflight"

if (-not (Test-Path $ProjectRoot)) { throw "ProjectRoot not found: $ProjectRoot" }
Set-Location $ProjectRoot

if (-not (Test-Path (Join-Path $ProjectRoot "supabase"))) {
  throw "No supabase/ folder found in ProjectRoot. Run this from your Supabase project folder."
}

if (-not (Test-Cmd "docker")) {
  throw "docker not found in PATH. Install Docker Desktop and reopen PowerShell."
}

if ($AlsoSupabaseSqlDump -and (-not (Test-Cmd "supabase"))) {
  Write-Host "INFO: supabase CLI not found. Will skip Supabase SQL dump."
  $AlsoSupabaseSqlDump = $false
}

# Create run folders
$timestamp   = Get-Date -Format "yyyyMMdd_HHmmss"
$runDir      = Join-Path $BackupRoot ("run_" + $timestamp)
$dbDir       = Join-Path $runDir "db"
$metaDir     = Join-Path $runDir "meta"

New-Item -ItemType Directory -Force -Path $dbDir,$metaDir | Out-Null

# Logging
$logFile = Join-Path $runDir "backup.log"
Start-Transcript -Path $logFile | Out-Null

Write-Host "ProjectRoot : $ProjectRoot"
Write-Host "BackupRoot  : $BackupRoot"
Write-Host "RunDir      : $runDir"

# -----------------------
# 1) Snapshot supabase folder (migrations/config)
# -----------------------
Write-Section "1) Snapshot supabase/ folder"
try {
  Copy-Item -Recurse -Force (Join-Path $ProjectRoot "supabase") (Join-Path $metaDir "supabase") -ErrorAction Stop
  Write-Host "OK: supabase/ copied"
} catch {
  throw "Failed to copy supabase/: $($_.Exception.Message)"
}

# Optional: supabase status (best effort)
if ($AlsoSupabaseSqlDump) {
  try { supabase status | Out-File (Join-Path $metaDir "supabase_status.txt") -Encoding utf8 } catch {}
}

# -----------------------
# 2) FULL DB backup via Docker (binary-safe)
# -----------------------
Write-Section "2) FULL DB backup via Docker (pg_dump inside container + docker cp)"

# Find Supabase DB container name
$containers = docker ps --format "{{.Names}}"
$dbContainer = $containers | Where-Object { $_ -match "supabase.*db" } | Select-Object -First 1

if (-not $dbContainer) {
  Write-Host "Containers found:"
  $containers | ForEach-Object { Write-Host " - $_" }
  throw "Could not find Supabase DB container. Ensure 'supabase start' is running."
}

Write-Host "Using DB container: $dbContainer"

# Local output files
$fullDumpFile   = Join-Path $dbDir ("cleanmatex_full_all_schemas_" + $timestamp + ".dump")
$schemaSqlFile  = Join-Path $dbDir ("cleanmatex_schema_all_schemas_" + $timestamp + ".sql")

# Temp files inside container
$containerDump   = "/tmp/cleanmatex_full_$timestamp.dump"
$containerSchema = "/tmp/cleanmatex_schema_$timestamp.sql"

# Create dump INSIDE container
docker exec $dbContainer sh -lc "pg_dump -U postgres -d postgres -Fc -f $containerDump"
if ($LASTEXITCODE -ne 0) { throw "pg_dump custom failed inside container." }

docker exec $dbContainer sh -lc "pg_dump -U postgres -d postgres --schema-only --no-owner --no-acl -f $containerSchema"
if ($LASTEXITCODE -ne 0) { throw "pg_dump schema-only failed inside container." }

# Validate archive INSIDE container (quick)
docker exec $dbContainer sh -lc "pg_restore -l $containerDump | head -n 20" | Out-File (Join-Path $dbDir "pg_restore_list_head_from_container.txt") -Encoding utf8
if ($LASTEXITCODE -ne 0) { throw "pg_restore validation failed inside container (archive may be invalid)." }

# Copy OUT (binary-safe)
docker cp "${dbContainer}:$containerDump"   "$fullDumpFile"
docker cp "${dbContainer}:$containerSchema" "$schemaSqlFile"

# Cleanup temp files
docker exec $dbContainer sh -lc "rm -f $containerDump $containerSchema" | Out-Null

# Sanity checks
if (-not (Test-Path $fullDumpFile)) { throw "Custom dump file missing: $fullDumpFile" }
if ((Get-Item $fullDumpFile).Length -lt 1024) { throw "Custom dump file is too small; backup likely failed." }

if (-not (Test-Path $schemaSqlFile)) { throw "Schema SQL file missing: $schemaSqlFile" }
if ((Get-Item $schemaSqlFile).Length -lt 1024) { throw "Schema SQL file is too small; backup likely failed." }

Write-Host "OK: Full custom dump -> $fullDumpFile"
Write-Host "OK: Schema-only SQL  -> $schemaSqlFile"

# -----------------------
# 3) Optional Supabase CLI SQL dump (secondary artifact)
# -----------------------
Write-Section "3) Optional Supabase CLI SQL dump"

if ($AlsoSupabaseSqlDump) {
  $sbSqlFile = Join-Path $dbDir ("supabase_db_dump_" + $timestamp + ".sql")
  try {
    # This outputs plain SQL; CLI behavior varies by version.
    supabase db dump --local --file $sbSqlFile
    Write-Host "OK: Supabase SQL dump -> $sbSqlFile"
  } catch {
    Write-Host "INFO: supabase db dump failed; skipping. Details: $($_.Exception.Message)"
  }
} else {
  Write-Host "Skipped (supabase CLI not available)."
}

# -----------------------
# 4) Stop transcript BEFORE hashing/zip
# -----------------------
Write-Section "4) Finalize log"
Stop-Transcript | Out-Null

# -----------------------
# 5) Manifest + SHA256 hashes (safe ordering)
# -----------------------
Write-Section "5) Manifest + hashes"

# File inventory
Get-ChildItem -Recurse -File $runDir |
  Select-Object FullName, Length, LastWriteTime |
  Sort-Object FullName |
  Out-File (Join-Path $runDir "manifest_files.txt") -Encoding utf8

# Compute hashes first, then write manifest_sha256.txt (avoid locking)
$hashLines = Get-ChildItem -Recurse -File $runDir |
  Where-Object { $_.Name -notin @("backup.log","manifest_sha256.txt") } |
  ForEach-Object {
    $h = Get-FileHash $_.FullName -Algorithm SHA256
    "{0}  {1}" -f $h.Hash, $h.Path
  }

$hashLines | Out-File (Join-Path $runDir "manifest_sha256.txt") -Encoding utf8
Write-Host "OK: manifests generated"

# -----------------------
# 6) ZIP bundle
# -----------------------
Write-Section "6) ZIP bundle"

$zipFile = Join-Path $BackupRoot ("CleanMateX_backup_" + $timestamp + ".zip")
Compress-Archive -Path (Join-Path $runDir "*") -DestinationPath $zipFile -Force

Write-Host ""
Write-Host "DONE."
Write-Host "ZIP: $zipFile"
Write-Host "RUN: $runDir"
