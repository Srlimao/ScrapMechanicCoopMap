// LocalStorage settings persistence and layer toggle synchronizer
import { state, notifyStateChange, subscribe } from '../../core/state.js';

const STORAGE_KEY = 'sm_tactical_map_settings_v6';

export function loadSettings() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);
        if (data.layers) Object.assign(state.layers, data.layers);
        if (data.subFilters) Object.assign(state.subFilters, data.subFilters);
        if (typeof data.mapOpacity === 'number') state.mapOpacity = data.mapOpacity;
        if (typeof data.showCoordinates === 'boolean') state.showCoordinates = data.showCoordinates;
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
            showCoordinates: state.showCoordinates
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
        { id: 'subTrees', key: 'trees' }
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
