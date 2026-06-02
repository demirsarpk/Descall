@echo off
:: Descall Auto Release
:: Double-click this file or run from terminal to build + publish a new release.
:: GH_TOKEN is read from User environment variables (set once, works forever).

if "%GH_TOKEN%"=="" (
    echo [release] ERROR: GH_TOKEN is not set.
    echo Run this in PowerShell first:
    echo   [System.Environment]::SetEnvironmentVariable("GH_TOKEN", "ghp_...", "User")
    pause
    exit /b 1
)

cd /d "%~dp0"
node release.cjs %*
pause
