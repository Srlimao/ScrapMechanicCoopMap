// Quick Jump Bookmarks Bar & Custom Waypoint Engine
import { state, notifyStateChange } from '../../core/state.js';
import { jumpToLocation } from '../map_renderer/camera.js';
import { showToast } from '../../ui/toasts.js';

const STORAGE_KEY_WAYPOINTS = 'sm_custom_waypoints_v1';

function triggerBtnPulse(btn) {
    if (!btn) return;
    btn.classList.add('active-pulse');
    setTimeout(() => {
        btn.classList.remove('active-pulse');
    }, 450);
}

export function loadCustomWaypoints() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY_WAYPOINTS);
        if (raw) {
            const list = JSON.parse(raw);
            if (Array.isArray(list)) {
                state.customBookmarks = list;
                notifyStateChange('custom_waypoints_loaded', state.customBookmarks);
            }
        }
    } catch (e) {
        console.warn("[Bookmarks] Failed to load custom waypoints:", e);
    }
}

export function saveCustomWaypoints() {
    try {
        localStorage.setItem(STORAGE_KEY_WAYPOINTS, JSON.stringify(state.customBookmarks || []));
    } catch (e) {
        console.warn("[Bookmarks] Failed to save custom waypoints:", e);
    }
}

export function addCustomWaypoint(name, x, y, options = {}) {
    const wp = {
        id: `wp_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        name: name || `Waypoint (${Math.round(x)}, ${Math.round(y)})`,
        x: Number(x),
        y: Number(y),
        z: options.z || 0,
        icon: options.icon || 'fa-location-dot',
        color: options.color || '#00e5ff',
        category: 'custom_waypoint',
        createdAt: Date.now()
    };

    if (!Array.isArray(state.customBookmarks)) {
        state.customBookmarks = [];
    }

    state.customBookmarks.push(wp);
    saveCustomWaypoints();
    notifyStateChange('custom_waypoints_updated', state.customBookmarks);
    showToast("Waypoint Saved", `Pinned "${wp.name}" to your map.`, "success");
    return wp;
}

export function removeCustomWaypoint(id) {
    if (!Array.isArray(state.customBookmarks)) return;
    const idx = state.customBookmarks.findIndex(w => w.id === id);
    if (idx !== -1) {
        const removed = state.customBookmarks.splice(idx, 1)[0];
        saveCustomWaypoints();
        notifyStateChange('custom_waypoints_updated', state.customBookmarks);
        showToast("Waypoint Removed", `Removed "${removed.name}".`, "info");
    }
}

export function setupBookmarks(elements) {
    loadCustomWaypoints();

    // 1. Jump to Player
    if (elements.bmPlayer) {
        elements.bmPlayer.addEventListener('click', () => {
            triggerBtnPulse(elements.bmPlayer);
            if (state.livePlayer && state.livePlayer.online && state.livePlayer.x !== null) {
                jumpToLocation(state.livePlayer.x, state.livePlayer.y, 0.22, 400);
                showToast("Jumped to Player", `Live position (${state.livePlayer.x.toFixed(0)}, ${state.livePlayer.y.toFixed(0)})`, "info");
            } else {
                showToast("Player Offline", "Launch Scrap Mechanic to track live player position.", "warning");
            }
        });
    }

    // 2. Jump to Mechanic Station
    if (elements.bmMechanic) {
        elements.bmMechanic.addEventListener('click', () => {
            triggerBtnPulse(elements.bmMechanic);
            jumpToLocation(-1856, -1664, 0.18, 400);
            showToast("Mechanic Station", "Centered view on primary Mechanic Station base.", "info");
        });
    }

    // 3. Jump to Trader Hideout
    if (elements.bmTrader) {
        elements.bmTrader.addEventListener('click', () => {
            triggerBtnPulse(elements.bmTrader);
            jumpToLocation(-1024, -1024, 0.18, 400);
            showToast("Trader Hideout", "Centered view on Farmer's Hideout.", "info");
        });
    }

    // 4. Jump to Packing Station
    if (elements.bmPacking) {
        elements.bmPacking.addEventListener('click', () => {
            triggerBtnPulse(elements.bmPacking);
            jumpToLocation(-1088, -1472, 0.18, 400);
            showToast("Packing Station", "Centered view on Vegetable Packing Station.", "info");
        });
    }

    // 5. Jump to Largest Vehicle / Creation
    if (elements.bmCreations) {
        elements.bmCreations.addEventListener('click', () => {
            triggerBtnPulse(elements.bmCreations);
            if (state.mapData && state.mapData.creations && state.mapData.creations.length > 0) {
                const largest = [...state.mapData.creations].sort((a, b) => (b.blocks || 0) - (a.blocks || 0))[0];
                jumpToLocation(largest.x, largest.y, 0.22, 400);
                showToast("Largest Vehicle", `Creation #${largest.id} with ${largest.blocks || 0} blocks.`, "info");
            } else {
                showToast("No Creations", "Load a survival save file containing built vehicles.", "warning");
            }
        });
    }

    // 6. Jump to Bot Threat / Bosses
    if (elements.bmBosses) {
        elements.bmBosses.addEventListener('click', () => {
            triggerBtnPulse(elements.bmBosses);
            if (state.mapData && state.mapData.units) {
                const boss = state.mapData.units.find(u => (u.category || '').toLowerCase() === 'boss' || (u.name || '').toLowerCase().includes('farmbot'));
                if (boss) {
                    jumpToLocation(boss.x, boss.y, 0.22, 400);
                    showToast("Farmbot Threat", `Jumped to Farmbot Boss at (${boss.x.toFixed(0)}, ${boss.y.toFixed(0)})`, "info");
                    return;
                }
            }
            showToast("No Bosses Detected", "No high-threat Farmbot bosses found in save scan.", "info");
        });
    }
}
