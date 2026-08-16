@echo off
title Scrap Mechanic - Save Map Viewer Server
cd /d "%~dp0"

echo =======================================================
echo    SCRAP MECHANIC - TACTICAL SAVE MAP VIEWER
echo =======================================================
echo.
echo Starting local web server...
echo.

:: Check for Python
where python >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    python server.py
    goto end
)

where py >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    py -3 server.py
    goto end
)

echo [WARNING] Python executable not found in PATH.
echo Attempting to start default browser directly...
start "" "index.html"

:end
pause
