<# ============================================================
 CleanMateX FULL REMOTE BACKUP (PowerShell / Windows) — NO DOCKER

 Backups created:
  1) FULL Postgres custom archive (.dump) using local pg_dump
  2) Schema-only SQL (readable) via local pg_dump
  3) Optional supabase/ folder snapshot (migrations + config) if present
  4) Manifest + SHA256 hashes
  5) ZIP bundle

 Requirements:
  - Postgres client tools installed locally (pg_dump, pg_restore) and available in PATH
    or provide explicit paths via -PgDumpPath / -PgRestorePath
  - Network access to remote Postgres

 Usage:
  .\Supabase_DB_Backup_Remote_No_Docker.ps1 `
    -DatabaseUrl "postgresql://postgres:PASSWORD@db.<project>.supabase.co:5432/postgres" `
    -ProjectRoot "F:\jhapp\cleanmatex" `
    -BackupRoot  "F:\JhApps_doc\CleanMateX_Jh\Backups\DB_Backup\RemoteDB"

============================================================ #>

param(
  [Parameter(Mandatory=$true)]
  # Support multiple switch names without conflicting with the main parameter name
  [Alias("DbUrl","db-url")]
  [string]$DatabaseUrl,

  [string]$ProjectRoot = (Get-Location).Path,
  [string]$BackupRoot  = "F:\JhApps_doc\CleanMateX_Jh\Backups\DB_Backup\RemoteDB",

  # Optional explicit paths to pg_dump / pg_restore if not in PATH
  [string]$PgDumpPath    = "pg_dump",
  [string]$PgRestorePath = "pg_restore"
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
Write-Section "0) Preflight (no Docker)"

if (-not (Test-Cmd $PgDumpPath)) {
  throw "pg_dump not found (PgDumpPath='$PgDumpPath'). Ensure Postgres client tools are installed and in PATH, or pass an explicit -PgDumpPath."
}

if (-not (Test-Cmd $PgRestorePath)) {
  throw "pg_restore not found (PgRestorePath='$PgRestorePath'). Ensure Postgres client tools are installed and in PATH, or pass an explicit -PgRestorePath."
}

# Basic guardrail: require postgres:// or postgresql://
if ($DatabaseUrl -notmatch '^postgres(ql)?://') {
  throw "DatabaseUrl must start with 'postgresql://...' (DATABASE_URL format)."
}

# Create run folders
$timestamp   = Get-Date -Format "yyyyMMdd_HHmmss"
$runDir      = Join-Path $BackupRoot ("run_remote_nodocker_" + $timestamp)
$dbDir       = Join-Path $runDir "db"
$metaDir     = Join-Path $runDir "meta"

Ensure-Dir $dbDir
Ensure-Dir $metaDir

# Logging
$logFile = Join-Path $runDir "backup_remote_nodocker.log"
Start-Transcript -Path $logFile | Out-Null

Write-Host "ProjectRoot : $ProjectRoot"
Write-Host "BackupRoot  : $BackupRoot"
Write-Host "RunDir      : $runDir"
Write-Host "Mode        : REMOTE (NO DOCKER)"
Write-Host "Conn        : DatabaseUrl parameter"
Write-Host "pg_dump     : $PgDumpPath"
Write-Host "pg_restore  : $PgRestorePath"

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
# 2) FULL DB backup via local pg_dump (remote)
# -----------------------
Write-Section "2) FULL DB backup via local pg_dump (REMOTE)"

# Local output files
$fullDumpFile   = Join-Path $dbDir ("cleanmatex_remote_nodocker_full_all_schemas_" + $timestamp + ".dump")
$schemaSqlFile  = Join-Path $dbDir ("cleanmatex_remote_nodocker_schema_all_schemas_" + $timestamp + ".sql")

# FULL custom archive
& $PgDumpPath --dbname="$DatabaseUrl" --format=custom --file="$fullDumpFile"
if ($LASTEXITCODE -ne 0) { throw "REMOTE pg_dump custom failed (DatabaseUrl) using '$PgDumpPath'." }

# SCHEMA-only SQL
& $PgDumpPath --dbname="$DatabaseUrl" --schema-only --no-owner --no-acl --file="$schemaSqlFile"
if ($LASTEXITCODE -ne 0) { throw "REMOTE pg_dump schema-only failed (DatabaseUrl) using '$PgDumpPath'." }

# Validate archive (quick) using pg_restore (best-effort, do not hard fail)
try {
  & $PgRestorePath -l "$fullDumpFile" 2>&1 |
    Select-Object -First 20 |
    Out-File (Join-Path $dbDir "pg_restore_list_head_remote_nodocker.txt") -Encoding utf8

  if ($LASTEXITCODE -ne 0) {
    Write-Warning "pg_restore validation returned non-zero exit code using '$PgRestorePath'. Check the log file for details, but backup will continue."
  }
} catch {
  Write-Warning "pg_restore validation error using '$PgRestorePath': $($_.Exception.Message). Backup will continue."
}

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
  Where-Object { $_.Name -notin @("backup_remote_nodocker.log","manifest_sha256.txt") } |
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

$zipFile = Join-Path $BackupRoot ("CleanMateX_remote_nodocker_backup_" + $timestamp + ".zip")
Compress-Archive -Path (Join-Path $runDir "*") -DestinationPath $zipFile -Force

Write-Host ""
Write-Host "DONE."
Write-Host "ZIP: $zipFile"
Write-Host "RUN: $runDir"

