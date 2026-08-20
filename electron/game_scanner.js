const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function scanDirectoryForSaves(dirPath, category, saves) {
    if (!fs.existsSync(dirPath)) return;
    try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                scanDirectoryForSaves(fullPath, entry.name, saves);
            } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.db')) {
                const stat = fs.statSync(fullPath);
                saves.push({
                    name: path.basename(entry.name, path.extname(entry.name)),
                    filename: entry.name,
                    category: category,
                    path: fullPath.replace(/\\/g, '/'),
                    size: stat.size,
                    mtime: stat.mtimeMs / 1000
                });
            }
        }
    } catch (e) {
        console.warn("[GameScanner] Error scanning directory:", dirPath, e.message);
    }
}

function getLinuxSteamRoots() {
    const home = process.env.HOME || '';
    if (!home) return [];
    const roots = [
        path.join(home, '.steam', 'steam'),
        path.join(home, '.steam', 'root'),
        path.join(home, '.local', 'share', 'Steam'),
        path.join(home, '.var', 'app', 'com.valvesoftware.Steam', '.local', 'share', 'Steam'),
        path.join(home, '.var', 'app', 'com.valvesoftware.Steam', '.steam', 'steam')
    ];
    return roots.filter(p => fs.existsSync(p));
}

function parseLibraryFoldersVdf(vdfPath) {
    const libraries = [];
    if (!fs.existsSync(vdfPath)) return libraries;
    try {
        const content = fs.readFileSync(vdfPath, 'utf-8');
        const lines = content.split('\n');
        for (const line of lines) {
            if (line.includes('"path"')) {
                const match = line.match(/"path"\s+"([^"]+)"/i);
                if (match && match[1]) {
                    const lib = match[1].replace(/\\\\/g, '/');
                    if (fs.existsSync(lib)) libraries.push(lib);
                }
            }
        }
    } catch (e) {}
    return libraries;
}

function getAllSteamLibraries() {
    const libs = new Set();
    if (process.platform === 'win32') {
        try {
            const regOut = execSync('reg query "HKCU\\Software\\Valve\\Steam" /v SteamPath', { encoding: 'utf-8' });
            const match = regOut.match(/SteamPath\s+REG_SZ\s+(.+)/i);
            if (match && match[1]) {
                const steamPath = match[1].trim();
                libs.add(steamPath);
                const vdf = path.join(steamPath, 'steamapps', 'libraryfolders.vdf');
                for (const l of parseLibraryFoldersVdf(vdf)) libs.add(l);
            }
        } catch (e) {}

        const drives = ['C:', 'D:', 'E:', 'F:', 'G:'];
        for (const d of drives) {
            for (const folder of ['SteamLibrary', 'Program Files (x86)/Steam', 'Steam']) {
                const cand = `${d}/${folder}`;
                if (fs.existsSync(cand)) libs.add(cand);
            }
        }
    } else {
        const roots = getLinuxSteamRoots();
        for (const r of roots) {
            libs.add(r);
            const vdf = path.join(r, 'steamapps', 'libraryfolders.vdf');
            for (const l of parseLibraryFoldersVdf(vdf)) libs.add(l);
        }
    }
    return Array.from(libs);
}

function getUserDirectories() {
    const userDirs = [];

    if (process.platform === 'win32') {
        const appData = process.env.APPDATA || '';
        if (appData) {
            const winUserDir = path.join(appData, 'Axolot Games', 'Scrap Mechanic', 'User');
            if (fs.existsSync(winUserDir)) userDirs.push(winUserDir);
        }
    } else {
        // Linux Proton compatibility prefixes
        const libraries = getAllSteamLibraries();
        for (const lib of libraries) {
            const protonUsers = path.join(lib, 'steamapps', 'compatdata', '387990', 'pfx', 'drive_c', 'users');
            if (fs.existsSync(protonUsers)) {
                try {
                    const users = fs.readdirSync(protonUsers);
                    for (const u of users) {
                        const cand = path.join(protonUsers, u, 'AppData', 'Roaming', 'Axolot Games', 'Scrap Mechanic', 'User');
                        if (fs.existsSync(cand)) userDirs.push(cand);
                    }
                } catch (e) {}
            }
        }
    }

    return userDirs;
}

function getSurvivalSaves() {
    const userDirs = getUserDirectories();
    if (!userDirs.length) return [];

    const saves = [];
    for (const userDir of userDirs) {
        try {
            const userFolders = fs.readdirSync(userDir);
            for (const uf of userFolders) {
                const saveBase = path.join(userDir, uf, 'Save');
                if (fs.existsSync(saveBase)) {
                    scanDirectoryForSaves(saveBase, 'Creative', saves);
                }
            }
        } catch (e) {
            console.warn("[GameScanner] Error reading saves:", e);
        }
    }

    saves.sort((a, b) => b.mtime - a.mtime);
    return saves;
}

function snapshotActiveSave(cacheDir, saveName = null) {
    const saves = getSurvivalSaves();
    if (!saves.length) return { error: "No Scrap Mechanic save files found." };

    let target = saves[0];
    if (saveName) {
        const found = saves.find(s => s.name.toLowerCase() === saveName.toLowerCase() || s.filename.toLowerCase() === saveName.toLowerCase());
        if (found) target = found;
    }

    if (!fs.existsSync(target.path)) return { error: `Save file ${target.path} not found.` };

    const snapshotDir = path.join(cacheDir, 'save_cache');
    if (!fs.existsSync(snapshotDir)) fs.mkdirSync(snapshotDir, { recursive: true });

    const targetName = path.basename(target.path);
    const destPath = path.join(snapshotDir, targetName);

    try {
        // Safe lock check before reading
        let fd = null;
        try {
            fd = fs.openSync(target.path, 'r');
        } catch (lockErr) {
            return { error: "LOCKED", message: lockErr.message };
        } finally {
            if (fd !== null) fs.closeSync(fd);
        }

        fs.copyFileSync(target.path, destPath);
        for (const ext of ['-wal', '-shm']) {
            const extra = target.path + ext;
            if (fs.existsSync(extra)) {
                try {
                    fs.copyFileSync(extra, destPath + ext);
                } catch (e) {}
            }
        }
        return { success: true, filePath: destPath, originalPath: target.path, filename: targetName, mtime: target.mtime };
    } catch (e) {
        return { error: e.message };
    }
}

let userConfiguredGameDir = null;

function setCustomGameDirectory(customPath) {
    if (!customPath) return null;
    let rootDir = customPath.replace(/\\/g, '/');

    // If user selected the Release folder directly, go up one level
    if (path.basename(rootDir).toLowerCase() === 'release') {
        rootDir = path.dirname(rootDir);
    }

    const relExe = path.join(rootDir, 'Release', 'ScrapMechanic.exe');
    const directExe = path.join(rootDir, 'ScrapMechanic.exe');

    if (fs.existsSync(relExe) || fs.existsSync(directExe)) {
        userConfiguredGameDir = rootDir.replace(/\\/g, '/');
        console.log(`[GameScanner] User configured game directory: ${userConfiguredGameDir}`);
        return userConfiguredGameDir;
    }
    return null;
}

function findGameDirectory(customPath = null) {
    // 1. Check custom path if provided
    if (customPath) {
        const valid = setCustomGameDirectory(customPath);
        if (valid) return valid;
    }
    if (userConfiguredGameDir && fs.existsSync(userConfiguredGameDir)) {
        return userConfiguredGameDir;
    }

    // 2. Check relative parent directory
    const appDir = path.resolve(__dirname, '..');
    const parentDir = path.resolve(appDir, '..');
    if (fs.existsSync(path.join(parentDir, 'Release', 'ScrapMechanic.exe'))) {
        return parentDir.replace(/\\/g, '/');
    }

    // 3. Check all Steam libraries (Windows & Linux)
    const libraries = getAllSteamLibraries();
    for (const lib of libraries) {
        const cand = path.join(lib, 'steamapps', 'common', 'Scrap Mechanic');
        if (fs.existsSync(path.join(cand, 'Release', 'ScrapMechanic.exe')) || fs.existsSync(path.join(cand, 'ScrapMechanic.exe'))) {
            return cand.replace(/\\/g, '/');
        }
    }

    return null;
}

function getBundledBridgeDir() {
    const appDir = path.resolve(__dirname, '..');
    const candidates = [
        path.join(__dirname, 'resources', 'radar_bridge'),
        path.join(process.resourcesPath || '', 'app.asar.unpacked', 'electron', 'resources', 'radar_bridge'),
        path.join(process.resourcesPath || '', 'radar_bridge'),
        path.join(appDir, 'electron', 'resources', 'radar_bridge')
    ];
    for (const cand of candidates) {
        if (cand && fs.existsSync(path.join(cand, 'sm_telemetry.lua'))) {
            return cand;
        }
    }
    return null;
}

function checkRadarInstalled(customPath = null) {
    const gameDir = findGameDirectory(customPath);
    if (!gameDir) return { installed: false, gameDir: null };

    const releaseDir = path.join(gameDir, 'Release');
    const dllPath = path.join(releaseDir, 'version.dll');
    const luaPath = path.join(releaseDir, 'sm_telemetry.lua');
    const installed = fs.existsSync(dllPath) && fs.existsSync(luaPath);

    // Auto-update Lua telemetry script if installed and updated version is bundled
    if (installed) {
        try {
            const bundledDir = getBundledBridgeDir();
            if (bundledDir) {
                const bundledLua = path.join(bundledDir, 'sm_telemetry.lua');
                if (fs.existsSync(bundledLua)) {
                    const srcContent = fs.readFileSync(bundledLua, 'utf-8');
                    const dstContent = fs.readFileSync(luaPath, 'utf-8');
                    if (srcContent !== dstContent) {
                        fs.copyFileSync(bundledLua, luaPath);
                        console.log(`[GameScanner] Auto-updated sm_telemetry.lua in ${releaseDir}`);
                    }
                }
            }
        } catch (e) {
            console.warn(`[GameScanner] Auto-update Lua warning:`, e.message);
        }
    }

    return { installed, gameDir };
}

function installRadarFiles(customPath = null) {
    const gameDir = findGameDirectory(customPath);
    if (!gameDir) {
        return { success: false, error: "Could not locate Scrap Mechanic game directory automatically. Please choose your game folder." };
    }

    const releaseDir = path.join(gameDir, 'Release');
    if (!fs.existsSync(releaseDir)) {
        fs.mkdirSync(releaseDir, { recursive: true });
    }

    // Determine source directory for radar bridge files
    const appDir = path.resolve(__dirname, '..');
    const candidates = [
        path.join(__dirname, 'resources', 'radar_bridge'),
        path.join(process.resourcesPath || '', 'app.asar.unpacked', 'electron', 'resources', 'radar_bridge'),
        path.join(process.resourcesPath || '', 'radar_bridge'),
        path.join(appDir, 'electron', 'resources', 'radar_bridge'),
        path.join(gameDir, '..', 'Release')
    ];

    let srcDir = null;
    for (const cand of candidates) {
        if (cand && fs.existsSync(path.join(cand, 'version.dll'))) {
            srcDir = cand;
            break;
        }
    }

    if (!srcDir) {
        return { success: false, error: "Radar telemetry bridge source assets not found in package." };
    }

    try {
        const filesToCopy = ['version.dll', 'sm_telemetry.lua', 'settings.ini'];
        for (const file of filesToCopy) {
            const src = path.join(srcDir, file);
            const dst = path.join(releaseDir, file);
            if (fs.existsSync(src)) {
                fs.copyFileSync(src, dst);
            }
        }
        console.log(`[GameScanner] Successfully installed radar telemetry files to ${releaseDir}`);
        return { success: true, gameDir, releaseDir };
    } catch (e) {
        console.error(`[GameScanner] Failed to install radar files:`, e);
        return { success: false, error: e.message };
    }
}

function restartGame() {
    const { exec } = require('child_process');
    const { shell } = require('electron');

    const killCmd = process.platform === 'win32'
        ? 'taskkill /F /IM ScrapMechanic.exe'
        : 'pkill -f ScrapMechanic';

    try {
        exec(killCmd, () => {
            setTimeout(() => {
                if (shell && shell.openExternal) {
                    shell.openExternal('steam://rungameid/387990');
                }
            }, 1200);
        });
    } catch (e) {
        if (shell && shell.openExternal) {
            shell.openExternal('steam://rungameid/387990');
        }
    }
    return { success: true };
}

module.exports = {
    getSurvivalSaves,
    snapshotActiveSave,
    findGameDirectory,
    setCustomGameDirectory,
    checkRadarInstalled,
    installRadarFiles,
    restartGame
};
