# Documentation Organization Script for CleanMateX
# This script organizes documentation following the efficiency guide
# Run from project root: .\scripts\organize-docs.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== CleanMateX Documentation Organization ===" -ForegroundColor Cyan
Write-Host ""

# Define paths
$projectRoot = "f:\jhapp\cleanmatex"
$docsRoot = "$projectRoot\docs"
$archiveRoot = "$docsRoot\_archive"
$archive2025_01 = "$archiveRoot\2025-01"
$completedFeatures = "$archive2025_01\completed-features"
$oldPlans = "$archive2025_01\old-plans"
$oldProgress = "$archive2025_01\progress-tracking"

# Create archive structure
Write-Host "Creating archive structure..." -ForegroundColor Yellow
$directories = @(
    $archiveRoot,
    $archive2025_01,
    $completedFeatures,
    $oldPlans,
    $oldProgress
)

foreach ($dir in $directories) {
    if (!(Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "  Created: $dir" -ForegroundColor Green
    }
}

Write-Host ""

# Archive completed status/progress files from docs/plan
Write-Host "Archiving progress tracking files from docs/plan..." -ForegroundColor Yellow

$progressPatterns = @(
    "*PROGRESS*",
    "*STATUS*",
    "*CONTINUATION*",
    "*COMPLETE*",
    "*SUMMARY*",
    "*BATCH*",
    "*SESSION*",
    "*REMAINING*"
)

$movedCount = 0
foreach ($pattern in $progressPatterns) {
    $files = Get-ChildItem "$docsRoot\plan" -Filter "$pattern.md" -ErrorAction SilentlyContinue
    foreach ($file in $files) {
        $destination = "$oldProgress\$($file.Name)"
        if (!(Test-Path $destination)) {
            Move-Item -Path $file.FullName -Destination $destination -Force
            Write-Host "  Moved: $($file.Name)" -ForegroundColor Green
            $movedCount++
        }
    }
}

Write-Host "  Total progress files archived: $movedCount" -ForegroundColor Cyan
Write-Host ""

# Archive old PRD implementation files
Write-Host "Archiving old PRD implementation files..." -ForegroundColor Yellow

$prdPatterns = @(
    "00*_dev_prd.md",
    "*Implementation*.md",
    "*IMPLEMENTATION*.md"
)

$movedCount = 0
foreach ($pattern in $prdPatterns) {
    $files = Get-ChildItem "$docsRoot\plan" -Filter $pattern -ErrorAction SilentlyContinue
    foreach ($file in $files) {
        # Skip master_plan files
        if ($file.Name -notlike "*master_plan*") {
            $destination = "$oldPlans\$($file.Name)"
            if (!(Test-Path $destination)) {
                Move-Item -Path $file.FullName -Destination $destination -Force
                Write-Host "  Moved: $($file.Name)" -ForegroundColor Green
                $movedCount++
            }
        }
    }
}

Write-Host "  Total PRD files archived: $movedCount" -ForegroundColor Cyan
Write-Host ""

# Archive completed implementation docs from docs/dev/implementation
Write-Host "Archiving completed implementation docs..." -ForegroundColor Yellow

if (Test-Path "$docsRoot\dev\implementation") {
    $implFiles = Get-ChildItem "$docsRoot\dev\implementation" -Filter "*COMPLETE*.md" -ErrorAction SilentlyContinue
    $movedCount = 0
    foreach ($file in $implFiles) {
        $destination = "$completedFeatures\$($file.Name)"
        if (!(Test-Path $destination)) {
            Move-Item -Path $file.FullName -Destination $destination -Force
            Write-Host "  Moved: $($file.Name)" -ForegroundColor Green
            $movedCount++
        }
    }
    Write-Host "  Total implementation files archived: $movedCount" -ForegroundColor Cyan
}

Write-Host ""

# Archive old fix documentation
Write-Host "Archiving old fix documentation..." -ForegroundColor Yellow

if (Test-Path "$docsRoot\dev\fixes") {
    $fixArchive = "$archive2025_01\fixes"
    if (!(Test-Path $fixArchive)) {
        New-Item -ItemType Directory -Path $fixArchive -Force | Out-Null
    }

    $fixFiles = Get-ChildItem "$docsRoot\dev\fixes" -Filter "*.md" -ErrorAction SilentlyContinue
    $movedCount = 0
    foreach ($file in $fixFiles) {
        # Archive files older than current month
        if ($file.Name -match "2025-10-") {
            $destination = "$fixArchive\$($file.Name)"
            if (!(Test-Path $destination)) {
                Move-Item -Path $file.FullName -Destination $destination -Force
                Write-Host "  Moved: $($file.Name)" -ForegroundColor Green
                $movedCount++
            }
        }
    }
    Write-Host "  Total fix files archived: $movedCount" -ForegroundColor Cyan
}

Write-Host ""

# Archive duplicate database design docs
Write-Host "Archiving old database design docs..." -ForegroundColor Yellow

if (Test-Path "$docsRoot\Database_Design") {
    $dbArchive = "$archive2025_01\database-design"
    if (!(Test-Path $dbArchive)) {
        New-Item -ItemType Directory -Path $dbArchive -Force | Out-Null
    }

    # Keep only the latest, archive old versions
    $dbFiles = Get-ChildItem "$docsRoot\Database_Design" -Filter "*jh*.md" -ErrorAction SilentlyContinue |
               Sort-Object LastWriteTime

    $movedCount = 0
    if ($dbFiles.Count -gt 1) {
        # Keep the newest, archive the rest
        for ($i = 0; $i -lt ($dbFiles.Count - 1); $i++) {
            $file = $dbFiles[$i]
            $destination = "$dbArchive\$($file.Name)"
            if (!(Test-Path $destination)) {
                Move-Item -Path $file.FullName -Destination $destination -Force
                Write-Host "  Moved: $($file.Name)" -ForegroundColor Green
                $movedCount++
            }
        }
    }
    Write-Host "  Total DB design files archived: $movedCount" -ForegroundColor Cyan
}

Write-Host ""

# Archive old dashboard implementation docs
Write-Host "Archiving completed dashboard docs..." -ForegroundColor Yellow

$dashboardPatterns = @(
    "*DASHBOARD*COMPLETE*.md",
    "*DASHBOARD*PROGRESS*.md"
)

$movedCount = 0
foreach ($pattern in $dashboardPatterns) {
    $files = Get-ChildItem "$docsRoot\dev" -Filter $pattern -ErrorAction SilentlyContinue
    foreach ($file in $files) {
        $destination = "$completedFeatures\$($file.Name)"
        if (!(Test-Path $destination)) {
            Move-Item -Path $file.FullName -Destination $destination -Force
            Write-Host "  Moved: $($file.Name)" -ForegroundColor Green
            $movedCount++
        }
    }
}

Write-Host "  Total dashboard files archived: $movedCount" -ForegroundColor Cyan
Write-Host ""

# Summary
Write-Host "=== Archive Summary ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Archive structure created at:" -ForegroundColor Yellow
Write-Host "  $archiveRoot" -ForegroundColor White
Write-Host ""
Write-Host "Directories:" -ForegroundColor Yellow
Write-Host "  - 2025-01/progress-tracking/  (progress/status files)" -ForegroundColor White
Write-Host "  - 2025-01/old-plans/          (old PRD files)" -ForegroundColor White
Write-Host "  - 2025-01/completed-features/ (completed implementations)" -ForegroundColor White
Write-Host "  - 2025-01/fixes/              (old fix documentation)" -ForegroundColor White
Write-Host "  - 2025-01/database-design/    (old DB design docs)" -ForegroundColor White
Write-Host ""

# Count remaining files
$remainingPlan = (Get-ChildItem "$docsRoot\plan" -Filter "*.md" | Measure-Object).Count
$totalDocs = (Get-ChildItem "$docsRoot" -Recurse -Filter "*.md" | Measure-Object).Count

Write-Host "Remaining active documentation:" -ForegroundColor Yellow
Write-Host "  - docs/plan/: $remainingPlan files" -ForegroundColor White
Write-Host "  - Total docs: $totalDocs files" -ForegroundColor White
Write-Host ""

Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Review archived files in docs/_archive/2025-01/" -ForegroundColor White
Write-Host "  2. Run consolidation script for feature docs" -ForegroundColor White
Write-Host "  3. Create docs/README.md index" -ForegroundColor White
Write-Host ""

Write-Host "=== Organization Complete ===" -ForegroundColor Green
