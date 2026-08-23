#!/usr/bin/env bash
set -e

# ==============================================================================
#  Cross-compiling Scrap Mechanic Proxy Telemetry DLL (version.dll x64) on Linux
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

COMPILER="x86_64-w64-mingw32-g++"

if ! command -v "$COMPILER" &> /dev/null; then
    echo "[ERROR] MinGW-w64 x64 compiler ($COMPILER) not found."
    echo "  Ubuntu/Debian: sudo apt install g++-mingw-w64-x86-64"
    echo "  Arch Linux:    sudo pacman -S mingw-w64-gcc"
    echo "  Fedora:        sudo dnf install mingw64-gcc-c++"
    exit 1
fi

mkdir -p build
cd build

echo "[INFO] Compiling version.dll (x64) with $COMPILER..."
$COMPILER -shared -O2 -std=c++17 \
    -I"../src" \
    "../src/dllmain.cpp" \
    "../src/lua_bridge.cpp" \
    -o "version.dll" \
    "../src/version.def" \
    -static-libgcc -static-libstdc++ \
    -lpsapi -luser32 -lkernel32

echo "[SUCCESS] Built version.dll successfully!"

# Auto-copy to resources if directory exists
RESOURCES_DIR="../../electron/resources/radar_bridge"
if [ -d "$RESOURCES_DIR" ]; then
    cp -f "version.dll" "$RESOURCES_DIR/version.dll"
    echo "[INFO] Synced version.dll to $RESOURCES_DIR"
fi
