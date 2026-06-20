@echo off
REM ============================================================================
REM Anchor Engine Run Script (Python Wrapper)
REM ============================================================================
REM This script uses the Python wrapper to start the engine.
REM It's a simple, reliable way to start and stop the engine.
REM ============================================================================

setlocal

echo ================================================
echo Anchor Engine - Python Wrapper
echo ================================================
echo.

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Please install Python 3.8+
    pause
    exit /b 1
)

REM Check if we're in the right directory
cd /F "%~dp0"

echo ================================================
echo STARTING ANCHOR ENGINE
echo ================================================
echo.

python engine_server.py start

if errorlevel 1 (
    echo.
    echo [ERROR] Failed to start engine
    pause
    exit /b 1
)

echo.
echo ================================================
echo ENGINE RUNNING
echo ================================================
echo Server: http://localhost:3160
echo Logs: .anchor\logs\
echo.
pause