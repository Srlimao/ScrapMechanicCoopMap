#pragma once
#include <windows.h>
#include <iostream>
#include <fstream>
#include <string>
#include <sstream>
#include <iomanip>
#include <chrono>

namespace Logger {
    inline bool g_ConsoleEnabled = true;
    inline int g_LogLevel = 1;
    inline FILE* g_LogFile = nullptr;

    inline std::string GetTimestamp() {
        auto now = std::chrono::system_clock::now();
        auto in_time_t = std::chrono::system_clock::to_time_t(now);
        std::stringstream ss;
        struct tm buf;
        localtime_s(&buf, &in_time_t);
        ss << std::put_time(&buf, "%H:%M:%S");
        return ss.str();
    }

    inline void WriteToFile(const std::string& tag, const std::string& msg) {
        if (g_LogFile) {
            fprintf(g_LogFile, "[%s] [%s] %s\n", GetTimestamp().c_str(), tag.c_str(), msg.c_str());
            fflush(g_LogFile);
        }
    }

    inline void InitLogging(bool consoleEnabled, int logLevel) {
        g_ConsoleEnabled = consoleEnabled;
        g_LogLevel = logLevel;

        // Open log file in current executable directory
        char exePath[MAX_PATH];
        GetModuleFileNameA(NULL, exePath, MAX_PATH);
        std::string dir = exePath;
        size_t pos = dir.find_last_of("\\/");
        if (pos != std::string::npos) dir = dir.substr(0, pos + 1);
        std::string logPath = dir + "sm_telemetry.log";

        fopen_s(&g_LogFile, logPath.c_str(), "w");
        if (g_LogFile) {
            fprintf(g_LogFile, "=== Scrap Mechanic Telemetry Log Started ===\n");
            fflush(g_LogFile);
        }

        if (g_ConsoleEnabled) {
            AllocConsole();
            FILE* fDummy;
            freopen_s(&fDummy, "CONOUT$", "w", stdout);
            freopen_s(&fDummy, "CONOUT$", "w", stderr);
            freopen_s(&fDummy, "CONIN$", "r", stdin);

            HANDLE hOut = GetStdHandle(STD_OUTPUT_HANDLE);
            if (hOut != INVALID_HANDLE_VALUE) {
                DWORD dwMode = 0;
                if (GetConsoleMode(hOut, &dwMode)) {
                    dwMode |= ENABLE_VIRTUAL_TERMINAL_PROCESSING;
                    SetConsoleMode(hOut, dwMode);
                }
            }

            SetConsoleTitleA("Scrap Mechanic - Live Telemetry Hook [Debug Console]");

            std::cout << "\033[1;36m====================================================================\033[0m\n";
            std::cout << "\033[1;33m   SCRAP MECHANIC TACTICAL TELEMETRY BRIDGE - IN-PROCESS HOOK       \033[0m\n";
            std::cout << "\033[1;36m====================================================================\033[0m\n";
            std::cout << "\033[0;32m[SYS] Console initialized. Log file: sm_telemetry.log\033[0m\n\n";
        }
    }

    inline void WriteToFile(const char* tag, const char* msg) {
        if (g_LogFile) {
            fprintf(g_LogFile, "[%s] [%s] %s\n", GetTimestamp().c_str(), tag, msg);
            fflush(g_LogFile);
        }
    }

    inline void Info(const char* msg) {
        WriteToFile("INFO", msg);
        if (!g_ConsoleEnabled || g_LogLevel < 1) return;
        std::cout << "\033[0;90m[" << GetTimestamp() << "]\033[0m \033[1;34m[INFO]\033[0m " << msg << "\n";
    }

    inline void Success(const char* msg) {
        WriteToFile("OK", msg);
        if (!g_ConsoleEnabled || g_LogLevel < 1) return;
        std::cout << "\033[0;90m[" << GetTimestamp() << "]\033[0m \033[1;32m[OK]\033[0m " << msg << "\n";
    }

    inline void Warn(const char* msg) {
        WriteToFile("WARN", msg);
        if (!g_ConsoleEnabled) return;
        std::cout << "\033[0;90m[" << GetTimestamp() << "]\033[0m \033[1;33m[WARN]\033[0m " << msg << "\n";
    }

    inline void Error(const char* msg) {
        WriteToFile("ERROR", msg);
        if (!g_ConsoleEnabled) return;
        std::cout << "\033[0;90m[" << GetTimestamp() << "]\033[0m \033[1;31m[ERROR]\033[0m " << msg << "\n";
    }

    inline void Radar(const char* msg) {
        WriteToFile("RADAR", msg);
        if (!g_ConsoleEnabled || g_LogLevel < 1) return;
        std::cout << "\033[0;90m[" << GetTimestamp() << "]\033[0m \033[1;36m[RADAR]\033[0m " << msg << "\n";
    }

    inline void Info(const std::string& msg) { Info(msg.c_str()); }
    inline void Success(const std::string& msg) { Success(msg.c_str()); }
    inline void Warn(const std::string& msg) { Warn(msg.c_str()); }
    inline void Error(const std::string& msg) { Error(msg.c_str()); }
    inline void Radar(const std::string& msg) { Radar(msg.c_str()); }

    // Vectored Exception Handler (VEH) to capture any crash
    inline LONG WINAPI VectoredCrashHandler(PEXCEPTION_POINTERS pExceptionInfo) {
        DWORD code = pExceptionInfo->ExceptionRecord->ExceptionCode;
        if (code == 0xE06D7363 || code == DBG_PRINTEXCEPTION_C) {
            // Ignore C++ throw / OutputDebugString non-fatal events
            return EXCEPTION_CONTINUE_SEARCH;
        }

        if (code == EXCEPTION_ACCESS_VIOLATION || code == EXCEPTION_ILLEGAL_INSTRUCTION || 
            code == EXCEPTION_STACK_OVERFLOW || code == EXCEPTION_DATATYPE_MISALIGNMENT) {
            
            std::stringstream ss;
            ss << "\n!!! CRASH INTERCEPTED !!! Code: 0x" << std::hex << code
               << " at Address: 0x" << pExceptionInfo->ExceptionRecord->ExceptionAddress;
            
            #if defined(_M_X64) || defined(__x86_64__)
            PCONTEXT ctx = pExceptionInfo->ContextRecord;
            ss << "\nRegisters: RIP=0x" << ctx->Rip << " RAX=0x" << ctx->Rax
               << " RBX=0x" << ctx->Rbx << " RCX=0x" << ctx->Rcx << " RDX=0x" << ctx->Rdx
               << " RSP=0x" << ctx->Rsp << " RBP=0x" << ctx->Rbp;
            #endif

            Error(ss.str());
            if (g_LogFile) fflush(g_LogFile);
        }

        return EXCEPTION_CONTINUE_SEARCH;
    }

    inline void InstallCrashHandler() {
        AddVectoredExceptionHandler(1, VectoredCrashHandler);
        Info("Vectored crash interception handler installed.");
    }
}
