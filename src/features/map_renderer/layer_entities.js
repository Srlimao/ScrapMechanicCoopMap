// Entity layer rendering (POIs, Creations, Units, Harvestables, Portals)
import { state } from '../../core/state.js';
import { worldToScreen } from '../../core/coords.js';

export function renderEntitiesLayer(ctx, width, height) {
    const data = state.mapData;
    if (!data) return;

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

    // 5. Render Schematics & Builder Guide Platforms
    if (state.layers.schematics && data.schematics) {
        renderSchematics(ctx, data.schematics, width, height);
    }

    // 6. Render Points of Interest (POIs)
    if (state.layers.pois && data.pois) {
        renderPOIs(ctx, data.pois, width, height);
    }

    // 7. Render Selected Point Pulsating Ring
    renderSelectedEntityRing(ctx, width, height);
}

function renderPOIs(ctx, pois, width, height) {
    ctx.save();
    for (const poi of pois) {
        const p = worldToScreen(poi.x, poi.y, width, height);
        if (p.x < -50 || p.x > width + 50 || p.y < -50 || p.y > height + 50) continue;

        const isHovered = state.hoveredEntity === poi;
        const isSelected = state.selectedEntity === poi;
        const radius = isSelected ? 12 : (isHovered ? 10 : 8);

        // Halo / glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius + 4, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? 'rgba(255, 122, 0, 0.4)' : 'rgba(0, 0, 0, 0.5)';
        ctx.fill();

        // Core icon circle
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = poi.color || '#ff7a00';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Label if zoomed in or selected
        if (state.zoom > 0.03 || isSelected || isHovered) {
            ctx.font = '600 11px "Outfit", sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#000000';
            ctx.shadowBlur = 4;
            ctx.fillText(poi.name, p.x + radius + 4, p.y + 4);
        }
    }
    ctx.restore();
}

function renderCreations(ctx, creations, width, height) {
    ctx.save();
    ctx.strokeStyle = '#38bdf8';
    ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
    ctx.lineWidth = 1.5;

    for (const cr of creations) {
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

function renderUnits(ctx, units, width, height) {
    ctx.save();
    for (const u of units) {
        // Category filters
        const cat = u.category;
        if (cat === 'boss' && !state.subFilters.units.farmbots) continue;
        if (cat === 'bot' && !state.subFilters.units.haybots) continue;
        if (cat === 'animal' && !state.subFilters.units.animals) continue;

        const p = worldToScreen(u.x, u.y, width, height);
        if (p.x < -20 || p.x > width + 20 || p.y < -20 || p.y > height + 20) continue;

        ctx.beginPath();
        ctx.arc(p.x, p.y, cat === 'boss' ? 7 : 4.5, 0, Math.PI * 2);
        ctx.fillStyle = u.color || '#ef4444';
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
    ctx.restore();
}

function renderHarvestables(ctx, harvestables, width, height) {
    ctx.save();
    for (const h of harvestables) {
        const p = worldToScreen(h.x, h.y, width, height);
        if (p.x < -10 || p.x > width + 10 || p.y < -10 || p.y > height + 10) continue;

        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = h.color || '#10b981';
        ctx.fill();
    }
    ctx.restore();
}

function renderPortals(ctx, portals, width, height) {
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
    ctx.save();
    for (const sch of schematics) {
        const p = worldToScreen(sch.x, sch.y, width, height);
        if (p.x < -50 || p.x > width + 50 || p.y < -50 || p.y > height + 50) continue;

        const isHovered = state.hoveredEntity === sch;
        const isSelected = state.selectedEntity === sch;
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

        // Label if zoomed in or selected/hovered
        if (state.zoom > 0.03 || isSelected || isHovered) {
            ctx.font = '600 11px "Outfit", sans-serif';
            ctx.fillStyle = '#38bdf8';
            ctx.shadowColor = '#000000';
            ctx.shadowBlur = 4;
            ctx.fillText(sch.name, p.x + radius + 4, p.y + 4);
        }
    }
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
