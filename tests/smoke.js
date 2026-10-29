// Opens every screen in a browser, fails on any page error, and saves a screenshot of each.
// Run: npm install --no-save playwright && npx playwright install chromium && npm test
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PORT = 4321;
const OUT = path.join(__dirname, 'screenshots');
const FILES = fs.readdirSync(path.join(__dirname, '..', 'screens')).map((f) => f.replace('.dc.html', '')).sort();

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 500));
  const browser = await chromium.launch();
  const errors = [];
  try {
    for (const [mode, viewport] of [['laptop', { width: 1440, height: 940 }], ['phone', { width: 390, height: 844 }]]) {
      const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
      page.on('pageerror', (e) => errors.push(`${mode}: ${e.message}`));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(`${mode}: ${m.text()}`); });
      for (const file of FILES) {
        await page.goto(`http://localhost:${PORT}/#${file}`);
        await page.reload();
        await page.waitForFunction(() => document.querySelector('#screen').children.length || document.querySelector('#board').children.length, null, { timeout: 8000 }).catch(() => {});
        await page.evaluate(() => document.fonts.ready);
        const empty = await page.evaluate(() => !(document.querySelector('#screen').children.length || document.querySelector('#board').children.length));
        if (empty) errors.push(`${mode}: ${file} rendered nothing`);
        const target = ['V2-0-Guide', 'V2-0-DVF'].includes(file) ? page : page.locator(mode === 'phone' ? 'body' : '#phone');
        await target.screenshot({ path: path.join(OUT, `${mode}-${file}.png`) });
      }
      await page.close();
    }
  } finally {
    await browser.close();
    server.kill();
  }
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  console.log(`OK: ${FILES.length} screens rendered on laptop and phone, screenshots in tests/screenshots`);
})();
