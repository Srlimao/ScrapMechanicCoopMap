// Canvas rendering layer for multiplayer squad members and tactical pings
// OPTIMIZATION (⚡ Bolt): World-space frustum culling and zero-allocation screen position calculations.
// Pre-computing viewport bounds in world coordinates eliminates off-screen object allocations ({x, y})
// for multiplayer squad members, trails, and tactical pings.
import { state } from '../../core/state.js';
import { calculateDistance } from '../../core/coords.js';

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

export function renderSquadLayer(ctx, width, height) {
    if (!state.squad.roomCode) return;

    const bounds = getViewportWorldBounds(width, height, 50);

    // 1. Render Tactical Pings
    if (state.squad.pings && state.squad.pings.length > 0) {
        renderTacticalPings(ctx, width, height, bounds);
    }

    // 2. Render Squad Members
    if (state.squad.peers && state.squad.peers.size > 0) {
        renderSquadPeers(ctx, width, height, bounds);
    }
}

function renderSquadPeers(ctx, width, height, bounds) {
    const now = Date.now();

    for (const [peerId, peer] of state.squad.peers.entries()) {
        if (!peer.lastSeen || now - peer.lastSeen > 10000) continue; // Skip stale peers (>10s)

        const color = peer.color || '#00e5ff';

        // 1. Breadcrumb Trail
        if (peer.trail && peer.trail.length > 1) {
            ctx.save();
            ctx.beginPath();
            let started = false;
            for (let i = 0; i < peer.trail.length; i++) {
                const pt = peer.trail[i];
                if (pt.x < bounds.minX || pt.x > bounds.maxX || pt.y < bounds.minY || pt.y > bounds.maxY) {
                    started = false;
                    continue;
                }
                const px = (pt.x - state.cameraX) * state.zoom + bounds.halfW;
                const py = (state.cameraY - pt.y) * state.zoom + bounds.halfH;

                if (!started) {
                    ctx.moveTo(px, py);
                    started = true;
                } else {
                    const prev = peer.trail[i - 1];
                    if (Math.hypot(pt.x - prev.x, pt.y - prev.y) > 80) {
                        ctx.moveTo(px, py);
                    } else {
                        ctx.lineTo(px, py);
                    }
                }
            }
            ctx.strokeStyle = color;
            ctx.globalAlpha = 0.35;
            ctx.lineWidth = 2;
            ctx.setLineDash([3, 3]);
            ctx.stroke();
            ctx.restore();
        }

        // Fast World-Space Frustum Culling for peer position
        if (peer.x < bounds.minX || peer.x > bounds.maxX || peer.y < bounds.minY || peer.y > bounds.maxY) continue;

        const px = (peer.x - state.cameraX) * state.zoom + bounds.halfW;
        const py = (state.cameraY - peer.y) * state.zoom + bounds.halfH;

        ctx.save();

        // 2. Direction Cone
        const coneAngle = peer.angle || 0;
        ctx.beginPath();
        ctx.arc(px, py, 20, -coneAngle - 0.4, -coneAngle + 0.4);
        ctx.lineTo(px, py);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.2;
        ctx.fill();
        ctx.globalAlpha = 1.0;

        // 3. Outer Beacon Glow
        ctx.beginPath();
        ctx.arc(px, py, 7, 0, Math.PI * 2);
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
        ctx.fillText(label, px, py - 12);

        ctx.restore();
    }
}

function renderTacticalPings(ctx, width, height, bounds) {
    const now = Date.now();

    for (const ping of state.squad.pings) {
        const age = (now - ping.t) / 1000;
        if (age > 15) continue;

        // Fast World-Space Frustum Culling
        if (ping.x < bounds.minX || ping.x > bounds.maxX || ping.y < bounds.minY || ping.y > bounds.maxY) continue;

        const px = (ping.x - state.cameraX) * state.zoom + bounds.halfW;
        const py = (state.cameraY - ping.y) * state.zoom + bounds.halfH;
        const pulse = (now % 1000) / 1000;
        const color = ping.color || '#ff7a00';

        ctx.save();

        // Expanding Ripple
        ctx.beginPath();
        ctx.arc(px, py, 10 + pulse * 25, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.globalAlpha = 1 - pulse;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Ping Core Icon Circle
        ctx.globalAlpha = 1.0;
        ctx.beginPath();
        ctx.arc(px, py, 8, 0, Math.PI * 2);
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
        ctx.fillText(`${ping.authorName}: ${ping.text}`, px, py + 20);

        ctx.restore();
    }
}
