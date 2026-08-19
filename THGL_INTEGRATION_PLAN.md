# The Hidden Gaming Lair (TH.GL) Integration Plan
## Scrap Mechanic Web Map, Save Parser & Live Tracking Component

> **Target Repository**: [`The-Hidden-Gaming-Lair/thgl-web-components`](https://github.com/The-Hidden-Gaming-Lair/thgl-web-components)  
> **Source Project**: Scrap Mechanic Tactical Map & Real-Time Co-op Companion  
> **Status**: Design & Architecture Specification (Ready for Implementation)

---

## 1. Executive Summary

This document outlines the architecture and integration strategy for porting the core modules developed for the **Scrap Mechanic Tactical Map & Save Viewer** into **The Hidden Gaming Lair (TH.GL)** multi-app monorepo.

TH.GL provides interactive maps, in-game overlays, and real-time companion tracking across 20+ survival/open-world games. Adding **Scrap Mechanic** brings first-class support for:
1. **Procedural & Default Survival World Maps** with multi-layer cell atlas stitching.
2. **Client-Side Save File Analysis** (WASM-based SQLite parser for instant creation, chest, and beacon discovery).
3. **Live Character & Threat Tracking** compatible with the TH.GL Desktop Companion App, Peer Link, and Overwolf overlay.

---

## 2. Technical Stack Alignment

| Dimension | TH.GL Ecosystem | Scrap Mechanic Source Implementation | Porting Strategy |
| :--- | :--- | :--- | :--- |
| **Monorepo / Build** | Turborepo + Bun + TypeScript | Vite / Node.js / Python | TypeScript packages under `packages/@repo/*` and apps in `apps/*` |
| **Frontend Framework** | Next.js (Web Apps), Vite (Overwolf) | Vanilla JS / Leaflet / HTML5 Canvas | React/TypeScript components with Leaflet / MapLibre / Canvas engine |
| **Save File Parsing** | Browser-side / Local privacy-focused | Python backend (`sqlite3`) / Node.js | Client-side **`sql.js` (WebAssembly SQLite)** — 0 server uploads |
| **Live Tracking** | TH.GL Companion App / Memory Hook | C-FFI Memory Reader & `dinput8.dll` Proxy | Direct memory address integration into TH.GL Companion + WebSocket relay |
| **Map Rendering** | WebGL2 / Tile Layers / Canvas | 12,288 Cell Atlas WebP + JSON metadata | Modular tile layer generator supporting seeds & custom worlds |

---

## 3. Monorepo Structure & Deliverables

```
thgl-web-components/
├── apps/
│   ├── scrap-mechanic-web/                 # Next.js web application (scrapmechanic.th.gl)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── layout.tsx
│   │   │   │   └── page.tsx                # Main interactive map experience
│   │   │   ├── components/
│   │   │   │   ├── SMMapViewer.tsx         # Leaflet/Canvas interactive world map
│   │   │   │   ├── SMSaveDropzone.tsx      # WASM SQLite save file inspector
│   │   │   │   ├── SMRadarScope.tsx        # 360° Proximity threat radar widget
│   │   │   │   └── SMLayerFilters.tsx      # POI, resources, creations, bot filters
│   │   │   └── config/
│   │   │       ├── pois.json               # Static landmarks (Trader, Mechanic Stations, etc.)
│   │   │       └── categories.ts           # Filtering hierarchy & icon metadata
│   │   └── package.json
│   │
│   └── scrap-mechanic-overwolf/            # Vite + React Overwolf in-game overlay
│       ├── src/
│       │   ├── App.tsx                     # In-game HUD overlay & transparent minimap
│       │   └── hooks/useSMLiveTracking.ts  # Real-time position & entity listener
│       └── package.json
│
├── packages/
│   ├── @repo/lib/
│   │   └── src/games/scrap-mechanic/
│   │       ├── coordinates.ts              # World (X,Y,Z) <-> Cell (X,Y) <-> Map (Lng,Lat)
│   │       ├── saveParser.ts               # sql.js WASM SQLite parser for .db saves
│   │       ├── terrainAtlas.ts             # Atlas JSON/WebP cell coordinate math
│   │       └── constants.ts                # World bounds, cell sizes (64x64), POI schemas
│   │
│   └── @repo/ui/
│       └── src/components/
│           ├── Map/                        # Shared map wrappers & custom controls
│           └── Radar/                      # Circular proximity scope component
```

---

## 4. Core Subsystems to Integrate

### A. Client-Side Save File Parser (`@repo/lib/saveParser.ts`)
* **Technology**: `sql.js` (WebAssembly SQLite)
* **How it works**:
  1. User drags and drops their Scrap Mechanic save file (`<SaveName>.db` from `%AppData%/Axolot Games/Scrap Mechanic/User/User_<id>/Save/Survival/`).
  2. The parser runs **100% locally in the browser memory** with zero server transfers.
  3. Queries extracted:
     - **Player State**: Position $(X, Y, Z)$, inventory data, death markers.
     - **Creations / Bodies**: Joint count, mass, block counts ($\ge 50$ blocks for vehicles).
     - **Containers & Storage**: Large chests, packing station stock, resource silos.
     - **World Seed & Cells**: Extracts custom world cell layout if modified from default.
  4. Automatically emits GeoJSON / marker points onto the map view.

### B. Terrain Cell Atlas & Map Engine (`@repo/lib/terrainAtlas.ts`)
* **Technology**: 2D Canvas / WebGL Tile Sticher
* **Asset Payload**:
  - `terrain-cell-atlas.webp` (Optimized texture atlas of all Scrap Mechanic terrain tiles).
  - `terrain-cell-atlas.json` (Tile UUIDs, rotation matrices, UV coordinates).
* **Execution**:
  - Default Survival World: Stitches standard seed `631793443` (12,288 world cells) in $< 50\text{ms}$.
  - Custom Worlds: Parses the cell table from uploaded save files to render any custom seed or terrain generation dynamically.

### C. Coordinate Math & Projections (`@repo/lib/coordinates.ts`)
* Scrap Mechanic coordinate specifications:
  - **World Bounds**: $-3072 \le X, Y \le +3072$ units (64 $\times$ 64 cell matrix).
  - **Cell Dimensions**: 1 Cell = $64 \times 64$ world units / blocks.
  - **Altitude**: $Z$ axis (sea level baseline $\approx 0\text{m} - 10\text{m}$).
* Mathematical transforms:
  $$\text{cellX} = \lfloor (X + 3072) / 64 \rfloor, \quad \text{cellY} = \lfloor (Y + 3072) / 64 \rfloor$$
  $$\text{pixelX} = \left(\frac{X + 3072}{6144}\right) \times \text{mapWidth}, \quad \text{pixelY} = \left(1 - \frac{Y + 3072}{6144}\right) \times \text{mapHeight}$$

### D. Tactical Proximity Radar (`@repo/ui/Radar`)
* Circular scope showing threats (Bots) with relative altitude indicators:
  - 🔺 **▲ Above**: Threat is $> +2.5\text{m}$ altitude difference.
  - 🔻 **▼ Below**: Threat is $< -2.5\text{m}$ altitude difference.
  - 🔴 **● Level**: Threat is on the same plane ($\pm 2.5\text{m}$).
* Separation of passive wildlife (Wocs, Glowbugs, Seedbots) vs. aggressive threats (Tapebots, Farmbots, Haybots, Totebots).

---

## 5. Implementation Steps

1. **Step 1: Coordinate & Save Parser Package (`@repo/lib`)**
   - Implement `coordinates.ts` with comprehensive unit tests for coordinate transforms.
   - Implement `saveParser.ts` using `sql.js` for browser-based `.db` reading.

2. **Step 2: Atlas Asset Pipeline (`apps/scrap-mechanic-web/public`)**
   - Optimize and bundle `terrain-cell-atlas.webp` and `terrain-cell-atlas.json`.
   - Implement client-side canvas tile renderer for seed `631793443`.

3. **Step 3: Web Application (`apps/scrap-mechanic-web`)**
   - Create Next.js page structure following TH.GL standard conventions.
   - Integrate marker layer filtering (Static POIs, Dropped Save Data, Custom User Waypoints).
   - Add Save Dropzone UI with progress feedback.

4. **Step 4: Live Companion / Overwolf Bridge**
   - Hook into TH.GL Companion App memory-reader protocol for `ScrapMechanic.exe`.
   - Connect live WebSocket / Peer Link for position sync across mobile and second-screen devices.

---

## 6. References & Assets in Source Repo

* **Terrain Atlas**: `terrain-cell-atlas.webp`, `terrain-cell-atlas.json`
* **Coordinate Algorithms**: `terrain_loader.js`, `extract_save.py`
* **Static POI Definitions**: `src/core/poi_database.js` / `asset_uuids.json`
* **Proximity Scope UI**: `src/overlay/radar.js` / `overlay.html`
