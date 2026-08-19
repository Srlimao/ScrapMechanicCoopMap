-- TELEMETRY_VERSION = 5
-- Scrap Mechanic Tactical Radar - Lua Telemetry Bridge
-- Comprehensive Official Character UUID Map directly from Scrap Mechanic Engine

_G._sm_telemetry = _G._sm_telemetry or {
    version = 5,
    online = false,
    player = { x = 0, y = 0, z = 0, dirX = 0, dirY = 1, dirZ = 0 },
    bots = {},
    creations = {},
    stats = { botCount = 0, creationCount = 0 },
    tick = 0
}

local function escape_json_str(s)
    if not s then return '""' end
    return '"' .. tostring(s):gsub('\\', '\\\\'):gsub('"', '\\"') .. '"'
end

-- Comprehensive Scrap Mechanic Character UUID Table
local UUID_MAP = {
    -- Passive Animals & Helpers
    ["4fbefe2d-83c7-4859-982e-1720f04079a3"] = { type = "seedbot", hostile = false },
    ["264a563a-e304-430f-a462-9963c77624e9"] = { type = "woc", hostile = false },
    ["4895b33a-ce8f-43d0-8c59-e406d37d8d6b"] = { type = "baby_woc", hostile = false },
    ["6c4a5c93-9c88-4299-8ec9-618d4d468165"] = { type = "glowbug", hostile = false },
    ["48c03f69-3ec8-454c-8d1a-fa09083363b1"] = { type = "worm", hostile = false },
    ["8828e9d2-650c-11ed-9022-0242ac120002"] = { type = "lootbot", hostile = false },
    ["e503cf1b-611c-4692-9431-2ddcfd030375"] = { type = "scannerbot", hostile = false },
    ["6ac756cf-7910-4f87-836a-7c0a81dd3e59"] = { type = "farmer", hostile = false },
    ["356916fe-64e9-4dc0-8930-377d8b7d036a"] = { type = "farmer", hostile = false },
    ["aa9a3398-e3dc-4e96-8bff-4963f35b2d58"] = { type = "farmer", hostile = false },
    ["a16a794a-0159-41a1-9d07-8f051935e9d6"] = { type = "scrapper", hostile = false },
    ["39ec787c-880f-4526-8cf5-904869d107fa"] = { type = "woc", hostile = false },
    ["3788e9f6-d557-42cb-b3c6-293b7fb0c00d"] = { type = "npc", hostile = false },
    ["55c4c10d-7f56-47c3-a274-32fc2767d298"] = { type = "npc", hostile = false },
    ["fd8e1f0c-364b-4522-8ecd-3c7dc582ea06"] = { type = "npc", hostile = false },
    ["3ca4b827-a237-4f85-b97c-4298dcc4ad95"] = { type = "mechanic", hostile = false },
    ["00000000-0000-0000-0000-000000000000"] = { type = "player", hostile = false },

    -- Hostile Bots (Hostile = true)
    ["9f4fde94-312f-4417-b13b-84029c5d6b52"] = { type = "farmbot", hostile = true },
    ["c8bfb8f3-7efc-49ac-875a-eb85ac0614db"] = { type = "haybot", hostile = true },
    ["04761b4a-a83e-4736-b565-120bc776edb2"] = { type = "tapebot", hostile = true },
    ["c68914f8-d769-4638-9071-f7dbd1d97351"] = { type = "tapebot", hostile = true },
    ["f3ded3f4-ddf9-441d-83f1-28b8cf2c7581"] = { type = "tapebot", hostile = true },
    ["54a06cf0-c035-41a5-b19e-158496d35586"] = { type = "tapebot", hostile = true },
    ["c3d31c47-0c9b-4b07-9bd4-8f022dc4333e"] = { type = "tapebot", hostile = true },
    ["9dbbd2fb-7726-4e8f-8eb4-0dab228a561d"] = { type = "tapebot", hostile = true },
    ["fcb2e8ce-ca94-45e4-a54b-b5acc156170b"] = { type = "tapebot", hostile = true },
    ["68d3b2f3-ed4b-4967-9d22-8ee6f555df63"] = { type = "tapebot", hostile = true },
    ["97efd943-d176-479a-a6f4-46373327ddcd"] = { type = "tapebot", hostile = true },
    ["8984bdbf-521e-4eed-b3c4-2b5e287eb879"] = { type = "totebot", hostile = true },
    ["55fd93fa-09ed-4a26-bfa1-4601694d5127"] = { type = "totebot", hostile = true },
    ["9360d346-3ff2-4925-a068-660cf5dd5267"] = { type = "totebot", hostile = true },
    ["2dea48a4-6a79-11ed-a1eb-0242ac120002"] = { type = "totebot", hostile = true },
    ["58992f50-ca36-44e1-8c47-4996d89d6a9a"] = { type = "totebot", hostile = true },
    ["b837888a-0480-4a34-bc34-d72261a14385"] = { type = "cablebot", hostile = true },
    ["531d0a62-6142-4c65-be24-9af58be4a730"] = { type = "drillbot", hostile = true },
    ["92da8324-3cfe-4529-ac1c-c71facda50a3"] = { type = "minerbot", hostile = true },
    ["2ef81574-9b6a-4f79-8306-7f80fff2050b"] = { type = "trashbot", hostile = true },
    ["c3434728-2724-4327-aba9-af168231d0b0"] = { type = "trashbot", hostile = true },
    ["a864d8fe-6d9f-4279-9c9b-35419cc2cd87"] = { type = "totebot", hostile = true },
    ["9944611a-7673-4aff-9b87-8072e0d175fc"] = { type = "worm", hostile = true }
}

_G._sm_radar_probe = function()
    if not sm then 
        return '{"online":false,"error":"NO_SM"}'
    end

    local state = _G._sm_telemetry
    state.tick = (state.tick or 0) + 1

    -- 1. Probe Player (Client Scope)
    pcall(function()
        if sm.localPlayer and sm.localPlayer.getPlayer then
            local p = sm.localPlayer.getPlayer()
            if p and p:getCharacter() then
                local char = p:getCharacter()
                local pos = char:getWorldPosition()
                local dir = char:getDirection()
                state.player.x = math.floor(pos.x * 10) / 10
                state.player.y = math.floor(pos.y * 10) / 10
                state.player.z = math.floor(pos.z * 10) / 10
                if dir then
                    state.player.dirX = math.floor(dir.x * 100) / 100
                    state.player.dirY = math.floor(dir.y * 100) / 100
                    state.player.dirZ = math.floor(dir.z * 100) / 100
                end
                state.online = true
            end
        end
    end)

    -- 2. Probe Player Fallback (Server Scope)
    if not state.online then
        pcall(function()
            if sm.player and sm.player.getAllPlayers then
                local players = sm.player.getAllPlayers()
                if players and #players > 0 and players[1]:getCharacter() then
                    local char = players[1]:getCharacter()
                    local pos = char:getWorldPosition()
                    state.player.x = math.floor(pos.x * 10) / 10
                    state.player.y = math.floor(pos.y * 10) / 10
                    state.player.z = math.floor(pos.z * 10) / 10
                    state.online = true
                end
            end
        end)
    end

    local px, py, pz = state.player.x, state.player.y, state.player.z

    -- 3. Probe Live Bots / Units (Server Scope)
    pcall(function()
        if sm.unit and sm.unit.getAllUnits then
            local units = sm.unit.getAllUnits()
            if units then
                state.stats.botCount = #units
                local botList = {}
                
                for i = 1, math.min(#units, 150) do
                    local u = units[i]
                    pcall(function()
                        if u and u:getCharacter() then
                            local char = u:getCharacter()
                            local pos = char:getWorldPosition()
                            if pos then
                                local dx = pos.x - px
                                local dy = pos.y - py
                                local dz = pos.z - pz
                                local dist = math.sqrt(dx * dx + dy * dy + dz * dz)
                                
                                if dist <= 2500 then
                                    local botType = "haybot"
                                    local isHostile = true
                                    local charUuid = ""

                                    pcall(function()
                                        if char and char.getCharacterType then
                                            local rawUuid = tostring(char:getCharacterType())
                                            if rawUuid then
                                                charUuid = rawUuid:gsub("[{%}%s]", ""):lower()
                                                local info = UUID_MAP[charUuid]
                                                if info then
                                                    botType = info.type
                                                    isHostile = info.hostile
                                                elseif charUuid:find("seed") then
                                                    botType = "seedbot"
                                                    isHostile = false
                                                elseif charUuid:find("woc") or charUuid:find("cow") then
                                                    botType = "woc"
                                                    isHostile = false
                                                elseif charUuid:find("glow") then
                                                    botType = "glowbug"
                                                    isHostile = false
                                                elseif charUuid:find("farmer") or charUuid:find("trader") or charUuid:find("npc") then
                                                    botType = "npc"
                                                    isHostile = false
                                                elseif charUuid:find("farm") then
                                                    botType = "farmbot"
                                                    isHostile = true
                                                elseif charUuid:find("tape") then
                                                    botType = "tapebot"
                                                    isHostile = true
                                                elseif charUuid:find("tote") then
                                                    botType = "totebot"
                                                    isHostile = true
                                                elseif charUuid:find("hay") then
                                                    botType = "haybot"
                                                    isHostile = true
                                                end
                                            end
                                        end
                                    end)

                                    table.insert(botList, {
                                        id = (u.getId and u:getId()) or i,
                                        type = botType,
                                        uuid = charUuid,
                                        isHostile = isHostile,
                                        x = math.floor(pos.x * 10) / 10,
                                        y = math.floor(pos.y * 10) / 10,
                                        z = math.floor(pos.z * 10) / 10,
                                        dist = math.floor(dist * 10) / 10
                                    })
                                end
                            end
                        end
                    end)
                end
                state.bots = botList
            end
        end
    end)

    -- 4. Probe Dynamic Creations / Bodies (Server Scope) - Cap at >= 50 blocks
    pcall(function()
        if sm.body and sm.body.getAllBodies then
            local bodies = sm.body.getAllBodies()
            if bodies then
                state.stats.creationCount = #bodies
                local creationList = {}

                for i = 1, math.min(#bodies, 150) do
                    local b = bodies[i]
                    pcall(function()
                        if b and b:isDynamic() then
                            local shapes = (b.getShapes and b:getShapes()) or {}
                            local blockCount = #shapes
                            local mass = math.floor((b.getMass and b:getMass()) or 0)

                            if blockCount >= 50 or mass >= 100 then
                                local pos = b:getWorldPosition()
                                if pos then
                                    local dx = pos.x - px
                                    local dy = pos.y - py
                                    local dist = math.sqrt(dx * dx + dy * dy)

                                    if dist <= 2500 then
                                        table.insert(creationList, {
                                            id = (b.getId and b:getId()) or i,
                                            x = math.floor(pos.x * 10) / 10,
                                            y = math.floor(pos.y * 10) / 10,
                                            z = math.floor(pos.z * 10) / 10,
                                            blocks = blockCount,
                                            mass = mass,
                                            dist = math.floor(dist * 10) / 10
                                        })
                                    end
                                end
                            end
                        end
                    end)
                end
                state.creations = creationList
            end
        end
    end)

    -- 5. Fast JSON Serialization
    local parts = {}
    table.insert(parts, '{"online":' .. (state.online and 'true' or 'false'))
    table.insert(parts, ',"version":5')
    table.insert(parts, ',"player":{"x":' .. state.player.x .. ',"y":' .. state.player.y .. ',"z":' .. state.player.z .. ',"dirX":' .. state.player.dirX .. ',"dirY":' .. state.player.dirY .. ',"dirZ":' .. state.player.dirZ .. '}')
    table.insert(parts, ',"stats":{"botCount":' .. state.stats.botCount .. ',"creationCount":' .. state.stats.creationCount .. '}')
    table.insert(parts, ',"tick":' .. state.tick)

    -- Encode Bots
    local botParts = {}
    for _, b in ipairs(state.bots or {}) do
        table.insert(botParts, '{"id":' .. b.id .. ',"type":' .. escape_json_str(b.type) .. ',"uuid":' .. escape_json_str(b.uuid or "") .. ',"isHostile":' .. (b.isHostile and 'true' or 'false') .. ',"x":' .. b.x .. ',"y":' .. b.y .. ',"z":' .. b.z .. ',"dist":' .. b.dist .. '}')
    end
    table.insert(parts, ',"bots":[' .. table.concat(botParts, ',') .. ']')

    -- Encode Creations
    local creationParts = {}
    for _, c in ipairs(state.creations or {}) do
        table.insert(creationParts, '{"id":' .. c.id .. ',"x":' .. c.x .. ',"y":' .. c.y .. ',"z":' .. c.z .. ',"blocks":' .. (c.blocks or 0) .. ',"mass":' .. c.mass .. ',"dist":' .. c.dist .. '}')
    end
    table.insert(parts, ',"creations":[' .. table.concat(creationParts, ',') .. ']')
    table.insert(parts, '}')

    return table.concat(parts, '')
end
