const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    isElectron: true,
    platform: process.platform,
    getSurvivalSaves: () => ipcRenderer.invoke('get-survival-saves'),
    readActiveSave: (saveName) => ipcRenderer.invoke('read-active-save', saveName),
    fetchLivePlayer: () => ipcRenderer.invoke('fetch-live-player'),
    retryLivePlayer: () => ipcRenderer.invoke('retry-live-player'),
    generateTerrain: (seed) => ipcRenderer.invoke('generate-terrain', seed),
    getGameDirectory: () => ipcRenderer.invoke('get-game-directory')
});
