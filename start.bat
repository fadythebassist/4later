@echo off
echo Checking for processes on port 5173...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173') do (
    echo Killing process %%a
    taskkill /F /PID %%a 2>nul
)
timeout /t 1 /nobreak >nul
echo Starting 4stash on port 5173...
npm run dev
