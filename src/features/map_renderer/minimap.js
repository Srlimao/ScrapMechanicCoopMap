// Interactive CRT Radar Minimap Component
import { state } from '../../core/state.js';
import { MAP_MIN_X, MAP_MAX_X, MAP_MIN_Y, MAP_MAX_Y } from '../../core/constants.js';
import { jumpToLocation } from './camera.js';

export function setupMinimap(minimapCanvas, requestRender) {
    if (!minimapCanvas) return;

    minimapCanvas.addEventListener('click', (e) => {
        const rect = minimapCanvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        const normX = clickX / minimapCanvas.width;
        const normY = clickY / minimapCanvas.height;

        const worldX = MAP_MIN_X + normX * (MAP_MAX_X - MAP_MIN_X);
        const worldY = MAP_MAX_Y - normY * (MAP_MAX_Y - MAP_MIN_Y);

        jumpToLocation(worldX, worldY);
        requestRender();
    });
}

export function renderMinimap(minimapCtx, minimapCanvas, mainWidth, mainHeight) {
    if (!minimapCtx || !minimapCanvas) return;

    const w = minimapCanvas.width;
    const h = minimapCanvas.height;

    minimapCtx.clearRect(0, 0, w, h);

    // 1. Dark CRT Radar Background
    minimapCtx.fillStyle = '#071219';
    minimapCtx.fillRect(0, 0, w, h);

    // 2. Circular Range Rings & Crosshairs
    minimapCtx.strokeStyle = 'rgba(0, 229, 255, 0.15)';
    minimapCtx.lineWidth = 1;
    minimapCtx.beginPath();
    minimapCtx.arc(w / 2, h / 2, Math.min(w, h) * 0.25, 0, Math.PI * 2);
    minimapCtx.arc(w / 2, h / 2, Math.min(w, h) * 0.45, 0, Math.PI * 2);
    minimapCtx.stroke();

    minimapCtx.beginPath();
    minimapCtx.moveTo(w / 2, 4);
    minimapCtx.lineTo(w / 2, h - 4);
    minimapCtx.moveTo(4, h / 2);
    minimapCtx.lineTo(w - 4, h / 2);
    minimapCtx.stroke();

    // Map bounds ratio
    const mapW = MAP_MAX_X - MAP_MIN_X;
    const mapH = MAP_MAX_Y - MAP_MIN_Y;

    // 3. Render Major POIs
    if (state.mapData && state.mapData.pois) {
        for (const poi of state.mapData.pois) {
            const mx = ((poi.x - MAP_MIN_X) / mapW) * w;
            const my = ((MAP_MAX_Y - poi.y) / mapH) * h;
            minimapCtx.beginPath();
            minimapCtx.arc(mx, my, 2.5, 0, Math.PI * 2);
            minimapCtx.fillStyle = poi.color || '#f59e0b';
            minimapCtx.fill();
        }
    }

    // 4. Render Live player dot
    if (state.livePlayer.online) {
        const px = ((state.livePlayer.x - MAP_MIN_X) / mapW) * w;
        const py = ((MAP_MAX_Y - state.livePlayer.y) / mapH) * h;
        minimapCtx.beginPath();
        minimapCtx.arc(px, py, 4, 0, Math.PI * 2);
        minimapCtx.fillStyle = '#00e5ff';
        minimapCtx.shadowColor = '#00e5ff';
        minimapCtx.shadowBlur = 6;
        minimapCtx.fill();
        minimapCtx.shadowBlur = 0;
    }

    // 5. Viewport Bounding Box
    const viewWorldW = mainWidth / state.zoom;
    const viewWorldH = mainHeight / state.zoom;

    const viewMinX = state.cameraX - viewWorldW / 2;
    const viewMaxY = state.cameraY + viewWorldH / 2;

    const vx = ((viewMinX - MAP_MIN_X) / mapW) * w;
    const vy = ((MAP_MAX_Y - viewMaxY) / mapH) * h;
    const vw = (viewWorldW / mapW) * w;
    const vh = (viewWorldH / mapH) * h;

    minimapCtx.strokeStyle = '#00e5ff';
    minimapCtx.lineWidth = 1.5;
    minimapCtx.fillStyle = 'rgba(0, 229, 255, 0.08)';
    minimapCtx.fillRect(vx, vy, vw, vh);
    minimapCtx.strokeRect(vx, vy, vw, vh);
}
