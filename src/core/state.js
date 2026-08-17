// Central reactive state store for Tactical Map Viewer
import { DEFAULT_SURVIVAL_POIS } from './constants.js';

export const state = {
    // Game & World Data
    mapData: {
        gameInfo: { seed: 151054709, gametick: 0, version: 28 },
        pois: [...DEFAULT_SURVIVAL_POIS],
        schematics: [],
        creations: [],
        units: [],
        harvestables: [],
        portals: []
    },
    uuidMap: {},

    // Real-Time Live Player Tracking
    livePlayer: {
        online: false,
        x: 0,
        y: 0,
        z: 0,
        dirX: 0,
        dirY: 1,
        dirZ: 0,
        angle: 0,
        speed: 0,
        tick: 0,
        age: 999,
        lastFetch: 0,
        trail: []
    },
    followPlayer: false,

    // Viewport & Camera
    zoom: 0.04,
    cameraX: 0,
    cameraY: 0,
    mouseWorldPos: { x: 0, y: 0 },
    mouseScreenPos: { x: 0, y: 0 },
    mapOpacity: 0.90,
    showCoordinates: false,

    // Interactive Tool States
    selectedEntity: null,
    hoveredEntity: null,
    searchResults: [],
    rulerMode: false,
    rulerPoints: [],

    // Tactical Layers Visibility
    layers: {
        livePlayer: true,
        mapImage: true,
        pois: true,
        schematics: true,
        creations: false,
        units: false,
        harvestables: false,
        portals: true,
        grid: true
    },

    // Sub-layer Filters
    subFilters: {
        units: { farmbots: true, haybots: true, tapebots: true, totebots: true, animals: true },
        harvestables: { oil: true, cotton: true, minerals: true, trees: true },
        creationsSize: 'all' // 'all', 'small', 'medium', 'large'
    },

    // Multiplayer Squad Relay
    squad: {
        serverUrl: 'wss://sm.dunhas.com',
        connected: false,
        roomCode: null,
        isHost: false,
        myPeerId: null,
        myNickname: 'ScrapMechanic',
        myColor: '#00e5ff',
        peers: new Map(), // peerId -> { id, name, color, x, y, z, dirX, dirY, speed, trail, lastSeen }
        pings: []
    }
};

const listeners = new Set();

export function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

export function notifyStateChange(changeType, payload) {
    for (const fn of listeners) {
        try {
            fn(changeType, payload, state);
        } catch (e) {
            console.error("State listener error:", e);
        }
    }
}
