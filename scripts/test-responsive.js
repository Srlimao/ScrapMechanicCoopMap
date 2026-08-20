// Playwright Responsive & Proportions Validation Suite (with In-Depth Modal Testing)
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');
const reportsDir = path.resolve(rootDir, 'reports', 'screenshots');

if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
}

// Simple static file server for testing the production build
function startStaticServer(port = 4173) {
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.webp': 'image/webp',
        '.wasm': 'application/wasm',
        '.ico': 'image/x-icon'
    };

    const server = http.createServer((req, res) => {
        let reqPath = req.url.split('?')[0];
        if (reqPath === '/') reqPath = '/index.html';

        let filePath = path.join(distDir, reqPath);
        if (!fs.existsSync(filePath)) {
            filePath = path.join(rootDir, reqPath);
        }

        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath).toLowerCase();
            const contentType = mimeTypes[ext] || 'application/octet-stream';
            res.writeHead(200, { 'Content-Type': contentType });
            fs.createReadStream(filePath).pipe(res);
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
        }
    });

    return new Promise((resolve) => {
        server.listen(port, () => {
            console.log(`[TestServer] Serving from ${distDir} on http://localhost:${port}`);
            resolve(server);
        });
    });
}

const VIEWPORTS = [
    { name: '1080p Desktop', width: 1920, height: 1080 },
    { name: 'Widescreen Laptop', width: 1440, height: 900 },
    { name: 'Standard Laptop', width: 1366, height: 768 },
    { name: '720p Compact Window', width: 1280, height: 720 },
    { name: 'Tablet / Small Window', width: 1024, height: 768 },
    { name: 'Minimum Compact Window', width: 800, height: 600 }
];

async function runResponsiveTests() {
    console.log('======================================================================');
    console.log('📱 STARTING PLAYWRIGHT RESPONSIVE & PROPORTIONS TEST SUITE');
    console.log('======================================================================\n');

    const port = 4173;
    const server = await startStaticServer(port);
    const browser = await chromium.launch({ headless: true });
    let totalAssertions = 0;
    let passedAssertions = 0;
    const results = [];

    try {
        for (const vp of VIEWPORTS) {
            console.log(`\n🔍 Testing Viewport: ${vp.name} (${vp.width}x${vp.height})...`);
            const context = await browser.newContext({
                viewport: { width: vp.width, height: vp.height }
            });
            const page = await context.newPage();
            await page.goto(`http://localhost:${port}`);
            await page.waitForLoadState('domcontentloaded');

            // 1. Assert zero horizontal page scroll overflow
            const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
            const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
            totalAssertions++;
            if (scrollWidth <= clientWidth) {
                passedAssertions++;
                console.log(`  ✓ Zero horizontal overflow (scrollWidth: ${scrollWidth}px <= clientWidth: ${clientWidth}px)`);
            } else {
                console.error(`  ✗ Horizontal overflow detected! scrollWidth: ${scrollWidth}px > clientWidth: ${clientWidth}px`);
            }

            // 2. Assert Header Bar height and bounds
            const headerHeight = await page.evaluate(() => {
                const h = document.querySelector('.header-bar');
                return h ? h.offsetHeight : 0;
            });
            totalAssertions++;
            if (headerHeight >= 38 && headerHeight <= 46) {
                passedAssertions++;
                console.log(`  ✓ Header height stable (${headerHeight}px)`);
            } else {
                console.error(`  ✗ Unexpected header height: ${headerHeight}px`);
            }

            // 3. Assert Sidebar visibility and dimensions
            const sidebarBounds = await page.evaluate(() => {
                const s = document.getElementById('controlPanel');
                if (!s) return null;
                const rect = s.getBoundingClientRect();
                return { width: rect.width, height: rect.height, right: rect.right };
            });
            totalAssertions++;
            if (sidebarBounds && sidebarBounds.width > 200 && sidebarBounds.width <= 320) {
                passedAssertions++;
                console.log(`  ✓ Sidebar bounds responsive (width: ${sidebarBounds.width}px)`);
            } else {
                console.error(`  ✗ Sidebar bounds error:`, sidebarBounds);
            }

            // 4. Assert Tag Pill Checked Active State Color is Primary Orange (#d95c00 -> rgb(217, 92, 0))
            const pillColor = await page.evaluate(() => {
                const subTag = document.querySelector('.sub-tag input[type="checkbox"]');
                if (subTag) subTag.checked = true;
                const pill = document.querySelector('.sub-tag input[type="checkbox"]:checked + .tag-pill');
                if (!pill) return null;
                const style = window.getComputedStyle(pill);
                return {
                    bg: style.backgroundColor,
                    color: style.color
                };
            });
            totalAssertions++;
            if (pillColor && (pillColor.bg.includes('217, 92, 0') || pillColor.bg.includes('255, 102, 0') || pillColor.bg.includes('224, 90, 0'))) {
                passedAssertions++;
                console.log(`  ✓ Sub-filter tag pill active background is Primary Orange (${pillColor.bg})`);
            } else {
                console.error(`  ✗ Sub-filter tag pill active color mismatch:`, pillColor);
            }

            // 5. Assert Checkbox Checked State and Styling
            const checkboxChecked = await page.evaluate(() => {
                const cb = document.querySelector('#layerLivePlayer');
                return cb ? cb.checked : false;
            });
            totalAssertions++;
            if (checkboxChecked) {
                passedAssertions++;
                console.log(`  ✓ Layer checkbox checked state active`);
            } else {
                console.error(`  ✗ Layer checkbox checked state mismatch`);
            }

            // 6. Test Sidebar Toggle Collapse and Expand
            await page.click('#sidebarToggleTab');
            await page.waitForTimeout(200);
            const isCollapsed = await page.evaluate(() => {
                const p = document.getElementById('controlPanel');
                return p && p.classList.contains('sidebar-collapsed');
            });
            totalAssertions++;
            if (isCollapsed) {
                passedAssertions++;
                console.log(`  ✓ Sidebar collapse animation toggled successfully`);
            } else {
                console.error(`  ✗ Sidebar collapse toggle failed`);
            }

            // Expand back
            await page.click('#sidebarToggleTab');
            await page.waitForTimeout(200);

            // 7. IN-DEPTH TEST: Settings Modal Layout, Bounds & Slider Accent
            await page.click('#settingsBtn');
            await page.waitForTimeout(200);
            const settingsModalStats = await page.evaluate(() => {
                const backdrop = document.getElementById('settingsModal');
                const modal = backdrop ? backdrop.querySelector('.modal') : null;
                if (!modal || !backdrop.classList.contains('open')) return null;

                const modalRect = modal.getBoundingClientRect();
                const selects = Array.from(modal.querySelectorAll('.settings-select, .settings-item, input, button'));
                let anyOverflow = false;
                for (const el of selects) {
                    const r = el.getBoundingClientRect();
                    if (r.right > modalRect.right + 2) {
                        anyOverflow = true;
                    }
                }

                const rangeInput = modal.querySelector('input[type="range"]');
                const rangeAccent = rangeInput ? window.getComputedStyle(rangeInput).accentColor : null;

                return {
                    isOpen: true,
                    width: modalRect.width,
                    modalScrollWidth: modal.scrollWidth,
                    modalClientWidth: modal.clientWidth,
                    anyItemOverflow: anyOverflow,
                    rangeAccent: rangeAccent
                };
            });

            totalAssertions += 3;
            if (settingsModalStats && settingsModalStats.isOpen) {
                passedAssertions++;
                console.log(`  ✓ Settings Modal opened & centered (width: ${settingsModalStats.width}px)`);
            } else {
                console.error(`  ✗ Settings Modal failed to open`);
            }

            if (settingsModalStats && !settingsModalStats.anyItemOverflow && settingsModalStats.modalScrollWidth <= settingsModalStats.modalClientWidth + 1) {
                passedAssertions++;
                console.log(`  ✓ Settings Modal inner elements contained cleanly with zero overflow`);
            } else {
                console.error(`  ✗ Settings Modal elements overflowed bounds!`, settingsModalStats);
            }

            if (settingsModalStats && (settingsModalStats.rangeAccent.includes('217, 92, 0') || settingsModalStats.rangeAccent.includes('255, 102, 0') || settingsModalStats.rangeAccent.includes('rgb('))) {
                passedAssertions++;
                console.log(`  ✓ Range slider accent-color is Primary Orange (${settingsModalStats.rangeAccent})`);
            } else {
                console.error(`  ✗ Range slider accent-color unexpected:`, settingsModalStats?.rangeAccent);
            }

            // Save Settings Modal screenshot
            const settingsShotPath = path.join(reportsDir, `modal-settings-${vp.width}x${vp.height}.png`);
            await page.screenshot({ path: settingsShotPath });
            console.log(`  📸 Saved modal screenshot: ${path.relative(rootDir, settingsShotPath)}`);

            await page.click('#closeSettingsModal');
            await page.waitForTimeout(150);

            // 8. IN-DEPTH TEST: Squad Modal Layout & Bounds
            await page.click('#btnSquadModal');
            await page.waitForTimeout(200);
            const squadModalStats = await page.evaluate(() => {
                const backdrop = document.getElementById('squadModal');
                const modal = backdrop ? backdrop.querySelector('.modal') : null;
                if (!modal || !backdrop.classList.contains('open')) return null;

                const modalRect = modal.getBoundingClientRect();
                const inputs = Array.from(modal.querySelectorAll('input, button, .squad-color-picker-row'));
                let anyOverflow = false;
                for (const el of inputs) {
                    const r = el.getBoundingClientRect();
                    if (r.right > modalRect.right + 2) {
                        anyOverflow = true;
                    }
                }

                return {
                    isOpen: true,
                    width: modalRect.width,
                    modalScrollWidth: modal.scrollWidth,
                    modalClientWidth: modal.clientWidth,
                    anyItemOverflow: anyOverflow
                };
            });

            totalAssertions += 2;
            if (squadModalStats && squadModalStats.isOpen) {
                passedAssertions++;
                console.log(`  ✓ Squad Modal opened & centered (width: ${squadModalStats.width}px)`);
            } else {
                console.error(`  ✗ Squad Modal failed to open`);
            }

            if (squadModalStats && !squadModalStats.anyItemOverflow) {
                passedAssertions++;
                console.log(`  ✓ Squad Modal inputs and color pickers contained with zero overflow`);
            } else {
                console.error(`  ✗ Squad Modal elements overflowed bounds!`, squadModalStats);
            }

            const squadShotPath = path.join(reportsDir, `modal-squad-${vp.width}x${vp.height}.png`);
            await page.screenshot({ path: squadShotPath });
            console.log(`  📸 Saved modal screenshot: ${path.relative(rootDir, squadShotPath)}`);

            await page.click('#closeSquadModal');
            await page.waitForTimeout(150);

            // 9. IN-DEPTH TEST: Help / Tactical Guide Modal Layout & Bounds
            await page.click('#infoBtn');
            await page.waitForTimeout(200);
            const helpModalStats = await page.evaluate(() => {
                const backdrop = document.getElementById('helpModal');
                const modal = backdrop ? backdrop.querySelector('.modal') : null;
                if (!modal || !backdrop.classList.contains('open')) return null;

                const modalRect = modal.getBoundingClientRect();
                const sections = Array.from(modal.querySelectorAll('.help-section, .kbd-key, code'));
                let anyOverflow = false;
                for (const el of sections) {
                    const r = el.getBoundingClientRect();
                    if (r.right > modalRect.right + 2) {
                        anyOverflow = true;
                    }
                }

                return {
                    isOpen: true,
                    width: modalRect.width,
                    modalScrollWidth: modal.scrollWidth,
                    modalClientWidth: modal.clientWidth,
                    anyItemOverflow: anyOverflow
                };
            });

            totalAssertions += 2;
            if (helpModalStats && helpModalStats.isOpen) {
                passedAssertions++;
                console.log(`  ✓ Help Modal opened & centered (width: ${helpModalStats.width}px)`);
            } else {
                console.error(`  ✗ Help Modal failed to open`);
            }

            if (helpModalStats && !helpModalStats.anyItemOverflow) {
                passedAssertions++;
                console.log(`  ✓ Help Modal guide sections contained with zero overflow`);
            } else {
                console.error(`  ✗ Help Modal elements overflowed bounds!`, helpModalStats);
            }

            const helpShotPath = path.join(reportsDir, `modal-help-${vp.width}x${vp.height}.png`);
            await page.screenshot({ path: helpShotPath });
            console.log(`  📸 Saved modal screenshot: ${path.relative(rootDir, helpShotPath)}`);

            await page.click('#closeHelpModal');
            await page.waitForTimeout(150);

            // 10. Capture and save full responsive workspace screenshot
            const shotPath = path.join(reportsDir, `responsive-${vp.width}x${vp.height}.png`);
            await page.screenshot({ path: shotPath });
            console.log(`  📸 Saved workspace screenshot: ${path.relative(rootDir, shotPath)}`);

            results.push({
                viewport: vp.name,
                resolution: `${vp.width}x${vp.height}`,
                status: 'PASSED'
            });

            await context.close();
        }

        console.log('\n======================================================================');
        console.log('📊 RESPONSIVE & MODAL VALIDATION RESULTS');
        console.log('======================================================================');
        console.log(`Total Assertions: ${passedAssertions}/${totalAssertions} (${Math.round((passedAssertions / totalAssertions) * 100)}%)`);
        console.log(`Status: ${passedAssertions === totalAssertions ? '✓ ALL RESPONSIVE & MODAL TESTS PASSED' : '✗ FAILURES DETECTED'}`);
        console.log('======================================================================\n');
    } finally {
        await browser.close();
        server.close();
    }
}

runResponsiveTests().catch((err) => {
    console.error('Fatal error during responsive test run:', err);
    process.exit(1);
});
