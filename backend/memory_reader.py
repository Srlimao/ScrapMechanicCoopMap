import time
import ctypes
from ctypes import wintypes
import struct
import psutil

PROCESS_VM_READ = 0x0010
PROCESS_QUERY_INFORMATION = 0x0400

k32 = ctypes.windll.kernel32
psapi = ctypes.windll.psapi

class MemoryReader:
    def __init__(self):
        self.state = {
            "online": False,
            "x": 0.0,
            "y": 0.0,
            "z": 0.0,
            "dirX": 0.0,
            "dirY": 1.0,
            "dirZ": 0.0,
            "tick": 0,
            "age": 999,
            "source": "none",
            "process_pid": None
        }
        self.PLAYER_BASE_OFFSET = 0x1A62150
        self.POS_OFFSET = 0x90
        self.DIR_OFFSET = 0xB8
        self.SECONDARY_BASE_OFFSET = 0x1A625F8
        self.last_logged_status = None

    def get_scrap_process_info(self):
        for p in psutil.process_iter(['pid', 'name']):
            try:
                pname = p.info['name'].lower()
                if 'scrap' in pname and ('mechanic' in pname or 'exe' in pname):
                    pid = p.info['pid']
                    hProcess = k32.OpenProcess(PROCESS_VM_READ | PROCESS_QUERY_INFORMATION, False, pid)
                    if hProcess:
                        hMods = (wintypes.HMODULE * 1)()
                        cbNeeded = wintypes.DWORD()
                        if psapi.EnumProcessModules(hProcess, hMods, ctypes.sizeof(hMods), ctypes.byref(cbNeeded)):
                            base_addr = hMods[0]
                            return hProcess, base_addr, pid
                        k32.CloseHandle(hProcess)
            except Exception:
                pass
        return None, None, None

    def run_loop(self):
        hProcess = None
        base_addr = None
        pid = None

        buf128 = ctypes.create_string_buffer(128)
        bytesRead = ctypes.c_size_t(0)
        tick_counter = 0
        ptr_buf = ctypes.create_string_buffer(8)

        print("[MemoryHook] Real-time memory reader daemon started.", flush=True)

        while True:
            try:
                if not hProcess:
                    hProcess, base_addr, pid = self.get_scrap_process_info()
                    if not hProcess:
                        if self.last_logged_status != "waiting":
                            print("[MemoryHook] Waiting for ScrapMechanic.exe process...", flush=True)
                            self.last_logged_status = "waiting"
                        self.state["online"] = False
                        self.state["process_pid"] = None
                        time.sleep(1.5)
                        continue
                    else:
                        print(f"[MemoryHook] DETECTED Scrap Mechanic process (PID: {pid}, BaseAddr: {hex(base_addr)})", flush=True)
                        self.last_logged_status = "detected"
                        self.state["process_pid"] = pid

                coords_read = False
                # 1. Primary Static Pointer
                if k32.ReadProcessMemory(hProcess, ctypes.c_void_p(base_addr + self.PLAYER_BASE_OFFSET), ptr_buf, 8, ctypes.byref(bytesRead)):
                    player_obj_ptr = struct.unpack('<Q', ptr_buf.raw)[0]
                    if player_obj_ptr and 0x10000000000 <= player_obj_ptr <= 0x7FFFFFFFFFFF:
                        if k32.ReadProcessMemory(hProcess, ctypes.c_void_p(player_obj_ptr + self.POS_OFFSET), buf128, 128, ctypes.byref(bytesRead)):
                            raw = buf128.raw
                            x, y, z = struct.unpack_from('<fff', raw, 0)
                            dirX, dirY, dirZ = struct.unpack_from('<fff', raw, self.DIR_OFFSET - self.POS_OFFSET)

                            if -16384.0 < x < 16384.0 and -12288.0 < y < 12288.0 and -50.0 < z < 2000.0:
                                self.state["online"] = True
                                self.state["x"] = round(x, 2)
                                self.state["y"] = round(y, 2)
                                self.state["z"] = round(z, 2)
                                self.state["dirX"] = round(dirX, 4)
                                self.state["dirY"] = round(dirY, 4)
                                self.state["dirZ"] = round(dirZ, 4)
                                self.state["age"] = 0.0
                                self.state["tick"] = tick_counter
                                self.state["source"] = "memory_hook"
                                tick_counter += 1
                                coords_read = True

                # 2. Secondary Fallback Pointer
                if not coords_read:
                    if k32.ReadProcessMemory(hProcess, ctypes.c_void_p(base_addr + self.SECONDARY_BASE_OFFSET), ptr_buf, 8, ctypes.byref(bytesRead)):
                        sec_ptr = struct.unpack('<Q', ptr_buf.raw)[0]
                        if sec_ptr and 0x10000000000 <= sec_ptr <= 0x7FFFFFFFFFFF:
                            if k32.ReadProcessMemory(hProcess, ctypes.c_void_p(sec_ptr + 0x28), buf128, 12, ctypes.byref(bytesRead)):
                                x, y, z = struct.unpack_from('<fff', buf128.raw, 0)
                                if -16384.0 < x < 16384.0 and -12288.0 < y < 12288.0:
                                    self.state["online"] = True
                                    self.state["x"] = round(x, 2)
                                    self.state["y"] = round(y, 2)
                                    self.state["z"] = round(z, 2)
                                    self.state["age"] = 0.0
                                    self.state["tick"] = tick_counter
                                    self.state["source"] = "memory_hook_secondary"
                                    tick_counter += 1
                                    coords_read = True

                if not coords_read:
                    self.state["online"] = False

            except Exception as e:
                print(f"[MemoryHook] Process access lost: {e}", flush=True)
                if hProcess:
                    k32.CloseHandle(hProcess)
                hProcess, base_addr, pid = None, None, None
                self.state["online"] = False

            time.sleep(0.05)
