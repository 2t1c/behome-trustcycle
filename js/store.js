// What the app remembers between screens and across reloads, kept on this device only.
// `screens` holds each screen's own state (its choices), `visited` the screens opened so far.
const KEY = 'behome-trustcycle:v1';

function load() {
  try { return { screens: {}, visited: [], ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { screens: {}, visited: [] }; }
}

let data = load();
const listeners = new Set();

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* private mode: keep going in memory */ }
  listeners.forEach((fn) => fn(data));
}

export const store = {
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  screenState: (file) => data.screens[file] || null,
  saveScreenState(file, state) { data.screens[file] = state; save(); },
  visited: () => data.visited,
  hasVisited: (file) => data.visited.includes(file),
  visit(file) { if (!data.visited.includes(file)) { data.visited = [...data.visited, file]; save(); } },
  reset() { data = { screens: {}, visited: [] }; try { localStorage.removeItem(KEY); } catch { /* ignore */ } listeners.forEach((fn) => fn(data)); },
};
