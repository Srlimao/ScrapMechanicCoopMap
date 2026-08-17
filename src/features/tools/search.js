// Fuzzy entity search engine & results dropdown
import { state } from '../../core/state.js';
import { jumpToLocation } from '../map_renderer/camera.js';
import { openInspector } from '../inspector/sidebar.js';
import { formatCoords } from '../../core/coords.js';

let searchInput = null;
let searchResultsDiv = null;
let clearSearchBtn = null;

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
        }
    });

    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            clearSearchBtn.style.display = 'none';
            if (searchResultsDiv) searchResultsDiv.innerHTML = '';
        });
    }
}

function performSearch(query) {
    if (!searchResultsDiv || !state.mapData) return;

    const matches = [];

    // Search POIs
    if (state.mapData.pois) {
        for (const poi of state.mapData.pois) {
            if (poi.name.toLowerCase().includes(query) || (poi.desc && poi.desc.toLowerCase().includes(query))) {
                matches.push(poi);
            }
        }
    }

    // Search Schematics & Builder Guide Platforms
    if (state.mapData.schematics) {
        for (const sch of state.mapData.schematics) {
            if (sch.name.toLowerCase().includes(query) || (sch.desc && sch.desc.toLowerCase().includes(query))) {
                matches.push(sch);
            }
        }
    }

    // Search Creations
    if (state.mapData.creations) {
        for (const cr of state.mapData.creations) {
            const name = `Creation #${cr.id}`;
            if (name.toLowerCase().includes(query) || `${cr.blocks}`.includes(query)) {
                matches.push({ ...cr, name, category: 'creation', icon: 'fa-truck-pickup', color: '#38bdf8' });
            }
        }
    }

    renderSearchResults(matches.slice(0, 15));
}

function renderSearchResults(results) {
    if (!searchResultsDiv) return;

    if (results.length === 0) {
        searchResultsDiv.innerHTML = `<div class="search-no-results"><i class="fa-solid fa-circle-exclamation" style="margin-right: 6px;"></i>No matching locations found</div>`;
        return;
    }

    searchResultsDiv.innerHTML = results.map(item => `
        <div class="search-result-item" data-x="${item.x}" data-y="${item.y}">
            <div class="search-item-icon-wrap" style="color: ${item.color || '#ff7a00'};">
                <i class="fa-solid ${item.icon || 'fa-location-dot'}"></i>
            </div>
            <div class="search-item-info">
                <div class="search-item-title">${item.name}</div>
                <div class="search-item-coords">${formatCoords(item.x, item.y)}</div>
            </div>
            <i class="fa-solid fa-chevron-right search-item-arrow"></i>
        </div>
    `).join('');

    searchResultsDiv.querySelectorAll('.search-result-item').forEach((el, idx) => {
        el.addEventListener('click', () => {
            const item = results[idx];
            jumpToLocation(item.x, item.y, 0.2);
            openInspector(item);
            searchResultsDiv.innerHTML = '';
        });
    });
}
