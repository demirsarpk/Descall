@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"
echo [1] Starting...

echo [2] Checking GH_TOKEN in session...
if "%GH_TOKEN%"=="" (
    echo [3] Not in session, reading from User env via PowerShell...
    for /f "usebackq delims=" %%t in (`powershell -NoProfile -Command "[System.Environment]::GetEnvironmentVariable('GH_TOKEN','User')"`) do set "GH_TOKEN=%%t"
    echo [4] After PowerShell read: GH_TOKEN=%GH_TOKEN%
) else (
    echo [3] Already in session.
)

if "%GH_TOKEN%"=="" (
    echo [FAIL] GH_TOKEN is empty!
    pause
    exit /b 1
)
echo [5] GH_TOKEN OK (length check passed)

echo [6] Running release-versions.cjs...
node release-versions.cjs > "%TEMP%\descall_ver.txt"
echo [7] Node exit code: %ERRORLEVEL%
if %ERRORLEVEL% neq 0 (
    echo [FAIL] Node failed!
    pause
    exit /b 1
)

echo [8] Reading versions...
for /f "usebackq tokens=1,2 delims==" %%a in ("%TEMP%\descall_ver.txt") do set "%%a=%%b"
del "%TEMP%\descall_ver.txt" >nul 2>&1

echo [9] CURRENT_VER=%CURRENT_VER%
echo [10] NEXT_PATCH=%NEXT_PATCH%
echo [11] All OK - would show menu here.
pause
