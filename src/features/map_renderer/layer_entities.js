// Entity layer rendering (POIs, Creations, Units, Harvestables, Portals)
// OPTIMIZATION (⚡ Bolt): World-space frustum culling and zero-allocation screen position calculations.
// Pre-computing viewport bounds in world coordinates eliminates off-screen object allocations
// ({x, y}) and floating-point operations for ~90%+ of entities during frame rendering.
import { state } from '../../core/state.js';
import { worldToScreen } from '../../core/coords.js';

let occupiedLabelBoxes = [];
const tempSelectedPos = { x: 0, y: 0 };

/**
 * Lazy memoization of POI sub-filter group key.
 * Avoids per-frame string lowercasing and repeated .includes() string searches in 60 FPS loops.
 */
export function getPoiFilterGroup(poi) {
    if (poi._filterGroup) return poi._filterGroup;
    const name = (poi.name || '').toLowerCase();
    const cat = (poi.category || '').toLowerCase();

    if (name.includes('mechanic station') || cat === 'mechanic') poi._filterGroup = 'mechanicStations';
    else if (name.includes('trader') || name.includes('hideout') || name.includes('farmer') || cat === 'trader') poi._filterGroup = 'traders';
    else if (name.includes('packing station') || cat === 'packing') poi._filterGroup = 'packingStations';
    else if (name.includes('growlab') || cat === 'growlab') poi._filterGroup = 'growlabs';
    else if (name.includes('chemical') || name.includes('oil lake') || cat === 'chemical' || cat === 'oil') poi._filterGroup = 'chemOil';
    else poi._filterGroup = 'other';

    return poi._filterGroup;
}

/**
 * Lazy memoization of POI radar color and short label.
 * Avoids per-frame string lowercasing and repeated .includes() string searches in radar loop.
 */
export function getPoiRadarInfo(poi) {
    if (poi._shortLabel !== undefined) return poi;
    const name = (poi.name || '').toLowerCase();
    const cat = (poi.category || '').toLowerCase();

    let color = poi.color || '#f59e0b';
    let label = poi.name || 'POI';

    if (name.includes('mechanic')) {
        color = '#38bdf8';
        label = 'Mechanic';
    } else if (name.includes('trader') || name.includes('hideout')) {
        color = '#a855f7';
        label = 'Trader';
    } else if (name.includes('packing')) {
        color = '#4ade80';
        label = name.includes('veg') ? 'Packing (Veg)' : (name.includes('fruit') ? 'Packing (Fruit)' : 'Packing');
    } else if (name.includes('growlab')) {
        color = '#f59e0b';
        label = 'Growlab';
    } else if (name.includes('chemical') || cat === 'chemical') {
        color = '#06b6d4';
        label = 'Chemical';
    } else if (name.includes('oil') || cat === 'oil') {
        color = '#06b6d4';
        label = 'Oil Lake';
    } else if (name.includes('capsule') || name.includes('landmark')) {
        color = '#fbbf24';
    }

    poi._shortLabel = label;
    poi._radarColor = color;
    return poi;
}

export function clearLabelCollisionGrid() {
    occupiedLabelBoxes.length = 0;
}

/**
 * Calculates world-space viewport bounds for fast frustum culling.
 * @param {number} width Canvas width
 * @param {number} height Canvas height
 * @param {number} marginPx Pixel margin around viewport
 */
function getViewportWorldBounds(width, height, marginPx) {
    const invZoom = 1 / state.zoom;
    const halfW = width * 0.5;
    const halfH = height * 0.5;
    const marginWorld = marginPx * invZoom;

    return {
        halfW,
        halfH,
        minX: state.cameraX - halfW * invZoom - marginWorld,
        maxX: state.cameraX + halfW * invZoom + marginWorld,
        minY: state.cameraY - halfH * invZoom - marginWorld,
        maxY: state.cameraY + halfH * invZoom + marginWorld
    };
}

export function renderEntitiesLayer(ctx, width, height) {
    const data = state.mapData;
    if (!data) return;

    clearLabelCollisionGrid();

    // Single-pass viewport bounds calculation for all entity sub-renderers
    const bounds = getViewportWorldBounds(width, height, 50);

    // 1. Render Creations
    if (state.layers.creations && data.creations) {
        renderCreations(ctx, data.creations, width, height, bounds);
    }

    // 2. Render Harvestables / Resource nodes
    if (state.layers.harvestables && data.harvestables) {
        renderHarvestables(ctx, data.harvestables, width, height, bounds);
    }

    // 3. Render Units (Enemies, Animals, Farmbots)
    if (state.layers.units && data.units) {
        renderUnits(ctx, data.units, width, height, bounds);
    }

    // 4. Render Portals / Elevators
    if (state.layers.portals && data.portals) {
        renderPortals(ctx, data.portals, width, height, bounds);
    }

    // 5. Render Points of Interest (POIs - Major Landmarks First)
    if (state.layers.pois && data.pois) {
        renderPOIs(ctx, data.pois, width, height, bounds);
    }

    // 6. Render Schematics & Builder Guide Platforms (Stacked / Resolved Next)
    if (state.layers.schematics && data.schematics) {
        renderSchematics(ctx, data.schematics, width, height, bounds);
    }

    // 7. Render Custom User Waypoints & Bookmarks
    if (state.customBookmarks && state.customBookmarks.length > 0) {
        renderCustomWaypoints(ctx, state.customBookmarks, width, height, bounds);
    }

    // 8. Render Selected Point Pulsating Ring
    renderSelectedEntityRing(ctx, width, height);
}

function renderPOIs(ctx, pois, width, height, bounds) {

    ctx.save();
    for (const poi of pois) {
        // Fast World-Space Frustum Culling
        if (poi.x < bounds.minX || poi.x > bounds.maxX || poi.y < bounds.minY || poi.y > bounds.maxY) {
            continue;
        }

        const isHovered = state.hoveredEntity === poi;
        const isSelected = state.selectedEntity === poi;

        // OPTIMIZATION (⚡ Bolt): Lazy POI sub-filter group memoization eliminates per-frame string allocations
        if (state.subFilters && state.subFilters.pois && !isSelected && !isHovered) {
            const group = poi._filterGroup || getPoiFilterGroup(poi);
            if (!state.subFilters.pois[group]) continue;
        }

        const px = (poi.x - state.cameraX) * state.zoom + bounds.halfW;
        const py = (state.cameraY - poi.y) * state.zoom + bounds.halfH;

        const radius = isSelected ? 12 : (isHovered ? 10 : 8);

        // Core icon badge
        drawIconBadge(ctx, px, py, radius, poi.icon || 'fa-location-dot', poi.color || '#ff7a00', isSelected, isHovered, 1);

        // Smart Collision-Free Label (Major POIs visible across full map)
        if (state.zoom >= 0.08 || isSelected || isHovered) {
            drawSmartLabel(ctx, poi.name, px, py, radius, {
                font: '600 11.5px "Outfit", sans-serif',
                color: '#ffffff'
            });
        }
    }
    ctx.restore();
}

function renderCreations(ctx, creations, width, height, bounds) {
    // Only appear when zooming in to sector level (zoom >= 0.18)
    if (state.zoom < 0.18 && !state.selectedEntity) return;

    ctx.save();
    ctx.strokeStyle = '#38bdf8';
    ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
    ctx.lineWidth = 1.5;

    for (const cr of creations) {
        // Fast World-Space Frustum Culling
        if (cr.maxX < bounds.minX || cr.minX > bounds.maxX || cr.maxY < bounds.minY || cr.minY > bounds.maxY) {
            continue;
        }

        const isHovered = state.hoveredEntity === cr;
        const isSelected = state.selectedEntity === cr;

        if (state.zoom < 0.18 && !isSelected && !isHovered) continue;

        // Size filter: Small (<50b), Medium (50-500b), Large (500b+)
        if (state.subFilters.creationsSize === 'small' && cr.blocks >= 50) continue;
        if (state.subFilters.creationsSize === 'medium' && (cr.blocks < 50 || cr.blocks > 500)) continue;
        if (state.subFilters.creationsSize === 'large' && cr.blocks <= 500) continue;

        const px = (cr.minX - state.cameraX) * state.zoom + bounds.halfW;
        const py = (state.cameraY - cr.maxY) * state.zoom + bounds.halfH;
        const w = (cr.maxX - cr.minX) * state.zoom;
        const h = (cr.maxY - cr.minY) * state.zoom;

        ctx.fillRect(px, py, Math.max(3, w), Math.max(3, h));
        ctx.strokeRect(px, py, Math.max(3, w), Math.max(3, h));
    }
    ctx.restore();
}

const FA_UNICODE_MAP = {
    'fa-oil-well': '\uf68a',
    'fa-feather': '\uf52d',
    'fa-mountain': '\uf6fd',
    'fa-tree': '\uf1bb',
    'fa-wheat-awn': '\ue2cd',
    'fa-flask-vial': '\ue4f2',
    'fa-spa': '\uf5bb',
    'fa-shield': '\uf3ed',
    'fa-seedling': '\uf4d8',
    'fa-skull': '\uf54c',
    'fa-robot': '\uf544',
    'fa-crosshairs': '\uf05b',
    'fa-bolt': '\uf0e7',
    'fa-cow': '\uf6c0',
    'fa-gem': '\uf3a5',
    'fa-wrench': '\uf0ad',
    'fa-location-dot': '\uf3c5',
    'fa-microchip': '\uf2db',
    'fa-wand-magic-sparkles': '\ue2ca'
};

const fontCache = {};
function getIconFont(r) {
    const key = Math.round(r * 1.05);
    return fontCache[key] || (fontCache[key] = `900 ${key}px "Font Awesome 6 Free", "FontAwesome"`);
}

function drawIconBadge(ctx, x, y, radius, iconClass, color, isSelected, isHovered, count = 1) {
    ctx.save();
    // Dynamic radius based on resource count in tile
    let baseR = radius;
    if (count > 1) {
        if (count <= 3) baseR = radius + 1.5;
        else if (count <= 8) baseR = radius + 3;
        else baseR = radius + 4.5;
    }
    const r = isSelected ? baseR + 2.5 : (isHovered ? baseR + 1.5 : baseR);

    // Glowing halo
    if (isSelected || isHovered) {
        ctx.beginPath();
        ctx.arc(x, y, r + 3.5, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? 'rgba(255, 255, 255, 0.45)' : 'rgba(255, 255, 255, 0.22)';
        ctx.fill();
    }

    // Circular badge container
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#141820';
    ctx.fill();
    ctx.strokeStyle = color || '#ff7a00';
    ctx.lineWidth = isSelected ? 2 : (count > 1 ? 1.6 : 1.2);
    ctx.stroke();

    // Icon Glyph
    const char = FA_UNICODE_MAP[iconClass] || '\uf4d8';
    ctx.font = getIconFont(r);
    ctx.fillStyle = color || '#ff7a00';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(char, x, y + 0.5);
    ctx.restore();
}

function renderUnits(ctx, units, width, height, bounds) {

    ctx.save();
    for (const u of units) {
        // Fast World-Space Frustum Culling
        if (u.x < bounds.minX || u.x > bounds.maxX || u.y < bounds.minY || u.y > bounds.maxY) {
            continue;
        }

        const isHovered = state.hoveredEntity === u;
        const isSelected = state.selectedEntity === u;
        const sub = u.subType || u.category;
        const isBoss = sub === 'boss';

        // Bosses are Tier 1 (always visible at all zoom levels like POIs). Other units appear at zoom >= 0.55
        if (!isBoss && state.zoom < 0.55 && !isSelected && !isHovered) continue;

        // Sub-filters
        if (isBoss && !state.subFilters.units.farmbots) continue;
        if (sub === 'haybot' && !state.subFilters.units.haybots) continue;
        if (sub === 'tapebot' && !state.subFilters.units.tapebots) continue;
        if (sub === 'totebot' && !state.subFilters.units.totebots) continue;
        if (sub === 'seedbot' && !state.subFilters.units.seedbots) continue;
        if (sub === 'animal' && !state.subFilters.units.animals) continue;

        const px = (u.x - state.cameraX) * state.zoom + bounds.halfW;
        const py = (state.cameraY - u.y) * state.zoom + bounds.halfH;

        if (isBoss) {
            drawIconBadge(ctx, px, py, 9.5, 'fa-skull', '#ef4444', isSelected, isHovered, 1);

            // Smart label for Bosses
            if (state.zoom >= 0.08 || isSelected || isHovered) {
                drawSmartLabel(ctx, u.name || 'Farmbot', px, py, 9.5, {
                    font: '700 11px "Outfit", sans-serif',
                    color: '#fca5a5'
                });
            }
        } else {
            const icon = u.icon || (sub === 'animal' ? 'fa-cow' : (sub === 'seedbot' ? 'fa-seedling' : 'fa-robot'));
            drawIconBadge(ctx, px, py, 6.5, icon, u.color || '#f97316', isSelected, isHovered, 1);
        }
    }
    ctx.restore();
}

function renderHarvestables(ctx, harvestables, width, height, bounds) {
    // Resource nodes appear at zoom >= 0.24 (same level as schematic labels)
    if (state.zoom < 0.24 && !state.selectedEntity) return;

    ctx.save();
    for (const h of harvestables) {
        // Fast World-Space Frustum Culling
        if (h.x < bounds.minX || h.x > bounds.maxX || h.y < bounds.minY || h.y > bounds.maxY) {
            continue;
        }

        const isHovered = state.hoveredEntity === h;
        const isSelected = state.selectedEntity === h;

        if (state.zoom < 0.24 && !isSelected && !isHovered) continue;

        // OPTIMIZATION (⚡ Bolt): Cached lowercased category eliminates per-frame string allocations
        const cat = h._catLower || (h._catLower = (h.category || '').toLowerCase());
        if (cat === 'oil' && !state.subFilters.harvestables.oil) continue;
        if (cat === 'cotton' && !state.subFilters.harvestables.cotton) continue;
        if (cat === 'mineral' && !state.subFilters.harvestables.minerals) continue;
        if (cat === 'tree' && !state.subFilters.harvestables.trees) continue;
        if (cat === 'crop' && !state.subFilters.harvestables.crops) continue;
        if (cat === 'chemical' && !state.subFilters.harvestables.chemicals) continue;
        if (cat === 'flower' && !state.subFilters.harvestables.flowers) continue;
        if (cat === 'other' && !state.subFilters.harvestables.other) continue;

        const px = (h.x - state.cameraX) * state.zoom + bounds.halfW;
        const py = (state.cameraY - h.y) * state.zoom + bounds.halfH;

        drawIconBadge(ctx, px, py, 6.5, h.icon || 'fa-seedling', h.color || '#10b981', isSelected, isHovered, h.count || 1);
    }
    ctx.restore();
}

function renderPortals(ctx, portals, width, height, bounds) {
    if (state.zoom < 0.18 && !state.selectedEntity) return;

    ctx.save();
    for (const pt of portals) {
        // Fast World-Space Frustum Culling
        if (pt.x < bounds.minX || pt.x > bounds.maxX || pt.y < bounds.minY || pt.y > bounds.maxY) {
            continue;
        }

        const px = (pt.x - state.cameraX) * state.zoom + bounds.halfW;
        const py = (state.cameraY - pt.y) * state.zoom + bounds.halfH;

        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#a855f7';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }
    ctx.restore();
}

function renderSchematics(ctx, schematics, width, height, bounds) {
    // Icons appear at zoom >= 0.18
    if (state.zoom < 0.18 && !state.selectedEntity) return;

    ctx.save();
    for (const sch of schematics) {
        // Fast World-Space Frustum Culling
        if (sch.x < bounds.minX || sch.x > bounds.maxX || sch.y < bounds.minY || sch.y > bounds.maxY) {
            continue;
        }

        const isHovered = state.hoveredEntity === sch;
        const isSelected = state.selectedEntity === sch;

        if (state.zoom < 0.18 && !isSelected && !isHovered) continue;

        const px = (sch.x - state.cameraX) * state.zoom + bounds.halfW;
        const py = (state.cameraY - sch.y) * state.zoom + bounds.halfH;

        const radius = isSelected ? 11 : (isHovered ? 9 : 7);

        // Glow halo
        ctx.beginPath();
        ctx.arc(px, py, radius + 4, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? 'rgba(56, 189, 248, 0.45)' : 'rgba(0, 0, 0, 0.5)';
        ctx.fill();

        // Core chip badge
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fillStyle = sch.color || '#38bdf8';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Inner microchip dot
        ctx.beginPath();
        ctx.arc(px, py, radius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = '#0f172a';
        ctx.fill();

        // Smart Collision-Free Label appears at zoom >= 0.24 (well before units/resources)
        if (state.zoom >= 0.24 || isSelected || isHovered) {
            drawSmartLabel(ctx, sch.name, px, py, radius, {
                font: '600 11px "Outfit", sans-serif',
                color: '#38bdf8'
            });
        }
    }
    ctx.restore();
}

// OPTIMIZATION (⚡ Bolt): Fast AABB label collision check without creating candidate objects
function checkLabelCollision(boxX, boxY, textW, textH) {
    for (let i = 0; i < occupiedLabelBoxes.length; i++) {
        const occ = occupiedLabelBoxes[i];
        if (boxX < occ.x + occ.w + 4 &&
            boxX + textW + 4 > occ.x &&
            boxY < occ.y + occ.h + 2 &&
            boxY + textH + 2 > occ.y) {
            return true;
        }
    }
    return false;
}

// OPTIMIZATION (⚡ Bolt): Zero-allocation smart label positioning with lazy candidate evaluation.
// Evaluates candidate label positions on demand to avoid allocating 13 candidate/box objects per label.
// Reduces object allocations by ~93% in label rendering loops at 60 FPS.
function drawSmartLabel(ctx, text, anchorX, anchorY, radius, options = {}) {
    const font = options.font || '600 11.5px "Outfit", sans-serif';
    const color = options.color || '#ffffff';

    ctx.save();
    ctx.font = font;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const textW = ctx.measureText(text).width;
    const textH = 14;

    // Candidate 0: Right (default priority)
    let chosenX = anchorX + radius + 5;
    let chosenY = anchorY + 4;
    let chosenBoxX = anchorX + radius + 5;
    let chosenBoxY = anchorY - 9;

    // Lazy check: Only evaluate alternative candidate positions if default collides
    if (occupiedLabelBoxes.length > 0 && checkLabelCollision(chosenBoxX, chosenBoxY, textW, textH)) {
        // Candidate 1: Below-Right
        let candBoxX = anchorX + radius + 5;
        let candBoxY = anchorY + 5;
        if (!checkLabelCollision(candBoxX, candBoxY, textW, textH)) {
            chosenX = anchorX + radius + 5;
            chosenY = anchorY + 18;
            chosenBoxX = candBoxX;
            chosenBoxY = candBoxY;
        } else {
            // Candidate 2: Above-Right
            candBoxX = anchorX + radius + 5;
            candBoxY = anchorY - 23;
            if (!checkLabelCollision(candBoxX, candBoxY, textW, textH)) {
                chosenX = anchorX + radius + 5;
                chosenY = anchorY - 10;
                chosenBoxX = candBoxX;
                chosenBoxY = candBoxY;
            } else {
                // Candidate 3: Below-Center
                candBoxX = anchorX - textW / 2;
                candBoxY = anchorY + radius + 2;
                if (!checkLabelCollision(candBoxX, candBoxY, textW, textH)) {
                    chosenX = anchorX - textW / 2;
                    chosenY = anchorY + radius + 15;
                    chosenBoxX = candBoxX;
                    chosenBoxY = candBoxY;
                } else {
                    // Candidate 4: Above-Center
                    candBoxX = anchorX - textW / 2;
                    candBoxY = anchorY - radius - 19;
                    if (!checkLabelCollision(candBoxX, candBoxY, textW, textH)) {
                        chosenX = anchorX - textW / 2;
                        chosenY = anchorY - radius - 6;
                        chosenBoxX = candBoxX;
                        chosenBoxY = candBoxY;
                    } else {
                        // Candidate 5: Left
                        candBoxX = anchorX - radius - textW - 5;
                        candBoxY = anchorY - 9;
                        if (!checkLabelCollision(candBoxX, candBoxY, textW, textH)) {
                            chosenX = anchorX - radius - textW - 5;
                            chosenY = anchorY + 4;
                            chosenBoxX = candBoxX;
                            chosenBoxY = candBoxY;
                        }
                    }
                }
            }
        }
    }

    occupiedLabelBoxes.push({ x: chosenBoxX, y: chosenBoxY, w: textW, h: textH });

    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 4;
    ctx.fillStyle = color;
    ctx.fillText(text, chosenX, chosenY);
    ctx.restore();
}

function renderSelectedEntityRing(ctx, width, height) {
    const ent = state.selectedEntity;
    if (!ent || ent.x === undefined || ent.y === undefined || ent.x === null || ent.y === null) return;

    // OPTIMIZATION (⚡ Bolt): Reusable target object eliminates per-frame { x, y } allocation when an entity is selected
    const p = worldToScreen(ent.x, ent.y, width, height, tempSelectedPos);
    if (p.x < -100 || p.x > width + 100 || p.y < -100 || p.y > height + 100) return;

    const now = Date.now();
    const color = ent.color || '#38bdf8';

    ctx.save();

    // 1. Pulsating thin dotted circle
    const pulse = 0.5 + 0.5 * Math.sin(now / 200); // 0.0 to 1.0
    const radius = 18 + pulse * 6; // oscillates smoothly between 18px and 24px
    const alpha = 0.7 + pulse * 0.3; // 0.7 to 1.0

    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.lineDashOffset = (now / 40) % 6; // smooth rotation
    ctx.stroke();

    // 2. Faint expanding ripple echo
    const ripplePhase = (now % 1400) / 1400;
    const rippleRadius = 14 + ripplePhase * 20;
    ctx.beginPath();
    ctx.arc(p.x, p.y, rippleRadius, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.globalAlpha = (1 - ripplePhase) * 0.45;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    ctx.stroke();

    ctx.restore();
}

function renderCustomWaypoints(ctx, waypoints, width, height, bounds) {

    ctx.save();
    for (const wp of waypoints) {
        // Fast World-Space Frustum Culling
        if (wp.x < bounds.minX || wp.x > bounds.maxX || wp.y < bounds.minY || wp.y > bounds.maxY) {
            continue;
        }

        const isHovered = state.hoveredEntity === wp;
        const isSelected = state.selectedEntity === wp;

        const px = (wp.x - state.cameraX) * state.zoom + bounds.halfW;
        const py = (state.cameraY - wp.y) * state.zoom + bounds.halfH;

        const radius = isSelected ? 11 : (isHovered ? 9 : 7);
        const color = wp.color || '#00e5ff';

        // Glow halo
        ctx.beginPath();
        ctx.arc(px, py, radius + 4, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? 'rgba(0, 229, 255, 0.45)' : 'rgba(0, 0, 0, 0.55)';
        ctx.fill();

        // Diamond pin marker
        ctx.beginPath();
        ctx.moveTo(px, py - radius);
        ctx.lineTo(px + radius, py);
        ctx.lineTo(px, py + radius);
        ctx.lineTo(px - radius, py);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Inner center core
        ctx.beginPath();
        ctx.arc(px, py, radius * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = '#0f172a';
        ctx.fill();

        drawSmartLabel(ctx, wp.name || 'Custom Waypoint', px, py, radius, {
            font: '700 11px "Outfit", sans-serif',
            color: color
        });
    }
    ctx.restore();
}
