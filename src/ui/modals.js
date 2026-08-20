// Help modal & loading overlays
export function setupModals(elements) {
    const helpModal = elements.helpModal;
    const infoBtn = elements.infoBtn;
    const closeHelpModal = elements.closeHelpModal;

    if (infoBtn && helpModal) {
        infoBtn.addEventListener('click', () => {
            helpModal.classList.add('open');
        });
    }

    if (closeHelpModal && helpModal) {
        closeHelpModal.addEventListener('click', () => {
            helpModal.classList.remove('open');
        });
    }

    if (helpModal) {
        helpModal.addEventListener('click', (e) => {
            if (e.target === helpModal) {
                helpModal.classList.remove('open');
            }
        });
    }

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (helpModal && helpModal.classList.contains('open')) {
                helpModal.classList.remove('open');
            }
            const squadModal = document.getElementById('squadModal');
            if (squadModal && squadModal.classList.contains('open')) {
                squadModal.classList.remove('open');
            }
            const settingsModal = document.getElementById('settingsModal');
            if (settingsModal && settingsModal.classList.contains('open')) {
                settingsModal.classList.remove('open');
            }
        }
    });
}

export function showLoadingOverlay(title = 'PROCESSING MAP...', subtitle = 'Please wait...', stage = 1, percent = 0) {
    const overlay = document.getElementById('mapLoadingOverlay');
    updateLoadingStage(stage, percent, 'Initializing diagnostic pipeline...', subtitle, title);
    if (overlay) {
        overlay.style.display = 'flex';
        overlay.style.opacity = '1';
    }
}

export function updateLoadingStage(stage = 1, percent = 0, counter = '', subtitle = '', title = '', saveName = '') {
    const titleEl = document.getElementById('loadingTitle');
    const subEl = document.getElementById('loadingSubtitle');
    const barEl = document.getElementById('loadingProgressBar');
    const percentEl = document.getElementById('loadingProgressPercent');
    const counterEl = document.getElementById('loadingCounter');
    const saveNameEl = document.getElementById('loadingSaveName');

    if (title && titleEl) titleEl.textContent = title;
    if (subtitle && subEl) subEl.textContent = subtitle;
    if (counter && counterEl) counterEl.textContent = counter;
    if (saveName && saveNameEl) saveNameEl.textContent = saveName.toUpperCase();

    const clampedPercent = Math.min(100, Math.max(0, Math.round(percent)));
    if (barEl) barEl.style.width = `${clampedPercent}%`;
    if (percentEl) percentEl.textContent = `${clampedPercent}%`;

    // Update 4 stage bullet items
    for (let i = 1; i <= 4; i++) {
        const item = document.getElementById(`loadingStage${i}`);
        if (!item) continue;
        if (i < stage) {
            item.className = 'loading-stage-item completed';
        } else if (i === stage) {
            item.className = 'loading-stage-item active';
        } else {
            item.className = 'loading-stage-item';
        }
    }
}

export function hideLoadingOverlay() {
    const overlay = document.getElementById('mapLoadingOverlay');
    if (overlay) {
        updateLoadingStage(4, 100, 'Processing complete', 'Atlas ready');
        setTimeout(() => {
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 250);
        }, 150);
    }
}
