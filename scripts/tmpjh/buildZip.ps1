$ErrorActionPreference = 'Stop'

$rootPath = 'F:\jhapp\cleanmatex'
$fileListPath = 'F:\jhapp\cleanmatex\scripts\tmpjh\filelist.txt'
$zipPath = 'F:\jhapp\cleanmatex\scripts\tmpjh\files.zip'

Add-Type -AssemblyName System.IO.Compression.FileSystem

if (Test-Path -LiteralPath $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}

$rootUri = [System.Uri]::new($rootPath.TrimEnd('\') + '\')
$archive = [System.IO.Compression.ZipFile]::Open(
    $zipPath,
    [System.IO.Compression.ZipArchiveMode]::Create
)

try {
    foreach ($filePathFromList in Get-Content -LiteralPath $fileListPath) {
        $filePath = $filePathFromList.Trim().Trim('"')

        if (-not $filePath) {
            continue
        }

        if (-not [System.IO.Path]::IsPathRooted($filePath)) {
            $filePath = Join-Path $rootPath $filePath
        }

        $filePath = [System.IO.Path]::GetFullPath($filePath)

        if (-not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
            throw "Missing file listed in filelist.txt: $filePath"
        }

        $entryPath = [System.Uri]::UnescapeDataString(
            $rootUri.MakeRelativeUri([System.Uri]::new($filePath)).ToString()
        )

        if ($entryPath.StartsWith('../')) {
            throw "File is outside the archive root ($rootPath): $filePath"
        }

        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $archive,
            $filePath,
            $entryPath,
            [System.IO.Compression.CompressionLevel]::Optimal
        ) | Out-Null
    }
}
finally {
    $archive.Dispose()
}

Write-Host "Created archive: $zipPath"
