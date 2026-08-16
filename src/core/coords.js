// Coordinate conversion utilities for Scrap Mechanic Map
import { state } from './state.js';
import { CELL_SIZE } from './constants.js';

export function worldToScreen(worldX, worldY, canvasWidth, canvasHeight) {
    const screenX = (worldX - state.cameraX) * state.zoom + canvasWidth / 2;
    const screenY = (state.cameraY - worldY) * state.zoom + canvasHeight / 2; // Inverted Y for 2D Canvas
    return { x: screenX, y: screenY };
}

export function screenToWorld(screenX, screenY, canvasWidth, canvasHeight) {
    const worldX = (screenX - canvasWidth / 2) / state.zoom + state.cameraX;
    const worldY = state.cameraY - (screenY - canvasHeight / 2) / state.zoom;
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
