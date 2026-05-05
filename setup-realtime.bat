@echo off
REM Real-Time Resume Screening - Quick Start Script for Windows
REM This script helps you set up and run the real-time scoring system

echo.
echo ========================================
echo Real-Time Resume Screening Setup
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    pause
    exit /b 1
)

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH
    pause
    exit /b 1
)

echo.
echo Step 1: Installing backend dependencies...
cd backend
echo Installing Python packages from requirements.txt...
pip install -r requirements.txt --quiet

if errorlevel 1 (
    echo ERROR: Failed to install Python dependencies
    pause
    exit /b 1
)
echo [OK] Backend dependencies installed

cd ..

echo.
echo Step 2: Installing frontend dependencies...
cd frontend
if not exist node_modules (
    echo Installing Node packages...
    call npm install --silent
    if errorlevel 1 (
        echo ERROR: Failed to install Node dependencies
        cd ..
        pause
        exit /b 1
    )
) else (
    echo [OK] Node modules already exist
)
cd ..

echo.
echo Step 3: Building frontend...
cd frontend
echo Building React app for development...
call npm run build --silent
if errorlevel 1 (
    echo WARNING: Frontend build had issues, but continuing...
)
cd ..

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo To run the real-time scoring system:
echo.
echo Terminal 1 (Backend):
echo   cd backend
echo   python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
echo.
echo Terminal 2 (Frontend):
echo   cd frontend
echo   npm start
echo.
echo Then open your browser to: http://localhost:3000
echo.
echo Features:
echo   - Navigate to "Upload" page
echo   - Toggle "Real-time Scoring" ON
echo   - Upload resumes and job descriptions
echo   - Watch real-time progress updates!
echo.
pause
