const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    isElectron: true,
    platform: process.platform,
    getSurvivalSaves: () => ipcRenderer.invoke('get-survival-saves'),
    readActiveSave: (saveName) => ipcRenderer.invoke('read-active-save', saveName),
    fetchLivePlayer: () => ipcRenderer.invoke('fetch-live-player'),
    retryLivePlayer: () => ipcRenderer.invoke('retry-live-player'),
    generateTerrain: (seed) => ipcRenderer.invoke('generate-terrain', seed),
    getGameDirectory: () => ipcRenderer.invoke('get-game-directory'),
    selectGameDirectory: () => ipcRenderer.invoke('select-game-directory'),
    checkRadarInstalled: () => ipcRenderer.invoke('check-radar-installed'),
    installRadarFiles: () => ipcRenderer.invoke('install-radar-files'),
    restartGame: () => ipcRenderer.invoke('restart-game'),
    onActiveSaveUpdated: (callback) => {
        const handler = (event, data) => callback(data);
        ipcRenderer.on('active-save-updated', handler);
        return () => ipcRenderer.removeListener('active-save-updated', handler);
    },
    // In-Game Radar Overlay APIs
    toggleRadarOverlay: (forceState) => ipcRenderer.invoke('toggle-radar-overlay', forceState),
    getRadarOverlayStatus: () => ipcRenderer.invoke('get-radar-overlay-status'),
    setRadarOverlayInteractive: (interactive) => ipcRenderer.invoke('set-radar-overlay-interactive', interactive),
    updateRadarOverlayShortcut: (keybind) => ipcRenderer.invoke('update-radar-overlay-shortcut', keybind),
    saveRadarOverlayBounds: (bounds) => ipcRenderer.invoke('save-radar-overlay-bounds', bounds),
    syncDataToOverlay: (payload) => ipcRenderer.invoke('sync-data-to-overlay', payload),
    onRadarOverlayData: (callback) => {
        const handler = (event, data) => callback(data);
        ipcRenderer.on('radar-overlay-data', handler);
        return () => ipcRenderer.removeListener('radar-overlay-data', handler);
    },
    onRadarOverlayModeChanged: (callback) => {
        const handler = (event, data) => callback(data);
        ipcRenderer.on('overlay-mode-changed', handler);
        return () => ipcRenderer.removeListener('overlay-mode-changed', handler);
    },
    // Display Mode & In-Game Full Map Overlay APIs
    setDisplayMode: (mode) => ipcRenderer.invoke('set-display-mode', mode),
    getDisplayMode: () => ipcRenderer.invoke('get-display-mode'),
    updateMapOverlayShortcut: (keybind) => ipcRenderer.invoke('update-map-overlay-shortcut', keybind),
    hideMapOverlay: () => ipcRenderer.invoke('hide-map-overlay'),
    onDisplayModeChanged: (callback) => {
        const handler = (event, data) => callback(data);
        ipcRenderer.on('display-mode-changed', handler);
        return () => ipcRenderer.removeListener('display-mode-changed', handler);
    },
    onMapOverlaySummoned: (callback) => {
        const handler = (event, data) => callback(data);
        ipcRenderer.on('map-overlay-summoned', handler);
        return () => ipcRenderer.removeListener('map-overlay-summoned', handler);
    },
    // Window Frame Controls
    minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
    maximizeWindow: () => ipcRenderer.invoke('window-maximize'),
    closeWindow: () => ipcRenderer.invoke('window-close'),
    isWindowMaximized: () => ipcRenderer.invoke('is-window-maximized')
});
