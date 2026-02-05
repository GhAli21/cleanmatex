# Archive duplicate and status documentation
$ErrorActionPreference = "Stop"

Write-Host "=== Archiving Duplicate Documentation ===" -ForegroundColor Cyan
Write-Host ""

$projectRoot = "f:\jhapp\cleanmatex"
$docsRoot = "$projectRoot\docs"
$archiveRoot = "$docsRoot\_archive\2025-01\duplicate-docs"

# Create archive directory
New-Item -ItemType Directory -Path $archiveRoot -Force | Out-Null

# Patterns to archive
$archivePatterns = @(
    "*COMPLETE*.md",
    "*SUMMARY*.md",
    "*STATUS*.md",
    "*SESSION*.md",
    "*FINAL*.md",
    "*COMPLETION*.md"
)

$excludePaths = @(
    "*_archive*",
    "*claude-code-efficiency-guide*",
    "*claude-code-quick-reference*"
)

Write-Host "Searching for duplicate/status documentation..." -ForegroundColor Yellow
Write-Host ""

$movedCount = 0
$totalFound = 0

# Search recursively
foreach ($pattern in $archivePatterns) {
    $files = Get-ChildItem $docsRoot -Recurse -Filter $pattern -File | Where-Object {
        $exclude = $false
        foreach ($excludePath in $excludePaths) {
            if ($_.FullName -like $excludePath) {
                $exclude = $true
                break
            }
        }
        -not $exclude
    }

    foreach ($file in $files) {
        $totalFound++
        $relativePath = $file.FullName.Replace("$docsRoot\", "")
        $destPath = Join-Path $archiveRoot $relativePath
        $destDir = Split-Path $destPath -Parent

        if (!(Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        }

        Move-Item -Path $file.FullName -Destination $destPath -Force
        Write-Host "  Moved: $relativePath" -ForegroundColor Green
        $movedCount++
    }
}

Write-Host ""
Write-Host "Total files found: $totalFound" -ForegroundColor Cyan
Write-Host "Total files archived: $movedCount" -ForegroundColor Cyan
Write-Host ""

# Find duplicate PRD files in features
Write-Host "Checking for duplicate PRD files in features..." -ForegroundColor Yellow

$prdPatterns = @("*PRD*.md", "*prd*.md", "*Implementation*.md")
$featureDirs = Get-ChildItem "$docsRoot\features" -Directory

$duplicates = @()

foreach ($dir in $featureDirs) {
    foreach ($pattern in $prdPatterns) {
        $prdFiles = Get-ChildItem $dir.FullName -Filter $pattern -File -Recurse | Where-Object {
            $_.Name -notlike "*README*"
        }

        if ($prdFiles.Count -gt 1) {
            # Keep newest, archive older versions
            $sorted = $prdFiles | Sort-Object LastWriteTime -Descending
            for ($i = 1; $i -lt $sorted.Count; $i++) {
                $duplicates += $sorted[$i]
            }
        }
    }
}

if ($duplicates.Count -gt 0) {
    Write-Host ""
    Write-Host "Found $($duplicates.Count) duplicate PRD files to archive:" -ForegroundColor Yellow

    $dupArchive = "$docsRoot\_archive\2025-01\duplicate-prds"
    New-Item -ItemType Directory -Path $dupArchive -Force | Out-Null

    foreach ($file in $duplicates) {
        $relativePath = $file.FullName.Replace("$docsRoot\features\", "")
        $destPath = Join-Path $dupArchive $relativePath
        $destDir = Split-Path $destPath -Parent

        if (!(Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        }

        Move-Item -Path $file.FullName -Destination $destPath -Force
        Write-Host "  Moved: features\$relativePath" -ForegroundColor Green
        $movedCount++
    }
}

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "Total files archived: $movedCount" -ForegroundColor Green
Write-Host "Archive location: docs\_archive\2025-01\" -ForegroundColor White
Write-Host ""

# Count remaining docs
$remainingDocs = (Get-ChildItem $docsRoot -Recurse -Filter "*.md" | Where-Object {
    $_.FullName -notlike "*_archive*"
} | Measure-Object).Count

Write-Host "Remaining active documentation: $remainingDocs files" -ForegroundColor Cyan
Write-Host ""
Write-Host "=== Complete ===" -ForegroundColor Green
