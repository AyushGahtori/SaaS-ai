@echo off
SETLOCAL

echo ============================================
echo  LeadGen AI Agent - Windows Setup Script
echo ============================================
echo.

:: Check Python
python --version >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python not found. Install Python 3.11+ from https://python.org
    pause
    exit /b 1
)
echo [OK] Python found

:: Check Node.js
node --version >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js not found. Install Node.js 18+ from https://nodejs.org
    pause
    exit /b 1
)
echo [OK] Node.js found

:: Backend setup
echo.
echo --- Setting up Backend ---
cd backend

IF NOT EXIST venv (
    echo Creating virtual environment...
    python -m venv venv
)

echo Activating virtual environment...
call venv\Scripts\activate

echo Installing Python dependencies...
pip install -r requirements.txt

IF NOT EXIST .env (
    echo Copying .env.example to .env ...
    copy .env.example .env
    echo.
    echo [ACTION REQUIRED] Edit backend\.env with your API keys!
    echo   - SERPER_API_KEY (from https://serper.dev)
    echo   - TAVILY_API_KEY (from https://app.tavily.com)
    echo   - LLM provider settings
    echo.
)

cd ..

:: Frontend setup
echo.
echo --- Setting up Frontend ---
cd frontend

echo Installing Node.js dependencies...
npm install

IF NOT EXIST .env.local (
    copy .env.local.example .env.local
)

cd ..

echo.
echo ============================================
echo  Setup Complete!
echo ============================================
echo.
echo NEXT STEPS:
echo.
echo 1. Edit backend\.env with your API keys
echo.
echo 2. Start MongoDB (if not running as a service)
echo    mongod --dbpath C:\data\db
echo.
echo 3. Start Redis (if not running as a service)
echo    redis-server
echo.
echo 4. Start Backend (new terminal):
echo    cd backend
echo    venv\Scripts\activate
echo    python -m uvicorn app.main:app --reload --port 8000
echo.
echo 5. Start Frontend (new terminal):
echo    cd frontend
echo    npm run dev
echo.
echo 6. Open http://localhost:3000 in your browser
echo.
pause
