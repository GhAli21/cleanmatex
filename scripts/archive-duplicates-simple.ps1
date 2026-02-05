# Simple duplicate archival script
$ErrorActionPreference = "Continue"

Write-Host "=== Archiving Duplicate Documentation ===" -ForegroundColor Cyan

$docsRoot = "f:\jhapp\cleanmatex\docs"
$archiveBase = "f:\jhapp\cleanmatex\docs\_archive\2025-01"

# Create archive directories
New-Item -ItemType Directory -Path "$archiveBase\duplicate-docs\dev" -Force | Out-Null
New-Item -ItemType Directory -Path "$archiveBase\duplicate-docs\features" -Force | Out-Null

$movedCount = 0

# Archive from dev/
Write-Host "`nArchiving from dev/..." -ForegroundColor Yellow
$devFiles = Get-ChildItem "$docsRoot\dev" -Filter "*COMPLETE*.md" -File
$devFiles += Get-ChildItem "$docsRoot\dev" -Filter "*SUMMARY*.md" -File
$devFiles += Get-ChildItem "$docsRoot\dev" -Filter "*STATUS*.md" -File
$devFiles += Get-ChildItem "$docsRoot\dev" -Filter "*SESSION*.md" -File

foreach ($file in $devFiles) {
    $dest = "$archiveBase\duplicate-docs\dev\$($file.Name)"
    try {
        Move-Item -Path $file.FullName -Destination $dest -Force -ErrorAction Stop
        Write-Host "  Moved: dev\$($file.Name)" -ForegroundColor Green
        $movedCount++
    } catch {
        Write-Host "  Skip: $($file.Name) (already exists)" -ForegroundColor Gray
    }
}

# Archive from dev/implementation/
Write-Host "`nArchiving from dev/implementation/..." -ForegroundColor Yellow
if (Test-Path "$docsRoot\dev\implementation") {
    $implFiles = Get-ChildItem "$docsRoot\dev\implementation" -Filter "*COMPLETE*.md" -File
    $implFiles += Get-ChildItem "$docsRoot\dev\implementation" -Filter "*STATUS*.md" -File
    $implFiles += Get-ChildItem "$docsRoot\dev\implementation" -Filter "*COMPLETE*.txt" -File

    foreach ($file in $implFiles) {
        $dest = "$archiveBase\duplicate-docs\dev\$($file.Name)"
        try {
            Move-Item -Path $file.FullName -Destination $dest -Force -ErrorAction Stop
            Write-Host "  Moved: dev\implementation\$($file.Name)" -ForegroundColor Green
            $movedCount++
        } catch {
            Write-Host "  Skip: $($file.Name)" -ForegroundColor Gray
        }
    }
}

# Archive completion docs from feature directories
Write-Host "`nArchiving from features/..." -ForegroundColor Yellow
$featureDirs = @(
    "001_auth_dev_prd",
    "003_customer_management",
    "004_order_intake",
    "005_basic_workflow"
)

foreach ($dirName in $featureDirs) {
    $dirPath = "$docsRoot\features\$dirName"
    if (Test-Path $dirPath) {
        $featureArchive = "$archiveBase\duplicate-docs\features\$dirName"
        New-Item -ItemType Directory -Path $featureArchive -Force | Out-Null

        $statusFiles = Get-ChildItem $dirPath -Filter "*COMPLETE*.md" -File
        $statusFiles += Get-ChildItem $dirPath -Filter "*SUMMARY*.md" -File
        $statusFiles += Get-ChildItem $dirPath -Filter "*STATUS*.md" -File
        $statusFiles += Get-ChildItem $dirPath -Filter "*FINAL*.md" -File
        $statusFiles += Get-ChildItem $dirPath -Filter "*SESSION*.md" -File

        foreach ($file in $statusFiles) {
            $dest = "$featureArchive\$($file.Name)"
            try {
                Move-Item -Path $file.FullName -Destination $dest -Force -ErrorAction Stop
                Write-Host "  Moved: features\$dirName\$($file.Name)" -ForegroundColor Green
                $movedCount++
            } catch {
                Write-Host "  Skip: $($file.Name)" -ForegroundColor Gray
            }
        }
    }
}

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "Total files archived: $movedCount" -ForegroundColor Green
Write-Host ""
Write-Host "=== Complete ===" -ForegroundColor Green
