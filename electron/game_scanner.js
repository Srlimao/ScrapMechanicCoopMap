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

function getSurvivalSaves() {
    const appData = process.env.APPDATA || '';
    if (!appData) return [];
    
    const userDir = path.join(appData, 'Axolot Games', 'Scrap Mechanic', 'User');
    if (!fs.existsSync(userDir)) return [];

    const saves = [];
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
        fs.copyFileSync(target.path, destPath);
        for (const ext of ['-wal', '-shm']) {
            const extra = target.path + ext;
            if (fs.existsSync(extra)) {
                fs.copyFileSync(extra, destPath + ext);
            }
        }
        return { success: true, filePath: destPath, filename: targetName };
    } catch (e) {
        return { error: e.message };
    }
}

function findGameDirectory() {
    // 1. Check relative parent directory
    const appDir = path.resolve(__dirname, '..');
    const parentDir = path.resolve(appDir, '..');
    if (fs.existsSync(path.join(parentDir, 'Release', 'ScrapMechanic.exe'))) {
        return parentDir.replace(/\\/g, '/');
    }
    // 2. Query registry via reg query
    try {
        const regOut = execSync('reg query "HKCU\\Software\\Valve\\Steam" /v SteamPath', { encoding: 'utf-8' });
        const match = regOut.match(/SteamPath\s+REG_SZ\s+(.+)/i);
        if (match && match[1]) {
            const steamPath = match[1].trim();
            const cand = path.join(steamPath, 'steamapps', 'common', 'Scrap Mechanic');
            if (fs.existsSync(path.join(cand, 'Release', 'ScrapMechanic.exe'))) {
                return cand.replace(/\\/g, '/');
            }
        }
    } catch (e) {}

    // 3. Fallback common paths
    const drives = ['C:', 'D:', 'E:', 'F:', 'G:'];
    for (const d of drives) {
        for (const folder of ['SteamLibrary', 'Program Files (x86)/Steam', 'Steam']) {
            const cand = path.join(d, folder, 'steamapps', 'common', 'Scrap Mechanic');
            if (fs.existsSync(path.join(cand, 'Release', 'ScrapMechanic.exe'))) {
                return cand.replace(/\\/g, '/');
            }
        }
    }
    return null;
}

module.exports = {
    getSurvivalSaves,
    snapshotActiveSave,
    findGameDirectory
};
