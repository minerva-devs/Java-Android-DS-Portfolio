#!/usr/bin/env pwsh
# Start Engine Script for Anchor Engine v5.3.0
# Launches engine as background process with PID tracking and health verification
# Designed to work reliably without tool call timeout interference

param(
    [string]$Port = "3160",
    [int]$Timeout = 45,        # Wait up to 45s for healthy status
    [switch]$DebugMode,
    [string]$ProjectRoot = $PSScriptRoot
)

# Resolve project root path
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $ProjectRoot.EndsWith("scripts")) {
    $engineRoot = Join-Path $ProjectRoot "coding_projects/anchor-engine-node"
} else {
    $engineRoot = Split-Path -Parent $PSScriptRoot
}

$distDir = Join-Path $engineRoot "engine/dist"
$logFile = Join-Path $engineRoot ".anchor/logs/engine-startup.log"

# Logging function
function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"
    $logEntry = "[$timestamp] [$Level] $Message"
    
    # Output to console with color coding
    switch ($Level) {
        "ERROR" { Write-Host $logEntry -ForegroundColor Red }
        "WARN"  { Write-Host $logEntry -ForegroundColor Yellow }
        "OK"    { Write-Host $logEntry -ForegroundColor Green }
        default { Write-Host $logEntry -ForegroundColor White }
    }
    
    # Append to log file if exists
    if (Test-Path $logFile) {
        Add-Content -Path $logFile -Value $logEntry
    }
}

Write-Log "[START] Initializing Anchor Engine startup..." "INFO"

# Verify dist directory exists (build required first)
if (-not (Test-Path $distDir)) {
    Write-Log "ERROR: Dist directory not found. Run 'pnpm build' first." "ERROR"
    exit 1
}

# Start engine in background without console window
$engineArgs = @("--expose-gc", "index.js")
Write-Log "Starting engine with args: $engineArgs at http://localhost:$Port"

# Use Start-Process for proper background execution
$processInfo = New-Object System.Diagnostics.ProcessStartInfo
$processInfo.FileName = "node.exe"
$processInfo.Arguments = ($distDir + "\index.js")
$processInfo.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
$processInfo.UseShellExecute = $false
$processInfo.RedirectStandardError = $true

try {
    $engineProcess = [System.Diagnostics.Process]::Start($processInfo)
    Write-Log "[OK] Engine started with PID: $($engineProcess.Id)" "OK"
} catch {
    # Fallback to Start-Process if Process.Start fails
    Write-Log "[WARN] Direct process start failed, using Start-Process..." "WARN"
    $process = Start-Process -FilePath "node.exe" `
        -ArgumentList ($distDir + "\index.js") `
        -WindowStyle Hidden -PassThru
    
    if (-not $process) {
        Write-Log "[ERROR] Failed to start engine process" "ERROR"
        exit 1
    }
    
    # Wait briefly for process to initialize
    Start-Sleep -Milliseconds 2000
    $engineProcess = Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.StartTime -gt (Get-Date).AddSeconds(-5) } | Select-Object -First 1
    
    if (-not $engineProcess) {
        Write-Log "[ERROR] Engine process not found after startup attempt" "ERROR"
        exit 1
    }
}

$processId = $engineProcess.Id
Write-Log "[PID] Engine PID: $processId (Port: $Port)" "INFO"

# Health check loop with configurable timeout
Write-Log "[CHECK] Waiting for engine health endpoint ($Timeout seconds)..."
$startTime = Get-Date
$healthUrl = "http://localhost:$Port/health"
$maxAttempts = $Timeout * 10  # Check every 100ms

for ($i = 0; $i -lt $maxAttempts -and (Get-Date) -lt ($startTime.AddSeconds($Timeout)); $i++) {
    Start-Sleep -Milliseconds 100
    
    try {
        $response = Invoke-RestMethod -Uri $healthUrl -ErrorAction SilentlyContinue
        if ($response.status -eq "ok" -or $response.status -eq "healthy") {
            Write-Log "[OK] Engine healthy at $healthUrl after $($((Get-Date) - $startTime).TotalSeconds)s" "OK"
            
            # Output structured result for test framework consumption
            $result = @{
                success = $true
                pid = $processId
                port = [int]$Port
                startTime = (Get-Date).ToString("o")
                healthCheckTime = ((Get-Date) - $startTime).TotalSeconds
                status = "ok"
            }
            
            Write-Log "[RESULT] Engine ready for testing" "OK"
            return @{ PID = $processId; Status = "healthy"; Port = [int]$Port }
        }
    } catch {
        # Silently continue waiting
        if ($i -eq 0) {
            Write-Log "[DEBUG] Health check in progress: $_" "DEBUG"
        }
    }
}

# Timeout reached without healthy response
Write-Log "[WARN] Engine did not become healthy within ${Timeout}s" "WARN"
Write-Log "[INFO] Process is still running: $($engineProcess.Id)" "INFO"
return @{ PID = $processId; Status = "timeout"; Port = [int]$Port }
