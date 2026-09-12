@echo off
SETLOCAL EnableDelayedExpansion
TITLE VeloPulse Pro - Dashboard
:: Port bisa ditimpa dari environment sebelum skrip ini dijalankan.
if not defined PORT set PORT=3000

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
    call pnpm install
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] pnpm install failed. Please check your internet connection.
        pause
        exit /b %ERRORLEVEL%
    )
)

:: 3. Pastikan port tujuan bebas dulu.
::    `next dev` tidak mencari port kosong sendiri: kalau port sudah dipakai,
::    ia gagal dengan EADDRINUSE lalu keluar dengan kode 1, sementara yang
::    tetap melayani browser adalah instance lama. Artinya "aplikasi tetap
::    jalan" bisa berarti kode yang diuji bukan kode terbaru.
set "GUARD_STATUS="
set "GUARD_PID="
set "GUARD_NAME="
set "GUARD_OWNED="
for /f "usebackq tokens=1,* delims==" %%a in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\dev-port.ps1" -Port %PORT% -ProjectPath "%~dp0."`) do set "GUARD_%%a=%%b"

if not defined GUARD_STATUS (
    echo [WARNING] Pemeriksaan port dilewati: skrip penjaga port tidak merespons.
    goto :luncurkan
)
if /i not "%GUARD_STATUS%"=="INUSE" goto :luncurkan

echo [WARNING] Port %PORT% sudah dipakai oleh %GUARD_NAME% ^(PID %GUARD_PID%^).
if /i "%GUARD_OWNED%"=="YES" (
    echo [INFO] Itu dev server VeloPulse dari folder ini, kemungkinan instance lama.
    echo   [1] Pakai instance yang sudah jalan ^(buka browser saja^)
    echo   [2] Matikan instance lama, lalu jalankan yang baru
    echo   [3] Jalankan di port lain ^(port kosong dicari otomatis^)
) else (
    echo [WARNING] Itu bukan dev server VeloPulse dari folder ini.
    echo   [1] Pakai saja ^(buka browser ke port %PORT%^)
    echo   [2] Tetap matikan proses itu ^(menyentuh proses di luar proyek ini^)
    echo   [3] Jalankan di port lain ^(port kosong dicari otomatis^)
)
choice /c 123 /n /m "Pilih [1/2/3]: "
if errorlevel 3 goto :pakai_port_lain
if errorlevel 2 goto :matikan_pemakai_port
goto :pakai_instance_lama

:pakai_instance_lama
echo [INFO] Memakai instance yang sudah jalan di http://localhost:%PORT%
start "" "http://localhost:%PORT%"
exit /b 0

:matikan_pemakai_port
echo [INFO] Menghentikan pemakai port %PORT% ...
set "STOP_STATUS="
for /f "usebackq tokens=1,* delims==" %%a in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\dev-port.ps1" -Port %PORT% -Mode stop -ProjectPath "%~dp0."`) do set "STOP_%%a=%%b"
if /i "%STOP_STATUS%"=="FREE" (
    echo [SUCCESS] Port %PORT% sudah bebas.
    goto :luncurkan
)
echo [ERROR] Port %PORT% masih dipakai. Beralih ke port lain.
goto :pakai_port_lain

:pakai_port_lain
set "PICK_STATUS="
set "PICK_PORT="
for /f "usebackq tokens=1,* delims==" %%a in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\dev-port.ps1" -Port %PORT% -Mode pick -ProjectPath "%~dp0."`) do set "PICK_%%a=%%b"
if /i not "%PICK_STATUS%"=="FOUND" (
    echo [ERROR] Tidak ada port kosong setelah %PORT%. Hentikan proses yang memakai port itu, lalu jalankan start.bat lagi.
    pause
    exit /b 1
)
set "PORT=%PICK_PORT%"
echo [INFO] Memakai port kosong %PORT%.
goto :luncurkan

:luncurkan
:: 4. Buka browser di latar belakang, lalu jalankan aplikasi
echo [INFO] VeloPulse Pro will launch at http://localhost:%PORT%
start cmd /c "timeout /t 5 /nobreak > nul && start http://localhost:%PORT%"
echo [INFO] Ignition... All systems GO.
echo.
:: Tanpa pemisah `--`: pnpm 11 meneruskan `--` itu apa adanya ke skrip, dan
:: `next dev -- -p 3000` membacanya sebagai nama direktori proyek.
call pnpm run dev -p %PORT%

pause
