// LocalStorage settings persistence and layer toggle synchronizer
import { state, notifyStateChange, subscribe } from '../../core/state.js';
import { setTerrainImageSource } from '../map_renderer/layer_terrain.js';

const STORAGE_KEY = 'sm_tactical_map_settings_v7';

export function loadSettings() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);
        if (data.layers) Object.assign(state.layers, data.layers);
        if (data.subFilters) Object.assign(state.subFilters, data.subFilters);
        if (typeof data.mapOpacity === 'number') state.mapOpacity = data.mapOpacity;
        if (typeof data.showCoordinates === 'boolean') state.showCoordinates = data.showCoordinates;
        if (typeof data.terrainSmoothing === 'boolean') state.terrainSmoothing = data.terrainSmoothing;
        if (typeof data.terrainEdgeBlend === 'boolean') state.terrainEdgeBlend = data.terrainEdgeBlend;
        if (typeof data.radarRange === 'number') state.radarRange = data.radarRange;
        if (typeof data.radarVerticalBand === 'number') state.radarVerticalBand = data.radarVerticalBand;
        if (typeof data.radarBlipScale === 'number') state.radarBlipScale = data.radarBlipScale;
        if (typeof data.radarCreationMin === 'number') state.radarCreationMin = data.radarCreationMin;
        if (typeof data.radarMode === 'string') state.radarMode = data.radarMode;
        if (typeof data.autoSyncSave === 'boolean') state.autoSyncSave = data.autoSyncSave;
        if (typeof data.syncInterval === 'number') state.syncInterval = data.syncInterval;
    } catch (e) {
        console.warn("Failed to load settings:", e);
    }
}

export function saveSettings() {
    try {
        const data = {
            layers: state.layers,
            subFilters: state.subFilters,
            mapOpacity: state.mapOpacity,
            showCoordinates: state.showCoordinates,
            terrainSmoothing: state.terrainSmoothing,
            terrainEdgeBlend: state.terrainEdgeBlend,
            radarRange: state.radarRange,
            radarVerticalBand: state.radarVerticalBand,
            radarBlipScale: state.radarBlipScale,
            radarCreationMin: state.radarCreationMin,
            radarMode: state.radarMode,
            autoSyncSave: state.autoSyncSave,
            syncInterval: state.syncInterval
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {}
}

export function setupLayerControls(elements) {
    const layerMap = [
        { id: 'layerLivePlayer', key: 'livePlayer' },
        { id: 'layerMapImage', key: 'mapImage' },
        { id: 'layerPOIs', key: 'pois' },
        { id: 'layerSchematics', key: 'schematics' },
        { id: 'layerCreations', key: 'creations' },
        { id: 'layerUnits', key: 'units' },
        { id: 'layerHarvestables', key: 'harvestables' },
        { id: 'layerGrid', key: 'grid' }
    ];

    layerMap.forEach(({ id, key }) => {
        const el = document.getElementById(id);
        if (el) {
            el.checked = state.layers[key];
            el.addEventListener('change', (e) => {
                state.layers[key] = e.target.checked;
                saveSettings();
                notifyStateChange('layer_toggle', { key, value: e.target.checked });
            });
        }
    });

    // Terrain Edge Blending & HD Smoothing Toggles
    const layerTerrainBlend = document.getElementById('layerTerrainBlend');
    if (layerTerrainBlend) {
        layerTerrainBlend.checked = state.terrainEdgeBlend !== false;
        layerTerrainBlend.addEventListener('change', async (e) => {
            state.terrainEdgeBlend = e.target.checked;
            saveSettings();
            notifyStateChange('terrain_blend_toggle', state.terrainEdgeBlend);
            if (window.TerrainLoader && typeof window.TerrainLoader.reRenderCurrentTerrain === 'function') {
                const res = await window.TerrainLoader.reRenderCurrentTerrain({ blendEdges: state.terrainEdgeBlend });
                if (res && res.dataUrl) {
                    setTerrainImageSource(res.dataUrl, res.seed);
                }
            }
        });
    }

    const layerTerrainSmooth = document.getElementById('layerTerrainSmooth');
    if (layerTerrainSmooth) {
        layerTerrainSmooth.checked = state.terrainSmoothing !== false;
        layerTerrainSmooth.addEventListener('change', (e) => {
            state.terrainSmoothing = e.target.checked;
            saveSettings();
            notifyStateChange('terrain_smooth_toggle', state.terrainSmoothing);
        });
    }

    // POI Accordion Collapse Handler
    const poiAccordion = document.getElementById('poiAccordion');
    const poiAccordionHeader = document.getElementById('poiAccordionHeader');
    if (poiAccordionHeader && poiAccordion) {
        poiAccordionHeader.addEventListener('click', () => {
            poiAccordion.classList.toggle('collapsed');
        });
    }

    // Sub-filters: POIs
    const poiMap = [
        { id: 'subPoiMechanic', key: 'mechanicStations' },
        { id: 'subPoiTrader', key: 'traders' },
        { id: 'subPoiPacking', key: 'packingStations' },
        { id: 'subPoiGrowlabs', key: 'growlabs' },
        { id: 'subPoiChemOil', key: 'chemOil' },
        { id: 'subPoiOther', key: 'other' }
    ];
    poiMap.forEach(({ id, key }) => {
        const el = document.getElementById(id);
        if (el && state.subFilters.pois) {
            el.checked = Boolean(state.subFilters.pois[key]);
            el.addEventListener('change', (e) => {
                state.subFilters.pois[key] = e.target.checked;
                saveSettings();
                notifyStateChange('subfilter_pois', state.subFilters.pois);
            });
        }
    });

    // Sub-filters: Units
    const unitMap = [
        { id: 'subFarmbots', key: 'farmbots' },
        { id: 'subHaybots', key: 'haybots' },
        { id: 'subTapebots', key: 'tapebots' },
        { id: 'subTotebots', key: 'totebots' },
        { id: 'subSeedbots', key: 'seedbots' },
        { id: 'subAnimals', key: 'animals' }
    ];
    unitMap.forEach(({ id, key }) => {
        const el = document.getElementById(id);
        if (el && state.subFilters.units) {
            el.checked = Boolean(state.subFilters.units[key]);
            el.addEventListener('change', (e) => {
                state.subFilters.units[key] = e.target.checked;
                saveSettings();
                notifyStateChange('subfilter_units', state.subFilters.units);
            });
        }
    });

    // Sub-filters: Harvestables
    const harvMap = [
        { id: 'subOil', key: 'oil' },
        { id: 'subCotton', key: 'cotton' },
        { id: 'subMinerals', key: 'minerals' },
        { id: 'subTrees', key: 'trees' },
        { id: 'subCrops', key: 'crops' },
        { id: 'subChemicals', key: 'chemicals' },
        { id: 'subFlowers', key: 'flowers' },
        { id: 'subOtherRes', key: 'other' }
    ];
    harvMap.forEach(({ id, key }) => {
        const el = document.getElementById(id);
        if (el && state.subFilters.harvestables) {
            el.checked = Boolean(state.subFilters.harvestables[key]);
            el.addEventListener('change', (e) => {
                state.subFilters.harvestables[key] = e.target.checked;
                saveSettings();
                notifyStateChange('subfilter_harvestables', state.subFilters.harvestables);
            });
        }
    });

    // Size Filter buttons
    document.querySelectorAll('.size-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.subFilters.creationsSize = btn.dataset.size || 'all';
            saveSettings();
            updateCreationBadge();
            notifyStateChange('subfilter_size', state.subFilters.creationsSize);
        });
    });

    // Auto-update creation badge on save loaded
    subscribe((type) => {
        if (type === 'save_loaded') {
            updateCreationBadge();
        }
    });

    // Opacity Slider
    const slider = elements.mapOpacitySlider;
    const valText = elements.mapOpacityVal;
    if (slider) {
        slider.value = Math.round(state.mapOpacity * 100);
        if (valText) valText.textContent = `${slider.value}%`;
        slider.addEventListener('input', (e) => {
            state.mapOpacity = parseInt(e.target.value) / 100;
            if (valText) valText.textContent = `${e.target.value}%`;
            saveSettings();
            notifyStateChange('opacity_change', state.mapOpacity);
        });
    }

    // Toggle All Layers
    if (elements.toggleAllLayers) {
        elements.toggleAllLayers.addEventListener('click', () => {
            const allEnabled = Object.values(state.layers).every(v => v);
            const newState = !allEnabled;
            Object.keys(state.layers).forEach(k => { state.layers[k] = newState; });
            layerMap.forEach(({ id, key }) => {
                const el = document.getElementById(id);
                if (el) el.checked = newState;
            });
            saveSettings();
            notifyStateChange('layer_toggle_all', newState);
        });
    }

    // Setup Tactical Radar Controls
    setupRadarControls();
}

export function setupRadarControls() {
    // 1. Range Buttons
    const rangeBtns = document.querySelectorAll('.radar-range-btn');
    rangeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            rangeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const range = parseInt(btn.dataset.range, 10) || 300;
            state.radarRange = range;
            saveSettings();
            notifyStateChange('radar_range_change', range);
        });
    });

    // 2. Quick Filter Icon Buttons
    const btnEnemies = document.getElementById('btnRadarEnemies');
    if (btnEnemies) {
        btnEnemies.addEventListener('click', () => {
            state.radarFilters.enemies = !state.radarFilters.enemies;
            btnEnemies.classList.toggle('active', state.radarFilters.enemies);
            saveSettings();
            notifyStateChange('radar_filters_change', state.radarFilters);
        });
    }

    const btnVehicles = document.getElementById('btnRadarVehicles');
    if (btnVehicles) {
        btnVehicles.addEventListener('click', () => {
            state.radarFilters.vehicles = !state.radarFilters.vehicles;
            btnVehicles.classList.toggle('active', state.radarFilters.vehicles);
            saveSettings();
            notifyStateChange('radar_filters_change', state.radarFilters);
        });
    }

    const btnPOIs = document.getElementById('btnRadarPOIs');
    if (btnPOIs) {
        btnPOIs.addEventListener('click', () => {
            state.radarFilters.pois = !state.radarFilters.pois;
            btnPOIs.classList.toggle('active', state.radarFilters.pois);
            saveSettings();
            notifyStateChange('radar_filters_change', state.radarFilters);
        });
    }

    // 3. Center Mode Toggle (Player vs Camera)
    const btnCenterToggle = document.getElementById('btnRadarCenterToggle');
    const modeBadge = document.getElementById('radarCenterMode');
    const toggleMode = () => {
        state.radarMode = state.radarMode === 'player' ? 'camera' : 'player';
        if (btnCenterToggle) btnCenterToggle.classList.toggle('active', state.radarMode === 'camera');
        saveSettings();
        notifyStateChange('radar_mode_change', state.radarMode);
    };

    if (btnCenterToggle) btnCenterToggle.addEventListener('click', toggleMode);
    if (modeBadge) modeBadge.addEventListener('click', toggleMode);

    // 4. Check if Radar telemetry proxy is installed
    checkAndSetupRadarInstaller();
}

export async function checkAndSetupRadarInstaller() {
    const overlay = document.getElementById('radarInstallOverlay');
    const desc = document.getElementById('radarInstallDesc');
    const btn = document.getElementById('btnInstallRadar');
    const btnBrowse = document.getElementById('btnBrowseGameDir');
    if (!overlay || !btn) return;

    if (window.electronAPI && typeof window.electronAPI.checkRadarInstalled === 'function') {
        try {
            const status = await window.electronAPI.checkRadarInstalled();
            if (!status.installed) {
                overlay.classList.remove('hidden');

                if (btnBrowse && typeof window.electronAPI.selectGameDirectory === 'function') {
                    btnBrowse.onclick = async () => {
                        const sel = await window.electronAPI.selectGameDirectory();
                        const { showToast } = await import('../../ui/toasts.js');
                        if (sel && sel.success && sel.gameDir) {
                            showToast("Game Folder Selected", sel.gameDir, "success", 4000);
                            desc.textContent = `Found Scrap Mechanic in ${sel.gameDir.split('/').pop()}`;
                            btn.click();
                        } else if (sel && sel.error) {
                            showToast("Invalid Game Folder", sel.error, "error", 6000);
                        }
                    };
                }

                btn.onclick = async () => {
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> INSTALLING...';
                    const res = await window.electronAPI.installRadarFiles();
                    const { showToast } = await import('../../ui/toasts.js');
                    if (res && res.success) {
                        desc.textContent = "Radar installed! Click below to restart Scrap Mechanic and activate live tracking.";
                        btn.disabled = false;
                        btn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> RESTART GAME';
                        btn.style.background = '#16a34a';
                        if (btnBrowse) btnBrowse.style.display = 'none';
                        showToast("Radar Installed!", "Click 'Restart Game' to launch Scrap Mechanic with radar telemetry.", "success", 6000);

                        btn.onclick = async () => {
                            btn.disabled = true;
                            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> RESTARTING...';
                            if (window.electronAPI && typeof window.electronAPI.restartGame === 'function') {
                                await window.electronAPI.restartGame();
                            }
                            showToast("Launching Scrap Mechanic", "Game restarting via Steam...", "info", 5000);
                            btn.innerHTML = '<i class="fa-solid fa-check"></i> GAME LAUNCHED';
                            setTimeout(() => {
                                overlay.classList.add('hidden');
                            }, 4000);
                        };
                    } else {
                        btn.disabled = false;
                        btn.innerHTML = '<i class="fa-solid fa-download"></i> RETRY INSTALL';
                        showToast("Game Folder Not Found", (res && res.error) || "Click 'Browse Game Folder' to select manually.", "warning", 6000);
                        if (btnBrowse) {
                            btnBrowse.style.border = '1px solid #22c55e';
                            btnBrowse.style.animation = 'radarDangerPulse 1s infinite alternate';
                        }
                    }
                };
            } else {
                overlay.classList.add('hidden');
            }
        } catch (e) {
            console.warn("Radar install check error:", e);
        }
    }
}

export function updateCreationBadge() {
    const countCreations = document.getElementById('countCreations');
    if (!countCreations || !state.mapData || !state.mapData.creations) return;
    const filter = state.subFilters.creationsSize;
    if (filter === 'all') {
        countCreations.textContent = state.mapData.creations.length;
        return;
    }
    let count = 0;
    for (const c of state.mapData.creations) {
        if (filter === 'small' && c.blocks >= 50) continue;
        if (filter === 'medium' && (c.blocks < 50 || c.blocks > 500)) continue;
        if (filter === 'large' && c.blocks <= 500) continue;
        count++;
    }
    countCreations.textContent = count;
}

export function setupSettingsModal() {
    const btnOpen = document.getElementById('settingsBtn');
    const modal = document.getElementById('settingsModal');
    const btnClose = document.getElementById('closeSettingsModal');

    if (!btnOpen || !modal) return;

    function openModal() {
        modal.classList.add('open');
        syncSettingsToUI();
    }

    function closeModal() {
        modal.classList.remove('open');
    }

    btnOpen.addEventListener('click', openModal);
    if (btnClose) btnClose.addEventListener('click', closeModal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('open')) {
            closeModal();
        }
    });

    async function syncSettingsToUI() {
        // 1. Radar Range
        const cfgRadarRange = document.getElementById('cfgRadarRange');
        if (cfgRadarRange) cfgRadarRange.value = String(state.radarRange || 150);

        // 2. Radar Vertical Band
        const cfgRadarVerticalBand = document.getElementById('cfgRadarVerticalBand');
        if (cfgRadarVerticalBand) cfgRadarVerticalBand.value = String(state.radarVerticalBand || 20);

        // 3. Radar Creation Min
        const cfgRadarCreationMin = document.getElementById('cfgRadarCreationMin');
        if (cfgRadarCreationMin) cfgRadarCreationMin.value = String(state.radarCreationMin || 50);

        // 4. Radar Center Mode
        const cfgRadarCenterMode = document.getElementById('cfgRadarCenterMode');
        if (cfgRadarCenterMode) cfgRadarCenterMode.value = state.radarMode || 'player';

        // 5. Radar Blip Scale
        const cfgRadarBlipScale = document.getElementById('cfgRadarBlipScale');
        if (cfgRadarBlipScale) cfgRadarBlipScale.value = String(state.radarBlipScale || 1.25);

        // 6. Game Path Display
        const cfgGamePathDisplay = document.getElementById('cfgGamePathDisplay');
        if (cfgGamePathDisplay && window.electronAPI && typeof window.electronAPI.getGameDirectory === 'function') {
            try {
                const gameDir = await window.electronAPI.getGameDirectory();
                cfgGamePathDisplay.textContent = gameDir || 'Not detected (Start game or browse)';
            } catch (e) {
                cfgGamePathDisplay.textContent = 'Auto-detecting...';
            }
        }

        // 6. Map Opacity
        const cfgMapOpacity = document.getElementById('cfgMapOpacity');
        const cfgMapOpacityVal = document.getElementById('cfgMapOpacityVal');
        if (cfgMapOpacity) {
            cfgMapOpacity.value = String(state.mapOpacity || 0.9);
            if (cfgMapOpacityVal) cfgMapOpacityVal.textContent = `${Math.round((state.mapOpacity || 0.9) * 100)}%`;
        }

        // 7. Terrain Smoothing
        const cfgTerrainSmooth = document.getElementById('cfgTerrainSmooth');
        if (cfgTerrainSmooth) cfgTerrainSmooth.checked = state.terrainSmoothing !== false;

        // 8. Terrain Blend
        const cfgTerrainBlend = document.getElementById('cfgTerrainBlend');
        if (cfgTerrainBlend) cfgTerrainBlend.checked = state.terrainEdgeBlend !== false;

        // 9. Show Coordinates
        const cfgShowCoordinates = document.getElementById('cfgShowCoordinates');
        if (cfgShowCoordinates) cfgShowCoordinates.checked = state.showCoordinates === true;

        // 10. Save Auto-Sync
        const cfgAutoSyncSave = document.getElementById('cfgAutoSyncSave');
        if (cfgAutoSyncSave) cfgAutoSyncSave.checked = state.autoSyncSave !== false;

        const cfgSyncInterval = document.getElementById('cfgSyncInterval');
        if (cfgSyncInterval) cfgSyncInterval.value = String(state.syncInterval || 5000);
    }

    // Attach Event Listeners to Settings Controls
    const cfgRadarRange = document.getElementById('cfgRadarRange');
    if (cfgRadarRange) {
        cfgRadarRange.addEventListener('change', (e) => {
            const val = parseInt(e.target.value, 10);
            state.radarRange = val;
            const rangeBtns = document.querySelectorAll('.radar-range-btn');
            rangeBtns.forEach(b => {
                b.classList.toggle('active', parseInt(b.dataset.range, 10) === val);
            });
            saveSettings();
            notifyStateChange('radar_range', val);
        });
    }

    const cfgRadarVerticalBand = document.getElementById('cfgRadarVerticalBand');
    if (cfgRadarVerticalBand) {
        cfgRadarVerticalBand.addEventListener('change', (e) => {
            state.radarVerticalBand = parseInt(e.target.value, 10);
            saveSettings();
            notifyStateChange('radar_vertical_band', state.radarVerticalBand);
        });
    }

    const cfgRadarCreationMin = document.getElementById('cfgRadarCreationMin');
    if (cfgRadarCreationMin) {
        cfgRadarCreationMin.addEventListener('change', (e) => {
            state.radarCreationMin = parseInt(e.target.value, 10);
            saveSettings();
            notifyStateChange('radar_creation_min', state.radarCreationMin);
        });
    }

    const cfgRadarCenterMode = document.getElementById('cfgRadarCenterMode');
    if (cfgRadarCenterMode) {
        cfgRadarCenterMode.addEventListener('change', (e) => {
            state.radarMode = e.target.value;
            const centerModeBadge = document.getElementById('radarCenterMode');
            if (centerModeBadge) {
                centerModeBadge.textContent = state.radarMode === 'player' ? 'SRC: PLAYER' : 'SRC: CAMERA';
                centerModeBadge.className = `radar-mode-badge ${state.radarMode}`;
            }
            saveSettings();
            notifyStateChange('radar_mode', state.radarMode);
        });
    }

    const cfgRadarBlipScale = document.getElementById('cfgRadarBlipScale');
    if (cfgRadarBlipScale) {
        cfgRadarBlipScale.addEventListener('change', (e) => {
            state.radarBlipScale = parseFloat(e.target.value);
            saveSettings();
            notifyStateChange('radar_blip_scale', state.radarBlipScale);
        });
    }

    const cfgBtnBrowseGame = document.getElementById('cfgBtnBrowseGame');
    if (cfgBtnBrowseGame && window.electronAPI && typeof window.electronAPI.selectGameDirectory === 'function') {
        cfgBtnBrowseGame.addEventListener('click', async () => {
            const sel = await window.electronAPI.selectGameDirectory();
            const { showToast } = await import('../../ui/toasts.js');
            if (sel && sel.success && sel.gameDir) {
                const display = document.getElementById('cfgGamePathDisplay');
                if (display) display.textContent = sel.gameDir;
                showToast("Game Path Updated", sel.gameDir, "success", 4000);
            } else if (sel && sel.error) {
                showToast("Invalid Directory", sel.error, "error", 6000);
            }
        });
    }

    const cfgBtnReinstallRadar = document.getElementById('cfgBtnReinstallRadar');
    if (cfgBtnReinstallRadar && window.electronAPI && typeof window.electronAPI.installRadarFiles === 'function') {
        cfgBtnReinstallRadar.addEventListener('click', async () => {
            cfgBtnReinstallRadar.disabled = true;
            cfgBtnReinstallRadar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Installing...';
            const res = await window.electronAPI.installRadarFiles();
            const { showToast } = await import('../../ui/toasts.js');
            if (res && res.success) {
                showToast("Radar Reinstalled", "Telemetry bridge files updated in game folder.", "success", 5000);
            } else {
                showToast("Reinstall Failed", (res && res.error) || "Could not copy files", "error", 5000);
            }
            cfgBtnReinstallRadar.disabled = false;
            cfgBtnReinstallRadar.innerHTML = '<i class="fa-solid fa-download"></i> Reinstall Radar';
        });
    }

    const cfgMapOpacity = document.getElementById('cfgMapOpacity');
    const cfgMapOpacityVal = document.getElementById('cfgMapOpacityVal');
    if (cfgMapOpacity) {
        cfgMapOpacity.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            state.mapOpacity = val;
            if (cfgMapOpacityVal) cfgMapOpacityVal.textContent = `${Math.round(val * 100)}%`;
            saveSettings();
            notifyStateChange('opacity_change', val);
        });
    }

    const cfgTerrainSmooth = document.getElementById('cfgTerrainSmooth');
    if (cfgTerrainSmooth) {
        cfgTerrainSmooth.addEventListener('change', (e) => {
            state.terrainSmoothing = e.target.checked;
            const sideSwitch = document.getElementById('layerTerrainSmooth');
            if (sideSwitch) sideSwitch.checked = e.target.checked;
            saveSettings();
            notifyStateChange('terrain_smooth_toggle', state.terrainSmoothing);
        });
    }

    const cfgTerrainBlend = document.getElementById('cfgTerrainBlend');
    if (cfgTerrainBlend) {
        cfgTerrainBlend.addEventListener('change', async (e) => {
            state.terrainEdgeBlend = e.target.checked;
            const sideSwitch = document.getElementById('layerTerrainBlend');
            if (sideSwitch) sideSwitch.checked = e.target.checked;
            saveSettings();
            notifyStateChange('terrain_blend_toggle', state.terrainEdgeBlend);
            if (window.TerrainLoader && typeof window.TerrainLoader.reRenderCurrentTerrain === 'function') {
                const res = await window.TerrainLoader.reRenderCurrentTerrain({ blendEdges: state.terrainEdgeBlend });
                if (res && res.dataUrl) {
                    setTerrainImageSource(res.dataUrl, res.seed);
                }
            }
        });
    }

    const cfgShowCoordinates = document.getElementById('cfgShowCoordinates');
    if (cfgShowCoordinates) {
        cfgShowCoordinates.addEventListener('change', (e) => {
            state.showCoordinates = e.target.checked;
            const coordsBtn = document.getElementById('toggleCoordsBtn');
            if (coordsBtn) coordsBtn.classList.toggle('active', e.target.checked);
            const hud = document.getElementById('coordsHUD');
            if (hud) hud.classList.toggle('hidden', !e.target.checked);
            saveSettings();
            notifyStateChange('coords_toggle', state.showCoordinates);
        });
    }

    const cfgAutoSyncSave = document.getElementById('cfgAutoSyncSave');
    if (cfgAutoSyncSave) {
        cfgAutoSyncSave.addEventListener('change', (e) => {
            state.autoSyncSave = e.target.checked;
            saveSettings();
            notifyStateChange('auto_sync_save', state.autoSyncSave);
        });
    }

    const cfgSyncInterval = document.getElementById('cfgSyncInterval');
    if (cfgSyncInterval) {
        cfgSyncInterval.addEventListener('change', (e) => {
            state.syncInterval = parseInt(e.target.value, 10);
            saveSettings();
            notifyStateChange('sync_interval', state.syncInterval);
        });
    }
}
