// Fuzzy entity search engine & results dropdown with distance sorting & infinite scroll
// OPTIMIZATION (⚡ Bolt): Input debouncing, squared-distance pre-sorting, and lazy distance formatting.
// Adding a 120ms input debounce eliminates redundant fuzzy searches during typing.
// Pre-computing squared distance (distSq = dx*dx + dy*dy) avoids Math.hypot/Math.sqrt calls during sorting across thousands of items,
// and distance text formatting is deferred lazily until rendering the visible 25-item batch.
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
let searchDebounceTimer = null;

export function setupSearch(elements) {
    searchInput = elements.searchInput;
    searchResultsDiv = elements.searchResults;
    clearSearchBtn = elements.clearSearch;

    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();
        if (searchDebounceTimer) clearTimeout(searchDebounceTimer);

        if (query.length > 0) {
            if (clearSearchBtn) clearSearchBtn.style.display = 'block';
            searchDebounceTimer = setTimeout(() => {
                performSearch(query);
            }, 120);
        } else {
            if (clearSearchBtn) clearSearchBtn.style.display = 'none';
            if (searchResultsDiv) searchResultsDiv.innerHTML = '';
            currentMatches = [];
            renderedIndex = 0;
        }
    });

    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
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

    // Helper: Push item with pre-computed squared distance and enriched entity details for openInspector
    function addMatch(item, displayName, icon, color, category) {
        const x = item.x || 0;
        const y = item.y || 0;
        const dx = x - ref.x;
        const dy = y - ref.y;

        const enrichedEntity = {
            ...item,
            x,
            y,
            name: displayName || item.name,
            icon: icon || item.icon || 'fa-location-dot',
            color: color || item.color || '#ff7a00',
            category: category || item.category || 'POI'
        };

        currentMatches.push({
            x,
            y,
            name: enrichedEntity.name,
            icon: enrichedEntity.icon,
            color: enrichedEntity.color,
            distSq: dx * dx + dy * dy,
            entity: enrichedEntity
        });
    }

    // 1. Search POIs
    if (state.mapData.pois) {
        for (const poi of state.mapData.pois) {
            if (poi.name.toLowerCase().includes(query) || (poi.desc && poi.desc.toLowerCase().includes(query))) {
                addMatch(poi, poi.name, poi.icon, poi.color, poi.category);
            }
        }
    }

    // 2. Search Schematics & Builder Guide Platforms
    if (state.mapData.schematics) {
        for (const sch of state.mapData.schematics) {
            if (sch.name.toLowerCase().includes(query) || (sch.desc && sch.desc.toLowerCase().includes(query))) {
                addMatch(sch, sch.name, sch.icon, sch.color, 'schematic');
            }
        }
    }

    // 3. Search Bosses & Key Units
    if (state.mapData.units) {
        for (const u of state.mapData.units) {
            const uName = (u.name || '').toLowerCase();
            const sub = (u.subType || u.category || '').toLowerCase();
            if (uName.includes(query) || sub.includes(query)) {
                addMatch(u, u.name, u.icon || 'fa-robot', u.color || '#ef4444', u.category || 'unit');
            }
        }
    }

    // 4. Search Creations
    if (state.mapData.creations) {
        for (const cr of state.mapData.creations) {
            const name = `Creation #${cr.id}`;
            if (name.toLowerCase().includes(query) || `${cr.blocks}`.includes(query)) {
                addMatch(cr, name, 'fa-truck-pickup', '#38bdf8', 'creation');
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
                addMatch(h, label, h.icon, h.color, h.category || 'harvestable');
            }
        }
    }

    // Fast sorting using pre-computed squared distance (a.distSq - b.distSq)
    currentMatches.sort((a, b) => a.distSq - b.distSq);

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
    container.innerHTML = nextBatch.map(item => {
        const distMeters = Math.sqrt(item.distSq);
        const distText = distMeters < 1000 ? `${Math.round(distMeters)}m` : `${(distMeters / 1000).toFixed(1)}km`;
        return `
            <div class="search-result-item" data-x="${item.x}" data-y="${item.y}">
                <div class="search-item-icon-wrap" style="color: ${item.color || '#ff7a00'};">
                    <i class="fa-solid ${item.icon || 'fa-location-dot'}"></i>
                </div>
                <div class="search-item-info">
                    <div class="search-item-title">${item.name}</div>
                    <div class="search-item-coords">
                        <span>${formatCoords(item.x, item.y)}</span>
                        <span class="search-dist-badge"><i class="fa-solid fa-location-arrow" style="font-size:8px; margin-right:3px;"></i>${distText}</span>
                    </div>
                </div>
                <i class="fa-solid fa-chevron-right search-item-arrow"></i>
            </div>
        `;
    }).join('');

    Array.from(container.children).forEach((el, relIdx) => {
        const item = currentMatches[startIdx + relIdx];
        el.addEventListener('click', () => {
            jumpToLocation(item.x, item.y, 0.25);
            openInspector(item.entity);
            if (searchResultsDiv) searchResultsDiv.innerHTML = '';
        });
        searchResultsDiv.appendChild(el);
    });
}
