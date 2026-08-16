import os
import shutil
import sqlite3
from .path_finder import get_survival_saves

def make_save_snapshot(cache_dir, save_name=None):
    """Safely snapshots active Scrap Mechanic SQLite save with WAL checkpoint."""
    saves = get_survival_saves()
    if not saves:
        return None, None, "No Scrap Mechanic survival save files found in AppData."
    
    target_save = saves[0]
    if save_name:
        for s in saves:
            if s["name"].lower() == save_name.lower() or s["filename"].lower() == save_name.lower():
                target_save = s
                break

    save_path = target_save["path"]
    if not os.path.exists(save_path):
        return None, None, f"Save file {save_path} not found."
    
    snapshot_dir = os.path.join(cache_dir, "save_cache")
    os.makedirs(snapshot_dir, exist_ok=True)
    target_name = os.path.basename(save_path)
    target_path = os.path.join(snapshot_dir, target_name)
    
    try:
        shutil.copy2(save_path, target_path)
        for ext in ['-wal', '-shm']:
            src_extra = save_path + ext
            if os.path.exists(src_extra):
                shutil.copy2(src_extra, target_path + ext)
        
        # Checkpoint WAL into standalone .db so SQLite readers have all committed data
        try:
            con = sqlite3.connect(target_path)
            con.execute("PRAGMA wal_checkpoint(TRUNCATE);")
            con.close()
        except Exception:
            pass

        return target_path, target_name, None
    except Exception as e:
        return None, None, str(e)
