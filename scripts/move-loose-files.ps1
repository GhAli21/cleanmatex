# Move loose files from features root
$ErrorActionPreference = "Stop"

$source = "f:\jhapp\cleanmatex\docs\features"
$dest = "f:\jhapp\cleanmatex\docs\_archive\2025-01\features-loose-files"

New-Item -ItemType Directory -Path $dest -Force | Out-Null

$extensions = @("*.md", "*.txt", "*.csv", "*.json")
$movedCount = 0

foreach ($ext in $extensions) {
    $files = Get-ChildItem $source -Filter $ext -File
    foreach ($file in $files) {
        Move-Item -Path $file.FullName -Destination $dest -Force
        Write-Host "Moved: $($file.Name)" -ForegroundColor Green
        $movedCount++
    }
}

Write-Host ""
Write-Host "Total files moved: $movedCount" -ForegroundColor Cyan
