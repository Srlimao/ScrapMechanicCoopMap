const { app, BrowserWindow, ipcMain, Menu, globalShortcut, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { getSurvivalSaves, snapshotActiveSave, findGameDirectory, setCustomGameDirectory, checkRadarInstalled, installRadarFiles, restartGame } = require('./game_scanner');
const { NodeMemoryReader } = require('./memory_reader');

let mainWindow = null;
let overlayWindow = null;
let overlayBounds = { x: null, y: null, width: 340, height: 340 };
let overlayShortcut = 'F9';
let mapOverlayShortcut = 'M';
let activeDisplayMode = 'in-app'; // 'in-app', 'radar-in-game', 'all-in-game'
let isOverlayEditMode = false;
let isMapOverlayActive = false;

const memoryReader = new NodeMemoryReader();
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function getBackendDir() {
    if (app.isPackaged) {
        const unpacked = path.join(process.resourcesPath, 'app.asar.unpacked');
        if (fs.existsSync(path.join(unpacked, 'terrain_builder.py'))) return unpacked;
        const resPath = path.join(process.resourcesPath);
        if (fs.existsSync(path.join(resPath, 'terrain_builder.py'))) return resPath;
    }
    const appDir = path.resolve(__dirname, '..');
    if (fs.existsSync(path.join(appDir, 'terrain_builder.py'))) return appDir;
    return process.cwd();
}

let user32 = null;
let FindWindowA = null;
let SetForegroundWindow = null;
let ShowWindow = null;
let GetForegroundWindow = null;
let GetWindowTextA = null;
let GetWindowThreadProcessId = null;

try {
    const koffi = require('koffi');
    user32 = koffi.load('user32.dll');
    FindWindowA = user32.func('void* FindWindowA(str lpClassName, str lpWindowName)');
    SetForegroundWindow = user32.func('bool SetForegroundWindow(void* hWnd)');
    ShowWindow = user32.func('bool ShowWindow(void* hWnd, int nCmdShow)');
    GetForegroundWindow = user32.func('void* GetForegroundWindow()');
    GetWindowTextA = user32.func('int GetWindowTextA(void* hWnd, _Out_ uint8_t *lpString, int nMaxCount)');
    GetWindowThreadProcessId = user32.func('uint32_t GetWindowThreadProcessId(void* hWnd, _Out_ uint32_t *lpdwProcessId)');
} catch (e) {}

function isGameOrOverlayFocused() {
    try {
        // If our overlay or mainWindow itself is focused, allow shortcut so user can close/toggle it
        if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused()) return true;
        if (overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isFocused()) return true;

        if (GetForegroundWindow) {
            const fgHwnd = GetForegroundWindow();
            if (!fgHwnd) return false;

            // 1. Check window title of focused window
            if (GetWindowTextA) {
                const buf = Buffer.alloc(256);
                const len = GetWindowTextA(fgHwnd, buf, 256);
                if (len > 0) {
                    const title = buf.toString('utf8', 0, len);
                    if (title.includes('Scrap Mechanic') || title.includes('ScrapMechanic')) {
                        return true;
                    }
                }
            }

            // 2. Check process PID of focused window
            if (GetWindowThreadProcessId && memoryReader && memoryReader.pid) {
                const outPid = [0];
                GetWindowThreadProcessId(fgHwnd, outPid);
                if (outPid[0] === memoryReader.pid) {
                    return true;
                }
            }
        }
    } catch (e) {
        return true;
    }
    return false;
}

function refreshGlobalShortcuts() {
    try {
        globalShortcut.unregisterAll();

        // 1. Register F9 (Radar Edit Mode) if in 'radar-in-game' or 'all-in-game'
        if ((activeDisplayMode === 'radar-in-game' || activeDisplayMode === 'all-in-game') && overlayShortcut) {
            const success = globalShortcut.register(overlayShortcut, () => {
                if (!isGameOrOverlayFocused()) return;
                toggleOverlayEditMode();
            });
            if (success) {
                console.log(`[Electron] Registered Radar shortcut: ${overlayShortcut} (game-focus only)`);
            }
        }

        // 2. Register M (Map Overlay Summon) if in 'all-in-game'
        if (activeDisplayMode === 'all-in-game' && mapOverlayShortcut) {
            const success = globalShortcut.register(mapOverlayShortcut, () => {
                if (!isGameOrOverlayFocused()) return;
                toggleMapOverlay();
            });
            if (success) {
                console.log(`[Electron] Registered Map Overlay shortcut: ${mapOverlayShortcut} (game-focus only)`);
            }
        }
    } catch (e) {
        console.error('[Electron] Error refreshing shortcuts:', e.message);
    }
}

function focusGameWindow() {
    try {
        let focused = false;
        if (FindWindowA && SetForegroundWindow) {
            const hWnd = FindWindowA(null, "Scrap Mechanic");
            if (hWnd) {
                if (ShowWindow) ShowWindow(hWnd, 9); // SW_RESTORE
                SetForegroundWindow(hWnd);
                focused = true;
            }
        }
        if (!focused) {
            const pid = (memoryReader && memoryReader.pid) ? memoryReader.pid : null;
            const target = pid || "'Scrap Mechanic'";
            const cmd = `powershell -NoProfile -Command "$ws = New-Object -ComObject Wscript.Shell; $ws.AppActivate(${target})"`;
            require('child_process').exec(cmd);
        }
    } catch (e) {
        console.warn('[Electron] Could not focus game window:', e.message);
    }
}

function toggleOverlayEditMode(forceMode) {
    if (!overlayWindow || overlayWindow.isDestroyed()) return;

    if (typeof forceMode === 'boolean') {
        isOverlayEditMode = forceMode;
    } else {
        isOverlayEditMode = !isOverlayEditMode;
    }

    if (isOverlayEditMode) {
        overlayWindow.setIgnoreMouseEvents(false);
        overlayWindow.focus();
    } else {
        overlayWindow.setIgnoreMouseEvents(true, { forward: true });
        focusGameWindow();
    }

    const payload = { editMode: isOverlayEditMode, shortcut: overlayShortcut };
    if (!overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send('overlay-mode-changed', payload);
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('overlay-mode-changed', payload);
    }
}

function toggleMapOverlay(forceState) {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    if (typeof forceState === 'boolean') {
        isMapOverlayActive = forceState;
    } else {
        isMapOverlayActive = !mainWindow.isVisible();
    }

    if (isMapOverlayActive) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.setAlwaysOnTop(true, 'screen-saver');
        mainWindow.focus();
        mainWindow.webContents.send('map-overlay-summoned', { isOpen: true, shortcut: mapOverlayShortcut });
        toggleOverlayEditMode(true);
    } else {
        mainWindow.setAlwaysOnTop(false);
        mainWindow.hide();
        mainWindow.webContents.send('map-overlay-summoned', { isOpen: false, shortcut: mapOverlayShortcut });
        toggleOverlayEditMode(false);
        focusGameWindow();
    }
}

function createOverlayWindow() {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.show();
        overlayWindow.focus();
        return overlayWindow;
    }

    // Default position: Top-Right corner of primary display if not previously positioned
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth } = primaryDisplay.workAreaSize;
    const defaultX = overlayBounds.x !== null ? overlayBounds.x : (screenWidth - 370);
    const defaultY = overlayBounds.y !== null ? overlayBounds.y : 30;

    overlayWindow = new BrowserWindow({
        width: overlayBounds.width || 320,
        height: overlayBounds.height || 320,
        x: defaultX,
        y: defaultY,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        hasShadow: false,
        skipTaskbar: true,
        resizable: true,
        backgroundColor: '#00000000',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            webSecurity: false
        }
    });

    overlayWindow.setAlwaysOnTop(true, 'screen-saver');
    overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    // Start in interactive Edit Mode so the user sees the header and can drag it immediately
    overlayWindow.setIgnoreMouseEvents(false);
    isOverlayEditMode = true;

    const appDir = path.resolve(__dirname, '..');
    const distOverlay = path.join(appDir, 'dist', 'overlay.html');
    const rootOverlay = path.join(appDir, 'overlay.html');

    if (isDev && process.env.VITE_DEV_SERVER_URL) {
        const devUrl = new URL('overlay.html', process.env.VITE_DEV_SERVER_URL).toString();
        overlayWindow.loadURL(devUrl);
    } else if (fs.existsSync(distOverlay)) {
        overlayWindow.loadFile(distOverlay);
    } else {
        overlayWindow.loadFile(rootOverlay);
    }

    overlayWindow.webContents.on('did-finish-load', () => {
        if (!overlayWindow || overlayWindow.isDestroyed()) return;
        overlayWindow.webContents.send('overlay-mode-changed', { editMode: true, shortcut: overlayShortcut });
    });

    overlayWindow.on('moved', () => {
        if (!overlayWindow || overlayWindow.isDestroyed()) return;
        const [x, y] = overlayWindow.getPosition();
        overlayBounds.x = x;
        overlayBounds.y = y;
    });

    overlayWindow.on('resized', () => {
        if (!overlayWindow || overlayWindow.isDestroyed()) return;
        const [width, height] = overlayWindow.getSize();
        overlayBounds.width = width;
        overlayBounds.height = height;
    });

    overlayWindow.on('closed', () => {
        overlayWindow = null;
        isOverlayEditMode = false;
        if (activeDisplayMode !== 'in-app') {
            activeDisplayMode = 'in-app';
            refreshGlobalShortcuts();
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('display-mode-changed', {
                    mode: 'in-app',
                    overlayOpen: false,
                    radarShortcut: overlayShortcut,
                    mapShortcut: mapOverlayShortcut
                });
            }
        }
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('overlay-mode-changed', { isOpen: false, editMode: false, shortcut: overlayShortcut });
        }
    });

    return overlayWindow;
}

function createWindow() {
    const iconPath = path.join(__dirname, 'icon.png');
    mainWindow = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        backgroundColor: '#080c14',
        title: 'Scrap Mechanic - Tactical Save Map Viewer',
        icon: fs.existsSync(iconPath) ? iconPath : undefined,
        frame: false,
        hasShadow: false,
        thickFrame: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            webSecurity: false
        }
    });

    Menu.setApplicationMenu(null);

    const appDir = path.resolve(__dirname, '..');
    const distIndex = path.join(appDir, 'dist', 'index.html');
    const rootIndex = path.join(appDir, 'index.html');

    if (isDev && process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    } else if (fs.existsSync(distIndex)) {
        mainWindow.loadFile(distIndex);
    } else {
        mainWindow.loadFile(rootIndex);
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
        if (overlayWindow && !overlayWindow.isDestroyed()) {
            overlayWindow.close();
        }
    });
}

// Background Auto-Sync Watcher
let trackedSave = {
    name: null,
    path: null,
    lastMTime: 0
};
let autoSyncTimer = null;

function startAutoSyncWatcher() {
    if (autoSyncTimer) return;
    autoSyncTimer = setInterval(async () => {
        if (!mainWindow || !trackedSave.path) return;

        // Only sync if the game process is running / active
        const isGameRunning = Boolean(memoryReader && memoryReader.isProcessOpen());
        if (!isGameRunning) return;

        if (!fs.existsSync(trackedSave.path)) return;

        try {
            const stat = fs.statSync(trackedSave.path);
            const mtime = stat.mtimeMs;
            if (mtime > trackedSave.lastMTime) {
                const cacheDir = getBackendDir();
                const res = snapshotActiveSave(cacheDir, trackedSave.name);
                if (res.success && res.filePath) {
                    trackedSave.lastMTime = mtime;
                    const buffer = fs.readFileSync(res.filePath);
                    mainWindow.webContents.send('active-save-updated', {
                        filename: res.filename,
                        data: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
                    });
                    console.log(`[AutoSync] Save updated in background: ${res.filename}`);
                } else if (res.error === "LOCKED") {
                    console.log(`[AutoSync] Save currently locked by game write, will retry on next tick.`);
                }
            }
        } catch (e) {}
    }, 5000); // 5-second interval
}

// IPC Handlers
ipcMain.handle('get-survival-saves', async () => getSurvivalSaves());

ipcMain.handle('read-active-save', async (event, saveName) => {
    const cacheDir = getBackendDir();
    const res = snapshotActiveSave(cacheDir, saveName);
    if (res.error) return { success: false, error: res.error };

    try {
        const buffer = fs.readFileSync(res.filePath);
        if (res.originalPath) {
            trackedSave.name = res.filename;
            trackedSave.path = res.originalPath;
            try {
                const stat = fs.statSync(res.originalPath);
                trackedSave.lastMTime = stat.mtimeMs;
            } catch (e) {
                trackedSave.lastMTime = Date.now();
            }
            startAutoSyncWatcher();
        }

        return {
            success: true,
            filename: res.filename,
            data: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
        };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('get-game-directory', async () => findGameDirectory());
ipcMain.handle('select-game-directory', async () => {
    const { dialog } = require('electron');
    const res = await dialog.showOpenDialog(mainWindow, {
        title: 'Select Scrap Mechanic Installation Directory',
        properties: ['openDirectory']
    });
    if (res.canceled || !res.filePaths || !res.filePaths.length) {
        return { canceled: true };
    }
    const selected = res.filePaths[0];
    const validated = setCustomGameDirectory(selected);
    if (!validated) {
        return { 
            success: false, 
            error: 'Selected directory does not contain ScrapMechanic.exe or Release/ScrapMechanic.exe. Please select the main "Scrap Mechanic" game folder.' 
        };
    }
    return { success: true, gameDir: validated };
});
ipcMain.handle('check-radar-installed', async () => checkRadarInstalled());
ipcMain.handle('install-radar-files', async () => installRadarFiles());
ipcMain.handle('restart-game', async () => restartGame());

ipcMain.handle('fetch-live-player', async () => {
    if (memoryReader && memoryReader.state.online) {
        return memoryReader.state;
    }

    const ports = [8000, 8080, 8081, 8888, 3000];
    for (const p of ports) {
        try {
            const res = await fetch(`http://localhost:${p}/api/player`);
            if (res.ok) {
                const data = await res.json();
                if (data.online) return data;
            }
        } catch (e) {}
    }

    return memoryReader.state;
});

ipcMain.handle('retry-live-player', async () => {
    if (memoryReader) {
        memoryReader.lastScanTime = 0;
        memoryReader.hProcess = null;
        memoryReader.tick();
        if (memoryReader.state.online) return memoryReader.state;
    }

    const ports = [8000, 8080, 8081, 8888, 3000];
    for (const p of ports) {
        try {
            const res = await fetch(`http://localhost:${p}/api/player`);
            if (res.ok) {
                const data = await res.json();
                if (data.online) return data;
            }
        } catch (e) {}
    }

    return memoryReader ? memoryReader.state : { online: false };
});

ipcMain.handle('generate-terrain', async (event, seed) => {
    const backendDir = getBackendDir();

    // 1. Check disk cache in save_cache/terrain_cells_<seed>.json
    const cacheFile = path.join(backendDir, 'save_cache', `terrain_cells_${seed}.json`);
    if (fs.existsSync(cacheFile)) {
        try {
            const raw = fs.readFileSync(cacheFile, 'utf-8');
            const cells = JSON.parse(raw);
            if (Array.isArray(cells) && cells.length > 0) {
                console.log(`[Electron] Loaded ${cells.length} cached cells for seed ${seed}`);
                return { success: true, seed, cells };
            }
        } catch (e) {}
    }

    // 2. Query local HTTP server if running
    const ports = [8000, 8080, 8081, 8888, 3000];
    for (const p of ports) {
        try {
            const res = await fetch(`http://localhost:${p}/api/terrain?seed=${seed}`);
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.cells) return data;
            }
        } catch (e) {}
    }

    // 3. Run Python terrain_builder.py CLI
    const pythonCandidates = ['python', 'py', 'python3', 'python.exe'];
    const scriptPath = path.join(backendDir, 'terrain_builder.py');

    if (fs.existsSync(scriptPath)) {
        const { execFileSync } = require('child_process');
        for (const pyCmd of pythonCandidates) {
            try {
                console.log(`[Electron] Running terrain generator for seed ${seed} using ${pyCmd}...`);
                const out = execFileSync(pyCmd, [scriptPath, '--seed', String(seed), '--json'], {
                    cwd: backendDir,
                    encoding: 'utf-8',
                    maxBuffer: 30 * 1024 * 1024
                });
                const lines = out.trim().split('\n');
                const jsonLine = lines.find(l => l.startsWith('{'));
                if (jsonLine) {
                    const parsed = JSON.parse(jsonLine);
                    if (parsed && parsed.success) {
                        console.log(`[Electron] Successfully generated ${parsed.cells.length} cells for seed ${seed}`);
                        return parsed;
                    }
                }
            } catch (e) {
                console.warn(`[Electron] Generator attempt with ${pyCmd} error:`, e.message);
            }
        }
    }

    return { success: false, error: "Terrain generator requires Python in system PATH" };
});

// Radar & Display Modes IPC Handlers
ipcMain.handle('set-display-mode', async (event, mode) => {
    if (!['in-app', 'radar-in-game', 'all-in-game'].includes(mode)) {
        return { success: false, mode: activeDisplayMode };
    }

    // Guard against redundant sets
    if (mode === activeDisplayMode) {
        return { success: true, mode: activeDisplayMode };
    }

    activeDisplayMode = mode;
    console.log(`[Electron] Active Display Mode set to: ${mode}`);

    if (mode === 'in-app') {
        if (overlayWindow && !overlayWindow.isDestroyed()) {
            overlayWindow.close();
        }
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setAlwaysOnTop(false);
            if (!mainWindow.isVisible()) mainWindow.show();
            mainWindow.focus();
        }
    } else if (mode === 'radar-in-game') {
        createOverlayWindow();
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setAlwaysOnTop(false);
            if (!mainWindow.isVisible()) mainWindow.show();
        }
    } else if (mode === 'all-in-game') {
        createOverlayWindow();
        if (mainWindow && !mainWindow.isDestroyed()) {
            isMapOverlayActive = false;
            mainWindow.setAlwaysOnTop(false);
            mainWindow.hide();
            focusGameWindow();
        }
    }

    refreshGlobalShortcuts();

    const payload = {
        mode: activeDisplayMode,
        overlayOpen: Boolean(overlayWindow && !overlayWindow.isDestroyed()),
        radarShortcut: overlayShortcut,
        mapShortcut: mapOverlayShortcut
    };

    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('display-mode-changed', payload);
    }
    if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send('display-mode-changed', payload);
    }

    return { success: true, mode: activeDisplayMode };
});

ipcMain.handle('get-display-mode', async () => {
    return {
        mode: activeDisplayMode,
        overlayOpen: Boolean(overlayWindow && !overlayWindow.isDestroyed()),
        radarShortcut: overlayShortcut,
        mapShortcut: mapOverlayShortcut
    };
});

ipcMain.handle('update-map-overlay-shortcut', async (event, keybind) => {
    if (keybind && typeof keybind === 'string') {
        mapOverlayShortcut = keybind.trim().toUpperCase();
        refreshGlobalShortcuts();
    }
    return { success: true, shortcut: mapOverlayShortcut };
});

ipcMain.handle('hide-map-overlay', async () => {
    if (activeDisplayMode === 'all-in-game') {
        toggleMapOverlay(false);
    }
    return { success: true };
});

ipcMain.handle('toggle-radar-overlay', async (event, forceState) => {
    let shouldOpen = false;
    if (typeof forceState === 'boolean') {
        shouldOpen = forceState;
    } else {
        shouldOpen = !overlayWindow || overlayWindow.isDestroyed();
    }

    if (shouldOpen) {
        createOverlayWindow();
        if (activeDisplayMode === 'in-app') activeDisplayMode = 'radar-in-game';
    } else if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.close();
        activeDisplayMode = 'in-app';
    }

    refreshGlobalShortcuts();
    return { 
        isOpen: Boolean(overlayWindow && !overlayWindow.isDestroyed()),
        editMode: isOverlayEditMode,
        shortcut: overlayShortcut,
        mode: activeDisplayMode
    };
});

ipcMain.handle('get-radar-overlay-status', async () => {
    return {
        isOpen: Boolean(overlayWindow && !overlayWindow.isDestroyed()),
        editMode: isOverlayEditMode,
        shortcut: overlayShortcut,
        bounds: overlayBounds
    };
});

ipcMain.handle('set-radar-overlay-interactive', async (event, interactive) => {
    toggleOverlayEditMode(interactive);
    return { editMode: isOverlayEditMode };
});

ipcMain.handle('update-radar-overlay-shortcut', async (event, keybind) => {
    if (keybind && typeof keybind === 'string') {
        overlayShortcut = keybind.trim().toUpperCase();
        refreshGlobalShortcuts();
    }
    return { success: true, shortcut: overlayShortcut };
});

ipcMain.handle('save-radar-overlay-bounds', async (event, bounds) => {
    if (bounds) {
        Object.assign(overlayBounds, bounds);
    }
    return { success: true, bounds: overlayBounds };
});

ipcMain.handle('sync-data-to-overlay', async (event, payload) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send('radar-overlay-data', payload);
    }
    return { success: true };
});

// Window Management IPC Handlers
ipcMain.handle('window-minimize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.minimize();
    }
    return { success: true };
});

ipcMain.handle('window-maximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
        return { success: true, isMaximized: mainWindow.isMaximized() };
    }
    return { success: false };
});

ipcMain.handle('window-close', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.close();
    }
    return { success: true };
});

ipcMain.handle('is-window-maximized', () => {
    return { isMaximized: Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isMaximized()) };
});

app.whenReady().then(() => {
    memoryReader.start(30);
    refreshGlobalShortcuts();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('will-quit', () => {
    try {
        globalShortcut.unregisterAll();
    } catch (e) {}
    if (memoryReader) memoryReader.stop();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

