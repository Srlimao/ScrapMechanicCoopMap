// Coordinate conversion utilities for Scrap Mechanic Map
import { state } from './state.js';
import { CELL_SIZE } from './constants.js';

// OPTIMIZATION (⚡ Bolt): Optional 'out' parameter allows passing a reusable target object
// to eliminate object allocations in 60 FPS animation render loops.
export function worldToScreen(worldX, worldY, canvasWidth, canvasHeight, out = null) {
    const screenX = (worldX - state.cameraX) * state.zoom + canvasWidth / 2;
    const screenY = (state.cameraY - worldY) * state.zoom + canvasHeight / 2; // Inverted Y for 2D Canvas
    if (out) {
        out.x = screenX;
        out.y = screenY;
        return out;
    }
    return { x: screenX, y: screenY };
}

// OPTIMIZATION (⚡ Bolt): Optional 'out' parameter allows passing a reusable target object
// to eliminate object allocations in high-frequency mousemove events and HUD projection loops.
export function screenToWorld(screenX, screenY, canvasWidth, canvasHeight, out = null) {
    const worldX = (screenX - canvasWidth / 2) / state.zoom + state.cameraX;
    const worldY = state.cameraY - (screenY - canvasHeight / 2) / state.zoom;
    if (out) {
        out.x = worldX;
        out.y = worldY;
        return out;
    }
    return { x: worldX, y: worldY };
}

export function worldToCell(worldX, worldY) {
    const cellX = Math.floor(worldX / CELL_SIZE);
    const cellY = Math.floor(worldY / CELL_SIZE);
    return { cellX, cellY };
}

export function calculateDistance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

export function formatCoords(x, y, z = null) {
    if (z !== null && z !== undefined) {
        return `X: ${x.toFixed(1)}  Y: ${y.toFixed(1)}  Z: ${z.toFixed(1)}`;
    }
    return `X: ${x.toFixed(1)}  Y: ${y.toFixed(1)}`;
}
