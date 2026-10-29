// Where a photo comes from: the camera, the photo library, or (for the class demo) a sample picture.
// pickPhoto() shows a small action sheet and resolves to a downscaled JPEG data URL, 'sample', or null.

const MAX_SIDE = 480;     // px; keeps each photo around 30 KB so it fits in the demo's saved state
const QUALITY = 0.74;

const ICONS = {
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  library: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  sample: '<path d="M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15.5l-1.8-4.7L5.5 9l4.7-1.3z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
};

let sheet = null;
let pending = null;   // { resolve, opener }

function option(source, label) {
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.source = source;
  b.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[source]}</svg><span></span>`;
  b.querySelector('span').textContent = label;
  return b;
}

function fileInput(capture) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  if (capture) input.setAttribute('capture', 'environment');
  input.hidden = true;
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    input.value = '';
    finish(file ? await shrink(file).catch(() => null) : null);
  });
  input.addEventListener('cancel', () => finish(null));
  return input;
}

function build() {
  sheet = document.createElement('div');
  sheet.id = 'photo-sheet';
  sheet.hidden = true;
  sheet.innerHTML = '<div class="ps-card" role="dialog" aria-modal="true" aria-labelledby="ps-title"><p id="ps-title">Add a photo</p><div class="ps-list"></div><button type="button" class="ps-cancel">Cancel</button></div>';
  const list = sheet.querySelector('.ps-list');
  const camera = fileInput(true);
  const library = fileInput(false);
  const take = option('camera', 'Take photo');
  const choose = option('library', 'Choose from library');
  const sample = option('sample', 'Use sample photo');
  // The file pickers must open inside the tap itself, or the browser blocks them.
  take.addEventListener('click', () => { hide(); camera.click(); });
  choose.addEventListener('click', () => { hide(); library.click(); });
  sample.addEventListener('click', () => { hide(); finish('sample'); });
  list.append(take, choose, sample);
  sheet.querySelector('.ps-cancel').addEventListener('click', () => { hide(); finish(null); });
  sheet.addEventListener('click', (e) => { if (e.target === sheet) { hide(); finish(null); } });
  sheet.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); hide(); finish(null); } });
  document.body.append(sheet, camera, library);
}

function hide() { sheet.hidden = true; }

function finish(result) {
  if (!pending) return;
  const { resolve, opener } = pending;
  pending = null;
  if (opener?.isConnected) opener.focus();
  resolve(result);
}

/** Downscale an image file to a JPEG data URL no wider or taller than MAX_SIDE. */
async function shrink(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = url; });
    const k = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * k);
    canvas.height = Math.round(img.naturalHeight * k);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', QUALITY);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Ask where the photo comes from. `sample: false` leaves out the demo's sample picture.
 * Resolves to a data URL, 'sample', or null if the person cancels.
 */
export function pickPhoto({ sample = true } = {}) {
  if (!sheet) build();
  if (pending) finish(null);
  sheet.querySelector('[data-source="sample"]').hidden = !sample;
  sheet.hidden = false;
  return new Promise((resolve) => {
    pending = { resolve, opener: document.activeElement };
    sheet.querySelector('.ps-list button').focus();
  });
}
