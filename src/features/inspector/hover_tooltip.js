// Dynamic HUD Tooltip for entity hover positioning & metadata
import { state } from '../../core/state.js';
import { calculateDistance, formatCoords } from '../../core/coords.js';
import { openInspector } from './sidebar.js';

let tooltipEl = null;
let tooltipTitle = null;
let tooltipCoords = null;
let tooltipCategory = null;
let tooltipExtraVal = null;
let tooltipExtraRow = null;
let tooltipIcon = null;

export function setupHoverTooltip(elements, canvas) {
    tooltipEl = elements.hoverTooltip;
    tooltipTitle = elements.tooltipTitle;
    tooltipCoords = elements.tooltipCoords;
    tooltipCategory = document.getElementById('tooltipCategory');
    tooltipExtraVal = document.getElementById('tooltipExtraVal');
    tooltipExtraRow = document.getElementById('tooltipExtraRow');
    tooltipIcon = document.getElementById('tooltipIcon');

    if (!canvas) return;

    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const localX = e.clientX - rect.left;
        const localY = e.clientY - rect.top;

        findHoveredEntity(state.mouseWorldPos.x, state.mouseWorldPos.y);
        updateTooltipPosition(localX, localY, canvas.clientWidth, canvas.clientHeight);
    });

    canvas.addEventListener('mouseleave', () => {
        if (tooltipEl) tooltipEl.style.display = 'none';
        state.hoveredEntity = null;
    });

    canvas.addEventListener('click', () => {
        if (state.hoveredEntity) {
            openInspector(state.hoveredEntity);
        }
    });
}

function findHoveredEntity(worldX, worldY) {
    if (!state.mapData) {
        state.hoveredEntity = null;
        return;
    }

    const hitDist = Math.max(12, 30 / state.zoom);

    // 1. Check POIs (Tier 1: Always checkable)
    if (state.layers.pois && state.mapData.pois) {
        for (const poi of state.mapData.pois) {
            const name = (poi.name || '').toLowerCase();
            const cat = (poi.category || '').toLowerCase();
            if (state.subFilters && state.subFilters.pois && state.selectedEntity !== poi) {
                if (name.includes('mechanic station') && !state.subFilters.pois.mechanicStations) continue;
                if ((name.includes('trader') || name.includes('hideout') || name.includes('farmer')) && !state.subFilters.pois.traders) continue;
                if (name.includes('packing station') && !state.subFilters.pois.packingStations) continue;
                if (name.includes('growlab') && !state.subFilters.pois.growlabs) continue;
                if ((name.includes('chemical') || name.includes('oil lake') || cat === 'chemical' || cat === 'oil') && !state.subFilters.pois.chemOil) continue;
                if (!name.includes('mechanic') && !name.includes('trader') && !name.includes('hideout') && !name.includes('farmer') && !name.includes('packing') && !name.includes('growlab') && !name.includes('chemical') && !name.includes('oil lake') && cat !== 'chemical' && cat !== 'oil' && !state.subFilters.pois.other) continue;
            }

            if (calculateDistance(worldX, worldY, poi.x, poi.y) < hitDist) {
                state.hoveredEntity = poi;
                return;
            }
        }
    }

    // 2. Check Schematics (Tier 2: zoom >= 0.18)
    if (state.layers.schematics && state.mapData.schematics && (state.zoom >= 0.18 || state.selectedEntity)) {
        for (const s of state.mapData.schematics) {
            if (calculateDistance(worldX, worldY, s.x, s.y) < hitDist) {
                state.hoveredEntity = s;
                return;
            }
        }
    }

    // 3. Check Creations (Tier 2/3: zoom >= 0.18)
    if (state.layers.creations && state.mapData.creations) {
        const filter = state.subFilters.creationsSize;
        for (const c of state.mapData.creations) {
            if (state.zoom < 0.18 && state.selectedEntity !== c) continue;

            // Size filter: Small (<50b), Medium (50-500b), Large (500b+)
            if (filter === 'small' && c.blocks >= 50) continue;
            if (filter === 'medium' && (c.blocks < 50 || c.blocks > 500)) continue;
            if (filter === 'large' && c.blocks <= 500) continue;

            if (calculateDistance(worldX, worldY, c.x, c.y) < hitDist) {
                state.hoveredEntity = c;
                return;
            }
        }
    }

    // 4. Check Units / Bots (Bosses Tier 1: always checkable. Other units zoom >= 0.55)
    if (state.layers.units && state.mapData.units) {
        for (const u of state.mapData.units) {
            const sub = u.subType || u.category;
            const isBoss = sub === 'boss';

            if (!isBoss && state.zoom < 0.55 && state.selectedEntity !== u) continue;

            if (isBoss && !state.subFilters.units.farmbots) continue;
            if (sub === 'haybot' && !state.subFilters.units.haybots) continue;
            if (sub === 'tapebot' && !state.subFilters.units.tapebots) continue;
            if (sub === 'totebot' && !state.subFilters.units.totebots) continue;
            if (sub === 'seedbot' && !state.subFilters.units.seedbots) continue;
            if (sub === 'animal' && !state.subFilters.units.animals) continue;

            if (calculateDistance(worldX, worldY, u.x, u.y) < hitDist) {
                state.hoveredEntity = u;
                return;
            }
        }
    }

    // 5. Check Harvestables (Tier 5: zoom >= 0.24)
    if (state.layers.harvestables && state.mapData.harvestables && (state.zoom >= 0.24 || state.selectedEntity)) {
        for (const h of state.mapData.harvestables) {
            const cat = (h.category || '').toLowerCase();
            if (cat === 'oil' && !state.subFilters.harvestables.oil) continue;
            if (cat === 'cotton' && !state.subFilters.harvestables.cotton) continue;
            if (cat === 'mineral' && !state.subFilters.harvestables.minerals) continue;
            if (cat === 'tree' && !state.subFilters.harvestables.trees) continue;
            if (cat === 'crop' && !state.subFilters.harvestables.crops) continue;
            if (cat === 'chemical' && !state.subFilters.harvestables.chemicals) continue;
            if (cat === 'flower' && !state.subFilters.harvestables.flowers) continue;
            if (cat === 'other' && !state.subFilters.harvestables.other) continue;

            if (calculateDistance(worldX, worldY, h.x, h.y) < hitDist) {
                state.hoveredEntity = h;
                return;
            }
        }
    }

    state.hoveredEntity = null;
}

function updateTooltipPosition(localX, localY, canvasWidth, canvasHeight) {
    if (!tooltipEl) return;

    if (state.hoveredEntity) {
        const ent = state.hoveredEntity;
        const isCluster = ent.clusterItems && ent.clusterItems.length > 1;
        
        if (tooltipTitle) {
            tooltipTitle.textContent = isCluster 
                ? `${ent.name} (${ent.clusterItems.length} Nodes)`
                : (ent.name || `Creation #${ent.id}` || 'Entity');
        }
        if (tooltipCoords) tooltipCoords.textContent = formatCoords(ent.x, ent.y);
        if (tooltipCategory) tooltipCategory.textContent = ent.category ? ent.category.toUpperCase() : 'POI';

        if (tooltipIcon) {
            tooltipIcon.className = `fa-solid ${ent.icon || 'fa-location-dot'} tooltip-icon`;
            tooltipIcon.style.color = ent.color || '#ff8e1a';
        }

        if (isCluster && tooltipExtraVal && tooltipExtraRow) {
            const counts = {};
            ent.clusterItems.forEach(i => { counts[i.name] = (counts[i.name] || 0) + 1; });
            tooltipExtraVal.textContent = Object.entries(counts).map(([name, count]) => `${count}× ${name}`).join(', ');
            tooltipExtraRow.style.display = 'flex';
        } else if (ent.desc && tooltipExtraVal && tooltipExtraRow) {
            tooltipExtraVal.textContent = ent.desc;
            tooltipExtraRow.style.display = 'flex';
        } else if (tooltipExtraRow) {
            tooltipExtraRow.style.display = 'none';
        }

        tooltipEl.style.display = 'flex';

        const tooltipW = tooltipEl.offsetWidth || 220;
        const tooltipH = tooltipEl.offsetHeight || 110;

        let posX = localX + 16;
        let posY = localY + 16;

        // Flip left if near right edge
        if (canvasWidth && posX + tooltipW > canvasWidth - 12) {
            posX = localX - tooltipW - 14;
        }

        // Flip up if near bottom edge
        if (canvasHeight && posY + tooltipH > canvasHeight - 12) {
            posY = localY - tooltipH - 14;
        }

        tooltipEl.style.left = `${Math.max(8, posX)}px`;
        tooltipEl.style.top = `${Math.max(8, posY)}px`;
    } else {
        tooltipEl.style.display = 'none';
    }
}
