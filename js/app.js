// App shell: loads a screen file, renders it into the phone frame (or full screen on a phone),
// follows links between screens, remembers choices, and drives the screen menu.
import { compile, render, patch } from './dc.js';
import { transition, photoIn, success } from './motion.js';
import { pickPhoto } from './photo.js';
import { SCREENS, STAGES, MAIN_PATH, byFile } from './screens.js';
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
  pickPhoto,
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

// Things that appear because of something the person did on the screen (not because the screen opened)
// get a moment of motion: a photo that was just added, a booking that was just confirmed.
const PHOTOS = '.ph[data-i], img.mine, .yours img';
const SUCCESS = '[data-success]';

function paint() {
  const meta = byFile(current);
  const screen = compiled.get(current);
  const host = meta.board ? $('#board') : $('#screen');
  const fresh = !host.firstElementChild;   // first paint after opening the screen
  // Keep scroll positions of the screen's scrolling areas across re-renders.
  const saved = [...host.querySelectorAll('*')].filter((el) => el.scrollHeight > el.clientHeight).map((el) => el.scrollTop);
  const before = new Set(host.querySelectorAll(`${PHOTOS}, ${SUCCESS}`));
  const nodes = render(screen, instanceFor(current, screen));
  // A re-render patches the screen in place, so only what changed changes (see patch in js/dc.js).
  patch(host, nodes);
  const root = host.firstElementChild;
  if (root && !meta.board && isPhone()) { root.style.width = '100%'; root.style.height = '100%'; }
  if (root && !meta.board) floatBar(root);
  const after = [...host.querySelectorAll('*')].filter((el) => el.scrollHeight > el.clientHeight);
  after.forEach((el, i) => { if (saved[i]) el.scrollTop = saved[i]; });
  wireMenuButton(meta);
  if (!fresh) {
    const added = (sel) => [...host.querySelectorAll(sel)].filter((el) => !before.has(el));
    const photos = added(PHOTOS);
    photos.filter((el) => !photos.some((p) => p !== el && p.contains(el))).forEach(photoIn);
    added(SUCCESS).forEach(success);
  }
  themeColor();
}

// The browser's bar matches the top of the screen: Be yellow on Welcome and the Tasker app, white elsewhere.
function themeColor() {
  const meta = document.querySelector('meta[name="theme-color"]');
  const host = $('#screen');
  if (!meta || !host.firstElementChild) return;
  const r = host.getBoundingClientRect();
  let el = document.elementFromPoint(r.left + r.width / 2, r.top + Math.max(2, parseFloat(getComputedStyle(host).paddingTop) + 2));
  while (el && host.contains(el)) {
    const bg = getComputedStyle(el).backgroundColor;
    if (bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) { meta.content = bg; return; }
    el = el.parentElement;
  }
}

// Liquid glass: a screen's bottom bar (or the home tab bar) floats over the content as a glass panel, so the
// content scrolls on beneath it. The scrolling area gets room at the end so its last row clears the bar.
function floatBar(app) {
  const bar = app.querySelector(':scope > .bb, :scope > .tabs');
  const body = app.querySelector(':scope > .body');
  if (!bar || !body) return;
  app.classList.add('glass');
  body.style.paddingBottom = `${bar.offsetHeight + 20}px`;
  body.style.scrollPaddingBottom = `${bar.offsetHeight + 20}px`;   // scrollIntoView stops above the bar
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
  btn.addEventListener('click', toggleSheet);   // the same function each paint, so it is added once
}
function toggleSheet() { setSheet($('#sheet').hidden); }

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

let navigation = 0;   // the latest go(); an earlier one that finishes loading later must not paint over it
let historyIndex = 0; // position of this entry in the tab's history, to tell browser back from forward
const ENTER_MS = 700; // how long a newly opened screen keeps its entrance animations (sections, glass bar)

// Which way a move goes: forward slides in from the right, back from the left, and a jump crossfades.
// Within the journey, a screen earlier than this one is back; Welcome is always back; overview screens
// (the journey map, the boards, the tabs) are forward.
function direction(to) {
  const from = byFile(current);
  const target = byFile(to);
  if (!from || !target) return 'fade';
  if (target.file === 'V2-0-Welcome') return from.file === 'V2-0-Welcome' ? 'fade' : 'back';
  if (target.stage === 0 || from.stage === 0) return 'fwd';
  return SCREENS.indexOf(target) < SCREENS.indexOf(from) ? 'back' : 'fwd';
}

let heading = null;   // where the latest go() is heading, so quick key presses step on from there

async function go(file, { push = true, dir, instant = false } = {}) {
  // An unknown or mistyped address opens the welcome screen instead of a blank page.
  const meta = byFile(file) || byFile('V2-0-Welcome');
  const ticket = ++navigation;
  heading = meta.file;
  let screen;
  try {
    screen = await load(meta.file);
  } catch (err) {
    if (ticket !== navigation) return;
    heading = current;
    toast(`Couldn't open ${meta.label}. Check the connection and try again.`);
    if (!current) $('#screen').textContent = `Could not load this screen (${err.message}).`;
    return;
  }
  if (ticket !== navigation) return;
  const first = !current;
  const way = first ? 'fade' : dir || direction(meta.file);
  const fromBoard = !!byFile(current)?.board;
  // The DOM swap runs inside the transition (after the old screen is captured); a newer go() wins.
  transition(meta.board || fromBoard ? 'fade' : way, () => {
    if (ticket !== navigation) return false;
    current = meta.file;
    store.visit(meta.file);
    $('#screen-style').textContent = screen.styles;
    scopeStyles($('#screen-style'));
    document.title = `${screen.title} · beHome TrustCycle`;
    document.body.classList.toggle('board-mode', !!meta.board);
    document.body.classList.toggle('tasker-mode', !!meta.tasker);
    const tag = meta.tasker ? 'Tasker app · beHome Partner' : meta.board || meta.stage === 0 ? 'Overview' : 'Customer app';
    document.querySelectorAll('.app-tag').forEach((el) => { el.textContent = tag; el.classList.toggle('tasker', !!meta.tasker); });
    if (push && location.hash.slice(1) !== meta.file) history.pushState({ i: ++historyIndex }, '', `#${meta.file}`);
    else history.replaceState({ i: historyIndex }, '', `#${meta.file}`);
    ($('#board').replaceChildren(), $('#screen').replaceChildren());
    // Entrance animations (sections fading up, the glass bar rising) belong to opening the screen: they run
    // while #screen carries data-enter, and a re-render from a state change doesn't replay them.
    $('#screen').dataset.enter = String(ticket);
    setTimeout(() => { if ($('#screen').dataset.enter === String(ticket)) delete $('#screen').dataset.enter; }, ENTER_MS);
    paint();
    fitBoard();
    (meta.board ? $('#board-wrap') : $('#screen').firstElementChild)?.scrollTo?.(0, 0);
    closeSheet();
    markLists();
    return true;
  }, { sync: first || instant });
}

// Links inside screens point at other screen files, e.g. "V2-1-2-YourHome.dc.html".
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href]');
  if (!a) return;
  const m = a.getAttribute('href').match(/^([\w-]+)\.dc\.html(#.*)?$/);
  if (!m) return;
  e.preventDefault();
  // A back arrow, or a link marked data-nav="back" / "fade", says which way it goes; others go by journey order.
  const nav = a.dataset.nav || (/^Back\b/.test(a.getAttribute('aria-label') || '') ? 'back' : undefined);
  go(m[1], { dir: nav });
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

// On laptops the phone is drawn at real size, shrunk only when the window is too short. Presenting, it fills
// the window's height (864 = 844 plus the 10px frame), with a little margin.
function fitPhone() {
  const k = presenting()
    ? Math.min((window.innerHeight - 36) / 864, (window.innerWidth - 36) / 410)
    : Math.min(1, (window.innerHeight - 48) / 864);
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
      b.addEventListener('click', () => go(s.file, { dir: 'fade' }));   // a jump: crossfade
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
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#sheet').hidden) { closeSheet(); e.preventDefault(); } });
  $('#present-btn').addEventListener('click', () => setPresenter(!presenting()));
  $('#present-hint').addEventListener('click', () => setPresenter(false));
}

// Presenter mode, for the projector: P (or Present in the panel) hides the panel and fills the window's height
// with the phone; → / ← (PageDown / PageUp, Space / Shift+Space) walk the main path; P or Esc leaves.
// Kept for the tab's session. Not on phones.
const PRESENT_KEY = 'behome:presenter';
const presenting = () => document.body.classList.contains('presenter');
let hintTimer;
function setPresenter(on) {
  const value = !!on && !isPhone();
  document.body.classList.toggle('presenter', value);
  $('#present-btn').setAttribute('aria-pressed', String(value));
  try { sessionStorage.setItem(PRESENT_KEY, value ? '1' : '0'); } catch { /* private mode */ }
  fitPhone();
  fitBoard();
  showHint();
}
function showHint() {
  const hint = $('#present-hint');
  hint.hidden = !presenting();
  clearTimeout(hintTimer);
  hint.classList.remove('faded');
  if (presenting()) hintTimer = setTimeout(() => hint.classList.add('faded'), 3000);
}
let lastMove = 0;
document.addEventListener('mousemove', () => {
  if (!presenting() || Date.now() - lastMove < 400) return;
  lastMove = Date.now();
  if ($('#present-hint').classList.contains('faded')) showHint();
});

// One step along the main path. From a side trip or an overview screen, the nearest main screen that way.
function step(d) {
  const from = heading || current;
  const pos = SCREENS.findIndex((s) => s.file === from);
  const order = MAIN_PATH.map((f) => SCREENS.findIndex((s) => s.file === f));
  const i = MAIN_PATH.indexOf(from);
  const target = i >= 0 ? MAIN_PATH[i + d]
    : d > 0 ? MAIN_PATH.find((f, k) => order[k] > pos) : [...MAIN_PATH].reverse().find((f) => order[MAIN_PATH.indexOf(f)] < pos);
  if (!target) { toast(d > 0 ? 'That’s the end of the main path. ← goes back.' : 'This is the start. → moves on.'); return; }
  go(target, { dir: d > 0 ? 'fwd' : 'back' });
}

const typing = (el) => !!el?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
document.addEventListener('keydown', (e) => {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
  if (e.key === 'p' || e.key === 'P') {
    if (isPhone()) return;
    e.preventDefault();
    setPresenter(!presenting());
    return;
  }
  if (!presenting() || !$('#sheet').hidden || document.querySelector('#photo-sheet:not([hidden])')) return;
  if (e.key === 'Escape') { setPresenter(false); return; }
  const fwd = e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey);
  const back = e.key === 'ArrowLeft' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey);
  if (!fwd && !back) return;
  e.preventDefault();   // also keeps Space from pressing the focused button
  step(fwd ? 1 : -1);
});

// Browser back and forward: the entry's index says which way. An address typed or opened by a link
// (no index yet) is a jump, and gets the next index.
window.addEventListener('popstate', (e) => {
  const i = e.state?.i;
  const file = location.hash.slice(1) || 'V2-0-Welcome';
  if (typeof i !== 'number') { historyIndex++; go(file, { push: false, dir: 'fade', instant: true }); return; }
  const dir = i < historyIndex ? 'back' : i > historyIndex ? 'fwd' : 'fade';
  historyIndex = i;
  go(file, { push: false, dir });
});
window.addEventListener('resize', () => { fitBoard(); fitPhone(); if (current) paint(); });

historyIndex = typeof history.state?.i === 'number' ? history.state.i : 0;
buildControls();
try { if (sessionStorage.getItem(PRESENT_KEY) === '1') setPresenter(true); } catch { /* private mode */ }
fitPhone();
go(location.hash.slice(1) || 'V2-0-Welcome', { push: false });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
