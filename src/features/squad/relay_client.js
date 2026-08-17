// WebSocket Relay Client for Multiplayer Squad Rooms
import { state, notifyStateChange } from '../../core/state.js';
import { generateMapFromSeed } from '../tools/seed_generator.js';
import { showToast } from '../../ui/toasts.js';

let ws = null;
let telemetryInterval = null;
let reconnectTimer = null;

export function connectToRelayServer(serverUrl) {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.close();
    }

    state.squad.serverUrl = serverUrl || state.squad.serverUrl || 'wss://sm.dunhas.com';
    console.log(`[SquadRelay] Connecting to ${state.squad.serverUrl}...`);

    try {
        ws = new WebSocket(state.squad.serverUrl);
    } catch (e) {
        showToast("Relay Connection Failed", `Could not connect to ${state.squad.serverUrl}`, "error");
        return;
    }

    ws.onopen = () => {
        console.log("[SquadRelay] Connected to Relay Server.");
        state.squad.connected = true;
        notifyStateChange('squad_connected', true);
        showToast("Relay Server Connected", `Connected to ${state.squad.serverUrl}`, "success", 3000);
        startTelemetryLoop();
    };

    ws.onmessage = (event) => {
        let msg = null;
        try { msg = JSON.parse(event.data); } catch (e) { return; }
        handleRelayMessage(msg);
    };

    ws.onclose = () => {
        console.log("[SquadRelay] Disconnected from Relay Server.");
        state.squad.connected = false;
        state.squad.roomCode = null;
        state.squad.peers.clear();
        stopTelemetryLoop();
        notifyStateChange('squad_disconnected', false);
    };

    ws.onerror = (err) => {
        console.warn("[SquadRelay] WebSocket error:", err);
    };
}

export function disconnectFromRelayServer() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    stopTelemetryLoop();
    if (ws) {
        ws.close();
        ws = null;
    }
    state.squad.connected = false;
    state.squad.roomCode = null;
    state.squad.peers.clear();
    notifyStateChange('squad_disconnected', false);
}

export async function createSquadRoom(nickname, color) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        connectToRelayServer(state.squad.serverUrl);
        setTimeout(() => createSquadRoom(nickname, color), 800);
        return;
    }

    const activeSeed = state.mapData?.gameInfo?.seed || 151054709;
    state.squad.myNickname = nickname || state.squad.myNickname;
    state.squad.myColor = color || state.squad.myColor;

    // Fetch active cell definitions to upload to the room
    let cells = state.mapData?.terrainCells || null;
    if (!cells && window.electronAPI && typeof window.electronAPI.generateTerrain === 'function') {
        try {
            const res = await window.electronAPI.generateTerrain(activeSeed);
            if (res && res.success && res.cells) {
                cells = res.cells;
                if (!state.mapData) state.mapData = { gameInfo: { seed: activeSeed } };
                state.mapData.terrainCells = cells;
            }
        } catch (e) {}
    }

    ws.send(JSON.stringify({
        type: 'create_room',
        name: state.squad.myNickname,
        color: state.squad.myColor,
        seed: activeSeed,
        cells: cells
    }));
}

export function joinSquadRoom(roomCode, nickname, color) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        connectToRelayServer(state.squad.serverUrl);
        setTimeout(() => joinSquadRoom(roomCode, nickname, color), 800);
        return;
    }

    state.squad.myNickname = nickname || state.squad.myNickname;
    state.squad.myColor = color || state.squad.myColor;

    ws.send(JSON.stringify({
        type: 'join_room',
        roomCode: roomCode.trim().toUpperCase(),
        name: state.squad.myNickname,
        color: state.squad.myColor
    }));
}

export function sendSquadPing(x, y, text = 'Squad Marker', pingType = 'alert') {
    if (!ws || ws.readyState !== WebSocket.OPEN || !state.squad.roomCode) return;

    ws.send(JSON.stringify({
        type: 'squad_ping',
        x,
        y,
        text,
        pingType
    }));
}

function handleRelayMessage(msg) {
    const type = msg.type;

    if (type === 'room_created' || type === 'room_joined') {
        state.squad.roomCode = msg.roomCode;
        state.squad.isHost = Boolean(msg.isHost);
        state.squad.myPeerId = msg.peerId;
        state.squad.peers.clear();

        if (Array.isArray(msg.peers)) {
            msg.peers.forEach(p => state.squad.peers.set(p.id, { ...p, trail: [] }));
        }

        showToast(
            msg.isHost ? "Squad Room Created!" : "Joined Squad Room!",
            `Room Code: #${msg.roomCode} • Seed: ${msg.seed}`,
            "success",
            6000
        );

        // Instantly render cells if provided by the host
        if (msg.cells && Array.isArray(msg.cells) && msg.cells.length > 0 && window.TerrainLoader) {
            console.log(`[SquadRelay] Received ${msg.cells.length} cells from host. Rendering instantly...`);
            window.TerrainLoader.renderTerrainFromCells(msg.cells, msg.seed).then(res => {
                if (res && res.dataUrl) {
                    import('../map_renderer/layer_terrain.js').then(({ setTerrainImageSource }) => {
                        setTerrainImageSource(res.dataUrl, msg.seed);
                        sessionStorage.setItem('sm_cached_terrain_' + msg.seed, res.dataUrl);
                        showToast("Map Synced from Host!", `Rendered 12,288 world cells in 30ms!`, "success", 4000);
                    });
                }
            });
        } else if (msg.seed) {
            console.log(`[SquadRelay] Auto-syncing world seed: ${msg.seed}`);
            generateMapFromSeed(msg.seed);
        }

        notifyStateChange('squad_room_state', state.squad);
        return;
    }

    if (type === 'peer_joined') {
        state.squad.peers.set(msg.peer.id, { ...msg.peer, x: 0, y: 0, z: 0, dirX: 0, dirY: 1, speed: 0, trail: [] });
        showToast("Squad Member Joined", `${msg.peer.name} joined the squad!`, "info", 4000);
        notifyStateChange('squad_peer_joined', msg.peer);
        return;
    }

    if (type === 'peer_left') {
        const peer = state.squad.peers.get(msg.peerId);
        const name = peer ? peer.name : 'Squad Member';
        state.squad.peers.delete(msg.peerId);
        showToast("Squad Member Left", `${name} left the room.`, "warning", 3000);
        notifyStateChange('squad_peer_left', msg.peerId);
        return;
    }

    if (type === 'telemetry_broadcast') {
        const peer = state.squad.peers.get(msg.id);
        if (peer) {
            peer.x = msg.x;
            peer.y = msg.y;
            peer.z = msg.z;
            peer.dirX = msg.dirX;
            peer.dirY = msg.dirY;
            peer.speed = msg.speed;
            peer.lastSeen = msg.t;
            peer.angle = Math.atan2(msg.dirY || 1, msg.dirX || 0);

            if (!peer.trail) peer.trail = [];
            peer.trail.push({ x: msg.x, y: msg.y, t: msg.t });
            if (peer.trail.length > 150) peer.trail.shift();
        }
        return;
    }

    if (type === 'squad_ping_broadcast') {
        state.squad.pings.push(msg);
        showToast("Squad Ping", `${msg.authorName}: ${msg.text}`, "info", 4000);
        notifyStateChange('squad_ping', msg);
        setTimeout(() => {
            state.squad.pings = state.squad.pings.filter(p => p.id !== msg.id);
        }, 15000);
        return;
    }

    if (type === 'error') {
        showToast("Squad Error", msg.message || "An error occurred in squad relay.", "error", 5000);
    }
}

function startTelemetryLoop() {
    if (telemetryInterval) clearInterval(telemetryInterval);
    telemetryInterval = setInterval(() => {
        if (!ws || ws.readyState !== WebSocket.OPEN || !state.squad.roomCode) return;
        if (!state.livePlayer.online) return;

        ws.send(JSON.stringify({
            type: 'telemetry',
            x: state.livePlayer.x,
            y: state.livePlayer.y,
            z: state.livePlayer.z,
            dirX: state.livePlayer.dirX,
            dirY: state.livePlayer.dirY,
            speed: state.livePlayer.speed || 0
        }));
    }, 50); // 20 Hz
}

function stopTelemetryLoop() {
    if (telemetryInterval) {
        clearInterval(telemetryInterval);
        telemetryInterval = null;
    }
}
