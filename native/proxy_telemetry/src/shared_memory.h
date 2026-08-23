#pragma once
#include <windows.h>
#include <string>
#include <cstring>

namespace IPC {
    inline HANDLE g_hMapFile = NULL;
    inline void* g_pBuf = NULL;
    constexpr size_t SHM_SIZE = 1024 * 1024; // 1 MB buffer

    #pragma pack(push, 1)
    struct RadarSharedHeader {
        uint32_t magic;         // 0x534D5244 ('SMRD')
        uint32_t version;       // 1
        uint32_t sequence;      // Monotonically increasing update counter
        uint32_t dataLength;    // Length of JSON string
        uint64_t timestamp;     // Milliseconds timestamp
    };
    #pragma pack(pop)

    inline bool InitSharedMemory(const char* mapName = "SM_TacticalRadar_Data") {
        if (g_pBuf) return true;

        g_hMapFile = CreateFileMappingA(
            INVALID_HANDLE_VALUE,
            NULL,
            PAGE_READWRITE,
            0,
            (DWORD)SHM_SIZE,
            mapName
        );

        if (!g_hMapFile) {
            return false;
        }

        g_pBuf = MapViewOfFile(
            g_hMapFile,
            FILE_MAP_ALL_ACCESS,
            0,
            0,
            SHM_SIZE
        );

        if (!g_pBuf) {
            CloseHandle(g_hMapFile);
            g_hMapFile = NULL;
            return false;
        }

        // Initialize header
        RadarSharedHeader* hdr = (RadarSharedHeader*)g_pBuf;
        hdr->magic = 0x534D5244;
        hdr->version = 1;
        hdr->sequence = 0;
        hdr->dataLength = 0;
        hdr->timestamp = GetTickCount64();

        return true;
    }

    inline void WriteRadarData(const char* jsonStr, size_t len) {
        if (!g_pBuf) {
            if (!InitSharedMemory()) return;
        }

        if (len + sizeof(RadarSharedHeader) + 1 >= SHM_SIZE) {
            len = SHM_SIZE - sizeof(RadarSharedHeader) - 2;
        }

        RadarSharedHeader* hdr = (RadarSharedHeader*)g_pBuf;
        char* dataPtr = (char*)g_pBuf + sizeof(RadarSharedHeader);

        // Copy JSON payload
        memcpy(dataPtr, jsonStr, len);
        dataPtr[len] = '\0';

        // Update header atomically
        hdr->dataLength = (uint32_t)len;
        hdr->timestamp = GetTickCount64();
        hdr->sequence++;
    }

    inline void Cleanup() {
        if (g_pBuf) {
            UnmapViewOfFile(g_pBuf);
            g_pBuf = NULL;
        }
        if (g_hMapFile) {
            CloseHandle(g_hMapFile);
            g_hMapFile = NULL;
        }
    }
}
