// Walks the main path on a phone-sized page by tapping each screen's own button, checks that
// choices survive a reload, that Start over clears them, and that every link points at a real screen.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PORT = 4322;
const DIR = path.join(__dirname, '..', 'screens');
const FILES = new Set(fs.readdirSync(DIR).map((f) => f.replace('.dc.html', '')));

// Each step: the screen we are on and what to tap to reach the next one. `prep` does what the
// screen needs first (ticking boxes, confirming), the way a presenter would.
const PATH = [
  { on: 'V2-0-Welcome', tap: 'V2-1-1-CleaningLevel' },
  { on: 'V2-1-1-CleaningLevel', tap: 'V2-1-2-YourHome' },
  { on: 'V2-1-2-YourHome', tap: 'V2-1-3-Priorities' },
  { on: 'V2-1-3-Priorities', tap: 'V2-1-4-RecommendedPlan' },
  { on: 'V2-1-4-RecommendedPlan', tap: 'V2-1-5-QualityAgreement' },
  { on: 'V2-1-5-QualityAgreement', tap: 'V2-2-1-MatchedTaskers', prep: async (p) => { const b = p.locator('#screen [role=checkbox]').first(); if ((await b.getAttribute('aria-checked')) !== 'true') await b.click(); } },
  { on: 'V2-2-1-MatchedTaskers', tap: 'V2-2-3-SendRequest' },
  { on: 'V2-2-3-SendRequest', tap: 'V2-2-4-TaskerConfirms' },
  { on: 'V2-2-4-TaskerConfirms', tap: 'V2-2-5-BookingConfirmed', prep: async (p) => { for (const b of await p.locator('#screen [role=checkbox]').all()) if ((await b.getAttribute('aria-checked')) !== 'true') await b.click(); } },
  { on: 'V2-2-5-BookingConfirmed', tap: 'V2-3-1-FirstCleanCheck', prep: async (p) => p.locator('#screen button', { hasText: 'Confirm booking' }).click() },
  { on: 'V2-3-1-FirstCleanCheck', tap: 'V2-3-3-PhotoChecklist', prep: async (p) => { for (const b of await p.locator('#screen [role=checkbox]').all()) if ((await b.getAttribute('aria-checked')) !== 'true') await b.click(); } },
  { on: 'V2-3-3-PhotoChecklist', tap: 'V2-4-1-CheckResult', prep: async (p) => { const btn = p.locator('#screen button', { hasText: 'Add photo' }); while (await btn.count()) await btn.first().click(); } },
  { on: 'V2-4-1-CheckResult', tap: 'V2-5-1-RebookPlan' },
];

(async () => {
  const errors = [];
  // Every link in every screen must point at a screen that exists.
  for (const f of FILES) {
    const t = fs.readFileSync(path.join(DIR, `${f}.dc.html`), 'utf8');
    for (const m of t.matchAll(/href="([\w-]+)\.dc\.html"/g)) if (!FILES.has(m[1]) && !['TC00-Guide', 'TC01-DVF'].includes(m[1])) errors.push(`${f} links to missing ${m[1]}`);
  }
  const server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 500));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (e) => errors.push(`page error: ${e.message}`));
  const hash = () => page.evaluate(() => location.hash.slice(1));
  try {
    await page.goto(`http://localhost:${PORT}/`);
    await page.waitForSelector('#screen > *');
    for (const step of PATH) {
      if ((await hash()) !== step.on) { errors.push(`expected ${step.on}, at ${await hash()}`); break; }
      if (step.prep) await step.prep(page);
      const link = page.locator(`#screen a[href="${step.tap}.dc.html"]`).first();
      if (!(await link.count())) { errors.push(`${step.on}: no button to ${step.tap}`); break; }
      await link.click();
      await page.waitForFunction((h) => location.hash === `#${h}`, step.tap, { timeout: 5000 }).catch(() => errors.push(`${step.on} → ${step.tap} did not navigate`));
    }
    // Choices survive a reload: Deep Cleaning picked on 1.1 is still picked after reloading.
    await page.goto(`http://localhost:${PORT}/#V2-1-1-CleaningLevel`);
    await page.waitForSelector('#screen [role=radio]');
    await page.locator('#screen [role=radio]').nth(1).click();
    await page.reload();
    await page.waitForSelector('#screen [role=radio]');
    const kept = await page.locator('#screen [role=radio]').nth(1).getAttribute('aria-checked');
    if (kept !== 'true') errors.push('choice on 1.1 was lost after reload');
    // The journey map shows progress, and Start over clears it.
    await page.goto(`http://localhost:${PORT}/#V2-0-Journey`);
    await page.waitForSelector('#screen > *');
    const seen = await page.locator('#screen').textContent();
    if (!/\d+ of 18 seen/.test(seen) || /^0 of/.test(seen.match(/(\d+) of 18 seen/)?.[0] || '0 of')) errors.push(`journey progress not shown: ${seen.match(/\d+ of 18 seen/)?.[0]}`);
    await page.click('#menu-btn');
    await page.locator('#sheet .reset').click();
    await page.waitForFunction(() => location.hash === '#V2-0-Welcome');
    await page.goto(`http://localhost:${PORT}/#V2-1-1-CleaningLevel`);
    await page.waitForSelector('#screen [role=radio]');
    if ((await page.locator('#screen [role=radio]').first().getAttribute('aria-checked')) !== 'true') errors.push('Start over did not clear choices');
  } finally {
    await browser.close();
    server.kill();
  }
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  console.log(`OK: main path of ${PATH.length} screens, reload keeps choices, Start over clears them, all links resolve`);
})();
