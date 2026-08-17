# 🗺️ Scrap Mechanic Tactical Map & Real-Time Multiplayer Co-op Tracker

[![Download Latest Windows Executable](https://img.shields.io/badge/Download-Latest%20Release%20(.exe)-00e5ff?style=for-the-badge&logo=windows)](https://github.com/Srlimao/ScrapMechanicCoopMap/releases/latest/download/Scrap-Mechanic-Tactical-Map.exe)
[![GitHub Release](https://img.shields.io/github/v/release/Srlimao/ScrapMechanicCoopMap?style=for-the-badge&color=ff7a00)](https://github.com/Srlimao/ScrapMechanicCoopMap/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-10b981.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/github/actions/workflow/status/Srlimao/ScrapMechanicCoopMap/release.yml?style=for-the-badge&label=Build%20%26%20Release)](https://github.com/Srlimao/ScrapMechanicCoopMap/actions)

A high-performance, release-ready desktop tactical map application and real-time multiplayer co-op companion for **Scrap Mechanic** survival worlds.

Featuring **zero-mod live memory character tracking**, **instant cloud squad room relays**, **authentic 12,288-cell procedural terrain stitching**, and comprehensive **save file entity inspection**.

---

## 📥 Direct Download

> 🔗 **Permanent Direct Download Link (Always Latest Version)**:  
> **[https://github.com/Srlimao/ScrapMechanicCoopMap/releases/latest/download/Scrap-Mechanic-Tactical-Map.exe](https://github.com/Srlimao/ScrapMechanicCoopMap/releases/latest/download/Scrap-Mechanic-Tactical-Map.exe)**  
> *(Clicking this link always downloads the latest standalone portable `.exe` with zero installation required).*

---

## ✨ Features

### 🛰️ 1. Zero-Mod Real-Time Player Tracking
- **Ultra-Fast Memory Hook**: Native Win32 C-FFI memory reader connecting directly to `ScrapMechanic.exe` in **0.18 ms** at **20 Hz**.
- **Zero Game Modifications**: Operates completely externally via Windows memory pointers—no mods, Lua injection, or custom game files required.
- **Dynamic Orientation & Breadcrumbs**: Displays live world coordinates $(X, Y, Z)$, heading cone, movement speed, and historical breadcrumb trails.
- **Follow Player Camera**: Center and lock the camera view onto your moving character with smooth interpolation.
- **One-Click Reconnect**: Live badge button to instantly re-scan and hook into the game process if launched or restarted mid-session.

---

### 👥 2. Multiplayer Squad Rooms & Live Co-op Relay
- **Cloud Squad Rooms**: Create or join multiplayer rooms with 5-character codes (e.g. `#SQ-9421`).
- **⚡ Instant 30ms Map Sync (Zero Generation for Friends)**:
  - When the Host creates a room, the app automatically uploads the active **12,288 world cells** (~78 KB compressed) to the cloud relay.
  - When friends join, their app receives the cells in **0.02s** and stitches the full terrain map in **~30 milliseconds** using their local texture atlas!
  - **Guests need zero Python, zero Lua engines, and zero save files!**
- **Live Squad Member Markers**:
  - Custom chosen nickname and glowing beacon colors (Cyan, Orange, Lime, Purple, Pink, Yellow).
  - Real-time distance measurement from local player (e.g. `240m away`).
  - Heading cones, speed badges, and individual player breadcrumb trails.
- **🎯 Tactical Map Pings**: Double-click anywhere on the map canvas to drop timed tactical pings that pulse and alert all room members in real time.
- **Squad Member Roster**: Interactive sidebar panel with player distance and a **"Jump Camera"** button.

---

### 🏔️ 3. Authentic Procedural Terrain Atlas
- **High-Speed Save Tile Decoding**: Decodes `g_cellData` and world seed directly from SQLite `.db` save files using local LZ4 decompression and bitstream parsing.
- **Official Texture Atlas**: Stitches 12,288 world cells from `terrain-cell-atlas.webp` into a crisp, high-resolution canvas map.
- **Procedural Seed Generator**: Enter any numeric world seed (e.g. `631793443`) to dynamically compute and render the complete terrain surface.

---

### 🔍 4. Interactive Entity & Save Inspector
- **Creations & Vehicles**: Overworld rigid bodies categorized by block count with bounding boxes, dimensions, and inspection dialogs.
- **Bots & Wildlife**: Farmbots, Haybots, Tapebots, Totebots, and Wocs with custom icons and sub-layer filters.
- **Harvestables & Resources**: Oil geysers, Cotton plants, Stone/Metal deposits, and Trees.
- **Points of Interest (POIs)**: Mechanic Stations, Hideouts, Warehouses, Packing Stations, Trader, and Craftbots.
- **Save Sync**: 1-click active save detection and automatic reload on world saves.

---

### 📐 5. Tactical HUD & Navigation Tools
- **Distance Ruler**: Click two points to measure distance in meters, blocks, and estimated walking/driving travel time.
- **Coordinates HUD & Grid**: Toggleable world and cell coordinate overlay grid.
- **Search Engine**: Live search for POIs, creations, bots, or coordinates.
- **High-Res Screenshot Exporter**: One-click high-resolution PNG map export.
- **Modern Dark UI**: Glowing cyber-tactical dark interface with custom Scrap Mechanic application icon.

---

## 🛰️ Cloud Relay Server (`ScrapMechanicCoopMapServer`)

The multiplayer squad room system is powered by an independent, ultra-lightweight WebSocket room relay server located in the [`relay_server/`](file:///d:/SteamLibrary/steamapps/common/Scrap%20Mechanic/save_map_viewer/relay_server) directory and maintained in its own dedicated repository:

👉 **Relay Server GitHub Repository**: **[https://github.com/Srlimao/ScrapMechanicCoopMapServer](https://github.com/Srlimao/ScrapMechanicCoopMapServer)**

### 💡 Relay Server Architecture:
- **100% In-Memory RAM**: Zero disk writes, zero databases, and zero file leftovers.
- **Automatic Room Purging**: When the host leaves or a room becomes empty, the room and its cell data are immediately purged from memory.
- **Zombie Socket Cleanup**: 10-second heartbeat ping automatically prunes dead connections (crashes, Wi-Fi drops, sleep mode).
- **Ultra-Low Resource Footprint**: Consumes only **~25–35 MB RAM** and **<0.5% CPU**, running 24/7 on lightweight cloud instances (like Google Cloud `e2-micro`).
- **Production Endpoint**: Preconfigured to route securely over Cloudflare SSL at `wss://sm.dunhas.com`.

### 🚀 Deploying the Relay Server on Linux / Google Cloud VM:
```bash
# 1. Clone standalone server repo
git clone https://github.com/Srlimao/ScrapMechanicCoopMapServer.git
cd ScrapMechanicCoopMapServer

# 2. Install dependencies
npm install --production

# 3. Start with PM2
pm2 start server.js --name "sm-coop-relay" -- 8090
pm2 save
```

---

## 🏗️ Project Architecture & Vertical Slices

```
ScrapMechanicCoopMap/
├── .github/workflows/
│   └── release.yml             # Automated Windows CI/CD release workflow
├── build/                      # Multi-resolution application icons (.ico, .png)
├── electron/
│   ├── main.js                 # Electron main process & IPC coordinator
│   ├── memory_reader.js        # Win32 C-FFI memory hook (Toolhelp + ReadProcessMemory)
│   ├── game_scanner.js         # Steam save detector & path scanner
│   └── preload.js              # Secure IPC bridge
├── public/
│   ├── asset_uuids.json        # Game entity & tile UUID dictionary
│   ├── terrain-cell-atlas.webp # Official terrain texture atlas
│   └── terrain-cell-atlas.json # Atlas coordinate manifest
├── relay_server/               # Standalone WebSocket room relay server (Node.js)
│   ├── server.js               # In-memory room manager & telemetry broadcaster
│   ├── Dockerfile              # Container deployment definition
│   ├── docker-compose.yml      # Multi-container compose configuration
│   └── deploy_gcp.sh           # Automated 1-command Linux / GCP deployment script
├── src/
│   ├── core/                   # Reactive state store, coordinates, constants
│   ├── features/
│   │   ├── live_tracker/       # Live memory polling & player trail renderer
│   │   ├── map_renderer/       # Canvas engine, camera, layers, minimap
│   │   ├── save_loader/        # SQLite WASM decoder & save synchronizer
│   │   ├── squad/              # Multiplayer relay client, squad canvas layer & UI
│   │   └── tools/              # Seed generator, bookmarks, ruler, search, screenshot
│   ├── styles/                 # Modular dark-mode CSS design system
│   └── ui/                     # Modals, toasts, and HUD controllers
└── index.html                  # Main viewport & application shell
```

---

## 🛠️ Local Development & Building

### Prerequisites:
- [Node.js 20+](https://nodejs.org/)
- Windows 10 / 11 (for live memory tracking)

### Setup:
```bash
# 1. Clone repository
git clone https://github.com/Srlimao/ScrapMechanicCoopMap.git
cd ScrapMechanicCoopMap

# 2. Install dependencies
npm install

# 3. Run in Vite Web mode (Hot Reloading)
npm run dev

# 4. Run in Desktop Electron mode
npm run electron:dev
```

### Build Standalone Portable Executable:
```bash
npm run dist:portable
```
The compiled single-file binary will be generated in `dist_release/Scrap-Mechanic-Tactical-Map.exe`.

---

## 📜 License
This project is licensed under the [MIT License](LICENSE).
