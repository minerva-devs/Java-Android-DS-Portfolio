#!/usr/bin/env pwsh
# Watchdog Startup Script for Anchor Engine v5.3.0
# Ensures watchdog runs continuously monitoring file system changes
# Designed to survive engine restarts and report active status

param(
    [string]$WatchdogPort = "3161",
    [int]$StartupTimeout = 30,     # Wait up to 30s for health check
    [switch]$Verbose
)

# Logging function
function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"
    $logEntry = "[$timestamp] [$Level] [WATCHDOG] $Message"
    
    switch ($Level) {
        "ERROR" { Write-Host $logEntry -ForegroundColor Red }
        "WARN"  { Write-Host $logEntry -ForegroundColor Yellow }
        "OK"    { Write-Host $logEntry -ForegroundColor Green }
        default { if ($Verbose) { Write-Host $logEntry -ForegroundColor White } }
    }
}

Write-Log "[START] Initializing Watchdog process..." "INFO"

# Resolve paths
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$engineRoot = Split-Path -Parent $PSScriptRoot
$logFile = Join-Path $engineRoot ".anchor/logs/watchdog-startup.log"

Write-Log "[CONFIG] Watchdog port: $WatchdogPort, Engine root: $engineRoot" "INFO"

# Start watchdog process (using node for TypeScript execution via tsx)
try {
    Write-Log "[START] Launching watchdog service..." "INFO"
    
    # Try tsx first, fall back to direct node if needed
    $watchdogScript = Join-Path $engineRoot "src/services/watchdog.ts"
    if (Test-Path $watchdogScript) {
        Write-Log "[START] Starting: node src/services/watchdog.ts (Port: $WatchdogPort)" "INFO"
        
        # Use Start-Process with proper background execution
        $process = Start-Process -FilePath "node.exe" `
            -ArgumentList "--loader", "tsx", "--no-warnings", "src/services/watchdog.ts" `
            -WorkingDirectory $engineRoot `
            -WindowStyle Hidden -PassThru
        
        if (-not $process) {
            Write-Log "[ERROR] Failed to start watchdog process" "ERROR"
            exit 1
        }
        
        $watchdogPID = $process.Id
    } else {
        # Fallback to compiled JS version
        Write-Log "[WARN] TypeScript file not found, using dist/watchdog.js" "WARN"
        $distWatchdog = Join-Path $engineRoot "dist/services/watchdog.js"
        
        if (-not (Test-Path $distWatchdog)) {
            Write-Log "[ERROR] Watchdog script not found in src/ or dist/" "ERROR"
            exit 1
        }
        
        $process = Start-Process -FilePath "node.exe" `
            -ArgumentList $distWatchdog `
            -WorkingDirectory $engineRoot `
            -WindowStyle Hidden -PassThru
        
        if (-not $process) {
            Write-Log "[ERROR] Failed to start watchdog process" "ERROR"
            exit 1
        }
        
        $watchdogPID = $process.Id
    }
    
} catch {
    Write-Log "[ERROR] Watchdog startup failed: $_" "ERROR"
    exit 1
}

Write-Log "[OK] Watchdog started with PID: $watchdogPID" "OK"

# Health check loop - verify watchdog is accepting connections
Write-Log "[CHECK] Waiting for watchdog health endpoint ($StartupTimeout seconds)..." "INFO"
$startTime = Get-Date
$maxAttempts = $StartupTimeout * 10
$healthUrl = "http://localhost:$WatchdogPort/health"

for ($i = 0; $i -lt $maxAttempts -and (Get-Date) -lt ($startTime.AddSeconds($StartupTimeout)); $i++) {
    Start-Sleep -Milliseconds 200
    
    try {
        $response = Invoke-RestMethod -Uri $healthUrl -ErrorAction SilentlyContinue
        
        if ($response.status -eq "ok" -or $response.status -eq "running") {
            Write-Log "[OK] Watchdog healthy at $healthUrl after $($((Get-Date) - $startTime).TotalSeconds)s" "OK"
            
            # Return structured result for test framework
            $result = @{
                success = $true
                pid = $watchdogPID
                port = [int]$WatchdogPort
                startTime = (Get-Date).ToString("o")
                healthCheckTime = ((Get-Date) - $startTime).TotalSeconds
                status = "ok"
            }
            
            Write-Log "[RESULT] Watchdog ready for monitoring" "OK"
            return @{ PID = $watchdogPID; Status = "healthy"; Port = [int]$WatchdogPort }
        }
    } catch {
        if ($i -eq 0) {
            Write-Log "[DEBUG] Watchdog health check in progress: $_" "DEBUG"
        }
    }
}

# Timeout reached without healthy response
Write-Log "[WARN] Watchdog did not become healthy within ${StartupTimeout}s" "WARN"
return @{ PID = $watchdogPID; Status = "timeout"; Port = [int]$WatchdogPort }
