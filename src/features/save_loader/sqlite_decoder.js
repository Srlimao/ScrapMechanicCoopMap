// SQLite save file decoder using local SQL.js WebAssembly
import { state, notifyStateChange } from '../../core/state.js';
import { DEFAULT_SURVIVAL_POIS, CELL_SIZE, MAP_MIN_X, MAP_MAX_X, MAP_MIN_Y, MAP_MAX_Y } from '../../core/constants.js';
import { showToast } from '../../ui/toasts.js';
import { showLoadingOverlay, hideLoadingOverlay } from '../../ui/modals.js';
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

export async function decodeSaveBuffer(arrayBuffer, filename = 'save.db') {
    showLoadingOverlay('INITIALIZING SQLITE WASM...', `Decoding ${filename}...`);
    const SQL = await initSqlEngine();
    if (!SQL) throw new Error("SQL.js WASM engine not loaded.");
    const uuidMap = await loadAssetUuidMap();

    showLoadingOverlay('PARSING SAVE ENTITIES...', 'Extracting RigidBodies, Units, Harvestables, and POIs...');
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
                        const span = Math.max(3, Math.min(50, Math.sqrt(blocks) * 0.4));
                        creations.push({
                            id: rbid, worldId: wid,
                            x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, z: Math.round(z * 100) / 100,
                            minX: x - span, maxX: x + span, minY: y - span, maxY: y + span,
                            width: span * 2, height: span * 2, blocks: blocks
                        });
                    }
                }
            });
        }
    } catch (e) {}

    // 3. Units
    const units = [];
    try {
        const resUnits = db.exec("SELECT id, worldId, x, y, data FROM Unit");
        if (resUnits.length) {
            resUnits[0].values.forEach(r => {
                const uid = r[0], wid = r[1], cx = r[2], cy = r[3], blob = r[4];
                let unitUuid = blob && blob.length >= 34 ? parseReversedUUID(blob.slice(18, 34)) : "unknown";
                const info = uuidMap[unitUuid] || { name: 'Unit', category: 'bot', icon: 'fa-robot', color: '#ef4444' };
                units.push({
                    id: uid, worldId: wid, cellX: cx, cellY: cy,
                    x: cx * CELL_SIZE + 32, y: cy * CELL_SIZE + 32,
                    uuid: unitUuid, name: info.name || 'Unit', category: info.category || 'bot',
                    icon: info.icon || 'fa-robot', color: info.color || '#ef4444'
                });
            });
        }
    } catch (e) {}

    // 4. Harvestables
    const harvestables = [];
    try {
        const resHarv = db.exec("SELECT id, worldId, x, y, size, data FROM Harvestable");
        if (resHarv.length) {
            resHarv[0].values.forEach(r => {
                const hid = r[0], wid = r[1], cx = r[2], cy = r[3], size = r[4], blob = r[5];
                let hUuid = blob && blob.length >= 36 ? parseReversedUUID(blob.slice(20, 36)) : "unknown";
                const info = uuidMap[hUuid] || { name: 'Resource Node', category: 'resource', icon: 'fa-seedling', color: '#10b981' };
                harvestables.push({
                    id: hid, worldId: wid, cellX: cx, cellY: cy,
                    x: cx * CELL_SIZE + 32, y: cy * CELL_SIZE + 32, size: size,
                    uuid: hUuid, name: info.name || 'Resource Node', category: info.category || 'resource',
                    icon: info.icon || 'fa-seedling', color: info.color || '#10b981'
                });
            });
        }
    } catch (e) {}

    // 5. POIs & Schematics from ScriptData
    let pois = [];
    const schematics = [];
    try {
        const resScript = db.exec("SELECT key, worldId, data FROM ScriptData");
        if (resScript.length) {
            const seenPOI = new Set();
            resScript[0].values.forEach(r => {
                const keyStr = safeDecode(r[0]);
                const m = keyStr.match(/ts_(\d+):\((-?\d+),(-?\d+)\)/);
                if (m) {
                    const wid = parseInt(m[1]), cx = parseInt(m[2]), cy = parseInt(m[3]);
                    const dataStr = safeDecode(r[2]).toLowerCase();
                    const wx = cx * CELL_SIZE + 32, wy = cy * CELL_SIZE + 32;

                    const types = [];
                    let pIcon = 'fa-location-dot', pColor = '#f59e0b';
                    if (dataStr.includes('mechanicstation')) { types.push('Mechanic Station'); pIcon = 'fa-wrench'; pColor = '#ff7a00'; }
                    if (dataStr.includes('hideout')) { types.push('Hideout'); pIcon = 'fa-store'; pColor = '#10b981'; }
                    if (dataStr.includes('warehouse')) { types.push('Warehouse'); pIcon = 'fa-building-shield'; pColor = '#ef4444'; }
                    if (dataStr.includes('farmer') || dataStr.includes('trader')) { types.push('Trader / Farmer'); pIcon = 'fa-handshake'; pColor = '#10b981'; }
                    if (dataStr.includes('silo') || dataStr.includes('packing')) { types.push('Packing Station'); pIcon = 'fa-boxes-packing'; pColor = '#06b6d4'; }

                    if (types.length > 0) {
                        const k = `${cx},${cy}`;
                        if (!seenPOI.has(k)) {
                            seenPOI.add(k);
                            pois.push({ worldId: wid, cellX: cx, cellY: cy, x: wx, y: wy, name: types.join(' & '), icon: pIcon, color: pColor });
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
    showLoadingOverlay('STITCHING TERRAIN ATLAS...', `Rendering world map for seed ${gameInfo.seed || 'N/A'}...`);
    let terrainRendered = false;
    if (window.TerrainLoader) {
        try {
            const res = await window.TerrainLoader.renderTerrainFromSaveDB(db);
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
        `${filename} • Seed: ${gameInfo.seed || 'N/A'} • ${creations.length} Creations • ${units.length} Bots • ${harvestables.length} Resources`,
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
