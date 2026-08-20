// Entity layer rendering (POIs, Creations, Units, Harvestables, Portals)
import { state } from '../../core/state.js';
import { worldToScreen } from '../../core/coords.js';

let occupiedLabelBoxes = [];

export function clearLabelCollisionGrid() {
    occupiedLabelBoxes = [];
}

export function renderEntitiesLayer(ctx, width, height) {
    const data = state.mapData;
    if (!data) return;

    clearLabelCollisionGrid();

    // 1. Render Creations
    if (state.layers.creations && data.creations) {
        renderCreations(ctx, data.creations, width, height);
    }

    // 2. Render Harvestables / Resource nodes
    if (state.layers.harvestables && data.harvestables) {
        renderHarvestables(ctx, data.harvestables, width, height);
    }

    // 3. Render Units (Enemies, Animals, Farmbots)
    if (state.layers.units && data.units) {
        renderUnits(ctx, data.units, width, height);
    }

    // 4. Render Portals / Elevators
    if (state.layers.portals && data.portals) {
        renderPortals(ctx, data.portals, width, height);
    }

    // 5. Render Points of Interest (POIs - Major Landmarks First)
    if (state.layers.pois && data.pois) {
        renderPOIs(ctx, data.pois, width, height);
    }

    // 6. Render Schematics & Builder Guide Platforms (Stacked / Resolved Next)
    if (state.layers.schematics && data.schematics) {
        renderSchematics(ctx, data.schematics, width, height);
    }

    // 7. Render Custom User Waypoints & Bookmarks
    if (state.customBookmarks && state.customBookmarks.length > 0) {
        renderCustomWaypoints(ctx, state.customBookmarks, width, height);
    }

    // 8. Render Selected Point Pulsating Ring
    renderSelectedEntityRing(ctx, width, height);
}

function renderPOIs(ctx, pois, width, height) {
    ctx.save();
    for (const poi of pois) {
        const isHovered = state.hoveredEntity === poi;
        const isSelected = state.selectedEntity === poi;

        const name = (poi.name || '').toLowerCase();
        const cat = (poi.category || '').toLowerCase();
        if (state.subFilters && state.subFilters.pois && !isSelected && !isHovered) {
            if (name.includes('mechanic station') && !state.subFilters.pois.mechanicStations) continue;
            if ((name.includes('trader') || name.includes('hideout') || name.includes('farmer')) && !state.subFilters.pois.traders) continue;
            if (name.includes('packing station') && !state.subFilters.pois.packingStations) continue;
            if (name.includes('growlab') && !state.subFilters.pois.growlabs) continue;
            if ((name.includes('chemical') || name.includes('oil lake') || cat === 'chemical' || cat === 'oil') && !state.subFilters.pois.chemOil) continue;
            if (!name.includes('mechanic') && !name.includes('trader') && !name.includes('hideout') && !name.includes('farmer') && !name.includes('packing') && !name.includes('growlab') && !name.includes('chemical') && !name.includes('oil lake') && cat !== 'chemical' && cat !== 'oil' && !state.subFilters.pois.other) continue;
        }

        const p = worldToScreen(poi.x, poi.y, width, height);
        if (p.x < -50 || p.x > width + 50 || p.y < -50 || p.y > height + 50) continue;

        const radius = isSelected ? 12 : (isHovered ? 10 : 8);

        // Core icon badge
        drawIconBadge(ctx, p.x, p.y, radius, poi.icon || 'fa-location-dot', poi.color || '#ff7a00', isSelected, isHovered, 1);

        // Smart Collision-Free Label (Major POIs visible across full map)
        if (state.zoom >= 0.08 || isSelected || isHovered) {
            drawSmartLabel(ctx, poi.name, p.x, p.y, radius, {
                font: '600 11.5px "Outfit", sans-serif',
                color: '#ffffff'
            });
        }
    }
    ctx.restore();
}

function renderCreations(ctx, creations, width, height) {
    // Only appear when zooming in to sector level (zoom >= 0.18)
    if (state.zoom < 0.18 && !state.selectedEntity) return;

    ctx.save();
    ctx.strokeStyle = '#38bdf8';
    ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
    ctx.lineWidth = 1.5;

    for (const cr of creations) {
        const isHovered = state.hoveredEntity === cr;
        const isSelected = state.selectedEntity === cr;

        if (state.zoom < 0.18 && !isSelected && !isHovered) continue;

        // Size filter: Small (<50b), Medium (50-500b), Large (500b+)
        if (state.subFilters.creationsSize === 'small' && cr.blocks >= 50) continue;
        if (state.subFilters.creationsSize === 'medium' && (cr.blocks < 50 || cr.blocks > 500)) continue;
        if (state.subFilters.creationsSize === 'large' && cr.blocks <= 500) continue;

        const pTopLeft = worldToScreen(cr.minX, cr.maxY, width, height);
        const w = (cr.maxX - cr.minX) * state.zoom;
        const h = (cr.maxY - cr.minY) * state.zoom;

        if (pTopLeft.x + w < 0 || pTopLeft.x > width || pTopLeft.y + h < 0 || pTopLeft.y > height) continue;

        ctx.fillRect(pTopLeft.x, pTopLeft.y, Math.max(3, w), Math.max(3, h));
        ctx.strokeRect(pTopLeft.x, pTopLeft.y, Math.max(3, w), Math.max(3, h));
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
    ctx.font = `900 ${Math.round(r * 1.05)}px "Font Awesome 6 Free", "FontAwesome"`;
    ctx.fillStyle = color || '#ff7a00';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(char, x, y + 0.5);
    ctx.restore();
}

function renderUnits(ctx, units, width, height) {
    ctx.save();
    for (const u of units) {
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

        const p = worldToScreen(u.x, u.y, width, height);
        if (p.x < -20 || p.x > width + 20 || p.y < -20 || p.y > height + 20) continue;

        if (isBoss) {
            drawIconBadge(ctx, p.x, p.y, 9.5, 'fa-skull', '#ef4444', isSelected, isHovered, 1);

            // Smart label for Bosses
            if (state.zoom >= 0.08 || isSelected || isHovered) {
                drawSmartLabel(ctx, u.name || 'Farmbot', p.x, p.y, 9.5, {
                    font: '700 11px "Outfit", sans-serif',
                    color: '#fca5a5'
                });
            }
        } else {
            const icon = u.icon || (sub === 'animal' ? 'fa-cow' : (sub === 'seedbot' ? 'fa-seedling' : 'fa-robot'));
            drawIconBadge(ctx, p.x, p.y, 6.5, icon, u.color || '#f97316', isSelected, isHovered, 1);
        }
    }
    ctx.restore();
}

function renderHarvestables(ctx, harvestables, width, height) {
    // Resource nodes appear at zoom >= 0.24 (same level as schematic labels)
    if (state.zoom < 0.24 && !state.selectedEntity) return;

    ctx.save();
    for (const h of harvestables) {
        const isHovered = state.hoveredEntity === h;
        const isSelected = state.selectedEntity === h;

        if (state.zoom < 0.24 && !isSelected && !isHovered) continue;

        const cat = (h.category || '').toLowerCase();
        if (cat === 'oil' && !state.subFilters.harvestables.oil) continue;
        if (cat === 'cotton' && !state.subFilters.harvestables.cotton) continue;
        if (cat === 'mineral' && !state.subFilters.harvestables.minerals) continue;
        if (cat === 'tree' && !state.subFilters.harvestables.trees) continue;
        if (cat === 'crop' && !state.subFilters.harvestables.crops) continue;
        if (cat === 'chemical' && !state.subFilters.harvestables.chemicals) continue;
        if (cat === 'flower' && !state.subFilters.harvestables.flowers) continue;
        if (cat === 'other' && !state.subFilters.harvestables.other) continue;

        const p = worldToScreen(h.x, h.y, width, height);
        if (p.x < -25 || p.x > width + 25 || p.y < -25 || p.y > height + 25) continue;

        drawIconBadge(ctx, p.x, p.y, 6.5, h.icon || 'fa-seedling', h.color || '#10b981', isSelected, isHovered, h.count || 1);
    }
    ctx.restore();
}

function renderPortals(ctx, portals, width, height) {
    if (state.zoom < 0.18 && !state.selectedEntity) return;

    ctx.save();
    for (const pt of portals) {
        const p = worldToScreen(pt.x, pt.y, width, height);
        if (p.x < -20 || p.x > width + 20 || p.y < -20 || p.y > height + 20) continue;

        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#a855f7';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }
    ctx.restore();
}

function renderSchematics(ctx, schematics, width, height) {
    // Icons appear at zoom >= 0.18
    if (state.zoom < 0.18 && !state.selectedEntity) return;

    ctx.save();
    for (const sch of schematics) {
        const isHovered = state.hoveredEntity === sch;
        const isSelected = state.selectedEntity === sch;

        if (state.zoom < 0.18 && !isSelected && !isHovered) continue;

        const p = worldToScreen(sch.x, sch.y, width, height);
        if (p.x < -50 || p.x > width + 50 || p.y < -50 || p.y > height + 50) continue;

        const radius = isSelected ? 11 : (isHovered ? 9 : 7);

        // Glow halo
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius + 4, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? 'rgba(56, 189, 248, 0.45)' : 'rgba(0, 0, 0, 0.5)';
        ctx.fill();

        // Core chip badge
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = sch.color || '#38bdf8';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Inner microchip dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = '#0f172a';
        ctx.fill();

        // Smart Collision-Free Label appears at zoom >= 0.24 (well before units/resources)
        if (state.zoom >= 0.24 || isSelected || isHovered) {
            drawSmartLabel(ctx, sch.name, p.x, p.y, radius, {
                font: '600 11px "Outfit", sans-serif',
                color: '#38bdf8'
            });
        }
    }
    ctx.restore();
}

function drawSmartLabel(ctx, text, anchorX, anchorY, radius, options = {}) {
    const font = options.font || '600 11.5px "Outfit", sans-serif';
    const color = options.color || '#ffffff';

    ctx.save();
    ctx.font = font;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const textW = ctx.measureText(text).width;
    const textH = 14;

    // Candidate positions in priority order:
    // 1. Right (default)
    // 2. Below-Right (stacked underneath 15px)
    // 3. Above-Right (stacked above 15px)
    // 4. Below-Center
    // 5. Above-Center
    // 6. Left
    const candidates = [
        { x: anchorX + radius + 5, y: anchorY + 4, box: { x: anchorX + radius + 5, y: anchorY - 9, w: textW, h: textH } },
        { x: anchorX + radius + 5, y: anchorY + 18, box: { x: anchorX + radius + 5, y: anchorY + 5, w: textW, h: textH } },
        { x: anchorX + radius + 5, y: anchorY - 10, box: { x: anchorX + radius + 5, y: anchorY - 23, w: textW, h: textH } },
        { x: anchorX - textW / 2, y: anchorY + radius + 15, box: { x: anchorX - textW / 2, y: anchorY + radius + 2, w: textW, h: textH } },
        { x: anchorX - textW / 2, y: anchorY - radius - 6, box: { x: anchorX - textW / 2, y: anchorY - radius - 19, w: textW, h: textH } },
        { x: anchorX - radius - textW - 5, y: anchorY + 4, box: { x: anchorX - radius - textW - 5, y: anchorY - 9, w: textW, h: textH } }
    ];

    let chosen = candidates[0];

    for (const cand of candidates) {
        let collides = false;
        for (const occ of occupiedLabelBoxes) {
            // AABB collision test with 4px margin
            if (cand.box.x < occ.x + occ.w + 4 &&
                cand.box.x + cand.box.w + 4 > occ.x &&
                cand.box.y < occ.y + occ.h + 2 &&
                cand.box.y + cand.box.h + 2 > occ.y) {
                collides = true;
                break;
            }
        }
        if (!collides) {
            chosen = cand;
            break;
        }
    }

    occupiedLabelBoxes.push(chosen.box);

    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 4;
    ctx.fillStyle = color;
    ctx.fillText(text, chosen.x, chosen.y);
    ctx.restore();
}

function renderSelectedEntityRing(ctx, width, height) {
    const ent = state.selectedEntity;
    if (!ent || ent.x === undefined || ent.y === undefined || ent.x === null || ent.y === null) return;

    const p = worldToScreen(ent.x, ent.y, width, height);
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

function renderCustomWaypoints(ctx, waypoints, width, height) {
    ctx.save();
    for (const wp of waypoints) {
        const isHovered = state.hoveredEntity === wp;
        const isSelected = state.selectedEntity === wp;

        const p = worldToScreen(wp.x, wp.y, width, height);
        if (p.x < -50 || p.x > width + 50 || p.y < -50 || p.y > height + 50) continue;

        const radius = isSelected ? 11 : (isHovered ? 9 : 7);
        const color = wp.color || '#00e5ff';

        // Glow halo
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius + 4, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? 'rgba(0, 229, 255, 0.45)' : 'rgba(0, 0, 0, 0.55)';
        ctx.fill();

        // Diamond pin marker
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - radius);
        ctx.lineTo(p.x + radius, p.y);
        ctx.lineTo(p.x, p.y + radius);
        ctx.lineTo(p.x - radius, p.y);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Inner center core
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = '#0f172a';
        ctx.fill();

        drawSmartLabel(ctx, wp.name || 'Custom Waypoint', p.x, p.y, radius, {
            font: '700 11px "Outfit", sans-serif',
            color: color
        });
    }
    ctx.restore();
}

