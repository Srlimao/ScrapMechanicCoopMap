#include <windows.h>
#include <thread>
#include <chrono>
#include <fstream>
#include "proxy_exports.h"
#include "console_logger.h"
#include "lua_bridge.h"

// Configuration settings
struct Config {
    bool enableConsole = true;
    int updateIntervalMs = 50;
    int logLevel = 1;
    bool enableSharedMemory = true;
    std::string sharedMemoryName = "SM_TacticalRadar_Data";
} g_Config;

void LoadConfig() {
    char dllPath[MAX_PATH];
    GetModuleFileNameA(NULL, dllPath, MAX_PATH);
    std::string dir = dllPath;
    size_t pos = dir.find_last_of("\\/");
    if (pos != std::string::npos) {
        dir = dir.substr(0, pos + 1);
    }

    std::string iniPath = dir + "settings.ini";
    std::ifstream f(iniPath);
    if (!f.good()) {
        iniPath = dir + "sm_telemetry.ini";
    }

    char buf[128];
    GetPrivateProfileStringA("Telemetry", "EnableConsole", "true", buf, sizeof(buf), iniPath.c_str());
    g_Config.enableConsole = (_stricmp(buf, "true") == 0 || _stricmp(buf, "1") == 0);

    g_Config.updateIntervalMs = GetPrivateProfileIntA("Telemetry", "UpdateIntervalMs", 500, iniPath.c_str());
    g_Config.logLevel = GetPrivateProfileIntA("Telemetry", "LogLevel", 1, iniPath.c_str());

    LuaBridge::g_TelemetryIntervalMs = g_Config.updateIntervalMs;
}

DWORD WINAPI WorkerThread(LPVOID lpParam) {
    // 1. Load config from settings.ini
    LoadConfig();

    // 2. Initialize File and Console Logging
    Logger::InitLogging(g_Config.enableConsole, g_Config.logLevel);
    Logger::InstallCrashHandler();

    Logger::Info("Proxy version.dll loaded successfully into ScrapMechanic.exe");
    Logger::Info("Config loaded: Console=" + std::string(g_Config.enableConsole ? "ON" : "OFF") + 
                ", Interval=" + std::to_string(g_Config.updateIntervalMs) + "ms");

    // 3. Initialize Lua Bridge & IAT Hook
    Logger::Info("Initializing Lua 5.1 runtime bridge & IAT hooks...");
    LuaBridge::Init();

    Logger::Success("Ready! Waiting for player to load into world...");

    // 4. Keep worker thread alive for heartbeat monitoring
    while (true) {
        std::this_thread::sleep_for(std::chrono::seconds(2));
    }

    return 0;
}

BOOL WINAPI DllMain(HINSTANCE hinstDLL, DWORD fdwReason, LPVOID lpvReserved) {
    switch (fdwReason) {
    case DLL_PROCESS_ATTACH:
        DisableThreadLibraryCalls(hinstDLL);

        // Forward system exports
        if (!Proxy::Init()) {
            return FALSE;
        }

        // Spawn telemetry initialization thread
        CreateThread(NULL, 0, WorkerThread, NULL, 0, NULL);
        break;

    case DLL_PROCESS_DETACH:
        if (Proxy::g_OrigVersionDll) {
            FreeLibrary(Proxy::g_OrigVersionDll);
        }
        if (Logger::g_LogFile) {
            fclose(Logger::g_LogFile);
            Logger::g_LogFile = nullptr;
        }
        break;
    }
    return TRUE;
}
