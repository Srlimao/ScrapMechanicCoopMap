// Coordinate grid lines, cell markers, and origin axes
import { state } from '../../core/state.js';
import { CELL_SIZE, MAP_MIN_X, MAP_MAX_X, MAP_MIN_Y, MAP_MAX_Y } from '../../core/constants.js';
import { worldToScreen } from '../../core/coords.js';

export function renderGridLayer(ctx, width, height) {
    if (!state.layers.grid) return;

    ctx.save();

    // Determine grid step based on current zoom
    let step = CELL_SIZE * 4; // 256m (4 cells) by default
    if (state.zoom > 0.15) step = CELL_SIZE; // 64m (1 cell)
    if (state.zoom < 0.02) step = CELL_SIZE * 16; // 1024m (16 cells)

    const minX = Math.max(MAP_MIN_X, Math.floor((state.cameraX - (width / 2) / state.zoom) / step) * step);
    const maxX = Math.min(MAP_MAX_X, Math.ceil((state.cameraX + (width / 2) / state.zoom) / step) * step);
    const minY = Math.max(MAP_MIN_Y, Math.floor((state.cameraY - (height / 2) / state.zoom) / step) * step);
    const maxY = Math.min(MAP_MAX_Y, Math.ceil((state.cameraY + (height / 2) / state.zoom) / step) * step);

    // OPTIMIZATION (⚡ Bolt): Direct scalar coordinate calculations.
    // Pre-computing screen constants and calculating scalar screen positions inlined
    // inside loops eliminates `{ x, y }` object allocations on every frame for all grid lines.
    const halfW = width * 0.5;
    const halfH = height * 0.5;

    const screenYTop = (state.cameraY - MAP_MAX_Y) * state.zoom + halfH;
    const screenYBot = (state.cameraY - MAP_MIN_Y) * state.zoom + halfH;
    const screenXLeft = (MAP_MIN_X - state.cameraX) * state.zoom + halfW;
    const screenXRight = (MAP_MAX_X - state.cameraX) * state.zoom + halfW;

    // Subtle grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;

    ctx.beginPath();
    for (let x = minX; x <= maxX; x += step) {
        const screenX = (x - state.cameraX) * state.zoom + halfW;
        ctx.moveTo(screenX, screenYTop);
        ctx.lineTo(screenX, screenYBot);
    }
    for (let y = minY; y <= maxY; y += step) {
        const screenY = (state.cameraY - y) * state.zoom + halfH;
        ctx.moveTo(screenXLeft, screenY);
        ctx.lineTo(screenXRight, screenY);
    }
    ctx.stroke();

    // Major origin axes (X=0, Y=0)
    ctx.strokeStyle = 'rgba(255, 122, 0, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const x0 = (0 - state.cameraX) * state.zoom + halfW;
    ctx.moveTo(x0, screenYTop);
    ctx.lineTo(x0, screenYBot);

    const y0 = (state.cameraY - 0) * state.zoom + halfH;
    ctx.moveTo(screenXLeft, y0);
    ctx.lineTo(screenXRight, y0);
    ctx.stroke();

    ctx.restore();
}
