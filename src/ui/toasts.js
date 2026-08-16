// Toast notification system
let toastContainer = null;

export function initToastContainer() {
    toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
}

export function showToast(title, message, type = 'info', durationMs = 4000) {
    if (!toastContainer) initToastContainer();

    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;

    let icon = 'fa-circle-info';
    if (type === 'success') icon = 'fa-circle-check';
    else if (type === 'warning') icon = 'fa-triangle-exclamation';
    else if (type === 'error') icon = 'fa-circle-exclamation';
    else if (type === 'loading') icon = 'fa-spinner fa-spin';

    toast.innerHTML = `
        <i class="fa-solid ${icon} toast-icon"></i>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
    `;

    toastContainer.appendChild(toast);

    let timeoutId = null;
    if (durationMs > 0) {
        timeoutId = setTimeout(() => {
            dismissToast(toast);
        }, durationMs);
    }

    function dismissToast(el) {
        if (!el || !el.parentNode) return;
        el.classList.add('toast-hiding');
        setTimeout(() => {
            if (el.parentNode) el.parentNode.removeChild(el);
        }, 300);
    }

    return {
        dismiss: () => {
            if (timeoutId) clearTimeout(timeoutId);
            dismissToast(toast);
        }
    };
}
