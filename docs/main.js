// Interactive Simulated Radar Demo for Landing Page
(function() {
    const canvas = document.getElementById('demoRadarCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function resize() {
        const parent = canvas.parentElement;
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    // Simulated Player & Squad state
    let playerX = 0;
    let playerY = 0;
    let angle = 0;
    let trail = [];
    let sweepAngle = 0;

    const pois = [
        { name: 'Mechanic Station', x: -140, y: -60, color: '#38bdf8', icon: 'wrench' },
        { name: 'Fruit Packing Station', x: 180, y: 40, color: '#4ade80', icon: 'apple' },
        { name: 'Warehouse (4-Floor)', x: 120, y: -130, color: '#f59e0b', icon: 'building' },
        { name: 'Oil Pond', x: -190, y: 110, color: '#fbbf24', icon: 'oil' },
        { name: 'Boss Farmbot', x: 90, y: 150, color: '#ef4444', icon: 'skull' },
        { name: 'Trader Hideout', x: -30, y: -160, color: '#a855f7', icon: 'store' }
    ];

    const squad = [
        { name: 'Mechanic_2', x: -80, y: -20, color: '#ec4899', dir: 1.2 },
        { name: 'ScrapScout', x: 70, y: -40, color: '#10b981', dir: -0.8 }
    ];

    let t = 0;

    function render() {
        t += 0.02;
        sweepAngle += 0.03;

        // Player circular / organic path
        playerX = Math.sin(t * 0.8) * 160 + Math.cos(t * 0.3) * 40;
        playerY = Math.cos(t * 0.8) * 110 + Math.sin(t * 0.5) * 30;
        angle = Math.atan2(-Math.sin(t * 0.8), Math.cos(t * 0.8)) + Math.PI / 2;

        trail.push({ x: playerX, y: playerY });
        if (trail.length > 40) trail.shift();

        const w = canvas.width;
        const h = canvas.height;
        const cx = w / 2;
        const cy = h / 2;

        ctx.clearRect(0, 0, w, h);

        // 1. Grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        const step = 40;
        for (let x = 0; x < w; x += step) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
        for (let y = 0; y < h; y += step) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }

        // 2. Concentric Radar Rings
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.12)';
        ctx.beginPath();
        ctx.arc(cx, cy, 80, 0, Math.PI * 2);
        ctx.arc(cx, cy, 160, 0, Math.PI * 2);
        ctx.arc(cx, cy, 240, 0, Math.PI * 2);
        ctx.stroke();

        // 3. Radar Sweep Line
        ctx.save();
        ctx.translate(cx, cy);
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 260);
        grad.addColorStop(0, 'rgba(0, 229, 255, 0.2)');
        grad.addColorStop(1, 'rgba(0, 229, 255, 0)');
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 260, sweepAngle, sweepAngle + 0.5);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();

        // 4. Static POIs
        for (const p of pois) {
            const px = cx + p.x;
            const py = cy + p.y;

            ctx.beginPath();
            ctx.arc(px, py, 6, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 10;
            ctx.fill();
            ctx.shadowBlur = 0;

            // Label
            ctx.fillStyle = '#cbd5e1';
            ctx.font = '11px Outfit, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(p.name, px, py - 10);
        }

        // 5. Squad Teammates
        for (const s of squad) {
            const sx = cx + s.x + Math.sin(t + s.dir) * 20;
            const sy = cy + s.y + Math.cos(t + s.dir) * 20;

            ctx.beginPath();
            ctx.arc(sx, sy, 7, 0, Math.PI * 2);
            ctx.fillStyle = s.color;
            ctx.shadowColor = s.color;
            ctx.shadowBlur = 12;
            ctx.fill();
            ctx.shadowBlur = 0;

            ctx.fillStyle = s.color;
            ctx.font = 'bold 11px Outfit, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(s.name, sx, sy - 12);
        }

        // 6. Player Trail
        if (trail.length > 1) {
            ctx.beginPath();
            ctx.moveTo(cx + trail[0].x, cy + trail[0].y);
            for (let i = 1; i < trail.length; i++) {
                ctx.lineTo(cx + trail[i].x, cy + trail[i].y);
            }
            ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
            ctx.lineWidth = 2.5;
            ctx.stroke();
        }

        // 7. Player Dot & Direction Arrow
        const curX = cx + playerX;
        const curY = cy + playerY;

        ctx.save();
        ctx.translate(curX, curY);
        ctx.rotate(angle);

        // Direction cone
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.lineTo(-8, 8);
        ctx.lineTo(0, 4);
        ctx.lineTo(8, 8);
        ctx.closePath();
        ctx.fillStyle = '#00e5ff';
        ctx.shadowColor = '#00e5ff';
        ctx.shadowBlur = 14;
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.restore();

        // Player Label
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('YOU (Live)', curX, curY + 22);

        requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
})();
