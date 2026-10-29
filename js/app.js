// App shell: loads a screen file, renders it into the phone frame (or full screen on a phone),
// follows links between screens, remembers choices, and drives the screen menu.
import { compile, render } from './dc.js';
import { SCREENS, STAGES, byFile } from './screens.js';
import { store } from './store.js';

const $ = (sel) => document.querySelector(sel);
const compiled = new Map();   // file -> compiled screen
const instances = new Map();  // file -> component instance (each screen keeps its own state)
// Stage labels carry the prototype's revision badges (UPDATED · S8): off unless the presenter turns them on.
const settings = { showLabels: readSetting('showLabels', false) };
let current = null;

function readSetting(key, fallback) {
  try { const v = localStorage.getItem(`behome:${key}`); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
}
function writeSetting(key, value) {
  try { localStorage.setItem(`behome:${key}`, JSON.stringify(value)); } catch { /* private mode */ }
}

async function load(file) {
  if (!compiled.has(file)) {
    const res = await fetch(`screens/${file}.dc.html`);
    if (!res.ok) throw new Error(`${file}: ${res.status}`);
    compiled.set(file, compile(await res.text()));
  }
  return compiled.get(file);
}

// What every screen can see of the app: the journey so far, and the screen list for the journey map.
const appProps = () => ({
  showLabels: settings.showLabels,
  stages: STAGES,
  screens: SCREENS,
  visited: store.visited(),
  current,
  reset: resetAll,
});

function instanceFor(file, screen) {
  if (!instances.has(file)) {
    const inst = new screen.Component(appProps());
    const saved = store.screenState(file);
    if (saved) inst.state = { ...inst.state, ...saved };   // choices made earlier, on this device
    inst._onChange = (state) => {
      if (state) store.saveScreenState(file, state);
      if (current === file) paint();
    };
    instances.set(file, inst);
  }
  const inst = instances.get(file);
  inst.props = { ...inst.props, ...appProps() };
  return inst;
}

const isPhone = () => window.matchMedia('(max-width: 600px)').matches;

function paint() {
  const meta = byFile(current);
  const screen = compiled.get(current);
  const host = meta.board ? $('#board') : $('#screen');
  // Keep scroll positions of the screen's scrolling areas across re-renders.
  const saved = [...host.querySelectorAll('*')].filter((el) => el.scrollHeight > el.clientHeight).map((el) => el.scrollTop);
  const nodes = render(screen, instanceFor(current, screen));
  host.replaceChildren(...nodes);
  const root = host.firstElementChild;
  if (root && !meta.board && isPhone()) { root.style.width = '100%'; root.style.height = '100%'; }
  const after = [...host.querySelectorAll('*')].filter((el) => el.scrollHeight > el.clientHeight);
  after.forEach((el, i) => { if (saved[i]) el.scrollTop = saved[i]; });
  wireMenuButton(meta);
}

// The screen menu opens from the icon button at the right of each phone screen's header (marked
// `data-menu` in the screen file), so no floating button sits over a screen's content. On a laptop it
// opens the same sheet over the stage. The wide boards have no header button and keep the round one.
function wireMenuButton(meta) {
  const btn = meta.board ? null : $('#screen [data-menu]');
  document.body.classList.toggle('screen-menu', !!btn);
  if (!btn) return;
  btn.setAttribute('aria-haspopup', 'dialog');
  btn.setAttribute('aria-controls', 'sheet');
  btn.setAttribute('aria-expanded', String(!$('#sheet').hidden));
  btn.addEventListener('click', () => setSheet($('#sheet').hidden));
}

// A screen's own styles apply to that screen only: each rule is scoped to the phone screen or the
// board, so a class in a screen file can't restyle the panel or the menu.
function scopeStyles(styleEl) {
  const scope = (rules) => {
    for (const rule of rules) {
      if (rule.selectorText) {
        rule.selectorText = rule.selectorText.split(',').map((sel) => (
          /^\s*(html|body|:root)\b/.test(sel) ? sel : `:is(#screen, #board) ${sel.trim()}`
        )).join(', ');
      } else if (rule.cssRules) scope(rule.cssRules);
    }
  };
  try { scope(styleEl.sheet.cssRules); } catch { /* leave as written */ }
}

// A short message at the top of the screen, e.g. when a screen can't be loaded.
let toastTimer;
function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 5000);
}

async function go(file, { push = true } = {}) {
  // An unknown or mistyped address opens the welcome screen instead of a blank page.
  const meta = byFile(file) || byFile('V2-0-Welcome');
  let screen;
  try {
    screen = await load(meta.file);
  } catch (err) {
    toast(`Couldn't open ${meta.label}. Check the connection and try again.`);
    if (!current) $('#screen').textContent = `Could not load this screen (${err.message}).`;
    return;
  }
  current = meta.file;
  store.visit(meta.file);
  $('#screen-style').textContent = screen.styles;
  scopeStyles($('#screen-style'));
  document.title = `${screen.title} · beHome TrustCycle`;
  document.body.classList.toggle('board-mode', !!meta.board);
  document.body.classList.toggle('tasker-mode', !!meta.tasker);
  const tag = meta.tasker ? 'Tasker app · beHome Partner' : meta.board || meta.stage === 0 ? 'Overview' : 'Customer app';
  document.querySelectorAll('.app-tag').forEach((el) => { el.textContent = tag; el.classList.toggle('tasker', !!meta.tasker); });
  if (location.hash.slice(1) !== meta.file) history[push ? 'pushState' : 'replaceState'](null, '', `#${meta.file}`);
  ($('#board').replaceChildren(), $('#screen').replaceChildren());
  paint();
  fitBoard();
  (meta.board ? $('#board-wrap') : $('#screen').firstElementChild)?.scrollTo?.(0, 0);
  closeSheet();
  markLists();
}

// Links inside screens point at other screen files, e.g. "V2-1-2-YourHome.dc.html".
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href]');
  if (!a) return;
  const m = a.getAttribute('href').match(/^([\w-]+)\.dc\.html(#.*)?$/);
  if (!m) return;
  e.preventDefault();
  go(m[1]);
});

// The guide and DVF boards are 1600px wide: scale them to the window.
function fitBoard() {
  const root = $('#board').firstElementChild;
  if (!root) return;
  const w = root.offsetWidth || 1600;
  const avail = $('#board-wrap').clientWidth;
  const k = Math.min(1, avail / w);
  $('#board').style.transform = `scale(${k})`;
  $('#board').style.height = `${root.offsetHeight * k}px`;
  $('#board').style.width = `${w}px`;
}

// On laptops the phone is drawn at real size, shrunk only when the window is too short.
function fitPhone() {
  const k = Math.min(1, (window.innerHeight - 48) / 864);
  document.documentElement.style.setProperty('--phone-scale', String(k));
}

function resetAll() {
  if (!window.confirm('Start over? This clears every choice made in the demo on this device.')) return;
  store.reset();
  instances.clear();
  go('V2-0-Welcome');
}

// The screen list, used by the laptop panel and the phone menu.
function buildList(container) {
  container.replaceChildren(...STAGES.map((st) => {
    const group = document.createElement('div');
    group.className = 'group';
    const h = document.createElement('h4');
    h.textContent = st.label;
    group.append(h);
    for (const s of SCREENS.filter((x) => x.stage === st.id && !x.hidden)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.file = s.file;
      const tick = document.createElement('i');
      tick.className = 'tick';
      b.append(tick, document.createTextNode(s.label));
      if (s.tasker) { const t = document.createElement('span'); t.className = 'tag'; t.textContent = 'Tasker'; b.append(t); }
      b.addEventListener('click', () => go(s.file));
      group.append(b);
    }
    return group;
  }));
}

function markLists() {
  document.querySelectorAll('[data-file]').forEach((b) => {
    b.classList.toggle('on', b.dataset.file === current);
    b.classList.toggle('seen', store.hasVisited(b.dataset.file));
  });
}

let sheetOpener = null;
function setSheet(open) {
  const wasOpen = !$('#sheet').hidden;
  $('#sheet').hidden = !open;
  document.querySelectorAll('#menu-btn, #screen [data-menu]').forEach((b) => b.setAttribute('aria-expanded', String(open)));
  if (open && !wasOpen) { sheetOpener = document.activeElement; $('#sheet-close').focus(); }
  // Closing returns focus to the button that opened the menu, if it is still on screen.
  if (!open && wasOpen && sheetOpener?.isConnected) sheetOpener.focus();
}
function openSheet() { setSheet(true); }
function closeSheet() { setSheet(false); }

function buildControls() {
  buildList($('#screen-list'));
  buildList($('#sheet-list'));
  document.querySelectorAll('.toggle-labels').forEach((cb) => {
    cb.checked = settings.showLabels;
    cb.addEventListener('change', () => {
      settings.showLabels = cb.checked;
      document.querySelectorAll('.toggle-labels').forEach((o) => { o.checked = cb.checked; });
      writeSetting('showLabels', settings.showLabels);
      paint();
    });
  });
  document.querySelectorAll('.reset').forEach((b) => b.addEventListener('click', resetAll));
  $('#menu-btn').addEventListener('click', () => setSheet($('#sheet').hidden));
  $('#sheet-close').addEventListener('click', closeSheet);
  $('#sheet').addEventListener('click', (e) => { if (e.target === $('#sheet')) closeSheet(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
}

window.addEventListener('popstate', () => go(location.hash.slice(1) || 'V2-0-Welcome', { push: false }));
window.addEventListener('resize', () => { fitBoard(); fitPhone(); if (current) paint(); });

buildControls();
fitPhone();
go(location.hash.slice(1) || 'V2-0-Welcome', { push: false });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
