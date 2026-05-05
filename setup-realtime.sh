#!/bin/bash

# Real-Time Resume Screening - Quick Start Script for macOS/Linux
# This script helps you set up and run the real-time scoring system

echo ""
echo "========================================"
echo "Real-Time Resume Screening Setup"
echo "========================================"
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 is not installed"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed"
    exit 1
fi

echo "Python version: $(python3 --version)"
echo "Node version: $(node --version)"
echo ""

# Step 1: Install backend dependencies
echo "Step 1: Installing backend dependencies..."
cd backend
echo "Installing Python packages from requirements.txt..."
pip3 install -r requirements.txt

if [ $? -ne 0 ]; then
    echo "ERROR: Failed to install Python dependencies"
    exit 1
fi
echo "[OK] Backend dependencies installed"

cd ..

# Step 2: Install frontend dependencies
echo ""
echo "Step 2: Installing frontend dependencies..."
cd frontend
if [ ! -d "node_modules" ]; then
    echo "Installing Node packages..."
    npm install
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to install Node dependencies"
        exit 1
    fi
else
    echo "[OK] Node modules already exist"
fi
cd ..

# Step 3: Build frontend
echo ""
echo "Step 3: Building frontend..."
cd frontend
echo "Building React app for development..."
npm run build
if [ $? -ne 0 ]; then
    echo "WARNING: Frontend build had issues, but continuing..."
fi
cd ..

echo ""
echo "========================================"
echo "Setup Complete!"
echo "========================================"
echo ""
echo "To run the real-time scoring system:"
echo ""
echo "Terminal 1 (Backend):"
echo "  cd backend"
echo "  python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
echo ""
echo "Terminal 2 (Frontend):"
echo "  cd frontend"
echo "  npm start"
echo ""
echo "Then open your browser to: http://localhost:3000"
echo ""
echo "Features:"
echo "  - Navigate to 'Upload' page"
echo "  - Toggle 'Real-time Scoring' ON"
echo "  - Upload resumes and job descriptions"
echo "  - Watch real-time progress updates!"
echo ""
