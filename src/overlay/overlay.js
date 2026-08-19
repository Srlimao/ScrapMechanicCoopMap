// In-Game Radar Holographic HUD Controller
import { state } from '../core/state.js';
import { renderRadar } from '../features/map_renderer/radar.js';

const canvas = document.getElementById('overlayRadarCanvas');
const ctx = canvas ? canvas.getContext('2d') : null;
const container = document.getElementById('overlayContainer');
const btnLock = document.getElementById('btnLockOverlay');
const lockKeyText = document.getElementById('lockKeyText');
const hintBanner = document.getElementById('hintBanner');
const btnClose = document.getElementById('btnCloseOverlay');
const opacitySlider = document.getElementById('opacitySlider');
const rangeButtons = document.querySelectorAll('[data-range]');

let currentShortcut = 'F9';
let isEditMode = false;
let hintTimeout = null;

// Adjust canvas resolution dynamically based on container size
function resizeCanvas() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const size = Math.max(160, Math.min(rect.width, rect.height));
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// 60 FPS Radar Animation Loop
function animationLoop() {
    if (ctx && canvas) {
        const dpr = window.devicePixelRatio || 1;
        const logicalWidth = canvas.width / dpr;
        const logicalHeight = canvas.height / dpr;
        renderRadar(ctx, canvas, logicalWidth, logicalHeight);
    }
    requestAnimationFrame(animationLoop);
}

// Adaptive Telemetry Poller (1 Hz idle / 33 Hz active)
let pollTimer = null;
async function pollTelemetry() {
    try {
        if (window.electronAPI && typeof window.electronAPI.fetchLivePlayer === 'function') {
            const data = await window.electronAPI.fetchLivePlayer();
            if (data) {
                state.livePlayer.online = Boolean(data.online);
                if (data.online) {
                    state.livePlayer.x = data.x;
                    state.livePlayer.y = data.y;
                    state.livePlayer.z = data.z;
                    state.livePlayer.dirX = data.dirX || 0;
                    state.livePlayer.dirY = data.dirY || 1;
                    state.livePlayer.dirZ = data.dirZ || 0;
                    state.livePlayer.angle = Math.atan2(data.dirY || 1, data.dirX || 0);
                    state.livePlayer.bots = Array.isArray(data.bots) ? data.bots : [];
                    state.livePlayer.creations = Array.isArray(data.creations) ? data.creations : [];
                    state.livePlayer.stats = data.stats || {};
                }
            }
        }
    } catch (e) {}

    const nextDelay = state.livePlayer.online ? 30 : 1000;
    pollTimer = setTimeout(pollTelemetry, nextDelay);
}

function showHintBanner(text) {
    if (!hintBanner) return;
    if (hintTimeout) clearTimeout(hintTimeout);
    hintBanner.textContent = text;
    hintBanner.classList.add('show');
    hintTimeout = setTimeout(() => {
        hintBanner.classList.remove('show');
    }, 3200);
}

function setEditMode(active, shortcut = currentShortcut) {
    isEditMode = active;
    currentShortcut = shortcut || 'F9';
    if (lockKeyText) {
        lockKeyText.textContent = `LOCK (${currentShortcut})`;
    }

    if (active) {
        container.classList.add('edit-mode');
    } else {
        container.classList.remove('edit-mode');
        showHintBanner(`HUD LOCKED • Press ${currentShortcut} to Edit`);
    }
}

// Setup Event Listeners
function setupEvents() {
    window.addEventListener('resize', resizeCanvas);

    if (btnLock) {
        btnLock.addEventListener('click', () => {
            if (window.electronAPI && typeof window.electronAPI.setRadarOverlayInteractive === 'function') {
                window.electronAPI.setRadarOverlayInteractive(false);
            }
            setEditMode(false);
        });
    }

    if (btnClose) {
        btnClose.addEventListener('click', () => {
            if (window.electronAPI && typeof window.electronAPI.toggleRadarOverlay === 'function') {
                window.electronAPI.toggleRadarOverlay(false);
            }
        });
    }

    rangeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const range = parseInt(btn.getAttribute('data-range'), 10);
            if (!isNaN(range)) {
                state.radarRange = range;
                rangeButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            }
        });
    });

    if (opacitySlider) {
        opacitySlider.addEventListener('input', (e) => {
            const val = e.target.value / 100;
            if (canvas) canvas.style.opacity = String(val);
        });
    }

    // IPC Listeners
    if (window.electronAPI) {
        if (typeof window.electronAPI.onRadarOverlayModeChanged === 'function') {
            window.electronAPI.onRadarOverlayModeChanged((data) => {
                setEditMode(Boolean(data.editMode), data.shortcut);
            });
        }

        if (typeof window.electronAPI.onRadarOverlayData === 'function') {
            window.electronAPI.onRadarOverlayData((payload) => {
                if (payload.mapData) state.mapData = payload.mapData;
                if (payload.radarRange) state.radarRange = payload.radarRange;
                if (payload.radarBlipScale) state.radarBlipScale = payload.radarBlipScale;
                if (payload.radarVerticalBand) state.radarVerticalBand = payload.radarVerticalBand;
                if (payload.radarMode) state.radarMode = payload.radarMode;
            });
        }

        // Get initial overlay status
        if (typeof window.electronAPI.getRadarOverlayStatus === 'function') {
            window.electronAPI.getRadarOverlayStatus().then(status => {
                if (status) {
                    currentShortcut = status.shortcut || 'F9';
                    setEditMode(Boolean(status.editMode), status.shortcut);
                }
            });
        }
    }
}

// Initialization
function init() {
    state.radarMode = 'player';
    state.radarRange = 150;
    resizeCanvas();
    setupEvents();
    animationLoop();
    pollTelemetry();
}

document.addEventListener('DOMContentLoaded', init);
