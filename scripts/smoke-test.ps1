# Smoke tests for CleanMateX infrastructure (PowerShell)

Write-Host "Running CleanMateX Infrastructure Smoke Tests..." -ForegroundColor Blue
Write-Host ""

$FailedTests = 0
$PassedTests = 0

# Test function
function Test-Service {
    param(
        [string]$Name,
        [scriptblock]$TestCommand
    )
    
    Write-Host -NoNewline "Testing $Name... "
    
    try {
        $result = & $TestCommand
        if ($LASTEXITCODE -eq 0) {
            Write-Host "PASS" -ForegroundColor Green
            $script:PassedTests++
            return $true
        }
        else {
            Write-Host "FAIL" -ForegroundColor Red
            $script:FailedTests++
            return $false
        }
    }
    catch {
        Write-Host "FAIL" -ForegroundColor Red
        $script:FailedTests++
        return $false
    }
}

# Test PostgreSQL
Test-Service "PostgreSQL" {
    docker exec cmx-postgres pg_isready -U cmx_user -d cmx_db 2>&1 | Out-Null
}

# Test Redis
Test-Service "Redis" {
    $result = docker exec cmx-redis redis-cli ping 2>&1
    if ($result -match "PONG") { $LASTEXITCODE = 0 } else { $LASTEXITCODE = 1 }
}

# Test MinIO
Test-Service "MinIO Health" {
    $response = Invoke-WebRequest -Uri "http://localhost:9000/minio/health/live" -UseBasicParsing -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) { $LASTEXITCODE = 0 } else { $LASTEXITCODE = 1 }
}

# Test Redis Commander
Test-Service "Redis Commander" {
    $response = Invoke-WebRequest -Uri "http://localhost:8081" -UseBasicParsing -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) { $LASTEXITCODE = 0 } else { $LASTEXITCODE = 1 }
}

# Check Docker network
Test-Service "Docker Network" {
    docker network inspect cleanmatex_cmx-network 2>&1 | Out-Null
}

# Summary
Write-Host ""
Write-Host "Test Results"
Write-Host "Passed: " -NoNewline; Write-Host $PassedTests -ForegroundColor Green
Write-Host "Failed: " -NoNewline; Write-Host $FailedTests -ForegroundColor Red
Write-Host ""

if ($FailedTests -eq 0) {
    Write-Host "All smoke tests passed!" -ForegroundColor Green
    Write-Host "Infrastructure is healthy and ready for development."
    exit 0
}
else {
    Write-Host "Some tests failed!" -ForegroundColor Red
    Write-Host "Please check the failed services and try again."
    exit 1
}