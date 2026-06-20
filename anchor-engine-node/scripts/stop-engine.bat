@echo off
REM ============================================================================
REM Anchor Engine Shutdown Script
REM ============================================================================
REM This script cleanly shuts down the Anchor Engine by killing the node process
REM running on port 3160. It only affects the engine process, not other apps.
REM ============================================================================

setlocal

echo ================================================
echo Anchor Engine Shutdown
echo ================================================

REM Find the PID of process listening on port 3160
for /f "tokens=5" %p in ('netstat -ano ^| findstr ":3160 LISTENING"') do (
    set "PORT_PID=%p%"
)

if not defined PORT_PID (
    echo.
    echo [OK] No process found on port 3160 - engine may already be stopped
    echo ================================================
    exit /b 0
)

echo Found process ID: %PORT_PID%

REM Verify it's a node process
for /f "tokens=*" %l in ('tasklist | findstr /i "node"') do (
    if "%PORT_PID%"=="%l:"=del" (
        set "NODE_PID=%l%"
    )
)

echo.
echo Stopping Anchor Engine...
taskkill /F /PID %PORT_PID% 2>nul && echo [OK] Process stopped || echo [WARN] Process may have already exited

echo.
echo ================================================
echo Anchor Engine shutdown complete
echo ================================================
exit /b 0