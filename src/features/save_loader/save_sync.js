// Save synchronizer & file input handler
import { decodeSaveBuffer } from './sqlite_decoder.js';
import { showToast } from '../../ui/toasts.js';
import { state } from '../../core/state.js';
import { broadcastSquadEntities } from '../squad/relay_client.js';

let isAutoSyncRegistered = false;

export function initAutoSyncListener() {
    if (isAutoSyncRegistered) return;
    if (window.electronAPI && typeof window.electronAPI.onActiveSaveUpdated === 'function') {
        window.electronAPI.onActiveSaveUpdated(async (saveData) => {
            if (saveData && saveData.data) {
                console.log(`[AutoSync] Received save update: ${saveData.filename}`);
                try {
                    const mapData = await decodeSaveBuffer(saveData.data, saveData.filename);
                    showToast(
                        "Auto-Synced Save",
                        `Updated from Scrap Mechanic: ${mapData?.creations?.length || 0} creations active.`,
                        "info",
                        3500
                    );

                    // Broadcast updated entities to squad if connected
                    if (state.squad.connected && state.squad.roomCode && mapData) {
                        broadcastSquadEntities(mapData);
                    }
                } catch (err) {
                    console.warn("[AutoSync] Error decoding auto-synced save:", err);
                }
            }
        });
        isAutoSyncRegistered = true;
    }
}

export async function syncActiveSave(isInitial = false) {
    initAutoSyncListener();

    if (!isInitial) {
        showToast("Syncing Save", "Reading latest Scrap Mechanic save file...", "loading", 2000);
    }

    try {
        if (window.electronAPI && typeof window.electronAPI.readActiveSave === 'function') {
            const res = await window.electronAPI.readActiveSave();
            if (res.success && res.data) {
                const mapData = await decodeSaveBuffer(res.data, res.filename || 'active_save.db');
                if (state.squad.connected && state.squad.roomCode && mapData) {
                    broadcastSquadEntities(mapData);
                }
                return;
            }
        }

        // Web Fallback
        const resp = await fetch('/api/active_save?t=' + Date.now());
        if (resp.ok) {
            const buffer = await resp.arrayBuffer();
            const filename = resp.headers.get('X-Save-Name') || 'active_save.db';
            const mapData = await decodeSaveBuffer(buffer, filename);
            if (state.squad.connected && state.squad.roomCode && mapData) {
                broadcastSquadEntities(mapData);
            }
        }
    } catch (e) {
        if (!isInitial) {
            showToast("Sync Notice", "No active save available to auto-sync. Please upload a .db file.", "info");
        }
    }
}

export function setupFileUploadHandlers(uploadBtn, fileInput, dropOverlay) {
    initAutoSyncListener();

    if (uploadBtn && fileInput) {
        uploadBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const buffer = await file.arrayBuffer();
                    await decodeSaveBuffer(buffer, file.name);
                } catch (err) {
                    showToast("Load Error", `Failed to parse ${file.name}: ${err.message}`, "error");
                }
            }
        });
    }

    // Drag & Drop
    window.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (dropOverlay) dropOverlay.classList.add('active');
    });

    window.addEventListener('dragleave', (e) => {
        if (e.relatedTarget === null && dropOverlay) {
            dropOverlay.classList.remove('active');
        }
    });

    window.addEventListener('drop', async (e) => {
        e.preventDefault();
        if (dropOverlay) dropOverlay.classList.remove('active');

        const file = e.dataTransfer.files[0];
        if (file && file.name.toLowerCase().endsWith('.db')) {
            try {
                const buffer = await file.arrayBuffer();
                await decodeSaveBuffer(buffer, file.name);
            } catch (err) {
                showToast("Load Error", `Failed to parse ${file.name}: ${err.message}`, "error");
            }
        }
    });
}
