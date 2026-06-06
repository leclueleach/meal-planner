const CACHE_NAME = 'meal-planner-v2';
const ASSETS = [
  '/meal-planner/','/meal-planner/index.html','/meal-planner/styles.css',
  '/meal-planner/config.js','/meal-planner/auth.js','/meal-planner/sheets.js',
  '/meal-planner/firebase.js','/meal-planner/household.js','/meal-planner/snacks.js',
  '/meal-planner/planner.js','/meal-planner/app.js','/meal-planner/favicon.ico',
  '/meal-planner/icon-192.png','/meal-planner/apple-touch-icon.png',
];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(fetch(e.request).then(r => { if (r && r.status === 200) { const c = r.clone(); caches.open(CACHE_NAME).then(cache => cache.put(e.request, c)); } return r; }).catch(() => caches.match(e.request)));
});
