# Search Validation Test Suite
# Runs 4 tests: stats, Python, machine learning, Density:

$headers = @{"Content-Type"="application/json"}
$results = @()

Write-Host "============================================"
Write-Host "  SEARCH VALIDATION TEST SUITE"
Write-Host "============================================"

# Test 1: GET /v1/stats
Write-Host "`n[1/4] GET /v1/stats"
try {
    $resp = Invoke-WebRequest -Uri "http://localhost:3160/v1/stats" -UseBasicParsing -TimeoutSec 10
    $json = $resp.Content | ConvertFrom-Json
    $pass = "PASS"
    $results += [PSCustomObject]@{Test="Stats"; Status=$pass; TotalResults=$json.atoms + $json.molecules; ElapsedMs=0}
    Write-Host "  ✓ Atoms: $($json.atoms) | Molecules: $($json.molecules) | Tags: $($json.tags)"
} catch {
    $pass = "FAIL"
    $results += [PSCustomObject]@{Test="Stats"; Status=$pass; TotalResults=0; ElapsedMs=0}
    Write-Host "  ✗ Failed: $($_.Exception.Message)"
}

# Test 2: Search "Python"
Write-Host "`n[2/4] POST /v1/memory/search 'Python'"
$startPython = Get-Date
try {
    $body = '{"query":"Python","stream":false}'
    $resp = Invoke-WebRequest -Uri "http://localhost:3160/v1/memory/search" -Method POST -Headers $headers -Body $body -UseBasicParsing -TimeoutSec 60
    $elapsed = ((Get-Date) - $startPython).TotalMilliseconds
    $json = $resp.Content | ConvertFrom-Json
    $pass = "PASS"
    $results += [PSCustomObject]@{Test="Python"; Status=$pass; TotalResults=$json.totalResults; ElapsedMs=[math]::Round($elapsed)}
    Write-Host "  ✓ Results: $($json.totalResults) in $($elapsed.ToString('F0'))ms"
    if ($json.results.Count -gt 0) {
        $preview = $json.results[0].content.Substring(0, [Math]::Min(150, $json.results[0].content.Length))
        Write-Host "  Preview: $preview..."
    }
} catch {
    $pass = "FAIL"
    $results += [PSCustomObject]@{Test="Python"; Status=$pass; TotalResults=0; ElapsedMs=0}
    Write-Host "  ✗ Failed: $($_.Exception.Message)"
}

# Test 3: Search "machine learning"
Write-Host "`n[3/4] POST /v1/memory/search 'machine learning'"
$startML = Get-Date
try {
    $body = '{"query":"machine learning","stream":false}'
    $resp = Invoke-WebRequest -Uri "http://localhost:3160/v1/memory/search" -Method POST -Headers $headers -Body $body -UseBasicParsing -TimeoutSec 60
    $elapsed = ((Get-Date) - $startML).TotalMilliseconds
    $json = $resp.Content | ConvertFrom-Json
    $pass = "PASS"
    $results += [PSCustomObject]@{Test="ML"; Status=$pass; TotalResults=$json.totalResults; ElapsedMs=[math]::Round($elapsed)}
    Write-Host "  ✓ Results: $($json.totalResults) in $($elapsed.ToString('F0'))ms"
    if ($json.results.Count -gt 0) {
        $preview = $json.results[0].content.Substring(0, [Math]::Min(150, $json.results[0].content.Length))
        Write-Host "  Preview: $preview..."
    }
} catch {
    $pass = "FAIL"
    $results += [PSCustomObject]@{Test="ML"; Status=$pass; TotalResults=0; ElapsedMs=0}
    Write-Host "  ✗ Failed: $($_.Exception.Message)"
}

# Test 4: Search "Density:"
Write-Host "`n[4/4] POST /v1/memory/search 'Density:'"
$startDensity = Get-Date
try {
    $body = '{"query":"Density:","stream":false}'
    $resp = Invoke-WebRequest -Uri "http://localhost:3160/v1/memory/search" -Method POST -Headers $headers -Body $body -UseBasicParsing -TimeoutSec 60
    $elapsed = ((Get-Date) - $startDensity).TotalMilliseconds
    $json = $resp.Content | ConvertFrom-Json
    $pass = "PASS"
    $results += [PSCustomObject]@{Test="Density"; Status=$pass; TotalResults=$json.totalResults; ElapsedMs=[math]::Round($elapsed)}
    Write-Host "  ✓ Results: $($json.totalResults) in $($elapsed.ToString('F0'))ms"
    if ($json.results.Count -gt 0) {
        $preview = $json.results[0].content.Substring(0, [Math]::Min(150, $json.results[0].content.Length))
        Write-Host "  Preview: $preview..."
    }
} catch {
    $pass = "FAIL"
    $results += [PSCustomObject]@{Test="Density"; Status=$pass; TotalResults=0; ElapsedMs=0}
    Write-Host "  ✗ Failed: $($_.Exception.Message)"
}

Write-Host "`n============================================"
Write-Host "  TEST SUMMARY"
Write-Host "============================================"
$passCount = ($results | Where-Object {$_.Status -eq "PASS"}).Count
$failCount = ($results | Where-Object {$_.Status -eq "FAIL"}).Count
Write-Host "Passed: $passCount/4"
Write-Host "Failed: $failCount/4"
Write-Host ""
$results | Format-Table -AutoSize