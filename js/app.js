// App shell: loads a screen file, renders it into the phone frame (or full screen on a phone),
// follows links between screens, and drives the demo panel on larger screens.
import { compile, render } from './dc.js';
import { SCREENS, STAGES, byFile } from './screens.js';

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

function instanceFor(file, screen) {
  if (!instances.has(file)) {
    const inst = new screen.Component({ showLabels: settings.showLabels });
    inst._onChange = () => { if (current === file) paint(); };
    instances.set(file, inst);
  }
  const inst = instances.get(file);
  inst.props = { ...inst.props, showLabels: settings.showLabels };
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
  $('#screen-style').textContent = screen.styles;
  document.title = `${screen.title} · beHome TrustCycle`;
  document.body.classList.toggle('board-mode', !!meta.board);
  $('#app-tag').textContent = meta.tasker ? 'Tasker app · beHome Partner' : meta.board ? 'Overview' : 'Customer app';
  $('#app-tag').classList.toggle('tasker', !!meta.tasker);
  if (push && location.hash.slice(1) !== meta.file) history.pushState(null, '', `#${meta.file}`);
  ($('#board').replaceChildren(), $('#screen').replaceChildren());
  paint();
  fitBoard();
  (meta.board ? $('#board-wrap') : $('#screen').firstElementChild)?.scrollTo?.(0, 0);
  document.querySelectorAll('#panel [data-file]').forEach((b) => b.classList.toggle('on', b.dataset.file === meta.file));
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

function buildPanel() {
  const list = $('#screen-list');
  list.replaceChildren(...STAGES.map((st) => {
    const group = document.createElement('div');
    group.className = 'group';
    const h = document.createElement('h4');
    h.textContent = st.label;
    group.append(h);
    for (const s of SCREENS.filter((x) => x.stage === st.id)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.file = s.file;
      b.textContent = s.label;
      if (s.tasker) { const t = document.createElement('span'); t.className = 'tag'; t.textContent = 'Tasker'; b.append(t); }
      b.addEventListener('click', () => go(s.file));
      group.append(b);
    }
    return group;
  }));
  const labels = $('#toggle-labels');
  labels.checked = settings.showLabels;
  labels.addEventListener('change', () => {
    settings.showLabels = labels.checked;
    writeSetting('showLabels', settings.showLabels);
    paint();
  });
  $('#reset').addEventListener('click', () => { instances.clear(); paint(); });
}

window.addEventListener('popstate', () => go(location.hash.slice(1) || startFile(), { push: false }));
window.addEventListener('resize', () => { fitBoard(); fitPhone(); if (current) paint(); });

// Phones start at the first screen; laptops start at the guide.
const startFile = () => (isPhone() ? 'V2-1-1-CleaningLevel' : 'V2-0-Guide');

buildPanel();
fitPhone();
go(location.hash.slice(1) || startFile(), { push: false }).catch((err) => {
  $('#screen').textContent = `Could not load this screen (${err.message}).`;
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
