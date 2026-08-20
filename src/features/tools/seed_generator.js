// Procedural Seed Terrain Generator & Atlas Stitcher Controller
import { state, notifyStateChange } from '../../core/state.js';
import { setTerrainImageSource } from '../map_renderer/layer_terrain.js';
import { showToast } from '../../ui/toasts.js';
import { showLoadingOverlay, updateLoadingStage, hideLoadingOverlay } from '../../ui/modals.js';

export function setupSeedGeneratorControls(elements) {
    const seedInput = document.getElementById('seedInput');
    const btnGenSeed = document.getElementById('btnGenSeed');
    const btnLoadReferenceSeed = document.getElementById('btnLoadReferenceSeed');
    const btnClearCache = document.getElementById('btnClearCache');
    const seedGenStatus = document.getElementById('seedGenStatus');

    if (btnGenSeed && seedInput) {
        btnGenSeed.addEventListener('click', async () => {
            const rawVal = seedInput.value.trim();
            if (!rawVal) {
                showToast("Invalid Seed", "Please enter a valid numeric world seed.", "warning");
                return;
            }
            const seedNum = parseInt(rawVal, 10);
            if (isNaN(seedNum)) {
                showToast("Invalid Seed", "Seed must be an integer (e.g. 631793443).", "warning");
                return;
            }
            await generateMapFromSeed(seedNum, seedGenStatus);
        });

        seedInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                btnGenSeed.click();
            }
        });
    }

    if (btnLoadReferenceSeed) {
        btnLoadReferenceSeed.addEventListener('click', async () => {
            await generateMapFromSeed(151054709, seedGenStatus);
        });
    }

    if (btnClearCache) {
        btnClearCache.addEventListener('click', () => {
            sessionStorage.clear();
            localStorage.clear();
            showToast("Cache Cleared", "Local map and save cache cleared.", "info");
            if (seedGenStatus) seedGenStatus.textContent = "Cache cleared.";
        });
    }
}

export async function generateMapFromSeed(seed, statusEl = null) {
    console.log(`[SeedGen] Generating terrain for seed: ${seed}`);
    if (statusEl) statusEl.textContent = `Generating seed ${seed}...`;
    showLoadingOverlay('STAGE 01: SEED VERIFICATION', `Computing 12,288 world cells for seed ${seed}...`, 1, 20);

    const cachedUrl = sessionStorage.getItem('sm_cached_terrain_' + seed);
    if (cachedUrl) {
        console.log(`[SeedGen] Using session-cached terrain for seed ${seed}`);
        setTerrainImageSource(cachedUrl, seed);
        updateSeedUI(seed, 12288, statusEl);
        hideLoadingOverlay();
        showToast("Seed Map Loaded", `Loaded cached terrain for seed ${seed}.`, "success");
        return;
    }

    try {
        let result = null;

        updateLoadingStage(2, 45, `Querying procedural pipeline for seed ${seed}...`, 'Synthesizing tile layout matrix', 'STAGE 02: MATRIX SYNTHESIS', `SEED ${seed}`);

        // 1. Electron IPC Call
        if (window.electronAPI && typeof window.electronAPI.generateTerrain === 'function') {
            result = await window.electronAPI.generateTerrain(seed);
        }

        // 2. Web API Call fallback
        if (!result || !result.success) {
            try {
                const resp = await fetch(`/api/terrain?seed=${seed}&t=` + Date.now());
                if (resp.ok) {
                    result = await resp.json();
                }
            } catch (e) {}
        }

        if (result && result.cells && window.TerrainLoader) {
            updateLoadingStage(3, 75, 'Stitching 12,288 official atlas cells...', `Blending tile boundaries for seed ${seed}`, 'STAGE 03: ATLAS STITCHING', `SEED ${seed}`);
            const res = await window.TerrainLoader.renderTerrainFromCells(result.cells, seed, {
                blendEdges: state.terrainEdgeBlend !== false
            });
            if (res && res.dataUrl) {
                updateLoadingStage(4, 95, `Rendered ${res.renderedCells || 12288} cells`, 'Finalizing texture composite', 'STAGE 04: TEXTURE COMPOSITE', `SEED ${seed}`);
                setTerrainImageSource(res.dataUrl, seed);
                sessionStorage.setItem('sm_cached_terrain_' + seed, res.dataUrl);
                updateSeedUI(seed, res.renderedCells || 12288, statusEl, result.cells);
                hideLoadingOverlay();
                showToast("Map Generated Successfully!", `Rendered 12,288 cells for seed ${seed}.`, "success", 5000);
                return;
            }
        }

        if (result && result.image) {
            const imgUrl = `${result.image}?t=${Date.now()}`;
            setTerrainImageSource(imgUrl, seed);
            updateSeedUI(seed, 12288, statusEl, result.cells || null);
            hideLoadingOverlay();
            showToast("Map Generated Successfully!", `Loaded generated terrain for seed ${seed}.`, "success", 5000);
            return;
        }

        throw new Error(result ? (result.error || "Generation engine unavailable") : "Generation engine unavailable");
    } catch (err) {
        console.error("[SeedGen] Error generating seed map:", err);
        hideLoadingOverlay();
        if (statusEl) statusEl.textContent = `Error: ${err.message}`;
        showToast("Generation Notice", `Could not generate terrain dynamically (${err.message}). Using reference island surface.`, "warning", 6000);
        setTerrainImageSource('survival-world-surface.webp', seed);
        updateSeedUI(seed, 0, statusEl);
    }
}

function updateSeedUI(seed, cellCount, statusEl, cells = null) {
    const metaSeed = document.getElementById('metaSeed');
    if (metaSeed) metaSeed.textContent = seed;

    const seedInput = document.getElementById('seedInput');
    if (seedInput) seedInput.value = seed;

    if (statusEl) {
        statusEl.textContent = `Active Seed: ${seed} (${cellCount} cells stitched)`;
    }

    if (!state.mapData) {
        state.mapData = { gameInfo: { seed }, pois: [], schematics: [], creations: [], units: [], harvestables: [], portals: [], terrainCells: cells };
    } else {
        state.mapData.gameInfo.seed = seed;
        if (cells) state.mapData.terrainCells = cells;
    }

    notifyStateChange('terrain_generated', { seed, cellCount });
}
