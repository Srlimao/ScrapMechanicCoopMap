// Quick Jump Bookmarks Bar
import { state } from '../../core/state.js';
import { jumpToLocation } from '../map_renderer/camera.js';
import { showToast } from '../../ui/toasts.js';

export function setupBookmarks(elements) {
    // 1. Jump to Player
    if (elements.bmPlayer) {
        elements.bmPlayer.addEventListener('click', () => {
            if (state.livePlayer.online) {
                jumpToLocation(state.livePlayer.x, state.livePlayer.y, 0.2);
                showToast("Jumped to Player", `Player at (${state.livePlayer.x}, ${state.livePlayer.y})`, "info");
            } else {
                showToast("Player Offline", "Launch Scrap Mechanic to track live player.", "warning");
            }
        });
    }

    // 2. Jump to Mechanic Station
    if (elements.bmMechanic) {
        elements.bmMechanic.addEventListener('click', () => {
            jumpToLocation(-1856, -1664, 0.15);
            showToast("Mechanic Station", "Centered view on primary Mechanic Station.", "info");
        });
    }

    // 3. Jump to Trader Hideout
    if (elements.bmTrader) {
        elements.bmTrader.addEventListener('click', () => {
            jumpToLocation(-1024, -1024, 0.15);
            showToast("Trader Hideout", "Centered view on Farmer's Hideout.", "info");
        });
    }

    // 4. Jump to Packing Station
    if (elements.bmPacking) {
        elements.bmPacking.addEventListener('click', () => {
            jumpToLocation(-1088, -1472, 0.15);
            showToast("Packing Station", "Centered view on Vegetable Packing Station.", "info");
        });
    }

    // 5. Jump to Largest Vehicle / Creation
    if (elements.bmCreations) {
        elements.bmCreations.addEventListener('click', () => {
            if (state.mapData.creations && state.mapData.creations.length > 0) {
                const largest = [...state.mapData.creations].sort((a, b) => b.blocks - a.blocks)[0];
                jumpToLocation(largest.x, largest.y, 0.2);
                showToast("Largest Vehicle", `Creation #${largest.id} with ${largest.blocks} blocks.`, "info");
            } else {
                showToast("No Creations", "Upload a save file containing vehicles.", "warning");
            }
        });
    }

    // 6. Jump to Bot Threat / Bosses
    if (elements.bmBosses) {
        elements.bmBosses.addEventListener('click', () => {
            const boss = state.mapData.units.find(u => u.category === 'boss');
            if (boss) {
                jumpToLocation(boss.x, boss.y, 0.2);
                showToast("Farmbot Threat", `Jumped to Farmbot Boss at (${boss.x}, ${boss.y})`, "info");
            } else {
                showToast("No Bosses Found", "No active Farmbot bosses in save file.", "info");
            }
        });
    }
}
