// Fuzzy entity search engine & results dropdown with distance sorting & infinite scroll
import { state } from '../../core/state.js';
import { jumpToLocation } from '../map_renderer/camera.js';
import { openInspector } from '../inspector/sidebar.js';
import { formatCoords } from '../../core/coords.js';

let searchInput = null;
let searchResultsDiv = null;
let clearSearchBtn = null;

let currentMatches = [];
let renderedIndex = 0;
const PAGE_SIZE = 25;

export function setupSearch(elements) {
    searchInput = elements.searchInput;
    searchResultsDiv = elements.searchResults;
    clearSearchBtn = elements.clearSearch;

    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();
        if (query.length > 0) {
            if (clearSearchBtn) clearSearchBtn.style.display = 'block';
            performSearch(query);
        } else {
            if (clearSearchBtn) clearSearchBtn.style.display = 'none';
            if (searchResultsDiv) searchResultsDiv.innerHTML = '';
            currentMatches = [];
            renderedIndex = 0;
        }
    });

    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            clearSearchBtn.style.display = 'none';
            if (searchResultsDiv) searchResultsDiv.innerHTML = '';
            currentMatches = [];
            renderedIndex = 0;
        });
    }

    if (searchResultsDiv) {
        searchResultsDiv.addEventListener('scroll', () => {
            if (searchResultsDiv.scrollTop + searchResultsDiv.clientHeight >= searchResultsDiv.scrollHeight - 40) {
                renderNextBatch();
            }
        });
    }
}

function getSearchReferencePoint() {
    // 1. Live player position if available & active
    if (state.livePlayer && state.livePlayer.active && state.livePlayer.x != null && state.livePlayer.y != null) {
        return { x: state.livePlayer.x, y: state.livePlayer.y, originName: 'Player' };
    }
    // 2. Selected entity position if available
    if (state.selectedEntity && state.selectedEntity.x != null && state.selectedEntity.y != null) {
        return { x: state.selectedEntity.x, y: state.selectedEntity.y, originName: 'Selection' };
    }
    // 3. Current camera center of screen
    return { x: state.camX || 0, y: state.camY || 0, originName: 'Center' };
}

function performSearch(query) {
    if (!searchResultsDiv || !state.mapData) return;

    currentMatches = [];
    renderedIndex = 0;
    searchResultsDiv.innerHTML = '';

    const ref = getSearchReferencePoint();

    // 1. Search POIs
    if (state.mapData.pois) {
        for (const poi of state.mapData.pois) {
            if (poi.name.toLowerCase().includes(query) || (poi.desc && poi.desc.toLowerCase().includes(query))) {
                currentMatches.push(poi);
            }
        }
    }

    // 2. Search Schematics & Builder Guide Platforms
    if (state.mapData.schematics) {
        for (const sch of state.mapData.schematics) {
            if (sch.name.toLowerCase().includes(query) || (sch.desc && sch.desc.toLowerCase().includes(query))) {
                currentMatches.push(sch);
            }
        }
    }

    // 3. Search Bosses & Key Units
    if (state.mapData.units) {
        for (const u of state.mapData.units) {
            const uName = (u.name || '').toLowerCase();
            const sub = (u.subType || u.category || '').toLowerCase();
            if (uName.includes(query) || sub.includes(query)) {
                currentMatches.push({
                    ...u,
                    name: u.name,
                    icon: u.icon || 'fa-robot',
                    color: u.color || '#ef4444'
                });
            }
        }
    }

    // 4. Search Creations
    if (state.mapData.creations) {
        for (const cr of state.mapData.creations) {
            const name = `Creation #${cr.id}`;
            if (name.toLowerCase().includes(query) || `${cr.blocks}`.includes(query)) {
                currentMatches.push({ ...cr, name, category: 'creation', icon: 'fa-truck-pickup', color: '#38bdf8' });
            }
        }
    }

    // 5. Search Harvestable Resource Deposits (with rich semantic alias matching)
    if (state.mapData.harvestables) {
        const isChemQuery = query.includes('chem') || query.includes('clam') || query.includes('glue') || query.includes('acid') || query.includes('bacterius');
        const isFlowerQuery = query.includes('flower') || query.includes('pigment') || query.includes('bee') || query.includes('honey') || query.includes('hive');
        const isOilQuery = query.includes('oil') || query.includes('geyser') || query.includes('fuel');
        const isCottonQuery = query.includes('cotton') || query.includes('fabric');
        const isMineralQuery = query.includes('stone') || query.includes('rock') || query.includes('ore') || query.includes('mineral') || query.includes('metal');
        const isTreeQuery = query.includes('tree') || query.includes('wood') || query.includes('spruce') || query.includes('birch') || query.includes('pine') || query.includes('forest');
        const isCropQuery = query.includes('crop') || query.includes('food') || query.includes('corn') || query.includes('tomato') || query.includes('beet');

        for (const h of state.mapData.harvestables) {
            const hName = (h.name || '').toLowerCase();
            const hCat = (h.category || '').toLowerCase();

            const isMatch = hName.includes(query) || hCat.includes(query) ||
                (isChemQuery && (hCat === 'chemical' || hName.includes('clam') || hName.includes('bacterius'))) ||
                (isFlowerQuery && (hCat === 'flower' || hName.includes('flower') || hName.includes('beehive') || hName.includes('pigment'))) ||
                (isOilQuery && hCat === 'oil') ||
                (isCottonQuery && hCat === 'cotton') ||
                (isMineralQuery && hCat === 'mineral') ||
                (isTreeQuery && hCat === 'tree') ||
                (isCropQuery && hCat === 'crop');

            if (isMatch) {
                const label = h.count > 1 
                    ? `${h.name} (${h.count} nodes)`
                    : h.name;
                currentMatches.push({
                    ...h,
                    name: label
                });
            }
        }
    }

    // Calculate distance from reference point & sort ascending (closest first)
    for (const item of currentMatches) {
        const d = Math.hypot((item.x || 0) - ref.x, (item.y || 0) - ref.y);
        item._dist = d;
        item._distText = d < 1000 ? `${Math.round(d)}m` : `${(d / 1000).toFixed(1)}km`;
    }

    currentMatches.sort((a, b) => a._dist - b._dist);

    if (currentMatches.length === 0) {
        searchResultsDiv.innerHTML = `<div class="search-no-results"><i class="fa-solid fa-circle-exclamation" style="margin-right: 6px;"></i>No matching locations found</div>`;
        return;
    }

    renderNextBatch();
}

function renderNextBatch() {
    if (!searchResultsDiv || renderedIndex >= currentMatches.length) return;

    const nextBatch = currentMatches.slice(renderedIndex, renderedIndex + PAGE_SIZE);
    const startIdx = renderedIndex;
    renderedIndex += nextBatch.length;

    const container = document.createElement('div');
    container.innerHTML = nextBatch.map(item => `
        <div class="search-result-item" data-x="${item.x}" data-y="${item.y}">
            <div class="search-item-icon-wrap" style="color: ${item.color || '#ff7a00'};">
                <i class="fa-solid ${item.icon || 'fa-location-dot'}"></i>
            </div>
            <div class="search-item-info">
                <div class="search-item-title">${item.name}</div>
                <div class="search-item-coords">
                    <span>${formatCoords(item.x, item.y)}</span>
                    <span class="search-dist-badge"><i class="fa-solid fa-location-arrow" style="font-size:8px; margin-right:3px;"></i>${item._distText}</span>
                </div>
            </div>
            <i class="fa-solid fa-chevron-right search-item-arrow"></i>
        </div>
    `).join('');

    Array.from(container.children).forEach((el, relIdx) => {
        const item = currentMatches[startIdx + relIdx];
        el.addEventListener('click', () => {
            jumpToLocation(item.x, item.y, 0.25);
            openInspector(item);
            if (searchResultsDiv) searchResultsDiv.innerHTML = '';
        });
        searchResultsDiv.appendChild(el);
    });
}
