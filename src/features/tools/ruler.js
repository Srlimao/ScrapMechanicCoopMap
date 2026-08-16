// Distance measurement ruler tool
import { state, notifyStateChange } from '../../core/state.js';
import { worldToScreen, calculateDistance } from '../../core/coords.js';
import { CELL_SIZE } from '../../core/constants.js';

let rulerBtn = null;
let rulerHud = null;
let rulerStats = null;

export function setupRulerTool(elements, canvas) {
    rulerBtn = elements.rulerToolBtn;
    rulerHud = elements.rulerHud;
    rulerStats = elements.rulerStats;

    if (rulerBtn) {
        rulerBtn.addEventListener('click', toggleRulerMode);
    }

    if (elements.closeRulerBtn) {
        elements.closeRulerBtn.addEventListener('click', () => {
            state.rulerMode = false;
            state.rulerPoints = [];
            updateRulerUI();
        });
    }

    if (canvas) {
        canvas.addEventListener('click', (e) => {
            if (state.rulerMode) {
                state.rulerPoints.push({ x: state.mouseWorldPos.x, y: state.mouseWorldPos.y });
                if (state.rulerPoints.length > 2) {
                    state.rulerPoints = [state.rulerPoints[state.rulerPoints.length - 1]];
                }
                updateRulerUI();
            }
        });
    }
}

export function toggleRulerMode() {
    state.rulerMode = !state.rulerMode;
    state.rulerPoints = [];
    updateRulerUI();
    notifyStateChange('ruler_toggle', state.rulerMode);
}

function updateRulerUI() {
    if (rulerBtn) rulerBtn.classList.toggle('active', state.rulerMode);
    if (rulerHud) rulerHud.style.display = state.rulerMode ? 'block' : 'none';

    if (rulerStats) {
        if (state.rulerPoints.length === 2) {
            const p1 = state.rulerPoints[0];
            const p2 = state.rulerPoints[1];
            const distMeters = calculateDistance(p1.x, p1.y, p2.x, p2.y);
            const distCells = distMeters / CELL_SIZE;
            rulerStats.innerHTML = `Distance: <b>${distMeters.toFixed(1)} m</b> (${distCells.toFixed(2)} cells)`;
        } else {
            rulerStats.innerHTML = state.rulerPoints.length === 1 ? 'Click target point...' : 'Click first point on map...';
        }
    }
}

export function renderRulerLayer(ctx, width, height) {
    if (!state.rulerMode || state.rulerPoints.length === 0) return;

    ctx.save();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);

    const p1 = worldToScreen(state.rulerPoints[0].x, state.rulerPoints[0].y, width, height);
    const p2 = state.rulerPoints.length > 1 
        ? worldToScreen(state.rulerPoints[1].x, state.rulerPoints[1].y, width, height)
        : worldToScreen(state.mouseWorldPos.x, state.mouseWorldPos.y, width, height);

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    // End points
    ctx.setLineDash([]);
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(p1.x, p1.y, 5, 0, Math.PI * 2);
    ctx.arc(p2.x, p2.y, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}
