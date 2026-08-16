const koffi = require('koffi');

const PROCESS_VM_READ = 0x0010;
const PROCESS_QUERY_INFORMATION = 0x0400;
const TH32CS_SNAPPROCESS = 0x00000002;
const INVALID_HANDLE_VALUE = -1;

let k32 = null;
let psapi = null;
let OpenProcess = null;
let CloseHandle = null;
let ReadProcessMemory = null;
let EnumProcessModules = null;
let CreateToolhelp32Snapshot = null;
let Process32FirstW = null;
let Process32NextW = null;
let PROCESSENTRY32W = null;

try {
    k32 = koffi.load('kernel32.dll');
    psapi = koffi.load('psapi.dll');

    PROCESSENTRY32W = koffi.struct('PROCESSENTRY32W', {
        dwSize: 'uint32',
        cntUsage: 'uint32',
        th32ProcessID: 'uint32',
        th32DefaultHeapID: 'uintptr',
        th32ModuleID: 'uint32',
        cntThreads: 'uint32',
        th32ParentProcessID: 'uint32',
        pcPriClassBase: 'int32',
        dwFlags: 'uint32',
        szExeFile: koffi.array('char16_t', 260)
    });

    OpenProcess = k32.func('void* OpenProcess(uint32 dwDesiredAccess, bool bInheritHandle, uint32 dwProcessId)');
    CloseHandle = k32.func('bool CloseHandle(void* hObject)');
    ReadProcessMemory = k32.func('bool ReadProcessMemory(void* hProcess, uint64 lpBaseAddress, _Out_ uint8* lpBuffer, size_t nSize, _Out_ size_t* lpNumberOfBytesRead)');
    EnumProcessModules = psapi.func('bool EnumProcessModules(void* hProcess, _Out_ uint64* lphModule, uint32 cb, _Out_ uint32* lpcbNeeded)');
    CreateToolhelp32Snapshot = k32.func('void* CreateToolhelp32Snapshot(uint32 dwFlags, uint32 th32ProcessID)');
    Process32FirstW = k32.func('bool Process32FirstW(void* hSnapshot, _Inout_ PROCESSENTRY32W* lppe)');
    Process32NextW = k32.func('bool Process32NextW(void* hSnapshot, _Inout_ PROCESSENTRY32W* lppe)');
} catch (e) {
    console.warn("[NodeMemoryReader] Win32 C-FFI load error:", e.message);
}

class NodeMemoryReader {
    constructor() {
        this.state = {
            online: false,
            x: 0.0,
            y: 0.0,
            z: 0.0,
            dirX: 0.0,
            dirY: 1.0,
            dirZ: 0.0,
            tick: 0,
            age: 999,
            source: "node_win32_hook",
            process_pid: null
        };
        this.PLAYER_BASE_OFFSET = 0x1A62150;
        this.POS_OFFSET = 0x90;
        this.DIR_OFFSET = 0xB8;
        this.SECONDARY_BASE_OFFSET = 0x1A625F8;
        this.hProcess = null;
        this.baseAddr = 0n;
        this.pid = null;
        this.tickCounter = 0;
        this.interval = null;
        this.lastScanTime = 0;
    }

    findScrapProcess() {
        if (!CreateToolhelp32Snapshot || !Process32FirstW) return null;

        const hSnap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if (!hSnap || hSnap === INVALID_HANDLE_VALUE) return null;

        try {
            const entry = { dwSize: koffi.sizeof(PROCESSENTRY32W) };
            if (Process32FirstW(hSnap, entry)) {
                do {
                    const name = typeof entry.szExeFile === 'string' ? entry.szExeFile.toLowerCase() : String(entry.szExeFile).toLowerCase();
                    if (name.includes('scrap') && (name.includes('mechanic') || name.endsWith('.exe'))) {
                        const pid = entry.th32ProcessID;
                        const hProc = OpenProcess(PROCESS_VM_READ | PROCESS_QUERY_INFORMATION, false, pid);
                        if (hProc) {
                            const mods = [0n];
                            const needed = [0];
                            if (EnumProcessModules(hProc, mods, 8, needed)) {
                                CloseHandle(hSnap);
                                return { hProcess: hProc, baseAddr: mods[0], pid };
                            }
                            CloseHandle(hProc);
                        }
                    }
                } while (Process32NextW(hSnap, entry));
            }
        } finally {
            CloseHandle(hSnap);
        }
        return null;
    }

    tick() {
        if (!OpenProcess || !ReadProcessMemory) return;

        try {
            if (!this.hProcess) {
                const now = Date.now();
                if (now - this.lastScanTime < 1000) return;
                this.lastScanTime = now;

                const found = this.findScrapProcess();
                if (!found) {
                    this.state.online = false;
                    this.state.process_pid = null;
                    return;
                }
                this.hProcess = found.hProcess;
                this.baseAddr = found.baseAddr;
                this.pid = found.pid;
                this.state.process_pid = found.pid;
                console.log(`[NodeMemoryReader] DETECTED Scrap Mechanic (PID: ${this.pid}, Base: 0x${this.baseAddr.toString(16)})`);
            }

            const ptrBuf = new Uint8Array(8);
            const bytesRead = [0];
            let coordsRead = false;

            // 1. Primary Static Pointer
            const baseTarget = BigInt(this.baseAddr) + BigInt(this.PLAYER_BASE_OFFSET);
            if (ReadProcessMemory(this.hProcess, baseTarget, ptrBuf, 8, bytesRead)) {
                const view = new DataView(ptrBuf.buffer, ptrBuf.byteOffset, ptrBuf.byteLength);
                const playerObjPtr = view.getBigUint64(0, true);

                if (playerObjPtr && playerObjPtr >= 0x10000000000n && playerObjPtr <= 0x7FFFFFFFFFFFn) {
                    const buf128 = new Uint8Array(128);
                    const posTarget = playerObjPtr + BigInt(this.POS_OFFSET);
                    if (ReadProcessMemory(this.hProcess, posTarget, buf128, 128, bytesRead)) {
                        const dv = new DataView(buf128.buffer, buf128.byteOffset, buf128.byteLength);
                        const x = dv.getFloat32(0, true);
                        const y = dv.getFloat32(4, true);
                        const z = dv.getFloat32(8, true);
                        const dirX = dv.getFloat32(this.DIR_OFFSET - this.POS_OFFSET, true);
                        const dirY = dv.getFloat32(this.DIR_OFFSET - this.POS_OFFSET + 4, true);
                        const dirZ = dv.getFloat32(this.DIR_OFFSET - this.POS_OFFSET + 8, true);

                        if (x > -16384.0 && x < 16384.0 && y > -12288.0 && y < 12288.0 && z > -50.0 && z < 2000.0) {
                            this.state.online = true;
                            this.state.x = Math.round(x * 100) / 100;
                            this.state.y = Math.round(y * 100) / 100;
                            this.state.z = Math.round(z * 100) / 100;
                            this.state.dirX = Math.round(dirX * 10000) / 10000;
                            this.state.dirY = Math.round(dirY * 10000) / 10000;
                            this.state.dirZ = Math.round(dirZ * 10000) / 10000;
                            this.state.age = 0.0;
                            this.state.tick = this.tickCounter++;
                            this.state.source = "node_win32_hook";
                            coordsRead = true;
                        }
                    }
                }
            }

            // 2. Secondary Fallback Pointer
            if (!coordsRead) {
                const secTarget = BigInt(this.baseAddr) + BigInt(this.SECONDARY_BASE_OFFSET);
                if (ReadProcessMemory(this.hProcess, secTarget, ptrBuf, 8, bytesRead)) {
                    const view = new DataView(ptrBuf.buffer, ptrBuf.byteOffset, ptrBuf.byteLength);
                    const secPtr = view.getBigUint64(0, true);
                    if (secPtr && secPtr >= 0x10000000000n && secPtr <= 0x7FFFFFFFFFFFn) {
                        const buf12 = new Uint8Array(12);
                        if (ReadProcessMemory(this.hProcess, secPtr + 0x28n, buf12, 12, bytesRead)) {
                            const dv = new DataView(buf12.buffer, buf12.byteOffset, buf12.byteLength);
                            const x = dv.getFloat32(0, true);
                            const y = dv.getFloat32(4, true);
                            const z = dv.getFloat32(8, true);
                            if (x > -16384.0 && x < 16384.0 && y > -12288.0 && y < 12288.0) {
                                this.state.online = true;
                                this.state.x = Math.round(x * 100) / 100;
                                this.state.y = Math.round(y * 100) / 100;
                                this.state.z = Math.round(z * 100) / 100;
                                this.state.age = 0.0;
                                this.state.tick = this.tickCounter++;
                                this.state.source = "node_win32_hook_secondary";
                                coordsRead = true;
                            }
                        }
                    }
                }
            }

            if (!coordsRead) {
                this.state.online = false;
            }
        } catch (e) {
            if (this.hProcess) {
                CloseHandle(this.hProcess);
            }
            this.hProcess = null;
            this.baseAddr = 0n;
            this.pid = null;
            this.state.online = false;
        }
    }

    start(hz = 20) {
        if (this.interval) clearInterval(this.interval);
        this.interval = setInterval(() => this.tick(), 1000 / hz);
        console.log(`[NodeMemoryReader] Ultra-fast Win32 Toolhelp memory reader started (${hz} Hz).`);
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        if (this.hProcess) {
            CloseHandle(this.hProcess);
            this.hProcess = null;
        }
    }
}

module.exports = { NodeMemoryReader };
