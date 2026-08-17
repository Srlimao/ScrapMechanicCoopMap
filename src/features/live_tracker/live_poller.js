// Real-Time Live Player Tracking Polling Engine
import { state, notifyStateChange } from '../../core/state.js';
import { calculateDistance } from '../../core/coords.js';

let pollInterval = null;
let lastLogState = null;

export function startLivePoller() {
    if (pollInterval) clearInterval(pollInterval);
    console.log("[LiveTracker] Poller started (10 Hz).");
    pollInterval = setInterval(fetchLivePlayerState, 100);
}

export function stopLivePoller() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
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

    const prevX = state.livePlayer.x;
    const prevY = state.livePlayer.y;
    const prevTime = state.livePlayer.lastFetch || Date.now();
    const now = Date.now();
    const dt = Math.max(0.01, (now - prevTime) / 1000);

    state.livePlayer.online = Boolean(data.online);
    state.livePlayer.lastFetch = now;

    if (data.online) {
        state.livePlayer.x = data.x;
        state.livePlayer.y = data.y;
        state.livePlayer.z = data.z;
        state.livePlayer.dirX = data.dirX || 0;
        state.livePlayer.dirY = data.dirY || 1;
        state.livePlayer.dirZ = data.dirZ || 0;
        state.livePlayer.tick = data.tick || 0;
        state.livePlayer.age = data.age || 0;
        state.livePlayer.angle = Math.atan2(data.dirY || 1, data.dirX || 0);

        if (lastLogState !== "online") {
            console.log(`[LiveTracker] Player ONLINE at (${data.x}, ${data.y}, ${data.z}) [Source: ${data.source}]`);
            lastLogState = "online";
        }

        if (prevX !== 0 || prevY !== 0) {
            const dist = calculateDistance(prevX, prevY, data.x, data.y);
            state.livePlayer.speed = Math.min(60, dist / dt);
        }

        const trail = state.livePlayer.trail;
        if (trail.length === 0 || calculateDistance(trail[trail.length - 1].x, trail[trail.length - 1].y, data.x, data.y) > 2.0) {
            trail.push({ x: data.x, y: data.y, t: now });
            if (trail.length > 250) trail.shift();
        }

        if (state.followPlayer) {
            state.cameraX += (data.x - state.cameraX) * 0.15;
            state.cameraY += (data.y - state.cameraY) * 0.15;
        }

        notifyStateChange('live_player_update', state.livePlayer);
    } else {
        if (lastLogState !== "offline") {
            console.log("[LiveTracker] Player OFFLINE - Waiting for game memory hook connection.");
            lastLogState = "offline";
        }
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

