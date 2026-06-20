# Test distillation endpoint with detailed debugging
$baseUrl = "http://localhost:3160"
$endpoint = "/v1/memory/distill"
$postData = @{
    seed = @{ query = "test" }
    radius = 2
} | ConvertTo-Json -Compress

Write-Host "Sending POST to $endpoint" -ForegroundColor Green
Write-Host "Data: $postData" -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri "$baseUrl$endpoint" -Method Post -Body $postData -ContentType "application/json" -UseBasicParsing
    Write-Host "Response Status: $($response.StatusCode)" -ForegroundColor Cyan
    Write-Host "Response Body: $($response.Content)" -ForegroundColor White
} catch {
    Write-Host "Request failed: $_" -ForegroundColor Red
}

# Check if debug log was created
$debugLog = "C:\Users\rsbii\.anchor\logs\distill-debug.log"
if (Test-Path $debugLog) {
    Write-Host "`n=== DEBUG LOG CONTENT ===" -ForegroundColor Magenta
    Get-Content $debugLog
} else {
    Write-Host "`nDEBUG LOG NOT FOUND at $debugLog" -ForegroundColor Red
}

# Check radial distill debug log
$radialLog = "C:\Users\rsbii\.anchor\logs\radial-distill-debug.log"
if (Test-Path $radialLog) {
    Write-Host "`n=== RADIAL DISTILL DEBUG LOG ===" -ForegroundColor Magenta
    Get-Content $radialLog
} else {
    Write-Host "`nRADIAL DEBUG LOG NOT FOUND at $radialLog" -ForegroundColor Red
}
