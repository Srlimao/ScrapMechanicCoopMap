// Scrap Mechanic Tactical Map Viewer - Main Entry Point
import { state, subscribe } from './core/state.js';
import { initCanvasEngine, requestRender } from './features/map_renderer/canvas_engine.js';
import { setupCameraControls, resetCameraView } from './features/map_renderer/camera.js';
import { startLivePoller } from './features/live_tracker/live_poller.js';
import { initSqlEngine } from './features/save_loader/sqlite_decoder.js';
import { syncActiveSave, setupFileUploadHandlers } from './features/save_loader/save_sync.js';
import { setupInspectorSidebar } from './features/inspector/sidebar.js';
import { setupHoverTooltip } from './features/inspector/hover_tooltip.js';
import { setupBookmarks } from './features/tools/bookmarks.js';
import { setupSearch } from './features/tools/search.js';
import { setupRulerTool } from './features/tools/ruler.js';
import { setupScreenshotExporter } from './features/tools/screenshot.js';
import { loadSettings, setupLayerControls, setupSettingsModal } from './features/tools/settings.js';
import { setupSeedGeneratorControls } from './features/tools/seed_generator.js';
import { setupSquadControls } from './features/squad/squad_ui.js';
import { initToastContainer } from './ui/toasts.js';
import { setupModals } from './ui/modals.js';
import { setupRadar } from './features/map_renderer/radar.js';

async function bootstrap() {
    console.log("[App] Bootstrapping Scrap Mechanic Tactical Map Viewer...");

    // 1. Initialize DOM references
    const elements = {
        canvas: document.getElementById('mapCanvas'),
        minimapCanvas: document.getElementById('minimapCanvas'),
        viewport: document.getElementById('mapViewport'),
        uploadBtn: document.getElementById('uploadBtn'),
        fileInput: document.getElementById('fileInput'),
        dropOverlay: document.getElementById('dropOverlay'),
        searchInput: document.getElementById('searchInput'),
        searchResults: document.getElementById('searchResults'),
        clearSearch: document.getElementById('clearSearch'),
        detailSidebar: document.getElementById('detailSidebar'),
        detailTitle: document.getElementById('detailTitle'),
        detailSubtitle: document.getElementById('detailSubtitle'),
        detailBody: document.getElementById('detailBody'),
        inspectorHeroIcon: document.getElementById('inspectorHeroIcon'),
        closeSidebarBtn: document.getElementById('closeSidebarBtn'),
        helpModal: document.getElementById('helpModal'),
        infoBtn: document.getElementById('infoBtn'),
        closeHelpModal: document.getElementById('closeHelpModal'),
        toggleCoordsBtn: document.getElementById('toggleCoordsBtn'),
        followPlayerBtn: document.getElementById('followPlayerBtn'),
        livePlayerBadge: document.getElementById('livePlayerBadge'),
        liveStatusText: document.getElementById('liveStatusText'),
        playerSpeedBadge: document.getElementById('playerSpeedBadge'),
        rulerToolBtn: document.getElementById('rulerToolBtn'),
        rulerHud: document.getElementById('rulerHud'),
        rulerStats: document.getElementById('rulerStats'),
        closeRulerBtn: document.getElementById('closeRulerBtn'),
        exportBtn: document.getElementById('exportBtn'),
        mapOpacitySlider: document.getElementById('mapOpacitySlider'),
        mapOpacityVal: document.getElementById('mapOpacityVal'),
        hoverTooltip: document.getElementById('hoverTooltip'),
        tooltipTitle: document.getElementById('tooltipTitle'),
        tooltipCoords: document.getElementById('tooltipCoords'),
        resetViewBtn: document.getElementById('resetViewBtn'),
        toggleAllLayers: document.getElementById('toggleAllLayers'),
        seedInput: document.getElementById('seedInput'),
        btnGenSeed: document.getElementById('btnGenSeed'),
        btnLoadReferenceSeed: document.getElementById('btnLoadReferenceSeed'),
        btnClearCache: document.getElementById('btnClearCache'),
        seedGenStatus: document.getElementById('seedGenStatus'),
        compassNeedle: document.getElementById('compassNeedle'),
        radarContainer: document.getElementById('radarModuleContainer'),
        hudGameTime: document.getElementById('hudGameTime'),
        hudGameDays: document.getElementById('hudGameDays'),
        bmPlayer: document.getElementById('bmPlayer'),
        bmMechanic: document.getElementById('bmMechanic'),
        bmTrader: document.getElementById('bmTrader'),
        bmPacking: document.getElementById('bmPacking'),
        bmCreations: document.getElementById('bmCreations'),
        bmBosses: document.getElementById('bmBosses')
    };

    // 2. Initialize UI, Settings & Controls
    initToastContainer();
    loadSettings();
    setupLayerControls(elements);
    setupSettingsModal();
    setupModals(elements);
    setupBookmarks(elements);
    setupSearch(elements);
    setupRulerTool(elements, elements.canvas);
    setupScreenshotExporter(elements.exportBtn, elements.canvas);
    setupInspectorSidebar(elements);
    setupHoverTooltip(elements, elements.canvas);
    setupFileUploadHandlers(elements.uploadBtn, elements.fileInput, elements.dropOverlay);
    setupSeedGeneratorControls(elements);
    setupSquadControls();

    // 3. Setup Reset, Follow, and Coordinates toggle buttons
    if (elements.resetViewBtn) elements.resetViewBtn.addEventListener('click', resetCameraView);
    if (elements.followPlayerBtn) {
        elements.followPlayerBtn.addEventListener('click', () => {
            state.followPlayer = !state.followPlayer;
            elements.followPlayerBtn.classList.toggle('active', state.followPlayer);
        });
    }
    if (elements.toggleCoordsBtn) {
        elements.toggleCoordsBtn.addEventListener('click', () => {
            state.showCoordinates = !state.showCoordinates;
            elements.toggleCoordsBtn.classList.toggle('active', state.showCoordinates);
            const hud = document.getElementById('coordsHud') || document.getElementById('coordsHUD');
            if (hud) hud.classList.toggle('hidden', !state.showCoordinates);
            const cfgShow = document.getElementById('cfgShowCoordinates');
            if (cfgShow) cfgShow.checked = state.showCoordinates;
            import('./features/tools/settings.js').then(({ saveSettings }) => {
                saveSettings();
            });
        });
    }

    const btnRetryLive = document.getElementById('btnRetryLive');
    if (btnRetryLive) {
        btnRetryLive.addEventListener('click', (e) => {
            e.stopPropagation();
            import('./features/live_tracker/live_poller.js').then(({ retryLiveConnection }) => {
                retryLiveConnection();
            });
        });
    }

    // 4. Initialize Canvas Engine, Radar & Camera
    initCanvasEngine(elements.canvas, elements.minimapCanvas);
    setupRadar(elements.minimapCanvas);
    setupCameraControls(elements.canvas, elements.viewport, requestRender);

    // 5. Initialize Display Mode Selector in Header
    const displayModeSelector = document.getElementById('displayModeSelector');
    if (displayModeSelector) {
        displayModeSelector.addEventListener('click', (e) => {
            const btn = e.target.closest('.mode-btn');
            if (!btn) return;
            const mode = btn.dataset.mode;
            import('./features/tools/settings.js').then(({ applyDisplayMode }) => {
                applyDisplayMode(mode);
            });
        });
    }

    // 6. Window Controls (Frameless Title Bar)
    const btnWinMin = document.getElementById('btnWinMin');
    const btnWinMax = document.getElementById('btnWinMax');
    const btnWinClose = document.getElementById('btnWinClose');

    if (btnWinMin && window.electronAPI && typeof window.electronAPI.minimizeWindow === 'function') {
        btnWinMin.addEventListener('click', () => window.electronAPI.minimizeWindow());
    }
    if (btnWinMax && window.electronAPI && typeof window.electronAPI.maximizeWindow === 'function') {
        btnWinMax.addEventListener('click', async () => {
            const res = await window.electronAPI.maximizeWindow();
            const icon = btnWinMax.querySelector('i');
            if (icon && res) {
                icon.className = res.isMaximized ? 'fa-regular fa-window-restore' : 'fa-regular fa-square';
            }
        });
    }
    if (btnWinClose && window.electronAPI && typeof window.electronAPI.closeWindow === 'function') {
        btnWinClose.addEventListener('click', () => window.electronAPI.closeWindow());
    }

    // 7. Return to Game Button & Global Keydown Listener for In-Game Map Overlay Dismissal (Escape or M)
    const btnReturnToGame = document.getElementById('btnReturnToGame');
    if (btnReturnToGame) {
        btnReturnToGame.addEventListener('click', () => {
            if (window.electronAPI && typeof window.electronAPI.hideMapOverlay === 'function') {
                window.electronAPI.hideMapOverlay();
            }
        });
    }

    window.addEventListener('keydown', (e) => {
        if (state.displayMode === 'all-in-game') {
            const mapKey = (state.mapOverlayShortcut || 'M').toUpperCase();
            const pressedKey = e.key.toUpperCase();
            
            const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
            const isTyping = activeTag === 'input' || activeTag === 'textarea';

            if (e.key === 'Escape' || (!isTyping && pressedKey === mapKey)) {
                if (window.electronAPI && typeof window.electronAPI.hideMapOverlay === 'function') {
                    e.preventDefault();
                    window.electronAPI.hideMapOverlay();
                }
            }
        }
    });

    // 7. Initialize SQL Engine & Auto-sync save
    await initSqlEngine();
    await syncActiveSave(true);

    // 8. Start Live Player Polling
    startLivePoller();

    // 9. Subscribe to live player state to update badges & gadgets
    let currentCompassAngle = 0;
    subscribe((type, payload) => {
        if (type === 'live_player_update') {
            if (elements.radarContainer) {
                if (state.displayMode === 'in-app') {
                    elements.radarContainer.classList.remove('hidden');
                } else {
                    elements.radarContainer.classList.add('hidden');
                }
            }
            if (elements.livePlayerBadge) {
                elements.livePlayerBadge.className = 'live-player-badge online';
            }
            if (elements.liveStatusText) {
                elements.liveStatusText.textContent = `LIVE: (${payload.x.toFixed(0)}, ${payload.y.toFixed(0)})`;
            }
            if (elements.playerSpeedBadge) {
                elements.playerSpeedBadge.textContent = `${(payload.speed || 0).toFixed(1)} m/s`;
            }
            if (elements.compassNeedle && payload.angle !== undefined) {
                const targetDeg = -(payload.angle * 180 / Math.PI) + 90;
                let diff = (targetDeg - currentCompassAngle) % 360;
                if (diff > 180) diff -= 360;
                if (diff < -180) diff += 360;
                currentCompassAngle += diff;
                elements.compassNeedle.style.transform = `rotate(${currentCompassAngle}deg)`;
            }
            if (payload.age && elements.hudGameTime && elements.hudGameDays) {
                const totalMinutes = Math.floor(payload.age * 24 * 60);
                const day = Math.floor(payload.age);
                const hours = Math.floor((totalMinutes % 1440) / 60);
                const mins = totalMinutes % 60;
                elements.hudGameTime.textContent = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
                elements.hudGameDays.textContent = `${day}`;
            }
        } else if (type === 'live_player_offline') {
            if (elements.radarContainer) {
                elements.radarContainer.classList.add('hidden');
            }
            if (elements.livePlayerBadge) {
                elements.livePlayerBadge.className = 'live-player-badge offline';
            }
            if (elements.liveStatusText) {
                elements.liveStatusText.textContent = 'LIVE: OFFLINE';
            }
        } else if (type === 'display_mode_changed') {
            if (elements.radarContainer) {
                if (payload.mode === 'in-app') {
                    elements.radarContainer.classList.toggle('hidden', !state.livePlayer.online);
                } else {
                    elements.radarContainer.classList.add('hidden');
                }
            }
            if (btnReturnToGame) {
                btnReturnToGame.style.display = payload.mode === 'all-in-game' ? 'inline-flex' : 'none';
            }
        }

        // Forward save and settings updates to In-Game Radar Overlay
        if (window.electronAPI && typeof window.electronAPI.syncDataToOverlay === 'function') {
            if (type === 'save_loaded' || type === 'active_save_loaded' || type === 'subfilter_pois' || type === 'subfilter_units' || type === 'radar_range' || type === 'radar_mode') {
                window.electronAPI.syncDataToOverlay({
                    mapData: state.mapData,
                    radarRange: state.radarRange,
                    radarBlipScale: state.radarBlipScale,
                    radarVerticalBand: state.radarVerticalBand,
                    radarMode: state.radarMode
                });
            }
        }
    });

    if (window.electronAPI && typeof window.electronAPI.onRadarOverlayModeChanged === 'function') {
        window.electronAPI.onRadarOverlayModeChanged((data) => {
            const btnPopOut = document.getElementById('btnPopOutRadar');
            const cfgOverlayBtnText = document.getElementById('cfgOverlayBtnText');
            const isOpen = data && data.isOpen !== false;
            if (btnPopOut) btnPopOut.classList.toggle('active', isOpen);
            if (cfgOverlayBtnText) cfgOverlayBtnText.textContent = isOpen ? 'Close Overlay HUD' : 'Launch In-Game HUD';
        });
    }

    if (window.electronAPI && typeof window.electronAPI.onDisplayModeChanged === 'function') {
        window.electronAPI.onDisplayModeChanged((data) => {
            if (data && data.mode && data.mode !== state.displayMode) {
                import('./features/tools/settings.js').then(({ applyDisplayMode }) => {
                    applyDisplayMode(data.mode, true, false);
                });
            }
        });
    }

    if (window.electronAPI && typeof window.electronAPI.onMapOverlaySummoned === 'function') {
        window.electronAPI.onMapOverlaySummoned((data) => {
            if (btnReturnToGame) {
                btnReturnToGame.style.display = (data && data.isOpen) ? 'inline-flex' : 'none';
            }
        });
    }

    console.log("[App] Initialization complete.");
}

window.addEventListener('DOMContentLoaded', bootstrap);
