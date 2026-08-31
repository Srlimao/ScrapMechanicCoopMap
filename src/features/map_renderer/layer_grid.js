// Coordinate grid lines, cell markers, and origin axes
// OPTIMIZATION (⚡ Bolt): Zero-allocation screen coordinate calculations in grid loops.
// Inlining screen coordinate formulas eliminates hundreds of temporary { x, y } object allocations
// per frame, preventing Garbage Collection (GC) pressure during map pan/zoom operations at 60 FPS.
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

    // Subtle grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;

    // Pre-calculate vertical and horizontal static screen bounds (zero allocations inside loop)
    const minYScreen = (state.cameraY - MAP_MIN_Y) * state.zoom + halfH;
    const maxYScreen = (state.cameraY - MAP_MAX_Y) * state.zoom + halfH;
    const minXScreen = (MAP_MIN_X - state.cameraX) * state.zoom + halfW;
    const maxXScreen = (MAP_MAX_X - state.cameraX) * state.zoom + halfW;

    ctx.beginPath();
    for (let x = minX; x <= maxX; x += step) {
        const xScreen = (x - state.cameraX) * state.zoom + halfW;
        ctx.moveTo(xScreen, minYScreen);
        ctx.lineTo(xScreen, maxYScreen);
    }
    for (let y = minY; y <= maxY; y += step) {
        const yScreen = (state.cameraY - y) * state.zoom + halfH;
        ctx.moveTo(minXScreen, yScreen);
        ctx.lineTo(maxXScreen, yScreen);
    }
    ctx.stroke();

    // Major origin axes (X=0, Y=0)
    ctx.strokeStyle = 'rgba(255, 122, 0, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    // X = 0 axis
    const x0Screen = -state.cameraX * state.zoom + halfW;
    ctx.moveTo(x0Screen, maxYScreen);
    ctx.lineTo(x0Screen, minYScreen);

    // Y = 0 axis
    const y0Screen = state.cameraY * state.zoom + halfH;
    ctx.moveTo(minXScreen, y0Screen);
    ctx.lineTo(maxXScreen, y0Screen);
    ctx.stroke();

    ctx.restore();
}
