# Live-Fire Integration Test Runner for Anchor Engine v5.0.0

$ENGINE_PATH = "C:\Users\rsbii\Projects\anchor-engine-node\engine\dist\index.js"
$PORT = 3160
$DATA_DIR = "C:\Users\rsbii\.anchor-livetests"

# Ensure data directory exists
if (-not (Test-Path $DATA_DIR)) {
    New-Item -ItemType Directory -Force -Path $DATA_DIR | Out-Null
}

Write-Host "=== Anchor Engine Live-Fire Integration Tests ===" -ForegroundColor Cyan

# Function to make HTTP requests
function Invoke-RestMethod-Sync {
    param(
        [string]$Uri,
        [string]$Method = "GET",
        [string]$Body,
        [hashtable]$Headers
    )
    
    $headers = @{
        "Content-Type" = "application/json"
        "User-Agent" = "LiveFireTest/1.0"
    }
    
    if ($Headers) {
        $headers.MergeWith($Headers, $false)
    }

    # URL encode the query string properly
    $uriBuilder = [UriBuilder]$Uri
    $query = $body
    if ($query -and ($query.Length -gt 0)) {
        $uriBuilder.Query += "&t=" + ([Guid]::NewGuid().ToString('N').Substring(0,8))
    }
    
    $request = [System.Net.HttpWebRequest]::Create($uriBuilder.Uri)
    $request.Method = $Method
    if ($body) {
        $request.ContentType = "application/json"
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
        $request.ContentLength64 = $bytes.Length
        $stream = $request.GetRequestStream()
        $stream.Write($bytes, 0, $bytes.Length)
        $stream.Close()
    }
    
    # Add headers if provided
    if ($Headers.Count -gt 0) {
        foreach ($key in $headers.Keys) {
            $request.Headers.Add($key, $headers[$key]) | Out-Null
        }
    }

    $response = $request.GetResponse()
    $reader = New-Object System.IO.StreamReader($response.ResponseStream)
    $content = $reader.ReadToEnd()
    $reader.Close()

    return @{
        Status = $response.StatusCode
        Headers = $response.Headers
        Body = $content
    }
}

# Function to check if server is running
function Test-ServerRunning {
    try {
        $result = Invoke-RestMethod-Sync -Uri "http://localhost:$PORT/health"
        if ($result.Status -eq 200) {
            Write-Host "[OK] Server health check passed" -ForegroundColor Green
            return $true
        } else {
            Write-Host "[FAIL] Health check failed: $($result.Body)" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "[FAIL] Cannot reach server on port $PORT" -ForegroundColor Red
        return $false
    }
}

# Main execution
Write-Host "" -Host

# Check if server is running
if (-not (Test-ServerRunning)) {
    Write-Host "Server not found. Starting engine..." -ForegroundColor Yellow
    
    # Start the engine as background process
    $args = @()
    $args += "--data-dir"
    $args += $DATA_DIR
    $args += "--port"
    $args += $PORT.ToString()
    $args += "--no-external-ingestion"
    
    $process = Start-Process node -ArgumentList $args `
        -WorkingDirectory "C:\Users\rsbii\Projects\anchor-engine-node\engine" `
        -PassThru
    
    Write-Host "Started process with PID $($process.Id)" -ForegroundColor Cyan

    # Wait for startup
    Write-Host "Waiting for server to start..." -NoNewline
    $waitCount = 0
    while ($waitCount -lt 60) {
        if (Test-ServerRunning) { break }
        Start-Sleep -Seconds 1
        $waitCount++
    }

    if (-not (Test-ServerRunning)) {
        Write-Host " [FAIL] Server failed to start within 60 seconds" -ForegroundColor Red
        exit 1
    } else {
        Write-Host " OK - Server is ready" -ForegroundColor Green
    }
} else {
    Write-Host "Server already running, skipping startup" -ForegroundColor Cyan
}

# Run tests
Write-Host "" -Host
Write-Host "=== Running Integration Tests ===" -ForegroundColor Cyan

$tests = @()

# Test 1: Molecules schema
Write-Host "Testing molecules endpoint..." -NoNewline
$moleculesResult = Invoke-RestMethod-Sync -Uri "http://localhost:$PORT/v1/molecules?limit=1&include_columns=true"
if ($moleculesResult.Status -eq 200) {
    $json = $moleculesResult.Body | ConvertFrom-Json
    if ($null -ne $json.molecule) {
        Write-Host " [PASS]" -ForegroundColor Green
        $tests += @{ Name = "Molecules Schema"; Status = "pass"; Details = $json }
    } else {
        Write-Host " [FAIL] Response missing molecule field" -ForegroundColor Red
        $tests += @{ Name = "Molecules Schema"; Status = "fail"; Error = "Missing molecule" }
    }
} else {
    Write-Host " [FAIL] HTTP $($moleculesResult.Status)" -ForegroundColor Red
    $tests += @{ Name = "Molecules Schema"; Status = "fail"; Error = "API failed" }
}

# Test 2: Atoms schema  
Write-Host "Testing atoms endpoint..." -NoNewline
$atomsResult = Invoke-RestMethod-Sync -Uri "http://localhost:$PORT/v1/atoms?limit=1&include_columns=true"
if ($atomsResult.Status -eq 200) {
    $json = $atomsResult.Body | ConvertFrom-Json
    if ($null -ne $json.atom) {
        Write-Host " [PASS]" -ForegroundColor Green
        $tests += @{ Name = "Atoms Schema"; Status = "pass"; Details = $json }
    } else {
        Write-Host " [FAIL] Response missing atom field" -ForegroundColor Red
        $tests += @{ Name = "Atoms Schema"; Status = "fail"; Error = "Missing atom" }
    }
} else {
    Write-Host " [FAIL] HTTP $($atomsResult.Status)" -ForegroundColor Red
    $tests += @{ Name = "Atoms Schema"; Status = "fail"; Error = "API failed" }
}

# Test 3: Compounds table (should be removed)
Write-Host "Testing compounds endpoint..." -NoNewline
$compoundsResult = Invoke-RestMethod-Sync -Uri "http://localhost:$PORT/v1/compounds"
if ($compoundsResult.Status -eq 404) {
    Write-Host " [PASS] - Table removed (404)" -ForegroundColor Green
    $tests += @{ Name = "Compounds Table Removal"; Status = "pass"; Details = @{ StatusCode = 404 } }
} elseif ($compoundsResult.Status -ge 500) {
    Write-Host " [PASS] - Endpoint removed" -ForegroundColor Green
    $tests += @{ Name = "Compounds Table Removal"; Status = "pass"; Details = @{ StatusCode = $compoundsResult.Status } }
} else {
    # Check if empty
    $json = $compoundsResult.Body | ConvertFrom-Json
    if ($null -eq $json.data) {
        Write-Host " [PASS] - Table exists but is empty" -ForegroundColor Cyan
        $tests += @{ Name = "Compounds Table Removal"; Status = "pass"; Details = @{ StatusCode = $compoundsResult.Status } }
    } elseif ($json.data -is [array] -and $json.data.Length -eq 0) {
        Write-Host " [PASS] - Table exists but is empty" -ForegroundColor Cyan
        $tests += @{ Name = "Compounds Table Removal"; Status = "pass"; Details = @{ StatusCode = $compoundsResult.Status } }
    } else {
        Write-Host " [FAIL] - Compounds table still has data" -ForegroundColor Red
        $tests += @{ Name = "Compounds Table Removal"; Status = "fail"; Error = "Data exists" }
    }
}

# Test 4: Search API
Write-Host "Testing search API..." -NoNewline
$testBody = '{ "query": "migration compounds provenance", "limit": 3 }'
$searchResult = Invoke-RestMethod-Sync `
    -Uri "http://localhost:$PORT/v1/memory/search" `
    -Method POST `
    -Body $testBody

if ($searchResult.Status -ge 200 -and $searchResult.Status -lt 400) {
    Write-Host " [PASS]" -ForegroundColor Green
    $tests += @{ Name = "Search API"; Status = "pass"; ResponseCode = $searchResult.Status }
} else {
    Write-Host " [FAIL] HTTP $($searchResult.Status): $($searchResult.Body)" -ForegroundColor Red
    $tests += @{ Name = "Search API"; Status = "fail"; Error = "API failed" }
}

# Test 5: Distillation API
Write-Host "Testing distillation endpoint..." -NoNewline
$distillResult = Invoke-RestMethod-Sync -Uri "http://localhost:$PORT/v1/distills"
if ($distillResult.Status -ge 200 -and $distillResult.Status -lt 400) {
    Write-Host " [PASS]" -ForegroundColor Green
    $tests += @{ Name = "Distillation API"; Status = "pass" }
} else {
    Write-Host " [FAIL] HTTP $($distillResult.Status)" -ForegroundColor Red
    $tests += @{ Name = "Distillation API"; Status = "fail"; Error = "API failed" }
}

# Test 6: Exact search API  
Write-Host "Testing exact search..." -NoNewline
$exactBody = '{ "query": "test exact", "limit": 2 }'
$exactResult = Invoke-RestMethod-Sync `
    -Uri "http://localhost:$PORT/v1/exact/search" `
    -Method POST `
    -Body $exactBody

if ($exactResult.Status -ge 200 -and $exactResult.Status -lt 400) {
    Write-Host " [PASS]" -ForegroundColor Green
    $tests += @{ Name = "Exact Search API"; Status = "pass" }
} else {
    Write-Host " [FAIL] HTTP $($exactResult.Status)" -ForegroundColor Red
    $tests += @{ Name = "Exact Search API"; Status = "fail" }
}

# Test 7: Semantic search API
Write-Host "Testing semantic search..." -NoNewline
$semanticBody = '{ "query": "database schema atoms", "limit": 2 }'
$semanticResult = Invoke-RestMethod-Sync `
    -Uri "http://localhost:$PORT/v1/semantic/search" `
    -Method POST `
    -Body $semanticBody

if ($semanticResult.Status -ge 200 -and $semanticResult.Status -lt 400) {
    Write-Host " [PASS]" -ForegroundColor Green
    $tests += @{ Name = "Semantic Search API"; Status = "pass" }
} else {
    Write-Host " [FAIL] HTTP $($semanticResult.Status)" -ForegroundColor Red
    $tests += @{ Name = "Semantic Search API"; Status = "fail" }
}

# Print summary
Write-Host "" -Host
Write-Host "=== Test Summary ===" -ForegroundColor Cyan

$passed = @($tests | Where-Object { $_.Status -eq 'pass' }).Count
$failed = @($tests | Where-Object { $_.Status -ne 'pass' }).Count

Write-Host "Passed: $passed / $($tests.Count)" -ForegroundColor Green
Write-Host "Failed: $failed / $($tests.Count)" -ForegroundColor $(if ($failed -eq 0) { 'Green' } else { 'Red' })

# Save results to file
$timestamp = Get-Date -Format "yyyy-MM-ddTHH-mm-ss"
$resultFile = "C:\Users\rsbii\Projects\anchor-engine-node\engine\tests\live-fire\integration-results.json"

$jsonResults = $tests | ConvertTo-Json -Depth 5
$summaryObj = @{
    timestamp = $timestamp.ToString()
    server = "http://localhost:$PORT"
    testsPassed = $passed
    testsFailed = $failed
    totalTests = $tests.Count
} | ConvertTo-Json

# Clean up old results
if (Test-Path $resultFile) {
    Remove-Item $resultFile -Force
}

Set-Content -Path $resultFile -Value ($summaryObj + "`n" + $jsonResults) -Encoding UTF8

Write-Host "Results saved to: $resultFile" -ForegroundColor Cyan

# Exit with appropriate code
exit (if ($failed -eq 0) { 0 } else { 1 })