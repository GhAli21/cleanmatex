# Feature Documentation Consolidation Script
# Consolidates feature documentation into single README per feature
# Run from project root: .\scripts\consolidate-features.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== Feature Documentation Consolidation ===" -ForegroundColor Cyan
Write-Host ""

$projectRoot = "f:\jhapp\cleanmatex"
$featuresRoot = "$projectRoot\docs\features"
$archiveRoot = "$projectRoot\docs\_archive\2025-01"

# Archive loose markdown files in features root
Write-Host "Archiving loose files from docs/features root..." -ForegroundColor Yellow

$looseFiles = Get-ChildItem "$featuresRoot" -Filter "*.md" -File -ErrorAction SilentlyContinue
$movedCount = 0

if ($looseFiles) {
    $featureArchive = "$archiveRoot\features-loose-files"
    if (!(Test-Path $featureArchive)) {
        New-Item -ItemType Directory -Path $featureArchive -Force | Out-Null
    }

    foreach ($file in $looseFiles) {
        $destination = "$featureArchive\$($file.Name)"
        if (!(Test-Path $destination)) {
            Move-Item -Path $file.FullName -Destination $destination -Force
            Write-Host "  Moved: $($file.Name)" -ForegroundColor Green
            $movedCount++
        }
    }
}

Write-Host "  Total loose files archived: $movedCount" -ForegroundColor Cyan
Write-Host ""

# Archive non-standard files
Write-Host "Archiving non-standard files..." -ForegroundColor Yellow

$nonStandardFiles = @(
    "crt_prd_folders.txt",
    "folders_lookup.json",
    "folders_lookup.md",
    "folders_lookup_all.md",
    "FeatureName-FolderPath-Description-Version-LastUpdated.csv"
)

$movedCount = 0
foreach ($fileName in $nonStandardFiles) {
    $filePath = "$featuresRoot\$fileName"
    if (Test-Path $filePath) {
        $destination = "$archiveRoot\features-loose-files\$fileName"
        if (!(Test-Path $destination)) {
            Move-Item -Path $filePath -Destination $destination -Force
            Write-Host "  Moved: $fileName" -ForegroundColor Green
            $movedCount++
        }
    }
}

Write-Host "  Total non-standard files archived: $movedCount" -ForegroundColor Cyan
Write-Host ""

# List feature directories that need README
Write-Host "Checking feature directories for README.md..." -ForegroundColor Yellow
Write-Host ""

$featureDirs = Get-ChildItem "$featuresRoot" -Directory -ErrorAction SilentlyContinue

$needsReadme = @()
$hasReadme = @()

foreach ($dir in $featureDirs) {
    # Skip old/archive directories
    if ($dir.Name -match "^old$|^archive|^clde|JhTest|Pending") {
        continue
    }

    $readmePath = "$($dir.FullName)\README.md"
    if (Test-Path $readmePath) {
        $hasReadme += $dir.Name
        Write-Host "  ✓ $($dir.Name)" -ForegroundColor Green
    } else {
        $needsReadme += $dir
        Write-Host "  ✗ $($dir.Name) - Missing README.md" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  Features with README: $($hasReadme.Count)" -ForegroundColor Green
Write-Host "  Features needing README: $($needsReadme.Count)" -ForegroundColor Yellow
Write-Host ""

# Create template READMEs for features without them
if ($needsReadme.Count -gt 0) {
    Write-Host "Creating template README files..." -ForegroundColor Yellow
    Write-Host ""

    foreach ($dir in $needsReadme) {
        $featureName = $dir.Name -replace "_dev_prd|_dev_plan|_|\d+", " " -replace "\s+", " "
        $featureName = (Get-Culture).TextInfo.ToTitleCase($featureName.Trim())

        $readmeContent = @"
# $featureName

**Status:** Active Development
**Last Updated:** 2026-01-29

## Overview

Add feature overview here.

## Current Implementation

Describe current state.

## Documentation

- See files in this directory for detailed documentation
- Related migrations: List relevant migration files
- Related API endpoints: List API routes

## Related Files

- Frontend: web-admin/app/dashboard/feature-path
- Backend API: web-admin/app/api/v1/feature-path
- Services: web-admin/lib/services/feature-service.ts
- Database: supabase/migrations/

## Key Features

- Feature 1
- Feature 2
- Feature 3

## Next Steps

- Task 1
- Task 2

## Notes

Add any important notes or context.
"@

        $readmePath = "$($dir.FullName)\README.md"
        Set-Content -Path $readmePath -Value $readmeContent -Force
        Write-Host "  Created: $($dir.Name)/README.md" -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "  Total READMEs created: $($needsReadme.Count)" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "=== Consolidation Summary ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Actions taken:" -ForegroundColor Yellow
Write-Host "  - Archived loose files from features root" -ForegroundColor White
Write-Host "  - Created template READMEs for features" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Review each feature README and add specific content" -ForegroundColor White
Write-Host "  2. Consolidate multiple docs per feature into single README" -ForegroundColor White
Write-Host "  3. Archive duplicate/outdated docs within feature folders" -ForegroundColor White
Write-Host ""

Write-Host "=== Consolidation Complete ===" -ForegroundColor Green
