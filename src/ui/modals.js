// Help modal & loading overlays
export function setupModals(elements) {
    const helpModal = elements.helpModal;
    const infoBtn = elements.infoBtn;
    const closeHelpModal = elements.closeHelpModal;

    if (infoBtn && helpModal) {
        infoBtn.addEventListener('click', () => {
            helpModal.style.display = 'flex';
        });
    }

    if (closeHelpModal && helpModal) {
        closeHelpModal.addEventListener('click', () => {
            helpModal.style.display = 'none';
        });
    }

    if (helpModal) {
        helpModal.addEventListener('click', (e) => {
            if (e.target === helpModal) {
                helpModal.style.display = 'none';
            }
        });
    }
}

export function showLoadingOverlay(title = 'PROCESSING MAP...', subtitle = 'Please wait...') {
    const overlay = document.getElementById('mapLoadingOverlay');
    const titleEl = document.getElementById('loadingTitle');
    const subEl = document.getElementById('loadingSubtitle');

    if (titleEl) titleEl.textContent = title;
    if (subEl) subEl.textContent = subtitle;
    if (overlay) {
        overlay.style.display = 'flex';
        overlay.style.opacity = '1';
    }
}

export function hideLoadingOverlay() {
    const overlay = document.getElementById('mapLoadingOverlay');
    if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 250);
    }
}
