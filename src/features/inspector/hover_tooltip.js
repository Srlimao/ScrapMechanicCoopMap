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

    // 1. Check POIs
    if (state.layers.pois && state.mapData.pois) {
        for (const poi of state.mapData.pois) {
            if (calculateDistance(worldX, worldY, poi.x, poi.y) < hitDist) {
                state.hoveredEntity = poi;
                return;
            }
        }
    }

    // 2. Check Schematics
    if (state.layers.schematics && state.mapData.schematics) {
        for (const s of state.mapData.schematics) {
            if (calculateDistance(worldX, worldY, s.x, s.y) < hitDist) {
                state.hoveredEntity = s;
                return;
            }
        }
    }

    // 3. Check Creations
    if (state.layers.creations && state.mapData.creations) {
        const filter = state.subFilters.creationsSize;
        for (const c of state.mapData.creations) {
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

    // 4. Check Units / Bots
    if (state.layers.units && state.mapData.units) {
        for (const u of state.mapData.units) {
            const cat = u.category;
            if (cat === 'boss' && !state.subFilters.units.farmbots) continue;
            if (cat === 'bot' && !state.subFilters.units.haybots) continue;
            if (cat === 'animal' && !state.subFilters.units.animals) continue;

            if (calculateDistance(worldX, worldY, u.x, u.y) < hitDist) {
                state.hoveredEntity = u;
                return;
            }
        }
    }

    // 5. Check Harvestables
    if (state.layers.harvestables && state.mapData.harvestables) {
        for (const h of state.mapData.harvestables) {
            const cat = (h.category || '').toLowerCase();
            const name = (h.name || '').toLowerCase();
            if ((cat.includes('oil') || name.includes('oil')) && !state.subFilters.harvestables.oil) continue;
            if ((cat.includes('cotton') || name.includes('cotton')) && !state.subFilters.harvestables.cotton) continue;
            if ((cat.includes('mineral') || name.includes('mineral') || name.includes('stone')) && !state.subFilters.harvestables.minerals) continue;
            if ((cat.includes('tree') || name.includes('wood') || name.includes('tree')) && !state.subFilters.harvestables.trees) continue;

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
        if (tooltipTitle) tooltipTitle.textContent = ent.name || `Creation #${ent.id}` || 'Entity';
        if (tooltipCoords) tooltipCoords.textContent = formatCoords(ent.x, ent.y);
        if (tooltipCategory) tooltipCategory.textContent = ent.category ? ent.category.toUpperCase() : 'POI';

        if (tooltipIcon) {
            tooltipIcon.className = `fa-solid ${ent.icon || 'fa-location-dot'} tooltip-icon`;
            tooltipIcon.style.color = ent.color || '#ff8e1a';
        }

        if (ent.desc && tooltipExtraVal && tooltipExtraRow) {
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
