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

    // Subtle grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;

    ctx.beginPath();
    for (let x = minX; x <= maxX; x += step) {
        const p1 = worldToScreen(x, MAP_MIN_Y, width, height);
        const p2 = worldToScreen(x, MAP_MAX_Y, width, height);
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
    }
    for (let y = minY; y <= maxY; y += step) {
        const p1 = worldToScreen(MAP_MIN_X, y, width, height);
        const p2 = worldToScreen(MAP_MAX_X, y, width, height);
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
    }
    ctx.stroke();

    // Major origin axes (X=0, Y=0)
    ctx.strokeStyle = 'rgba(255, 122, 0, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const x0Top = worldToScreen(0, MAP_MAX_Y, width, height);
    const x0Bot = worldToScreen(0, MAP_MIN_Y, width, height);
    ctx.moveTo(x0Top.x, x0Top.y);
    ctx.lineTo(x0Bot.x, x0Bot.y);

    const y0Left = worldToScreen(MAP_MIN_X, 0, width, height);
    const y0Right = worldToScreen(MAP_MAX_X, 0, width, height);
    ctx.moveTo(y0Left.x, y0Left.y);
    ctx.lineTo(y0Right.x, y0Right.y);
    ctx.stroke();

    ctx.restore();
}
