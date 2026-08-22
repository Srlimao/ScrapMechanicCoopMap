// Live player marker and breadcrumb trail renderer
// OPTIMIZATION (⚡ Bolt): World-space frustum culling and zero-allocation screen position calculations.
// Pre-computing viewport bounds in world coordinates eliminates off-screen object allocations ({x, y})
// for player breadcrumb trail rendering during high-frequency telemetry updates.
import { state } from '../../core/state.js';

/**
 * Calculates world-space viewport bounds for fast frustum culling.
 */
function getViewportWorldBounds(width, height, marginPx = 50) {
    const invZoom = 1 / state.zoom;
    const halfW = width * 0.5;
    const halfH = height * 0.5;
    const marginWorld = marginPx * invZoom;

    return {
        halfW,
        halfH,
        minX: state.cameraX - halfW * invZoom - marginWorld,
        maxX: state.cameraX + halfW * invZoom + marginWorld,
        minY: state.cameraY - halfH * invZoom - marginWorld,
        maxY: state.cameraY + halfH * invZoom + marginWorld
    };
}

export function renderPlayerTrail(ctx, width, height) {
    if (!state.layers.livePlayer || !state.livePlayer.online || state.livePlayer.x === null || state.livePlayer.y === null) return;

    const bounds = getViewportWorldBounds(width, height, 50);

    const trail = state.livePlayer.trail;
    if (trail && trail.length > 1) {
        ctx.save();
        ctx.beginPath();
        let started = false;
        for (let i = 0; i < trail.length; i++) {
            const t = trail[i];
            // World-space frustum culling for trail nodes
            if (t.x < bounds.minX || t.x > bounds.maxX || t.y < bounds.minY || t.y > bounds.maxY) {
                started = false;
                continue;
            }

            const px = (t.x - state.cameraX) * state.zoom + bounds.halfW;
            const py = (state.cameraY - t.y) * state.zoom + bounds.halfH;

            if (!started) {
                ctx.moveTo(px, py);
                started = true;
            } else {
                const prev = trail[i - 1];
                if (Math.hypot(t.x - prev.x, t.y - prev.y) > 80) {
                    ctx.moveTo(px, py);
                } else {
                    ctx.lineTo(px, py);
                }
            }
        }
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.45)';
        ctx.lineWidth = Math.max(1.5, 2.5 * Math.min(1, state.zoom / 0.05));
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.restore();
    }

    // World-space frustum check for live player beacon
    if (state.livePlayer.x < bounds.minX || state.livePlayer.x > bounds.maxX || state.livePlayer.y < bounds.minY || state.livePlayer.y > bounds.maxY) {
        return;
    }

    const px = (state.livePlayer.x - state.cameraX) * state.zoom + bounds.halfW;
    const py = (state.cameraY - state.livePlayer.y) * state.zoom + bounds.halfH;

    ctx.save();
    // Pulse ring
    const pulse = (Date.now() % 1500) / 1500;
    ctx.beginPath();
    ctx.arc(px, py, 8 + pulse * 14, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(0, 229, 255, ${1 - pulse})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Direction cone
    ctx.beginPath();
    const coneAngle = state.livePlayer.angle;
    ctx.arc(px, py, 22, -coneAngle - 0.45, -coneAngle + 0.45);
    ctx.lineTo(px, py);
    ctx.fillStyle = 'rgba(0, 229, 255, 0.25)';
    ctx.fill();

    // Core dot
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#00e5ff';
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 10;
    ctx.fill();

    ctx.restore();
}
