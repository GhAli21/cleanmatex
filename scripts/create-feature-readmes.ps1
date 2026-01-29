# Simple script to create README files for features
$ErrorActionPreference = "Stop"

Write-Host "=== Creating Feature READMEs ===" -ForegroundColor Cyan

$featuresRoot = "f:\jhapp\cleanmatex\docs\features"
$templatePath = "f:\jhapp\cleanmatex\scripts\feature-readme-template.md"

$template = Get-Content $templatePath -Raw

$featureDirs = Get-ChildItem "$featuresRoot" -Directory | Where-Object {
    $_.Name -notmatch "^old$|^archive|^clde|JhTest|Pending"
}

$created = 0
foreach ($dir in $featureDirs) {
    $readmePath = "$($dir.FullName)\README.md"

    if (!(Test-Path $readmePath)) {
        $featureName = $dir.Name -replace "_dev_prd|_dev_plan|_|\d+", " " -replace "\s+", " "
        $featureName = (Get-Culture).TextInfo.ToTitleCase($featureName.Trim())

        $content = $template -replace "FEATURE_NAME", $featureName
        Set-Content -Path $readmePath -Value $content -Force

        Write-Host "  Created: $($dir.Name)/README.md" -ForegroundColor Green
        $created++
    } else {
        Write-Host "  Exists: $($dir.Name)/README.md" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "Total READMEs created: $created" -ForegroundColor Cyan
Write-Host "=== Complete ===" -ForegroundColor Green
