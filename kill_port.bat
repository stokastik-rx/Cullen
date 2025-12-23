@echo off
REM Batch script to kill process using port 8000 (or specified port)
set PORT=8000
if not "%1"=="" set PORT=%1

echo Checking for processes using port %PORT%...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%PORT%') do (
    echo Found process with PID: %%a
    taskkill /PID %%a /F >nul 2>&1
    if errorlevel 1 (
        echo Failed to kill process %%a
    ) else (
        echo Successfully killed process %%a
    )
)

echo Port %PORT% should now be free!

