// Camera controls, viewport panning, smooth zoom, and dragging
import { state, notifyStateChange } from '../../core/state.js';
import { screenToWorld } from '../../core/coords.js';

let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let cameraStartX = 0;
let cameraStartY = 0;

export function setupCameraControls(canvas, viewport, requestRender) {
    viewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const worldBefore = screenToWorld(mouseX, mouseY, canvas.width, canvas.height);

        const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
        const newZoom = Math.min(2.5, Math.max(0.008, state.zoom * zoomFactor));

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

export function resetCameraView() {
    state.cameraX = 0;
    state.cameraY = 0;
    state.zoom = 0.04;
    state.followPlayer = false;
    notifyStateChange('camera_reset', null);
}
