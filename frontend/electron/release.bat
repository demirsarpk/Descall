@echo off
setlocal EnableDelayedExpansion
title Descall Release Manager
color 0A
cd /d "%~dp0"

:: ─── GH_TOKEN check ─────────────────────────────────────────────────────────
if "%GH_TOKEN%"=="" (
    echo.
    echo  [!] GH_TOKEN is not set.
    echo.
    echo  Set it once in PowerShell:
    echo    [System.Environment]::SetEnvironmentVariable("GH_TOKEN", "ghp_...", "User")
    echo  Then open a new terminal window.
    echo.
    pause
    exit /b 1
)

:: ─── Read and compute versions via Node ─────────────────────────────────────
node release-versions.cjs > "%TEMP%\descall_ver.txt"
if %ERRORLEVEL% neq 0 (
    echo  [!] Failed to read version. Is Node.js installed?
    pause
    exit /b 1
)
for /f "usebackq tokens=1,2 delims==" %%a in ("%TEMP%\descall_ver.txt") do set "%%a=%%b"
del "%TEMP%\descall_ver.txt" >nul 2>&1

:MENU
cls
echo.
echo  ==========================================
echo       DESCALL  RELEASE  MANAGER
echo  ==========================================
echo.
echo   Current version:  v%CURRENT_VER%
echo.
echo   Select release type:
echo.
echo    [1]  Patch   v%CURRENT_VER%  ->  v%NEXT_PATCH%   (bug fixes)
echo    [2]  Minor   v%CURRENT_VER%  ->  v%NEXT_MINOR%   (new features)
echo    [3]  Major   v%CURRENT_VER%  ->  v%NEXT_MAJOR%   (breaking changes)
echo    [4]  Rebuild v%CURRENT_VER%  (no version bump)
echo.
echo    [Q]  Quit
echo.
set /p "CHOICE=  > "

if /i "%CHOICE%"=="1" (
    set "BUMP_ARG="
    set "NEXT_VER=%NEXT_PATCH%"
    goto :CONFIRM
)
if /i "%CHOICE%"=="2" (
    set "BUMP_ARG=--minor"
    set "NEXT_VER=%NEXT_MINOR%"
    goto :CONFIRM
)
if /i "%CHOICE%"=="3" (
    set "BUMP_ARG=--major"
    set "NEXT_VER=%NEXT_MAJOR%"
    goto :CONFIRM
)
if /i "%CHOICE%"=="4" (
    set "BUMP_ARG=--no-bump"
    set "NEXT_VER=%CURRENT_VER%"
    goto :CONFIRM
)
if /i "%CHOICE%"=="q" goto :EXIT
goto :MENU

:CONFIRM
echo.
echo  ------------------------------------------
echo   About to release:  v%NEXT_VER%
echo  ------------------------------------------
echo   Steps:
echo    1. Bump package.json  (%CURRENT_VER% -> %NEXT_VER%)
echo    2. Build Electron app (win x64 + ia32)
echo    3. Create GitHub release tag v%NEXT_VER%
echo    4. Upload .exe + .blockmap + latest.yml
echo    5. Git commit and push
echo  ------------------------------------------
echo.
set /p "CONFIRM=  Proceed? [Y/N] > "
if /i "%CONFIRM%"=="y" goto :RUN
if /i "%CONFIRM%"=="yes" goto :RUN
echo.
echo  Cancelled. Going back to menu...
timeout /t 2 /nobreak >nul
goto :MENU

:RUN
echo.
echo  ==========================================
echo   Starting release pipeline for v%NEXT_VER%
echo  ==========================================
echo.
node release.cjs %BUMP_ARG%
set "EXIT_CODE=%ERRORLEVEL%"
echo.
if %EXIT_CODE%==0 (
    echo  ==========================================
    echo   SUCCESS: Descall v%NEXT_VER% is live!
    echo  ==========================================
) else (
    echo  ==========================================
    echo   FAILED - check the output above.
    echo  ==========================================
)
echo.
pause
if %EXIT_CODE%==0 goto :EXIT
goto :MENU

:EXIT
endlocal
exit /b 0
