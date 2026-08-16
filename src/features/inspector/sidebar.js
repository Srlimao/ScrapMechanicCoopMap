// Entity Inspector details sidebar
import { state, notifyStateChange } from '../../core/state.js';
import { jumpToLocation } from '../map_renderer/camera.js';
import { formatCoords } from '../../core/coords.js';

let sidebarEl = null;
let titleEl = null;
let subtitleEl = null;
let bodyEl = null;
let heroIconEl = null;

export function setupInspectorSidebar(elements) {
    sidebarEl = elements.detailSidebar;
    titleEl = elements.detailTitle;
    subtitleEl = elements.detailSubtitle;
    bodyEl = elements.detailBody;
    heroIconEl = elements.inspectorHeroIcon;

    if (elements.closeSidebarBtn) {
        elements.closeSidebarBtn.addEventListener('click', closeInspector);
    }
}

export function openInspector(entity) {
    if (!entity || !sidebarEl) return;
    state.selectedEntity = entity;

    if (titleEl) titleEl.textContent = entity.name || `Creation #${entity.id}` || 'Entity';
    if (subtitleEl) subtitleEl.textContent = entity.category ? entity.category.toUpperCase() : 'SURVIVAL ENTITY';
    
    if (heroIconEl) {
        heroIconEl.className = `fa-solid ${entity.icon || 'fa-location-dot'}`;
        heroIconEl.style.color = entity.color || '#ff7a00';
    }

    if (bodyEl) {
        bodyEl.innerHTML = `
            <div class="detail-property-card">
                <div class="prop-label">Coordinates</div>
                <div class="prop-value monospace">${formatCoords(entity.x, entity.y, entity.z)}</div>
            </div>
            ${entity.desc ? `
            <div class="detail-property-card">
                <div class="prop-label">Description</div>
                <div class="prop-value">${entity.desc}</div>
            </div>` : ''}
            ${entity.blocks ? `
            <div class="detail-property-card">
                <div class="prop-label">Block / Shape Count</div>
                <div class="prop-value monospace">${entity.blocks} blocks</div>
            </div>` : ''}
            <div style="margin-top: 16px;">
                <button class="btn btn-primary" id="btnJumpToEntity" style="width: 100%;">
                    <i class="fa-solid fa-crosshairs"></i> Jump to Coordinates
                </button>
            </div>
        `;

        const jumpBtn = document.getElementById('btnJumpToEntity');
        if (jumpBtn) {
            jumpBtn.addEventListener('click', () => {
                jumpToLocation(entity.x, entity.y, 0.25);
            });
        }
    }

    sidebarEl.classList.add('open');
    notifyStateChange('inspector_open', entity);
}

export function closeInspector() {
    if (!sidebarEl) return;
    state.selectedEntity = null;
    sidebarEl.classList.remove('open');
    notifyStateChange('inspector_close', null);
}
