@echo off
SETLOCAL EnableDelayedExpansion
TITLE VeloPulse Pro - Mission Control Dashboard
SET PORT=3000

echo =======================================================
echo.
echo    __     __        _       _____       _              
echo    \ \   / /       ^| ^|     ^|  __ \     ^| ^|             
echo     \ \_/ /__ _   _^| ^| ___ ^| ^|__) ^|   _^| ^|___  ___ 
echo      \   / _ \ ^| ^| ^| ^|/ _ \^|  ___/ ^| ^| ^| / __^|/ _ \
echo       ^| ^|  __/ ^|_^| ^| ^| (_) ^| ^|   ^| ^|_^| ^| \__ \  __/
echo       ^|_^|\___^|\__,_^|_^|\___/^|_^|    \__,_^|_^|___/\___^|
echo.
echo =======================================================
echo          MODERN NEXT.JS ARCHITECTURE ACTIVE
echo =======================================================
echo.

:: 1. Check for Environment Variables
if not exist ".env" (
    if not exist ".env.local" (
        echo [WARNING] No .env or .env.local file found!
        echo [INFO] Creating .env from .env.example...
        if exist ".env.example" (
            copy .env.example .env
            echo [SUCCESS] .env created. Please update it with your credentials.
        ) else (
            echo [ERROR] .env.example not found. Please create .env manually.
            pause
            exit /b 1
        )
    )
)

:: 2. Check if node_modules exists
if not exist "node_modules\" (
    echo [INFO] Node modules not found. Launching initial setup...
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] npm install failed. Please check your internet connection.
        pause
        exit /b %ERRORLEVEL%
    )
)

:: 3. Launch the browser in the background after a short delay
echo [INFO] Mission Control will launch at http://localhost:%PORT%
start cmd /c "timeout /t 5 /nobreak > nul && start http://localhost:%PORT%"

:: 4. Start the application
echo [INFO] Ignition... All systems GO.
echo.
call npm run dev

pause
