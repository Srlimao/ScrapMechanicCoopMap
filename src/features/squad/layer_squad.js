// Canvas rendering layer for multiplayer squad members and tactical pings
import { state } from '../../core/state.js';
import { worldToScreen, calculateDistance } from '../../core/coords.js';

export function renderSquadLayer(ctx, width, height) {
    if (!state.squad.roomCode) return;

    // 1. Render Tactical Pings
    if (state.squad.pings && state.squad.pings.length > 0) {
        renderTacticalPings(ctx, width, height);
    }

    // 2. Render Squad Members
    if (state.squad.peers && state.squad.peers.size > 0) {
        renderSquadPeers(ctx, width, height);
    }
}

function renderSquadPeers(ctx, width, height) {
    const now = Date.now();

    for (const [peerId, peer] of state.squad.peers.entries()) {
        if (!peer.lastSeen || now - peer.lastSeen > 10000) continue; // Skip stale peers (>10s)

        const p = worldToScreen(peer.x, peer.y, width, height);
        if (p.x < -100 || p.x > width + 100 || p.y < -100 || p.y > height + 100) continue;

        const color = peer.color || '#00e5ff';

        // 1. Breadcrumb Trail
        if (peer.trail && peer.trail.length > 1) {
            ctx.save();
            ctx.beginPath();
            for (let i = 0; i < peer.trail.length; i++) {
                const pt = worldToScreen(peer.trail[i].x, peer.trail[i].y, width, height);
                if (i === 0) ctx.moveTo(pt.x, pt.y);
                else ctx.lineTo(pt.x, pt.y);
            }
            ctx.strokeStyle = color;
            ctx.globalAlpha = 0.35;
            ctx.lineWidth = 2;
            ctx.setLineDash([3, 3]);
            ctx.stroke();
            ctx.restore();
        }

        ctx.save();

        // 2. Direction Cone
        const coneAngle = peer.angle || 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 20, -coneAngle - 0.4, -coneAngle + 0.4);
        ctx.lineTo(p.x, p.y);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.2;
        ctx.fill();
        ctx.globalAlpha = 1.0;

        // 3. Outer Beacon Glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 4. Player Nameplate & Distance Badge
        let label = peer.name || 'Squad Member';
        if (state.livePlayer.online) {
            const dist = calculateDistance(state.livePlayer.x, state.livePlayer.y, peer.x, peer.y);
            label += ` (${dist.toFixed(0)}m)`;
        }

        ctx.font = '700 11px "Outfit", sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 6;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, p.x, p.y - 12);

        ctx.restore();
    }
}

function renderTacticalPings(ctx, width, height) {
    const now = Date.now();

    for (const ping of state.squad.pings) {
        const age = (now - ping.t) / 1000;
        if (age > 15) continue;

        const p = worldToScreen(ping.x, ping.y, width, height);
        const pulse = (now % 1000) / 1000;
        const color = ping.color || '#ff7a00';

        ctx.save();

        // Expanding Ripple
        ctx.beginPath();
        ctx.arc(p.x, p.y, 10 + pulse * 25, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.globalAlpha = 1 - pulse;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Ping Core Icon Circle
        ctx.globalAlpha = 1.0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.fill();

        // Ping Text Tag
        ctx.font = '800 10.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 6;
        ctx.fillText(`${ping.authorName}: ${ping.text}`, p.x, p.y + 20);

        ctx.restore();
    }
}
