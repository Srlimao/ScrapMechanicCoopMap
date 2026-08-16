// Dynamic HUD Tooltip for entity hover
import { state } from '../../core/state.js';
import { calculateDistance, formatCoords } from '../../core/coords.js';
import { openInspector } from './sidebar.js';

let tooltipEl = null;
let tooltipTitle = null;
let tooltipCoords = null;

export function setupHoverTooltip(elements, canvas) {
    tooltipEl = elements.hoverTooltip;
    tooltipTitle = elements.tooltipTitle;
    tooltipCoords = elements.tooltipCoords;

    if (!canvas) return;

    canvas.addEventListener('mousemove', (e) => {
        findHoveredEntity(state.mouseWorldPos.x, state.mouseWorldPos.y);
        updateTooltipPosition(e.clientX, e.clientY);
    });

    canvas.addEventListener('click', () => {
        if (state.hoveredEntity) {
            openInspector(state.hoveredEntity);
        }
    });
}

function findHoveredEntity(worldX, worldY) {
    if (!state.mapData) return;

    // Check POIs
    if (state.layers.pois && state.mapData.pois) {
        for (const poi of state.mapData.pois) {
            if (calculateDistance(worldX, worldY, poi.x, poi.y) < 35 / state.zoom) {
                state.hoveredEntity = poi;
                return;
            }
        }
    }

    state.hoveredEntity = null;
}

function updateTooltipPosition(clientX, clientY) {
    if (!tooltipEl) return;

    if (state.hoveredEntity) {
        if (tooltipTitle) tooltipTitle.textContent = state.hoveredEntity.name;
        if (tooltipCoords) tooltipCoords.textContent = formatCoords(state.hoveredEntity.x, state.hoveredEntity.y);

        tooltipEl.style.display = 'block';
        tooltipEl.style.left = `${clientX + 14}px`;
        tooltipEl.style.top = `${clientY + 14}px`;
    } else {
        tooltipEl.style.display = 'none';
    }
}
