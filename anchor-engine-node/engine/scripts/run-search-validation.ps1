# Search Validation Test Suite
# Tests: DB stats, Python, machine learning, Density:

Write-Host "============================================"
Write-Host "  SEARCH VALIDATION TEST SUITE"
Write-Host "============================================"
Write-Host ""

# Test 1: Database Stats
Write-Host "[1/4] GET /v1/stats"
try {
    $stats = Invoke-WebRequest -Uri "http://localhost:3160/v1/stats" -UseBasicParsing -TimeoutSec 10
    $json = $stats.Content | ConvertFrom-Json
    Write-Host "  Atoms: $($json.atoms)"
    Write-Host "  Molecules: $($json.molecules)"
    Write-Host "  Tags: $($json.tags)"
    Write-Host "  Sources: $($json.sources)"
    Write-Host "  Result: PASS"
} catch {
    Write-Host "  Result: FAIL - $($_.Exception.Message)"
}
Write-Host ""

# Test 2: Search Python
Write-Host "[2/4] POST /v1/memory/search 'Python'"
try {
    $start = Get-Date
    $resp = Invoke-WebRequest -Uri "http://localhost:3160/v1/memory/search" -Method POST -Headers @{"Content-Type"="application/json"} -Body '{"query":"Python","stream":false}' -UseBasicParsing -TimeoutSec 60
    $elapsed = ((Get-Date) - $start).TotalSeconds
    $json = $resp.Content | ConvertFrom-Json
    Write-Host "  TotalResults: $($json.totalResults)"
    Write-Host "  Time: ${elapsed.ToString('F1')}s"
    if ($json.results.Count -gt 0) {
        $preview = $json.results[0].content.Substring(0, [Math]::Min(200, $json.results[0].content.Length))
        Write-Host "  Preview: $preview..."
    }
    Write-Host "  Result: PASS"
} catch {
    Write-Host "  Result: FAIL - $($_.Exception.Message)"
}
Write-Host ""

# Test 3: Search machine learning
Write-Host "[3/4] POST /v1/memory/search 'machine learning'"
try {
    $start = Get-Date
    $resp = Invoke-WebRequest -Uri "http://localhost:3160/v1/memory/search" -Method POST -Headers @{"Content-Type"="application/json"} -Body '{"query":"machine learning","stream":false}' -UseBasicParsing -TimeoutSec 60
    $elapsed = ((Get-Date) - $start).TotalSeconds
    $json = $resp.Content | ConvertFrom-Json
    Write-Host "  TotalResults: $($json.totalResults)"
    Write-Host "  Time: ${elapsed.ToString('F1')}s"
    if ($json.results.Count -gt 0) {
        $preview = $json.results[0].content.Substring(0, [Math]::Min(200, $json.results[0].content.Length))
        Write-Host "  Preview: $preview..."
    }
    Write-Host "  Result: PASS"
} catch {
    Write-Host "  Result: FAIL - $($_.Exception.Message)"
}
Write-Host ""

# Test 4: Search Density:
Write-Host "[4/4] POST /v1/memory/search 'Density:'"
try {
    $start = Get-Date
    $resp = Invoke-WebRequest -Uri "http://localhost:3160/v1/memory/search" -Method POST -Headers @{"Content-Type"="application/json"} -Body '{"query":"Density:","stream":false}' -UseBasicParsing -TimeoutSec 60
    $elapsed = ((Get-Date) - $start).TotalSeconds
    $json = $resp.Content | ConvertFrom-Json
    Write-Host "  TotalResults: $($json.totalResults)"
    Write-Host "  Time: ${elapsed.ToString('F1')}s"
    if ($json.results.Count -gt 0) {
        $preview = $json.results[0].content.Substring(0, [Math]::Min(200, $json.results[0].content.Length))
        Write-Host "  Preview: $preview..."
    }
    Write-Host "  Result: PASS"
} catch {
    Write-Host "  Result: FAIL - $($_.Exception.Message)"
}
Write-Host ""

Write-Host "============================================"
Write-Host "  ALL TESTS COMPLETE"
Write-Host "============================================"