// Squad Modal, Room Controls & Tactical Ping Interaction Controller
import { state, subscribe, notifyStateChange } from '../../core/state.js';
import { createSquadRoom, joinSquadRoom, disconnectFromRelayServer, sendSquadPing } from './relay_client.js';
import { screenToWorld, calculateDistance } from '../../core/coords.js';
import { jumpToLocation } from '../map_renderer/camera.js';
import { showToast } from '../../ui/toasts.js';

export function setupSquadControls() {
    const btnSquad = document.getElementById('btnSquadModal');
    const squadModal = document.getElementById('squadModal');
    const closeSquadModal = document.getElementById('closeSquadModal');

    const squadNickname = document.getElementById('squadNickname');
    const squadServerUrl = document.getElementById('squadServerUrl');
    const btnCreateRoom = document.getElementById('btnCreateRoom');
    const squadRoomInput = document.getElementById('squadRoomInput');
    const btnJoinRoom = document.getElementById('btnJoinRoom');
    const btnLeaveRoom = document.getElementById('btnLeaveRoom');

    const squadSetupPanel = document.getElementById('squadSetupPanel');
    const squadActivePanel = document.getElementById('squadActivePanel');
    const activeRoomCode = document.getElementById('activeRoomCode');
    const activeSeedDisplay = document.getElementById('activeSeedDisplay');
    const squadPeerList = document.getElementById('squadPeerList');
    const btnCopyRoomCode = document.getElementById('btnCopyRoomCode');

    // Color Pickers
    document.querySelectorAll('.squad-color-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.squad-color-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            state.squad.myColor = chip.dataset.color || '#00e5ff';
        });
    });

    if (btnSquad && squadModal) {
        btnSquad.addEventListener('click', () => {
            squadModal.classList.add('open');
            updateSquadModalView();
        });
    }

    if (closeSquadModal && squadModal) {
        closeSquadModal.addEventListener('click', () => {
            squadModal.classList.remove('open');
        });
    }

    if (btnCreateRoom) {
        btnCreateRoom.addEventListener('click', () => {
            const nick = squadNickname ? squadNickname.value.trim() : 'Player';
            const server = squadServerUrl ? squadServerUrl.value.trim() : 'ws://localhost:8090';
            state.squad.serverUrl = server;
            createSquadRoom(nick, state.squad.myColor);
        });
    }

    if (btnJoinRoom) {
        btnJoinRoom.addEventListener('click', () => {
            const code = squadRoomInput ? squadRoomInput.value.trim() : '';
            if (!code) {
                showToast("Missing Room Code", "Please enter a valid room code.", "warning");
                return;
            }
            const nick = squadNickname ? squadNickname.value.trim() : 'Player';
            const server = squadServerUrl ? squadServerUrl.value.trim() : 'ws://localhost:8090';
            state.squad.serverUrl = server;
            joinSquadRoom(code, nick, state.squad.myColor);
        });
    }

    if (btnLeaveRoom) {
        btnLeaveRoom.addEventListener('click', () => {
            disconnectFromRelayServer();
            showToast("Left Room", "Disconnected from squad room.", "info");
            updateSquadModalView();
        });
    }

    if (btnCopyRoomCode) {
        btnCopyRoomCode.addEventListener('click', () => {
            if (state.squad.roomCode) {
                navigator.clipboard.writeText(state.squad.roomCode);
                showToast("Code Copied", `Copied room code #${state.squad.roomCode} to clipboard!`, "success", 2000);
            }
        });
    }

    // Double-Click map canvas to drop tactical ping
    const canvas = document.getElementById('mapCanvas');
    if (canvas) {
        canvas.addEventListener('dblclick', (e) => {
            if (!state.squad.roomCode) return;
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const worldPos = screenToWorld(mouseX, mouseY, canvas.width, canvas.height);
            sendSquadPing(Math.round(worldPos.x), Math.round(worldPos.y), "Squad Ping!", "alert");
        });
    }

    // Subscribe to state changes to update squad UI badges & modal
    subscribe((type) => {
        if (type.startsWith('squad_')) {
            updateSquadHeaderBadge();
            updateSquadModalView();
        }
    });

    function updateSquadHeaderBadge() {
        const badge = document.getElementById('squadStatusBadge');
        if (!badge) return;

        if (state.squad.roomCode) {
            const count = state.squad.peers.size + 1;
            badge.className = 'squad-badge online';
            badge.innerHTML = `<i class="fa-solid fa-users"></i> #${state.squad.roomCode} (${count})`;
        } else {
            badge.className = 'squad-badge offline';
            badge.innerHTML = `<i class="fa-solid fa-users-slash"></i> Squad: Offline`;
        }
    }

    function updateSquadModalView() {
        if (!squadSetupPanel || !squadActivePanel) return;

        if (state.squad.roomCode) {
            squadSetupPanel.style.display = 'none';
            squadActivePanel.style.display = 'block';
            if (activeRoomCode) activeRoomCode.textContent = `#${state.squad.roomCode}`;
            if (activeSeedDisplay) activeSeedDisplay.textContent = state.mapData?.gameInfo?.seed || '-';
            renderPeerRoster();
        } else {
            squadSetupPanel.style.display = 'block';
            squadActivePanel.style.display = 'none';
        }
    }

    function renderPeerRoster() {
        if (!squadPeerList) return;
        squadPeerList.innerHTML = '';

        // Local Player item
        const myItem = document.createElement('div');
        myItem.className = 'squad-peer-card';
        myItem.innerHTML = `
            <div class="peer-dot" style="background:${state.squad.myColor}; box-shadow:0 0 8px ${state.squad.myColor};"></div>
            <div class="peer-info">
                <span class="peer-name">${state.squad.myNickname} (You)</span>
                <span class="peer-status">${state.livePlayer.online ? 'Online' : 'Game Offline'}</span>
            </div>
            ${state.squad.isHost ? '<span class="host-pill">HOST</span>' : ''}
        `;
        squadPeerList.appendChild(myItem);

        // Peers
        for (const [id, peer] of state.squad.peers.entries()) {
            const item = document.createElement('div');
            item.className = 'squad-peer-card';

            let distText = '';
            if (state.livePlayer.online && peer.x !== undefined) {
                const dist = calculateDistance(state.livePlayer.x, state.livePlayer.y, peer.x, peer.y);
                distText = `${dist.toFixed(0)}m away`;
            }

            item.innerHTML = `
                <div class="peer-dot" style="background:${peer.color || '#00e5ff'}; box-shadow:0 0 8px ${peer.color || '#00e5ff'};"></div>
                <div class="peer-info">
                    <span class="peer-name">${peer.name}</span>
                    <span class="peer-status">${distText || 'Connected'}</span>
                </div>
                <button class="btn btn-action-sm btn-jump-peer" title="Jump camera to ${peer.name}">
                    <i class="fa-solid fa-crosshairs"></i> Jump
                </button>
            `;

            const jumpBtn = item.querySelector('.btn-jump-peer');
            if (jumpBtn) {
                jumpBtn.addEventListener('click', () => {
                    jumpToLocation(peer.x, peer.y, 0.08);
                    if (squadModal) squadModal.classList.remove('open');
                });
            }

            squadPeerList.appendChild(item);
        }
    }
}
