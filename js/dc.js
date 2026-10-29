// Minimal runtime for the prototype's screen files (screens/*.dc.html).
// Each file holds an <x-dc> template and a `class Component extends DCLogic` script.
// Supported template syntax: {{path}} holes in text and attributes, <sc-if value>,
// <sc-for list as>, and sc-camel-* attributes (on-click -> click handler, view-box -> viewBox).

export class DCLogic {
  constructor(props = {}) {
    this.props = props;
    this.state = {};
    this._onChange = null;
  }
  setState(patch) {
    const next = typeof patch === 'function' ? patch(this.state, this.props) : patch;
    this.state = { ...this.state, ...next };
    this._onChange?.(this.state);
  }
  forceUpdate() { this._onChange?.(); }
  renderVals() { return {}; }
}

const HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;
const WHOLE = /^\{\{\s*([^}]+?)\s*\}\}$/;

function lookup(expr, scope) {
  if (expr === 'true') return true;
  if (expr === 'false') return false;
  if (expr === 'null') return null;
  if (expr === 'undefined') return undefined;
  if (/^-?\d+(\.\d+)?$/.test(expr)) return Number(expr);
  if (/^(['"]).*\1$/.test(expr)) return expr.slice(1, -1);
  let v = scope;
  for (const key of expr.split('.')) {
    if (v == null) return undefined;
    v = v[key];
  }
  return v;
}

const interpolate = (str, scope) => str.replace(HOLE, (_, e) => {
  const v = lookup(e, scope);
  return v == null ? '' : String(v);
});

const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

// Handlers live on the element (el.__dc), behind one listener per event type, so patch() can hand an element
// that stays on screen the handlers of its newest render.
function dispatch(e) {
  const fn = this.__dc?.[e.type];
  return fn ? fn.call(this, e) : undefined;
}
function listen(el, type, fn) {
  (el.__dc ||= {})[type] = fn;
  el.addEventListener(type, dispatch);
}

function renderNode(node, scope, out) {
  if (node.nodeType === Node.TEXT_NODE) {
    out.push(document.createTextNode(node.data.includes('{{') ? interpolate(node.data, scope) : node.data));
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const tag = node.localName;
  if (tag === 'sc-if') {
    const m = (node.getAttribute('value') || '').match(WHOLE);
    if (m && lookup(m[1], scope)) renderChildren(node, scope, out);
    return;
  }
  if (tag === 'sc-for') {
    const m = (node.getAttribute('list') || '').match(WHOLE);
    const list = (m && lookup(m[1], scope)) || [];
    const as = node.getAttribute('as') || 'item';
    list.forEach((item, i) => renderChildren(node, { ...scope, [as]: item, $index: i }, out));
    return;
  }
  const el = node.namespaceURI === 'http://www.w3.org/2000/svg'
    ? document.createElementNS(node.namespaceURI, tag)
    : document.createElement(tag);
  for (const { name, value } of node.attributes) {
    if (name.startsWith('hint-')) continue;
    const whole = value.match(WHOLE);
    const raw = whole ? lookup(whole[1], scope) : value.includes('{{') ? interpolate(value, scope) : value;
    if (name.startsWith('sc-camel-')) {
      const prop = camel(name.slice(9));
      if (/^on[a-z]/i.test(prop)) {
        if (typeof raw === 'function') listen(el, prop.slice(2).toLowerCase(), raw);
      } else if (raw != null && raw !== false) {
        el.setAttribute(prop, raw === true ? '' : String(raw));
      }
      continue;
    }
    if (raw == null || raw === false) continue;
    el.setAttribute(name, raw === true ? '' : String(raw));
  }
  el.__cls = el.getAttribute('class') || '';   // as rendered; the app may add classes of its own (e.g. glass)
  const children = [];
  renderChildren(tag === 'template' ? node.content : node, scope, children);
  el.append(...children);
  out.push(el);
}

function renderChildren(parent, scope, out) {
  for (const child of parent.childNodes) renderNode(child, scope, out);
}

/** Parse one .dc.html file into { title, styles, template, Component }. */
export function compile(source) {
  const doc = new DOMParser().parseFromString(source, 'text/html');
  const xdc = doc.querySelector('x-dc');
  const helmet = xdc.querySelector('helmet');
  const styles = helmet ? [...helmet.querySelectorAll('style')].map((s) => s.textContent).join('\n') : '';
  helmet?.remove();
  const script = doc.querySelector('script[data-dc-script]');
  let props = {};
  try { props = JSON.parse(script.getAttribute('data-props') || '{}'); } catch { /* none */ }
  // The screen's own logic class, run as written.
  const Component = new Function('DCLogic', `${script.textContent}\nreturn Component;`)(DCLogic);
  return { title: doc.title, styles, template: xdc, Component, preview: props.$preview };
}

/** Render a compiled screen's template with the component's current values. */
export function render(compiled, instance) {
  const out = [];
  renderChildren(compiled.template, instance.renderVals(), out);
  return out;
}

// Sibling identity for patch(): the same tag with the same classes is taken to be the same thing.
const sig = (n) => (n.nodeType === Node.ELEMENT_NODE ? `${n.namespaceURI}|${n.localName}|${n.__cls ?? n.getAttribute('class') ?? ''}` : `#${n.nodeType}`);
const LOOKAHEAD = 4;

function update(o, n) {
  if (o.nodeType !== Node.ELEMENT_NODE) {
    if (o.data !== n.data) o.data = n.data;
    return;
  }
  for (const { name } of [...o.attributes]) if (!n.hasAttribute(name)) o.removeAttribute(name);
  for (const { name, value } of n.attributes) if (o.getAttribute(name) !== value) o.setAttribute(name, value);
  o.__dc = n.__dc;
  o.__cls = n.__cls;
  if (n.__dc) for (const type of Object.keys(n.__dc)) o.addEventListener(type, dispatch);
  if (o.localName === 'textarea' || o.localName === 'input') return;   // keep what the person typed
  patch(o, [...n.childNodes]);
}

/**
 * Bring `parent`'s children in line with freshly rendered `nodes`, keeping every element that is still there.
 * A re-render after a state change then changes only what changed: CSS transitions run (a toggle's knob
 * slides, a box fills), scroll positions, focus and typed text stay, and entrance animations don't replay.
 */
export function patch(parent, nodes) {
  let old = [...parent.childNodes];
  let j = 0;
  for (const n of nodes) {
    const o = old[j];
    if (o && sig(o) === sig(n)) { update(o, n); j++; continue; }
    // Something was taken out before this node: skip ahead to its match.
    const k = old.slice(j + 1, j + 1 + LOOKAHEAD).findIndex((x) => sig(x) === sig(n));
    if (k >= 0 && !nodes.slice(nodes.indexOf(n) + 1).some((x) => o && sig(x) === sig(o))) {
      for (let r = 0; r <= k; r++) old[j + r].remove();
      j += k + 1;
      update(old[j], n);
      j++;
      continue;
    }
    // Something new: put it in before the next old node.
    if (o) parent.insertBefore(n, o); else parent.append(n);
  }
  for (; j < old.length; j++) old[j].remove();
}
