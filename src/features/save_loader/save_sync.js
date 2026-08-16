// Save synchronizer & file input handler
import { decodeSaveBuffer } from './sqlite_decoder.js';
import { showToast } from '../../ui/toasts.js';

export async function syncActiveSave(isInitial = false) {
    if (!isInitial) {
        showToast("Syncing Save", "Reading latest Scrap Mechanic save file...", "loading", 2000);
    }

    try {
        if (window.electronAPI && typeof window.electronAPI.readActiveSave === 'function') {
            const res = await window.electronAPI.readActiveSave();
            if (res.success && res.data) {
                await decodeSaveBuffer(res.data, res.filename || 'active_save.db');
                return;
            }
        }

        // Web Fallback
        const resp = await fetch('/api/active_save?t=' + Date.now());
        if (resp.ok) {
            const buffer = await resp.arrayBuffer();
            const filename = resp.headers.get('X-Save-Name') || 'active_save.db';
            await decodeSaveBuffer(buffer, filename);
        }
    } catch (e) {
        if (!isInitial) {
            showToast("Sync Notice", "No active save available to auto-sync. Please upload a .db file.", "info");
        }
    }
}

export function setupFileUploadHandlers(uploadBtn, fileInput, dropOverlay) {
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
