// High-Resolution Screenshot Snapshot Exporter
import { showToast } from '../../ui/toasts.js';

export function setupScreenshotExporter(exportBtn, canvas) {
    if (!exportBtn || !canvas) return;

    exportBtn.addEventListener('click', () => {
        exportMapScreenshot(canvas);
    });
}

export function exportMapScreenshot(canvas) {
    showToast("Exporting Snapshot", "Capturing high-resolution map snapshot...", "loading", 1500);

    try {
        // Create offscreen canvas with watermark
        const offCanvas = document.createElement('canvas');
        offCanvas.width = canvas.width;
        offCanvas.height = canvas.height;
        const offCtx = offCanvas.getContext('2d');

        // Copy main canvas
        offCtx.drawImage(canvas, 0, 0);

        // Watermark HUD
        offCtx.save();
        offCtx.font = '700 13px "Outfit", sans-serif';
        offCtx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        offCtx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        offCtx.shadowBlur = 4;
        offCtx.fillText("SCRAP MECHANIC TACTICAL MAP", 20, canvas.height - 20);
        offCtx.restore();

        // Trigger download
        const dataUrl = offCanvas.toDataURL('image/png');
        const a = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        a.download = `scrap_mechanic_map_${timestamp}.png`;
        a.href = dataUrl;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        showToast("Snapshot Saved", "Image downloaded to your computer.", "success");
    } catch (e) {
        showToast("Export Error", `Failed to export screenshot: ${e.message}`, "error");
    }
}
