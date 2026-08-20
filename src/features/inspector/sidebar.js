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
            ${entity.clusterItems && entity.clusterItems.length > 1 ? `
            <div class="detail-property-card">
                <div class="prop-label">Deposit Cluster (${entity.clusterItems.length} Nodes in Tile)</div>
                <div class="prop-value" style="display: flex; flex-direction: column; gap: 4px; margin-top: 4px; font-size: 11.5px;">
                    ${(() => {
                        const counts = {};
                        entity.clusterItems.forEach(i => { counts[i.name] = (counts[i.name] || 0) + 1; });
                        return Object.entries(counts).map(([name, count]) => `<div><i class="fa-solid fa-gem" style="color:var(--color-harvestable); margin-right:4px;"></i> <b>${count}×</b> ${name}</div>`).join('');
                    })()}
                </div>
            </div>` : ''}
            ${entity.blocks ? `
            <div class="detail-property-card">
                <div class="prop-label">Block / Shape Count</div>
                <div class="prop-value monospace">${entity.blocks} blocks</div>
            </div>` : ''}
            <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 16px;">
                <button class="btn btn-primary" id="btnJumpToEntity" style="width: 100%; justify-content: center;">
                    <i class="fa-solid fa-crosshairs"></i> Jump to Coordinates
                </button>
                <button class="btn btn-tool" id="btnPinEntityWaypoint" style="width: 100%; justify-content: center; border-color: rgba(0, 229, 255, 0.4); color: #38bdf8;">
                    <i class="fa-solid fa-bookmark"></i> Pin Waypoint Shortcut
                </button>
            </div>
        `;

        const jumpBtn = document.getElementById('btnJumpToEntity');
        if (jumpBtn) {
            jumpBtn.addEventListener('click', () => {
                jumpToLocation(entity.x, entity.y, 0.25, 400);
            });
        }

        const pinBtn = document.getElementById('btnPinEntityWaypoint');
        if (pinBtn) {
            pinBtn.addEventListener('click', () => {
                import('../tools/bookmarks.js').then(({ addCustomWaypoint }) => {
                    addCustomWaypoint(
                        entity.name || (entity.id ? `Creation #${entity.id}` : 'Custom Point'),
                        entity.x,
                        entity.y,
                        { icon: entity.icon || 'fa-location-dot', color: entity.color || '#00e5ff' }
                    );
                });
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
