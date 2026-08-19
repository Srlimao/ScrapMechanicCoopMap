import ctypes
import os
import sys
import json
import time
from PIL import Image

try:
    from backend.path_finder import find_game_directory
    GAME_ROOT = find_game_directory() or "d:/SteamLibrary/steamapps/common/Scrap Mechanic"
except Exception:
    GAME_ROOT = "d:/SteamLibrary/steamapps/common/Scrap Mechanic"

SURVIVAL_DATA = os.path.join(GAME_ROOT, "Survival").replace("\\", "/")
GAME_DATA = os.path.join(GAME_ROOT, "Data").replace("\\", "/")
RELEASE_DIR = os.path.join(GAME_ROOT, "Release").replace("\\", "/")
TILES_DIR = os.path.join(GAME_ROOT, "Survival/Terrain/Tiles").replace("\\", "/")
DATA_TILES_DIR = os.path.join(GAME_ROOT, "Data/Terrain/Tiles").replace("\\", "/")
CACHE_DIR = os.path.dirname(os.path.abspath(__file__))

def fnv1a(s):
    t = str(s).lower()
    h = 2166136261
    for c in t:
        h ^= ord(c)
        h = (h * 16777619) & 0xFFFFFFFF
    return f'{h:08x}'

def format_uuid_forward(raw):
    s = ''.join([f'{b:02x}' for b in raw])
    return f'{s[0:8]}-{s[8:12]}-{s[12:16]}-{s[16:20]}-{s[20:32]}'

# 1. Build complete Tile Path -> UUID Index from binary .tile and json .tileson files
tile_uuid_map = {}
for search_root in [TILES_DIR, DATA_TILES_DIR]:
    if os.path.exists(search_root):
        for root, dirs, files in os.walk(search_root):
            for f in files:
                fpath = os.path.join(root, f)
                uuid_str = None
                if f.endswith(".tile"):
                    try:
                        with open(fpath, 'rb') as fp:
                            header = fp.read(30)
                            if header.startswith(b'TILE') and len(header) >= 24:
                                uuid_str = format_uuid_forward(header[8:24])
                    except Exception:
                        pass
                elif f.endswith(".tileson"):
                    try:
                        with open(fpath, 'r', encoding='utf-8', errors='ignore') as fp:
                            d = json.load(fp)
                            uuid_str = d.get('info', {}).get('uuid')
                    except Exception:
                        pass

                if uuid_str:
                    rel_s = "$SURVIVAL_DATA" + fpath.replace("\\", "/").split("/Survival")[-1]
                    rel_g = "$GAME_DATA" + fpath.replace("\\", "/").split("/Data")[-1]
                    tile_uuid_map[rel_s.lower()] = uuid_str
                    tile_uuid_map[rel_g.lower()] = uuid_str
                    tile_uuid_map[f.lower()] = uuid_str
                    tile_uuid_map[os.path.splitext(f)[0].lower()] = uuid_str

print(f"[TerrainBuilder] Indexed {len(tile_uuid_map)} tile-to-UUID mappings.")

# Load 64-bit lua51.dll
lua_dll_path = os.path.join(RELEASE_DIR, "lua51.dll")
lua = ctypes.cdll.LoadLibrary(lua_dll_path)

c_void_p = ctypes.c_void_p
c_char_p = ctypes.c_char_p
c_int = ctypes.c_int

lua.luaL_newstate.restype = c_void_p
lua.luaL_newstate.argtypes = []
lua.luaL_openlibs.argtypes = [c_void_p]
lua.luaL_loadstring.restype = c_int
lua.luaL_loadstring.argtypes = [c_void_p, c_char_p]
lua.lua_pcall.restype = c_int
lua.lua_pcall.argtypes = [c_void_p, c_int, c_int, c_int]
lua.lua_tolstring.restype = c_char_p
lua.lua_tolstring.argtypes = [c_void_p, c_int, ctypes.POINTER(ctypes.c_size_t)]
lua.lua_gettop.restype = c_int
lua.lua_gettop.argtypes = [c_void_p]
lua.lua_close.argtypes = [c_void_p]

TILE_UUID_JSON = json.dumps(tile_uuid_map)

# Load terrain atlas
ATLAS_JSON_PATH = os.path.join(CACHE_DIR, "terrain-cell-atlas.json")
ATLAS_IMG_PATH = os.path.join(CACHE_DIR, "terrain-cell-atlas.webp")
g_atlas_manifest = None
g_atlas_image = None

def get_atlas():
    global g_atlas_manifest, g_atlas_image
    if g_atlas_manifest is None and os.path.exists(ATLAS_JSON_PATH):
        with open(ATLAS_JSON_PATH, 'r', encoding='utf-8') as fp:
            g_atlas_manifest = json.load(fp)
    if g_atlas_image is None and os.path.exists(ATLAS_IMG_PATH):
        g_atlas_image = Image.open(ATLAS_IMG_PATH).convert('RGBA')
    return g_atlas_manifest, g_atlas_image

def get_terrain_cells_for_seed(seed):
    cache_json = os.path.join(CACHE_DIR, "save_cache", f"terrain_cells_{seed}.json")
    if os.path.exists(cache_json):
        try:
            with open(cache_json, 'r', encoding='utf-8') as fp:
                cached_cells = json.load(fp)
                if isinstance(cached_cells, list) and len(cached_cells) > 0:
                    print(f"[TerrainBuilder] Loaded {len(cached_cells)} cells for Seed {seed} from disk cache in <1ms.", flush=True)
                    return cached_cells
        except Exception as e:
            print(f"[TerrainBuilder] Disk cache read failed: {e}")

    t0 = time.time()
    L = lua.luaL_newstate()
    lua.luaL_openlibs(L)

    lua_script = f"""
    SURVIVAL_DATA = [==[{SURVIVAL_DATA}]==]
    GAME_DATA = [==[{GAME_DATA}]==]
    TILE_UUID_MAP_RAW = [==[{TILE_UUID_JSON}]==]

    local search_dirs = {{
        SURVIVAL_DATA .. "/Scripts/terrain/overworld",
        SURVIVAL_DATA .. "/Scripts/terrain",
        SURVIVAL_DATA .. "/Scripts/game",
        SURVIVAL_DATA .. "/Scripts",
        GAME_DATA .. "/Scripts/terrain",
        GAME_DATA .. "/Scripts"
    }}

    function resolve_path(p)
        p = p:gsub("%$SURVIVAL_DATA", SURVIVAL_DATA)
        p = p:gsub("%$GAME_DATA", GAME_DATA)
        p = p:gsub("\\\\\\\\", "/")
        
        local fh = io.open(p, "r")
        if fh then fh:close() return p end
        
        for _, dir in ipairs(search_dirs) do
            local candidate = dir .. "/" .. p
            local f = io.open(candidate, "r")
            if f then f:close() return candidate end
        end
        return p
    end

    AddLegacyUpgrade = function() end
    ExcavationIsland = {{ x = 32, y = 16, worldFile = "$SURVIVAL_DATA/Terrain/Worlds/overworld_excavation_island.world", rotation = 0 }}
    
    local orig_dofile = dofile
    dofile = function(p)
        local rp = resolve_path(p)
        local f = loadfile(rp)
        if not f then
            error("Could not load file: " .. tostring(p) .. " (resolved: " .. tostring(rp) .. ")")
        end
        return f()
    end

    local UuidMeta = {{
        __type = "Uuid",
        __tostring = function(t) return t.id end,
        __index = {{
            isNil = function(self)
                return (self.id == "00000000-0000-0000-0000-000000000000" or self.id == "" or self.id == nil)
            end
        }}
    }}
    
    local orig_type = type
    type = function(v)
        if orig_type(v) == "table" and (v.__type == "Uuid" or getmetatable(v) == UuidMeta) then
            return "Uuid"
        end
        return orig_type(v)
    end

    local TILE_UUIDS = {{}}
    for k, v in string.gmatch(TILE_UUID_MAP_RAW, '"([^"]+)":%s*"([^"]+)"') do
        TILE_UUIDS[string.lower(k)] = v
    end

    sm = {{
        util = {{
            clamp = function(v, min, max) return math.min(math.max(v, min), max) end
        }},
        log = {{
            info = function() end,
            error = function() end,
            warn = function() end,
            warning = function() end
        }},
        color = {{
            new = function(r, g, b, a) return {{r=r or 0, g=g or 0, b=b or 0, a=a or 1}} end
        }},
        debugDraw = {{
            clear = function() end,
            addCircle = function() end,
            addLine = function() end,
            addArrow = function() end,
            addBox = function() end
        }},
        uuid = {{
            new = function(s)
                local u = {{ id = tostring(s or "00000000-0000-0000-0000-000000000000"), __type = "Uuid" }}
                setmetatable(u, UuidMeta)
                return u
            end,
            getNil = function()
                local u = {{ id = "00000000-0000-0000-0000-000000000000", __type = "Uuid" }}
                setmetatable(u, UuidMeta)
                return u
            end
        }},
        vec3 = {{
            new = function(x, y, z) return {{x=x or 0, y=y or 0, z=z or 0}} end,
            zero = function() return {{x=0, y=0, z=0}} end
        }},
        json = {{
            open = function(p)
                local rp = resolve_path(p)
                local fh = io.open(rp, "r")
                if not fh then return {{ cellData = {{}}, cornerData = {{}} }} end
                local content = fh:read("*a")
                fh:close()
                
                local cells = {{}}
                for block in content:gmatch("%{{[^%}}]-%)") do
                    local ox = block:match('"offsetX"%s*:%s*(-?%d+)')
                    local oy = block:match('"offsetY"%s*:%s*(-?%d+)')
                    local path = block:match('"path"%s*:%s*"([^"]*)"')
                    local rot = block:match('"rotation"%s*:%s*(%d+)')
                    local x = block:match('"x"%s*:%s*(-?%d+)')
                    local y = block:match('"y"%s*:%s*(-?%d+)')
                    
                    if x and y and path then
                        table.insert(cells, {{
                            offsetX = tonumber(ox or 0),
                            offsetY = tonumber(oy or 0),
                            path = path,
                            rotation = tonumber(rot or 0),
                            x = tonumber(x),
                            y = tonumber(y)
                        }})
                    end
                end
                return {{ cellData = cells, cornerData = {{}} }}
            end
        }},
        terrainTile = {{
            getTileUuid = function(p)
                local lp = string.lower(tostring(p)):gsub("\\\\", "/")
                local rawUuid = TILE_UUIDS[lp]
                if not rawUuid then
                    local filename = lp:match("[^/]+$")
                    if filename then rawUuid = TILE_UUIDS[filename] end
                end
                local u = {{ id = tostring(rawUuid or p), __type = "Uuid" }}
                setmetatable(u, UuidMeta)
                return u
            end,
            getSize = function(p)
                local lp = string.lower(tostring(p))
                if lp:find("32x32") or lp:find("excavation_island") then return 32
                elseif lp:find("8x8") or lp:find("_xl") or lp:find("warehouse") then return 8
                elseif lp:find("4x4") or lp:find("_large") then return 4
                elseif lp:find("2x2") or lp:find("_medium") or lp:find("mechanicstation") or lp:find("pack") or lp:find("hideout") then return 2
                else return 1 end
            end
        }},
        noise = {{
            intNoise2d = function(x, y, s)
                local n = (x + y * 57 + (s or 0) * 131) % 2147483647
                local val = (n * (n * n * 15731 + 789221) + 1376312589) % 2147483647
                return math.floor(math.abs(val))
            end,
            simplex2d = function(x, y)
                local n = math.sin(x * 12.9898 + y * 78.233) * 43758.5453
                return (n - math.floor(n)) * 2 - 1
            end,
            simplexNoise2d = function(x, y)
                local n = math.sin(x * 12.9898 + y * 78.233) * 43758.5453
                return (n - math.floor(n)) * 2 - 1
            end,
            perlinNoise2d = function(x, y, s)
                local n = math.sin(x * 12.9898 + y * 78.233 + (s or 0) * 0.1) * 43758.5453
                return (n - math.floor(n)) * 2 - 1
            end,
            octaveNoise2d = function(x, y, octaves, persistence)
                local total = 0
                local frequency = 1
                local amplitude = 1
                local maxValue = 0
                for i = 1, (octaves or 1) do
                    total = total + sm.noise.simplex2d(x * frequency, y * frequency) * amplitude
                    maxValue = maxValue + amplitude
                    amplitude = amplitude * (persistence or 0.5)
                    frequency = frequency * 2
                end
                return total / maxValue
            end
        }}
    }}

    dofile("$SURVIVAL_DATA/Scripts/game/survival_constants.lua")
    dofile("$SURVIVAL_DATA/Scripts/terrain/terrain_overworld.lua")

    initRoadAndCliffTiles()
    initMeadowTiles()
    initForestTiles()
    initFieldTiles()
    initBurntForestTiles()
    initAutumnForestTiles()
    initLakeTiles()
    initDesertTiles()
    initPoiTiles()
    initBiomeRoadTiles()

    local cellMinX = -64
    local cellMaxX = 63
    local cellMinY = -48
    local cellMaxY = 47

    generateOverworldCelldata(cellMinX, cellMaxX, cellMinY, cellMaxY, {seed}, nil, 0)

    local cells = {{}}
    for cy = cellMinY, cellMaxY do
        for cx = cellMinX, cellMaxX do
            local uid = tostring(g_cellData.uid[cy][cx])
            local rot = g_cellData.rotation[cy][cx] or 0
            local xOff = g_cellData.xOffset[cy][cx] or 0
            local yOff = g_cellData.yOffset[cy][cx] or 0
            local flags = g_cellData.flags and g_cellData.flags[cy] and g_cellData.flags[cy][cx] or 0
            table.insert(cells, string.format('{{"x":%d,"y":%d,"rotation":%d,"xOffset":%d,"yOffset":%d,"flags":%d,"uuid":"%s"}}', cx, cy, rot, xOff, yOff, flags, uid))
        end
    end

    CELL_OUTPUT = "[" .. table.concat(cells, ",") .. "]"
    """

    err = lua.luaL_loadstring(L, lua_script.encode('utf-8'))
    if err != 0:
        err_msg = lua.lua_tolstring(L, -1, None)
        print("Lua Compile Error:", err_msg.decode('utf-8') if err_msg else "Unknown", flush=True)
        lua.lua_close(L)
        return None

    res = lua.lua_pcall(L, 0, 0, 0)
    if res != 0:
        err_msg = lua.lua_tolstring(L, -1, None)
        print("Lua Runtime Error:", err_msg.decode('utf-8') if err_msg else "Unknown", flush=True)
        lua.lua_close(L)
        return None

    lua_get_global_code = b"return CELL_OUTPUT"
    lua.luaL_loadstring(L, lua_get_global_code)
    lua.lua_pcall(L, 0, 1, 0)
    json_bytes = lua.lua_tolstring(L, -1, None)
    cells_data = json.loads(json_bytes.decode('utf-8'))
    lua.lua_close(L)

    print(f"[TerrainBuilder] Procedurally generated {len(cells_data)} cells for Seed {seed} in {time.time()-t0:.2f}s.", flush=True)
    
    # Save to disk cache
    try:
        os.makedirs(os.path.join(CACHE_DIR, "save_cache"), exist_ok=True)
        cache_json = os.path.join(CACHE_DIR, "save_cache", f"terrain_cells_{seed}.json")
        with open(cache_json, 'w', encoding='utf-8') as fp:
            json.dump(cells_data, fp)
    except Exception as e:
        print(f"[TerrainBuilder] Cache write warning: {e}")

    return cells_data

def apply_seam_blending_pil(img, cell_px=16, strength=0.85):
    w, h = img.size
    pixels = bytearray(img.tobytes())

    # Pass 1: Horizontal seams (feather across vertical border x)
    cols = w // cell_px
    for col in range(1, cols):
        bx = col * cell_px
        for y in range(h):
            row_off = y * w * 4
            idx_l1 = row_off + (bx - 1) * 4
            idx_r1 = row_off + bx * 4

            dr = abs(pixels[idx_l1] - pixels[idx_r1])
            dg = abs(pixels[idx_l1 + 1] - pixels[idx_r1 + 1])
            db = abs(pixels[idx_l1 + 2] - pixels[idx_r1 + 2])
            if dr + dg + db < 6:
                continue

            idx_l2 = row_off + (bx - 2) * 4
            idx_r2 = row_off + (bx + 1) * 4

            for c in range(3):
                cl2 = pixels[idx_l2 + c]
                cl1 = pixels[idx_l1 + c]
                cr1 = pixels[idx_r1 + c]
                cr2 = pixels[idx_r2 + c]

                pixels[idx_l1 + c] = int(round(cl1 * (1 - 0.40 * strength) + cr1 * (0.40 * strength)))
                pixels[idx_r1 + c] = int(round(cr1 * (1 - 0.40 * strength) + cl1 * (0.40 * strength)))
                pixels[idx_l2 + c] = int(round(cl2 * (1 - 0.18 * strength) + cr1 * (0.18 * strength)))
                pixels[idx_r2 + c] = int(round(cr2 * (1 - 0.18 * strength) + cl1 * (0.18 * strength)))

    # Pass 2: Vertical seams (feather across horizontal border y)
    rows = h // cell_px
    for row in range(1, rows):
        by = row * cell_px
        for x in range(w):
            idx_t1 = ((by - 1) * w + x) * 4
            idx_b1 = (by * w + x) * 4

            dr = abs(pixels[idx_t1] - pixels[idx_b1])
            dg = abs(pixels[idx_t1 + 1] - pixels[idx_b1 + 1])
            db = abs(pixels[idx_t1 + 2] - pixels[idx_b1 + 2])
            if dr + dg + db < 6:
                continue

            idx_t2 = ((by - 2) * w + x) * 4
            idx_b2 = ((by + 1) * w + x) * 4

            for c in range(3):
                ct2 = pixels[idx_t2 + c]
                ct1 = pixels[idx_t1 + c]
                cb1 = pixels[idx_b1 + c]
                cb2 = pixels[idx_b2 + c]

                pixels[idx_t1 + c] = int(round(ct1 * (1 - 0.40 * strength) + cb1 * (0.40 * strength)))
                pixels[idx_b1 + c] = int(round(cb1 * (1 - 0.40 * strength) + ct1 * (0.40 * strength)))
                pixels[idx_t2 + c] = int(round(ct2 * (1 - 0.18 * strength) + cb1 * (0.18 * strength)))
                pixels[idx_b2 + c] = int(round(cb2 * (1 - 0.18 * strength) + ct1 * (0.18 * strength)))

    return Image.frombytes(img.mode, img.size, bytes(pixels))

def generate_terrain_for_seed(seed):
    output_filename = f"terrain_seed_{seed}.png"
    output_path = os.path.join(CACHE_DIR, output_filename)

    if os.path.exists(output_path):
        print(f"[TerrainBuilder] Found cached terrain image {output_filename} on disk.", flush=True)
        return output_filename

    cells_data = get_terrain_cells_for_seed(seed)
    if not cells_data:
        return None

    t0 = time.time()
    manifest, atlas_img = get_atlas()

    if manifest and atlas_img:
        # High-Speed Accurate Atlas Stitching (Matches scrapmech.wiki 100%)
        CELL_PX = manifest.get('cellPixels', 16)
        minCellX, maxCellX = -64, 63
        minCellY, maxCellY = -48, 47
        totalW = (maxCellX - minCellX + 1) * CELL_PX # 2048 px
        totalH = (maxCellY - minCellY + 1) * CELL_PX # 1536 px

        img = Image.new("RGBA", (totalW, totalH), (9, 22, 28, 255)) # Ocean background
        pasted = 0

        for cell in cells_data:
            cx = cell['x']
            cy = cell['y']
            rot = cell['rotation']
            x_off = cell['xOffset']
            y_off = cell['yOffset']
            uid = cell['uuid']

            h = fnv1a(uid)
            tile_info = manifest['tiles'].get(h)
            if not tile_info:
                continue

            sub_idx = y_off * tile_info['cellsX'] + x_off
            atlas_idx = tile_info['start'] + sub_idx * manifest['rotations'] + rot

            sx = (atlas_idx % manifest['columns']) * CELL_PX
            sy = (atlas_idx // manifest['columns']) * CELL_PX

            dx = (cx - minCellX) * CELL_PX
            dy = (maxCellY - cy) * CELL_PX

            tile_crop = atlas_img.crop((sx, sy, sx + CELL_PX, sy + CELL_PX))
            img.paste(tile_crop, (dx, dy))
            pasted += 1

        img = apply_seam_blending_pil(img, CELL_PX, 0.85)
        img.save(output_path, "PNG")
        print(f"[TerrainBuilder] Stitched & Blended {pasted}/{len(cells_data)} cells via official atlas. Saved {output_filename} in {time.time()-t0:.2f}s!", flush=True)
        return output_filename
    else:
        print("[TerrainBuilder] Atlas unavailable, saved null.", flush=True)
        return None

if __name__ == '__main__':
    target_seed = 631793443
    json_mode = False
    
    if len(sys.argv) > 1:
        for i, arg in enumerate(sys.argv):
            if arg in ('--seed', '-s') and i + 1 < len(sys.argv):
                try:
                    target_seed = int(sys.argv[i + 1])
                except ValueError:
                    pass
            elif arg == '--json':
                json_mode = True
            elif arg.isdigit():
                target_seed = int(arg)

    if json_mode:
        cells = get_terrain_cells_for_seed(target_seed)
        print(json.dumps({"success": True, "seed": target_seed, "cells": cells}))
    else:
        generate_terrain_for_seed(target_seed)

