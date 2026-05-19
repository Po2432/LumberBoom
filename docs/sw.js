const CACHE_NAME = 'lumberboom-v4';
const ASSETS = [
    './',
    './index.html',
    './play.html',
    './style.css',
    './game.js',
    './manifest.json',
    './logo.svg'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => response || fetch(event.request))
    );
});

// Listen for the "skipWaiting" message from the Update Banner to force an update
self.addEventListener('message', event => {
    if (event.data && event.data.action === 'skipWaiting') {
        self.skipWaiting();
    }
});
