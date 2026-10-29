// Walks the main path on a phone-sized page by tapping each screen's own button, checks that
// choices survive a reload, that Start over asks first and then clears them, and that every link points
// at a real screen. Also checks the things a class audience hits first on their own phones: an unknown
// address, the Welcome screen on small iPhones, the menu not covering anything, and the ending at 5.1.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const serve = require('./serve');

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
  { on: 'V2-3-3-PhotoChecklist', tap: 'V2-4-1-CheckResult', prep: async (p) => { const btn = p.locator('#screen button', { hasText: 'Add photo' }); while (await btn.count()) { await btn.first().click(); await p.locator('#photo-sheet button', { hasText: 'Use sample photo' }).click(); } } },
  { on: 'V2-4-1-CheckResult', tap: 'V2-5-1-RebookPlan' },
];

(async () => {
  const errors = [];
  // Every link in every screen must point at a screen that exists.
  for (const f of FILES) {
    const t = fs.readFileSync(path.join(DIR, `${f}.dc.html`), 'utf8');
    for (const m of t.matchAll(/href="([\w-]+)\.dc\.html"/g)) if (!FILES.has(m[1]) && !['TC00-Guide', 'TC01-DVF'].includes(m[1])) errors.push(`${f} links to missing ${m[1]}`);
    // Phone screens never send "back" to the 1600px guide board.
    if (/href="V2-0-Guide\.dc\.html"[^>]*aria-label="Back/.test(t)) errors.push(`${f}: back arrow opens the guide board`);
  }
  // The service worker stores every screen for offline use.
  const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
  for (const f of FILES) if (!sw.includes(`'screens/${f}.dc.html'`)) errors.push(`sw.js does not precache ${f}`);
  const server = await serve();
  const PORT = server.port;
  const browser = await chromium.launch();
  const URL = server.url;
  try {
    const overlaps = (a, b) => a && b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

    // Small phones: the Welcome picture keeps its size, and the menu covers nothing on any phone screen.
    for (const viewport of [{ width: 390, height: 844 }, { width: 375, height: 667 }]) {
      const tag = `${viewport.width}×${viewport.height}`;
      const p = await browser.newPage({ viewport });
      p.on('pageerror', (e) => errors.push(`${tag} page error: ${e.message}`));
      // An unknown screen in the address opens Welcome, not a blank page.
      await p.goto(`${URL}#V2-9-Nope`);
      await p.waitForFunction(() => location.hash === '#V2-0-Welcome' && document.querySelector('#screen > *'), null, { timeout: 5000 }).catch(() => errors.push(`${tag}: unknown hash did not fall back to Welcome`));
      await p.goto(`${URL}#V2-0-Welcome`);
      await p.reload();
      await p.waitForSelector('#screen > *');
      const pic = await p.locator('#screen img[alt^="Chị Lan opens her door"]').evaluate((img) => img.getBoundingClientRect().height);
      if (pic < 150) errors.push(`${tag}: Welcome picture squashed to ${Math.round(pic)}px`);
      const cta = await p.locator('#screen a', { hasText: /as chị Lan/ }).boundingBox();
      for (const sel of ['#menu-btn', '#screen [data-menu]']) {
        const box = await p.locator(sel).first().boundingBox().catch(() => null);   // null when hidden
        if (overlaps(cta, box && { x: box.x - 8, y: box.y - 12, width: box.width + 16, height: box.height + 24 })) errors.push(`${tag}: ${sel} covers the Welcome button`);
      }
      for (const f of FILES) {
        if (['V2-0-Guide', 'V2-0-DVF'].includes(f)) continue;
        await p.goto(`${URL}#${f}`);
        await p.reload();
        await p.waitForSelector('#screen > *');
        if (await p.locator('#menu-btn').isVisible()) errors.push(`${tag}: ${f} shows the floating menu button over its content`);
        if (!(await p.locator('#screen .hd [data-menu][aria-label="Menu"], #screen .tkhd [data-menu][aria-label="Menu"], #screen .top [data-menu][aria-label="Menu"]').count())) errors.push(`${tag}: ${f} has no way to open the menu`);
      }
      await p.close();
    }

    // At 390×844 the icon button at the right of a screen's header opens the screen menu (44px, labelled
    // "Menu"), and closing the sheet hands focus back to it.
    {
      const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
      p.on('pageerror', (e) => errors.push(`menu button page error: ${e.message}`));
      for (const f of ['V2-0-Welcome', 'V2-1-3-Priorities', 'V2-2-4-TaskerConfirms']) {
        await p.goto(`${URL}#${f}`);
        await p.reload();
        await p.waitForSelector('#screen > *');
        const btn = p.locator('#screen [data-menu]');
        const box = await btn.boundingBox();
        if (!box || box.width < 44 || box.height < 44) errors.push(`${f}: header menu button is smaller than 44px`);
        if (box && (box.x + box.width < 390 - 60 || box.y > 120)) errors.push(`${f}: header menu button is not at the top right`);
        if (await p.locator('#sheet').isVisible()) errors.push(`${f}: menu open before tapping the button`);
        await btn.click();
        if (!(await p.locator('#sheet').isVisible())) { errors.push(`${f}: header menu button does not open the menu`); continue; }
        if ((await btn.getAttribute('aria-expanded')) !== 'true') errors.push(`${f}: header menu button does not report the menu as open`);
        if (!(await p.locator('#sheet-list button', { hasText: '1.1 Cleaning level' }).isVisible())) errors.push(`${f}: menu opened without the screen list`);
        await p.locator('#sheet-close').click();
        if (await p.locator('#sheet').isVisible()) errors.push(`${f}: menu did not close`);
        if (!(await btn.evaluate((b) => b === document.activeElement))) errors.push(`${f}: closing the menu did not return focus to its button`);
      }
      // From the menu, a screen opens and the menu closes.
      await p.locator('#screen [data-menu]').click();
      await p.locator('#sheet-list button', { hasText: '2.1 Matched Taskers' }).click();
      await p.waitForFunction(() => location.hash === '#V2-2-1-MatchedTaskers', null, { timeout: 5000 }).catch(() => errors.push('menu entry did not open 2.1'));
      if (await p.locator('#sheet').isVisible()) errors.push('menu stayed open after choosing a screen');
      await p.close();
    }

    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', (e) => errors.push(`page error: ${e.message}`));
    const hash = () => page.evaluate(() => location.hash.slice(1));
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
    // 5.1 on the main path (no case at 4.3): no re-clean is claimed. Booking shows the confirmation and
    // a clear way on to the journey map.
    const rebook = await page.locator('#screen').textContent();
    if (/re-clean resolved|from your case/.test(rebook)) errors.push('5.1 mentions the 4.3 case although 4.3 was skipped');
    await page.locator('#screen button', { hasText: 'Book Nga' }).click();
    await page.waitForTimeout(800);
    const card = await page.locator('#screen [data-booked-card]').boundingBox({ timeout: 2000 }).catch(() => null);
    const bar = await page.locator('#screen a', { hasText: 'Done · see the whole journey' }).boundingBox({ timeout: 2000 }).catch(() => null);
    if (!card || !bar || card.y + card.height > bar.y + 1) errors.push('5.1: booking confirmation is not in view');
    if (!bar) errors.push('5.1: no next step after booking');
    else {
      await page.locator('#screen a', { hasText: 'Done · see the whole journey' }).click();
      await page.waitForFunction(() => location.hash === '#V2-0-Journey', null, { timeout: 5000 }).catch(() => errors.push('5.1 Done did not open the journey'));
    }
    // Journey, main path done: it offers the first side trip, then "Start again" once everything is seen.
    const journeyCta = () => page.locator('#screen a[href]').last();
    await page.waitForFunction(() => /Side trip/.test(document.querySelector('#screen').textContent), null, { timeout: 3000 }).catch(() => {});
    if ((await journeyCta().textContent()).trim() !== 'Side trip: 1.6 Recovery Promise' || (await journeyCta().getAttribute('href')) !== 'V2-1-6-RecoveryPolicy.dc.html') errors.push(`journey after the main path says "${(await journeyCta().textContent()).trim()}"`);
    for (const f of ['V2-1-6-RecoveryPolicy', 'V2-2-2-CapabilityCard', 'V2-3-2-ApproveChange', 'V2-4-2-ReportNotMet', 'V2-4-3-CaseFeedback', 'V2-0-Journey']) {
      await page.goto(`${URL}#${f}`);
      // Wait until the app has opened the screen (it records the visit), not just until the address changed.
      await page.waitForFunction((h) => location.hash === `#${h}` && JSON.parse(localStorage.getItem('behome-trustcycle:v1') || '{}').visited?.includes(h), f);
    }
    await page.waitForFunction(() => /18 of 18 seen/.test(document.querySelector('#screen').textContent), null, { timeout: 3000 }).catch(() => {});
    if ((await journeyCta().textContent()).trim() !== 'Start again at 1.1') errors.push(`journey with everything seen says "${(await journeyCta().textContent()).trim()}"`);
    // With the case at 4.3 seen, 5.1 tells that story.
    await page.goto(`${URL}#V2-5-1-RebookPlan`);
    await page.waitForFunction(() => /re-clean resolved/.test(document.querySelector('#screen').textContent), null, { timeout: 3000 }).catch(() => errors.push('5.1 does not mention the 4.3 case after it was seen'));
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
    // Start over asks first: cancelling keeps everything, accepting clears it.
    await page.locator('#screen [data-menu], #menu-btn:visible').first().click();
    page.once('dialog', (d) => d.dismiss());
    await page.locator('#sheet .reset').click();
    await page.waitForTimeout(200);
    if ((await page.evaluate(() => location.hash)) !== '#V2-0-Journey') errors.push('Start over ran without asking');
    if (!(await page.locator('#sheet').isVisible())) await page.locator('#screen [data-menu], #menu-btn:visible').first().click();
    let asked = '';
    page.once('dialog', (d) => { asked = d.message(); d.accept(); });
    await page.locator('#sheet .reset').click();
    await page.waitForFunction(() => location.hash === '#V2-0-Welcome');
    if (!/Start over/.test(asked)) errors.push('Start over did not ask for confirmation');
    await page.goto(`http://localhost:${PORT}/#V2-1-1-CleaningLevel`);
    await page.waitForSelector('#screen [role=radio]');
    if ((await page.locator('#screen [role=radio]').first().getAttribute('aria-checked')) !== 'true') errors.push('Start over did not clear choices');
    // A screen that can't be loaded (offline, no cache) shows a message instead of doing nothing.
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const off = await ctx.newPage();
    await off.route('**/screens/V2-1-2-YourHome.dc.html', (r) => r.abort());
    await off.goto(`${URL}#V2-1-1-CleaningLevel`);
    await off.waitForSelector('#screen a[href="V2-1-2-YourHome.dc.html"]');
    await off.locator('#screen a[href="V2-1-2-YourHome.dc.html"]').first().click();
    await off.waitForSelector('#toast:not([hidden])', { timeout: 3000 }).catch(() => errors.push('no message when a screen fails to load'));
    await ctx.close();
    // Adding a photo asks where it comes from: camera, library or (on 3.3) the demo's sample.
    const pctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const ph = await pctx.newPage();
    ph.on('pageerror', (e) => errors.push(`page error: ${e.message}`));
    const png = await ph.screenshot();
    await ph.goto(`${URL}#V2-3-3-PhotoChecklist`);
    await ph.waitForSelector('#screen button:has-text("Add photo")');
    const waiting = await ph.locator('#screen button', { hasText: 'Add photo' }).count();
    await ph.locator('#screen button', { hasText: 'Add photo' }).first().click();
    const opts = (await ph.locator('#photo-sheet .ps-list button:visible').allTextContents()).map((t) => t.trim());
    if (opts.join('|') !== 'Take photo|Choose from library|Use sample photo') errors.push(`3.3 photo options: ${opts.join(', ')}`);
    await ph.locator('#photo-sheet .ps-cancel').click();
    if (await ph.locator('#photo-sheet').isVisible()) errors.push('photo sheet stayed open after Cancel');
    if ((await ph.locator('#screen button', { hasText: 'Add photo' }).count()) !== waiting) errors.push('Cancel still added a photo');
    await ph.locator('#screen button', { hasText: 'Add photo' }).first().click();
    const camera = ph.waitForEvent('filechooser');
    await ph.locator('#photo-sheet button', { hasText: 'Take photo' }).click();
    const camChooser = await camera;
    if ((await camChooser.element().getAttribute('capture')) !== 'environment') errors.push('Take photo does not open the camera');
    await camChooser.setFiles([]);
    await ph.locator('#screen button', { hasText: 'Add photo' }).first().click();
    const library = ph.waitForEvent('filechooser');
    await ph.locator('#photo-sheet button', { hasText: 'Choose from library' }).click();
    const libChooser = await library;
    if ((await libChooser.element().getAttribute('capture')) !== null) errors.push('Choose from library opens the camera');
    await libChooser.setFiles({ name: 'room.png', mimeType: 'image/png', buffer: png });
    await ph.waitForSelector('#screen img.mine[src^="data:image/jpeg"]', { timeout: 5000 }).catch(() => errors.push('3.3: the chosen photo is not shown'));
    await ph.reload();
    await ph.waitForSelector('#screen img.mine[src^="data:image/jpeg"]', { timeout: 5000 }).catch(() => errors.push('3.3: the chosen photo was lost after reload'));
    await ph.goto(`${URL}#V2-4-2-ReportNotMet`);
    await ph.waitForSelector('#screen button:has-text("Add another photo")');
    await ph.locator('#screen button', { hasText: 'Add another photo' }).click();
    const opts2 = (await ph.locator('#photo-sheet .ps-list button:visible').allTextContents()).map((t) => t.trim());
    if (opts2.join('|') !== 'Take photo|Choose from library') errors.push(`4.2 photo options: ${opts2.join(', ')}`);
    const lib2 = ph.waitForEvent('filechooser');
    await ph.locator('#photo-sheet button', { hasText: 'Choose from library' }).click();
    await (await lib2).setFiles({ name: 'glass.png', mimeType: 'image/png', buffer: png });
    await ph.waitForSelector('#screen .yours img[src^="data:image/jpeg"]', { timeout: 5000 }).catch(() => errors.push('4.2: the added photo is not shown'));
    await pctx.close();
  } finally {
    await browser.close();
    server.stop();
  }
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  console.log(`OK: main path of ${PATH.length} screens, 5.1 ending and journey next steps, reload keeps choices, Start over asks then clears, unknown address opens Welcome, Welcome picture and menu fine at 390×844 and 375×667, header menu button opens the menu, photos from camera, library or sample, load errors shown, all links resolve`);
})();
