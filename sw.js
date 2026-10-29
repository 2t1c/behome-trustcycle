// Offline support. Everything the app needs is stored on install, so it opens and every screen works
// without a connection. Requests are answered from the cache first (fast on a busy classroom Wi-Fi) and
// refreshed from the network in the background, so the next open has the latest version.
// Bump CACHE whenever this list changes.
const CACHE = 'trustcycle-v2';
const SCREENS = [
  'screens/V2-0-DVF.dc.html',
  'screens/V2-0-Guide.dc.html',
  'screens/V2-0-Journey.dc.html',
  'screens/V2-0-Welcome.dc.html',
  'screens/V2-1-1-CleaningLevel.dc.html',
  'screens/V2-1-2-YourHome.dc.html',
  'screens/V2-1-3-Priorities.dc.html',
  'screens/V2-1-4-RecommendedPlan.dc.html',
  'screens/V2-1-5-QualityAgreement.dc.html',
  'screens/V2-1-6-RecoveryPolicy.dc.html',
  'screens/V2-2-1-MatchedTaskers.dc.html',
  'screens/V2-2-2-CapabilityCard.dc.html',
  'screens/V2-2-3-SendRequest.dc.html',
  'screens/V2-2-4-TaskerConfirms.dc.html',
  'screens/V2-2-5-BookingConfirmed.dc.html',
  'screens/V2-3-1-FirstCleanCheck.dc.html',
  'screens/V2-3-2-ApproveChange.dc.html',
  'screens/V2-3-3-PhotoChecklist.dc.html',
  'screens/V2-4-1-CheckResult.dc.html',
  'screens/V2-4-2-ReportNotMet.dc.html',
  'screens/V2-4-3-CaseFeedback.dc.html',
  'screens/V2-5-1-RebookPlan.dc.html',
];
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/dc.js', 'js/screens.js', 'js/store.js',
  'img/icon-192.png', 'img/icon-512.png', 'img/apple-touch-icon.png',
  ...SCREENS,
];
// The Be Vietnam Pro font comes from Google Fonts: kept once it has been loaded.
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('trustcycle-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || (url.origin !== location.origin && !FONT_HOSTS.includes(url.hostname))) return;
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const cached = await cache.match(req, { ignoreSearch: true });
    const fresh = fetch(req).then((res) => {
      if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
      return res;
    }).catch(() => cached || (req.mode === 'navigate' ? cache.match('index.html') : Response.error()));
    if (cached) { e.waitUntil(fresh.catch(() => {})); return cached; }
    return fresh;
  }));
});
