// --- Terrain Atlas Loader & High-Performance Save Decompressor ---
// Decodes g_cellData directly from Scrap Mechanic SQLite save files and stitches
// official terrain tiles from terrain-cell-atlas.webp in ~30ms.

(function (global) {
    // 1. Pure JS LZ4 Block Decompressor
    function decompressLZ4(src) {
        let dst = [], n = 0;
        while (n < src.length) {
            let token = src[n++];
            let literalLen = token >> 4;
            if (literalLen === 15) {
                let extra = 255;
                while (extra === 255) {
                    if (n >= src.length) throw Error("Truncated LZ4 literal length");
                    extra = src[n++];
                    literalLen += extra;
                }
            }
            if (n + literalLen > src.length) throw Error("LZ4 literal exceeds source block");
            for (let i = 0; i < literalLen; i++) dst.push(src[n + i]);
            n += literalLen;
            if (n === src.length) break;
            if (n + 2 > src.length) throw Error("Truncated LZ4 match offset");
            let offset = src[n] | (src[n + 1] << 8);
            n += 2;
            if (offset === 0 || offset > dst.length) throw Error("Invalid LZ4 match offset " + offset);
            let matchLen = (token & 15) + 4;
            if ((token & 15) === 15) {
                let extra = 255;
                while (extra === 255) {
                    if (n >= src.length) throw Error("Truncated LZ4 match length");
                    extra = src[n++];
                    matchLen += extra;
                }
            }
            for (let i = 0; i < matchLen; i++) dst.push(dst[dst.length - offset]);
        }
        return Uint8Array.from(dst);
    }

    // 2. Lua Bitstream Reader
    class BitStream {
        constructor(buf) {
            this.buffer = buf;
            this.bitOffset = 0;
        }
        get remainingBits() { return this.buffer.length * 8 - this.bitOffset; }
        readBit() {
            if (this.remainingBits < 1) throw Error("Unexpected end of Lua bitstream");
            let byteIdx = Math.floor(this.bitOffset / 8);
            let bitIdx = 7 - (this.bitOffset % 8);
            let bit = (this.buffer[byteIdx] >> bitIdx) & 1;
            this.bitOffset++;
            return bit;
        }
        readUnsigned(bits) {
            let val = 0;
            for (let i = 0; i < bits; i++) val = val * 2 + this.readBit();
            return val;
        }
        readSigned(bits) {
            let val = this.readUnsigned(bits);
            return val >= Math.pow(2, bits - 1) ? val - Math.pow(2, bits) : val;
        }
        readFloat32() {
            let bytes = this.readBytes(4);
            return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getFloat32(0, false);
        }
        alignToByte() {
            let rem = this.bitOffset % 8;
            if (rem !== 0) this.bitOffset += 8 - rem;
        }
        readBytes(count) {
            let arr = new Uint8Array(count);
            for (let i = 0; i < count; i++) arr[i] = this.readUnsigned(8);
            return arr;
        }
    }

    function formatUuid(bytes) {
        let rev = [...bytes].reverse().map(b => b.toString(16).padStart(2, '0')).join('');
        return [rev.slice(0, 8), rev.slice(8, 12), rev.slice(12, 16), rev.slice(16, 20), rev.slice(20)].join('-');
    }

    function parseLuaValue(stream, depth = 0, reqKeys = null) {
        if (depth > 256) throw Error("Lua object nesting is too deep");
        let tag = stream.readUnsigned(8);
        if (tag === 1) return null;
        if (tag === 2) return stream.readBit() === 1;
        if (tag === 3) return stream.readFloat32();
        if (tag === 4) {
            let len = stream.readUnsigned(32);
            stream.alignToByte();
            return new TextDecoder().decode(stream.readBytes(len));
        }
        if (tag === 5) {
            let count = stream.readUnsigned(32);
            if (stream.readBit() === 1) {
                let offset = stream.readSigned(32);
                let values = [];
                for (let i = 0; i < count; i++) values.push(parseLuaValue(stream, depth + 1));
                return { kind: 'array', offset, values };
            }
            let dict = {};
            for (let i = 0; i < count; i++) {
                let keyVal = parseLuaValue(stream, depth + 1);
                let keyStr = (typeof keyVal === 'object' && keyVal && keyVal.kind === 'uuid') ? keyVal.value : String(keyVal);
                let val = parseLuaValue(stream, depth + 1);
                dict[keyStr] = val;
                if (depth === 0 && reqKeys && [...reqKeys].every(k => k in dict)) return dict;
            }
            return dict;
        }
        if (tag === 6) return stream.readSigned(32);
        if (tag === 7) return stream.readSigned(16);
        if (tag === 8) return stream.readSigned(8);
        if (tag === 100) {
            let uType = stream.readUnsigned(32);
            if (uType === 10001) return { kind: 'uuid', value: formatUuid(stream.readBytes(16)) };
            if (uType === 10003) return { kind: 'vec3', x: stream.readFloat32(), y: stream.readFloat32(), z: stream.readFloat32() };
            if (uType === 10004) return { kind: 'quat', x: stream.readFloat32(), y: stream.readFloat32(), z: stream.readFloat32(), w: stream.readFloat32() };
            if (uType === 10005) return { kind: 'color', r: stream.readFloat32(), g: stream.readFloat32(), b: stream.readFloat32(), a: stream.readFloat32() };
            return { kind: 'ref', type: uType, id: stream.readUnsigned(32) };
        }
        throw Error("Unsupported Lua value type " + tag);
    }

    function extractScriptDataPayload(rawBytes) {
        if (rawBytes.length < 29) throw Error("ScriptData row too short");
        let dv = new DataView(rawBytes.buffer, rawBytes.byteOffset, rawBytes.byteLength);
        let headerLen = 18 + dv.getUint16(16, false) + 2 + 1;
        let payloadLen = dv.getUint32(headerLen, false);
        let start = headerLen + 4;
        return rawBytes.subarray(start, start + payloadLen);
    }

    function fnv1a(str) {
        let t = str.toLowerCase(), h = 2166136261;
        for (let i = 0; i < t.length; i++) {
            h ^= t.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return (h >>> 0).toString(16).padStart(8, '0');
    }

    function parseTerrainCellData(db) {
        let gameRow = db.exec("SELECT savegameversion, seed FROM Game LIMIT 1");
        if (!gameRow.length || !gameRow[0].values.length) throw Error("Save missing Game table");
        let saveVersion = Number(gameRow[0].values[0][0]);
        let seed = Number(gameRow[0].values[0][1]);

        let scriptRows = db.exec("SELECT data FROM ScriptData WHERE worldId = 1 ORDER BY length(data) DESC");
        if (!scriptRows.length || !scriptRows[0].values.length) throw Error("No ScriptData rows");

        let root = null;

        function parseTerrainFromDecompressed(decompressed) {
            const requiredKeys = ['seed', 'flags', 'bounds', 'uid', 'xOffset', 'yOffset', 'rotation'];
            try {
                if (decompressed[0] === 76 && decompressed[1] === 85 && decompressed[2] === 65) {
                    let stream = new BitStream(decompressed.subarray(7));
                    let parsed = parseLuaValue(stream, 0, new Set(requiredKeys));
                    if (parsed && parsed.uid && parsed.rotation && parsed.bounds) return parsed;
                }
            } catch (e) {}

            // Robust Fallback: Scan for Lua dictionary keys directly in decompressed bitstream
            let dict = {};
            for (let key of requiredKeys) {
                let enc = new TextEncoder().encode(key);
                let foundVal = undefined;
                for (let i = 7; i <= decompressed.length - enc.length; i++) {
                    let match = true;
                    for (let j = 0; j < enc.length; j++) {
                        if (decompressed[i + j] !== enc[j]) { match = false; break; }
                    }
                    if (match) {
                        try {
                            let s = new BitStream(decompressed.subarray(i + enc.length));
                            foundVal = parseLuaValue(s, 0);
                            break;
                        } catch (e) {}
                    }
                }
                if (foundVal !== undefined) dict[key] = foundVal;
            }
            if (dict.uid && dict.rotation && dict.bounds) return dict;
            return null;
        }

        for (let r of scriptRows[0].values) {
            let blob = r[0];
            if (!(blob instanceof Uint8Array)) blob = new Uint8Array(blob);
            try {
                let payload = extractScriptDataPayload(blob);
                let decompressed = decompressLZ4(payload);
                let parsed = parseTerrainFromDecompressed(decompressed);
                if (parsed) {
                    root = parsed;
                    break;
                }
            } catch (e) {
                // Try next candidate row
            }
        }

        if (!root) throw Error("Survival terrain celldata not found in save");

        let b = root.bounds;
        let bounds = { xMin: b.xMin, xMax: b.xMax, yMin: b.yMin, yMax: b.yMax };
        let cells = [];

        for (let cy = bounds.yMin; cy <= bounds.yMax; cy++) {
            let uidRow = root.uid.values[cy - root.uid.offset];
            let rotRow = root.rotation.values[cy - root.rotation.offset];
            let xOffRow = root.xOffset.values[cy - root.xOffset.offset];
            let yOffRow = root.yOffset.values[cy - root.yOffset.offset];
            let flagRow = root.flags.values[cy - root.flags.offset];

            for (let cx = bounds.xMin; cx <= bounds.xMax; cx++) {
                let uVal = uidRow.values[cx - uidRow.offset];
                let rVal = rotRow.values[cx - rotRow.offset];
                let xoVal = xOffRow.values[cx - xOffRow.offset];
                let yoVal = yOffRow.values[cx - yOffRow.offset];
                let fVal = flagRow.values[cx - flagRow.offset];

                cells.push({
                    x: cx,
                    y: cy,
                    uuid: (uVal && uVal.value) ? uVal.value : String(uVal),
                    rotation: rVal,
                    xOffset: xoVal,
                    yOffset: yoVal,
                    flags: fVal
                });
            }
        }

        return { seed, saveVersion, bounds, cells };
    }

    // 3. Atlas Image Renderer
    let g_atlasManifest = null;
    let g_atlasImage = null;

    async function ensureAtlasLoaded() {
        if (g_atlasManifest && g_atlasImage) return { manifest: g_atlasManifest, image: g_atlasImage };

        const manifestResp = await fetch('terrain-cell-atlas.json');
        g_atlasManifest = await manifestResp.json();

        g_atlasImage = new Image();
        await new Promise((resolve, reject) => {
            g_atlasImage.onload = resolve;
            g_atlasImage.onerror = reject;
            g_atlasImage.src = 'terrain-cell-atlas.webp';
        });

        return { manifest: g_atlasManifest, image: g_atlasImage };
    }

    async function renderTerrainFromSaveDB(db) {
        console.log("[TerrainLoader] Parsing terrain cell data from save DB...");
        const terrainData = parseTerrainCellData(db);
        const { manifest, image } = await ensureAtlasLoaded();

        const minCellX = -64, maxCellX = 63;
        const minCellY = -48, maxCellY = 47;
        const cellPixels = manifest.cellPixels || 16;
        const totalW = (maxCellX - minCellX + 1) * cellPixels; // 2048 px
        const totalH = (maxCellY - minCellY + 1) * cellPixels; // 1536 px

        const canvas = document.createElement('canvas');
        canvas.width = totalW;
        canvas.height = totalH;
        const ctx = canvas.getContext('2d', { alpha: false });
        ctx.fillStyle = '#09161c';
        ctx.fillRect(0, 0, totalW, totalH);
        ctx.imageSmoothingEnabled = false;

        let rendered = 0;
        for (let cell of terrainData.cells) {
            if (cell.x < minCellX || cell.x > maxCellX || cell.y < minCellY || cell.y > maxCellY) continue;

            const h = fnv1a(cell.uuid);
            const tileInfo = manifest.tiles[h];
            if (!tileInfo) continue;

            const subIdx = cell.yOffset * tileInfo.cellsX + cell.xOffset;
            const atlasIdx = tileInfo.start + subIdx * manifest.rotations + cell.rotation;

            const sx = (atlasIdx % manifest.columns) * cellPixels;
            const sy = Math.floor(atlasIdx / manifest.columns) * cellPixels;

            const dx = (cell.x - minCellX) * cellPixels;
            const dy = (maxCellY - cell.y) * cellPixels;

            ctx.drawImage(image, sx, sy, cellPixels, cellPixels, dx, dy, cellPixels, cellPixels);
            rendered++;
        }

        console.log(`[TerrainLoader] Rendered ${rendered} terrain cells directly from save!`);
        return {
            canvas,
            dataUrl: canvas.toDataURL('image/png'),
            seed: terrainData.seed,
            cells: terrainData.cells,
            saveVersion: terrainData.saveVersion,
            renderedCells: rendered
        };
    }

    async function renderTerrainFromCells(cells, seed = 0) {
        const { manifest, image } = await ensureAtlasLoaded();
        const minCellX = -64, maxCellX = 63;
        const minCellY = -48, maxCellY = 47;
        const cellPixels = manifest.cellPixels || 16;
        const totalW = (maxCellX - minCellX + 1) * cellPixels;
        const totalH = (maxCellY - minCellY + 1) * cellPixels;

        const canvas = document.createElement('canvas');
        canvas.width = totalW;
        canvas.height = totalH;
        const ctx = canvas.getContext('2d', { alpha: false });
        ctx.fillStyle = '#09161c';
        ctx.fillRect(0, 0, totalW, totalH);
        ctx.imageSmoothingEnabled = false;

        let rendered = 0;
        for (let cell of cells) {
            const cx = cell.x !== undefined ? cell.x : cell.cx;
            const cy = cell.y !== undefined ? cell.y : cell.cy;
            const rot = cell.rotation !== undefined ? cell.rotation : (cell.rot || 0);
            const xOff = cell.xOffset !== undefined ? cell.xOffset : (cell.xOff || 0);
            const yOff = cell.yOffset !== undefined ? cell.yOffset : (cell.yOff || 0);
            const uuid = cell.uuid || cell.uid;

            if (cx < minCellX || cx > maxCellX || cy < minCellY || cy > maxCellY) continue;

            const h = fnv1a(uuid);
            const tileInfo = manifest.tiles[h];
            if (!tileInfo) continue;

            const subIdx = yOff * tileInfo.cellsX + xOff;
            const atlasIdx = tileInfo.start + subIdx * manifest.rotations + rot;

            const sx = (atlasIdx % manifest.columns) * cellPixels;
            const sy = Math.floor(atlasIdx / manifest.columns) * cellPixels;

            const dx = (cx - minCellX) * cellPixels;
            const dy = (maxCellY - cy) * cellPixels;

            ctx.drawImage(image, sx, sy, cellPixels, cellPixels, dx, dy, cellPixels, cellPixels);
            rendered++;
        }

        return {
            canvas,
            dataUrl: canvas.toDataURL('image/png'),
            seed: seed,
            renderedCells: rendered
        };
    }

    global.TerrainLoader = {
        parseTerrainCellData,
        ensureAtlasLoaded,
        renderTerrainFromSaveDB,
        renderTerrainFromCells
    };

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));

