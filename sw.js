// DiabeFit Pro Service Worker
const CACHE_NAME = 'diabefit-pro-v1';
const urlsToCache = [
    '/Diabefit/',
    '/Diabefit/index.html',
    '/Diabefit/app.js',
    '/Diabefit/manifest.json',
    '/Diabefit/icon-192.png',
    '/Diabefit/icon-512.png'
];

// Install - cache files
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('DiabeFit Pro: Caching files');
                return cache.addAll(urlsToCache);
            })
    );
    self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('DiabeFit Pro: Removing old cache', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                if (response) {
                    return response;
                }
                return fetch(event.request)
                    .then((response) => {
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });
                        return response;
                    });
            })
            .catch(() => {
                return caches.match('/Diabefit/index.html');
            })
    );
});

// Push notifications
self.addEventListener('push', (event) => {
    const options = {
        body: event.data ? event.data.text() : 'Tijd om te trainen!',
        icon: '/Diabefit/icon-192.png',
        badge: '/Diabefit/icon-192.png',
        vibrate: [100, 50, 100],
        actions: [
            { action: 'open', title: 'Open app' },
            { action: 'close', title: 'Sluiten' }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification('DiabeFit Pro', options)
    );
});

// Notification click
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    if (event.action === 'open' || !event.action) {
        event.waitUntil(clients.openWindow('/Diabefit/'));
    }
});
