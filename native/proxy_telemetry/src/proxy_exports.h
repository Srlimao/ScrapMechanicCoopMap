#pragma once
#include <windows.h>

namespace Proxy {
    inline HMODULE g_OrigVersionDll = nullptr;

    inline FARPROC oGetFileVersionInfoA = nullptr;
    inline FARPROC oGetFileVersionInfoByHandle = nullptr;
    inline FARPROC oGetFileVersionInfoExA = nullptr;
    inline FARPROC oGetFileVersionInfoExW = nullptr;
    inline FARPROC oGetFileVersionInfoSizeA = nullptr;
    inline FARPROC oGetFileVersionInfoSizeExA = nullptr;
    inline FARPROC oGetFileVersionInfoSizeExW = nullptr;
    inline FARPROC oGetFileVersionInfoSizeW = nullptr;
    inline FARPROC oGetFileVersionInfoW = nullptr;
    inline FARPROC oVerFindFileA = nullptr;
    inline FARPROC oVerFindFileW = nullptr;
    inline FARPROC oVerInstallFileA = nullptr;
    inline FARPROC oVerInstallFileW = nullptr;
    inline FARPROC oVerLanguageNameA = nullptr;
    inline FARPROC oVerLanguageNameW = nullptr;
    inline FARPROC oVerQueryValueA = nullptr;
    inline FARPROC oVerQueryValueW = nullptr;

    inline bool Init() {
        char sysPath[MAX_PATH];
        GetSystemDirectoryA(sysPath, MAX_PATH);
        strcat_s(sysPath, "\\version.dll");

        g_OrigVersionDll = LoadLibraryA(sysPath);
        if (!g_OrigVersionDll) return false;

        oGetFileVersionInfoA = GetProcAddress(g_OrigVersionDll, "GetFileVersionInfoA");
        oGetFileVersionInfoByHandle = GetProcAddress(g_OrigVersionDll, "GetFileVersionInfoByHandle");
        oGetFileVersionInfoExA = GetProcAddress(g_OrigVersionDll, "GetFileVersionInfoExA");
        oGetFileVersionInfoExW = GetProcAddress(g_OrigVersionDll, "GetFileVersionInfoExW");
        oGetFileVersionInfoSizeA = GetProcAddress(g_OrigVersionDll, "GetFileVersionInfoSizeA");
        oGetFileVersionInfoSizeExA = GetProcAddress(g_OrigVersionDll, "GetFileVersionInfoSizeExA");
        oGetFileVersionInfoSizeExW = GetProcAddress(g_OrigVersionDll, "GetFileVersionInfoSizeExW");
        oGetFileVersionInfoSizeW = GetProcAddress(g_OrigVersionDll, "GetFileVersionInfoSizeW");
        oGetFileVersionInfoW = GetProcAddress(g_OrigVersionDll, "GetFileVersionInfoW");
        oVerFindFileA = GetProcAddress(g_OrigVersionDll, "VerFindFileA");
        oVerFindFileW = GetProcAddress(g_OrigVersionDll, "VerFindFileW");
        oVerInstallFileA = GetProcAddress(g_OrigVersionDll, "VerInstallFileA");
        oVerInstallFileW = GetProcAddress(g_OrigVersionDll, "VerInstallFileW");
        oVerLanguageNameA = GetProcAddress(g_OrigVersionDll, "VerLanguageNameA");
        oVerLanguageNameW = GetProcAddress(g_OrigVersionDll, "VerLanguageNameW");
        oVerQueryValueA = GetProcAddress(g_OrigVersionDll, "VerQueryValueA");
        oVerQueryValueW = GetProcAddress(g_OrigVersionDll, "VerQueryValueW");

        return true;
    }
}

// Proxy implementations called via version.def
extern "C" {
    BOOL WINAPI Proxy_GetFileVersionInfoA(LPCSTR lptstrFilename, DWORD dwHandle, DWORD dwLen, LPVOID lpData) {
        typedef BOOL(WINAPI* pfn)(LPCSTR, DWORD, DWORD, LPVOID);
        if (!Proxy::oGetFileVersionInfoA) return FALSE;
        return ((pfn)Proxy::oGetFileVersionInfoA)(lptstrFilename, dwHandle, dwLen, lpData);
    }
    BOOL WINAPI Proxy_GetFileVersionInfoByHandle(int hMem, LPCWSTR lpFileName, int v2, int v3) {
        typedef BOOL(WINAPI* pfn)(int, LPCWSTR, int, int);
        if (!Proxy::oGetFileVersionInfoByHandle) return FALSE;
        return ((pfn)Proxy::oGetFileVersionInfoByHandle)(hMem, lpFileName, v2, v3);
    }
    BOOL WINAPI Proxy_GetFileVersionInfoExA(DWORD dwFlags, LPCSTR lpwstrFilename, DWORD dwHandle, DWORD dwLen, LPVOID lpData) {
        typedef BOOL(WINAPI* pfn)(DWORD, LPCSTR, DWORD, DWORD, LPVOID);
        if (!Proxy::oGetFileVersionInfoExA) return FALSE;
        return ((pfn)Proxy::oGetFileVersionInfoExA)(dwFlags, lpwstrFilename, dwHandle, dwLen, lpData);
    }
    BOOL WINAPI Proxy_GetFileVersionInfoExW(DWORD dwFlags, LPCWSTR lpwstrFilename, DWORD dwHandle, DWORD dwLen, LPVOID lpData) {
        typedef BOOL(WINAPI* pfn)(DWORD, LPCWSTR, DWORD, DWORD, LPVOID);
        if (!Proxy::oGetFileVersionInfoExW) return FALSE;
        return ((pfn)Proxy::oGetFileVersionInfoExW)(dwFlags, lpwstrFilename, dwHandle, dwLen, lpData);
    }
    DWORD WINAPI Proxy_GetFileVersionInfoSizeA(LPCSTR lptstrFilename, LPDWORD lpdwHandle) {
        typedef DWORD(WINAPI* pfn)(LPCSTR, LPDWORD);
        if (!Proxy::oGetFileVersionInfoSizeA) return 0;
        return ((pfn)Proxy::oGetFileVersionInfoSizeA)(lptstrFilename, lpdwHandle);
    }
    DWORD WINAPI Proxy_GetFileVersionInfoSizeExA(DWORD dwFlags, LPCSTR lpwstrFilename, LPDWORD lpdwHandle) {
        typedef DWORD(WINAPI* pfn)(DWORD, LPCSTR, LPDWORD);
        if (!Proxy::oGetFileVersionInfoSizeExA) return 0;
        return ((pfn)Proxy::oGetFileVersionInfoSizeExA)(dwFlags, lpwstrFilename, lpdwHandle);
    }
    DWORD WINAPI Proxy_GetFileVersionInfoSizeExW(DWORD dwFlags, LPCWSTR lpwstrFilename, LPDWORD lpdwHandle) {
        typedef DWORD(WINAPI* pfn)(DWORD, LPCWSTR, LPDWORD);
        if (!Proxy::oGetFileVersionInfoSizeExW) return 0;
        return ((pfn)Proxy::oGetFileVersionInfoSizeExW)(dwFlags, lpwstrFilename, lpdwHandle);
    }
    DWORD WINAPI Proxy_GetFileVersionInfoSizeW(LPCWSTR lptstrFilename, LPDWORD lpdwHandle) {
        typedef DWORD(WINAPI* pfn)(LPCWSTR, LPDWORD);
        if (!Proxy::oGetFileVersionInfoSizeW) return 0;
        return ((pfn)Proxy::oGetFileVersionInfoSizeW)(lptstrFilename, lpdwHandle);
    }
    BOOL WINAPI Proxy_GetFileVersionInfoW(LPCWSTR lptstrFilename, DWORD dwHandle, DWORD dwLen, LPVOID lpData) {
        typedef BOOL(WINAPI* pfn)(LPCWSTR, DWORD, DWORD, LPVOID);
        if (!Proxy::oGetFileVersionInfoW) return FALSE;
        return ((pfn)Proxy::oGetFileVersionInfoW)(lptstrFilename, dwHandle, dwLen, lpData);
    }
    DWORD WINAPI Proxy_VerFindFileA(DWORD uFlags, LPCSTR szFileName, LPCSTR szWinDir, LPCSTR szAppDir, LPSTR szCurDir, PUINT lpuCurDirLen, LPSTR szDestDir, PUINT lpuDestDirLen) {
        typedef DWORD(WINAPI* pfn)(DWORD, LPCSTR, LPCSTR, LPCSTR, LPSTR, PUINT, LPSTR, PUINT);
        if (!Proxy::oVerFindFileA) return 0;
        return ((pfn)Proxy::oVerFindFileA)(uFlags, szFileName, szWinDir, szAppDir, szCurDir, lpuCurDirLen, szDestDir, lpuDestDirLen);
    }
    DWORD WINAPI Proxy_VerFindFileW(DWORD uFlags, LPCWSTR szFileName, LPCWSTR szWinDir, LPCWSTR szAppDir, LPWSTR szCurDir, PUINT lpuCurDirLen, LPWSTR szDestDir, PUINT lpuDestDirLen) {
        typedef DWORD(WINAPI* pfn)(DWORD, LPCWSTR, LPCWSTR, LPCWSTR, LPWSTR, PUINT, LPWSTR, PUINT);
        if (!Proxy::oVerFindFileW) return 0;
        return ((pfn)Proxy::oVerFindFileW)(uFlags, szFileName, szWinDir, szAppDir, szCurDir, lpuCurDirLen, szDestDir, lpuDestDirLen);
    }
    DWORD WINAPI Proxy_VerInstallFileA(DWORD uFlags, LPCSTR szSrcFileName, LPCSTR szDestFileName, LPCSTR szSrcDir, LPCSTR szDestDir, LPCSTR szCurDir, LPSTR szTmpFile, PUINT lpuTmpFileLen) {
        typedef DWORD(WINAPI* pfn)(DWORD, LPCSTR, LPCSTR, LPCSTR, LPCSTR, LPCSTR, LPSTR, PUINT);
        if (!Proxy::oVerInstallFileA) return 0;
        return ((pfn)Proxy::oVerInstallFileA)(uFlags, szSrcFileName, szDestFileName, szSrcDir, szDestDir, szCurDir, szTmpFile, lpuTmpFileLen);
    }
    DWORD WINAPI Proxy_VerInstallFileW(DWORD uFlags, LPCWSTR szSrcFileName, LPCWSTR szDestFileName, LPCWSTR szSrcDir, LPCWSTR szDestDir, LPCWSTR szCurDir, LPWSTR szTmpFile, PUINT lpuTmpFileLen) {
        typedef DWORD(WINAPI* pfn)(DWORD, LPCWSTR, LPCWSTR, LPCWSTR, LPCWSTR, LPCWSTR, LPWSTR, PUINT);
        if (!Proxy::oVerInstallFileW) return 0;
        return ((pfn)Proxy::oVerInstallFileW)(uFlags, szSrcFileName, szDestFileName, szSrcDir, szDestDir, szCurDir, szTmpFile, lpuTmpFileLen);
    }
    DWORD WINAPI Proxy_VerLanguageNameA(DWORD wLang, LPSTR szLang, DWORD nSize) {
        typedef DWORD(WINAPI* pfn)(DWORD, LPSTR, DWORD);
        if (!Proxy::oVerLanguageNameA) return 0;
        return ((pfn)Proxy::oVerLanguageNameA)(wLang, szLang, nSize);
    }
    DWORD WINAPI Proxy_VerLanguageNameW(DWORD wLang, LPWSTR szLang, DWORD nSize) {
        typedef DWORD(WINAPI* pfn)(DWORD, LPWSTR, DWORD);
        if (!Proxy::oVerLanguageNameW) return 0;
        return ((pfn)Proxy::oVerLanguageNameW)(wLang, szLang, nSize);
    }
    BOOL WINAPI Proxy_VerQueryValueA(LPCVOID pBlock, LPCSTR lpSubBlock, LPVOID* lplpBuffer, PUINT puLen) {
        typedef BOOL(WINAPI* pfn)(LPCVOID, LPCSTR, LPVOID*, PUINT);
        if (!Proxy::oVerQueryValueA) return FALSE;
        return ((pfn)Proxy::oVerQueryValueA)(pBlock, lpSubBlock, lplpBuffer, puLen);
    }
    BOOL WINAPI Proxy_VerQueryValueW(LPCVOID pBlock, LPCWSTR lpSubBlock, LPVOID* lplpBuffer, PUINT puLen) {
        typedef BOOL(WINAPI* pfn)(LPCVOID, LPCWSTR, LPVOID*, PUINT);
        if (!Proxy::oVerQueryValueW) return FALSE;
        return ((pfn)Proxy::oVerQueryValueW)(pBlock, lpSubBlock, lplpBuffer, puLen);
    }
}
