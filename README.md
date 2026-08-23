# 🗺️ Scrap Mechanic Tactical Map & Real-Time Multiplayer Tracker

[![Download Latest Windows Executable](https://img.shields.io/badge/Download-Latest%20Release%20(.exe)-00e5ff?style=for-the-badge&logo=windows)](https://github.com/Srlimao/ScrapMechanicCoopMap/releases/latest/download/Scrap-Mechanic-Tactical-Map.exe)
[![GitHub Release](https://img.shields.io/github/v/release/Srlimao/ScrapMechanicCoopMap?style=for-the-badge&color=ff7a00)](https://github.com/Srlimao/ScrapMechanicCoopMap/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-10b981.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

A high-performance tactical map workbench and real-time companion for **Scrap Mechanic** survival worlds.

Featuring **in-game HUD overlays**, **floating proximity radar**, **live character tracking**, **instant cloud squad co-op**, **12,288-cell procedural terrain stitching**, and **save file entity inspection**.

---

## 📥 Direct Download

> 🔗 **Permanent Direct Download (Latest Standalone Portable Executable)**:  
> **[Download Scrap-Mechanic-Tactical-Map.exe](https://github.com/Srlimao/ScrapMechanicCoopMap/releases/latest/download/Scrap-Mechanic-Tactical-Map.exe)**  
> *(Zero installation required — download and run).*

---

## ✨ Core Features

### 🎮 1. In-Game Map & Floating Radar Overlay (v1.7.0)
- **`All In Game` Mode ([M])**: Press <kbd>M</kbd> in-game to summon the interactive tactical map over your screen. Press <kbd>Esc</kbd> or <kbd>M</kbd> to return to the game with seamless mouse-look restoration.
- **Floating Proximity Radar HUD ([F9])**: Floats over the game. Press <kbd>F9</kbd> in-game to unlock, drag, and resize the HUD.
- **Smart Game Process Guard**: In-game mode buttons are safely blocked when *Scrap Mechanic* is not running. Closing the game while in an in-game overlay mode cleanly closes the map, while desktop workstation mode stays open.
- **Game-Focus Protected Hotkeys**: Shortcuts (<kbd>M</kbd> / <kbd>F9</kbd>) only fire when *Scrap Mechanic* is the active window.

### 📡 2. Tactical Proximity Radar & Telemetry Bridge (`version.dll`)
- **360° Military Proximity Scope**: Live circular radar with phosphor sweep beam, dynamic range (50m–300m), and blip scaling.
- **Directional Threat Arrows**: Farmbots, Tapebots, Haybots, and Totebots render with altitude indicators (▲ Above, ▼ Below, ● Level).
- **Vehicles & POIs**: Live tracking for vehicles (50+ blocks) and surrounding landmarks (Mechanic Station, Trader, Packing, Growlabs).

> [!NOTE]
> ### 🛡️ About the Telemetry Bridge (`version.dll`)
> - **100% Open Source**: Full C++ source code is directly included in [`native/proxy_telemetry/src/`](native/proxy_telemetry/src/).
> - **No Game File Modifications**: The DLL acts as a standard Windows DirectX proxy sitting in `Release/`. It runs a read-only telemetry script inside the official Lua environment every 500ms. It does not alter game executables or memory code.
> - **On-Demand Local Build**: When you click **"Install Radar"**, the app automatically compiles `version.dll` directly on your machine if a compiler (MSVC, MinGW, Clang) is detected. If no compiler toolchain is installed, it safely deploys the verified open-source binary.
> - **Linux / Steam Deck (Proton)**: Supported out of the box. Simply add the Steam Launch Option if required:  
>   `WINEDLLOVERRIDES="version=n,b" %command%`

### 🛰️ 3. Real-Time Player Tracking & Save Inspection
- **Zero-Mod Live Tracking**: Ultra-fast native memory reader updates player coordinates $(X, Y, Z)$, heading cone, and speed at 30 Hz.
- **SQLite Save File Decoder**: Drag and drop any `.db` save to decode world cells, chests, oil nodes, and built vehicles in milliseconds.
- **Procedural Seed Generator**: Enter any numeric seed to preview terrain layout before building.

### 👥 4. Cloud Multiplayer Squad Rooms
- **Instant Cloud Sync**: Create a 6-character room code to link with teammates worldwide over high-speed WebSocket relay (`wss://sm.dunhas.com`).
- **Live Teammate Beacons**: Real-time teammate markers, heading arrows, distance badges, and tactical alert pings.
- **Host World Sync**: Guests don't need Python or save files — world cells stream in 30ms directly from the host.

---

## 🏗️ Project Architecture

```
ScrapMechanicCoopMap/
├── native/proxy_telemetry/     # C++ proxy telemetry bridge source (version.dll)
│   ├── src/                    # dllmain.cpp, lua_bridge.cpp, proxy_exports.h
│   ├── build_proxy_dll.bat     # Windows MSVC/MinGW build script
│   └── build_proxy_dll.sh      # Linux MinGW cross-compiler script
├── electron/
│   ├── main.js                 # Electron process, overlay & lifecycle coordinator
│   ├── memory_reader.js        # Win32 C-FFI memory hook (ReadProcessMemory)
│   ├── game_scanner.js         # Save detector, path scanner & on-demand compiler
│   └── preload.js              # IPC bridge
├── relay_server/               # Standalone WebSocket co-op room server
├── src/                        # Modular frontend engine (Vite / Vanilla JS)
│   ├── features/               # Live tracker, map renderer, save loader, squad
│   └── styles/                 # Modular dark-mode CSS design system
└── index.html                  # Main workstation application shell
```

---

## 🛠️ Local Development

```bash
# 1. Clone repository
git clone https://github.com/Srlimao/ScrapMechanicCoopMap.git
cd ScrapMechanicCoopMap

# 2. Install dependencies
npm install

# 3. Run in Vite Web mode (Hot Reloading)
npm run dev

# 4. Run Desktop Electron app
npm run electron:dev

# 5. Build Standalone Portable Executable
npm run dist:portable
```

---

## 📜 License
Released under the [MIT License](LICENSE).
