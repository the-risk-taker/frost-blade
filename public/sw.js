// Offline play: every file the game loads is kept in a cache. The network is asked first so updates come in, the cache answers when it fails.
const CACHE = 'frost-blade'

// The page and its entry files are cached on install, the rest as the game loads it
addEventListener('install', e => {
    skipWaiting()
    e.waitUntil(caches.open(CACHE).then(cache => cache.addAll(['/', '/manifest.webmanifest', '/favicon.svg', '/icon-192.png', '/icon-512.png'])))
})

// The page sends every file it has loaded so far, so a first visit is already playable offline
addEventListener('message', e => e.waitUntil(caches.open(CACHE).then(cache => Promise.all(e.data.map(url => cache.add(url).catch(() => { }))))))
addEventListener('activate', e => e.waitUntil(clients.claim()))

addEventListener('fetch', e => {
    if (e.request.method !== 'GET' || !e.request.url.startsWith('http')) return
    e.respondWith(caches.open(CACHE).then(async cache => {
        try {
            const response = await fetch(e.request)
            if (response.ok || response.type === 'opaque') cache.put(e.request, response.clone())
            return response
        } catch {
            return (await cache.match(e.request)) ?? Response.error()
        }
    }))
})
