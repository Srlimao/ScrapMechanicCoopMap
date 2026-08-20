// SQLite save file decoder using local SQL.js WebAssembly
import { state, notifyStateChange } from '../../core/state.js';
import { DEFAULT_SURVIVAL_POIS, CELL_SIZE, MAP_MIN_X, MAP_MAX_X, MAP_MIN_Y, MAP_MAX_Y } from '../../core/constants.js';
import { showToast } from '../../ui/toasts.js';
import { showLoadingOverlay, updateLoadingStage, hideLoadingOverlay } from '../../ui/modals.js';
import { setTerrainImageSource } from '../map_renderer/layer_terrain.js';
import { jumpToLocation } from '../map_renderer/camera.js';

let SQLModule = null;
let assetUuidMap = null;

export async function initSqlEngine() {
    if (SQLModule) return SQLModule;
    try {
        if (typeof window.initSqlJs === 'function') {
            try {
                SQLModule = await window.initSqlJs({
                    locateFile: f => `assets/vendor/${f}`
                });
                console.log("[SqlDecoder] SQL.js WASM Engine ready (local).");
            } catch (eLocal) {
                console.warn("[SqlDecoder] Local WASM load failed, attempting CDN fallback:", eLocal);
                SQLModule = await window.initSqlJs({
                    locateFile: f => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${f}`
                });
                console.log("[SqlDecoder] SQL.js WASM Engine ready (CDN fallback).");
            }
        }
    } catch (e) {
        console.warn("[SqlDecoder] SQL.js init error:", e);
    }
    return SQLModule;
}

export async function loadAssetUuidMap() {
    if (assetUuidMap) return assetUuidMap;
    try {
        const resp = await fetch('asset_uuids.json');
        if (resp.ok) {
            assetUuidMap = await resp.json();
            state.uuidMap = assetUuidMap;
        }
    } catch (e) {
        assetUuidMap = {};
    }
    return assetUuidMap || {};
}

function parseReversedUUID(bytes) {
    if (!bytes || bytes.length < 16) return "unknown";
    const rev = Array.from(bytes).reverse().map(b => b.toString(16).padStart(2, '0')).join('');
    return `${rev.slice(0, 8)}-${rev.slice(8, 12)}-${rev.slice(12, 16)}-${rev.slice(16, 20)}-${rev.slice(20)}`;
}

const textDecoder = new TextDecoder('latin1');
function safeDecode(val) {
    if (!val) return '';
    if (typeof val === 'string') return val;
    try {
        const arr = val instanceof Uint8Array ? val : new Uint8Array(val.buffer || val);
        return textDecoder.decode(arr);
    } catch (e) { return ''; }
}

export async function decodeSaveBuffer(arrayBuffer, filename = 'save.db', isAutoSync = false) {
    if (!isAutoSync) {
        showLoadingOverlay('STAGE 01: SQLITE HEADER', `Verifying SQLite database structure for ${filename}...`, 1, 15);
    }
    const SQL = await initSqlEngine();
    if (!SQL) throw new Error("SQL.js WASM engine not loaded.");
    const uuidMap = await loadAssetUuidMap();

    const Uints = new Uint8Array(arrayBuffer);
    const db = new SQL.Database(Uints);

    // 1. Game Metadata
    let gameInfo = { seed: 0, gametick: 0, version: 28 };
    try {
        const resGame = db.exec("SELECT savegameversion, flags, seed, gametick FROM Game LIMIT 1");
        if (resGame.length && resGame[0].values.length) {
            const row = resGame[0].values[0];
            gameInfo = { version: row[0], flags: row[1], seed: row[2], gametick: row[3] };
        }
    } catch (e) {}

    if (!isAutoSync) {
        updateLoadingStage(2, 40, 'Decompressing Lua bitstreams & shapes...', 'Parsing RigidBodies, Containers & Units', 'STAGE 02: LZ4 DECOMPRESS', filename);
    }

    // 2. RigidBody Creations
    const creations = [];
    try {
        const shapeMap = {};
        const resShapes = db.exec("SELECT bodyId, COUNT(*) FROM ChildShape GROUP BY bodyId");
        if (resShapes.length) {
            resShapes[0].values.forEach(r => { shapeMap[r[0]] = r[1]; });
        }

        const resRB = db.exec("SELECT id, worldId, data FROM RigidBody WHERE worldId = 1");
        if (resRB.length) {
            resRB[0].values.forEach(r => {
                const rbid = r[0], wid = r[1], blob = r[2];
                if (blob && blob.length >= 52) {
                    const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
                    const x = view.getFloat32(40, true);
                    const y = view.getFloat32(44, true);
                    const z = view.getFloat32(48, true);

                    if (x >= MAP_MIN_X && x <= MAP_MAX_X && y >= MAP_MIN_Y && y <= MAP_MAX_Y) {
                        const blocks = shapeMap[rbid] || 1;
                        if (blocks >= 10) {
                            const span = Math.max(3, Math.min(50, Math.sqrt(blocks) * 0.4));
                            creations.push({
                                id: rbid, worldId: wid,
                                x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, z: Math.round(z * 100) / 100,
                                minX: x - span, maxX: x + span, minY: y - span, maxY: y + span,
                                width: span * 2, height: span * 2, blocks: blocks
                            });
                        }
                    }
                }
            });
        }
    } catch (e) {}

    // 3. Units (Bots & Animals)
    const units = [];
    try {
        const resUnit = db.exec("SELECT id, worldId, data FROM Unit WHERE worldId = 1");
        if (resUnit.length) {
            resUnit[0].values.forEach(r => {
                const uid = r[0], wid = r[1], blob = r[2];
                if (blob && blob.length >= 48) {
                    const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
                    const x = view.getFloat32(36, true);
                    const y = view.getFloat32(40, true);
                    const z = view.getFloat32(44, true);

                    if (x >= MAP_MIN_X && x <= MAP_MAX_X && y >= MAP_MIN_Y && y <= MAP_MAX_Y) {
                        let uUuid = blob.length >= 36 ? parseReversedUUID(blob.slice(20, 36)) : "unknown";
                        const info = uuidMap[uUuid] || { name: 'Unit', category: 'enemy', icon: 'fa-robot', color: '#f97316' };
                        let name = info.name || 'Unit';
                        let subType = 'haybot';
                        let uColor = '#f97316';
                        let uIcon = 'fa-robot';

                        const lower = name.toLowerCase();
                        if (lower.includes('farmbot') || lower.includes('boss') || lower.includes('trashbot')) {
                            subType = 'boss';
                            uColor = '#ef4444';
                            uIcon = 'fa-skull';
                            name = name || 'Farmbot';
                        } else if (lower.includes('tapebot')) {
                            subType = 'tapebot';
                            uColor = '#06b6d4';
                            uIcon = 'fa-crosshairs';
                        } else if (lower.includes('totebot')) {
                            subType = 'totebot';
                            uColor = '#84cc16';
                            uIcon = 'fa-bolt';
                        } else if (lower.includes('seedbot') || lower.includes('npc')) {
                            subType = 'seedbot';
                            uColor = '#34d399';
                            uIcon = 'fa-seedling';
                        } else if (lower.includes('woc') || lower.includes('glowbug') || lower.includes('animal')) {
                            subType = 'animal';
                            uColor = '#eab308';
                            uIcon = 'fa-cow';
                        } else if (lower.includes('haybot')) {
                            subType = 'haybot';
                            uColor = '#f97316';
                            uIcon = 'fa-robot';
                        }

                        units.push({
                            id: uid, worldId: wid,
                            x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, z: Math.round(z * 10) / 10,
                            uuid: uUuid,
                            name: name,
                            category: info.category || 'enemy',
                            subType: subType,
                            icon: uIcon,
                            color: uColor
                        });
                    }
                }
            });
        }
    } catch (e) {}

    // 4. Harvestables: Aggregated by Tile & Category (1 icon per resource type per tile, scaled by count)
    const harvestables = [];
    try {
        const resHarv = db.exec("SELECT id, worldId, x, y, size, data FROM Harvestable");
        if (resHarv.length) {
            const tileCategoryMap = new Map(); // key: `${cx},${cy}_${category}` -> deposit object

            resHarv[0].values.forEach(r => {
                const hid = r[0], wid = r[1], cx = r[2], cy = r[3], size = r[4], blob = r[5];
                let hUuid = blob && blob.length >= 36 ? parseReversedUUID(blob.slice(20, 36)) : "unknown";
                const info = uuidMap[hUuid] || { name: 'Resource Node', category: 'other', icon: 'fa-seedling', color: '#10b981' };
                const cat = info.category || 'other';

                const key = `${cx},${cy}_${cat}`;
                if (!tileCategoryMap.has(key)) {
                    tileCategoryMap.set(key, {
                        id: hid,
                        worldId: wid,
                        cellX: cx,
                        cellY: cy,
                        category: cat,
                        name: info.name || 'Resource Node',
                        icon: info.icon || 'fa-seedling',
                        color: info.color || '#10b981',
                        count: 0,
                        items: []
                    });
                }
                const dep = tileCategoryMap.get(key);
                dep.count++;
                dep.items.push({ id: hid, uuid: hUuid, name: info.name });
            });

            // Offset multiple different categories residing on the same tile
            const cellDepositsMap = new Map();
            tileCategoryMap.forEach(dep => {
                const cellKey = `${dep.cellX},${dep.cellY}`;
                if (!cellDepositsMap.has(cellKey)) cellDepositsMap.set(cellKey, []);
                cellDepositsMap.get(cellKey).push(dep);
            });

            cellDepositsMap.forEach((depList) => {
                const catCount = depList.length;
                depList.forEach((dep, idx) => {
                    if (catCount === 1) {
                        dep.x = dep.cellX * CELL_SIZE + 32;
                        dep.y = dep.cellY * CELL_SIZE + 32;
                    } else {
                        const angle = (idx / catCount) * Math.PI * 2 - Math.PI / 2;
                        const dist = Math.min(18, 10 + catCount * 2);
                        dep.x = Math.round((dep.cellX * CELL_SIZE + 32 + Math.cos(angle) * dist) * 10) / 10;
                        dep.y = Math.round((dep.cellY * CELL_SIZE + 32 + Math.sin(angle) * dist) * 10) / 10;
                    }

                    dep.clusterCount = dep.count;
                    dep.clusterItems = dep.items;
                    harvestables.push(dep);
                });
            });
        }
    } catch (e) {
        console.warn("[SqlDecoder] Harvestables extraction error:", e);
    }

    // Fast-path for AutoSync: If the world seed matches existing map, update dynamic entities quietly and exit
    const isSameWorld = state.mapData && state.mapData.gameInfo && state.mapData.gameInfo.seed === gameInfo.seed;
    if (isAutoSync && isSameWorld) {
        db.close();
        state.mapData.creations = creations;
        state.mapData.units = units;
        state.mapData.harvestables = harvestables;
        state.mapData.gameInfo = gameInfo;

        updateMetadataDOM(gameInfo, state.mapData.pois, state.mapData.schematics, creations, units, harvestables);
        notifyStateChange('entities_updated', state.mapData);
        return state.mapData;
    }

    // 5. POIs & Schematics / Builder Guide Platforms from ScriptData
    let pois = [];
    const schematics = [];
    try {
        const resScript = db.exec("SELECT key, worldId, data FROM ScriptData");
        if (resScript.length) {
            const seenPOI = new Set();
            const seenSchem = new Set();

            resScript[0].values.forEach(r => {
                const keyStr = safeDecode(r[0]);
                const dataStr = safeDecode(r[2]);
                const combined = keyStr + " " + dataStr;
                const matches = combined.matchAll(/ts_(\d+):\((-?\d+),(-?\d+)\)/g);

                for (const m of matches) {
                    const wid = parseInt(m[1]), cx = parseInt(m[2]), cy = parseInt(m[3]);
                    const combLower = combined.toLowerCase();
                    const wx = cx * CELL_SIZE + 32, wy = cy * CELL_SIZE + 32;

                    // Comprehensive POIs Extraction
                    let pName = null, pIcon = 'fa-location-dot', pColor = '#f59e0b', pCat = 'other';

                    if (combLower.includes('chemicalplant') || combLower.includes('chemicallake') || (combLower.includes('chemical') && combLower.includes('road'))) {
                        pName = 'Chemical Plant / Pool';
                        pIcon = 'fa-flask-vial';
                        pColor = '#06b6d4';
                        pCat = 'chemical';
                    } else if (combLower.includes('oillake') || combLower.includes('oil_dessert')) {
                        pName = 'Oil Lake Reserve';
                        pIcon = 'fa-oil-well';
                        pColor = '#f59e0b';
                        pCat = 'oil';
                    } else if (combLower.includes('mechanicstation')) {
                        pName = 'Mechanic Station';
                        pIcon = 'fa-wrench';
                        pColor = '#ff7a00';
                        pCat = 'mechanic';
                    } else if (combLower.includes('hideout') || combLower.includes('farmer') || combLower.includes('trader')) {
                        pName = 'Trader / Hideout';
                        pIcon = 'fa-store';
                        pColor = '#10b981';
                        pCat = 'trader';
                    } else if (combLower.includes('warehouse')) {
                        pName = 'Warehouse';
                        pIcon = 'fa-building-shield';
                        pColor = '#ef4444';
                        pCat = 'warehouse';
                    } else if (combLower.includes('silo') || combLower.includes('packing')) {
                        pName = 'Packing Station';
                        pIcon = 'fa-boxes-packing';
                        pColor = '#06b6d4';
                        pCat = 'packing';
                    } else if (combLower.includes('scrapyard')) {
                        pName = 'Scrapyard';
                        pIcon = 'fa-recycle';
                        pColor = '#eab308';
                        pCat = 'scrapyard';
                    }

                    if (pName) {
                        const k = `${cx},${cy}_${pName}`;
                        if (!seenPOI.has(k)) {
                            seenPOI.add(k);
                            pois.push({ worldId: wid, cellX: cx, cellY: cy, x: wx, y: wy, name: pName, icon: pIcon, color: pColor, category: pCat });
                        }
                    }
                }

                // Schematics & Builder Guide Platforms Extraction
                const mSchem = keyStr.match(/ts_(\d+):\((-?\d+),(-?\d+)\)/);
                if (mSchem) {
                    const wid = parseInt(mSchem[1]), cx = parseInt(mSchem[2]), cy = parseInt(mSchem[3]);
                    const dataLower = dataStr.toLowerCase();
                    const wx = cx * CELL_SIZE + 32, wy = cy * CELL_SIZE + 32;
                    let schName = null;
                    let schKind = 'guide';
                    let schIcon = 'fa-microchip';
                    let schColor = '#38bdf8';
                    let schDesc = 'Builder Guide / Schematic unlock station.';

                    if (dataLower.includes('mechanicstation') || dataLower.includes('nonplayercrafter') || dataLower.includes('partunlockstation') || dataLower.includes('schematicstation')) {
                        schName = "Schematic Recipe Unlocker Station";
                        schKind = "machine";
                        schIcon = "fa-microchip";
                        schColor = "#38bdf8";
                        schDesc = "Schematicbot unlocker station with hologram terminal to craft new items.";
                    } else if (dataLower.includes('_startercar') || dataLower.includes('_first_car')) {
                        schName = "Starter Car Builder Guide Platform";
                        schKind = "guide";
                        schIcon = "fa-car-side";
                        schColor = "#38bdf8";
                        schDesc = "Blueprint guide platform for assembling the initial survival vehicle.";
                    } else if (dataLower.includes('_harvest_car')) {
                        schName = "Harvest Car Builder Guide Platform";
                        schKind = "guide";
                        schIcon = "fa-truck-pickup";
                        schColor = "#38bdf8";
                        schDesc = "Blueprint guide platform for tree/rock harvesting vehicle.";
                    } else if (dataLower.includes('_advanced_car')) {
                        schName = "Advanced Car Builder Guide Platform";
                        schKind = "guide";
                        schIcon = "fa-truck-monster";
                        schColor = "#38bdf8";
                        schDesc = "Blueprint guide platform for high-tier heavy vehicle.";
                    } else if (dataLower.includes('bq_watchtower')) {
                        schName = "Watchtower Builder Guide Platform";
                        schKind = "guide";
                        schIcon = "fa-tower-observation";
                        schColor = "#38bdf8";
                        schDesc = "Blueprint guide platform for defensive outpost watchtower.";
                    } else if (dataLower.includes('bq_wochouse') || dataLower.includes('_wochous')) {
                        schName = "Woc House Builder Guide Platform";
                        schKind = "guide";
                        schIcon = "fa-house-chimney";
                        schColor = "#38bdf8";
                        schDesc = "Blueprint guide platform for cattle shelter structure.";
                    } else if (dataLower.includes('bq_cornheart')) {
                        schName = "Cornheart Farm Builder Guide Platform";
                        schKind = "guide";
                        schIcon = "fa-wheat-awn";
                        schColor = "#38bdf8";
                        schDesc = "Blueprint guide platform for agricultural farming structure.";
                    } else if (dataLower.includes('bq_garden')) {
                        schName = "Garden Guide Platform";
                        schKind = "guide";
                        schIcon = "fa-seedling";
                        schColor = "#38bdf8";
                        schDesc = "Blueprint guide platform for farming plot.";
                    } else if (dataLower.includes('bq_beesuit')) {
                        schName = "Beesuit Guide Platform";
                        schKind = "guide";
                        schIcon = "fa-shield";
                        schColor = "#38bdf8";
                        schDesc = "Blueprint guide platform for beekeeper protection equipment.";
                    } else if (dataLower.includes('builderguideplatform')) {
                        schName = "Builder Guide Platform";
                        schKind = "guide";
                        schIcon = "fa-cubes";
                        schColor = "#38bdf8";
                        schDesc = "Blueprint guide platform on the ground for assembling creations.";
                    }

                    if (schName) {
                        const sk = `${cx},${cy}:${schName}`;
                        if (!seenSchem.has(sk)) {
                            seenSchem.add(sk);
                            schematics.push({
                                worldId: wid,
                                cellX: cx,
                                cellY: cy,
                                x: wx,
                                y: wy,
                                name: schName,
                                category: 'schematic',
                                kind: schKind,
                                icon: schIcon,
                                color: schColor,
                                desc: schDesc
                            });
                        }
                    }
                }
            });
        }
    } catch (e) {}

    // Merge default landmarks
    DEFAULT_SURVIVAL_POIS.forEach(defPoi => {
        if (!pois.some(p => Math.hypot(p.x - defPoi.x, p.y - defPoi.y) < 64)) {
            pois.push(defPoi);
        }
    });

    // 6. Terrain Atlas Stitching
    if (!isAutoSync) {
        updateLoadingStage(3, 70, 'Stitching 12,288 world cells...', `Rendering procedural atlas for seed ${gameInfo.seed || 'N/A'}`, 'STAGE 03: ATLAS STITCHING', filename);
    }
    let terrainRendered = false;
    if (window.TerrainLoader) {
        try {
            const res = await window.TerrainLoader.renderTerrainFromSaveDB(db, {
                blendEdges: state.terrainEdgeBlend !== false
            });
            if (res && res.dataUrl) {
                setTerrainImageSource(res.dataUrl, gameInfo.seed);
                terrainRendered = true;
                if (res.cells) {
                    gameInfo.terrainCells = res.cells;
                }
            }
        } catch (e) {}
    }

    db.close();

    if (!isAutoSync) {
        updateLoadingStage(4, 95, `Indexed ${creations.length} creations, ${units.length} bots, ${pois.length} POIs`, 'Registering spatial coordinates', 'STAGE 04: SPATIAL INDEX', filename);
    }

    state.mapData = {
        gameInfo, pois, schematics, creations, units, harvestables, portals: [],
        terrainCells: gameInfo.terrainCells || null
    };

    // Update UI Metadata DOM
    updateMetadataDOM(gameInfo, pois, schematics, creations, units, harvestables);
    hideLoadingOverlay();
    notifyStateChange('save_loaded', state.mapData);

    showToast(
        'Save Loaded Successfully!',
        `${filename} • Seed: ${gameInfo.seed || 'N/A'} • ${schematics.length} Schematics • ${creations.length} Creations • ${units.length} Bots`,
        'success',
        6000
    );

    return state.mapData;
}

function updateMetadataDOM(gameInfo, pois, schematics, creations, units, harvestables) {
    const metaSeed = document.getElementById('metaSeed');
    const metaTick = document.getElementById('metaTick');
    const metaDays = document.getElementById('metaDays');
    const metaVersion = document.getElementById('metaVersion');
    const countPOIs = document.getElementById('countPOIs');
    const countSchematics = document.getElementById('countSchematics');
    const countCreations = document.getElementById('countCreations');
    const countUnits = document.getElementById('countUnits');
    const countHarvestables = document.getElementById('countHarvestables');

    if (metaSeed) metaSeed.textContent = gameInfo.seed || '-';
    if (metaTick) metaTick.textContent = gameInfo.gametick || '-';
    if (metaDays) metaDays.textContent = gameInfo.gametick ? `Day ${Math.floor(gameInfo.gametick / (40 * 60 * 24)) + 1}` : '-';
    if (metaVersion) metaVersion.textContent = `v${gameInfo.version || 28}`;
    if (countPOIs) countPOIs.textContent = pois.length;
    if (countSchematics) countSchematics.textContent = schematics.length;
    if (countCreations) countCreations.textContent = creations.length;
    if (countUnits) countUnits.textContent = units.length;
    if (countHarvestables) countHarvestables.textContent = harvestables.length;
}
