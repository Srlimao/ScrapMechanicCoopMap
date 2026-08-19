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
