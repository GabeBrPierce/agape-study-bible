@echo off
setlocal
REM ============================================================================
REM  Package the Agape Study Bible app for KaiStore submission.
REM    1. Bumps the patch version in both manifests (e.g. 3.0.2 -> 3.0.3)
REM    2. Builds the app and zips build/ into agape-study-bible-<version>.zip
REM    3. Copies the zip into the KaiOS simulator dropzone
REM
REM  Just double-click this file, or run it from a terminal.
REM ============================================================================

REM Run from this script's own folder regardless of where it's launched from.
cd /d "%~dp0"

REM Where to drop a copy of the finished package (the simulator's dropzone).
set "DROPZONE=D:\source\repos\vibe-code\KaiOsSimulator\dropzone"

REM CSP-safe build (no inline runtime chunk) and don't treat warnings as errors.
set "INLINE_RUNTIME_CHUNK=false"
set "CI=false"

echo.
echo Bumping version...
set "VERSION="
for /f "delims=" %%v in ('node scripts\bump-version.js') do set "VERSION=%%v"
if not defined VERSION (
  echo *** Version bump FAILED. Aborting. ***
  echo.
  pause
  exit /b 1
)
echo New version: %VERSION%

echo.
echo Packaging Agape Study Bible for KaiStore...
echo.
call npm run package
set "EXITCODE=%ERRORLEVEL%"
if %EXITCODE% NEQ 0 (
  echo.
  echo *** Packaging FAILED (exit code %EXITCODE%^). See the output above. ***
  echo.
  pause
  exit /b %EXITCODE%
)

set "ZIP=agape-study-bible-%VERSION%.zip"
echo.
if exist "%DROPZONE%" (
  copy /Y "%ZIP%" "%DROPZONE%\" >nul
  echo Copied %ZIP% to dropzone:
  echo   %DROPZONE%
) else (
  echo Dropzone not found, skipped copy: %DROPZONE%
)

echo.
echo Done. Upload %ZIP% (in this folder) to:
echo   https://developer.kaiostech.com/
echo.
pause
exit /b 0
