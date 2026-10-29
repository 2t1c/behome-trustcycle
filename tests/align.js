// Alignment audit: on every phone screen, at two iPhone sizes and in the laptop's phone frame, each block that
// sits alone on its line (a section, a card, a CTA, a row of content) must have the same inset on the left and
// on the right of the app, within 2px. Blocks that share their line with something else (a title next to an
// icon button, a value next to its label) hug one side on purpose and are not measured. On the laptop it also
// checks that nothing pokes out past the right edge of the phone frame or is cut off inside a box.
// Run: node tests/align.js            (exits 1 and lists every finding)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const serve = require('./serve');

const FILES = fs.readdirSync(path.join(__dirname, '..', 'screens')).map((f) => f.replace('.dc.html', ''))
  .filter((f) => !['V2-0-Guide', 'V2-0-DVF'].includes(f)).sort();
const VIEWS = [
  ['phone 390×844', { width: 390, height: 844 }],
  ['phone 375×667', { width: 375, height: 667 }],
  ['laptop 1440×900', { width: 1440, height: 900 }],
  ['laptop 1280×720', { width: 1280, height: 720 }],
];

// Runs in the page: measures the screen that is showing.
function measure() {
  const app = document.querySelector('#screen .app');
  if (!app) return { findings: ['no .app'], clipped: [] };
  const A = app.getBoundingClientRect();
  const k = A.width / app.offsetWidth || 1;          // the laptop frame is scaled
  const tol = 2 * k;
  const name = (el) => {
    const parts = [];
    for (let e = el; e && e !== app && parts.length < 4; e = e.parentElement) {
      let s = e.localName;
      if (e.classList.length) s += '.' + [...e.classList].join('.');
      if (e.dataset.i) s += `[data-i=${e.dataset.i}]`;
      parts.unshift(s);
    }
    const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    return `${parts.join(' > ')}${text ? ` "${text}"` : ''}`;
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'contents' && Number(cs.opacity) > 0;
  };
  // Alone on its line: no visible sibling overlaps it vertically.
  const alone = (el) => {
    const r = el.getBoundingClientRect();
    return ![...el.parentElement.children].some((s) => {
      if (s === el || !visible(s)) return false;
      if (/absolute|fixed/.test(getComputedStyle(s).position)) return false;   // the floating glass bar
      const q = s.getBoundingClientRect();
      return q.top < r.bottom - 1 && r.top < q.bottom - 1;
    });
  };
  const hscroll = (el) => {
    for (let e = el.parentElement; e && e !== app; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (/(auto|scroll)/.test(cs.overflowX) && e.scrollWidth > e.clientWidth + 1) return true;
    }
    return false;
  };
  const findings = [];
  const reported = new Set();
  for (const el of app.querySelectorAll('*')) {
    if (el.closest('svg') && el.localName !== 'svg') continue;
    if (!visible(el) || hscroll(el)) continue;
    if (el.matches('.ib, .tlink, .tag, .online, [data-menu], .prog *, .bar *, .tr *')) continue;   // icon buttons and badges hug a side; meter fills show a value
    const r = el.getBoundingClientRect();
    if (r.width < A.width * 0.5) continue;
    const ecs = getComputedStyle(el);
    if (ecs.display === 'inline') continue;                                    // a run of text, not a box
    if (parseFloat(ecs.marginLeft) !== parseFloat(ecs.marginRight) && parseFloat(ecs.marginLeft) > 0) continue;   // indented on purpose (side trips)
    // An item in a flex row that doesn't fill the row sits where the row's justify puts it (chips, a legend).
    const pcs = getComputedStyle(el.parentElement);
    if (/flex/.test(pcs.display) && pcs.flexDirection.startsWith('row')) {
      const inner = el.parentElement.clientWidth - parseFloat(pcs.paddingLeft) - parseFloat(pcs.paddingRight);
      if (r.width / k < inner - 2) continue;
    }
    // The block and every box around it must have its line to itself: inside a row it is laid out against its
    // neighbours, not centred in the app.
    let shared = false;
    for (let e = el; e && e !== app; e = e.parentElement) if (!alone(e)) { shared = true; break; }
    if (shared) continue;
    // A header row whose ends are icon buttons hugs the edges by design (4px left, 8px right).
    const kids = [...el.children].filter(visible);
    if (kids.length && (kids[0].matches('.ib, [data-menu]') || kids[kids.length - 1].matches('.ib, [data-menu]'))) continue;
    const L = r.left - A.left;
    const R = A.right - r.right;
    if (Math.abs(L - R) <= tol) continue;
    // Report the outermost box only: a child that keeps its parent's offsets adds nothing.
    let dup = false;
    for (let p = el.parentElement; p && p !== app; p = p.parentElement) if (reported.has(p)) { dup = true; break; }
    if (dup) continue;
    reported.add(el);
    findings.push(`${name(el)}: left ${(L / k).toFixed(1)}px, right ${(R / k).toFixed(1)}px`);
  }
  // Anything past the edges of the app, or text cut off inside a box that hides overflow.
  const clipped = [];
  for (const el of app.querySelectorAll('*')) {
    if (!visible(el) || hscroll(el)) continue;
    if (el.closest('svg') && el.localName !== 'svg') continue;
    const r = el.getBoundingClientRect();
    // Inside a box that crops its content (a photo zoomed into its frame) nothing shows past that box.
    let cropped = false;
    for (let e = el.parentElement; e && e !== app; e = e.parentElement) if (/hidden|clip/.test(getComputedStyle(e).overflowX)) { cropped = true; break; }
    if (!cropped && (r.right > A.right + 0.5 || r.left < A.left - 0.5)) clipped.push(`${name(el)} sticks out (${(r.left - A.left).toFixed(0)}…${(r.right - A.left).toFixed(0)} of ${A.width.toFixed(0)})`);
    const cs = getComputedStyle(el);
    if (cs.overflowX === 'hidden' && cs.textOverflow !== 'ellipsis' && el.scrollWidth > el.clientWidth + 1 && !el.matches('.app, .body, .ph, .hero, .photo, .cmp, .tk, .prog, .tr, .bar *')) clipped.push(`${name(el)} cuts off its content (${el.scrollWidth} > ${el.clientWidth})`);
  }
  const phone = document.querySelector('#phone').getBoundingClientRect();
  if (phone.right > innerWidth + 0.5 || phone.bottom > innerHeight + 0.5 || phone.top < -0.5) clipped.push(`phone frame does not fit the window (${phone.left.toFixed(0)},${phone.top.toFixed(0)} – ${phone.right.toFixed(0)},${phone.bottom.toFixed(0)})`);
  return { findings, clipped };
}

(async () => {
  const server = await serve();
  const browser = await chromium.launch();
  let total = 0;
  try {
    for (const [tag, viewport] of VIEWS) {
      const page = await browser.newPage({ viewport });
      await page.goto(server.url);
      await page.waitForSelector('#screen > *');
      for (const f of FILES) {
        await page.goto(`${server.url}#${f}`);
        await page.reload();
        await page.waitForSelector('#screen .app');
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(450);   // let the entrance animations settle
        const { findings, clipped } = await page.evaluate(measure);
        for (const line of [...findings, ...clipped]) { console.log(`${tag} · ${f} · ${line}`); total++; }
      }
      await page.close();
    }
  } finally {
    await browser.close();
    server.stop();
  }
  console.log(total ? `${total} finding(s)` : `OK: every block is symmetric within 2px and nothing is clipped, on ${FILES.length} screens at ${VIEWS.map((v) => v[0]).join(', ')}`);
  process.exit(total ? 1 : 0);
})();
