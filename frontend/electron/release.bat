@echo off
setlocal EnableDelayedExpansion
title Descall Release Manager
color 0A
cd /d "%~dp0"

:: ─── ANSI colors (Windows 10+) ──────────────────────────────────────────────
for /f %%a in ('echo prompt $E^| cmd') do set "ESC=%%a"
set "RESET=%ESC%[0m"
set "BOLD=%ESC%[1m"
set "DIM=%ESC%[2m"
set "CYAN=%ESC%[96m"
set "GREEN=%ESC%[92m"
set "YELLOW=%ESC%[93m"
set "RED=%ESC%[91m"
set "WHITE=%ESC%[97m"
set "BLUE=%ESC%[94m"
set "MAGENTA=%ESC%[95m"

:: ─── GH_TOKEN check ─────────────────────────────────────────────────────────
if "%GH_TOKEN%"=="" (
    echo.
    echo  %RED%%BOLD%[!] GH_TOKEN is not set.%RESET%
    echo.
    echo  %YELLOW%Set it once in PowerShell:%RESET%
    echo  %DIM%  [System.Environment]::SetEnvironmentVariable("GH_TOKEN", "ghp_...", "User")%RESET%
    echo  %DIM%  Then restart this terminal.%RESET%
    echo.
    pause
    exit /b 1
)

:: ─── Read and compute versions via Node ─────────────────────────────────────
node release-versions.cjs > "%TEMP%\descall_versions.txt" 2>nul
if %ERRORLEVEL% neq 0 (
    echo  %RED%[!] Failed to read version from package.json%RESET%
    pause
    exit /b 1
)
for /f "tokens=1,2 delims==" %%a in (%TEMP%\descall_versions.txt) do set "%%a=%%b"
del "%TEMP%\descall_versions.txt" >nul 2>&1

:MENU
cls
echo.
echo  %CYAN%%BOLD%╔══════════════════════════════════════════════╗%RESET%
echo  %CYAN%%BOLD%║         DESCALL  RELEASE  MANAGER           ║%RESET%
echo  %CYAN%%BOLD%╚══════════════════════════════════════════════╝%RESET%
echo.
echo  %DIM%Current version:%RESET%  %BOLD%%WHITE%v%CURRENT_VER%%RESET%
echo.
echo  %BOLD%Select release type:%RESET%
echo.
echo   %GREEN%[1]%RESET%  Patch   %DIM%v%CURRENT_VER% → %WHITE%v%NEXT_PATCH%%RESET%  %DIM%(bug fixes, small updates)%RESET%
echo   %YELLOW%[2]%RESET%  Minor   %DIM%v%CURRENT_VER% → %WHITE%v%NEXT_MINOR%%RESET%  %DIM%(new features, non-breaking)%RESET%
echo   %RED%[3]%RESET%  Major   %DIM%v%CURRENT_VER% → %WHITE%v%NEXT_MAJOR%%RESET%  %DIM%(breaking changes)%RESET%
echo   %MAGENTA%[4]%RESET%  Rebuild %DIM%v%CURRENT_VER% (no version bump)%RESET%
echo.
echo   %DIM%[Q]  Quit%RESET%
echo.
set /p "CHOICE=  %BOLD%> %RESET%"

if /i "%CHOICE%"=="1" goto :CONFIRM_PATCH
if /i "%CHOICE%"=="2" goto :CONFIRM_MINOR
if /i "%CHOICE%"=="3" goto :CONFIRM_MAJOR
if /i "%CHOICE%"=="4" goto :CONFIRM_NOBUMP
if /i "%CHOICE%"=="q" goto :EXIT
goto :MENU

:: ─── Confirm screens ────────────────────────────────────────────────────────
:CONFIRM_PATCH
set "BUMP_ARG="
set "NEXT_VER=%NEXT_PATCH%"
goto :CONFIRM

:CONFIRM_MINOR
set "BUMP_ARG=--minor"
set "NEXT_VER=%NEXT_MINOR%"
goto :CONFIRM

:CONFIRM_MAJOR
set "BUMP_ARG=--major"
set "NEXT_VER=%NEXT_MAJOR%"
goto :CONFIRM

:CONFIRM_NOBUMP
set "BUMP_ARG=--no-bump"
set "NEXT_VER=%CURRENT_VER%"
goto :CONFIRM

:CONFIRM
echo.
echo  %YELLOW%%BOLD%  ┌─────────────────────────────────────────┐%RESET%
echo  %YELLOW%%BOLD%  │  About to release  v%NEXT_VER%%RESET%
echo  %YELLOW%%BOLD%  │%RESET%
echo  %YELLOW%%BOLD%  │%RESET%  %DIM%1. Bump package.json version%RESET%
echo  %YELLOW%%BOLD%  │%RESET%  %DIM%2. Build Electron app (win x64 + ia32)%RESET%
echo  %YELLOW%%BOLD%  │%RESET%  %DIM%3. Create GitHub release  v%NEXT_VER%%RESET%
echo  %YELLOW%%BOLD%  │%RESET%  %DIM%4. Upload .exe + .blockmap + latest.yml%RESET%
echo  %YELLOW%%BOLD%  │%RESET%  %DIM%5. Commit version bump and git push%RESET%
echo  %YELLOW%%BOLD%  └─────────────────────────────────────────┘%RESET%
echo.
set /p "CONFIRM=  %BOLD%Proceed? [Y/N] > %RESET%"
if /i "%CONFIRM%"=="y" goto :RUN
if /i "%CONFIRM%"=="yes" goto :RUN
echo  %DIM%Cancelled.%RESET%
timeout /t 2 /nobreak >nul
goto :MENU

:: ─── Run release script ─────────────────────────────────────────────────────
:RUN
echo.
echo  %CYAN%━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%RESET%
echo  %CYAN%%BOLD%  Starting release pipeline for v%NEXT_VER%...%RESET%
echo  %CYAN%━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%RESET%
echo.
node release.cjs %BUMP_ARG%
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if %EXIT_CODE%==0 (
    echo  %GREEN%%BOLD%╔══════════════════════════════════════════════╗%RESET%
    echo  %GREEN%%BOLD%║   Release v%NEXT_VER% published successfully!   ║%RESET%
    echo  %GREEN%%BOLD%╚══════════════════════════════════════════════╝%RESET%
) else (
    echo  %RED%%BOLD%╔══════════════════════════════════════════════╗%RESET%
    echo  %RED%%BOLD%║   Release FAILED — check output above.       ║%RESET%
    echo  %RED%%BOLD%╚══════════════════════════════════════════════╝%RESET%
)
echo.
pause
if %EXIT_CODE%==0 goto :EXIT
goto :MENU

:EXIT
endlocal
exit /b 0
