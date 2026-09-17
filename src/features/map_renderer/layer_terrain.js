// Terrain background image loading & rendering
// OPTIMIZATION (⚡ Bolt): Zero-allocation screen coordinate calculation in 60 FPS terrain loop.
// Inlining screen coordinates eliminates per-frame { x, y } object allocation from worldToScreen.
import { state } from '../../core/state.js';
import { MAP_MIN_X, MAP_MAX_X, MAP_MIN_Y, MAP_MAX_Y } from '../../core/constants.js';
import { worldToScreen } from '../../core/coords.js';

let terrainImage = new Image();
let isImageLoaded = false;
let currentLoadedSeed = null;
const tempTopLeft = { x: 0, y: 0 };

terrainImage.src = 'survival-world-surface.webp';
terrainImage.onload = () => {
    isImageLoaded = true;
};

export function setTerrainImageSource(src, seed = null) {
    terrainImage = new Image();
    isImageLoaded = false;
    terrainImage.onload = () => {
        isImageLoaded = true;
        currentLoadedSeed = seed;
    };
    terrainImage.src = src;
}

export function renderTerrainLayer(ctx, width, height) {
    if (!state.layers.mapImage || !isImageLoaded) return;

    // The terrain surface spans MAP_MIN_X to MAP_MAX_X, MAP_MIN_Y to MAP_MAX_Y
    // Passing tempTopLeft eliminates per-frame { x, y } object allocations
    const topLeft = worldToScreen(MAP_MIN_X, MAP_MAX_Y, width, height, tempTopLeft);
    const renderWidth = (MAP_MAX_X - MAP_MIN_X) * state.zoom;
    const renderHeight = (MAP_MAX_Y - MAP_MIN_Y) * state.zoom;

    ctx.save();
    ctx.globalAlpha = state.mapOpacity;
    ctx.imageSmoothingEnabled = state.terrainSmoothing !== false;
    if (ctx.imageSmoothingEnabled) {
        ctx.imageSmoothingQuality = 'high';
    }

    ctx.drawImage(
        terrainImage,
        topLeft.x,
        topLeft.y,
        renderWidth,
        renderHeight
    );

    ctx.restore();
}
