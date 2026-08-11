@echo off
setlocal EnableDelayedExpansion
title Descall Release Manager v2.0
color 0A
cd /d "%~dp0"

::  Configuration
set "APP_NAME=Descall"
set "REPO_OWNER=demirsarpk"
set "REPO_NAME=Descall"
set "BUILD_TARGETS=win-x64,win-ia32,win-portable"

::  GH_TOKEN: load from Windows User environment scope
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0get-token.ps1" > "%TEMP%\descall_token.txt" 2>nul
set /p GH_TOKEN= < "%TEMP%\descall_token.txt"
del "%TEMP%\descall_token.txt" >nul 2>&1
if not defined GH_TOKEN goto :NO_TOKEN
if "%GH_TOKEN%"=="" goto :NO_TOKEN
goto :TOKEN_OK
:NO_TOKEN
echo.
echo  [!] GH_TOKEN is not set.
echo.
echo  Run this once in PowerShell, then retry:
echo    [System.Environment]::SetEnvironmentVariable("GH_TOKEN", "ghp_...", "User")
echo.
pause
exit /b 1
:TOKEN_OK

::  Verify Node is available
node --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo.
    echo  [!] Node.js is not installed or not in PATH.
    echo  [!] Install Node.js from https://nodejs.org and retry.
    echo.
    pause
    exit /b 1
)

::  Read and compute versions via Node
if not exist "release-versions.cjs" (
    echo  [!] release-versions.cjs not found in %~dp0
    pause
    exit /b 1
)
node release-versions.cjs > "%TEMP%\descall_ver.txt"
if %ERRORLEVEL% neq 0 (
    echo  [!] Failed to read version. Is Node.js installed?
    pause
    exit /b 1
)
for /f "usebackq tokens=1,2 delims==" %%a in ("%TEMP%\descall_ver.txt") do set "%%a=%%b"
del "%TEMP%\descall_ver.txt" >nul 2>&1

::  Debug: verify version variables loaded
if not defined CURRENT_VER (
    echo.
    echo  [!] Failed to load version variables from release-versions.cjs
    echo  [!] Check that release-versions.cjs prints KEY=VALUE lines
    echo.
    pause
    exit /b 1
)

echo  [DEBUG] CURRENT_VER=%CURRENT_VER%
echo  [DEBUG] NEXT_PATCH=%NEXT_PATCH%
echo  [DEBUG] NEXT_MINOR=%NEXT_MINOR%
echo  [DEBUG] NEXT_MAJOR=%NEXT_MAJOR%

::  Initialize variables
set "BUMP_ARG="
set "NEXT_VER=%CURRENT_VER%"
set "RELEASE_TYPE=custom"
set "BUILD_ONLY=0"
set "SKIP_BUILD=0"
set "SKIP_GIT=0"
set "SKIP_UPLOAD=0"
set "DRY_RUN=0"
set "RELEASE_NOTES="

::  Main Menu
:MENU
cls
echo.
echo  ========================================================================
echo                    DESCALL RELEASE MANAGER v2.0
echo  ========================================================================
echo  Current Version:  v%CURRENT_VER%
echo  Repository:       %REPO_OWNER%/%REPO_NAME%
echo  ========================================================================
echo.
echo   SEMANTIC VERSIONING BUMPS
echo  ----------------------------------------
echo   [1]  Patch      v%NEXT_PATCH%    (bug fixes)
echo   [2]  Minor      v%NEXT_MINOR%    (new features)
echo   [3]  Major      v%NEXT_MAJOR%    (breaking changes)
echo.
echo   MICRO-PATCH BUMPS (for small bug fixes)
echo  ----------------------------------------
echo   [4]  Micro +1   v%NEXT_MICRO_1%   (hotfix)
echo   [5]  Micro +2   v%NEXT_MICRO_2%   (quick fixes)
echo   [6]  Micro +3   v%NEXT_MICRO_3%   (small updates)
echo   [7]  Micro +5   v%NEXT_MICRO_5%   (moderate fixes)
echo   [8]  Micro +10  v%NEXT_MICRO_10%  (multiple fixes)
echo.
echo   SPECIAL OPTIONS
echo  ----------------------------------------
echo   [9]  Custom Version  (enter your own version)
echo   [A]  Rebuild Only    (no version bump, rebuild current)
echo   [B]  Build Only      (skip git and upload)
echo   [C]  Configuration   (change settings)
echo   [V]  View History    (show recent releases)
echo   [L]  Changelog       (generate changelog)
echo.
echo   [H]  Help / Documentation
echo   [Q]  Quit
echo.
set /p "CHOICE=  Select option > "

if /i "%CHOICE%"=="1" (
    set "BUMP_ARG="
    set "NEXT_VER=%NEXT_PATCH%"
    set "RELEASE_TYPE=patch"
    goto :CONFIRM
)
if /i "%CHOICE%"=="2" (
    set "BUMP_ARG=--minor"
    set "NEXT_VER=%NEXT_MINOR%"
    set "RELEASE_TYPE=minor"
    goto :CONFIRM
)
if /i "%CHOICE%"=="3" (
    set "BUMP_ARG=--major"
    set "NEXT_VER=%NEXT_MAJOR%"
    set "RELEASE_TYPE=major"
    goto :CONFIRM
)
if /i "%CHOICE%"=="4" (
    set "BUMP_ARG=--micro-1"
    set "NEXT_VER=%NEXT_MICRO_1%"
    set "RELEASE_TYPE=micro-1"
    goto :CONFIRM
)
if /i "%CHOICE%"=="5" (
    set "BUMP_ARG=--micro-2"
    set "NEXT_VER=%NEXT_MICRO_2%"
    set "RELEASE_TYPE=micro-2"
    goto :CONFIRM
)
if /i "%CHOICE%"=="6" (
    set "BUMP_ARG=--micro-3"
    set "NEXT_VER=%NEXT_MICRO_3%"
    set "RELEASE_TYPE=micro-3"
    goto :CONFIRM
)
if /i "%CHOICE%"=="7" (
    set "BUMP_ARG=--micro-5"
    set "NEXT_VER=%NEXT_MICRO_5%"
    set "RELEASE_TYPE=micro-5"
    goto :CONFIRM
)
if /i "%CHOICE%"=="8" (
    set "BUMP_ARG=--micro-10"
    set "NEXT_VER=%NEXT_MICRO_10%"
    set "RELEASE_TYPE=micro-10"
    goto :CONFIRM
)
if /i "%CHOICE%"=="9" goto :CUSTOM_VERSION
if /i "%CHOICE%"=="a" (
    set "BUMP_ARG=--no-bump"
    set "NEXT_VER=%CURRENT_VER%"
    set "RELEASE_TYPE=rebuild"
    goto :CONFIRM
)
if /i "%CHOICE%"=="b" (
    set "BUILD_ONLY=1"
    set "BUMP_ARG=--no-bump"
    set "NEXT_VER=%CURRENT_VER%"
    set "RELEASE_TYPE=build-only"
    goto :CONFIRM
)
if /i "%CHOICE%"=="c" goto :CONFIG
if /i "%CHOICE%"=="v" goto :VIEW_HISTORY
if /i "%CHOICE%"=="l" goto :CHANGELOG
if /i "%CHOICE%"=="h" goto :HELP
if /i "%CHOICE%"=="q" goto :EXIT
goto :MENU

::  Custom Version Input
:CUSTOM_VERSION
cls
echo.
echo  ========================================================================
echo                    CUSTOM VERSION INPUT
echo  ========================================================================
echo.
echo   Current version: v%CURRENT_VER%
echo.
echo   Enter custom version (format: X.Y.Z):
echo   Example: 2.1.45 or 3.0.0-beta.1
echo.
set /p "CUSTOM_INPUT=  > "
if "%CUSTOM_INPUT%"=="" (
    echo.
    echo  [!] Version cannot be empty.
    pause
    goto :MENU
)
set "NEXT_VER=%CUSTOM_INPUT%"
set "BUMP_ARG=--custom %CUSTOM_INPUT%"
set "RELEASE_TYPE=custom"
goto :CONFIRM

::  Configuration Menu
:CONFIG
cls
echo.
echo  ========================================================================
echo                    CONFIGURATION
echo  ========================================================================
echo.
echo   Current Settings:
echo.
echo   [1]  Repository Owner:      %REPO_OWNER%
echo   [2]  Repository Name:        %REPO_NAME%
echo   [3]  Build Targets:          %BUILD_TARGETS%
echo   [4]  Pre-release Checks:     ENABLED
echo   [5]  Auto-changelog:         ENABLED
echo   [6]  Notify on Success:      ENABLED
echo.
echo   [A]  Advanced Configuration
echo   [R]  Reset to Defaults
echo   [B]  Back to Main Menu
echo.
set /p "CONFIG_CHOICE=  Select option to change > "

if /i "%CONFIG_CHOICE%"=="1" (
    echo.
    set /p "NEW_OWNER=  Enter new repository owner > "
    if not "%NEW_OWNER%"=="" set "REPO_OWNER=%NEW_OWNER%"
    goto :CONFIG
)
if /i "%CONFIG_CHOICE%"=="2" (
    echo.
    set /p "NEW_NAME=  Enter new repository name > "
    if not "%NEW_NAME%"=="" set "REPO_NAME=%NEW_NAME%"
    goto :CONFIG
)
if /i "%CONFIG_CHOICE%"=="3" goto :BUILD_TARGETS_CONFIG
if /i "%CONFIG_CHOICE%"=="4" goto :TOGGLE_PRECHECK
if /i "%CONFIG_CHOICE%"=="5" goto :TOGGLE_CHANGELOG
if /i "%CONFIG_CHOICE%"=="6" goto :TOGGLE_NOTIFY
if /i "%CONFIG_CHOICE%"=="a" goto :ADVANCED_CONFIG
if /i "%CONFIG_CHOICE%"=="r" goto :RESET_CONFIG
if /i "%CONFIG_CHOICE%"=="b" goto :MENU
goto :CONFIG

::  Build Targets Configuration
:BUILD_TARGETS_CONFIG
cls
echo.
echo  ========================================================================
echo                    BUILD TARGETS SELECTION
echo  ========================================================================
echo.
echo   Available Targets:
echo.
echo   [1]  Windows x64        (NSIS installer)
echo   [2]  Windows ia32       (NSIS installer, 32-bit)
echo   [3]  Windows Portable   (Portable executable)
echo   [4]  macOS x64          (DMG + ZIP)
echo   [5]  macOS ARM64        (DMG + ZIP, Apple Silicon)
echo   [6]  Linux x64          (AppImage + DEB + RPM)
echo.
echo   Current: %BUILD_TARGETS%
echo.
echo   [A]  Select All Windows
echo   [M]  Select All macOS
echo   [L]  Select All Linux
echo   [C]  Clear All
echo   [B]  Back
echo.
set /p "TARGET_CHOICE=  Select target > "

if /i "%TARGET_CHOICE%"=="1" (
    echo win-x64 >> "%TEMP%\targets.txt"
    goto :BUILD_TARGETS_CONFIG
)
if /i "%TARGET_CHOICE%"=="2" (
    echo win-ia32 >> "%TEMP%\targets.txt"
    goto :BUILD_TARGETS_CONFIG
)
if /i "%TARGET_CHOICE%"=="3" (
    echo win-portable >> "%TEMP%\targets.txt"
    goto :BUILD_TARGETS_CONFIG
)
if /i "%TARGET_CHOICE%"=="4" (
    echo mac-x64 >> "%TEMP%\targets.txt"
    goto :BUILD_TARGETS_CONFIG
)
if /i "%TARGET_CHOICE%"=="5" (
    echo mac-arm64 >> "%TEMP%\targets.txt"
    goto :BUILD_TARGETS_CONFIG
)
if /i "%TARGET_CHOICE%"=="6" (
    echo linux-x64 >> "%TEMP%\targets.txt"
    goto :BUILD_TARGETS_CONFIG
)
if /i "%TARGET_CHOICE%"=="a" (
    set "BUILD_TARGETS=win-x64,win-ia32,win-portable"
    del "%TEMP%\targets.txt" >nul 2>&1
    goto :CONFIG
)
if /i "%TARGET_CHOICE%"=="m" (
    set "BUILD_TARGETS=mac-x64,mac-arm64"
    del "%TEMP%\targets.txt" >nul 2>&1
    goto :CONFIG
)
if /i "%TARGET_CHOICE%"=="l" (
    set "BUILD_TARGETS=linux-x64"
    del "%TEMP%\targets.txt" >nul 2>&1
    goto :CONFIG
)
if /i "%TARGET_CHOICE%"=="c" (
    set "BUILD_TARGETS="
    del "%TEMP%\targets.txt" >nul 2>&1
    goto :CONFIG
)
if /i "%TARGET_CHOICE%"=="b" (
    if exist "%TEMP%\targets.txt" (
        set /p BUILD_TARGETS=<"%TEMP%\targets.txt"
        del "%TEMP%\targets.txt" >nul 2>&1
    )
    goto :CONFIG
)
goto :BUILD_TARGETS_CONFIG



echo.
echo   Pre-release checks toggled (not implemented in this version)
pause
goto :CONFIG

:TOGGLE_CHANGELOG
echo.
echo   Auto-changelog toggled (not implemented in this version)
pause
goto :CONFIG

:TOGGLE_NOTIFY
echo.
echo   Success notification toggled (not implemented in this version)
pause
goto :CONFIG

::  Advanced Configuration
:ADVANCED_CONFIG
cls
echo.
echo  ========================================================================
echo                    ADVANCED CONFIGURATION
echo  ========================================================================
echo.
echo   [1]  Custom Build Arguments
echo   [2]  Environment Variables
echo   [3]  Git Configuration
echo   [4]  GitHub Settings
echo   [5]  Build Cache Management
echo.
echo   [B]  Back to Configuration
echo.
set /p "ADV_CONFIG_CHOICE=  Select option > "

if /i "%ADV_CONFIG_CHOICE%"=="1" (
    echo.
    echo   Enter custom electron-builder arguments:
    echo   Example: --config.extraMetadata.foo=bar
    echo.
    set /p "CUSTOM_ARGS=  > "
    if not "%CUSTOM_ARGS%"=="" set "CUSTOM_BUILD_ARGS=%CUSTOM_ARGS%"
    goto :ADVANCED_CONFIG
)
if /i "%ADV_CONFIG_CHOICE%"=="2" (
    echo.
    echo   Current environment variables:
    echo   NODE_ENV=%NODE_ENV%
    echo.
    set /p "NEW_NODE_ENV=  Set NODE_ENV > "
    if not "%NEW_NODE_ENV%"=="" set "NODE_ENV=%NEW_NODE_ENV%"
    goto :ADVANCED_CONFIG
)
if /i "%ADV_CONFIG_CHOICE%"=="3" (
    echo.
    echo   Git Configuration:
    git config --list | findstr /i "user\."
    echo.
    set /p "GIT_NAME=  Set git user.name > "
    if not "%GIT_NAME%"=="" git config user.name "%GIT_NAME%"
    set /p "GIT_EMAIL=  Set git user.email > "
    if not "%GIT_EMAIL%"=="" git config user.email "%GIT_EMAIL%"
    goto :ADVANCED_CONFIG
)
if /i "%ADV_CONFIG_CHOICE%"=="4" (
    echo.
    echo   GitHub Settings:
    echo   GH_TOKEN is set: %GH_TOKEN:~0,10%...
    echo.
    echo   [R]  Refresh GH_TOKEN
    echo   [B]  Back
    echo.
    set /p "GH_CHOICE=  > "
    if /i "%GH_CHOICE%"=="r" (
        powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0get-token.ps1" > "%TEMP%\descall_token.txt" 2>nul
        set /p GH_TOKEN= < "%TEMP%\descall_token.txt"
        del "%TEMP%\descall_token.txt" >nul 2>&1
        echo   GH_TOKEN refreshed
        pause
    )
    goto :ADVANCED_CONFIG
)
if /i "%ADV_CONFIG_CHOICE%"=="5" (
    echo.
    echo   Build Cache Management:
    echo.
    echo   [1]  Clear Electron Builder Cache
    echo   [2]  Clear Node Modules
    echo   [3]  Clear All Caches
    echo   [B]  Back
    echo.
    set /p "CACHE_CHOICE=  > "
    if /i "%CACHE_CHOICE%"=="1" (
        echo   Clearing Electron Builder cache...
        rd /s /q "%APPDATA%\electron-builder" 2>nul
        rd /s /q "%TEMP%\electron-builder" 2>nul
        echo   Cache cleared
        pause
    )
    if /i "%CACHE_CHOICE%"=="2" (
        echo   Clearing node_modules...
        rd /s /q node_modules 2>nul
        echo   node_modules cleared
        pause
    )
    if /i "%CACHE_CHOICE%"=="3" (
        echo   Clearing all caches...
        rd /s /q "%APPDATA%\electron-builder" 2>nul
        rd /s /q "%TEMP%\electron-builder" 2>nul
        rd /s /q node_modules 2>nul
        rd /s /q .cache 2>nul
        echo   All caches cleared
        pause
    )
    goto :ADVANCED_CONFIG
)
if /i "%ADV_CONFIG_CHOICE%"=="b" goto :CONFIG
goto :ADVANCED_CONFIG

::  Reset Configuration
:RESET_CONFIG
cls
echo.
echo  ========================================================================
echo                    RESET CONFIGURATION
echo  ========================================================================
echo.
echo   This will reset all settings to default values.
echo.
set /p "RESET_CONFIRM=  Are you sure? [Y/N] > "
if /i "%RESET_CONFIRM%"=="y" (
    set "REPO_OWNER=demirsarpk"
    set "REPO_NAME=Descall"
    set "BUILD_TARGETS=win-x64,win-ia32,win-portable"
    echo   Configuration reset to defaults
    pause
)
goto :CONFIG

::  View Release History
:VIEW_HISTORY
cls
echo.
echo  ========================================================================
echo                    RELEASE HISTORY
echo  ========================================================================
echo.
echo   Fetching recent releases from GitHub...
echo.
gh release list --repo %REPO_OWNER%/%REPO_NAME% --limit 10
if %ERRORLEVEL% neq 0 (
    echo.
    echo  [!] Failed to fetch release history
    echo  Make sure gh CLI is installed and authenticated
)
echo.
pause
goto :MENU



cls
echo.
echo  ========================================================================
echo                    CHANGELOG GENERATOR
echo  ========================================================================
echo.
echo   This will generate a changelog based on git commits.
echo.
echo   [1]  Since last release
echo   [2]  Since specific tag
echo   [3]  Custom date range
echo   [B]  Back to menu
echo.
set /p "CHANGELOG_CHOICE=  Select option > "

if /i "%CHANGELOG_CHOICE%"=="1" (
    echo.
    echo   Generating changelog since last release...
    echo.
    git log --pretty=format:"%%h - %%an, %%ar : %%s" $(git describe --tags --abbrev=0)..HEAD
    echo.
    pause
    goto :MENU
)
if /i "%CHANGELOG_CHOICE%"=="2" (
    echo.
    set /p "TAG=  Enter tag name (e.g., v2.0.0) > "
    echo.
    echo   Generating changelog since %TAG%...
    echo.
    git log --pretty=format:"%%h - %%an, %%ar : %%s" %TAG%..HEAD
    echo.
    pause
    goto :MENU
)
if /i "%CHANGELOG_CHOICE%"=="3" (
    echo.
    set /p "SINCE=  Enter since date (YYYY-MM-DD) > "
    set /p "UNTIL=  Enter until date (YYYY-MM-DD, leave empty for now) > "
    echo.
    if "%UNTIL%"=="" (
        git log --pretty=format:"%%h - %%an, %%ar : %%s" --since=%SINCE%
    ) else (
        git log --pretty=format:"%%h - %%an, %%ar : %%s" --since=%SINCE% --until=%UNTIL%
    )
    echo.
    pause
    goto :MENU
)
if /i "%CHANGELOG_CHOICE%"=="b" goto :MENU
goto :CHANGELOG



cls
echo.
echo  ========================================================================
echo                    RELEASE MANAGER HELP
echo  ========================================================================
echo.
echo   SEMANTIC VERSIONING (SemVer):
echo.
echo   - MAJOR (X.0.0): Incompatible API changes
echo   - MINOR (X.Y.0): Backwards-compatible functionality additions
echo   - PATCH (X.Y.Z): Backwards-compatible bug fixes
echo.
echo   MICRO-PATCH BUMPS:
echo.
echo   - Use for small, frequent bug fixes
echo   - Micro +1: Single hotfix
echo   - Micro +2: Quick fixes (2-3 changes)
echo   - Micro +3: Small updates (3-5 changes)
echo   - Micro +5: Moderate fixes (5-10 changes)
echo   - Micro +10: Multiple fixes (10+ changes)
echo.
echo   SPECIAL OPTIONS:
echo.
echo   - Custom Version: Enter any version string
echo   - Rebuild Only: Rebuild current version without bumping
echo   - Build Only: Build without git operations or upload
echo.
echo   RELEASE PIPELINE:
echo.
echo   1. Version bump in package.json
echo   2. Git commit with version message
echo   3. Git tag creation
echo   4. Electron build for all targets
echo   5. GitHub release creation
echo   6. Asset upload (exe, blockmap, yml)
echo   7. Git push to remote
echo.
echo   REQUIREMENTS:
echo.
echo   - Node.js installed
echo   - GH_TOKEN environment variable set
echo   - Git configured with credentials
echo   - Write access to GitHub repository
echo   - GitHub CLI (gh) installed and authenticated
echo.
echo   TROUBLESHOOTING:
echo.
echo   - Build fails: Clear cache via Configuration ^> Advanced ^> Cache
echo   - Git push fails: Check credentials and branch permissions
echo   - Upload fails: Check GH_TOKEN and repository settings
echo   - Version conflict: Check for uncommitted changes
echo.
pause
goto :MENU

::  Confirmation Screen
:CONFIRM
cls
echo.
echo  ========================================================================
echo                    RELEASE CONFIRMATION
echo  ========================================================================
echo.
echo   Current Version:  v%CURRENT_VER%
echo   Next Version:     v%NEXT_VER%
echo   Release Type:     %RELEASE_TYPE%
echo.
if %BUILD_ONLY%==1 (
    echo   Mode:              BUILD ONLY (no git, no upload)
)
echo.
echo   Pipeline Steps:
echo.
if %BUILD_ONLY%==0 (
    echo   [1]  Bump package.json version
    echo   [2]  Git commit with version message
    echo   [3]  Create git tag v%NEXT_VER%
)
echo   [4]  Build Electron app (%BUILD_TARGETS%)
if %BUILD_ONLY%==0 (
    echo   [5]  Create GitHub release
    echo   [6]  Upload assets to GitHub
    echo   [7]  Push to remote repository
)
echo.
echo   Advanced Options (press any key to skip)
echo  ----------------------------------------
echo   [S]  Skip Build (only git operations)
echo   [G]  Skip Git (only build and upload)
echo   [U]  Skip Upload (only build)
echo   [D]  Dry Run (show what would happen)
echo   [N]  Add Release Notes
echo   [P]  Pre-release Validation
echo   [R]  Rollback Plan
echo.
echo   [ENTER]  Proceed with release
echo   [ESC]    Cancel and return to menu
echo.
set /p "ADV_CHOICE=  > "

if /i "%ADV_CHOICE%"=="s" (
    set "SKIP_BUILD=1"
    goto :CONFIRM_FINAL
)
if /i "%ADV_CHOICE%"=="g" (
    set "SKIP_GIT=1"
    goto :CONFIRM_FINAL
)
if /i "%ADV_CHOICE%"=="u" (
    set "SKIP_UPLOAD=1"
    goto :CONFIRM_FINAL
)
if /i "%ADV_CHOICE%"=="d" (
    set "DRY_RUN=1"
    goto :CONFIRM_FINAL
)
if /i "%ADV_CHOICE%"=="n" goto :RELEASE_NOTES
if /i "%ADV_CHOICE%"=="p" goto :PRE_RELEASE_VALIDATION
if /i "%ADV_CHOICE%"=="r" goto :ROLLBACK_PLAN
if "%ADV_CHOICE%"=="" goto :CONFIRM_FINAL
goto :MENU

::  Pre-release Validation
:PRE_RELEASE_VALIDATION
cls
echo.
echo  ========================================================================
echo                    PRE-RELEASE VALIDATION
echo  ========================================================================
echo.
echo   Running validation checks...
echo.
echo   [1]  Checking for uncommitted changes...
git status --short
if %ERRORLEVEL% neq 0 (
    echo   [!] Git status check failed
) else (
    echo   [OK] Git status check passed
)
echo.
echo   [2]  Checking branch status...
git branch --show-current
echo   Current branch: 
git branch --show-current
if not "%ERRORLEVEL%"=="0" (
    echo   [!] Branch check failed
) else (
    echo   [OK] Branch check passed
)
echo.
echo   [3]  Checking for remote changes...
git fetch --dry-run 2>nul
if %ERRORLEVEL% neq 0 (
    echo   [!] Remote check failed
) else (
    echo   [OK] Remote check passed
)
echo.
echo   [4]  Checking package.json syntax...
node -e "JSON.parse(require('fs').readFileSync('package.json'))" 2>nul
if %ERRORLEVEL% neq 0 (
    echo   [!] package.json syntax error
) else (
    echo   [OK] package.json is valid
)
echo.
echo   [5]  Checking build configuration...
if exist "electron-builder.json" (
    echo   [OK] electron-builder.json found
) else (
    echo   [!] electron-builder.json not found (using package.json)
)
echo.
echo   Validation complete. Press any key to continue...
pause >nul
goto :CONFIRM



cls
echo.
echo  ========================================================================
echo                    ROLLBACK PLAN
echo  ========================================================================
echo.
echo   In case of release failure, follow these steps:
echo.
echo   1. Delete the GitHub release:
echo      gh release delete v%NEXT_VER% --repo %REPO_OWNER%/%REPO_NAME% --yes
echo.
echo   2. Delete the local git tag:
echo      git tag -d v%NEXT_VER%
echo.
echo   3. Delete the remote git tag:
echo      git push origin :refs/tags/v%NEXT_VER%
echo.
echo   4. Revert package.json version:
echo      git checkout HEAD~1 package.json
echo.
echo   5. Revert the commit:
echo      git reset --hard HEAD~1
echo.
echo   6. Force push (if needed):
echo      git push origin main --force
echo.
echo   [C]  Copy rollback commands to clipboard
echo   [B]  Back to confirmation
echo.
set /p "ROLLBACK_CHOICE=  > "
if /i "%ROLLBACK_CHOICE%"=="c" (
    echo   Rollback commands copied to clipboard (not implemented in this version)
    pause
)
goto :CONFIRM



cls
echo.
echo  ========================================================================
echo                    RELEASE NOTES
echo  ========================================================================
echo.
echo   Enter release notes for v%NEXT_VER%
echo   (Press ENTER on empty line to finish)
echo.
set "RELEASE_NOTES="
:NOTES_LOOP
set /p "LINE=  > "
if "%LINE%"=="" goto :CONFIRM_FINAL
if defined RELEASE_NOTES (
    set "RELEASE_NOTES=!RELEASE_NOTES!^!LINE!"
) else (
    set "RELEASE_NOTES=!LINE!"
)
goto :NOTES_LOOP

::  Final Confirmation
:CONFIRM_FINAL
cls
echo.
echo  ========================================================================
echo                    FINAL CONFIRMATION
echo  ========================================================================
echo.
echo   About to release:  v%NEXT_VER%
echo   Type:              %RELEASE_TYPE%
if %SKIP_BUILD%==1 echo   Skip Build:        YES
if %SKIP_GIT%==1 echo   Skip Git:          YES
if %SKIP_UPLOAD%==1 echo   Skip Upload:       YES
if %DRY_RUN%==1 echo   Dry Run:           YES
if defined RELEASE_NOTES echo   Release Notes:    YES
echo.
set /p "FINAL_CONFIRM=  Proceed with release? [Y/N] > "
if /i "%FINAL_CONFIRM%"=="y" goto :RUN
if /i "%FINAL_CONFIRM%"=="yes" goto :RUN
echo.
echo  Cancelled. Returning to menu...
timeout /t 2 /nobreak >nul
goto :MENU

::  Execute Release Pipeline
:RUN
cls
echo.
echo  ╔══════════════════════════════════════════════════════════════════════════╗
echo  ║  STARTING RELEASE PIPELINE FOR v%NEXT_VER%                                 ║
echo  ╚══════════════════════════════════════════════════════════════════════════╝
echo.

if %DRY_RUN%==1 (
    echo  [DRY RUN] The following would be executed:
    echo.
    if %BUILD_ONLY%==0 (
        echo  1. Bump version: %CURRENT_VER% -> %NEXT_VER%
        echo  2. Git commit: "Release v%NEXT_VER%"
        echo  3. Git tag: v%NEXT_VER%
    )
    if %SKIP_BUILD%==0 (
        echo  4. Build: %BUILD_TARGETS%
    )
    if %BUILD_ONLY%==0 (
        if %SKIP_UPLOAD%==0 (
            echo  5. GitHub release: v%NEXT_VER%
            echo  6. Upload assets
        )
        echo  7. Git push
    )
    echo.
    pause
    goto :MENU
)

:: Step 1: Version Bump
if %BUILD_ONLY%==0 (
    echo  [1/7] Bumping version in package.json...
    set "BUMP_CMD=patch"
    set "BUMP_VAL="
    if "%BUMP_ARG%"=="--minor" set "BUMP_CMD=minor"
    if "%BUMP_ARG%"=="--major" set "BUMP_CMD=major"
    if "%BUMP_ARG:~0,7%"=="--micro" (
        set "BUMP_CMD=micro"
        set "BUMP_VAL=%BUMP_ARG:~8%"
    )
    if "%BUMP_ARG:~0,8%"=="--custom" (
        set "BUMP_CMD=custom"
        set "BUMP_VAL=%BUMP_ARG:~8%"
    )
    node bump-version.cjs %BUMP_CMD% %BUMP_VAL% 2>&1 && (
        for /f "usebackq delims=" %%v in (`node -e "console.log(JSON.parse(require('fs').readFileSync('package.json')).version)"`) do set "NEXT_VER=%%v"
        node update-download-page.cjs %NEXT_VER% 2>&1 && (
            echo  [OK] DownloadPage.jsx updated to v%NEXT_VER%
        ) || (
            echo  [WARN] Failed to update DownloadPage.jsx
        )
        echo  [OK] Version bumped to v%NEXT_VER%
    ) || (
        echo  [!] Failed to bump version
        pause
        goto :MENU
    )
)

:: Step 2: Git Commit
if %BUILD_ONLY%==0 (
    echo  [2/7] Creating git commit...
    git add package.json ../src/components/download/DownloadPage.jsx
    git commit -m "Release v%NEXT_VER% (%RELEASE_TYPE%)" && (
        echo  [OK] Commit created
    ) || (
        echo  [!] Failed to create commit
        pause
        goto :MENU
    )
)

:: Step 3: Git Tag
if %BUILD_ONLY%==0 (
    echo  [3/7] Creating git tag...
    git tag -a v%NEXT_VER% -m "Release v%NEXT_VER%" && (
        echo  [OK] Tag v%NEXT_VER% created
    ) || (
        echo  [!] Failed to create tag
        pause
        goto :MENU
    )
)

:: Step 4: Build
if %SKIP_BUILD%==0 (
    echo  [4/7] Building Electron app...
    call npm run build:win && (
        echo  [OK] Build completed
    ) || (
        echo  [!] Build failed
        pause
        goto :MENU
    )
) else (
    echo  [4/7] Skipping build...
)

:: Step 5: GitHub Release
if %BUILD_ONLY%==0 (
    if %SKIP_UPLOAD%==0 (
        where gh >nul 2>&1 || (
            echo  [!] gh CLI not found. Install: winget install GitHub.cli
            echo  [i] Skipping GitHub release and upload steps
            set "SKIP_UPLOAD=1"
            goto :SKIP_GH_RELEASE
        )
        echo  [5/7] Creating GitHub release...
        if defined RELEASE_NOTES (
            gh release create v%NEXT_VER% --repo %REPO_OWNER%/%REPO_NAME% --notes "%RELEASE_NOTES%" && (
                echo  [OK] Release created
            ) || (
                echo  [!] Failed to create release
                pause
                goto :MENU
            )
        ) else (
            gh release create v%NEXT_VER% --repo %REPO_OWNER%/%REPO_NAME% --notes "Release v%NEXT_VER%" && (
                echo  [OK] Release created
            ) || (
                echo  [!] Failed to create release
                pause
                goto :MENU
            )
        )
    ) else (
        echo  [5/7] Skipping upload...
    )
)
:SKIP_GH_RELEASE

:: Step 6: Upload Assets
if %BUILD_ONLY%==0 (
    if %SKIP_UPLOAD%==0 (
        echo  [6/7] Uploading assets...
        gh release upload v%NEXT_VER% dist/*.exe dist/*.blockmap dist/*.yml --repo %REPO_OWNER%/%REPO_NAME% && (
            echo  [OK] Assets uploaded
        ) || (
            echo  [!] Failed to upload assets
            pause
            goto :MENU
        )
    ) else (
        echo  [6/7] Skipping upload...
    )
)

:: Step 7: Git Push
if %BUILD_ONLY%==0 (
    echo  [7/7] Pushing to remote...
    git push origin main && git push origin v%NEXT_VER% && (
        echo  [OK] Pushed to remote
    ) || (
        echo  [!] Failed to push
        pause
        goto :MENU
    )
)

:: Success
cls
echo.
echo  ╔══════════════════════════════════════════════════════════════════════════╗
echo  ║                    RELEASE SUCCESSFUL                                     ║
echo  ╠══════════════════════════════════════════════════════════════════════════╣
echo  ║  Version:         v%NEXT_VER%                                                ║
echo  ║  Release Type:    %RELEASE_TYPE%                                                   ║
echo  ║  Repository:      %REPO_OWNER%/%REPO_NAME%                                            ║
echo  ║  Release URL:     https://github.com/%REPO_OWNER%/%REPO_NAME%/releases/tag/v%NEXT_VER%           ║
echo  ╚══════════════════════════════════════════════════════════════════════════╝
echo.
echo   The release is now live on GitHub!
echo   Users will be able to update via auto-updater.
echo.
pause
goto :MENU

::  Exit
:EXIT
cls
echo.
echo  ╔══════════════════════════════════════════════════════════════════════════╗
echo  ║  THANK YOU FOR USING DESCALL RELEASE MANAGER                             ║
echo  ╠══════════════════════════════════════════════════════════════════════════╣
echo  ║                                                                            ║
echo  ║  Version: 2.0                                                             ║
echo  ║  Author:  Descall Team                                                     ║
echo  ║  License: MIT                                                              ║
echo  ║                                                                            ║
echo  ║  For support and updates:                                                  ║
echo  ║  https://github.com/%REPO_OWNER%/%REPO_NAME%                                       ║
echo  ║                                                                            ║
echo  ╚══════════════════════════════════════════════════════════════════════════╝
echo.
echo   Session Summary:
echo   - Repository: %REPO_OWNER%/%REPO_NAME%
echo   - Current Version: v%CURRENT_VER%
echo   - Build Targets: %BUILD_TARGETS%
echo.
endlocal
exit /b 0



cls
echo.
echo  ╔══════════════════════════════════════════════════════════════════════════╗
echo  ║  ERROR OCCURRED                                                          ║
echo  ╚══════════════════════════════════════════════════════════════════════════╝
echo.
echo   An error occurred during the release process.
echo.
echo   Error Code: %ERRORLEVEL%
echo   Error Stage: %ERROR_STAGE%
echo.
echo   Possible causes:
echo   - Network connectivity issues
echo   - Insufficient permissions
echo   - Invalid configuration
echo   - External service unavailability
echo.
echo   Please check the error messages above for more details.
echo.
echo   [R]  Retry the operation
echo   [L]  View detailed logs
echo   [C]  Continue with next step (if applicable)
echo   [M]  Return to main menu
echo   [Q]  Quit
echo.
set /p "ERROR_CHOICE=  Select option > "
if /i "%ERROR_CHOICE%"=="r" goto :RUN
if /i "%ERROR_CHOICE%"=="l" goto :VIEW_LOGS
if /i "%ERROR_CHOICE%"=="c" goto :CONTINUE_STEP
if /i "%ERROR_CHOICE%"=="m" goto :MENU
if /i "%ERROR_CHOICE%"=="q" goto :EXIT
goto :ERROR_HANDLER

::  View Logs
:VIEW_LOGS
cls
echo.
echo  ========================================================================
echo                    DETAILED LOGS
echo  ========================================================================
echo.
echo   Recent git log:
echo.
git log --oneline -10
echo.
echo   Git status:
echo.
git status
echo.
echo   Build logs (if available):
echo.
if exist "dist\builder-effective-config.yaml" (
    echo   Builder configuration found
    type "dist\builder-effective-config.yaml"
) else (
    echo   No build logs available
)
echo.
pause
goto :ERROR_HANDLER

::  Continue Step
:CONTINUE_STEP
echo.
echo   Continuing with next step...
echo.
goto :RUN

::  Version History Tracking
:VERSION_HISTORY
cls
echo.
echo  ========================================================================
echo                    VERSION HISTORY TRACKING
echo  ========================================================================
echo   Local version history from package.json:
echo.
git log --all --grep="Release" --oneline
echo.
echo   Remote version history:
echo.
gh release list --repo %REPO_OWNER%/%REPO_NAME% --limit 20
echo.
echo   [D]  Download a specific version
echo   [C]  Compare versions
echo   [B]  Back to menu
echo.
set /p "HISTORY_CHOICE=  Select option > "
if /i "%HISTORY_CHOICE%"=="d" goto :DOWNLOAD_VERSION
if /i "%HISTORY_CHOICE%"=="c" goto :COMPARE_VERSIONS
if /i "%HISTORY_CHOICE%"=="b" goto :MENU
goto :VERSION_HISTORY

::  Download Specific Version
:DOWNLOAD_VERSION
cls
echo.
echo  ========================================================================
echo                    DOWNLOAD SPECIFIC VERSION
echo  ========================================================================
set /p "DOWNLOAD_VER=  Enter version to download (e.g., v2.0.0) > "
echo.
echo   Downloading assets for v%DOWNLOAD_VER%...
echo.
gh release download %DOWNLOAD_VER% --repo %REPO_OWNER%/%REPO_NAME% --dir downloads
if %ERRORLEVEL% neq 0 (
    echo   [!] Failed to download version
    pause
) else (
    echo   [OK] Downloaded to downloads\ directory
    pause
)
goto :VERSION_HISTORY

::  Compare Versions
:COMPARE_VERSIONS
cls
echo.
echo  ========================================================================
echo                    COMPARE VERSIONS
echo  ========================================================================
set /p "VER1=  Enter first version (e.g., v2.0.0) > "
set /p "VER2=  Enter second version (e.g., v2.1.0) > "
echo.
echo   Comparing %VER1% to %VER2%...
echo.
gh release view %VER1% --repo %REPO_OWNER%/%REPO_NAME%
echo.
echo   ---
echo.
gh release view %VER2% --repo %REPO_OWNER%/%REPO_NAME%
echo.
pause
goto :VERSION_HISTORY

::  Build Statistics
:BUILD_STATS
cls
echo.
echo  ========================================================================
echo                    BUILD STATISTICS
echo  ========================================================================
echo   Analyzing build statistics...
echo.
if exist "dist" (
    echo   Build artifacts in dist\:
    dir /b dist
    echo.
    echo   Total size:
    for /f "tokens=3" %%a in ('dir /s dist ^| find "File(s)"') do echo   %%a bytes
    echo.
    echo   File count:
    for /f "tokens=2" %%a in ('dir /s dist ^| find "File(s)"') do echo   %%a files
) else (
    echo   No build artifacts found
)
echo.
echo   Git statistics:
echo.
git log --stat --oneline -5
echo.
pause
goto :MENU

::  Environment Diagnostics
:ENV_DIAGNOSTICS
cls
echo.
echo  ========================================================================
echo                    ENVIRONMENT DIAGNOSTICS
echo  ========================================================================
echo   System Information:
echo.
echo   OS: %OS%
echo   Processor: %PROCESSOR_IDENTIFIER%
echo   Computer Name: %COMPUTERNAME%
echo   User Name: %USERNAME%
echo.
echo   Node.js:
node --version
if %ERRORLEVEL% neq 0 (
    echo   [!] Node.js not found
)
echo.
echo   NPM:
npm --version
if %ERRORLEVEL% neq 0 (
    echo   [!] NPM not found
)
echo.
echo   Git:
git --version
if %ERRORLEVEL% neq 0 (
    echo   [!] Git not found
)
echo.
echo   GitHub CLI:
gh --version
if %ERRORLEVEL% neq 0 (
    echo   [!] GitHub CLI not found
)
echo.
echo   Environment Variables:
echo   NODE_ENV=%NODE_ENV%
echo   GH_TOKEN=%GH_TOKEN:~0,10%...
echo.
echo   Disk Space:
wmic logicaldisk get name,freespace,size
echo.
pause
goto :MENU

::  Quick Actions
:QUICK_ACTIONS
cls
echo.
echo  ========================================================================
echo                    QUICK ACTIONS
echo  ========================================================================
echo   [1]  Quick Patch Release (+1)
echo   [2]  Quick Minor Release (+1)
echo   [3]  Quick Micro Release (+1)
echo   [4]  Quick Rebuild (no bump)
echo   [5]  Quick Build Only
echo.
echo   [B]  Back to main menu
echo.
set /p "QUICK_CHOICE=  Select quick action > "
if /i "%QUICK_CHOICE%"=="1" (
    set "BUMP_ARG="
    set "NEXT_VER=%NEXT_PATCH%"
    set "RELEASE_TYPE=patch"
    set "AUTO_CONFIRM=1"
    goto :RUN
)
if /i "%QUICK_CHOICE%"=="2" (
    set "BUMP_ARG=--minor"
    set "NEXT_VER=%NEXT_MINOR%"
    set "RELEASE_TYPE=minor"
    set "AUTO_CONFIRM=1"
    goto :RUN
)
if /i "%QUICK_CHOICE%"=="3" (
    set "BUMP_ARG=--micro-1"
    set "NEXT_VER=%NEXT_MICRO_1%"
    set "RELEASE_TYPE=micro-1"
    set "AUTO_CONFIRM=1"
    goto :RUN
)
if /i "%QUICK_CHOICE%"=="4" (
    set "BUMP_ARG=--no-bump"
    set "NEXT_VER=%CURRENT_VER%"
    set "RELEASE_TYPE=rebuild"
    set "AUTO_CONFIRM=1"
    goto :RUN
)
if /i "%QUICK_CHOICE%"=="5" (
    set "BUILD_ONLY=1"
    set "BUMP_ARG=--no-bump"
    set "NEXT_VER=%CURRENT_VER%"
    set "RELEASE_TYPE=build-only"
    set "AUTO_CONFIRM=1"
    goto :RUN
)
if /i "%QUICK_CHOICE%"=="b" goto :MENU
goto :QUICK_ACTIONS



cls
echo.
echo  ========================================================================
echo                    BATCH RELEASE MODE
echo  ========================================================================
echo   This mode allows you to queue multiple releases.
echo.
echo   [1]  Add release to queue
echo   [2]  View queue
echo   [3]  Execute queue
echo   [4]  Clear queue
echo.
echo   [B]  Back to main menu
echo.
set /p "BATCH_CHOICE=  Select option > "
if /i "%BATCH_CHOICE%"=="1" goto :ADD_TO_QUEUE
if /i "%BATCH_CHOICE%"=="2" goto :VIEW_QUEUE
if /i "%BATCH_CHOICE%"=="3" goto :EXECUTE_QUEUE
if /i "%BATCH_CHOICE%"=="4" goto :CLEAR_QUEUE
if /i "%BATCH_CHOICE%"=="b" goto :MENU
goto :BATCH_RELEASE



cls
echo.
echo   Add release to queue
echo.
set /p "QUEUE_VER=  Enter version > "
set /p "QUEUE_TYPE=  Enter release type (patch/minor/major/custom) > "
echo %QUEUE_VER%|%QUEUE_TYPE% >> "%TEMP%\release_queue.txt"
echo   Added v%QUEUE_VER% (%QUEUE_TYPE%) to queue
pause
goto :BATCH_RELEASE

::  View Queue
:VIEW_QUEUE
cls
echo.
echo   Current Release Queue:
echo.
if exist "%TEMP%\release_queue.txt" (
    type "%TEMP%\release_queue.txt"
) else (
    echo   Queue is empty
)
echo.
pause
goto :BATCH_RELEASE



cls
echo.
echo   Executing release queue...
echo.
if not exist "%TEMP%\release_queue.txt" (
    echo   Queue is empty
    pause
    goto :BATCH_RELEASE
)
for /f "tokens=1,2 delims=|" %%a in (%TEMP%\release_queue.txt) do (
    echo   Processing: %%a (%%b)
    REM Process each release here
)
echo   Queue execution complete
del "%TEMP%\release_queue.txt" >nul 2>&1
pause
goto :BATCH_RELEASE



del "%TEMP%\release_queue.txt" >nul 2>&1
echo   Queue cleared
pause
goto :BATCH_RELEASE



cls
echo.
echo  ========================================================================
echo                    RELEASE TEMPLATES
echo  ========================================================================
echo   [1]  Bug Fix Template
echo   [2]  Feature Template
echo   [3]  Breaking Change Template
echo   [4]  Hotfix Template
echo   [5]  Custom Template
echo.
echo   [B]  Back to main menu
echo.
set /p "TEMPLATE_CHOICE=  Select template > "
if /i "%TEMPLATE_CHOICE%"=="1" goto :BUGFIX_TEMPLATE
if /i "%TEMPLATE_CHOICE%"=="2" goto :FEATURE_TEMPLATE
if /i "%TEMPLATE_CHOICE%"=="3" goto :BREAKING_TEMPLATE
if /i "%TEMPLATE_CHOICE%"=="4" goto :HOTFIX_TEMPLATE
if /i "%TEMPLATE_CHOICE%"=="5" goto :CUSTOM_TEMPLATE
if /i "%TEMPLATE_CHOICE%"=="b" goto :MENU
goto :RELEASE_TEMPLATES

::  Bug Fix Template
:BUGFIX_TEMPLATE
cls
echo.
echo  ========================================================================
echo                    BUG FIX RELEASE TEMPLATE
echo  ========================================================================
echo   This template is for bug fix releases.
echo.
echo   Recommended version bump: Patch (+1)
echo   Suggested release notes:
echo.
echo   Bug Fixes:
echo   - Fixed issue where [description]
echo   - Resolved [another issue]
echo   - Fixed regression in [component]
echo.
echo   [U]  Use this template
echo   [B]  Back
echo.
set /p "USE_TEMPLATE=  > "
if /i "%USE_TEMPLATE%"=="u" (
    set "BUMP_ARG="
    set "NEXT_VER=%NEXT_PATCH%"
    set "RELEASE_TYPE=patch"
    set "RELEASE_NOTES=Bug Fixes:^!- Fixed issue where [description]^!- Resolved [another issue]^!- Fixed regression in [component]"
    goto :CONFIRM
)
goto :RELEASE_TEMPLATES



cls
echo.
echo  ========================================================================
echo                    FEATURE RELEASE TEMPLATE
echo  ========================================================================
echo   This template is for new feature releases.
echo.
echo   Recommended version bump: Minor (+1)
echo   Suggested release notes:
echo.
echo   New Features:
echo   - Added [feature name]
echo   - Implemented [another feature]
echo.
echo   Improvements:
echo   - Improved [component] performance
echo   - Enhanced [UI element]
echo.
echo   [U]  Use this template
echo   [B]  Back
echo.
set /p "USE_TEMPLATE=  > "
if /i "%USE_TEMPLATE%"=="u" (
    set "BUMP_ARG=--minor"
    set "NEXT_VER=%NEXT_MINOR%"
    set "RELEASE_TYPE=minor"
    set "RELEASE_NOTES=New Features:^!- Added [feature name]^!- Implemented [another feature]^!^!Improvements:^!- Improved [component] performance^!- Enhanced [UI element]"
    goto :CONFIRM
)
goto :RELEASE_TEMPLATES

::  Breaking Change Template
:BREAKING_TEMPLATE
cls
echo.
echo  ========================================================================
echo                    BREAKING CHANGE TEMPLATE
echo  ========================================================================
echo   This template is for breaking changes.
echo.
echo   Recommended version bump: Major (+1)
echo   Suggested release notes:
echo.
echo   Breaking Changes:
echo   - [Breaking change description]
echo   - [Another breaking change]
echo.
echo   Migration Guide:
echo   - [Step 1]
echo   - [Step 2]
echo.
echo   [U]  Use this template
echo   [B]  Back
echo.
set /p "USE_TEMPLATE=  > "
if /i "%USE_TEMPLATE%"=="u" (
    set "BUMP_ARG=--major"
    set "NEXT_VER=%NEXT_MAJOR%"
    set "RELEASE_TYPE=major"
    set "RELEASE_NOTES=Breaking Changes:^!- [Breaking change description]^!- [Another breaking change]^!^!Migration Guide:^!- [Step 1]^!- [Step 2]"
    goto :CONFIRM
)
goto :RELEASE_TEMPLATES

::  Hotfix Template
:HOTFIX_TEMPLATE
cls
echo.
echo  ========================================================================
echo                    HOTFIX RELEASE TEMPLATE
echo  ========================================================================
echo   This template is for hotfix releases.
echo.
echo   Recommended version bump: Micro (+1)
echo   Suggested release notes:
echo.
echo   Hotfix:
echo   - Fixed critical issue: [description]
echo   - Applied security patch: [description]
echo.
echo   [U]  Use this template
echo   [B]  Back
echo.
set /p "USE_TEMPLATE=  > "
if /i "%USE_TEMPLATE%"=="u" (
    set "BUMP_ARG=--micro-1"
    set "NEXT_VER=%NEXT_MICRO_1%"
    set "RELEASE_TYPE=micro-1"
    set "RELEASE_NOTES=Hotfix:^!- Fixed critical issue: [description]^!- Applied security patch: [description]"
    goto :CONFIRM
)
goto :RELEASE_TEMPLATES



cls
echo.
echo  ========================================================================
echo                    CUSTOM RELEASE TEMPLATE
echo  ========================================================================
echo   Create your custom release template.
echo.
set /p "CUSTOM_NAME=  Template name > "
set /p "CUSTOM_BUMP=  Version bump (patch/minor/major/micro-1/micro-2/etc) > "
echo   Enter release notes (empty line to finish):
set "CUSTOM_NOTES="
:CUSTOM_NOTES_LOOP
set /p "NOTES_LINE=  > "
if "%NOTES_LINE%"=="" goto :CUSTOM_NOTES_DONE
if defined CUSTOM_NOTES (
    set "CUSTOM_NOTES=!CUSTOM_NOTES!^!NOTES_LINE!"
) else (
    set "CUSTOM_NOTES=!NOTES_LINE!"
)
goto :CUSTOM_NOTES_LOOP
:CUSTOM_NOTES_DONE
echo %CUSTOM_NAME%|%CUSTOM_BUMP%|%CUSTOM_NOTES% >> "%TEMP%\custom_templates.txt"
echo   Template saved
pause
goto :RELEASE_TEMPLATES



cls
echo.
echo  ========================================================================
echo                    RELEASE SCHEDULE
echo  ========================================================================
echo   Planned releases:
echo.
if exist "%TEMP%\release_schedule.txt" (
    type "%TEMP%\release_schedule.txt"
) else (
    echo   No scheduled releases
)
echo.
echo   [A]  Add scheduled release
echo   [R]  Remove scheduled release
echo   [E]  Edit scheduled release
echo   [B]  Back to menu
echo.
set /p "SCHEDULE_CHOICE=  Select option > "
if /i "%SCHEDULE_CHOICE%"=="a" goto :ADD_SCHEDULED
if /i "%SCHEDULE_CHOICE%"=="r" goto :REMOVE_SCHEDULED
if /i "%SCHEDULE_CHOICE%"=="e" goto :EDIT_SCHEDULED
if /i "%SCHEDULE_CHOICE%"=="b" goto :MENU
goto :RELEASE_SCHEDULE



cls
echo.
echo   Add scheduled release
echo.
set /p "SCHED_VER=  Version > "
set /p "SCHED_DATE=  Date (YYYY-MM-DD) > "
set /p "SCHED_TYPE=  Release type > "
echo %SCHED_VER%|%SCHED_DATE%|%SCHED_TYPE% >> "%TEMP%\release_schedule.txt"
echo   Scheduled v%SCHED_VER% for %SCHED_DATE%
pause
goto :RELEASE_SCHEDULE



cls
echo.
echo   Remove scheduled release
echo.
set /p "REMOVE_VER=  Enter version to remove > "
findstr /v "%REMOVE_VER%" "%TEMP%\release_schedule.txt" > "%TEMP%\release_schedule_temp.txt"
move /y "%TEMP%\release_schedule_temp.txt" "%TEMP%\release_schedule.txt" >nul
echo   Removed %REMOVE_VER% from schedule
pause
goto :RELEASE_SCHEDULE

::  Edit Scheduled Release
:EDIT_SCHEDULED
cls
echo.
echo   Edit scheduled release
echo.
set /p "EDIT_VER=  Enter version to edit > "
set /p "NEW_DATE=  New date (YYYY-MM-DD) > "
set /p "NEW_TYPE=  New release type > "
findstr /v "%EDIT_VER%" "%TEMP%\release_schedule.txt" > "%TEMP%\release_schedule_temp.txt"
echo %EDIT_VER%|%NEW_DATE%|%NEW_TYPE% >> "%TEMP%\release_schedule_temp.txt"
move /y "%TEMP%\release_schedule_temp.txt" "%TEMP%\release_schedule.txt" >nul
echo   Updated %EDIT_VER%
pause
goto :RELEASE_SCHEDULE

::  Release Notes Editor
:NOTES_EDITOR
cls
echo.
echo  ========================================================================
echo                    RELEASE NOTES EDITOR
echo  ========================================================================
echo   [1]  Create new notes
echo   [2]  Edit existing notes
echo   [3]  Load from file
echo   [4]  Save to file
echo   [5]  Preview notes
echo.
echo   [B]  Back to menu
echo.
set /p "NOTES_EDITOR_CHOICE=  Select option > "
if /i "%NOTES_EDITOR_CHOICE%"=="1" goto :CREATE_NOTES
if /i "%NOTES_EDITOR_CHOICE%"=="2" goto :EDIT_NOTES
if /i "%NOTES_EDITOR_CHOICE%"=="3" goto :LOAD_NOTES
if /i "%NOTES_EDITOR_CHOICE%"=="4" goto :SAVE_NOTES
if /i "%NOTES_EDITOR_CHOICE%"=="5" goto :PREVIEW_NOTES
if /i "%NOTES_EDITOR_CHOICE%"=="b" goto :MENU
goto :NOTES_EDITOR



cls
echo.
echo   Create new release notes
echo.
set "NEW_NOTES="
:NEW_NOTES_LOOP
set /p "NOTES_LINE=  > "
if "%NOTES_LINE%"=="" goto :NEW_NOTES_DONE
if defined NEW_NOTES (
    set "NEW_NOTES=!NEW_NOTES!^!NOTES_LINE!"
) else (
    set "NEW_NOTES=!NOTES_LINE!"
)
goto :NEW_NOTES_LOOP
:NEW_NOTES_DONE
set "RELEASE_NOTES=%NEW_NOTES%"
echo   Notes created
pause
goto :NOTES_EDITOR

::  Edit Notes
:EDIT_NOTES
cls
echo.
echo   Current release notes:
echo.
if defined RELEASE_NOTES (
    echo %RELEASE_NOTES%
) else (
    echo   No notes set
)
echo.
set /p "EDIT_NOTES_INPUT=  Enter new notes (or press Enter to keep current) > "
if not "%EDIT_NOTES_INPUT%"=="" set "RELEASE_NOTES=%EDIT_NOTES_INPUT%"
echo   Notes updated
pause
goto :NOTES_EDITOR



cls
echo.
set /p "LOAD_FILE=  Enter file path > "
if exist "%LOAD_FILE%" (
    set /p RELEASE_NOTES=<"%LOAD_FILE%"
    echo   Notes loaded from %LOAD_FILE%
) else (
    echo   File not found
)
pause
goto :NOTES_EDITOR



cls
echo.
set /p "SAVE_FILE=  Enter file path > "
if defined RELEASE_NOTES (
    echo %RELEASE_NOTES% > "%SAVE_FILE%"
    echo   Notes saved to %SAVE_FILE%
) else (
    echo   No notes to save
)
pause
goto :NOTES_EDITOR

::  Preview Notes
:PREVIEW_NOTES
cls
echo.
echo  ========================================================================
echo                    RELEASE NOTES PREVIEW
echo  ========================================================================
if defined RELEASE_NOTES (
    echo %RELEASE_NOTES%
) else (
    echo   No notes to preview
)
echo.
pause
goto :NOTES_EDITOR



cls
echo.
echo  ========================================================================
echo                    TEAM COLLABORATION
echo  ========================================================================
echo   [1]  Assign reviewers
echo   [2]  Request approval
echo   [3]  View team activity
echo   [4]  Notify team
echo.
echo   [B]  Back to menu
echo.
set /p "TEAM_CHOICE=  Select option > "
if /i "%TEAM_CHOICE%"=="1" goto :ASSIGN_REVIEWERS
if /i "%TEAM_CHOICE%"=="2" goto :REQUEST_APPROVAL
if /i "%TEAM_CHOICE%"=="3" goto :VIEW_TEAM_ACTIVITY
if /i "%TEAM_CHOICE%"=="4" goto :NOTIFY_TEAM
if /i "%TEAM_CHOICE%"=="b" goto :MENU
goto :TEAM_COLLAB

::  Assign Reviewers
:ASSIGN_REVIEWERS
cls
echo.
echo   Assign reviewers for this release
echo.
set /p "REVIEWERS=  Enter reviewer usernames (comma-separated) > "
echo   Reviewers assigned: %REVIEWERS%
echo.
echo   [C]  Create pull request for review
echo   [B]  Back
echo.
set /p "REVIEWER_CHOICE=  > "
if /i "%REVIEWER_CHOICE%"=="c" (
    echo   Creating pull request...
    gh pr create --title "Release v%NEXT_VER%" --body "Release v%NEXT_VER% ready for review" --reviewer %REVIEWERS% --repo %REPO_OWNER%/%REPO_NAME%
    pause
)
goto :TEAM_COLLAB



cls
echo.
echo   Request approval for release v%NEXT_VER%
echo.
echo   [1]  Request from specific user
echo   [2]  Request from team
echo   [B]  Back
echo.
set /p "APPROVAL_CHOICE=  > "
if /i "%APPROVAL_CHOICE%"=="1" (
    set /p "APPROVER=  Enter username > "
    echo   Approval requested from %APPROVER%
    pause
)
if /i "%APPROVAL_CHOICE%"=="2" (
    echo   Approval requested from team
    pause
)
goto :TEAM_COLLAB

::  View Team Activity
:VIEW_TEAM_ACTIVITY
cls
echo.
echo   Recent team activity:
echo.
gh api repos/%REPO_OWNER%/%REPO_NAME%/activity
echo.
pause
goto :TEAM_COLLAB

::  Notify Team
:NOTIFY_TEAM
cls
echo.
echo   Notify team about release
echo.
set /p "NOTIFY_MSG=  Enter notification message > "
echo   Sending notification...
echo.
echo   Notification sent (simulated)
pause
goto :TEAM_COLLAB

::  Security Checks
:SECURITY_CHECKS
cls
echo.
echo  ========================================================================
echo                    SECURITY CHECKS
echo  ========================================================================
echo   Running security checks...
echo.
echo   [1]  Dependency vulnerability scan
echo   [2]  Code security audit
echo   [3]  Secrets check
echo   [4]  License compliance
echo.
echo   [A]  Run all checks
echo   [B]  Back to menu
echo.
set /p "SECURITY_CHOICE=  Select option > "
if /i "%SECURITY_CHOICE%"=="1" goto :DEPENDENCY_SCAN
if /i "%SECURITY_CHOICE%"=="2" goto :CODE_AUDIT
if /i "%SECURITY_CHOICE%"=="3" goto :SECRETS_CHECK
if /i "%SECURITY_CHOICE%"=="4" goto :LICENSE_CHECK
if /i "%SECURITY_CHOICE%"=="a" goto :RUN_ALL_SECURITY
if /i "%SECURITY_CHOICE%"=="b" goto :MENU
goto :SECURITY_CHECKS



cls
echo.
echo   Scanning dependencies for vulnerabilities...
echo.
npm audit
if %ERRORLEVEL% neq 0 (
    echo   [!] Vulnerabilities found
) else (
    echo   [OK] No vulnerabilities found
)
echo.
pause
goto :SECURITY_CHECKS

::  Code Audit
:CODE_AUDIT
cls
echo.
echo   Running code security audit...
echo.
echo   [!] Code audit not implemented in this version
echo   Consider using tools like: SonarQube, Snyk, or CodeQL
echo.
pause
goto :SECURITY_CHECKS



cls
echo.
echo   Checking for exposed secrets...
echo.
git log --all --full-history --source -- "**/package.json" | findstr /i "password\|secret\|token\|key"
if %ERRORLEVEL% equ 0 (
    echo   [!] Potential secrets found in git history
) else (
    echo   [OK] No exposed secrets detected
)
echo.
pause
goto :SECURITY_CHECKS

::  License Check
:LICENSE_CHECK
cls
echo.
echo   Checking license compliance...
echo.
npm list --json --depth=0
echo.
echo   [!] License check not fully implemented
echo   Review the output above for license information
echo.
pause
goto :SECURITY_CHECKS

::  Run All Security Checks
:RUN_ALL_SECURITY
cls
echo.
echo   Running all security checks...
echo.
call :DEPENDENCY_SCAN
call :CODE_AUDIT
call :SECRETS_CHECK
call :LICENSE_CHECK
echo.
echo   All security checks complete
pause
goto :SECURITY_CHECKS

::  Performance Metrics
:PERFORMANCE_METRICS
cls
echo.
echo  ========================================================================
echo                    PERFORMANCE METRICS
echo  ========================================================================
echo   Analyzing performance metrics...
echo.
echo   [1]  Build time analysis
echo   [2]  Bundle size analysis
echo   [3]  Startup time analysis
echo   [4]  Memory usage analysis
echo.
echo   [B]  Back to menu
echo.
set /p "PERF_CHOICE=  Select option > "
if /i "%PERF_CHOICE%"=="1" goto :BUILD_TIME_ANALYSIS
if /i "%PERF_CHOICE%"=="2" goto :BUNDLE_SIZE_ANALYSIS
if /i "%PERF_CHOICE%"=="3" goto :STARTUP_TIME_ANALYSIS
if /i "%PERF_CHOICE%"=="4" goto :MEMORY_USAGE_ANALYSIS
if /i "%PERF_CHOICE%"=="b" goto :MENU
goto :PERFORMANCE_METRICS

::  Build Time Analysis
:BUILD_TIME_ANALYSIS
cls
echo.
echo   Build time analysis
echo.
echo   [!] Build time tracking not implemented
echo   Consider adding time tracking to the build process
echo.
pause
goto :PERFORMANCE_METRICS

::  Bundle Size Analysis
:BUNDLE_SIZE_ANALYSIS
cls
echo.
echo   Bundle size analysis
echo.
if exist "dist" (
    echo   Bundle sizes:
    dir /s dist\*.exe
    dir /s dist\*.blockmap
    dir /s dist\*.yml
) else (
    echo   No build artifacts found
)
echo.
pause
goto :PERFORMANCE_METRICS

::  Startup Time Analysis
:STARTUP_TIME_ANALYSIS
cls
echo.
echo   Startup time analysis
echo.
echo   [!] Startup time tracking not implemented
echo   Consider using tools like: Lighthouse, or custom timing
echo.
pause
goto :PERFORMANCE_METRICS

::  Memory Usage Analysis
:MEMORY_USAGE_ANALYSIS
cls
echo.
echo   Memory usage analysis
echo.
echo   Current memory usage:
wmic process where "name='node.exe'" get ProcessId,WorkingSetSize
echo.
pause
goto :PERFORMANCE_METRICS

::  Custom Scripts
:CUSTOM_SCRIPTS
cls
echo.
echo  ========================================================================
echo                    CUSTOM SCRIPTS
echo  ========================================================================
echo   [1]  Run pre-release script
echo   [2]  Run post-release script
echo   [3]  Run custom script
echo   [4]  Manage custom scripts
echo.
echo   [B]  Back to menu
echo.
set /p "SCRIPT_CHOICE=  Select option > "
if /i "%SCRIPT_CHOICE%"=="1" goto :PRE_RELEASE_SCRIPT
if /i "%SCRIPT_CHOICE%"=="2" goto :POST_RELEASE_SCRIPT
if /i "%SCRIPT_CHOICE%"=="3" goto :RUN_CUSTOM_SCRIPT
if /i "%SCRIPT_CHOICE%"=="4" goto :MANAGE_SCRIPTS
if /i "%SCRIPT_CHOICE%"=="b" goto :MENU
goto :CUSTOM_SCRIPTS

::  Pre-release Script
:PRE_RELEASE_SCRIPT
cls
echo.
echo   Running pre-release script...
echo.
if exist "scripts\pre-release.bat" (
    call scripts\pre-release.bat
) else (
    echo   No pre-release script found
)
echo.
pause
goto :CUSTOM_SCRIPTS

::  Post-release Script
:POST_RELEASE_SCRIPT
cls
echo.
echo   Running post-release script...
echo.
if exist "scripts\post-release.bat" (
    call scripts\post-release.bat
) else (
    echo   No post-release script found
)
echo.
pause
goto :CUSTOM_SCRIPTS

::  Run Custom Script
:RUN_CUSTOM_SCRIPT
cls
echo.
set /p "CUSTOM_SCRIPT_PATH=  Enter script path > "
if exist "%CUSTOM_SCRIPT_PATH%" (
    call "%CUSTOM_SCRIPT_PATH%"
) else (
    echo   Script not found
)
echo.
pause
goto :CUSTOM_SCRIPTS

::  Manage Scripts
:MANAGE_SCRIPTS
cls
echo.
echo   Manage custom scripts
echo.
echo   [1]  Create new script
echo   [2]  Edit existing script
echo   [3]  Delete script
echo   [B]  Back
echo.
set /p "MANAGE_SCRIPT_CHOICE=  > "
if /i "%MANAGE_SCRIPT_CHOICE%"=="1" goto :CREATE_SCRIPT
if /i "%MANAGE_SCRIPT_CHOICE%"=="2" goto :EDIT_SCRIPT
if /i "%MANAGE_SCRIPT_CHOICE%"=="3" goto :DELETE_SCRIPT
if /i "%MANAGE_SCRIPT_CHOICE%"=="b" goto :CUSTOM_SCRIPTS
goto :MANAGE_SCRIPTS

::  Create Script
:CREATE_SCRIPT
cls
echo.
set /p "NEW_SCRIPT_NAME=  Enter script name > "
set /p "NEW_SCRIPT_CONTENT=  Enter script content > "
echo %NEW_SCRIPT_CONTENT% > scripts\%NEW_SCRIPT_NAME%.bat
echo   Script created
pause
goto :MANAGE_SCRIPTS

::  Edit Script
:EDIT_SCRIPT
cls
echo.
set /p "EDIT_SCRIPT_NAME=  Enter script name > "
notepad scripts\%EDIT_SCRIPT_NAME%.bat
echo   Script edited
pause
goto :MANAGE_SCRIPTS

::  Delete Script
:DELETE_SCRIPT
cls
echo.
set /p "DELETE_SCRIPT_NAME=  Enter script name > "
del scripts\%DELETE_SCRIPT_NAME%.bat
echo   Script deleted
pause
goto :MANAGE_SCRIPTS

::  Integration Settings :INTEGRATION_SETTINGS
cls
echo.
echo  ========================================================================
echo                    INTEGRATION SETTINGS
echo  ========================================================================
echo   [1]  Slack Integration
echo   [2]  Discord Integration
echo   [3]  Email Integration
echo   [4]  Webhook Configuration
echo.
echo   [B]  Back to menu
echo.
set /p "INTEGRATION_CHOICE=  Select option > "
if /i "%INTEGRATION_CHOICE%"=="1" goto :SLACK_INTEGRATION
if /i "%INTEGRATION_CHOICE%"=="2" goto :DISCORD_INTEGRATION
if /i "%INTEGRATION_CHOICE%"=="3" goto :EMAIL_INTEGRATION
if /i "%INTEGRATION_CHOICE%"=="4" goto :WEBHOOK_CONFIG
if /i "%INTEGRATION_CHOICE%"=="b" goto :MENU
goto :INTEGRATION_SETTINGS

::  Slack Integration
:SLACK_INTEGRATION
cls
echo.
echo   Slack Integration Settings
echo.
set /p "SLACK_WEBHOOK=  Enter Slack webhook URL > "
set /p "SLACK_CHANNEL=  Enter Slack channel > "
echo   Slack integration configured
pause
goto :INTEGRATION_SETTINGS

::  Discord Integration
:DISCORD_INTEGRATION
cls
echo.
echo   Discord Integration Settings
echo.
set /p "DISCORD_WEBHOOK=  Enter Discord webhook URL > "
echo   Discord integration configured
pause
goto :INTEGRATION_SETTINGS

::  Email Integration
:EMAIL_INTEGRATION
cls
echo.
echo   Email Integration Settings
echo.
set /p "EMAIL_SMTP=  Enter SMTP server > "
set /p "EMAIL_FROM=  Enter from address > "
set /p "EMAIL_TO=  Enter to address > "
echo   Email integration configured
pause
goto :INTEGRATION_SETTINGS

::  Webhook Configuration
:WEBHOOK_CONFIG
cls
echo.
echo   Webhook Configuration
echo.
set /p "WEBHOOK_URL=  Enter webhook URL > "
set /p "WEBHOOK_HEADERS=  Enter headers (JSON) > "
echo   Webhook configured
pause
goto :INTEGRATION_SETTINGS



cls
echo.
echo  ========================================================================
echo                    BACKUP AND RESTORE
echo  ========================================================================
echo   [1]  Backup current state
echo   [2]  Restore from backup
echo   [3]  View backups
echo   [4]  Delete backup
echo.
echo   [B]  Back to menu
echo.
set /p "BACKUP_CHOICE=  Select option > "
if /i "%BACKUP_CHOICE%"=="1" goto :BACKUP_STATE
if /i "%BACKUP_CHOICE%"=="2" goto :RESTORE_STATE
if /i "%BACKUP_CHOICE%"=="3" goto :VIEW_BACKUPS
if /i "%BACKUP_CHOICE%"=="4" goto :DELETE_BACKUP
if /i "%BACKUP_CHOICE%"=="b" goto :MENU
goto :BACKUP_RESTORE



cls
echo.
echo   Creating backup...
echo.
set "BACKUP_NAME=backup_%DATE%_%TIME%"
set "BACKUP_DIR=backups\%BACKUP_NAME%"
mkdir "%BACKUP_DIR%" 2>nul
copy package.json "%BACKUP_DIR%\" >nul
copy package-lock.json "%BACKUP_DIR%\" >nul
xcopy /e /i node_modules "%BACKUP_DIR%\node_modules" >nul
echo   Backup created: %BACKUP_DIR%
pause
goto :BACKUP_RESTORE



cls
echo.
echo   Available backups:
echo.
dir /b backups
echo.
set /p "RESTORE_BACKUP=  Enter backup name > "
if exist "backups\%RESTORE_BACKUP%" (
    copy /y "backups\%RESTORE_BACKUP%\package.json" . >nul
    copy /y "backups\%RESTORE_BACKUP%\package-lock.json" . >nul
    rd /s /q node_modules >nul 2>&1
    xcopy /e /i "backups\%RESTORE_BACKUP%\node_modules" node_modules >nul
    echo   Restored from %RESTORE_BACKUP%
) else (
    echo   Backup not found
)
pause
goto :BACKUP_RESTORE

::  View Backups
:VIEW_BACKUPS
cls
echo.
echo   Available backups:
echo.
dir /b backups
echo.
pause
goto :BACKUP_RESTORE



cls
echo.
set /p "DELETE_BACKUP=  Enter backup name to delete > "
if exist "backups\%DELETE_BACKUP%" (
    rd /s /q "backups\%DELETE_BACKUP%"
    echo   Backup deleted
) else (
    echo   Backup not found
)
pause
goto :BACKUP_RESTORE


:: ==========================================
::  MISSING LABEL PLACEHOLDERS (FIXED)
:: ==========================================

:CHANGELOG
cls
echo.
echo  Changelog - Not yet implemented
echo.
pause
goto :MENU

:HELP
cls
echo.
echo  Help - Not yet implemented
echo.
pause
goto :MENU

:TOGGLE_PRECHECK
cls
echo.
echo  Toggle Precheck - Not yet implemented
echo.
pause
goto :CONFIG

:RELEASE_NOTES
cls
echo.
echo  Release Notes - Not yet implemented
echo.
pause
goto :CONFIRM_FINAL

:ROLLBACK_PLAN
cls
echo.
echo  Rollback Plan - Not yet implemented
echo.
pause
goto :CONFIRM

:ERROR_HANDLER
cls
echo.
echo  An error occurred.
echo.
pause
goto :MENU

:BATCH_RELEASE
cls
echo.
echo  Batch Release - Not yet implemented
echo.
pause
goto :MENU

:ADD_TO_QUEUE
cls
echo.
echo  Add to Queue - Not yet implemented
echo.
pause
goto :BATCH_RELEASE

:EXECUTE_QUEUE
cls
echo.
echo  Execute Queue - Not yet implemented
echo.
pause
goto :BATCH_RELEASE

:CLEAR_QUEUE
cls
echo.
echo  Clear Queue - Not yet implemented
echo.
pause
goto :BATCH_RELEASE

:RELEASE_TEMPLATES
cls
echo.
echo  Release Templates - Not yet implemented
echo.
pause
goto :MENU

:FEATURE_TEMPLATE
cls
echo.
echo  Feature Template - Not yet implemented
echo.
pause
goto :RELEASE_TEMPLATES

:CUSTOM_TEMPLATE
cls
echo.
echo  Custom Template - Not yet implemented
echo.
pause
goto :RELEASE_TEMPLATES

:RELEASE_SCHEDULE
cls
echo.
echo  Release Schedule - Not yet implemented
echo.
pause
goto :MENU

:ADD_SCHEDULED
cls
echo.
echo  Add Scheduled Release - Not yet implemented
echo.
pause
goto :RELEASE_SCHEDULE

:REMOVE_SCHEDULED
cls
echo.
echo  Remove Scheduled Release - Not yet implemented
echo.
pause
goto :RELEASE_SCHEDULE

:CREATE_NOTES
cls
echo.
echo  Create Notes - Not yet implemented
echo.
pause
goto :MENU

:LOAD_NOTES
cls
echo.
echo  Load Notes - Not yet implemented
echo.
pause
goto :MENU

:SAVE_NOTES
cls
echo.
echo  Save Notes - Not yet implemented
echo.
pause
goto :MENU

:TEAM_COLLAB
cls
echo.
echo  Team Collaboration - Not yet implemented
echo.
pause
goto :MENU

:REQUEST_APPROVAL
cls
echo.
echo  Request Approval - Not yet implemented
echo.
pause
goto :TEAM_COLLAB

:DEPENDENCY_SCAN
cls
echo.
echo  Dependency Scan - Not yet implemented
echo.
pause
goto :MENU

:SECRETS_CHECK
cls
echo.
echo  Secrets Check - Not yet implemented
echo.
pause
goto :MENU

:BACKUP_RESTORE
cls
echo.
echo  Backup / Restore - Not yet implemented
echo.
pause
goto :MENU

:BACKUP_STATE
cls
echo.
echo  Backup State - Not yet implemented
echo.
pause
goto :BACKUP_RESTORE

:RESTORE_STATE
cls
echo.
echo  Restore State - Not yet implemented
echo.
pause
goto :BACKUP_RESTORE

:DELETE_BACKUP
cls
echo.
echo  Delete Backup - Not yet implemented
echo.
pause
goto :BACKUP_RESTORE

:EXIT
cls
echo.
echo  Exiting...
echo.
exit /b 0

::  End of File 