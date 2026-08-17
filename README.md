# 🗺️ Scrap Mechanic Tactical Map Viewer & Real-Time Player Tracker

A high-performance, release-ready desktop application and interactive map viewer for **Scrap Mechanic** survival saves, featuring **zero-mod real-time character tracking**, authentic **procedural terrain generation**, and comprehensive **save file inspection**.

---

## ✨ Features

- 🛰️ **Zero-Mod Real-Time Player Tracking**:
  - Live character beacon displaying world coordinates $(X, Y, Z)$, heading angle, and travel speed at 20 Hz.
  - Interactive breadcrumb trail tracing recent player movements.
  - Optional **Follow Player** camera mode for dynamic navigation.
  - Native Win32 C-FFI memory reader—no game modifications or Python runtime needed for desktop users.

- 🏔️ **Authentic Procedural Terrain Atlas**:
  - Directly decodes `g_cellData` and world seed from SQLite `.db` save files.
  - Stitches official high-resolution terrain tiles across 12,288 world cells in ~30ms using local LZ4 decompression and bitstream parsing.

- 🔍 **Interactive Entity Inspector**:
  - **Creations & Vehicles**: Overworld rigid bodies categorized by block count with bounding boxes and inspection modals.
  - **Bots & Wildlife**: Farmbots, Haybots, Tapebots, Totebots, and Wocs rendered with custom icons and category toggles.
  - **Harvestables**: Oil nodes, Cotton plants, Stone/Metal deposits, and Trees.
  - **Points of Interest (POIs)**: Mechanic Stations, Hideouts, Warehouses, Packing Stations, Trader, and Schematics.

- 📐 **Tactical Tools**:
  - **Distance Measurement Ruler**: Click to measure world distance in meters and blocks.
  - **Quick-Jump Bookmarks**: Instant camera navigation to Crash Site, Mechanic Station, Trader, Packing Stations, and Boss encounters.
  - **Live Search**: Instant entity search by name, UUID, coordinate, or type.
  - **High-Resolution Map Export**: One-click screenshot capture of the canvas.

---

## 📥 Download Latest Release

[![Download Latest Windows Executable](https://img.shields.io/badge/Download-Latest%20Windows%20Release%20(.exe)-00e5ff?style=for-the-badge&logo=windows)](https://github.com/Srlimao/ScrapMechanicCoopMap/releases/latest/download/Scrap-Mechanic-Tactical-Map.exe)

> **Permanent Direct Download Link**:  
> [https://github.com/Srlimao/ScrapMechanicCoopMap/releases/latest/download/Scrap-Mechanic-Tactical-Map.exe](https://github.com/Srlimao/ScrapMechanicCoopMap/releases/latest/download/Scrap-Mechanic-Tactical-Map.exe)  
> *(This direct link always downloads the latest `.exe` without having to manually browse release pages).*

---

## 🚀 Getting Started

### 1. Standalone Portable Release (Recommended)
Download and run the portable executable:
- **Zero Configuration**: Double-click to launch. No installer or Python required.
- Automatically connects to `ScrapMechanic.exe` when the game is running.
- Automatically detects active Steam survival save files.

---

### 2. Running from Source (Development)

#### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [Python 3.8+](https://www.python.org/) *(optional, for Python HTTP server mode)*

#### Install Dependencies
```bash
npm install
```

#### Launch Electron App in Dev Mode
```bash
npm run electron:dev
```

#### Build Standalone Portable `.exe`
```bash
npm run dist:portable
```
The compiled binary will be placed in `dist_release/`.

---

### 3. Web Browser Server Mode (Python Fallback)
If you prefer running via a standard web browser:
```bash
python server.py
# Or run start_server.bat
```
Navigate to `http://localhost:8000` in your web browser.

---

## 🏛️ Project Architecture

Built following **Vertical Slice Architecture** where all files are strictly modularized and under 300 lines of code:

```
save_map_viewer/
├── dist_release/               # Pre-packaged release binaries (.exe)
├── electron/                   # Electron desktop wrapper
│   ├── main.js                 # Electron main process & IPC coordinator
│   ├── preload.js              # ContextBridge secure API exposure
│   ├── memory_reader.js        # Native Win32 C-FFI memory hook (koffi)
│   └── game_scanner.js         # Dynamic Steam registry & save scanner
├── src/                        # Modular ES6 Frontend
│   ├── core/                   # Shared state, constants, coordinate math
│   │   ├── constants.js
│   │   ├── coords.js
│   │   └── state.js
│   ├── features/
│   │   ├── live_tracker/       # Poller engine & player beacon/trail renderer
│   │   ├── map_renderer/       # Canvas rendering loop, camera, tile/grid layers
│   │   ├── save_loader/        # SQLite WASM parser & terrain stitcher
│   │   ├── inspector/          # Sidebar detail panel & hover tooltips
│   │   └── tools/              # Bookmarks, search, ruler, screenshots, settings
│   ├── styles/                 # Modular design system (glassmorphism UI)
│   ├── ui/                     # Reusable modals, toasts, HUD
│   └── main.js                 # App bootstrapper
├── backend/                    # Python background services
│   ├── memory_reader.py        # Win32 ctypes memory reader
│   ├── path_finder.py          # Dynamic Steam path resolver
│   └── save_manager.py         # SQLite WAL checkpoint snapshotter
├── assets/                     # Icons, local WebAssembly SQL.js vendor assets
├── server.py                   # Standalone Python HTTP/API server
├── package.json                # Project dependencies & build scripts
└── vite.config.js              # Vite bundler configuration
```

---

## 🔒 Security & Privacy

- **100% Client-Side & Local**: This application runs entirely on your local machine.
- **Read-Only Memory Access**: Memory reading is strictly non-invasive (`PROCESS_VM_READ`) and does not modify or inject code into the game process.
- **Save Integrity**: Save files are accessed via read-only snapshots and SQLite WAL checkpoints without risking save corruption.

---

## 📜 License

Distributed under the [MIT License](LICENSE).
