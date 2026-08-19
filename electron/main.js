const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { getSurvivalSaves, snapshotActiveSave, findGameDirectory, setCustomGameDirectory, checkRadarInstalled, installRadarFiles, restartGame } = require('./game_scanner');
const { NodeMemoryReader } = require('./memory_reader');

let mainWindow = null;
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

app.whenReady().then(() => {
    memoryReader.start(60);
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('will-quit', () => {
    if (memoryReader) memoryReader.stop();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
