// Main Canvas Render Loop and Layer Orchestration Engine
import { state } from '../../core/state.js';
import { renderTerrainLayer } from './layer_terrain.js';
import { renderGridLayer } from './layer_grid.js';
import { renderEntitiesLayer } from './layer_entities.js';
import { renderPlayerTrail } from '../live_tracker/player_trail.js';
import { renderSquadLayer } from '../squad/layer_squad.js';
import { renderRadar } from './radar.js';
import { renderRulerLayer } from '../tools/ruler.js';

let isRunning = false;
let canvasEl = null;
let ctx2d = null;
let radarCanvasEl = null;
let radarCtx2d = null;

export function initCanvasEngine(canvas, radarCanvas) {
    canvasEl = canvas;
    ctx2d = canvas.getContext('2d');
    radarCanvasEl = radarCanvas;
    radarCtx2d = radarCanvas ? radarCanvas.getContext('2d') : null;

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

    // 6. Multiplayer Squad Members & Tactical Pings
    renderSquadLayer(ctx2d, w, h);

    // 7. Measurement Ruler Tool
    renderRulerLayer(ctx2d, w, h);

    // 8. Tactical Proximity Radar HUD
    if (radarCtx2d && radarCanvasEl) {
        renderRadar(radarCtx2d, radarCanvasEl, w, h);
    }
}
