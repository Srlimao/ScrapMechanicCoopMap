#include "lua_bridge.h"
#include "console_logger.h"
#include "shared_memory.h"
#include <unordered_set>
#include <fstream>
#include <sstream>

namespace LuaBridge {
    HMODULE g_hLua51 = nullptr;
    lua_State* g_ActiveState = nullptr;
    bool g_Hooked = false;
    uint64_t g_LastTelemetryTime = 0;
    uint32_t g_TelemetryIntervalMs = 500;
    uint64_t g_LastLuaFileMTime = 0;
    std::unordered_set<void*> g_KnownStates;

    pfn_lua_gettop lua_gettop = nullptr;
    pfn_lua_settop lua_settop = nullptr;
    pfn_lua_type lua_type = nullptr;
    pfn_lua_typename lua_typename = nullptr;
    pfn_lua_tolstring lua_tolstring = nullptr;
    pfn_lua_tonumber lua_tonumber = nullptr;
    pfn_lua_toboolean lua_toboolean = nullptr;
    pfn_lua_getfield lua_getfield = nullptr;
    pfn_lua_setfield lua_setfield = nullptr;
    pfn_lua_pcall orig_lua_pcall = nullptr;
    typedef void (*pfn_lua_call)(lua_State *L, int nargs, int nresults);
    pfn_lua_call orig_lua_call = nullptr;
    typedef int (*pfn_lua_resume)(lua_State *L, int narg);
    pfn_lua_resume orig_lua_resume = nullptr;

    pfn_lua_pushstring lua_pushstring = nullptr;
    pfn_lua_pushnumber lua_pushnumber = nullptr;
    pfn_lua_pushboolean lua_pushboolean = nullptr;
    pfn_lua_pushnil lua_pushnil = nullptr;
    pfn_lua_next lua_next = nullptr;
    pfn_lua_touserdata lua_touserdata = nullptr;
    pfn_luaL_loadstring luaL_loadstring = nullptr;

    #define LUA_GLOBALSINDEX (-10002)
    #define LUA_TFUNCTION 6

    char g_LuaFilePath[MAX_PATH] = {0};

    uint64_t GetFileWriteTime(const char* path) {
        WIN32_FILE_ATTRIBUTE_DATA fad;
        if (GetFileAttributesExA(path, GetFileExInfoStandard, &fad)) {
            return ((uint64_t)fad.ftLastWriteTime.dwHighDateTime << 32) | fad.ftLastWriteTime.dwLowDateTime;
        }
        return 0;
    }

    void EnsureProbeRegistered(lua_State* L) {
        if (!L) return;

        uint64_t curMTime = GetFileWriteTime(g_LuaFilePath);
        std::string scriptContent;

        // 1. Try loading external sm_telemetry.lua file
        std::ifstream f(g_LuaFilePath);
        if (f.good()) {
            std::stringstream ss;
            ss << f.rdbuf();
            scriptContent = ss.str();
        }

        // 2. Fallback to built-in telemetry script if file is missing
        if (scriptContent.empty()) {
            scriptContent = 
                "_G._sm_telemetry = _G._sm_telemetry or { online = false, player = { x=0, y=0, z=0, dirX=0, dirY=1, dirZ=0 }, bots = {}, creations = {}, stats = { botCount=0, creationCount=0 } }\n"
                "_G._sm_radar_probe = function()\n"
                "  if not sm then return '{\"online\":false}' end\n"
                "  local t = _G._sm_telemetry\n"
                "  pcall(function()\n"
                "    if sm.localPlayer and sm.localPlayer.getPlayer then\n"
                "      local p = sm.localPlayer.getPlayer()\n"
                "      if p and p:getCharacter() then\n"
                "        local pos = p:getCharacter():getWorldPosition()\n"
                "        local dir = p:getCharacter():getDirection()\n"
                "        t.player.x, t.player.y, t.player.z = pos.x, pos.y, pos.z\n"
                "        if dir then t.player.dirX, t.player.dirY, t.player.dirZ = dir.x, dir.y, dir.z end\n"
                "        t.online = true\n"
                "      end\n"
                "    end\n"
                "  end)\n"
                "  pcall(function()\n"
                "    if sm.unit and sm.unit.getAllUnits then\n"
                "      local u = sm.unit.getAllUnits()\n"
                "      if u then t.stats.botCount = #u end\n"
                "    end\n"
                "  end)\n"
                "  pcall(function()\n"
                "    if sm.body and sm.body.getAllBodies then\n"
                "      local b = sm.body.getAllBodies()\n"
                "      if b then t.stats.creationCount = #b end\n"
                "    end\n"
                "  end)\n"
                "  return string.format('{\"online\":%s,\"player\":{\"x\":%.1f,\"y\":%.1f,\"z\":%.1f,\"dirX\":%.2f,\"dirY\":%.2f},\"stats\":{\"botCount\":%d,\"creationCount\":%d}}',\n"
                "    t.online and 'true' or 'false', t.player.x, t.player.y, t.player.z, t.player.dirX, t.player.dirY, t.stats.botCount, t.stats.creationCount)\n"
                "end\n";
        }

        if (luaL_loadstring && orig_lua_pcall) {
            int top = lua_gettop(L);
            int loadRes = luaL_loadstring(L, scriptContent.c_str());
            if (loadRes != 0) {
                const char* err = lua_tolstring ? lua_tolstring(L, -1, NULL) : "syntax error";
                Logger::Error(std::string("sm_telemetry.lua syntax error: ") + (err ? err : ""));
            } else {
                int callRes = orig_lua_pcall(L, 0, 0, 0);
                if (callRes != 0) {
                    const char* err = lua_tolstring ? lua_tolstring(L, -1, NULL) : "exec error";
                    Logger::Error(std::string("sm_telemetry.lua execution error: ") + (err ? err : ""));
                } else {
                    g_LastLuaFileMTime = curMTime;
                    Logger::Success("Loaded sm_telemetry.lua into active VM successfully.");
                }
            }
            lua_settop(L, top);
        }
    }

    void RunTelemetryCycle() {
        if (!g_ActiveState) return;

        lua_State* L = g_ActiveState;
        
        __try {
            int top = lua_gettop(L);

            // Hot-reload check: if sm_telemetry.lua modified on disk, reload it live!
            uint64_t curMTime = GetFileWriteTime(g_LuaFilePath);
            if (curMTime != 0 && curMTime != g_LastLuaFileMTime) {
                EnsureProbeRegistered(L);
            }

            // Check if probe function is present
            if (lua_getfield) {
                lua_getfield(L, LUA_GLOBALSINDEX, "_sm_radar_probe");
                if (lua_type(L, -1) != LUA_TFUNCTION) {
                    lua_settop(L, top);
                    EnsureProbeRegistered(L);
                    lua_getfield(L, LUA_GLOBALSINDEX, "_sm_radar_probe");
                }

                if (lua_type(L, -1) == LUA_TFUNCTION && orig_lua_pcall && lua_tolstring) {
                    if (orig_lua_pcall(L, 0, 1, 0) == 0) {
                        size_t len = 0;
                        const char* res = lua_tolstring(L, -1, &len);
                        if (res && len > 0) {
                            // 1. Stream full JSON payload to Shared Memory for the Desktop App
                            IPC::WriteRadarData(res, len);

                            // 2. Parse high-level summary for debug console
                            const char* pX = strstr(res, "\"x\":");
                            const char* pY = strstr(res, "\"y\":");
                            const char* pZ = strstr(res, "\"z\":");
                            const char* bC = strstr(res, "\"botCount\":");
                            const char* cC = strstr(res, "\"creationCount\":");

                            if (pX && pY && pZ && bC && cC) {
                                float x = 0, y = 0, z = 0;
                                int bots = 0, creations = 0;
                                sscanf_s(pX, "\"x\":%f", &x);
                                sscanf_s(pY, "\"y\":%f", &y);
                                sscanf_s(pZ, "\"z\":%f", &z);
                                sscanf_s(bC, "\"botCount\":%d", &bots);
                                sscanf_s(cC, "\"creationCount\":%d", &creations);

                                char outBuf[256];
                                sprintf_s(outBuf, sizeof(outBuf), "Player: (%.1f, %.1f, %.1f) | Live Bots: %d | Creations: %d", x, y, z, bots, creations);
                                Logger::Radar(outBuf);
                            }
                        }
                    }
                }
            }

            lua_settop(L, top);
        }
        __except (EXCEPTION_EXECUTE_HANDLER) {
            Logger::Warn("Exception caught inside RunTelemetryCycle (safe guard).");
        }
    }

    inline void OnLuaActivity(lua_State* L) {
        if (!L) return;
        
        g_ActiveState = L;
        if (g_KnownStates.find(L) == g_KnownStates.end()) {
            g_KnownStates.insert(L);
            char buf[128];
            sprintf_s(buf, sizeof(buf), "Hooked new active Scrap Mechanic lua_State: 0x%p (Active VMs: %zu)", L, g_KnownStates.size());
            Logger::Success(buf);
        }

        uint64_t now = GetTickCount64();
        if (now - g_LastTelemetryTime >= g_TelemetryIntervalMs) {
            g_LastTelemetryTime = now;
            RunTelemetryCycle();
        }
    }

    int Hooked_lua_pcall(lua_State *L, int nargs, int nresults, int errfunc) {
        int ret = 0;
        if (orig_lua_pcall) {
            ret = orig_lua_pcall(L, nargs, nresults, errfunc);
        }
        OnLuaActivity(L);
        return ret;
    }

    void Hooked_lua_call(lua_State *L, int nargs, int nresults) {
        if (orig_lua_call) {
            orig_lua_call(L, nargs, nresults);
        }
        OnLuaActivity(L);
    }

    int Hooked_lua_resume(lua_State *L, int narg) {
        int ret = 0;
        if (orig_lua_resume) {
            ret = orig_lua_resume(L, narg);
        }
        OnLuaActivity(L);
        return ret;
    }

    bool InstallIATHook(HMODULE hTargetModule, const char* targetDllName, const char* funcName, void* newFunc, void** ppOldFunc) {
        if (!hTargetModule) return false;

        PIMAGE_DOS_HEADER pDosHeader = (PIMAGE_DOS_HEADER)hTargetModule;
        if (pDosHeader->e_magic != IMAGE_DOS_SIGNATURE) return false;

        PIMAGE_NT_HEADERS pNtHeaders = (PIMAGE_NT_HEADERS)((uint8_t*)hTargetModule + pDosHeader->e_lfanew);
        if (pNtHeaders->Signature != IMAGE_NT_SIGNATURE) return false;

        IMAGE_DATA_DIRECTORY importDataDir = pNtHeaders->OptionalHeader.DataDirectory[IMAGE_DIRECTORY_ENTRY_IMPORT];
        if (!importDataDir.VirtualAddress || !importDataDir.Size) return false;

        PIMAGE_IMPORT_DESCRIPTOR pImportDesc = (PIMAGE_IMPORT_DESCRIPTOR)((uint8_t*)hTargetModule + importDataDir.VirtualAddress);

        while (pImportDesc->Name) {
            const char* dllName = (const char*)((uint8_t*)hTargetModule + pImportDesc->Name);
            if (_stricmp(dllName, targetDllName) == 0) {
                PIMAGE_THUNK_DATA pOriginalFirstThunk = (PIMAGE_THUNK_DATA)((uint8_t*)hTargetModule + pImportDesc->OriginalFirstThunk);
                PIMAGE_THUNK_DATA pFirstThunk = (PIMAGE_THUNK_DATA)((uint8_t*)hTargetModule + pImportDesc->FirstThunk);

                if (!pImportDesc->OriginalFirstThunk) {
                    pOriginalFirstThunk = pFirstThunk;
                }

                while (pOriginalFirstThunk->u1.Function) {
                    if (!(pOriginalFirstThunk->u1.Ordinal & IMAGE_ORDINAL_FLAG)) {
                        PIMAGE_IMPORT_BY_NAME pImportByName = (PIMAGE_IMPORT_BY_NAME)((uint8_t*)hTargetModule + pOriginalFirstThunk->u1.AddressOfData);
                        if (strcmp(pImportByName->Name, funcName) == 0) {
                            DWORD oldProtect;
                            if (VirtualProtect(&pFirstThunk->u1.Function, sizeof(void*), PAGE_READWRITE, &oldProtect)) {
                                if (ppOldFunc && !*ppOldFunc) {
                                    *ppOldFunc = (void*)pFirstThunk->u1.Function;
                                }
                                pFirstThunk->u1.Function = (uintptr_t)newFunc;
                                VirtualProtect(&pFirstThunk->u1.Function, sizeof(void*), oldProtect, &oldProtect);
                                return true;
                            }
                        }
                    }
                    pOriginalFirstThunk++;
                    pFirstThunk++;
                }
            }
            pImportDesc++;
        }
        return false;
    }

    bool Init() {
        // 0. Compute sm_telemetry.lua path
        GetModuleFileNameA(NULL, g_LuaFilePath, MAX_PATH);
        char* lastSlash = strrchr(g_LuaFilePath, '\\');
        if (!lastSlash) lastSlash = strrchr(g_LuaFilePath, '/');
        if (lastSlash) *(lastSlash + 1) = '\0';
        strcat_s(g_LuaFilePath, MAX_PATH, "sm_telemetry.lua");

        // 1. Initialize Shared Memory for Desktop App IPC
        if (IPC::InitSharedMemory("SM_TacticalRadar_Data")) {
            Logger::Success("Initialized Shared Memory IPC: SM_TacticalRadar_Data");
        }

        // 2. Resolve lua51.dll
        g_hLua51 = GetModuleHandleA("lua51.dll");
        if (!g_hLua51) {
            g_hLua51 = LoadLibraryA("lua51.dll");
        }

        if (!g_hLua51) {
            Logger::Error("Failed to find lua51.dll in process memory!");
            return false;
        }

        char buf[128];
        sprintf_s(buf, sizeof(buf), "Located lua51.dll at 0x%p", g_hLua51);
        Logger::Success(buf);

        // 3. Resolve function pointers
        lua_gettop = (pfn_lua_gettop)GetProcAddress(g_hLua51, "lua_gettop");
        lua_settop = (pfn_lua_settop)GetProcAddress(g_hLua51, "lua_settop");
        lua_type = (pfn_lua_type)GetProcAddress(g_hLua51, "lua_type");
        lua_typename = (pfn_lua_typename)GetProcAddress(g_hLua51, "lua_typename");
        lua_tolstring = (pfn_lua_tolstring)GetProcAddress(g_hLua51, "lua_tolstring");
        lua_tonumber = (pfn_lua_tonumber)GetProcAddress(g_hLua51, "lua_tonumber");
        lua_toboolean = (pfn_lua_toboolean)GetProcAddress(g_hLua51, "lua_toboolean");
        lua_getfield = (pfn_lua_getfield)GetProcAddress(g_hLua51, "lua_getfield");
        lua_setfield = (pfn_lua_setfield)GetProcAddress(g_hLua51, "lua_setfield");
        lua_pushstring = (pfn_lua_pushstring)GetProcAddress(g_hLua51, "lua_pushstring");
        lua_pushnumber = (pfn_lua_pushnumber)GetProcAddress(g_hLua51, "lua_pushnumber");
        lua_pushboolean = (pfn_lua_pushboolean)GetProcAddress(g_hLua51, "lua_pushboolean");
        lua_pushnil = (pfn_lua_pushnil)GetProcAddress(g_hLua51, "lua_pushnil");
        lua_next = (pfn_lua_next)GetProcAddress(g_hLua51, "lua_next");
        lua_touserdata = (pfn_lua_touserdata)GetProcAddress(g_hLua51, "lua_touserdata");
        luaL_loadstring = (pfn_luaL_loadstring)GetProcAddress(g_hLua51, "luaL_loadstring");

        orig_lua_pcall = (pfn_lua_pcall)GetProcAddress(g_hLua51, "lua_pcall");
        orig_lua_call = (pfn_lua_call)GetProcAddress(g_hLua51, "lua_call");
        orig_lua_resume = (pfn_lua_resume)GetProcAddress(g_hLua51, "lua_resume");

        // 4. Install clean IAT Hooks into ScrapMechanic.exe
        HMODULE hMainExe = GetModuleHandleA(NULL);
        bool hookedPcall = InstallIATHook(hMainExe, "lua51.dll", "lua_pcall", (void*)&Hooked_lua_pcall, (void**)&orig_lua_pcall);
        bool hookedCall = InstallIATHook(hMainExe, "lua51.dll", "lua_call", (void*)&Hooked_lua_call, (void**)&orig_lua_call);
        bool hookedResume = InstallIATHook(hMainExe, "lua51.dll", "lua_resume", (void*)&Hooked_lua_resume, (void**)&orig_lua_resume);
        
        if (hookedPcall || hookedCall || hookedResume) {
            Logger::Success("Installed IAT Hooks on ScrapMechanic.exe (pcall/call/resume).");
        } else {
            Logger::Warn("IAT hooks returned false.");
        }

        return true;
    }
}
