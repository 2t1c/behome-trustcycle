// Motion: screen-to-screen slides and the small moments inside a screen. Everything here is short
// (120–320ms), eases out, and steps down to a quick fade or nothing when the person asks for reduced motion.

export const EASE = 'cubic-bezier(.2,.8,.2,1)';
const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
export const reduced = () => reducedQuery.matches;

/**
 * Swap the screen with a transition. `dir` is 'fwd' (the new screen slides in from the right, the old one shifts
 * left and dims), 'back' (the other way) or 'fade' (menu jumps, tabs, the first load). `swap` changes the DOM
 * synchronously and returns false if it decided not to (a newer navigation won); with View Transitions it runs
 * on the next frame, after the old screen has been captured. Uses the View Transitions API
 * where there is one, and a CSS class on #screen otherwise.
 */
export function transition(dir, swap, { sync = false } = {}) {
  const root = document.documentElement;
  const screen = document.getElementById('screen');
  if (reduced()) dir = 'quick';
  // `sync`: swap now (the first load, an address typed in the bar) and ease the new screen in with CSS.
  if (sync || !document.startViewTransition || document.visibilityState === 'hidden') {
    if (swap() === false) return;
    cssEnter(screen, dir);
    return;
  }
  const cls = `vt-${dir}`;
  let vt;
  try {
    // The class picks the animation; it is read once the new view exists, so it is set in the callback.
    vt = document.startViewTransition(() => {
      root.classList.remove('vt-fwd', 'vt-back', 'vt-fade', 'vt-quick');
      root.classList.add(cls);
      if (swap() === false) vt?.skipTransition();
    });
  } catch {
    if (swap() !== false) cssEnter(screen, dir);
    return;
  }
  activeVT = vt;
  vt.finished.finally(() => { if (activeVT === vt) root.classList.remove(cls); });
}
let activeVT = null;

// Fallback without View Transitions: the new screen eases in from the side it comes from.
function cssEnter(screen, dir) {
  screen.classList.remove('enter-fwd', 'enter-back', 'enter-fade', 'enter-quick');
  void screen.offsetWidth;   // restart the animation
  screen.classList.add(`enter-${dir}`);
  const done = () => screen.classList.remove(`enter-${dir}`);
  screen.addEventListener('animationend', (e) => { if (e.target === screen) done(); }, { once: true });
  setTimeout(done, 600);
}

/** A photo that was just added fades and settles into place. */
export function photoIn(el) {
  if (reduced()) { el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120 }); return; }
  el.animate([{ opacity: 0, transform: 'scale(.86)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: EASE });
}

/** Success: the green circle scales in, then the tick draws itself; the card around it rises in. */
export function success(svg) {
  const card = svg.closest('[data-booked-card], .sec');
  if (reduced()) { card?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120 }); return; }
  const circle = svg.querySelector('circle');
  const tick = svg.querySelector('path');
  card?.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: EASE });
  circle?.animate([{ transform: 'scale(0)' }, { transform: 'scale(1.1)', offset: 0.7 }, { transform: 'scale(1)' }], { duration: 320, easing: EASE });
  if (tick?.getTotalLength) {
    const len = tick.getTotalLength();
    tick.style.strokeDasharray = String(len);
    tick.animate([{ strokeDashoffset: len }, { strokeDashoffset: len, offset: 0.4 }, { strokeDashoffset: 0 }], { duration: 560, easing: 'cubic-bezier(.4,0,.2,1)' });
  }
}
