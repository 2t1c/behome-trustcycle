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
        if (typeof raw === 'function') el.addEventListener(prop.slice(2).toLowerCase(), raw);
      } else if (raw != null && raw !== false) {
        el.setAttribute(prop, raw === true ? '' : String(raw));
      }
      continue;
    }
    if (raw == null || raw === false) continue;
    el.setAttribute(name, raw === true ? '' : String(raw));
  }
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
