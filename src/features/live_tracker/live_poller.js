// Real-Time Live Player Tracking Polling Engine
import { state, notifyStateChange } from '../../core/state.js';
import { calculateDistance } from '../../core/coords.js';

let pollTimer = null;
let isPolling = false;
let lastLogState = null;

export function startLivePoller() {
    if (pollTimer) clearTimeout(pollTimer);
    isPolling = true;
    console.log("[LiveTracker] Adaptive poller started (1 Hz idle / 33 Hz active).");
    scheduleNextPoll(0);
}

export function stopLivePoller() {
    isPolling = false;
    if (pollTimer) {
        clearTimeout(pollTimer);
        pollTimer = null;
    }
}

function scheduleNextPoll(delayMs) {
    if (!isPolling) return;
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = setTimeout(async () => {
        await fetchLivePlayerState();
        const nextDelay = state.livePlayer.online ? 30 : 1000;
        scheduleNextPoll(nextDelay);
    }, delayMs);
}

export async function fetchLivePlayerState() {
    let data = null;
    try {
        if (window.electronAPI && typeof window.electronAPI.fetchLivePlayer === 'function') {
            data = await window.electronAPI.fetchLivePlayer();
        } else {
            const resp = await fetch('/api/player?t=' + Date.now());
            if (resp.ok) {
                data = await resp.json();
            }
        }
    } catch (e) {}

    if (!data) return;

    const wasOnline = state.livePlayer.online;
    const wasInitialized = state.livePlayer.initialized;
    const prevX = state.livePlayer.x;
    const prevY = state.livePlayer.y;
    const prevTime = state.livePlayer.lastFetch || Date.now();
    const now = Date.now();
    const dt = Math.max(0.01, (now - prevTime) / 1000);

    state.livePlayer.online = Boolean(data.online);
    state.livePlayer.lastFetch = now;

    if (data.online) {
        // Initial connection or reconnect after offline: snap immediately to real position without trail
        if (!wasOnline || !wasInitialized || prevX === null || prevY === null) {
            state.livePlayer.initialized = true;
            state.livePlayer.x = data.x;
            state.livePlayer.y = data.y;
            state.livePlayer.z = data.z;
            state.livePlayer.dirX = data.dirX || 0;
            state.livePlayer.dirY = data.dirY || 1;
            state.livePlayer.dirZ = data.dirZ || 0;
            state.livePlayer.speed = 0;
            state.livePlayer.tick = data.tick || 0;
            state.livePlayer.age = data.age || 0;
            state.livePlayer.angle = Math.atan2(data.dirY || 1, data.dirX || 0);
            state.livePlayer.trail = [{ x: data.x, y: data.y, t: now }];

            if (state.followPlayer) {
                state.cameraX = data.x;
                state.cameraY = data.y;
            }

            if (lastLogState !== "online") {
                console.log(`[LiveTracker] Player ONLINE at (${data.x}, ${data.y}, ${data.z}) [Source: ${data.source}]`);
                lastLogState = "online";
            }

            state.livePlayer.bots = Array.isArray(data.bots) ? data.bots : [];
            state.livePlayer.creations = Array.isArray(data.creations) ? data.creations : [];
            state.livePlayer.stats = data.stats || { botCount: state.livePlayer.bots.length, creationCount: state.livePlayer.creations.length };

            notifyStateChange('live_player_update', state.livePlayer);
            return;
        }

        // OPTIMIZATION (⚡ Bolt): Squared-distance pre-culling & deferred Math.sqrt in 33 Hz telemetry loop.
        // Using squared distance (dx^2 + dy^2) eliminates redundant Math.sqrt execution for teleport checks
        // and breadcrumb trail insertion thresholds.
        const dx = data.x - prevX;
        const dy = data.y - prevY;
        const distSq = dx * dx + dy * dy;

        // Teleport / Respawn detection (large distance jump in 1 frame > 100m, i.e., > 10,000m²)
        if (distSq > 10000.0) {
            state.livePlayer.x = data.x;
            state.livePlayer.y = data.y;
            state.livePlayer.z = data.z;
            state.livePlayer.speed = 0;
            state.livePlayer.trail = [{ x: data.x, y: data.y, t: now }];
            if (state.followPlayer) {
                state.cameraX = data.x;
                state.cameraY = data.y;
            }
        } else {
            state.livePlayer.x = data.x;
            state.livePlayer.y = data.y;
            state.livePlayer.z = data.z;
            state.livePlayer.speed = Math.min(60, Math.sqrt(distSq) / dt);

            const trail = state.livePlayer.trail;
            const lastNode = trail.length > 0 ? trail[trail.length - 1] : null;
            if (!lastNode) {
                trail.push({ x: data.x, y: data.y, t: now });
            } else {
                const tdx = data.x - lastNode.x;
                const tdy = data.y - lastNode.y;
                if (tdx * tdx + tdy * tdy > 4.0) { // 2.0m threshold -> 4.0m²
                    trail.push({ x: data.x, y: data.y, t: now });
                    if (trail.length > 250) trail.shift();
                }
            }

            if (state.followPlayer) {
                state.cameraX += (data.x - state.cameraX) * 0.15;
                state.cameraY += (data.y - state.cameraY) * 0.15;
            }
        }

        state.livePlayer.dirX = data.dirX || 0;
        state.livePlayer.dirY = data.dirY || 1;
        state.livePlayer.dirZ = data.dirZ || 0;
        state.livePlayer.tick = data.tick || 0;
        state.livePlayer.age = data.age || 0;
        state.livePlayer.angle = Math.atan2(data.dirY || 1, data.dirX || 0);
        state.livePlayer.bots = Array.isArray(data.bots) ? data.bots : [];
        state.livePlayer.creations = Array.isArray(data.creations) ? data.creations : [];
        state.livePlayer.stats = data.stats || { botCount: state.livePlayer.bots.length, creationCount: state.livePlayer.creations.length };

        notifyStateChange('live_player_update', state.livePlayer);
    } else {
        if (lastLogState !== "offline") {
            console.log("[LiveTracker] Player OFFLINE - Waiting for game memory hook connection.");
            lastLogState = "offline";
        }
        state.livePlayer.speed = 0;
        notifyStateChange('live_player_offline', null);
    }
}

export async function retryLiveConnection() {
    console.log("[LiveTracker] Force re-scanning game memory...");
    startLivePoller();
    await fetchLivePlayerState();
    const { showToast } = await import('../../ui/toasts.js');
    if (state.livePlayer.online) {
        showToast("Live Player Connected", `Tracking character at (${state.livePlayer.x.toFixed(0)}, ${state.livePlayer.y.toFixed(0)})`, "success", 3000);
    } else {
        showToast("Scanning Game Memory", "Scrap Mechanic not detected yet. Launch the game and load into a world.", "info", 4000);
    }
}

