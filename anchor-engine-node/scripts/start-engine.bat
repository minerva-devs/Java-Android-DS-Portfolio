@echo off
REM ============================================================================
REM Anchor Engine Startup Script
REM ============================================================================

cd /F "%~dp0"
set NODE_ENV=production
set NODE_OPTIONS=--max-http-header-size=16384

echo ================================================
echo Anchor Engine Startup
echo ================================================

echo [1/4] Checking project structure...
if not exist "package.json" (
    echo ERROR: package.json not found
    exit /b 1
)

echo [2/4] Installing dependencies with pnpm...
pnpm install --no-optional --reporter=silent 2>nul || (
    echo WARN: pnpm install completed with warnings
)

echo [3/4] Building engine...
call pnpm run build 2>nul || echo WARN: Build completed with warnings

echo [4/4] Starting Anchor Engine...
echo [INFO] Engine PID: %PID%
start /b cmd /c "pnpm start-with-logging"
echo [INFO] Engine started in background
echo [INFO] Server should be available at http://localhost:3160
echo [INFO] Logs at: .anchor\logs\
exit /b 0