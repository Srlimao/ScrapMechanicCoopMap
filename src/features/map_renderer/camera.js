// Camera controls, viewport panning, smooth zoom, and dragging
import { state, notifyStateChange } from '../../core/state.js';
import { screenToWorld } from '../../core/coords.js';
import { MAP_MIN_X, MAP_MAX_X, MAP_MIN_Y, MAP_MAX_Y } from '../../core/constants.js';

let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let cameraStartX = 0;
let cameraStartY = 0;
let mainCanvas = null;

export function setupCameraControls(canvas, viewport, requestRender) {
    mainCanvas = canvas;
    viewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const worldBefore = screenToWorld(mouseX, mouseY, canvas.width, canvas.height);

        const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
        // Keep minimum zoom at 0.040 to prevent shrinking into empty void
        const newZoom = Math.min(3.5, Math.max(0.040, state.zoom * zoomFactor));

        if (newZoom !== state.zoom) {
            state.zoom = newZoom;
            // Center zoom around mouse point
            state.cameraX = worldBefore.x - (mouseX - canvas.width / 2) / state.zoom;
            state.cameraY = worldBefore.y + (mouseY - canvas.height / 2) / state.zoom;
            notifyStateChange('camera_zoom', state.zoom);
            requestRender();
        }
    }, { passive: false });

    viewport.addEventListener('mousedown', (e) => {
        if (e.button === 0 || e.button === 1) { // Left or middle click
            isDragging = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            cameraStartX = state.cameraX;
            cameraStartY = state.cameraY;
            viewport.style.cursor = 'grabbing';
        }
    });

    window.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        state.mouseScreenPos = { x: mouseX, y: mouseY };
        state.mouseWorldPos = screenToWorld(mouseX, mouseY, canvas.width, canvas.height);

        if (isDragging) {
            const dx = (e.clientX - dragStartX) / state.zoom;
            const dy = (e.clientY - dragStartY) / state.zoom;

            state.cameraX = cameraStartX - dx;
            state.cameraY = cameraStartY + dy;
            state.followPlayer = false; // Disable follow on user pan
            requestRender();
        }
    });

    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            viewport.style.cursor = 'grab';
        }
    });
}

export function jumpToLocation(worldX, worldY, targetZoom = null) {
    state.cameraX = worldX;
    state.cameraY = worldY;
    if (targetZoom !== null) state.zoom = targetZoom;
    state.followPlayer = false;
    notifyStateChange('camera_jump', { x: worldX, y: worldY });
}

export function resetCameraView(canvas = null) {
    const c = canvas || mainCanvas || document.getElementById('mapCanvas');
    state.cameraX = 0;
    state.cameraY = 0;

    if (c && c.width && c.height) {
        // Fit terrain neatly inside canvas viewport with 40px margin
        const pad = 40;
        const fitX = (c.width - pad) / (MAP_MAX_X - MAP_MIN_X);
        const fitY = (c.height - pad) / (MAP_MAX_Y - MAP_MIN_Y);
        state.zoom = Math.max(0.08, Math.min(fitX, fitY, 0.25));
    } else {
        state.zoom = 0.12;
    }

    state.followPlayer = false;
    notifyStateChange('camera_reset', null);
}
