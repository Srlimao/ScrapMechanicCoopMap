// Main Canvas Render Loop and Layer Orchestration Engine
import { state } from '../../core/state.js';
import { renderTerrainLayer } from './layer_terrain.js';
import { renderGridLayer } from './layer_grid.js';
import { renderEntitiesLayer } from './layer_entities.js';
import { renderPlayerTrail } from '../live_tracker/player_trail.js';
import { renderMinimap } from './minimap.js';
import { renderRulerLayer } from '../tools/ruler.js';

let isRunning = false;
let canvasEl = null;
let ctx2d = null;
let minimapCanvasEl = null;
let minimapCtx2d = null;

export function initCanvasEngine(canvas, minimapCanvas) {
    canvasEl = canvas;
    ctx2d = canvas.getContext('2d');
    minimapCanvasEl = minimapCanvas;
    minimapCtx2d = minimapCanvas ? minimapCanvas.getContext('2d') : null;

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    isRunning = true;
    requestAnimationFrame(renderLoop);
}

export function resizeCanvas() {
    if (!canvasEl) return;
    const parent = canvasEl.parentElement;
    canvasEl.width = parent.clientWidth;
    canvasEl.height = parent.clientHeight;
    renderFrame();
}

function renderLoop() {
    if (!isRunning) return;
    renderFrame();
    requestAnimationFrame(renderLoop);
}

export function renderFrame() {
    if (!ctx2d || !canvasEl) return;

    const w = canvasEl.width;
    const h = canvasEl.height;

    // 1. Clear background
    ctx2d.fillStyle = '#0a0d14';
    ctx2d.fillRect(0, 0, w, h);

    // 2. Terrain Image Layer
    renderTerrainLayer(ctx2d, w, h);

    // 3. Coordinate Grid Layer
    renderGridLayer(ctx2d, w, h);

    // 4. Entities Layer (Creations, Units, Harvestables, POIs)
    renderEntitiesLayer(ctx2d, w, h);

    // 5. Live Player Marker & Trail
    renderPlayerTrail(ctx2d, w, h);

    // 6. Measurement Ruler Tool
    renderRulerLayer(ctx2d, w, h);

    // 7. Minimap HUD
    if (minimapCtx2d && minimapCanvasEl) {
        renderMinimap(minimapCtx2d, minimapCanvasEl, w, h);
    }
}
