@echo off
setlocal enabledelayedexpansion

echo ======================================================================
echo    COMPILING SCRAP MECHANIC PROXY TELEMETRY DLL (x64)
echo ======================================================================

set "VS_PATH="
for /f "usebackq tokens=*" %%i in (`"C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do (
    set "VS_PATH=%%i"
)

if not defined VS_PATH (
    echo [ERROR] Visual Studio 2022 C++ build tools not found!
    exit /b 1
)

echo [INFO] Found Visual Studio at: %VS_PATH%

set "VCVARS=%VS_PATH%\VC\Auxiliary\Build\vcvars64.bat"
if not exist "%VCVARS%" (
    echo [ERROR] vcvars64.bat not found at %VCVARS%
    exit /b 1
)

call "%VCVARS%"

cd /d "%~dp0"

if not exist "build" mkdir "build"
cd "build"

echo [INFO] Compiling version.dll x64 with MSVC...
cl.exe /nologo /O2 /LD /std:c++17 /EHsc /I"..\src" ..\src\dllmain.cpp ..\src\lua_bridge.cpp /Fe:version.dll /link /MACHINE:X64 /DEF:..\src\version.def

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Build failed!
    exit /b %ERRORLEVEL%
)

echo [SUCCESS] version.dll compiled successfully!

set "RESOURCES_DIR=..\..\electron\resources\radar_bridge"
if exist "%RESOURCES_DIR%" (
    echo [INFO] Syncing version.dll to %RESOURCES_DIR% ...
    copy /Y "version.dll" "%RESOURCES_DIR%\version.dll"
    echo [SUCCESS] Synced to %RESOURCES_DIR%\version.dll
)

echo ======================================================================
echo    BUILD AND DEPLOY COMPLETE! Ready for game launch.
echo ======================================================================
