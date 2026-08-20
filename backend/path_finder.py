import os
import sys
import glob

try:
    import winreg
except ImportError:
    winreg = None

def get_linux_steam_roots():
    home = os.environ.get('HOME', '')
    if not home:
        return []
    candidates = [
        os.path.join(home, '.steam', 'steam'),
        os.path.join(home, '.steam', 'root'),
        os.path.join(home, '.local', 'share', 'Steam'),
        os.path.join(home, '.var', 'app', 'com.valvesoftware.Steam', '.local', 'share', 'Steam'),
        os.path.join(home, '.var', 'app', 'com.valvesoftware.Steam', '.steam', 'steam')
    ]
    return [c for c in candidates if os.path.exists(c)]

def get_all_steam_libraries():
    libs = set()
    if sys.platform == 'win32' and winreg:
        try:
            key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Valve\Steam")
            steam_path, _ = winreg.QueryValueEx(key, "SteamPath")
            winreg.CloseKey(key)
            libs.add(steam_path.replace("\\", "/"))
            vdf_path = os.path.join(steam_path, "steamapps", "libraryfolders.vdf")
            if os.path.exists(vdf_path):
                with open(vdf_path, "r", encoding="utf-8", errors="ignore") as fp:
                    for line in fp:
                        if '"path"' in line:
                            parts = line.split('"')
                            if len(parts) >= 4:
                                lib_cand = parts[3].replace("\\\\", "/")
                                if os.path.exists(lib_cand):
                                    libs.add(lib_cand)
        except Exception:
            pass

        for drive in ["C:", "D:", "E:", "F:", "G:"]:
            for common_folder in ["SteamLibrary", "Program Files (x86)/Steam", "Steam"]:
                cand = f"{drive}/{common_folder}"
                if os.path.exists(cand):
                    libs.add(cand)
    else:
        for root in get_linux_steam_roots():
            libs.add(root.replace("\\", "/"))
            vdf_path = os.path.join(root, "steamapps", "libraryfolders.vdf")
            if os.path.exists(vdf_path):
                try:
                    with open(vdf_path, "r", encoding="utf-8", errors="ignore") as fp:
                        for line in fp:
                            if '"path"' in line:
                                parts = line.split('"')
                                if len(parts) >= 4:
                                    lib_cand = parts[3].replace("\\\\", "/")
                                    if os.path.exists(lib_cand):
                                        libs.add(lib_cand)
                except Exception:
                    pass
    return list(libs)

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
    
    # 3. Check all Steam libraries
    for lib in get_all_steam_libraries():
        cand = os.path.join(lib, "steamapps", "common", "Scrap Mechanic")
        if os.path.exists(os.path.join(cand, "Release", "ScrapMechanic.exe")) or os.path.exists(os.path.join(cand, "ScrapMechanic.exe")):
            return cand.replace("\\", "/")

    return None

def get_survival_saves():
    """Finds all Scrap Mechanic Survival save databases in AppData or Proton prefix."""
    patterns = []
    if sys.platform == 'win32':
        appdata = os.environ.get('APPDATA', '')
        if appdata:
            patterns.append(os.path.join(appdata, 'Axolot Games', 'Scrap Mechanic', 'User', 'User_*', 'Save', 'Survival', '*.db'))
    else:
        for lib in get_all_steam_libraries():
            patterns.append(os.path.join(lib, 'steamapps', 'compatdata', '387990', 'pfx', 'drive_c', 'users', '*', 'AppData', 'Roaming', 'Axolot Games', 'Scrap Mechanic', 'User', 'User_*', 'Save', 'Survival', '*.db'))

    files = []
    for pattern in patterns:
        files.extend(glob.glob(pattern))

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
