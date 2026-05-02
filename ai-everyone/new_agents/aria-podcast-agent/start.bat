@echo off
REM ═══════════════════════════════════════════
REM ARIA Podcast Agent — Windows Start Script
REM Usage: start.bat [backend|frontend|all]
REM ═══════════════════════════════════════════

setlocal enabledelayedexpansion

set COMMAND=%1
if "%COMMAND%"=="" set COMMAND=all

echo.
echo   ARIA Podcast Agent
echo   -----------------------------------
echo.

if "%COMMAND%"=="backend" goto backend
if "%COMMAND%"=="frontend" goto frontend
if "%COMMAND%"=="all" goto all
echo Usage: start.bat [backend^|frontend^|all]
exit /b 1

:backend
echo [ARIA] Starting backend...
cd /d "%~dp0backend"

REM Create venv if not exists
if not exist "venv\" (
    echo [ARIA] Creating virtual environment...
    python -m venv venv
)

call venv\Scripts\activate.bat

echo [ARIA] Installing dependencies...
pip install -r requirements.txt -q

REM Copy .env if not exists
if not exist ".env" (
    echo [WARN] .env not found - copying from .env.example
    copy .env.example .env
    echo [WARN] Please edit backend\.env with your API keys!
)

echo [OK] Backend starting at http://localhost:8000
python -m app.main
goto end

:frontend
echo [ARIA] Starting frontend...
cd /d "%~dp0frontend"

if not exist "node_modules\" (
    echo [ARIA] Installing npm packages...
    npm install
)

if not exist ".env.local" (
    copy .env.local.example .env.local
)

echo [OK] Frontend starting at http://localhost:3000
npm run dev
goto end

:all
echo [ARIA] Starting all services...

REM Start backend in new window
start "ARIA Backend" cmd /k "cd /d %~dp0 && start.bat backend"

REM Wait then start frontend
timeout /t 5 /nobreak > nul
cd /d "%~dp0"
call :frontend

:end
endlocal
