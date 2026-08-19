// Scrap Mechanic Tactical Map Viewer - Main Entry Point
import { state, subscribe } from './core/state.js';
import { initCanvasEngine } from './features/map_renderer/canvas_engine.js';
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
        hudGameDays: document.getElementById('hudGameDays')
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

    // 3. Setup Reset & Follow camera buttons
    if (elements.resetViewBtn) elements.resetViewBtn.addEventListener('click', resetCameraView);
    if (elements.followPlayerBtn) {
        elements.followPlayerBtn.addEventListener('click', () => {
            state.followPlayer = !state.followPlayer;
            elements.followPlayerBtn.classList.toggle('active', state.followPlayer);
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
    setupCameraControls(elements.canvas, elements.viewport, () => {});

    // 5. Initialize SQL Engine & Auto-sync save
    await initSqlEngine();
    await syncActiveSave(true);

    // 6. Start Live Player Polling
    startLivePoller();

    // 7. Subscribe to live player state to update badges & gadgets
    subscribe((type, payload) => {
        if (type === 'live_player_update') {
            if (elements.radarContainer) {
                elements.radarContainer.classList.remove('hidden');
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
                const deg = -(payload.angle * 180 / Math.PI) + 90;
                elements.compassNeedle.style.transform = `rotate(${deg}deg)`;
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
        }
    });

    console.log("[App] Initialization complete.");
}

window.addEventListener('DOMContentLoaded', bootstrap);
