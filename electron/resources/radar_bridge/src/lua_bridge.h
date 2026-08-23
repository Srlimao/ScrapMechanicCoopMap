#pragma once
#include <windows.h>
#include <string>
#include <vector>

// Forward declare lua_State
typedef struct lua_State lua_State;

typedef int (*pfn_lua_gettop)(lua_State *L);
typedef void (*pfn_lua_settop)(lua_State *L, int idx);
typedef int (*pfn_lua_type)(lua_State *L, int idx);
typedef const char *(*pfn_lua_typename)(lua_State *L, int tp);
typedef const char *(*pfn_lua_tolstring)(lua_State *L, int idx, size_t *len);
typedef double (*pfn_lua_tonumber)(lua_State *L, int idx);
typedef int (*pfn_lua_toboolean)(lua_State *L, int idx);
typedef void (*pfn_lua_getfield)(lua_State *L, int idx, const char *k);
typedef void (*pfn_lua_setfield)(lua_State *L, int idx, const char *k);
typedef int (*pfn_lua_pcall)(lua_State *L, int nargs, int nresults, int errfunc);
typedef void (*pfn_lua_pushstring)(lua_State *L, const char *s);
typedef void (*pfn_lua_pushnumber)(lua_State *L, double n);
typedef void (*pfn_lua_pushboolean)(lua_State *L, int b);
typedef void (*pfn_lua_pushnil)(lua_State *L);
typedef int (*pfn_lua_next)(lua_State *L, int idx);
typedef void *(*pfn_lua_touserdata)(lua_State *L, int idx);
typedef int (*pfn_luaL_loadstring)(lua_State *L, const char *s);

namespace LuaBridge {
    extern HMODULE g_hLua51;
    extern lua_State* g_ActiveState;
    extern bool g_Hooked;
    extern uint32_t g_TelemetryIntervalMs;

    bool Init();
    void SetState(lua_State* L);
    bool QueryPlayerPosition(float& outX, float& outY, float& outZ);
    bool QueryEntities(int& outUnits, int& outBodies);
    void RunTelemetryCycle();
}
