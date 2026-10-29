// App shell: loads a screen file, renders it into the phone frame (or full screen on a phone),
// follows links between screens, remembers choices, and drives the screen menu.
import { compile, render } from './dc.js';
import { SCREENS, STAGES, byFile } from './screens.js';
import { store } from './store.js';

const $ = (sel) => document.querySelector(sel);
const compiled = new Map();   // file -> compiled screen
const instances = new Map();  // file -> component instance (each screen keeps its own state)
const settings = { showLabels: readSetting('showLabels', true) };
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
}

async function go(file, { push = true } = {}) {
  const meta = byFile(file);
  if (!meta) return;
  const screen = await load(meta.file);
  current = meta.file;
  store.visit(meta.file);
  $('#screen-style').textContent = screen.styles;
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

function closeSheet() { $('#sheet').hidden = true; $('#menu-btn').setAttribute('aria-expanded', 'false'); }

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
  $('#menu-btn').addEventListener('click', () => {
    const open = $('#sheet').hidden;
    $('#sheet').hidden = !open;
    $('#menu-btn').setAttribute('aria-expanded', String(open));
  });
  $('#sheet-close').addEventListener('click', closeSheet);
  $('#sheet').addEventListener('click', (e) => { if (e.target === $('#sheet')) closeSheet(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
}

window.addEventListener('popstate', () => go(location.hash.slice(1) || 'V2-0-Welcome', { push: false }));
window.addEventListener('resize', () => { fitBoard(); fitPhone(); if (current) paint(); });

buildControls();
fitPhone();
go(location.hash.slice(1) || 'V2-0-Welcome', { push: false }).catch((err) => {
  $('#screen').textContent = `Could not load this screen (${err.message}).`;
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
