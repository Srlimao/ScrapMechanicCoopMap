import os
import sqlite3
import json
import uuid
import struct
import re

try:
    from backend.path_finder import find_game_directory
    GAME_DIR = find_game_directory() or r"d:\SteamLibrary\steamapps\common\Scrap Mechanic"
except Exception:
    GAME_DIR = r"d:\SteamLibrary\steamapps\common\Scrap Mechanic"
OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DB_PATH = os.path.join(OUTPUT_DIR, "Dunhas_copy.db")

FRIENDLY_NAMES = {
    # Units
    "unit_farmbot": {"name": "Farmbot (Red Boss)", "category": "boss", "icon": "fa-skull-crossbones", "color": "#ef4444"},
    "unit_haybot": {"name": "Haybot", "category": "bot", "icon": "fa-robot", "color": "#f97316"},
    "unit_tapebot": {"name": "Tapebot (Standard)", "category": "bot", "icon": "fa-crosshairs", "color": "#38bdf8"},
    "unit_tapebot_green_1": {"name": "Green Tapebot", "category": "bot", "icon": "fa-crosshairs", "color": "#22c55e"},
    "unit_tapebot_green_2": {"name": "Green Tapebot", "category": "bot", "icon": "fa-crosshairs", "color": "#22c55e"},
    "unit_tapebot_green_3": {"name": "Green Tapebot", "category": "bot", "icon": "fa-crosshairs", "color": "#22c55e"},
    "unit_tapebot_red": {"name": "Red Tapebot (Explosive)", "category": "boss", "icon": "fa-bomb", "color": "#dc2626"},
    "unit_tapebot_taped_1": {"name": "Taped Tapebot", "category": "bot", "icon": "fa-crosshairs", "color": "#38bdf8"},
    "unit_tapebot_taped_2": {"name": "Taped Tapebot", "category": "bot", "icon": "fa-crosshairs", "color": "#38bdf8"},
    "unit_tapebot_taped_3": {"name": "Taped Tapebot", "category": "bot", "icon": "fa-crosshairs", "color": "#38bdf8"},
    "unit_tapebot_yellow": {"name": "Yellow Tapebot", "category": "bot", "icon": "fa-crosshairs", "color": "#eab308"},
    "unit_totebot_green": {"name": "Green Totebot (Whip)", "category": "bot", "icon": "fa-bolt", "color": "#84cc16"},
    "unit_totebot_red": {"name": "Red Totebot", "category": "bot", "icon": "fa-bolt", "color": "#ef4444"},
    "unit_totebot_blue": {"name": "Blue Totebot", "category": "bot", "icon": "fa-bolt", "color": "#06b6d4"},
    "unit_totebot_yellow": {"name": "Yellow Totebot", "category": "bot", "icon": "fa-bolt", "color": "#eab308"},
    "unit_totebot_leaf": {"name": "Leaf Totebot", "category": "bot", "icon": "fa-bolt", "color": "#10b981"},
    "unit_woc": {"name": "Woc (Cow)", "category": "animal", "icon": "fa-cow", "color": "#fef08a"},
    "unit_baby_woc": {"name": "Baby Woc", "category": "animal", "icon": "fa-cow", "color": "#fef08a"},
    "unit_glowgorp": {"name": "Glowbug", "category": "animal", "icon": "fa-sun", "color": "#a3e635"},
    "unit_seedbot": {"name": "Seedbot", "category": "bot", "icon": "fa-seedling", "color": "#34d399"},
    "unit_lootbot": {"name": "Lootbot", "category": "bot", "icon": "fa-gem", "color": "#f472b6"},
    "unit_minerbot": {"name": "Minerbot", "category": "bot", "icon": "fa-hammer", "color": "#fb923c"},
    "unit_cablebot": {"name": "Cablebot", "category": "bot", "icon": "fa-plug", "color": "#a855f7"},
    "unit_trashbot": {"name": "Trashbot", "category": "boss", "icon": "fa-trash", "color": "#9333ea"},
    "unit_trashbot2": {"name": "Trashbot 2", "category": "boss", "icon": "fa-trash", "color": "#9333ea"},
    "unit_worm": {"name": "Worm", "category": "animal", "icon": "fa-bacon", "color": "#f87171"},
    
    # Harvestables
    "hvs_farmables_oilgeyser": {"name": "Oil Geyser", "category": "resource", "icon": "fa-oil-well", "color": "#f59e0b"},
    "hvs_farmables_growing_oilgeyser": {"name": "Oil Geyser (Replenishing)", "category": "resource", "icon": "fa-oil-well", "color": "#d97706"},
    "hvs_farmables_cottonplant": {"name": "Cotton Plant", "category": "resource", "icon": "fa-feather", "color": "#f8fafc"},
    "hvs_farmables_growing_cottonplant": {"name": "Cotton Plant (Growing)", "category": "resource", "icon": "fa-feather", "color": "#e2e8f0"},
    "hvs_farmables_pigmentflower": {"name": "Pigment Flower", "category": "resource", "icon": "fa-palette", "color": "#ec4899"},
    "hvs_farmables_growing_pigmentflower": {"name": "Pigment Flower (Growing)", "category": "resource", "icon": "fa-palette", "color": "#f472b6"},
    "hvs_farmables_cornplant": {"name": "Corn Plant", "category": "resource", "icon": "fa-wheat-awn", "color": "#facc15"},
    "hvs_farmables_beehive": {"name": "Beehive (Beewax)", "category": "resource", "icon": "fa-archive", "color": "#f59e0b"},
    "hvs_farmables_slimyclam": {"name": "Slimy Clam", "category": "resource", "icon": "fa-water", "color": "#06b6d4"},
    "hvs_farmables_golddeposit": {"name": "Gold Deposit", "category": "resource", "icon": "fa-coins", "color": "#fbbf24"},
    "hvs_farmables_quartz": {"name": "Quartz Crystal", "category": "resource", "icon": "fa-gem", "color": "#e879f9"},
    "hvs_stone_small01": {"name": "Small Stone Node", "category": "mineral", "icon": "fa-mountain", "color": "#94a3b8"},
    "hvs_stone_small02": {"name": "Small Stone Node", "category": "mineral", "icon": "fa-mountain", "color": "#94a3b8"},
    "hvs_stone_small03": {"name": "Small Stone Node", "category": "mineral", "icon": "fa-mountain", "color": "#94a3b8"},
    "hvs_stone_medium01": {"name": "Medium Stone Node", "category": "mineral", "icon": "fa-mountain", "color": "#94a3b8"},
    "hvs_stone_medium02": {"name": "Medium Stone Node", "category": "mineral", "icon": "fa-mountain", "color": "#94a3b8"},
    "hvs_stone_large01": {"name": "Large Stone / Metal Node", "category": "mineral", "icon": "fa-mountain", "color": "#cbd5e1"},
    "hvs_stone_large02": {"name": "Large Stone / Metal Node", "category": "mineral", "icon": "fa-mountain", "color": "#cbd5e1"},
    "hvs_tree_pine01": {"name": "Pine Tree", "category": "tree", "icon": "fa-tree", "color": "#15803d"},
    "hvs_tree_pine02": {"name": "Pine Tree", "category": "tree", "icon": "fa-tree", "color": "#15803d"},
    "hvs_tree_pine03": {"name": "Pine Tree", "category": "tree", "icon": "fa-tree", "color": "#15803d"},
    "hvs_tree_leafy01": {"name": "Leafy Tree", "category": "tree", "icon": "fa-tree", "color": "#22c55e"},
    "hvs_tree_leafy02": {"name": "Leafy Tree", "category": "tree", "icon": "fa-tree", "color": "#22c55e"},
    "hvs_tree_leafy03": {"name": "Leafy Tree", "category": "tree", "icon": "fa-tree", "color": "#22c55e"},
    "hvs_tree_birch01": {"name": "Birch Tree", "category": "tree", "icon": "fa-tree", "color": "#86efac"},
    "hvs_tree_birch02": {"name": "Birch Tree", "category": "tree", "icon": "fa-tree", "color": "#86efac"},
    "hvs_tree_birch03": {"name": "Birch Tree", "category": "tree", "icon": "fa-tree", "color": "#86efac"},
    "hvs_tree_spruce01": {"name": "Spruce Tree", "category": "tree", "icon": "fa-tree", "color": "#166534"},
    "hvs_tree_spruce02": {"name": "Spruce Tree", "category": "tree", "icon": "fa-tree", "color": "#166534"},
    "hvs_tree_spruce03": {"name": "Spruce Tree", "category": "tree", "icon": "fa-tree", "color": "#166534"},
    "hvs_lootcrate": {"name": "Loot Crate", "category": "loot", "icon": "fa-box-open", "color": "#38bdf8"},
    "hvs_lootcrateepic": {"name": "Epic Gold Loot Crate", "category": "loot", "icon": "fa-box-open", "color": "#facc15"},
    "hvs_lootcratelegendary": {"name": "Legendary Purple Loot Crate", "category": "loot", "icon": "fa-box-open", "color": "#c084fc"}
}

def scan_game_uuids(game_dir):
    """Scans game directory to map UUIDs to readable names and categories."""
    uuid_map = {}
    
    def find_uuids(obj, source_file):
        if isinstance(obj, dict):
            if 'uuid' in obj:
                u = str(obj['uuid']).lower()
                name = obj.get('name') or obj.get('type') or obj.get('code') or u
                uuid_map[u] = {'name': name, 'source': source_file}
            for k, v in obj.items():
                find_uuids(v, source_file)
        elif isinstance(obj, list):
            for item in obj:
                find_uuids(item, source_file)

    for root, dirs, files in os.walk(game_dir):
        for f in files:
            if f.endswith(('.json', '.harvestableset', '.unitset', '.shapeset')):
                fpath = os.path.join(root, f)
                try:
                    with open(fpath, 'r', encoding='utf-8', errors='ignore') as fp:
                        data = json.load(fp)
                        find_uuids(data, os.path.basename(fpath))
                except Exception:
                    pass

    # Add known units from survival_units.lua
    units_lua = os.path.join(game_dir, "Survival", "Scripts", "game", "survival_units.lua")
    if os.path.exists(units_lua):
        try:
            with open(units_lua, 'r', encoding='utf-8', errors='ignore') as fp:
                text = fp.read()
                matches = re.findall(r'(\w+)\s*=\s*sm\.uuid\.new\(\s*"([a-fA-F0-9\-]+)"\s*\)', text)
                for uname, uhex in matches:
                    u_clean = uhex.lower()
                    friendly = FRIENDLY_NAMES.get(uname, {})
                    uuid_map[u_clean] = {
                        'name': friendly.get('name', uname.replace('unit_', '').replace('_', ' ').title()),
                        'rawName': uname,
                        'category': friendly.get('category', 'bot'),
                        'icon': friendly.get('icon', 'fa-robot'),
                        'color': friendly.get('color', '#ef4444'),
                        'source': 'survival_units.lua'
                    }
        except Exception:
            pass

    # Add known harvestables from survival_harvestable.lua
    harv_lua = os.path.join(game_dir, "Survival", "Scripts", "game", "survival_harvestable.lua")
    if os.path.exists(harv_lua):
        try:
            with open(harv_lua, 'r', encoding='utf-8', errors='ignore') as fp:
                text = fp.read()
                matches = re.findall(r'(\w+)\s*=\s*sm\.uuid\.new\(\s*"([a-fA-F0-9\-]+)"\s*\)', text)
                for hname, uhex in matches:
                    u_clean = uhex.lower()
                    friendly = FRIENDLY_NAMES.get(hname, {})
                    uuid_map[u_clean] = {
                        'name': friendly.get('name', hname.replace('hvs_', '').replace('_', ' ').title()),
                        'rawName': hname,
                        'category': friendly.get('category', 'resource'),
                        'icon': friendly.get('icon', 'fa-seedling'),
                        'color': friendly.get('color', '#10b981'),
                        'source': 'survival_harvestable.lua'
                    }
        except Exception:
            pass

    # Add fallback friendly names
    for raw_key, info in FRIENDLY_NAMES.items():
        for u, entry in list(uuid_map.items()):
            if entry.get('rawName') == raw_key or entry.get('name') == raw_key:
                entry.update(info)

    return uuid_map

def decode_save_file(db_path, uuid_map):
    """Parses Scrap Mechanic SQLite save file and returns dictionary of map entities."""
    if not os.path.exists(db_path):
        raise FileNotFoundError(f"Database file not found: {db_path}")

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    # 1. Game Info
    cur.execute("SELECT savegameversion, flags, seed, gametick FROM Game")
    g_row = cur.fetchone()
    game_info = {
        'version': g_row[0] if g_row else 0,
        'flags': g_row[1] if g_row else 0,
        'seed': g_row[2] if g_row else 0,
        'gametick': g_row[3] if g_row else 0
    }

    # 2. RigidBodies & RigidBodyBounds (Creations)
    creations = []
    cur.execute("SELECT id, minX, maxX, minY, maxY FROM RigidBodyBounds")
    bounds = cur.fetchall()
    
    # Get shape counts per rigidbody
    cur.execute("SELECT bodyId, COUNT(*) FROM ChildShape GROUP BY bodyId")
    shape_counts = dict(cur.fetchall())

    for rbid, min_x, max_x, min_y, max_y in bounds:
        cx = (min_x + max_x) / 2.0
        cy = (min_y + max_y) / 2.0
        width = abs(max_x - min_x)
        height = abs(max_y - min_y)
        blocks = shape_counts.get(rbid, 1)
        
        cell_x = int(cx // 256)
        cell_y = int(cy // 256)

        creations.append({
            'id': rbid,
            'x': round(cx, 2),
            'y': round(cy, 2),
            'minX': round(min_x, 2),
            'maxX': round(max_x, 2),
            'minY': round(min_y, 2),
            'maxY': round(max_y, 2),
            'cellX': cell_x,
            'cellY': cell_y,
            'width': round(width, 2),
            'height': round(height, 2),
            'blocks': blocks
        })

    # 3. Units (Enemies, NPCs, Animals)
    units = []
    cur.execute("SELECT id, worldId, x, y, data FROM Unit")
    for uid, wid, cx, cy, blob in cur.fetchall():
        unit_uuid = "unknown"
        if len(blob) >= 34:
            try:
                # UUID stored in byte-reversed order at offset 18
                raw_bytes = blob[18:34][::-1]
                unit_uuid = str(uuid.UUID(bytes=raw_bytes)).lower()
            except Exception:
                pass
        
        info = uuid_map.get(unit_uuid, {
            'name': 'Unknown Unit',
            'category': 'bot',
            'icon': 'fa-robot',
            'color': '#ef4444'
        })

        local_x, local_y, local_z = 0.0, 0.0, 0.0
        if len(blob) >= 49:
            try:
                fx = struct.unpack('<f', blob[37:41])[0]
                fy = struct.unpack('<f', blob[41:45])[0]
                fz = struct.unpack('<f', blob[45:49])[0]
                if -256 <= fx <= 256 and -256 <= fy <= 256:
                    local_x, local_y, local_z = fx, fy, fz
            except Exception:
                pass

        world_x = cx * 256.0 + 128.0 + local_x
        world_y = cy * 256.0 + 128.0 + local_y

        units.append({
            'id': uid,
            'worldId': wid,
            'cellX': cx,
            'cellY': cy,
            'x': round(world_x, 2),
            'y': round(world_y, 2),
            'z': round(local_z, 2),
            'uuid': unit_uuid,
            'name': info.get('name', 'Unit'),
            'category': info.get('category', 'bot'),
            'icon': info.get('icon', 'fa-robot'),
            'color': info.get('color', '#ef4444')
        })

    # 4. Harvestables (Resource nodes)
    harvestables = []
    cur.execute("SELECT id, worldId, x, y, size, data FROM Harvestable")
    for hid, wid, cx, cy, size, blob in cur.fetchall():
        h_uuid = "unknown"
        if len(blob) >= 36:
            try:
                # UUID stored in byte-reversed order at offset 20
                raw_bytes = blob[20:36][::-1]
                h_uuid = str(uuid.UUID(bytes=raw_bytes)).lower()
            except Exception:
                pass
        
        info = uuid_map.get(h_uuid, {
            'name': 'Resource Node',
            'category': 'resource',
            'icon': 'fa-seedling',
            'color': '#10b981'
        })

        local_x, local_y = 0.0, 0.0
        if len(blob) >= 45:
            try:
                fx = struct.unpack('<f', blob[37:41])[0]
                fy = struct.unpack('<f', blob[41:45])[0]
                if -256 <= fx <= 256 and -256 <= fy <= 256:
                    local_x, local_y = fx, fy
            except Exception:
                pass

        world_x = cx * 256.0 + 128.0 + local_x
        world_y = cy * 256.0 + 128.0 + local_y

        harvestables.append({
            'id': hid,
            'worldId': wid,
            'cellX': cx,
            'cellY': cy,
            'x': round(world_x, 2),
            'y': round(world_y, 2),
            'size': size,
            'uuid': h_uuid,
            'name': info.get('name', 'Resource Node'),
            'category': info.get('category', 'resource'),
            'icon': info.get('icon', 'fa-seedling'),
            'color': info.get('color', '#10b981')
        })

    # 5. POIs & Schematicbot Machines / Guide Platforms
    pois = []
    schematics = []
    cur.execute("SELECT key, worldId, data FROM ScriptData")
    script_rows = cur.fetchall()
    
    tile_storage_regex = re.compile(rb'ts_(\d+):\((-?\d+),(-?\d+)\)')
    
    poi_tags_seen = set()
    schematic_seen = set()

    for key, world_id, data in script_rows:
        m = tile_storage_regex.search(key)
        if m:
            w_id, cell_x, cell_y = int(m.group(1)), int(m.group(2)), int(m.group(3))
            text = "".join([chr(b) if 32 <= b <= 126 else " " for b in data])
            text_lower = text.lower()

            # A. Schematicbot Machine Structure (PartUnlockStation / Scanner Machine)
            if 'mechanicstation' in text_lower or 'nonplayercrafter' in text_lower or 'partunlockstation' in text_lower or 'kiosk' in text_lower or 'schematicstation' in text_lower:
                sch_bot_name = "Schematicbot Machine (Recipe Unlocker Station)"
                sch_key = f"{cell_x},{cell_y}:{sch_bot_name}"
                if sch_key not in schematic_seen:
                    schematic_seen.add(sch_key)
                    world_x = cell_x * 256.0 + 128.0
                    world_y = cell_y * 256.0 + 128.0
                    schematics.append({
                        'worldId': w_id,
                        'cellX': cell_x,
                        'cellY': cell_y,
                        'x': round(world_x, 2),
                        'y': round(world_y, 2),
                        'kind': 'machine',
                        'name': sch_bot_name,
                        'icon': 'fa-microchip',
                        'desc': 'Schematicbot Station machine with hologram top used to turn schematics into Craftbot recipes.'
                    })

            # B. Builder Guide Platforms / Blueprints
            guide_name = None
            if '_startercar' in text_lower or '_first_car' in text_lower:
                guide_name = "Starter Car Builder Guide Platform"
            elif '_harvest_car' in text_lower:
                guide_name = "Harvest Car Builder Guide Platform"
            elif '_advanced_car' in text_lower:
                guide_name = "Advanced Car Builder Guide Platform"
            elif 'bq_watchtower' in text_lower:
                guide_name = "Watchtower Builder Guide Platform"
            elif 'bq_wochouse' in text_lower or '_wochous' in text_lower:
                guide_name = "Woc House Builder Guide Platform"

            if guide_name:
                g_key = f"{cell_x},{cell_y}:{guide_name}"
                if g_key not in schematic_seen:
                    schematic_seen.add(g_key)
                    world_x = cell_x * 256.0 + 128.0
                    world_y = cell_y * 256.0 + 128.0
                    schematics.append({
                        'worldId': w_id,
                        'cellX': cell_x,
                        'cellY': cell_y,
                        'x': round(world_x, 2),
                        'y': round(world_y, 2),
                        'kind': 'guide',
                        'name': guide_name,
                        'icon': 'fa-cubes',
                        'desc': 'Blueprint platform on the ground for assembling vehicles/structures.'
                    })

            # Key POIs
            detected_types = []
            poi_icon = 'fa-location-dot'
            poi_color = '#f59e0b'

            if 'mechanicstation' in text_lower:
                detected_types.append('Mechanic Station')
                poi_icon = 'fa-wrench'
                poi_color = '#ff6b00'
            if 'hideout' in text_lower:
                detected_types.append('Hideout')
                poi_icon = 'fa-store'
                poi_color = '#10b981'
            if 'warehouse' in text_lower:
                detected_types.append('Warehouse')
                poi_icon = 'fa-building-shield'
                poi_color = '#ef4444'
            if 'farmer' in text_lower or 'trader' in text_lower:
                detected_types.append('Trader / Farmer')
                poi_icon = 'fa-handshake'
                poi_color = '#10b981'
            if 'silo' in text_lower or 'packing' in text_lower:
                detected_types.append('Packing Station')
                poi_icon = 'fa-boxes-packing'
                poi_color = '#06b6d4'
            if 'watchtower' in text_lower or 'tower' in text_lower:
                detected_types.append('Watchtower')
                poi_icon = 'fa-tower-observation'
                poi_color = '#8b5cf6'
            if 'ship' in text_lower or 'crashed' in text_lower:
                detected_types.append('Crashed Ship')
                poi_icon = 'fa-shuttle-space'
                poi_color = '#f97316'

            if detected_types:
                poi_key = f"{cell_x},{cell_y}"
                if poi_key not in poi_tags_seen:
                    poi_tags_seen.add(poi_key)
                    world_x = cell_x * 256.0 + 128.0
                    world_y = cell_y * 256.0 + 128.0
                    pois.append({
                        'worldId': w_id,
                        'cellX': cell_x,
                        'cellY': cell_y,
                        'x': round(world_x, 2),
                        'y': round(world_y, 2),
                        'types': detected_types,
                        'name': " & ".join(detected_types),
                        'icon': poi_icon,
                        'color': poi_color
                    })

    # 6. Portals
    portals = []
    cur.execute("SELECT id, worldIdA, xA, yA, worldIdB, xB, yB FROM Portal")
    for pid, wA, xA, yA, wB, xB, yB in cur.fetchall():
        portals.append({
            'id': pid,
            'worldA': {'worldId': wA, 'cellX': xA, 'cellY': yA, 'x': xA * 256.0 + 128.0, 'y': yA * 256.0 + 128.0},
            'worldB': {'worldId': wB, 'cellX': xB, 'cellY': yB, 'x': xB * 256.0 + 128.0, 'y': yB * 256.0 + 128.0}
        })

    conn.close()

    return {
        'gameInfo': game_info,
        'pois': pois,
        'schematics': schematics,
        'creations': creations,
        'units': units,
        'harvestables': harvestables,
        'portals': portals
    }

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("1. Scanning Scrap Mechanic game directory for asset UUIDs...")
    uuid_map = scan_game_uuids(GAME_DIR)
    print(f"   Mapped {len(uuid_map)} UUIDs.")

    # Save asset UUID dictionary
    uuid_json_path = os.path.join(OUTPUT_DIR, "asset_uuids.json")
    with open(uuid_json_path, 'w', encoding='utf-8') as f:
        json.dump(uuid_map, f, indent=2)

    # Decode save file
    db_path = DEFAULT_DB_PATH
    if os.path.exists(db_path):
        print(f"2. Decoding copied save file: {db_path}...")
        save_data = decode_save_file(db_path, uuid_map)
        
        map_json_path = os.path.join(OUTPUT_DIR, "save_map_data.json")
        with open(map_json_path, 'w', encoding='utf-8') as f:
            json.dump(save_data, f, indent=2)
        
        print(f"   Exported map data to {map_json_path}")
        print(f"   Summary: POIs={len(save_data['pois'])}, Schematics={len(save_data['schematics'])}, Creations={len(save_data['creations'])}, Units={len(save_data['units'])}, Harvestables={len(save_data['harvestables'])}, Portals={len(save_data['portals'])}")
    else:
        print(f"Warning: Copied save file not found at {db_path}.")

if __name__ == '__main__':
    main()
