// Main Canvas Render Loop and Layer Orchestration Engine
import { state, subscribe } from '../../core/state.js';
import { renderTerrainLayer } from './layer_terrain.js';
import { renderGridLayer } from './layer_grid.js';
import { renderEntitiesLayer } from './layer_entities.js';
import { renderPlayerTrail } from '../live_tracker/player_trail.js';
import { renderSquadLayer } from '../squad/layer_squad.js';
import { renderRadar } from './radar.js';

let isRunning = false;
let canvasEl = null;
let ctx2d = null;
let radarCanvasEl = null;
let radarCtx2d = null;
let radarContainerEl = null;
let needsMapRender = true;

export function requestRender() {
    needsMapRender = true;
}

export function initCanvasEngine(canvas, radarCanvas) {
    canvasEl = canvas;
    ctx2d = canvas.getContext('2d');
    radarCanvasEl = radarCanvas;
    radarCtx2d = radarCanvas ? radarCanvas.getContext('2d') : null;
    radarContainerEl = document.getElementById('radarModuleContainer');

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    if (window.ResizeObserver && canvas.parentElement) {
        const ro = new ResizeObserver(() => {
            resizeCanvas();
        });
        ro.observe(canvas.parentElement);
    }

    // Subscribe to all state changes to trigger map redraws on-demand
    subscribe((type) => {
        needsMapRender = true;
    });

    isRunning = true;
    requestAnimationFrame(renderLoop);
}

export function resizeCanvas() {
    if (!canvasEl || !canvasEl.parentElement) return;
    const parent = canvasEl.parentElement;
    if (canvasEl.width !== parent.clientWidth || canvasEl.height !== parent.clientHeight) {
        canvasEl.width = parent.clientWidth;
        canvasEl.height = parent.clientHeight;
        needsMapRender = true;
    }
}

function renderLoop() {
    if (!isRunning) return;

    // Continuously verify parent container dimensions to prevent any squishing during transitions
    if (canvasEl && canvasEl.parentElement) {
        const parent = canvasEl.parentElement;
        if (canvasEl.width !== parent.clientWidth || canvasEl.height !== parent.clientHeight) {
            canvasEl.width = parent.clientWidth;
            canvasEl.height = parent.clientHeight;
            needsMapRender = true;
        }
    }

    const w = canvasEl ? canvasEl.width : 0;
    const h = canvasEl ? canvasEl.height : 0;

    // 1. Render Main Map Canvas only when state is dirty / camera moved / entities updated
    if (needsMapRender && ctx2d && canvasEl && w > 0 && h > 0) {
        renderFrame(w, h);
        needsMapRender = false;
    }

    // 2. Render Tactical Proximity Radar HUD only if visible / player online
    if (radarCtx2d && radarCanvasEl) {
        const isRadarVisible = radarContainerEl ? !radarContainerEl.classList.contains('hidden') : state.livePlayer.online;
        if (isRadarVisible) {
            renderRadar(radarCtx2d, radarCanvasEl, radarCanvasEl.width, radarCanvasEl.height);
        }
    }

    requestAnimationFrame(renderLoop);
}

export function renderFrame(w, h) {
    if (!ctx2d || !canvasEl) return;

    const width = w || canvasEl.width;
    const height = h || canvasEl.height;

    // 1. Clear background
    ctx2d.fillStyle = '#0a0d14';
    ctx2d.fillRect(0, 0, width, height);

    // 2. Terrain Image Layer
    renderTerrainLayer(ctx2d, width, height);

    // 3. Coordinate Grid Layer
    renderGridLayer(ctx2d, width, height);

    // 4. Entities Layer (Creations, Units, Harvestables, POIs)
    renderEntitiesLayer(ctx2d, width, height);

    // 5. Live Player Marker & Trail
    renderPlayerTrail(ctx2d, width, height);

    // 6. Multiplayer Squad Members & Tactical Pings
    renderSquadLayer(ctx2d, width, height);
}

