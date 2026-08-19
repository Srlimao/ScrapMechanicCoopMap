// Tactical 360-Degree Proximity Radar Engine
import { state, notifyStateChange } from '../../core/state.js';
import { jumpToLocation } from './camera.js';
import { openInspector } from '../inspector/sidebar.js';

let lastRadarEntities = [];
let sweepAngle = 0;
let lastFrameTime = performance.now();

export function setupRadar(radarCanvas) {
    if (!radarCanvas) return;

    radarCanvas.addEventListener('click', (e) => {
        const rect = radarCanvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        // Scale coords if canvas backing differs from CSS display size
        const scaleX = radarCanvas.width / rect.width;
        const scaleY = radarCanvas.height / rect.height;
        const canvasX = clickX * scaleX;
        const canvasY = clickY * scaleY;

        // Check if user clicked on an entity blip on the radar
        let clickedEntity = null;
        let minD = 14; // click tolerance radius in pixels

        for (const item of lastRadarEntities) {
            const d = Math.hypot(canvasX - item.screenX, canvasY - item.screenY);
            if (d < minD) {
                minD = d;
                clickedEntity = item.entity;
            }
        }

        if (clickedEntity) {
            state.selectedEntity = clickedEntity;
            if (typeof openInspector === 'function') {
                openInspector(clickedEntity);
            }
            if (clickedEntity.x !== undefined && clickedEntity.y !== undefined) {
                jumpToLocation(clickedEntity.x, clickedEntity.y);
            }
            notifyStateChange('entity_selected', clickedEntity);
        } else {
            // Click on empty space: pan camera to corresponding world point
            const centerX = radarCanvas.width / 2;
            const centerY = radarCanvas.height / 2;
            const maxRadius = Math.min(centerX, centerY) - 8;

            const dx = canvasX - centerX;
            const dy = canvasY - centerY;
            const distFromCenter = Math.hypot(dx, dy);

            if (distFromCenter <= maxRadius) {
                const range = state.radarRange || 150;
                const normDist = (distFromCenter / maxRadius) * range;
                const screenAngle = Math.atan2(-dy, dx);

                const { cx, cy, isPlayer, heading } = getRadarCenterWorldPos();
                const playerHeading = (isPlayer && heading !== null) ? heading : Math.PI / 2;
                // Invert screen angle back to world angle
                const worldAngle = screenAngle + playerHeading - Math.PI / 2;

                const targetWorldX = cx + normDist * Math.cos(worldAngle);
                const targetWorldY = cy + normDist * Math.sin(worldAngle);

                jumpToLocation(targetWorldX, targetWorldY);
                notifyStateChange('radar_pan', { x: targetWorldX, y: targetWorldY });
            }
        }
    });
}

export function getRadarCenterWorldPos() {
    if (state.radarMode === 'camera' || !state.livePlayer || !state.livePlayer.online || state.livePlayer.x === null) {
        return {
            cx: state.cameraX || 0,
            cy: state.cameraY || 0,
            cz: null,
            isPlayer: false,
            heading: null
        };
    }

    // Direct, decoupled coordinates updated cleanly from live telemetry
    return {
        cx: state.livePlayer.x,
        cy: state.livePlayer.y,
        cz: state.livePlayer.z !== null ? state.livePlayer.z : null,
        isPlayer: true,
        heading: state.livePlayer.angle !== undefined ? state.livePlayer.angle : Math.PI / 2
    };
}

export function renderRadar(ctx, canvas, mainWidth, mainHeight) {
    if (!ctx || !canvas) return;

    const w = canvas.width;
    const h = canvas.height;
    const centerX = w / 2;
    const centerY = h / 2;
    const radarRadius = Math.min(centerX, centerY) - 8;

    // Independent 60 FPS rotating sweep beam (~2.4s per full rotation)
    const now = performance.now();
    const dt = (now - lastFrameTime) / 1000;
    lastFrameTime = now;
    sweepAngle = (sweepAngle + dt * 2.6) % (Math.PI * 2);

    ctx.clearRect(0, 0, w, h);

    const { cx, cy, cz, isPlayer, heading } = getRadarCenterWorldPos();
    // In player mode, forward heading is locked straight UP (PI/2 on canvas)
    const playerHeading = (isPlayer && heading !== null) ? heading : Math.PI / 2;

    // 1. Pure Pitch-Black Radar Screen Background
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radarRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();
    ctx.clip(); // Keep all radar rendering inside the circular screen

    // 2. Crisp Phosphor-Green Concentric Range Rings
    const range = state.radarRange || 150; // in meters (e.g. 50, 100, 150, 300)
    const ringCount = 3;

    ctx.strokeStyle = 'rgba(34, 197, 94, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);

    for (let i = 1; i <= ringCount; i++) {
        const r = (radarRadius / ringCount) * i;
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        ctx.stroke();

        // Distance label on ring (drawn along top vertical line in sharp green)
        const distVal = Math.round((range / ringCount) * i);
        ctx.fillStyle = '#4ade80';
        ctx.font = 'bold 8px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`${distVal}m`, centerX + 4, centerY - r + 9);
    }

    ctx.setLineDash([]); // Reset solid line

    // 3. Fixed Green Crosshairs (Forward/Aft and Port/Starboard)
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - radarRadius);
    ctx.lineTo(centerX, centerY + radarRadius);
    ctx.moveTo(centerX - radarRadius, centerY);
    ctx.lineTo(centerX + radarRadius, centerY);
    ctx.stroke();

    // 4. Rotating Cardinal Direction Markers (N in red, E/S/W in sharp green)
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const cardinals = [
        { label: 'N', worldAngle: Math.PI / 2, color: '#ef4444' },
        { label: 'E', worldAngle: 0, color: '#4ade80' },
        { label: 'S', worldAngle: -Math.PI / 2, color: '#4ade80' },
        { label: 'W', worldAngle: Math.PI, color: '#4ade80' }
    ];

    for (const card of cardinals) {
        // Screen angle relative to player heading
        const cardScreenAngle = card.worldAngle - playerHeading + Math.PI / 2;
        const cardX = centerX + Math.cos(cardScreenAngle) * (radarRadius - 9);
        const cardY = centerY - Math.sin(cardScreenAngle) * (radarRadius - 9);

        ctx.fillStyle = card.color;
        ctx.fillText(card.label, cardX, cardY);
    }

    // Forward Heading Indicator at Top Rim
    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 8px "JetBrains Mono", monospace';
    ctx.fillText('▲ FWD', centerX, centerY - radarRadius + 9);

    // 5. Continuous 360-Degree Rotating Sonar Sweep Beam with Green Phosphor Trail
    const sweepTrailAngle = Math.PI / 3.2; // ~56 degrees trail
    const steps = 18;

    for (let i = 0; i < steps; i++) {
        const frac = i / steps;
        const a1 = sweepAngle - sweepTrailAngle * (1 - frac);
        const a2 = sweepAngle - sweepTrailAngle * (1 - (i + 1) / steps);
        const alpha = Math.pow(frac, 2.2) * 0.35;

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radarRadius, -a1, -a2, false);
        ctx.closePath();
        ctx.fillStyle = `rgba(34, 197, 94, ${alpha})`;
        ctx.fill();
    }

    // Leading bright green sweep line
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
        centerX + Math.cos(sweepAngle) * radarRadius,
        centerY - Math.sin(sweepAngle) * radarRadius
    );
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#22c55e';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 6. Gather Surrounding Entities and Draw Radar Blips (Rotated Relative to Player)
    lastRadarEntities = [];

    let hostileCount = 0;
    let vehicleCount = 0;
    let poiCount = 0;
    let nearestHostileDist = Infinity;

    // Helper: Convert world entity (x, y, z) to radar screen (bx, by) with vertical elevation filtering
    function worldToRadarScreen(ex, ey, ez) {
        // Vertical altitude/elevation filtering (±20m / ~80 blocks)
        let elevation = 'level';
        let dz = 0;
        if (cz !== null && ez !== undefined && ez !== null) {
            dz = ez - cz;
            const maxVertical = state.radarVerticalBand || 20; // default ±20m band
            if (Math.abs(dz) > maxVertical) return null; // Outside vertical threshold
            if (dz > 2.5) elevation = 'above';
            else if (dz < -2.5) elevation = 'below';
        }

        const dx = ex - cx;
        const dy = ey - cy;
        const dist = Math.hypot(dx, dy);
        if (dist > range) return null;

        const worldAngle = Math.atan2(dy, dx);
        const screenAngle = (worldAngle - playerHeading + Math.PI / 2 + Math.PI * 4) % (Math.PI * 2);
        const normDist = (dist / range) * radarRadius;

        const bx = centerX + Math.cos(screenAngle) * normDist;
        const by = centerY - Math.sin(screenAngle) * normDist;

        // Phosphor decay calculation against rotating sweep beam
        const sweepDelta = ((sweepAngle - screenAngle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        const isJustSwept = sweepDelta < 0.22;
        const decay = Math.max(0.35, 1.0 - (sweepDelta / (Math.PI * 2)) * 0.65);

        return { bx, by, dist, dz, elevation, screenAngle, isJustSwept, decay };
    }

    // A. Enemies / Hostile Bots & Passive Animals (Prioritize Live Telemetry over Save Snapshot)
    const botSource = (state.livePlayer && state.livePlayer.bots && state.livePlayer.bots.length > 0) 
        ? state.livePlayer.bots 
        : (state.mapData && state.mapData.units ? state.mapData.units : []);

    const blipScale = state.radarBlipScale || 1.25;

    if (botSource.length > 0 && (state.radarFilters ? state.radarFilters.enemies !== false : true)) {
        for (const unit of botSource) {
            const p = worldToRadarScreen(unit.x, unit.y, unit.z);
            if (!p) continue;

            const typeStr = (unit.type || unit.name || '').toLowerCase();
            const isPassive = unit.isHostile === false || 
                              typeStr.includes('seed') || 
                              typeStr.includes('woc') || 
                              typeStr.includes('glowbug') || 
                              typeStr.includes('animal') || 
                              typeStr.includes('cow') || 
                              typeStr.includes('farmer') || 
                              typeStr.includes('trader') || 
                              typeStr.includes('npc') || 
                              typeStr.includes('passive');
            const isHostile = !isPassive;

            if (isHostile) {
                hostileCount++;
                if (p.dist < nearestHostileDist) nearestHostileDist = p.dist;
            }

            const color = isHostile ? '#ef4444' : '#4ade80'; // Hostile threats are red, passives/animals/seedbots are soft green
            const blipSize = (isHostile ? (typeStr.includes('farm') ? 5.6 : 4.2) : 2.8) * blipScale;

            // Draw Ping Pulse if just swept
            if (p.isJustSwept) {
                ctx.beginPath();
                ctx.arc(p.bx, p.by, blipSize * 2.4, 0, Math.PI * 2);
                ctx.strokeStyle = color;
                ctx.lineWidth = 1.8;
                ctx.stroke();
            }

            ctx.globalAlpha = p.decay;
            ctx.shadowColor = color;
            ctx.shadowBlur = p.isJustSwept ? 14 : 5;

            if (isHostile) {
                if (p.elevation === 'above') {
                    // Solid Clear Red Arrow Pointing Up (▲)
                    const s = blipSize;
                    ctx.beginPath();
                    ctx.moveTo(p.bx, p.by - s * 1.4); // Top point
                    ctx.lineTo(p.bx - s * 1.2, p.by + s * 1.0); // Bottom left
                    ctx.lineTo(p.bx + s * 1.2, p.by + s * 1.0); // Bottom right
                    ctx.closePath();
                    ctx.fillStyle = '#ef4444';
                    ctx.fill();
                    ctx.strokeStyle = '#7f1d1d';
                    ctx.lineWidth = 1.2;
                    ctx.stroke();
                } else if (p.elevation === 'below') {
                    // Solid Clear Red Arrow Pointing Down (▼)
                    const s = blipSize;
                    ctx.beginPath();
                    ctx.moveTo(p.bx, p.by + s * 1.4); // Bottom point
                    ctx.lineTo(p.bx - s * 1.2, p.by - s * 1.0); // Top left
                    ctx.lineTo(p.bx + s * 1.2, p.by - s * 1.0); // Top right
                    ctx.closePath();
                    ctx.fillStyle = '#ef4444';
                    ctx.fill();
                    ctx.strokeStyle = '#7f1d1d';
                    ctx.lineWidth = 1.2;
                    ctx.stroke();
                } else {
                    // Solid Red Round Blip (● Same Level)
                    ctx.beginPath();
                    ctx.arc(p.bx, p.by, blipSize, 0, Math.PI * 2);
                    ctx.fillStyle = '#ef4444';
                    ctx.fill();
                    ctx.strokeStyle = '#7f1d1d';
                    ctx.lineWidth = 1.2;
                    ctx.stroke();
                }
            } else {
                // Animals: Soft Green Circular Dot
                ctx.beginPath();
                ctx.arc(p.bx, p.by, blipSize, 0, Math.PI * 2);
                ctx.fillStyle = '#4ade80';
                ctx.fill();
            }

            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1.0;

            lastRadarEntities.push({
                screenX: p.bx,
                screenY: p.by,
                entity: unit,
                type: isHostile ? 'hostile' : 'animal',
                dist: p.dist,
                elevation: p.elevation
            });
        }
    }

    // B. Creations / Vehicles (Cap at >= 50 blocks & vertical elevation window)
    const creationSource = (state.livePlayer && state.livePlayer.creations && state.livePlayer.creations.length > 0)
        ? state.livePlayer.creations
        : (state.mapData && state.mapData.creations ? state.mapData.creations : []);

    if (creationSource.length > 0 && (state.radarFilters ? state.radarFilters.vehicles !== false : true)) {
        for (const creation of creationSource) {
            // Cap: Only show creations with at least 50 blocks (filter small debris / loose items)
            const blockCount = creation.blocks || creation.shapes || (creation.mass ? Math.floor(creation.mass / 2) : 0);
            if (blockCount < 50) continue;

            const p = worldToRadarScreen(creation.x, creation.y, creation.z);
            if (!p || p.dist < 1.5) continue; // Don't self-detect current seat

            vehicleCount++;
            const blipSize = (blockCount > 200 ? 5.2 : 3.8) * blipScale;

            if (p.isJustSwept) {
                ctx.strokeStyle = '#00e5ff';
                ctx.lineWidth = 1.5;
                ctx.strokeRect(p.bx - blipSize * 1.5, p.by - blipSize * 1.5, blipSize * 3, blipSize * 3);
            }

            ctx.fillStyle = '#00e5ff';
            ctx.globalAlpha = p.decay;
            ctx.shadowColor = '#00e5ff';
            ctx.shadowBlur = p.isJustSwept ? 10 : 4;
            ctx.fillRect(p.bx - blipSize / 2, p.by - blipSize / 2, blipSize, blipSize);

            // Draw Altitude Chevron for Creations
            if (p.elevation === 'above') {
                ctx.beginPath();
                ctx.moveTo(p.bx, p.by - blipSize - 3.5);
                ctx.lineTo(p.bx - 2.8, p.by - blipSize - 0.5);
                ctx.lineTo(p.bx + 2.8, p.by - blipSize - 0.5);
                ctx.closePath();
                ctx.fillStyle = '#00e5ff';
                ctx.fill();
            } else if (p.elevation === 'below') {
                ctx.beginPath();
                ctx.moveTo(p.bx, p.by + blipSize + 3.5);
                ctx.lineTo(p.bx - 2.8, p.by + blipSize + 0.5);
                ctx.lineTo(p.bx + 2.8, p.by + blipSize + 0.5);
                ctx.closePath();
                ctx.fillStyle = '#00e5ff';
                ctx.fill();
            }

            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1.0;

            lastRadarEntities.push({
                screenX: p.bx,
                screenY: p.by,
                entity: creation,
                type: 'creation',
                dist: p.dist,
                elevation: p.elevation
            });
        }
    }

    // C. Points of Interest & Facilities
    if (state.mapData && state.mapData.pois && (state.radarFilters ? state.radarFilters.pois !== false : true)) {
        for (const poi of state.mapData.pois) {
            const p = worldToRadarScreen(poi.x, poi.y);
            if (!p) continue;

            poiCount++;

            // Draw POI Diamond Blip
            ctx.save();
            ctx.translate(p.bx, p.by);
            ctx.rotate(Math.PI / 4);
            ctx.fillStyle = poi.color || '#f59e0b';
            ctx.globalAlpha = p.decay;
            ctx.shadowColor = poi.color || '#f59e0b';
            ctx.shadowBlur = 6;
            ctx.fillRect(-3, -3, 6, 6);
            ctx.restore();
            ctx.globalAlpha = 1.0;

            lastRadarEntities.push({
                screenX: p.bx,
                screenY: p.by,
                entity: poi,
                type: 'poi',
                dist: p.dist
            });
        }
    }

    // D. Squad Allies
    if (state.squad && state.squad.peers) {
        state.squad.peers.forEach(peer => {
            if (peer.x !== undefined && peer.y !== undefined) {
                const p = worldToRadarScreen(peer.x, peer.y);
                if (!p) return;

                const color = peer.color || '#00e5ff';
                ctx.beginPath();
                ctx.arc(p.bx, p.by, 4, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.shadowColor = color;
                ctx.shadowBlur = 8;
                ctx.fill();
                ctx.shadowBlur = 0;

                // Peer name tag
                ctx.fillStyle = '#ffffff';
                ctx.font = '7px "JetBrains Mono", monospace';
                ctx.textAlign = 'center';
                ctx.fillText((peer.name || 'ALLY').slice(0, 6), p.bx, p.by - 6);

                lastRadarEntities.push({
                    screenX: p.bx,
                    screenY: p.by,
                    entity: peer,
                    type: 'squad',
                    dist: p.dist
                });
            }
        });
    }

    // 7. Center Origin Indicator (Player Forward Arrow / Camera Reticle)
    if (isPlayer) {
        // Player forward vision cone (fixed straight UP in heading-up mode)
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, 32, -Math.PI / 2 - 0.35, -Math.PI / 2 + 0.35);
        ctx.closePath();
        ctx.fillStyle = 'rgba(34, 197, 94, 0.14)';
        ctx.fill();
        ctx.restore();

        // Player Forward Chevron Arrow (pointing straight UP in green phosphor)
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - 7);
        ctx.lineTo(centerX - 5, centerY + 5);
        ctx.lineTo(centerX, centerY + 2);
        ctx.lineTo(centerX + 5, centerY + 5);
        ctx.closePath();
        ctx.fillStyle = '#22c55e';
        ctx.shadowColor = '#22c55e';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
    } else {
        // Camera Target Crosshair Reticle
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(centerX - 4, centerY - 4, 8, 8);
        ctx.beginPath();
        ctx.arc(centerX, centerY, 2, 0, Math.PI * 2);
        ctx.fillStyle = '#22c55e';
        ctx.fill();
    }

    // 8. Outer Clean Rim Ring
    ctx.restore(); // Exit clip

    ctx.strokeStyle = 'rgba(34, 197, 94, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radarRadius, 0, Math.PI * 2);
    ctx.stroke();

    // 9. Update Tactical HUD DOM Badges if elements exist
    updateRadarDOMHUD(hostileCount, vehicleCount, poiCount, nearestHostileDist, range, isPlayer);
}

function updateRadarDOMHUD(hostiles, vehicles, pois, nearestHostile, range, isPlayer) {
    const threatBadge = document.getElementById('radarThreatBadge');
    if (threatBadge) {
        if (hostiles > 0) {
            if (nearestHostile < 80) {
                threatBadge.className = 'radar-threat-badge danger-blink';
                threatBadge.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${hostiles} HOSTILE (${Math.round(nearestHostile)}m)`;
            } else {
                threatBadge.className = 'radar-threat-badge warning';
                threatBadge.innerHTML = `<i class="fa-solid fa-skull"></i> ${hostiles} HOSTILE`;
            }
        } else if (vehicles > 0) {
            threatBadge.className = 'radar-threat-badge info';
            threatBadge.innerHTML = `<i class="fa-solid fa-car"></i> ${vehicles} VEHICLE`;
        } else {
            threatBadge.className = 'radar-threat-badge normal';
            threatBadge.innerHTML = `<i class="fa-solid fa-shield-halved"></i> CLEAR [${range}m]`;
        }
    }

    const rangeText = document.getElementById('radarRangeDisplay');
    if (rangeText) {
        rangeText.textContent = `${range}m`;
    }

    const modeText = document.getElementById('radarCenterMode');
    if (modeText) {
        modeText.textContent = isPlayer ? 'SRC: PLAYER' : 'SRC: CAMERA';
        modeText.className = isPlayer ? 'radar-mode-badge player' : 'radar-mode-badge camera';
    }
}

