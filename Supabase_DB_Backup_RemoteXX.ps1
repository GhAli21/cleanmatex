<# ============================================================
 CleanMateX FULL REMOTE BACKUP (PowerShell / Windows) — DB URL param style

 Backups created:
  1) FULL Postgres custom archive (.dump) using pg_dump via a temporary postgres client container
  2) Schema-only SQL (readable) via pg_dump
  3) Optional supabase/ folder snapshot (migrations + config) if present
  4) Manifest + SHA256 hashes
  5) ZIP bundle

 Requirements:
  - Docker Desktop running
  - Network access to remote Postgres
  - No need to install pg_dump on Windows.

 Usage:
  .\Supabase_DB_Backup_Remote.ps1 `
    -DbUrl "postgresql://postgres:PASSWORD@db.<project>.supabase.co:5432/postgres" `
    -ProjectRoot "F:\jhapp\cleanmatex" `
    -BackupRoot  "F:\JhApps_doc\CleanMateX_Jh\Backups\DB_Backup\RemoteDB"

============================================================ #>

param(
  [Parameter(Mandatory=$true)]
  # Support multiple switch names without conflicting with the main parameter name
  [Alias("DbUrl","db-url")]
  [string]$DatabaseUrl,

  [string]$ProjectRoot = (Get-Location).Path,
  [string]$BackupRoot  = "F:\JhApps_doc\CleanMateX_Jh\Backups\DB_Backup\RemoteDB"
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

function Ensure-Dir([string]$p) {
  if (!(Test-Path $p)) { New-Item -ItemType Directory -Force -Path $p | Out-Null }
}

# -----------------------
# 0) Preflight
# -----------------------
Write-Section "0) Preflight"

if (-not (Test-Cmd "docker")) {
  throw "docker not found in PATH. Install Docker Desktop and reopen PowerShell."
}

# Basic guardrail: require postgres:// or postgresql://
if ($DatabaseUrl -notmatch '^postgres(ql)?://') {
  throw "DatabaseUrl must start with 'postgresql://...' (DATABASE_URL format)."
}

# Create run folders
$timestamp   = Get-Date -Format "yyyyMMdd_HHmmss"
$runDir      = Join-Path $BackupRoot ("run_remote_" + $timestamp)
$dbDir       = Join-Path $runDir "db"
$metaDir     = Join-Path $runDir "meta"

Ensure-Dir $dbDir
Ensure-Dir $metaDir

# Logging
$logFile = Join-Path $runDir "backup_remote.log"
Start-Transcript -Path $logFile | Out-Null

Write-Host "ProjectRoot : $ProjectRoot"
Write-Host "BackupRoot  : $BackupRoot"
Write-Host "RunDir      : $runDir"
Write-Host "Mode        : REMOTE"
Write-Host "Conn        : DatabaseUrl parameter"

# -----------------------
# 1) Optional snapshot supabase folder (migrations/config)
# -----------------------
Write-Section "1) Optional snapshot supabase/ folder"

try {
  if ((Test-Path $ProjectRoot) -and (Test-Path (Join-Path $ProjectRoot "supabase"))) {
    Copy-Item -Recurse -Force (Join-Path $ProjectRoot "supabase") (Join-Path $metaDir "supabase") -ErrorAction Stop
    Write-Host "OK: supabase/ copied"
  } else {
    Write-Host "INFO: No supabase/ folder found under ProjectRoot. Skipping snapshot."
  }
} catch {
  throw "Failed to copy supabase/: $($_.Exception.Message)"
}

# -----------------------
# 2) FULL DB backup via Docker client container (remote)
# -----------------------
Write-Section "2) FULL DB backup via Docker client container (pg_dump REMOTE)"

$pgClientImage = "postgres:16-alpine"

# Local output files
$fullDumpFile   = Join-Path $dbDir ("cleanmatex_remote_full_all_schemas_" + $timestamp + ".dump")
$schemaSqlFile  = Join-Path $dbDir ("cleanmatex_remote_schema_all_schemas_" + $timestamp + ".sql")

# FULL custom archive
docker run --rm `
  -v "${dbDir}:/backup" `
  $pgClientImage sh -lc "pg_dump '$DatabaseUrl' -Fc -f /backup/$(Split-Path -Leaf $fullDumpFile)"
if ($LASTEXITCODE -ne 0) { throw "REMOTE pg_dump custom failed (DatabaseUrl)." }

# SCHEMA-only SQL
docker run --rm `
  -v "${dbDir}:/backup" `
  $pgClientImage sh -lc "pg_dump '$DatabaseUrl' --schema-only --no-owner --no-acl -f /backup/$(Split-Path -Leaf $schemaSqlFile)"
if ($LASTEXITCODE -ne 0) { throw "REMOTE pg_dump schema-only failed (DatabaseUrl)." }

# Validate archive (quick)
docker run --rm `
  -v "${dbDir}:/backup" `
  $pgClientImage sh -lc "pg_restore -l /backup/$(Split-Path -Leaf $fullDumpFile) | head -n 20" |
  Out-File (Join-Path $dbDir "pg_restore_list_head_remote.txt") -Encoding utf8
if ($LASTEXITCODE -ne 0) { throw "pg_restore validation failed (remote dump archive may be invalid)." }

# Sanity checks
if (-not (Test-Path $fullDumpFile)) { throw "Custom dump file missing: $fullDumpFile" }
if ((Get-Item $fullDumpFile).Length -lt 1024) { throw "Custom dump file is too small; backup likely failed." }

if (-not (Test-Path $schemaSqlFile)) { throw "Schema SQL file missing: $schemaSqlFile" }
if ((Get-Item $schemaSqlFile).Length -lt 1024) { throw "Schema SQL file is too small; backup likely failed." }

Write-Host "OK: Full custom dump -> $fullDumpFile"
Write-Host "OK: Schema-only SQL  -> $schemaSqlFile"

# -----------------------
# 3) Stop transcript BEFORE hashing/zip
# -----------------------
Write-Section "3) Finalize log"
Stop-Transcript | Out-Null

# -----------------------
# 4) Manifest + SHA256 hashes
# -----------------------
Write-Section "4) Manifest + hashes"

Get-ChildItem -Recurse -File $runDir |
  Select-Object FullName, Length, LastWriteTime |
  Sort-Object FullName |
  Out-File (Join-Path $runDir "manifest_files.txt") -Encoding utf8

$hashLines = Get-ChildItem -Recurse -File $runDir |
  Where-Object { $_.Name -notin @("backup_remote.log","manifest_sha256.txt") } |
  ForEach-Object {
    $h = Get-FileHash $_.FullName -Algorithm SHA256
    "{0}  {1}" -f $h.Hash, $h.Path
  }

$hashLines | Out-File (Join-Path $runDir "manifest_sha256.txt") -Encoding utf8
Write-Host "OK: manifests generated"

# -----------------------
# 5) ZIP bundle
# -----------------------
Write-Section "5) ZIP bundle"

$zipFile = Join-Path $BackupRoot ("CleanMateX_remote_backup_" + $timestamp + ".zip")
Compress-Archive -Path (Join-Path $runDir "*") -DestinationPath $zipFile -Force

Write-Host ""
Write-Host "DONE."
Write-Host "ZIP: $zipFile"
Write-Host "RUN: $runDir"
