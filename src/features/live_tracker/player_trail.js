// Live player marker and breadcrumb trail renderer
import { state } from '../../core/state.js';
import { worldToScreen } from '../../core/coords.js';

export function renderPlayerTrail(ctx, width, height) {
    if (!state.layers.livePlayer || !state.livePlayer.online) return;

    const trail = state.livePlayer.trail;
    if (trail.length > 1) {
        ctx.save();
        ctx.beginPath();
        for (let i = 0; i < trail.length; i++) {
            const pt = worldToScreen(trail[i].x, trail[i].y, width, height);
            if (i === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
        }
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.45)';
        ctx.lineWidth = Math.max(1.5, 2.5 * Math.min(1, state.zoom / 0.05));
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.restore();
    }

    // Render live player beacon
    const p = worldToScreen(state.livePlayer.x, state.livePlayer.y, width, height);

    ctx.save();
    // Pulse ring
    const pulse = (Date.now() % 1500) / 1500;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 8 + pulse * 14, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(0, 229, 255, ${1 - pulse})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Direction cone
    ctx.beginPath();
    const coneAngle = state.livePlayer.angle;
    ctx.arc(p.x, p.y, 22, -coneAngle - 0.45, -coneAngle + 0.45);
    ctx.lineTo(p.x, p.y);
    ctx.fillStyle = 'rgba(0, 229, 255, 0.25)';
    ctx.fill();

    // Core dot
    ctx.beginPath();
    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#00e5ff';
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 10;
    ctx.fill();

    ctx.restore();
}
