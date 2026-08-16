import os
import glob
import winreg

def find_game_directory():
    """Dynamically finds Scrap Mechanic game install directory."""
    # 1. Check parent directory of this script
    current_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(current_dir)
    if os.path.exists(os.path.join(parent_dir, "Release", "ScrapMechanic.exe")):
        return parent_dir.replace("\\", "/")
    
    # 2. Check current working directory
    cwd = os.getcwd()
    if os.path.exists(os.path.join(cwd, "Release", "ScrapMechanic.exe")):
        return cwd.replace("\\", "/")
    
    # 3. Query Steam registry path
    try:
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Valve\Steam")
        steam_path, _ = winreg.QueryValueEx(key, "SteamPath")
        winreg.CloseKey(key)
        
        # Check standard steamapps/common
        candidate = os.path.join(steam_path, "steamapps", "common", "Scrap Mechanic")
        if os.path.exists(os.path.join(candidate, "Release", "ScrapMechanic.exe")):
            return candidate.replace("\\", "/")
            
        # Parse libraryfolders.vdf for external Steam libraries
        vdf_path = os.path.join(steam_path, "steamapps", "libraryfolders.vdf")
        if os.path.exists(vdf_path):
            with open(vdf_path, "r", encoding="utf-8", errors="ignore") as fp:
                for line in fp:
                    if '"path"' in line:
                        parts = line.split('"')
                        if len(parts) >= 4:
                            lib_path = parts[3].replace("\\\\", "/")
                            lib_cand = os.path.join(lib_path, "steamapps", "common", "Scrap Mechanic")
                            if os.path.exists(os.path.join(lib_cand, "Release", "ScrapMechanic.exe")):
                                return lib_cand.replace("\\", "/")
    except Exception:
        pass

    # 4. Check common drives as fallback
    for drive in ["C:", "D:", "E:", "F:", "G:"]:
        for common_folder in ["SteamLibrary", "Program Files (x86)/Steam", "Steam"]:
            cand = f"{drive}/{common_folder}/steamapps/common/Scrap Mechanic"
            if os.path.exists(os.path.join(cand, "Release", "ScrapMechanic.exe")):
                return cand.replace("\\", "/")

    return None

def get_survival_saves():
    """Finds all Scrap Mechanic Survival save databases in AppData."""
    appdata = os.environ.get('APPDATA', '')
    if not appdata:
        return []
    pattern = os.path.join(appdata, 'Axolot Games', 'Scrap Mechanic', 'User', 'User_*', 'Save', 'Survival', '*.db')
    files = glob.glob(pattern)
    saves = []
    for f in files:
        try:
            stat = os.stat(f)
            name = os.path.splitext(os.path.basename(f))[0]
            saves.append({
                "name": name,
                "filename": os.path.basename(f),
                "path": f.replace("\\", "/"),
                "size": stat.st_size,
                "mtime": stat.st_mtime
            })
        except Exception:
            pass
    saves.sort(key=lambda s: s["mtime"], reverse=True)
    return saves
