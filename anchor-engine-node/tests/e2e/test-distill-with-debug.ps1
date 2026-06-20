$engineDir = "C:\Users\rsbii\.qwenpaw\workspaces\P1\coding_projects\anchor-engine-node\engine"
$logFile = "C:\Users\rsbii\.qwenpaw\workspaces\P1\coding_projects\anchor-engine-node\engine\logs\engine-debug.log"

Write-Host "Starting engine from: $engineDir" -ForegroundColor Green

# Start the engine and capture output
$process = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "pnpm start" -NoNewWindow -PassThru -WorkingDirectory $engineDir

Write-Host "Engine started with PID: $($process.Id)" -ForegroundColor Green
Write-Host "Waiting for engine to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

# Test the distillation endpoint
Write-Host "`n=== Testing Distillation Endpoint ===" -ForegroundColor Cyan
$postData = @{
    seed = @{ query = "test" }
    radius = 2
} | ConvertTo-Json -Compress

Write-Host "Sending: $postData" -ForegroundColor Yellow
$response = Invoke-RestMethod -Uri "http://localhost:3160/v1/memory/distill" -Method Post -Body $postData -ContentType "application/json" -UseBasicParsing
Write-Host "Response: $($response | ConvertTo-Json -Compress)" -ForegroundColor White

# Check debug logs
Write-Host "`n=== Checking Debug Logs ===" -ForegroundColor Magenta
$debugLog = "C:\Users\rsbii\.anchor\logs\distill-debug.log"
if (Test-Path $debugLog) {
    Write-Host "✓ distill-debug.log exists" -ForegroundColor Green
    Get-Content $debugLog
} else {
    Write-Host "✗ distill-debug.log NOT found" -ForegroundColor Red
}

$radialLog = "C:\Users\rsbii\.anchor\logs\radial-distill-debug.log"
if (Test-Path $radialLog) {
    Write-Host "✓ radial-distill-debug.log exists" -ForegroundColor Green
    Get-Content $radialLog
} else {
    Write-Host "✗ radial-distill-debug.log NOT found" -ForegroundColor Red
}
