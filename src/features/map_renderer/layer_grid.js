// Coordinate grid lines, cell markers, and origin axes
// OPTIMIZATION (⚡ Bolt): In-line world-to-screen coordinate math and zero-allocation rendering loop.
// Pre-computing screen constants and inlining math eliminates intermediate `{ x, y }` object allocations
// on every grid line per frame during camera movement or zooming.
import { state } from '../../core/state.js';
import { CELL_SIZE, MAP_MIN_X, MAP_MAX_X, MAP_MIN_Y, MAP_MAX_Y } from '../../core/constants.js';

export function renderGridLayer(ctx, width, height) {
    if (!state.layers.grid) return;

    ctx.save();

    // Determine grid step based on current zoom
    let step = CELL_SIZE * 4; // 256m (4 cells) by default
    if (state.zoom > 0.15) step = CELL_SIZE; // 64m (1 cell)
    if (state.zoom < 0.02) step = CELL_SIZE * 16; // 1024m (16 cells)

    const halfW = width * 0.5;
    const halfH = height * 0.5;

    const minX = Math.max(MAP_MIN_X, Math.floor((state.cameraX - halfW / state.zoom) / step) * step);
    const maxX = Math.min(MAP_MAX_X, Math.ceil((state.cameraX + halfW / state.zoom) / step) * step);
    const minY = Math.max(MAP_MIN_Y, Math.floor((state.cameraY - halfH / state.zoom) / step) * step);
    const maxY = Math.min(MAP_MAX_Y, Math.ceil((state.cameraY + halfH / state.zoom) / step) * step);

    // Pre-calculate fixed screen y/x bounds for grid lines to avoid repetitive calculations
    const minYScreen = (state.cameraY - MAP_MIN_Y) * state.zoom + halfH;
    const maxYScreen = (state.cameraY - MAP_MAX_Y) * state.zoom + halfH;
    const minXScreen = (MAP_MIN_X - state.cameraX) * state.zoom + halfW;
    const maxXScreen = (MAP_MAX_X - state.cameraX) * state.zoom + halfW;

    // Subtle grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;

    ctx.beginPath();
    for (let x = minX; x <= maxX; x += step) {
        const screenX = (x - state.cameraX) * state.zoom + halfW;
        ctx.moveTo(screenX, maxYScreen);
        ctx.lineTo(screenX, minYScreen);
    }
    for (let y = minY; y <= maxY; y += step) {
        const screenY = (state.cameraY - y) * state.zoom + halfH;
        ctx.moveTo(minXScreen, screenY);
        ctx.lineTo(maxXScreen, screenY);
    }
    ctx.stroke();

    // Major origin axes (X=0, Y=0)
    ctx.strokeStyle = 'rgba(255, 122, 0, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const x0Screen = (0 - state.cameraX) * state.zoom + halfW;
    ctx.moveTo(x0Screen, maxYScreen);
    ctx.lineTo(x0Screen, minYScreen);

    const y0Screen = (state.cameraY - 0) * state.zoom + halfH;
    ctx.moveTo(minXScreen, y0Screen);
    ctx.lineTo(maxXScreen, y0Screen);
    ctx.stroke();

    ctx.restore();
}
