const STATIC_CACHE = 'tomny-static-v1'
const PAGE_CACHE = 'tomny-pages-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(['/login', '/icon.svg', '/manifest.webmanifest'])))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(caches.open(STATIC_CACHE).then(async (cache) => {
      const cached = await cache.match(request)
      if (cached) return cached
      const response = await fetch(request)
      if (response.ok) await cache.put(request, response.clone())
      return response
    }))
    return
  }
  if (url.pathname === '/pos' || url.pathname === '/login') {
    event.respondWith(fetch(request).then(async (response) => {
      if (response.ok) await (await caches.open(PAGE_CACHE)).put(request, response.clone())
      return response
    }).catch(async () => (await caches.open(PAGE_CACHE)).match(request) ?? (await caches.open(STATIC_CACHE)).match('/login')))
  }
})
